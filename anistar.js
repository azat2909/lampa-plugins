/*!
 * Anistar для Lampa
 * Версия 0.5.3
 */
(function () {
    'use strict';

    var SOURCE = 'anistar';
    var NAME = 'Anistar';
    var VERSION = '0.5.3';
    var SITE = 'https://anistar.org';
    var CATALOG = SITE + '/anime/';
    var CATALOG_PATH = /^\/anime(?:\/page\/(\d+))?\/?$/i;
    var LEGACY_CARD = '.shortstory, .base, .news, .item, .anime-item, .movie-item, article, li';
    var VIEW = 'anistar_watch';
    var COMMENTS = 'anistar_comments';
    var PAGE_SIZE = 20;
    var SEARCH_PAGE_SIZE = 10;
    var ANIME_CATEGORY_ID = 39;
    var SEARCH_URL = SITE + '/index.php?do=search';
    var TIMEOUT = 18000;
    var GENRE_CACHE = 'anistar_anime_genres_v1';
    var GENRE_TTL = 7 * 24 * 60 * 60 * 1000;
    var ICON = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.9 6.1 6.7.9-4.8 4.8 1.1 6.7-5.9-3.2-5.9 3.2 1.1-6.7L2.4 9l6.7-.9z"/></svg>';
    var STATUS = [
        { title: 'Избранное', path: '/favorites/' },
        { title: 'Смотрю', path: '/status-anime/2/', id: 2 },
        { title: 'Просмотрено', path: '/status-anime/1/', id: 1 },
        { title: 'В планах', path: '/status-anime/3/', id: 3 },
        { title: 'Брошено', path: '/status-anime/4/', id: 4 }
    ];
    var SORT = [
        ['По дате', 'date'],
        ['По популярности', 'rating'],
        ['По посещаемости', 'news_read'],
        ['По комментариям', 'comm_num'],
        ['По алфавиту', 'title']
    ].reduce(function (options, field) {
        return options.concat([
            { title: field[0] + ' ↑', key: field[1], direction: 'asc' },
            { title: field[0] + ' ↓', key: field[1], direction: 'desc' }
        ]);
    }, []);
    var parser = new DOMParser();
    var genreIndex = new Map();
    var lists = new WeakMap();
    var filters = { sort: 0, year: '', genre: '', query: '' };
    var genreRefresh;
    var genresUpdated = 0;
    var playerOrigin;
    var session;
    var nativeCookies = new Map();

    function clean(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
    }

    function decodeHtml(value) {
        var field = document.createElement('span');
        field.innerHTML = String(value || '').replace(/</g, '&lt;');
        return field.textContent;
    }

    function urlOf(value, base) {
        if (!value || !String(value).trim()) return null;
        try {
            var url = new URL(value, base || SITE);
            return url.protocol === 'https:' && !url.username && !url.password ? url : null;
        } catch (error) {
            return null;
        }
    }

    function siteUrl(value, base) {
        if (!value || !String(value).trim()) return '';
        try {
            var url = new URL(value, base || SITE);
            if (url.protocol === 'http:' && url.hostname === 'anistar.org' && !url.port) url.protocol = 'https:';
            if (url.protocol !== 'https:' || url.hostname !== 'anistar.org' || url.port || url.username || url.password) return '';
            url.hash = '';
            return url.href;
        } catch (error) {
            return '';
        }
    }

    function desktopUrl(value) {
        var url = new URL(value);
        url.searchParams.set('skin_name', 'new36');
        return url.href;
    }

    function sitePath(value) {
        var url = siteUrl(value);
        return url ? new URL(url).pathname : '';
    }

    function hasCategory(node, pattern) {
        var categories = node.querySelectorAll('.tags a, .category a');
        return Array.prototype.some.call(categories, function (link) {
            return pattern.test(sitePath(link.getAttribute('href')));
        });
    }

    function nodeText(scope, selector) {
        var node = scope.querySelector(selector);
        return node ? clean(node.textContent) : '';
    }

    function android() {
        return Boolean(window.AndroidJS && typeof window.AndroidJS.httpReq === 'function' && Lampa.Platform.is('android'));
    }

    function form(fields) {
        return Object.keys(fields).map(function (key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(fields[key]);
        }).join('&');
    }

    function saveCookies(headers) {
        var cookies = headers && (headers['set-cookie'] || headers['Set-Cookie']);
        if (!cookies) return;
        if (!Array.isArray(cookies)) cookies = [cookies];
        cookies.forEach(function (cookie) {
            var pair = cookie.split(';', 1)[0];
            var delimiter = pair.indexOf('=');
            if (delimiter < 1) return;
            var key = pair.slice(0, delimiter).trim();
            var value = pair.slice(delimiter + 1);
            if (!value || /(?:^|;)\s*max-age=0(?:;|$)/i.test(cookie)) nativeCookies.delete(key);
            else nativeCookies.set(key, value);
        });
    }

    function request(url, options) {
        options = options || {};
        var publicCatalog = options.publicCatalog === true;
        var native = !publicCatalog && android();
        return new Promise(function (resolve, reject) {
            var network = new Lampa.Reguest();
            var body = options.body;
            var headers = Object.assign({}, options.headers);
            var method = body === undefined ? 'GET' : 'POST';
            var local = Boolean(siteUrl(url));
            var timeout = publicCatalog ? 20000 : TIMEOUT;
            var returned = false;
            var timer = setTimeout(function () {
                finish(reject, new Error('AniStar не ответил вовремя.'));
            }, timeout + 1500);

            function finish(callback, value) {
                if (returned) return;
                returned = true;
                clearTimeout(timer);
                callback(value);
            }

            function fail(error) {
                var message = error && Number(error.status) === 403
                    ? 'AniStar отклонил запрос (403).'
                    : 'Не удалось подключиться к AniStar.';
                finish(reject, new Error(message));
            }

            if (native && local && nativeCookies.size) {
                headers.Cookie = Array.from(nativeCookies, function (entry) { return entry.join('='); }).join('; ');
            }
            if (body !== undefined) headers['Content-Type'] = 'application/x-www-form-urlencoded';
            var settings = { dataType: 'text', timeout: timeout };
            if (publicCatalog) {
                // Keep the request shape used by 0.4.55 on Android TV and Tizen.
                body = false;
            } else {
                settings.type = method;
                settings.headers = headers;
                settings.returnHeaders = native;
                settings.withCredentials = options.auth === true;
            }
            // The Android bridge keeps request bodies out of its debug logs in binary mode.
            if (native && options.secret) {
                settings.bodyEncoding = 'base64';
                body = btoa(body);
            }

            try {
                network[publicCatalog || native ? 'native' : 'silent'](url, function (response) {
                    if (returned) return;
                    var html = response;
                    if (native && typeof response === 'string' && /^\s*\{/.test(response)) {
                        try { response = JSON.parse(response); } catch (error) {}
                    }
                    if (native && response && typeof response.body === 'string') {
                        html = response.body;
                        if (local && (!response.currentUrl || siteUrl(response.currentUrl))) saveCookies(response.headers);
                    }
                    if (typeof html !== 'string') {
                        finish(reject, new Error('AniStar вернул неизвестный ответ.'));
                    } else if (/cf-chl-|<title>\s*Just a moment/i.test(html)) {
                        finish(reject, new Error('AniStar запросил проверку Cloudflare.'));
                    } else {
                        finish(resolve, html);
                    }
                }, fail, body, settings);
            } catch (error) {
                fail(error);
            }
        });
    }

    function pageDocument(url, options) {
        return request(url, options).then(function (html) {
            return parser.parseFromString(html, 'text/html');
        });
    }

    function readLinks(scope, prefix) {
        var links = new Map();
        Array.prototype.forEach.call(scope.querySelectorAll('a[href]'), function (link) {
            var href = siteUrl(link.getAttribute('href'));
            var title = clean(link.textContent);
            if (!href || !title) return;
            var url = new URL(href);
            if (url.pathname.indexOf(prefix) !== 0) return;
            var slug = url.pathname.slice(prefix.length).replace(/\/$/, '');
            if (slug && slug.indexOf('/') === -1) links.set(url.href, { url: url.href, title: title });
        });
        return Array.from(links.values());
    }

    function newsId(url) {
        var match = sitePath(url).match(/^\/(\d+)-[^/]+\.html$/i);
        return match ? Number(match[1]) : 0;
    }

    function usableTitle(value) {
        var title = clean(value);
        return title.length >= 2 && title.length <= 220 &&
            !/^(смотреть(?: онлайн)?|подробнее|читать|перейти|следующая|скачать)$/i.test(title) ? title : '';
    }

    function posterUrl(node, article) {
        if (!node) return '';
        var attributes = ['data-original', 'data-original-src', 'data-poster', 'data-lazy-src', 'data-src', 'src'];
        for (var i = 0; i < attributes.length; i++) {
            var value = node.getAttribute(attributes[i]);
            var local = siteUrl(value, article);
            if (local) return local;
            var external = urlOf(value, article);
            if (external) return external.href;
        }
        return '';
    }

    function basicCard(node, article, fallback) {
        var id = newsId(article);
        var joinedTitle = usableTitle(nodeText(node, '.title_left h1, .title_left > a, h1, h2')) || (fallback && fallback.title);
        if (!id || !joinedTitle) return null;
        var titles = joinedTitle.split(/\s+\/\s+/, 2);
        var yearLink = node.querySelector('a[href*="/filter/year/"]');
        var year = yearLink && clean(yearLink.textContent);
        var image = node.querySelector('img.main-img, img[itemprop="image"], .news_avatar img');
        var poster = posterUrl(image, article);
        var isAdult = hasCategory(node, /^\/hentai\/?$/i) || Boolean(fallback && fallback.adult);
        return {
            id: SOURCE + ':' + id,
            source: SOURCE,
            url: article,
            media_type: 'movie',
            title: titles[0],
            tagline: titles[1] || (fallback && fallback.tagline) || '',
            release_date: /^\d{4}$/.test(year) ? year + '-01-01' : (fallback && fallback.release_date) || '',
            poster: poster || (fallback && fallback.poster) || '',
            adult: isAdult,
            restrict: isAdult ? 18 : 0
        };
    }

    function legacyCatalogRows(scope, url) {
        var rows = new Map();
        Array.prototype.forEach.call(scope.querySelectorAll('a[href]'), function (link) {
            var article = siteUrl(link.getAttribute('href'), url);
            var id = newsId(article);
            if (!id || rows.has(id)) return;
            var node = link.closest(LEGACY_CARD) || link.parentElement;
            if (!node) return;
            var image = node.querySelector('img');
            var title = usableTitle(link.getAttribute('title')) || usableTitle(link.textContent) ||
                usableTitle(nodeText(node, 'h1, h2, h3, h4, .title, .name')) ||
                usableTitle(image && image.getAttribute('alt'));
            if (!title) return;
            var poster = posterUrl(image, article) || SITE + '/uploads/posters/' + id + '/original.jpg';
            var card = basicCard(node, article, { title: title, poster: poster });
            if (card) rows.set(id, { card: card, genres: readLinks(node.querySelector('.head') || node, '/filter/janrs/') });
        });
        return Array.from(rows.values());
    }

    function animePageNumber(url) {
        var match = sitePath(url).match(CATALOG_PATH);
        return match ? Number(match[1] || 1) : 0;
    }

    function nextAnimePage(doc, url) {
        var current = animePageNumber(url);
        var next = '';
        var best = Infinity;
        Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (link) {
            var href = siteUrl(link.getAttribute('href'), url);
            var page = animePageNumber(href);
            if (page > current && page < best) {
                next = href;
                best = page;
            }
        });
        return next;
    }

    function catalogPage(doc, url, animeOnly) {
        var animeCatalog = CATALOG_PATH.test(sitePath(url));
        var root = doc.querySelector('#dle-content') || (animeCatalog && doc);
        if (!root) throw new Error('AniStar не вернул список тайтлов.');
        var rows = [];
        var seen = new Set();
        Array.prototype.forEach.call(root.querySelectorAll('.news'), function (node) {
            if (animeOnly && !animeCatalog && !hasCategory(node, /^\/anime(?:\/|$)/i)) return;
            var link = node.querySelector('.title_left > a[href], .title_left h2 a[href]');
            var card = link && basicCard(node, siteUrl(link.getAttribute('href'), url));
            if (!card || seen.has(card.id)) return;
            seen.add(card.id);
            rows.push({ card: card, genres: readLinks(node.querySelector('.head') || node, '/filter/janrs/') });
        });
        if (animeCatalog && !rows.length) {
            rows = legacyCatalogRows(root, url);
            if (!rows.length && root !== doc) rows = legacyCatalogRows(doc, url);
        }
        var link = root.querySelector('.pagenav .r a[href], a[rel~="next"]');
        var next = link && siteUrl(link.getAttribute('href'), url);
        if (animeCatalog && animePageNumber(next) <= animePageNumber(url)) next = nextAnimePage(doc, url);
        return { rows: rows, next: next && next !== url ? next : '' };
    }

    function collectionUrl(folder, value) {
        return SITE + '/filter/' + folder + '/' + value + '/';
    }

    // AniStar's search expects Windows-1251 in the query string.
    function searchEncode(value) {
        return Array.from(value, function (character) {
            var code = character.charCodeAt(0);
            if (code >= 0x410 && code <= 0x44f) return '%' + (code - 0x350).toString(16);
            if (character === 'ё') return '%B8';
            if (character === 'Ё') return '%A8';
            return encodeURIComponent(character);
        }).join('');
    }

    function catalogStart(state) {
        if (state.anistarList) return SITE + state.anistarList.path;
        if (state.anistarRoute) return state.anistarRoute;
        if (state.query) return 1;
        return state.genre || (state.year && collectionUrl('year', state.year)) || CATALOG;
    }

    function sortOptions(state) {
        var sort = SORT[state.sort] || SORT[0];
        return {
            body: form({ dlenewssortby: sort.key, dledirection: sort.direction, set_new_sort: '', set_direction_sort: '' }),
            auth: true
        };
    }

    function searchOptions(state, page) {
        var sort = SORT[state.sort] || SORT[0];
        return {
            body: form({
                do: 'search', subaction: 'search', full_search: 1, search_start: page,
                result_from: (page - 1) * SEARCH_PAGE_SIZE + 1, titleonly: 3, showposts: 0,
                sortby: sort.key, resorder: sort.direction, 'catlist[]': ANIME_CATEGORY_ID
            }) + '&story=' + searchEncode(state.query),
            auth: true
        };
    }

    function rememberGenres(rows, target) {
        target = target || genreIndex;
        rows.forEach(function (row) {
            row.genres.forEach(function (genre) { target.set(genre.url, genre); });
        });
    }

    function readCatalogPage(cursor, state) {
        var personal = Boolean(state.anistarList);
        var url = state.query ? SEARCH_URL : cursor;
        var options = state.anistarHome ? { publicCatalog: true } :
            personal ? { auth: true } : state.query ? searchOptions(state, cursor) : sortOptions(state);
        return pageDocument(state.anistarHome ? desktopUrl(url) : url, options).then(function (doc) {
            if (personal && !readSession(doc)) throw new Error('Войдите в AniStar в настройках Anistar.');
            var page = catalogPage(doc, url, !personal && !state.query);
            if (state.anistarHome && url === CATALOG && !page.rows.length) {
                var title = nodeText(doc, 'title').slice(0, 90);
                throw new Error('Каталог AniStar пуст. Заголовок ответа: ' + escapeHtml(title || 'отсутствует') + '.');
            }
            if (state.query) {
                var next = doc.querySelector('#dle-content #nextlink[onclick]');
                var match = next && next.getAttribute('onclick').match(/list_submit\((\d+)\)/);
                page.next = match && Number(match[1]) > cursor ? Number(match[1]) : 0;
            }
            if (!personal) rememberGenres(page.rows);
            return page;
        });
    }

    function cacheGenres() {
        Lampa.Storage.set(GENRE_CACHE, { updated: genresUpdated, items: Array.from(genreIndex.values()) });
    }

    function refreshGenres() {
        if (genreRefresh) return genreRefresh;
        if (Date.now() - genresUpdated < GENRE_TTL) return Promise.resolve();
        var visited = new Set();
        var current = new Map();

        function scan(url) {
            if (!url || visited.has(url)) return Promise.resolve();
            visited.add(url);
            // Keep the site's original encoding in its /filter/janrs/ links.
            return pageDocument(desktopUrl(url), { publicCatalog: true }).then(function (doc) {
                var page = catalogPage(doc, url, true);
                rememberGenres(page.rows, current);
                rememberGenres(page.rows);
                return scan(page.next);
            });
        }

        genreRefresh = scan(CATALOG).then(function () {
            genreIndex = current;
            genresUpdated = Date.now();
        }).finally(function () {
            genreRefresh = null;
            cacheGenres();
        });
        return genreRefresh;
    }

    function canWatch() {
        var permit = Lampa.Account && Lampa.Account.Permit;
        return Boolean(permit && Lampa.Utils.canWatchChildren('18+', permit.profile && permit.profile.age));
    }

    function filtered(row, state) {
        if (row.card.adult && !canWatch()) return false;
        if (state.year && row.card.release_date.slice(0, 4) !== String(state.year)) return false;
        if (state.genre && !row.genres.some(function (genre) { return genre.url === state.genre; })) return false;
        return true;
    }

    function fillList(state, list, count, component) {
        if (!list.next || list.cards.length >= count || (component && component.destroyed)) return Promise.resolve();
        var url = list.next;
        return readCatalogPage(url, state).then(function (page) {
            list.visited.add(url);
            list.next = list.visited.has(page.next) ? '' : page.next;
            page.rows.forEach(function (row) {
                if (!list.ids.has(row.card.id) && filtered(row, state)) {
                    list.ids.add(row.card.id);
                    list.cards.push(row.card);
                }
            });
            return fillList(state, list, count, component);
        });
    }

    function loadList(state, success, failure) {
        var list = lists.get(state);
        if (!list) {
            list = { next: catalogStart(state), cards: [], ids: new Set(), visited: new Set(), work: Promise.resolve() };
            lists.set(state, list);
        }
        var page = Number(state.page) || 1;
        var component = state.activity && state.activity.component;
        var offset = 0;
        list.work = list.work.catch(function () {}).then(function () {
            if (state.anistarHome && list.firstPageSize === undefined) {
                return fillList(state, list, 1, component).then(function () {
                    list.firstPageSize = Math.min(PAGE_SIZE, list.cards.length);
                });
            }
        }).then(function () {
            if (state.anistarHome && page === 1) return;
            offset = state.anistarHome ? list.firstPageSize + (page - 2) * PAGE_SIZE : (page - 1) * PAGE_SIZE;
            return fillList(state, list, offset + PAGE_SIZE, component);
        }).then(function () {
            if (component && component.destroyed) return;
            var size = state.anistarHome && page === 1 ? list.firstPageSize : PAGE_SIZE;
            var results = list.cards.slice(offset, offset + size);
            if (state.anistarHome && page === 1) results = statusTiles().concat(results);
            var total = Math.ceil(list.cards.length / PAGE_SIZE);
            if (state.anistarHome) total = 1 + Math.ceil((list.cards.length - list.firstPageSize) / PAGE_SIZE);
            if (list.next) total = Math.max(page + 1, total);
            success({ page: page, results: results, total_pages: Math.max(total, 1) });
        }).catch(function (error) {
            if (component && component.destroyed) return;
            if (page > 1 && Number(state.page) === page) state.page = page - 1;
            Lampa.Noty.show(error.message);
            if (state.anistarHome && page === 1 && !list.cards.length) {
                var retry = { id: SOURCE + ':retry', title: 'Повторить загрузку', anistarRetry: true };
                success({ page: 1, total_pages: 1, results: statusTiles().concat(retry) });
            } else {
                failure(error);
            }
        });
    }

    function pushList(title, options) {
        Lampa.Activity.push(Object.assign({
            title: title, component: 'anistar_catalog', source: SOURCE, page: 1, url: ''
        }, options));
    }

    function statusTiles() {
        return STATUS.map(function (entry) {
            return { id: SOURCE + ':list:' + (entry.id || 'favorites'), title: entry.title, anistarTile: entry };
        });
    }

    function openPersonal(entry) {
        // The page validates the session. A browser may already have a valid session.
        pushList(entry.title, { anistarList: entry });
    }

    function catalogComponent(object) {
        var Native = Lampa.Component.get('category_full');
        var component = new Native(object);
        component.use({
            onlyNext: function (resolve, reject) {
                var owner = this;
                loadList(object, function (data) {
                    owner.total_pages = data.total_pages;
                    resolve(data);
                }, reject);
            },
            onlyCreateAndAppend: function (data) {
                var entry = data.anistarTile;
                var item;
                if (entry || data.anistarRetry) {
                    item = Lampa.Maker.make('Register', { title: data.title, count: '—' }, function (modules) {
                        return modules.only('Line', 'Callback');
                    });
                    item.use({
                        onlyEnter: function () {
                            if (entry) openPersonal(entry);
                            else Lampa.Activity.replace({ title: NAME, component: 'anistar_catalog',
                                source: SOURCE, page: 1, url: '', anistarHome: true });
                        },
                        onCreate: function () {
                            $(this.render(true)).addClass('anistar-status-tile').find('.register__counter').hide();
                        }
                    });
                } else {
                    item = Lampa.Maker.make('Card', data, function (modules) {
                        return modules.only('Card', 'Style', 'Callback');
                    });
                    item.use({
                        onCreate: function () {
                            var year = data.release_date.slice(0, 4);
                            if (year) {
                                $(this.render(true)).find('.card__title')
                                    .after($('<div class="anistar-year"></div>').text(year));
                            }
                        }
                    });
                    this.emit('instance', item, data);
                }
                item.create();
                this.emit('append', item, data);
            }
        });
        return component;
    }

    function editText(options, callback) {
        var cancelled = false;
        var input = Lampa.Input.edit(Object.assign({ nosave: true }, options), function (value) {
            Promise.resolve().then(function () {
                callback(cancelled ? null : String(value || ''));
            });
        });
        input.listener.follow('back', function () { cancelled = true; });
    }

    function optionMenu(title, options, selected, choose, back) {
        Lampa.Select.show({
            title: title,
            items: options.map(function (entry) {
                return Object.assign({}, entry, { selected: entry.value === selected });
            }),
            onSelect: function (entry) {
                if (entry.noenter) return;
                choose(entry.value);
                back();
            },
            onBack: back
        });
    }

    function showFilter(activity) {
        var base = activity.anistarFilters || filters;
        var draft = Object.assign({}, base);

        function render() {
            if (Lampa.Activity.active() !== activity) return;
            var genre = genreIndex.get(draft.genre);
            Lampa.Select.show({
                title: 'Фильтр',
                items: [
                    { title: 'Поиск', subtitle: escapeHtml(draft.query), action: search },
                    { title: 'Сортировка', subtitle: SORT[draft.sort].title, action: sort },
                    { title: 'Жанры', subtitle: genre ? escapeHtml(genre.title) : 'Все', action: genres },
                    { title: 'Год', subtitle: draft.year || 'Любой', action: years },
                    { title: 'Показать', action: apply },
                    { title: 'Сбросить', action: reset }
                ],
                onSelect: function (entry) { entry.action(); },
                onBack: function () { Lampa.Controller.toggle('head'); }
            });
        }

        function choose(label, key, options) {
            optionMenu(label, options, draft[key], function (value) { draft[key] = value; }, render);
        }

        function search() {
            editText({ title: 'Поиск', value: draft.query, keyboard: 'lampa', layout: 'clarify', align: 'center' },
                function (value) {
                    if (value !== null) draft.query = value.trim();
                    render();
                });
        }

        function sort() {
            choose('Сортировка', 'sort', SORT.map(function (entry, index) {
                return { title: entry.title, value: index };
            }));
        }

        function genres() {
            var loading = refreshGenres();
            var firstRow;
            function showGenres() {
                var items = Array.from(genreIndex.values()).sort(function (left, right) {
                    return left.title.localeCompare(right.title, 'ru', { sensitivity: 'base' });
                }).map(function (entry) {
                    return { title: escapeHtml(entry.title), value: entry.url };
                });
                items.unshift({ title: 'Все', value: '' });
                if (genreRefresh) items.push({ title: 'Жанры загружаются…', noenter: true });
                Lampa.Select.show({
                    title: 'Жанры',
                    items: items.map(function (item) {
                        return Object.assign({}, item, { selected: item.value === draft.genre });
                    }),
                    onDraw: function (element, item) {
                        if (item.value === '') firstRow = $(element)[0];
                    },
                    onSelect: function (item) {
                        draft.genre = item.value;
                        render();
                    },
                    onBack: render
                });
            }
            showGenres();
            if (!genreRefresh) return;
            loading.then(function () {
                if (Lampa.Activity.active() === activity && firstRow && firstRow.isConnected &&
                    typeof Lampa.Select.closeAll === 'function' && Lampa.Select.opened()) {
                    Lampa.Select.closeAll();
                    showGenres();
                }
            }).catch(function (error) {
                if (Lampa.Activity.active() === activity) Lampa.Noty.show(error.message);
            });
        }

        function years() {
            var options = [{ title: 'Любой', value: '' }];
            for (var year = new Date().getFullYear() + 1; year >= 1900; year--) {
                options.push({ title: String(year), value: String(year) });
            }
            choose('Год', 'year', options);
        }

        function apply() {
            filters = Object.assign({}, draft);
            pushList(draft.query ? 'Поиск Anistar' : 'Фильтр Anistar', Object.assign({
                anistarFilters: filters
            }, filters));
        }

        function reset() {
            draft = { sort: 0, year: '', genre: '', query: '' };
            render();
        }

        render();
    }

    function installFilter() {
        var button = Lampa.Head.addIcon('<svg><use xlink:href="#sprite-filter"></use></svg>', function () {
            var activity = Lampa.Activity.active();
            if (activity && activity.source === SOURCE && !activity.anistarList) showFilter(activity);
        }).attr({ title: 'Фильтр', 'aria-label': 'Фильтр' });

        function sync(activity) {
            var visible = Boolean(activity && activity.source === SOURCE && !activity.anistarList &&
                activity.component === 'anistar_catalog');
            button.toggleClass('hide', !visible).toggleClass('selector', visible);
            var search = Lampa.Head.render().find('.open--search').first();
            if (search.length && button.next()[0] !== search[0]) button.insertBefore(search);
        }
        sync(Lampa.Activity.active());
        Lampa.Listener.follow('activity', function (event) {
            if (event.type === 'start') sync(event.object);
            if (event.type === 'destroy') setTimeout(function () { sync(Lampa.Activity.active()); }, 0);
        });
    }

    function readSession(doc) {
        var logout = doc.querySelector('a[href*="action=logout"]');
        var menu = logout && logout.closest('ul');
        var profile = menu && menu.querySelector('a[href*="/user/"]');
        var profileUrl = profile && siteUrl(profile.getAttribute('href'));
        var logoutUrl = logout && siteUrl(logout.getAttribute('href'));
        var match = profileUrl && new URL(profileUrl).pathname.match(/^\/user\/([^/]+)\/$/);
        return match && logoutUrl ? { name: decodeURIComponent(match[1]), logout: logoutUrl } : null;
    }

    function articleSettings(doc, movie) {
        var active = nodeText(doc, '.anime_status .status_val');
        var status = Array.from(doc.querySelectorAll('.anime_status .selected_form [data-value]')).find(function (item) {
            return active && clean(item.textContent) === active;
        });
        var favorite = doc.getElementById('fav-id-' + newsId(movie.url));
        var favoriteUrl = favorite && siteUrl(favorite.getAttribute('href'));
        var action = favoriteUrl && new URL(favoriteUrl).searchParams.get('doaction');
        return { status: status ? Number(status.getAttribute('data-value')) : 0, favorite: action === 'del',
            favoriteUrl: action === 'add' || action === 'del' ? favoriteUrl : '' };
    }

    function chooseStatus(movie) {
        var activity = Lampa.Activity.active();
        var controller = Lampa.Controller.enabled().name;

        function restore() {
            if (Lampa.Activity.active() === activity) Lampa.Controller.toggle(controller);
        }

        pageDocument(movie.url, { auth: true }).then(function (doc) {
            if (Lampa.Activity.active() !== activity) return;
            if (!readSession(doc)) {
                Lampa.Select.show({
                    title: 'Статусы',
                    items: [{ title: 'Войдите в AniStar в настройках Anistar.', noenter: true }],
                    onBack: restore
                });
                return;
            }
            var current = articleSettings(doc, movie);
            var pending = false;
            var items = STATUS.map(function (entry) {
                return { title: entry.title, entry: entry, checkbox: true,
                    checked: entry.id ? current.status === entry.id : current.favorite };
            });
            var elements = new Map();
            Lampa.Select.show({
                title: 'Статусы',
                items: items,
                onDraw: function (element, item) { elements.set(item.entry.path, $(element)); },
                onBack: restore,
                onCheck: function (item, element) {
                    var entry = item.entry;
                    var checked = entry.id ? current.status === entry.id : current.favorite;
                    var desired = item.checked;
                    item.checked = checked;
                    $(element).toggleClass('selectbox-item--checked', checked);
                    if (pending || desired === checked) return;

                    var update = entry.id
                        ? request(SITE + '/engine/ajax/statuspost.php', {
                            body: form({ id: newsId(movie.url), status: desired ? entry.id : 0 }),
                            headers: { 'X-Requested-With': 'XMLHttpRequest' }, auth: true
                        })
                        : current.favoriteUrl && request(current.favoriteUrl, { auth: true });
                    if (!update) {
                        Lampa.Noty.show('AniStar не предоставил ссылку для добавления.');
                        return;
                    }
                    pending = true;
                    update.then(function () {
                        return pageDocument(movie.url, { auth: true });
                    }).then(function (updated) {
                        if (!readSession(updated)) throw new Error('Войдите в AniStar в настройках Anistar.');
                        current = articleSettings(updated, movie);
                        items.forEach(function (row) {
                            row.checked = row.entry.id ? row.entry.id === current.status : current.favorite;
                            var element = elements.get(row.entry.path);
                            if (element) element.toggleClass('selectbox-item--checked', row.checked);
                        });
                        var actual = entry.id ? current.status === entry.id : current.favorite;
                        if (actual !== desired) {
                            throw new Error('AniStar не подтвердил изменение статуса.');
                        }
                    }).catch(function (error) {
                        Lampa.Noty.show(error.message);
                    }).finally(function () {
                        pending = false;
                    });
                }
            });
        }).catch(function (error) { Lampa.Noty.show(error.message); });
    }

    function installSettings() {
        var rows = {};
        var username = '';
        var password = '';
        var busy = false;

        function render() {
            var values = { login: username, password: password ? '••••••••' : '', profile: session ? session.name : '' };
            Object.keys(rows).forEach(function (key) {
                var personal = key === 'profile' || key === 'signout';
                rows[key].toggleClass('hide', personal !== Boolean(session));
                rows[key].find('.settings-param__value').text(values[key] || '');
            });
        }

        function focus(key) {
            var row = rows[key] && rows[key][0];
            if (!row || !row.isConnected || Lampa.Controller.enabled().name !== 'settings_component') return;
            Lampa.Controller.collectionSet(row.parentElement, false, true);
            Lampa.Controller.collectionFocus(row, row.parentElement, true);
        }

        function signIn() {
            if (busy) return;
            if (!username || !password) {
                Lampa.Noty.show('Введите логин и пароль AniStar.');
                return;
            }
            busy = true;
            pageDocument(CATALOG, { auth: true }).then(function (doc) {
                var known = readSession(doc);
                if (known) return known;
                var login = doc.querySelector('input[name="login_name"]');
                var loginForm = login && login.closest('form');
                if (!loginForm || !loginForm.querySelector('[name="login_password"]')) {
                    throw new Error('AniStar не вернул форму входа.');
                }
                var fields = Object.create(null);
                loginForm.querySelectorAll('input[type="hidden"][name]').forEach(function (input) {
                    fields[input.name] = input.value;
                });
                fields.login_name = username;
                fields.login_password = password;
                password = '';
                var target = siteUrl(loginForm.getAttribute('action') || CATALOG);
                if (!target || !/^post$/i.test(loginForm.method)) throw new Error('Форма входа AniStar изменилась.');
                return pageDocument(target, { body: form(fields), auth: true, secret: true }).then(function (signed) {
                    return pageDocument(CATALOG, { auth: true }).then(function (check) {
                        if (readSession(check)) return readSession(check);
                        if (readSession(signed)) throw new Error('Lampa не сохранила сессию AniStar.');
                        throw new Error('AniStar не подтвердил вход.');
                    });
                });
            }).then(function (signedIn) {
                session = signedIn;
                username = '';
                render();
                focus('signout');
                Lampa.Noty.show('Вы вошли в AniStar.');
            }).catch(function (error) {
                Lampa.Noty.show(error.message);
            }).finally(function () {
                busy = false;
                password = '';
                render();
            });
        }

        function signOut() {
            if (busy || !session) return;
            busy = true;
            pageDocument(session.logout, { auth: true }).then(function (doc) {
                if (readSession(doc)) throw new Error('AniStar не завершил сеанс.');
                nativeCookies.clear();
                session = null;
                render();
                focus('login');
            }).catch(function (error) {
                Lampa.Noty.show(error.message);
            }).finally(function () { busy = false; });
        }

        function row(key, label, action) {
            Lampa.SettingsApi.addParam({
                component: SOURCE,
                param: { name: SOURCE + '_account_' + key, type: action ? 'button' : 'static' },
                field: { name: label },
                onChange: action,
                onRender: function (item) {
                    rows[key] = item;
                    if (!action) item.removeClass('selector');
                    if (!item.find('.settings-param__value').length) {
                        item.append('<div class="settings-param__value"></div>');
                    }
                    render();
                }
            });
        }

        Lampa.SettingsApi.addComponent({ component: SOURCE, name: NAME, icon: ICON });
        Lampa.SettingsApi.addParam({
            component: SOURCE,
            param: { name: SOURCE + '_account', type: 'title' },
            field: { name: 'Аккаунт' }
        });
        row('login', 'Логин', function () {
            if (busy) return;
            editText({ title: 'Логин', value: username, nomic: true }, function (value) {
                if (value !== null) username = value.trim();
                render();
            });
        });
        row('password', 'Пароль', function () {
            if (busy) return;
            editText({ title: 'Пароль', value: password, nomic: true }, function (value) {
                if (value !== null) password = value;
                render();
            });
        });
        row('signin', 'Выполнить вход', signIn);
        row('profile', 'Профиль');
        row('signout', 'Выйти из аккаунта', signOut);
        Lampa.SettingsApi.addParam({
            component: SOURCE,
            param: { name: SOURCE + '_about', type: 'static' },
            field: { name: 'О плагине', description: 'Версия ' + VERSION }
        });
    }

    function labeledValue(scope, label) {
        var rows = scope.querySelectorAll('.head li');
        for (var row of rows) {
            var heading = row.querySelector('b, strong');
            var name = heading && clean(heading.textContent);
            if (name && label.test(name)) return clean(row.textContent).slice(name.length).trim();
        }
        return '';
    }

    function readComments(doc) {
        return Array.from(doc.querySelectorAll('#dle-comments-list .comment')).map(function (comment) {
            return {
                author: nodeText(comment, '.autor_nav a[href*="/user/"]'),
                date: nodeText(comment, '.scomment'),
                text: nodeText(comment, '[id^="comm-id-"], .coment_text')
            };
        }).filter(function (comment) {
            return comment.text;
        });
    }

    function playerUrl(scope, article) {
        var frame = scope.querySelector('iframe[src*="videoas_p2p_new.php"], iframe[data-src*="videoas_p2p_new.php"]');
        var player = frame && urlOf(frame.getAttribute('data-src') || frame.getAttribute('src'), article);
        return player && player.origin === SITE ? player.href : '';
    }

    function readArticle(doc, card) {
        var content = doc.querySelector('#dle-content');
        var heading = content && content.querySelector('.news h1, .fullstory h1, article h1, h1');
        var root = heading ? heading.closest('.news, .fullstory, article') || content :
            content && content.querySelector('.news, .fullstory');
        var movie = root && basicCard(root, card.url, card);
        if (!movie) throw new Error('AniStar не вернул карточку тайтла.');
        var head = root.querySelector('.head') || root;
        var description = root.querySelector('.descripts[itemprop="description"], .news_text .descripts, .full-text');
        movie.title = escapeHtml(movie.title);
        movie.tagline = escapeHtml(movie.tagline);
        movie.original_title = movie.tagline;
        movie.overview = description ? escapeHtml(clean(description.textContent)) : '';
        movie.img = movie.poster;
        movie.genres = [];
        movie.production_companies = [];
        movie.production_countries = [];
        movie.vote_average = 0;
        movie.anistar = {
            genres: readLinks(head, '/filter/janrs/'),
            directors: readLinks(head, '/filter/director/'),
            authors: readLinks(head, '/filter/author/'),
            translation: labeledValue(root, /^Озвучка:/i),
            series: labeledValue(root, /^Серии:/i),
            released: nodeText(root, '.reason'),
            player: playerUrl(root, movie.url),
            comments: readComments(doc)
        };
        return movie;
    }

    function loadFull(object, success, failure) {
        var card = object.card || { url: object.url };
        if (!newsId(card.url)) {
            failure();
            return;
        }
        var component = object.activity && object.activity.component;
        pageDocument(card.url, { auth: true }).then(function (doc) {
            if (component && component.destroyed) return;
            var movie = readArticle(doc, card);
            if (movie.adult && !canWatch()) {
                failure();
                return;
            }
            success({ movie: movie });
        }).catch(function (error) {
            if (component && component.destroyed) return;
            Lampa.Noty.show(error.message);
            failure(error);
        });
    }

    function openWatch(movie, episode) {
        Lampa.Activity.push({
            component: VIEW, source: SOURCE, url: '', title: 'Смотреть · ' + decodeHtml(movie.title),
            movie: movie, episode: episode || 0, page: 1
        });
    }

    function fullAction(name, icon, callback, owner) {
        var button = $('<div class="full-start__button selector button--render anistar-action"></div>');
        button.append($(icon), $('<span></span>').text(name).css('display', 'block'));
        button.on('hover:enter', callback);
        button.on('hover:focus', function () { owner.last = this; });
        return button;
    }

    function detailLinks(view, title, entries) {
        if (!entries.length) return;
        view.body.find('.full-descr__tags').append(view.tag(title, entries.map(function (entry) {
            return { id: entry.url, name: escapeHtml(entry.title) };
        }), function (entry) {
            pushList(decodeHtml(entry.name), { anistarRoute: entry.id });
        }));
    }

    function detailAction(view, title, subtitle, callback) {
        var item = $('<div class="tag-count selector"><div class="tag-count__name"></div><div class="tag-count__count"></div></div>');
        item.find('.tag-count__name').text(title);
        item.find('.tag-count__count').text(subtitle);
        item.on('hover:enter', callback);
        item.on('hover:focus', function () { view.last = this; });
        view.body.find('.full-descr__tags').append(item);
    }

    function onFull(event) {
        if (event.type !== 'build') return;
        var movie = event.data && event.data.movie || event.props && event.props.get('movie');
        if (!movie || movie.source !== SOURCE || !movie.anistar) return;
        var details = movie.anistar;
        var owner = event.item;
        if (event.name === 'description') {
            detailLinks(owner, 'Жанр', details.genres);
            detailLinks(owner, 'Производство', details.directors);
            detailLinks(owner, 'Автор', details.authors);
            if (details.series || details.player) {
                detailAction(owner, 'Серии', details.series, function () { openWatch(movie); });
            }
            if (details.comments.length) {
                detailAction(owner, 'Комментарии', details.comments.length, function () {
                    Lampa.Activity.push({ component: COMMENTS, source: SOURCE, title: 'Комментарии',
                        page: 1, movie: movie, url: '' });
                });
            }
            return;
        }
        if (event.name !== 'start') return;

        var card = owner.html;
        var main = card.find('.full-start-new__details, .full-start__details').first();
        var year = movie.release_date.slice(0, 4);
        if (main.length) {
            main.empty().append($('<span></span>').text([year, details.translation].filter(Boolean).join(' • ')));
        }
        card.find('.full-start-new__reactions, .full-start-new__rate-line').hide();
        if (details.released) {
            var released = $('<div class="anistar-released"></div>').text(details.released);
            if (main.length) main.after(released);
            else card.find('.full-start-new__title, .full-start__title').first().after(released);
        }
        var buttons = card.find('.buttons--container').first();
        if (!buttons.length) buttons = card.find('.full-start-new__buttons, .full-start__buttons').first();
        if (!buttons.length) return;

        var originalPlay = buttons.find('.button--play').first();
        var playIcon = originalPlay.find('svg')[0];
        var watch = fullAction('Смотреть', playIcon ? playIcon.outerHTML :
            '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m8 4 12 8-12 8z"/></svg>', function () {
            openWatch(movie);
        }, owner);
        var favorite = fullAction('Избранное', ICON, function () { chooseStatus(movie); }, owner);
        var initial = true;

        function buttonsOnly() {
            buttons.children().not('.anistar-action').remove();
            if (!watch.parent().length) buttons.append(watch, favorite);
            if (initial) {
                initial = false;
                owner.last = watch[0];
            }
        }

        buttonsOnly();
        var observer = new MutationObserver(buttonsOnly);
        observer.observe(buttons[0], { childList: true });
        owner.use({
            onlyGroupButtons: buttonsOnly,
            onDestroy: function () { observer.disconnect(); }
        });
    }

    function parsePlaylist(html, base) {
        var doc = parser.parseFromString(html, 'text/html');
        var script = Array.from(doc.querySelectorAll('script')).find(function (item) {
            return /\bplaylst\s*=\s*\[/.test(item.textContent);
        });
        if (!script) return [];
        var text = script.textContent;
        var translation = nodeText(doc, '#ListDub > span');
        var dubNames = new Map();
        doc.querySelectorAll('#ListDub li[id]').forEach(function (entry) {
            var id = entry.id.match(/\d+/);
            if (id) dubNames.set(id[0], clean(entry.textContent));
        });
        var matches = Array.from(text.matchAll(/\btitle\s*:\s*"([^"]*)"\s*,\s*media_id\s*:/g));
        return matches.map(function (match, index) {
            var block = text.slice(match.index, matches[index + 1] && matches[index + 1].index);
            var title = decodeHtml(match[1]);
            var number = Number((title.match(/\d+/) || [])[0]) || index + 1;
            var quality = new Map();
            Array.from(block.matchAll(/\b(files|files_as|files_mp4)\s*:\s*\[([^\]]*)\]/g)).forEach(function (section) {
                Array.from(section[2].matchAll(/\btitle\s*:\s*"(\d+)"\s*,\s*file\s*:\s*"([^"]+)"/g)).forEach(function (file) {
                    var url = urlOf(decodeHtml(file[2]).replace(/\\\//g, '/'), base);
                    var size = Number(file[1]);
                    if (!url || !size) return;
                    var hls = /\.m3u8$/i.test(url.pathname);
                    var mp4 = /\.mp4$/i.test(url.pathname);
                    if (!hls && !mp4) return;
                    var previous = quality.get(size);
                    if (!previous || (!previous.hls && hls)) quality.set(size, { url: url.href, hls: hls, size: size });
                });
            });
            var files = Array.from(quality.values()).sort(function (left, right) { return right.size - left.size; });
            var dub = (block.match(/\btype_dub\s*:\s*['"](\d+)['"]/) || [])[1] || '';
            return { number: number, title: title, files: files, dub: dub,
                translation: dubNames.get(dub) || translation };
        }).filter(function (entry) { return entry.files.length; }).sort(function (left, right) {
            return left.number - right.number;
        });
    }

    function playerItems(movie) {
        var player = movie.anistar.player;
        if (!player) return Promise.reject(new Error('В карточке AniStar нет плеера.'));
        return request(player, { auth: true, headers: { Referer: movie.url } }).then(function (html) {
            var episodes = parsePlaylist(html, player);
            if (!episodes.length) throw new Error('AniStar не вернул доступные серии.');
            return episodes;
        });
    }

    function timeline(movie, episode) {
        if (!Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return undefined;
        var id = [movie.id, episode.dub, episode.number].join('/');
        return Lampa.Timeline.view(Lampa.Utils.hash(id));
    }

    function play(movie, episode, episodes) {
        var preferred = String(Lampa.Storage.get('video_quality_default', '1080')).replace(/p$/i, '') + 'p';
        var activity = Lampa.Activity.active();
        function media(entry) {
            var qualities = {};
            entry.files.forEach(function (file) { qualities[file.size + 'p'] = file.url; });
            return {
                title: decodeHtml(movie.title) + ' / ' + entry.title,
                url: qualities[preferred] || entry.files[0].url,
                quality: qualities, headers: { Referer: movie.anistar.player },
                movie: movie, season: 1, episode: entry.number, timeline: timeline(movie, entry)
            };
        }
        var item = media(episode);
        playerOrigin = { data: item, activity: activity };
        Lampa.Player.play(item);
        if (typeof Lampa.Player.playlist === 'function') Lampa.Player.playlist(episodes.map(media));
    }

    function rowComponent(object, mapping) {
        object.params = Object.assign({}, object.params, { items: { mapping: mapping } });
        return Lampa.Maker.make('Category', object, function (modules) {
            return modules.only('Explorer', 'Empty', 'Items');
        });
    }

    function appendRow(owner, html) {
        var row = { render: function (raw) { return raw ? html[0] : html; }, destroy: function () { html.remove(); } };
        owner.emit('append', row, { params: {} });
    }

    function watchComponent(object) {
        var component = rowComponent(object, 'list');
        var currentDub = '';
        var groups = new Map();

        function render() {
            var items = groups.get(currentDub) || [];
            var header = groups.size > 1 ? [{ header: true }, { choice: true }] : [{ header: true }];
            component.build({ results: header.concat(items) });
        }

        function translations() {
            var entries = Array.from(groups.entries(), function (group) {
                return { title: group[1][0].translation || 'Озвучка ' + group[0], value: group[0] };
            });
            var back = function () { Lampa.Controller.toggle('content'); };
            Lampa.Select.show({
                title: 'Озвучка',
                items: entries.map(function (entry) {
                    return Object.assign({}, entry, { selected: entry.value === currentDub });
                }),
                onBack: back,
                onSelect: function (entry) {
                    if (entry.value === currentDub) back();
                    else Lampa.Activity.replace({
                        component: VIEW, source: SOURCE, title: object.title, url: '', page: 1,
                        movie: object.movie, anistarDub: entry.value, anistarEpisodes: object.anistarEpisodes
                    });
                }
            });
        }

        component.use({
            onCreate: function () {
                var owner = this;
                if (object.movie.adult && !canWatch()) {
                    owner.empty();
                    return;
                }
                var loading = object.anistarEpisodes ? Promise.resolve(object.anistarEpisodes) : playerItems(object.movie);
                loading.then(function (result) {
                    if (owner.destroyed) return;
                    object.anistarEpisodes = result;
                    result.forEach(function (entry) {
                        if (!groups.has(entry.dub)) groups.set(entry.dub, []);
                        groups.get(entry.dub).push(entry);
                    });
                    currentDub = groups.has(object.anistarDub) ? object.anistarDub : groups.keys().next().value;
                    render();
                }).catch(function (error) {
                    if (owner.destroyed) return;
                    Lampa.Noty.show(error.message);
                    owner.empty();
                });
            },
            onlyCreateAndAppend: function (entry) {
                var movie = object.movie;
                var items = groups.get(currentDub);
                if (entry.header) {
                    var header = $('<div class="anistar-watch-header selector"></div>');
                    if (movie.poster) header.append($('<img alt="">').attr('src', movie.poster));
                    var info = $('<div class="anistar-watch-info"></div>').appendTo(header);
                    info.append($('<strong></strong>').text(decodeHtml(movie.title)));
                    var recent;
                    items.forEach(function (episode) {
                        var progress = timeline(movie, episode);
                        if (progress && progress.time > 0 && (!recent || progress.updated > recent.progress.updated)) {
                            recent = { progress: progress, episode: episode };
                        }
                    });
                    var target = recent ? recent.episode : items[0];
                    var start = $('<div class="anistar-watch-button"></div>').text(
                        (recent && recent.progress.percent < 95 ? 'Продолжить · ' : 'Смотреть · ') + target.title
                    );
                    header.on('hover:enter', function () { play(movie, target, items); });
                    info.append(start);
                    if (groups.size === 1) {
                        info.append($('<div class="anistar-watch-button"></div>').text(
                            items[0].translation || movie.anistar.translation || 'Озвучка'
                        ));
                    }
                    appendRow(this, header);
                    return;
                }
                if (entry.choice) {
                    var label = items[0].translation || movie.anistar.translation || 'Озвучка';
                    var choice = $('<div class="anistar-episode selector"></div>').text(label);
                    choice.on('hover:enter', translations);
                    appendRow(this, choice);
                    return;
                }
                var row = $('<div class="anistar-episode selector"><div></div><small></small></div>');
                row.find('div').text(entry.title);
                row.find('small').text(entry.files[0].size + 'p');
                row.on('hover:enter', function () { play(movie, entry, items); });
                appendRow(this, row);
                if (Number(object.episode) === entry.number) this.last = row[0];
            }
        });
        return component;
    }

    function commentsComponent(object) {
        var component = rowComponent(object, 'list');
        component.use({
            onCreate: function () {
                this.build({ results: object.movie.anistar.comments });
            },
            onlyCreateAndAppend: function (entry) {
                var row = $('<div class="anistar-comment selector"><strong></strong><small></small><p></p></div>');
                row.find('strong').text(entry.author);
                row.find('small').text(entry.date);
                row.find('p').text(entry.text);
                appendRow(this, row);
            }
        });
        return component;
    }

    function installStyle() {
        $('<style></style>').text([
            '.anistar-status-tile{display:flex;align-items:center;min-width:0;min-height:5em;box-sizing:border-box}',
            '.anistar-year{opacity:.7;margin-top:.2em}',
            '.anistar-action{gap:.6em}',
            '.anistar-action svg{width:1.4em;height:1.4em}',
            '.anistar-released{font-weight:700;margin:.7em 0}',
            '.anistar-episode,.anistar-comment{border-radius:.35em;background:rgba(255,255,255,.08);padding:1em 1.2em;margin:.45em 0}',
            '.anistar-episode{display:flex;justify-content:space-between;gap:1em}',
            '.anistar-watch-header{display:flex;gap:1.4em;align-items:center;padding:.8em 0 1.4em}',
            '.anistar-watch-header img{width:6em;border-radius:.35em}',
            '.anistar-watch-info>strong{display:block;font-size:1.45em;margin-bottom:.55em}',
            '.anistar-watch-button{display:inline-block;padding:.55em .8em;background:rgba(255,255,255,.1);margin:.2em .4em .2em 0;border-radius:.35em}',
            '.anistar-comment small{display:block;opacity:.65;margin:.4em 0}',
            '.anistar-comment p{line-height:1.4}',
            '.anistar-episode.focus,.anistar-comment.focus,.anistar-watch-header.focus .anistar-watch-button{background:#fff;color:#222}'
        ].join('\n')).appendTo('head');
    }

    function init() {
        if (Lampa.Api.sources[SOURCE]) return;
        var cached = Lampa.Storage.get(GENRE_CACHE, {});
        if (cached && Array.isArray(cached.items)) {
            cached.items.forEach(function (entry) { if (siteUrl(entry.url)) genreIndex.set(entry.url, entry); });
            genresUpdated = Number(cached.updated) || 0;
        }
        Lampa.Api.sources[SOURCE] = { list: loadList, full: loadFull, clear: function () {} };
        Lampa.Component.add('anistar_catalog', catalogComponent);
        Lampa.Component.add(VIEW, watchComponent);
        Lampa.Component.add(COMMENTS, commentsComponent);
        Lampa.Menu.addButton(ICON, NAME, function () {
            pushList(NAME, { anistarHome: true });
        });
        Lampa.Listener.follow('full', onFull);
        Lampa.Player.listener.follow('close', function (event) {
            if (!playerOrigin || event.data !== playerOrigin.data) return;
            var activity = playerOrigin.activity;
            playerOrigin = null;
            if (Lampa.Activity.active() === activity) Lampa.Controller.toggle('content', true);
        });
        installStyle();
        installFilter();
        installSettings();
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (event) {
        if (event.type === 'ready') init();
    });
})();
