/*!
 * Anistar для Lampa
 * Версия 0.5.9
 */
(function () {
    'use strict';

    var SOURCE = 'anistar';
    var NAME = 'Anistar';
    var VERSION = '0.5.9';
    var SITE = 'https://anistar.org';
    var CATALOG = SITE + '/anime/';
    var CATALOG_PATH = /^\/anime(?:\/page\/(\d+))?\/?$/i;
    var LEGACY_CARD = '.shortstory, .base, .news, .item, .anime-item, .movie-item, article, li';
    var VIEW = 'anistar_watch';
    var COMMENTS = 'anistar_comments';
    var PAGE_SIZE = 20;
    var SEARCH_PAGE_SIZE = 10;
    var SEARCH_URL = SITE + '/?do=search&mode=advanced&subaction=search&titleonly=3&story=';
    var TIMEOUT = 18000;
    var ACCOUNT_KEY = 'anistar_account_v1';
    var GENRE_CACHE = 'anistar_anime_genres_v1';
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
    var defaultFilters = { sort: 0, year: '', genre: '', query: '' };
    var genreRefresh;
    var playerOrigin;
    var session;
    var nativeCookies = new Map();
    var bookmarkPages = new Map();
    var watchPlaylists = new WeakMap();

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

    function urlOf(value, base, allowHttp) {
        if (!value || !String(value).trim()) return null;
        try {
            var url = new URL(value, base || SITE);
            var supported = url.protocol === 'https:' || (allowHttp && url.protocol === 'http:');
            return supported && !url.username && !url.password ? url : null;
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

    function setSession(account) {
        session = account;
        bookmarkPages.clear();
        persistAccount();
    }

    function persistAccount() {
        Lampa.Storage.set(ACCOUNT_KEY, session ? {
            name: session.name, logout: session.logout, cookies: Array.from(nativeCookies.entries())
        } : null);
    }

    function restoreAccount() {
        var saved = Lampa.Storage.get(ACCOUNT_KEY, null);
        if (!saved || typeof saved.name !== 'string' || !siteUrl(saved.logout)) return;
        session = { name: saved.name, logout: siteUrl(saved.logout) };
        if (Array.isArray(saved.cookies)) saved.cookies.forEach(function (pair) {
            if (Array.isArray(pair) && pair.length === 2 && /^[\w-]+$/.test(pair[0]) &&
                typeof pair[1] === 'string' && !/[;\r\n]/.test(pair[1])) nativeCookies.set(pair[0], pair[1]);
        });
    }

    function saveCookies(headers) {
        var cookies = headers && (headers['set-cookie'] || headers['Set-Cookie']);
        if (!cookies) return;
        if (!Array.isArray(cookies)) cookies = [cookies];
        var changed = false;
        cookies.join('\n').split(/\r?\n|,(?=\s*[\w-]+=)/).forEach(function (cookie) {
            var pair = cookie.split(';', 1)[0];
            var delimiter = pair.indexOf('=');
            if (delimiter < 1) return;
            var key = pair.slice(0, delimiter).trim();
            var value = pair.slice(delimiter + 1);
            if (!value || /(?:^|;)\s*max-age=0(?:;|$)/i.test(cookie)) {
                changed = nativeCookies.delete(key) || changed;
            } else if (nativeCookies.get(key) !== value) {
                nativeCookies.set(key, value);
                changed = true;
            }
        });
        if (changed && session) persistAccount();
    }

    function request(url, options) {
        options = options || {};
        var plainGet = options.plainGet === true;
        var native = !plainGet && android();
        return new Promise(function (resolve, reject) {
            var network = new Lampa.Reguest();
            var body = options.body;
            var headers = Object.assign({}, options.headers);
            var method = body === undefined ? 'GET' : 'POST';
            var local = Boolean(siteUrl(url));
            var timeout = plainGet ? 20000 : TIMEOUT;
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

            if (native && local && options.auth && nativeCookies.size) {
                headers.Cookie = Array.from(nativeCookies, function (entry) { return entry.join('='); }).join('; ');
            }
            if (body !== undefined) headers['Content-Type'] = 'application/x-www-form-urlencoded';
            var settings = { dataType: 'text', timeout: timeout };
            if (plainGet) {
                // Keep the request shape used by 0.4.55 on Android TV and Tizen.
                body = false;
            } else {
                settings.type = method;
                settings.headers = headers;
                settings.returnHeaders = native && options.auth === true;
                settings.withCredentials = options.auth === true;
            }
            try {
                network[plainGet || native ? 'native' : 'silent'](url, function (response) {
                    if (returned) return;
                    var html = response;
                    if (native && typeof response === 'string' && /^\s*\{/.test(response)) {
                        try { response = JSON.parse(response); } catch (error) {}
                    }
                    if (native && response && typeof response.body === 'string') {
                        html = response.body;
                        if (local && options.auth && (!response.currentUrl || siteUrl(response.currentUrl))) saveCookies(response.headers);
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
        var titles = joinedTitle.split(/\s*\/\s*/).map(clean).filter(Boolean);
        var mainTitle = titles.find(function (title) { return /[А-Яа-яЁё]/.test(title); }) || titles[0];
        var alternate = titles.filter(function (title) { return title !== mainTitle; }).join(' / ');
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
            title: mainTitle,
            tagline: alternate || (fallback && fallback.tagline) || '',
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
            var card = basicCard(node, article, { title: title, poster: posterUrl(image, article) });
            if (!card) return;
            card.posterFallback = card.poster;
            card.poster = SITE + '/uploads/posters/' + id + '/original.jpg';
            rows.set(id, { card: card, genres: readLinks(node.querySelector('.head') || node, '/filter/janrs/') });
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

    function catalogPage(doc, url, personal) {
        var animeCatalog = CATALOG_PATH.test(sitePath(url));
        var root = doc.querySelector('#dle-content') || ((animeCatalog || personal) && doc);
        if (!root) throw new Error('AniStar не вернул каталог.');
        var rows = animeCatalog ? legacyCatalogRows(root, url) : [];
        var seen = new Set();
        if (!animeCatalog) Array.prototype.forEach.call(root.querySelectorAll('.news'), function (node) {
            var link = node.querySelector('.title_left > a[href], .title_left h2 a[href]');
            var card = link && basicCard(node, siteUrl(link.getAttribute('href'), url));
            if (!card || seen.has(card.id)) return;
            seen.add(card.id);
            rows.push({ card: card, genres: readLinks(node.querySelector('.head') || node, '/filter/janrs/'),
                categories: Array.from(node.querySelectorAll('.tags a[href], .category a[href]'), function (link) {
                    return siteUrl(link.getAttribute('href'));
                }) });
        });
        if (!rows.length) rows = legacyCatalogRows(root, url);
        var link = root.querySelector('.pagenav .r a[href], a[rel~="next"]');
        var next = link && siteUrl(link.getAttribute('href'), url);
        if (animeCatalog && animePageNumber(next) <= animePageNumber(url)) next = nextAnimePage(doc, url);
        return { rows: rows, next: next && next !== url ? next : '' };
    }

    function yearUrl(year) {
        return SITE + '/index.php?' + form({ do: 'xfsearch', xf: year, type: 'year', r: 'anime' });
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
        if (state.query) return 1;
        if (state.anistarRoute) return state.anistarRoute;
        return (state.year && yearUrl(state.year)) || state.genre || CATALOG;
    }

    function sortOptions(state) {
        var sort = SORT[state.sort] || SORT[0];
        return {
            body: form({ dlenewssortby: sort.key, dledirection: sort.direction, set_new_sort: '', set_direction_sort: '' })
        };
    }

    function searchUrl(state, page) {
        var url = SEARCH_URL + searchEncode(state.query) + '&skin_name=new36';
        if (page === 1) return url;
        return url + '&' + form({ search_start: page, result_from: (page - 1) * SEARCH_PAGE_SIZE + 1 });
    }

    function rememberGenres(rows) {
        rows.forEach(function (row) {
            row.genres.forEach(function (genre) { genreIndex.set(genre.url, genre); });
        });
    }

    function readBookmarkPage(url) {
        var account = session;
        var saved = account && bookmarkPages.get(url);
        if (saved) return saved;
        var pending = pageDocument(desktopUrl(url), { auth: true }).then(function (doc) {
            if (!readSession(doc)) {
                if (account && session === account && doc.querySelector('input[name="login_name"]')) {
                    nativeCookies.clear();
                    setSession(null);
                }
                throw new Error('Войдите в AniStar в настройках Anistar.');
            }
            return catalogPage(doc, url, true);
        });
        if (account) {
            bookmarkPages.set(url, pending);
            pending.catch(function () {
                if (bookmarkPages.get(url) === pending) bookmarkPages.delete(url);
            });
        }
        return pending;
    }

    function readCatalogPage(cursor, state) {
        if (state.anistarList) return readBookmarkPage(cursor);
        var url = state.query ? searchUrl(state, cursor) : desktopUrl(cursor);
        var options = !state.query && state.sortApplied ? sortOptions(state) : { plainGet: true };
        return pageDocument(url, options).then(function (doc) {
            var page = catalogPage(doc, url, Boolean(state.query));
            if (state.anistarHome && !state.query && cursor === CATALOG && !state.sortApplied && !page.rows.length) {
                var title = nodeText(doc, 'title').slice(0, 90);
                throw new Error('Каталог AniStar пуст. Заголовок ответа: ' + escapeHtml(title || 'отсутствует') + '.');
            }
            if (state.query) {
                var next = doc.querySelector('#nextlink[onclick], #nextlink [onclick], .pagenav .r [onclick]');
                var match = next && next.getAttribute('onclick').match(/list_submit\(\s*['"]?(\d+)/);
                var linked = page.next && Number(new URL(page.next).searchParams.get('search_start'));
                var nextPage = match ? Number(match[1]) : linked;
                page.next = nextPage > cursor ? nextPage : 0;
            } else if (state.sortApplied) {
                var activeSort = doc.querySelector('#news_set_sort .sort-actv[onclick]');
                var selected = activeSort && activeSort.getAttribute('onclick').match(/dle_change_sort\(\s*['"](\w+)['"]\s*,\s*['"](asc|desc)['"]/);
                var sort = SORT[state.sort] || SORT[0];
                if (selected && (selected[1] !== sort.key || selected[2] === sort.direction)) {
                    throw new Error('AniStar не применил выбранную сортировку.');
                }
            }
            rememberGenres(page.rows);
            return page;
        });
    }

    function readGenreDirectory(doc) {
        var links = readLinks(doc, '/filter/janrs/');
        Array.prototype.forEach.call(doc.querySelectorAll('.cat_anime.hid_ul'), function (section) {
            if (nodeText(section, '.tit_sp').toLowerCase() !== 'аниме по жанрам') return;
            Array.prototype.forEach.call(section.querySelectorAll('a[href]'), function (link) {
                var url = siteUrl(link.getAttribute('href'));
                var title = clean(link.textContent);
                if (url && title && !links.some(function (entry) { return entry.title.toLowerCase() === title.toLowerCase(); })) {
                    links.push({ url: url, title: title });
                }
            });
        });
        return links;
    }

    function refreshGenres() {
        if (!genreRefresh) {
            genreRefresh = pageDocument(desktopUrl(SITE + '/filter/janrs/'), { plainGet: true }).then(function (doc) {
                var genres = readGenreDirectory(doc);
                if (!genres.length) throw new Error('AniStar не вернул справочник жанров.');
                genres.forEach(function (genre) { genreIndex.set(genre.url, genre); });
                Lampa.Storage.set(GENRE_CACHE, { items: Array.from(genreIndex.values()) });
            }).catch(function () {
                // Results already loaded and the previous session are still available as a fallback.
            });
        }
        return genreRefresh;
    }

    function canWatch() {
        var permit = Lampa.Account && Lampa.Account.Permit;
        return Boolean(permit && (!permit.child ||
            Lampa.Utils.canWatchChildren('18+', permit.profile && permit.profile.age)));
    }

    function filtered(row, state) {
        if (state.year && (state.query || state.anistarRoute) && row.card.release_date.slice(0, 4) !== String(state.year)) return false;
        if (!state.genre || (!state.query && !state.year && !state.anistarRoute)) return true;
        var genre = genreIndex.get(state.genre);
        return row.genres.some(function (entry) {
            return entry.url === state.genre || (genre && entry.title.toLowerCase() === genre.title.toLowerCase());
        }) || (row.categories || []).indexOf(state.genre) !== -1;
    }

    function getList(state) {
        var list = lists.get(state);
        if (!list) {
            list = { next: catalogStart(state), cards: [], ids: new Set(), visited: new Set() };
            lists.set(state, list);
        }
        return list;
    }

    function fillList(state, list, remaining) {
        if (!list.next || !remaining || (state.activity && state.activity.component.destroyed)) return Promise.resolve();
        var cursor = list.next;
        var before = list.cards.length;
        return readCatalogPage(cursor, state).then(function (page) {
            list.visited.add(cursor);
            list.next = list.visited.has(page.next) ? '' : page.next;
            page.rows.forEach(function (row) {
                if (list.ids.has(row.card.id) || !filtered(row, state)) return;
                if (row.card.adult && !canWatch()) {
                    list.restricted = true;
                    return;
                }
                list.ids.add(row.card.id);
                list.cards.push(row.card);
            });
            if (before === list.cards.length) return fillList(state, list, remaining - 1);
        });
    }

    function emptyMessage(list) {
        if (list.restricted) return 'Тайтлы 18+ скрыты настройками профиля Lampa.';
        return list.next ? 'На первых страницах AniStar совпадений нет. Уточните фильтр.' : 'Тайтлы не найдены.';
    }

    function loadList(state, success, failure) {
        var list = getList(state);
        var page = Number(state.page) || 1;
        var start = (list.shown || 0);
        var work = page === 1 && list.cards.length ? Promise.resolve() : fillList(state, list, page === 1 ? 2 : 1);
        work.then(function () {
            if (state.activity && state.activity.component.destroyed) return;
            list.shown = list.cards.length;
            success({ page: page, results: list.cards.slice(start), total_pages: page + (list.next ? 1 : 0),
                message: emptyMessage(list) });
        }).catch(function (error) {
            if (state.activity && state.activity.component.destroyed) return;
            if (page > 1 && Number(state.page) === page) state.page = page - 1;
            failure(error);
        });
    }

    function listState(title, options) {
        return Object.assign({ title: title, component: 'anistar_catalog', source: SOURCE, page: 1, url: '' }, options);
    }

    function openList(title, options) {
        var origin = Lampa.Activity.active();
        if (!origin || !origin.activity || origin.anistarLoading) return;
        var state = listState(title, options);
        var list = getList(state);
        origin.anistarLoading = true;
        Lampa.Controller.toggle('content');
        origin.activity.loader(true);
        var combined = (state.query && (state.year || state.genre)) || (state.year && state.genre) ||
            (state.anistarRoute && (state.year || state.genre));
        fillList(state, list, combined ? 2 : 1).then(function () {
            if (Lampa.Activity.active() !== origin) return;
            if (!list.cards.length) Lampa.Noty.show(emptyMessage(list));
            else {
                origin.activity.loader(false);
                if (origin.anistarResults && state.anistarResults) Lampa.Activity.replace(state, true);
                else Lampa.Activity.push(state);
            }
        }).catch(function (error) {
            if (Lampa.Activity.active() === origin) Lampa.Noty.show(error.message);
        }).finally(function () {
            delete origin.anistarLoading;
            if (origin.activity && !origin.activity.component.destroyed) origin.activity.loader(false);
        });
    }

    function openPersonal(entry) {
        bookmarkPages.delete(SITE + entry.path);
        openList(entry.title, { anistarList: entry });
    }

    function catalogTemplate(name, required, fallback) {
        if (Lampa.Template && typeof Lampa.Template.get === 'function') {
            try {
                var nativeTemplate = Lampa.Template.get(name);
                if (nativeTemplate && nativeTemplate.length && nativeTemplate.find(required).length) return nativeTemplate;
            } catch (error) {
                // Older Lampa builds can omit an individual template.
            }
        }
        return $(fallback);
    }

    function catalogComponent(object) {
        var component = this;
        object.page = 1;
        var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250, end_ratio: 2 });
        var root = $('<div class="anistar-screen"></div>');
        var grid = $('<div class="mapping--grid cols--6"></div>').appendTo(root);
        var ids = new Set();
        var focused = null;
        var loading = false;
        var total = 1;
        var running = false;
        var destroyed = false;
        scroll.append(root);

        function refreshFocus() {
            if (!running || destroyed || Lampa.Controller.enabled().name !== 'content') return;
            Lampa.Controller.collectionSet(root, false, true);
            var target = focused && root[0].contains(focused) ? focused : root.find('.selector')[0];
            if (target) Lampa.Controller.collectionFocus(target, root, true);
        }

        function append(data) {
            if (ids.has(data.id)) return;
            ids.add(data.id);
            var item = catalogTemplate('card', '.card__img',
                '<div class="card selector"><div class="card__view"><img class="card__img"></div><div class="card__title"></div><div class="card__age"></div></div>');
            item.addClass('card--loaded selector');
            var image = item.find('.card__img').attr('alt', '').attr('loading', 'lazy');
            var fallback = data.posterFallback;
            image.on('error', function () {
                if (fallback && fallback !== image.attr('src')) {
                    image.attr('src', fallback);
                } else {
                    image.off('error').attr('src', './img/img_broken.svg');
                }
                fallback = '';
            }).attr('src', data.poster || './img/img_broken.svg');
            item.find('.card__title').text(data.title);
            item.find('.card__age').text(data.release_date.slice(0, 4));
            item.appendTo(grid);
            item.on('hover:enter', function () {
                Lampa.Activity.push({ component: 'full', method: 'movie', source: SOURCE,
                    card: data, id: data.id, url: '' });
            });
            item.on('hover:focus', function () {
                focused = this;
                scroll.update(item);
                var index = grid.children().index(this);
                if (index >= 0 && index >= grid.children().length - 5) next();
            });
        }

        function load(initial) {
            if (loading || destroyed) return;
            loading = true;
            if (initial) component.activity.loader(true);
            loadList(object, function (page) {
                if (destroyed) return;
                total = page.total_pages;
                page.results.forEach(append);
                if (initial && !page.results.length) Lampa.Noty.show(page.message);
                if (initial) component.activity.loader(false);
                refreshFocus();
                loading = false;
                if (initial && page.results.length && page.results.length < PAGE_SIZE) next();
            }, function (error) {
                loading = false;
                if (destroyed) return;
                if (initial) component.activity.loader(false);
                if (running) Lampa.Noty.show(error.message || 'Список недоступен.');
            });
        }

        function next() {
            if (loading || destroyed || !running || object.page >= total) return;
            object.page += 1;
            load(false);
        }

        function move(direction, fallback) {
            var navigator = window.Navigator && typeof window.Navigator.canmove === 'function' ? window.Navigator : Lampa.Navigator;
            if (navigator && typeof navigator.canmove === 'function' && navigator.canmove(direction)) {
                navigator.move(direction);
                return true;
            }
            if (fallback) Lampa.Controller.toggle(fallback);
            return false;
        }

        this.create = function () {
            if (object.anistarHome) refreshGenres();
            scroll.minus();
            scroll.onEnd = next;
            load(true);
        };
        this.render = function (raw) { return raw ? scroll.render()[0] : scroll.render(); };
        this.start = function () {
            running = true;
            Lampa.Controller.add('content', {
                link: component,
                toggle: refreshFocus,
                left: function () { move('left', 'menu'); },
                up: function () { move('up', 'head'); },
                down: function () { if (!move('down')) next(); },
                right: function () {
                    if (!move('right') && !object.anistarList) showFilter(object);
                },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };
        this.pause = this.stop = function () { running = false; };
        this.destroy = function () {
            destroyed = true;
            scroll.destroy();
            root.remove();
        };
    }

    function editText(options, callback) {
        var cancelled = false;
        var input = Lampa.Input.edit(Object.assign({ nosave: true }, options), function (value) {
            Promise.resolve().then(function () {
                callback(cancelled ? null : String(value || ''));
            });
        });
        if (input && input.listener) input.listener.follow('back', function () { cancelled = true; });
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
            },
            onBack: back
        });
    }

    function showFilter(activity) {
        var base = activity.anistarFilters || defaultFilters;
        var draft = Object.assign({}, base);
        var controller = Lampa.Controller.enabled().name;

        function render() {
            if (Lampa.Activity.active() !== activity) return;
            var genre = genreIndex.get(draft.genre);
            Lampa.Select.show({
                title: 'Фильтр',
                items: [
                    { title: 'Поиск', subtitle: escapeHtml(draft.query), action: search },
                    { title: 'Закладки', action: bookmarks },
                    { title: 'Сортировка', subtitle: SORT[draft.sort].title, action: sort },
                    { title: 'Жанры', subtitle: genre ? escapeHtml(genre.title) : 'Все', action: genres },
                    { title: 'Год', subtitle: draft.year || 'Любой', action: years },
                    { title: 'Показать', action: apply },
                    { title: 'Сбросить', action: reset }
                ],
                onSelect: function (entry) { entry.action(); },
                onBack: function () { Lampa.Controller.toggle(controller); }
            });
        }

        function choose(label, key, options) {
            optionMenu(label, options, draft[key], function (value) {
                draft[key] = value;
                if (key === 'sort') draft.sortApplied = true;
                apply();
            }, render);
        }

        function search() {
            editText({ title: 'Поиск по AniStar', value: draft.query, free: true },
                function (value) {
                    if (value === null) render();
                    else {
                        var query = value.trim();
                        if (!query) render();
                        else {
                            var options = Object.assign({}, defaultFilters, { query: query });
                            openList('Поиск · ' + query, Object.assign({ anistarResults: true, anistarFilters: options }, options));
                        }
                    }
                });
        }

        function bookmarks() {
            Lampa.Select.show({
                title: 'Закладки',
                items: STATUS.map(function (entry) { return { title: entry.title, entry: entry }; }),
                onSelect: function (item) { openPersonal(item.entry); },
                onBack: render
            });
        }

        function sort() {
            choose('Сортировка', 'sort', SORT.map(function (entry, index) {
                return { title: entry.title, value: index };
            }));
        }

        function genres() {
            Lampa.Controller.toggle('content');
            refreshGenres().then(function () {
                if (Lampa.Activity.active() !== activity) return;
                var items = Array.from(genreIndex.values()).sort(function (left, right) {
                    return left.title.localeCompare(right.title, 'ru', { sensitivity: 'base' });
                }).map(function (entry) {
                    return { title: escapeHtml(entry.title), value: entry.url };
                });
                if (!items.length) {
                    Lampa.Noty.show('Не удалось загрузить жанры AniStar.');
                    render();
                    return;
                }
                items.unshift({ title: 'Все', value: '' });
                choose('Жанры', 'genre', items);
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
            if (Lampa.Activity.active() !== activity) return;
            if (!draft.query && !draft.genre && !draft.year && !draft.sortApplied && !activity.anistarRoute) {
                if (activity.anistarResults) Lampa.Activity.backward();
                else Lampa.Controller.toggle(controller);
                return;
            }
            openList(activity.anistarRoute ? activity.title : 'Каталог AniStar', Object.assign({
                anistarResults: true, anistarRoute: activity.anistarRoute, anistarFilters: draft
            }, draft));
        }

        function reset() {
            draft = Object.assign({}, defaultFilters);
            apply();
        }

        render();
    }

    function installFilter() {
        var button = Lampa.Head.addIcon('<svg><use xlink:href="#sprite-filter"></use></svg>', function () {
            var activity = Lampa.Activity.active();
            if (activity && activity.component === 'anistar_catalog' && !activity.anistarList) showFilter(activity);
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
        var logout = doc.querySelector('a[href*="action=logout"], a[href*="do=logout"]');
        var menu = logout && logout.closest('ul');
        var profile = menu && menu.querySelector('a[href*="/user/"]');
        var profileUrl = profile && siteUrl(profile.getAttribute('href'));
        var logoutUrl = logout && siteUrl(logout.getAttribute('href'));
        var match = profileUrl && new URL(profileUrl).pathname.match(/^\/user\/([^/]+)\/?$/);
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
                        bookmarkPages.clear();
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
                Array.prototype.forEach.call(loginForm.querySelectorAll('input[type="hidden"][name]'), function (input) {
                    fields[input.name] = input.value;
                });
                fields.login_name = username;
                fields.login_password = password;
                password = '';
                var target = siteUrl(loginForm.getAttribute('action') || CATALOG, CATALOG);
                if (!target || !/^post$/i.test(loginForm.getAttribute('method') || '')) {
                    throw new Error('Форма входа AniStar изменилась.');
                }
                // Android APK 1.13.7 sends post_data as-is, so pass the form string.
                return pageDocument(target, { body: form(fields), auth: true }).then(function (signed) {
                    return pageDocument(CATALOG, { auth: true }).then(function (check) {
                        var verified = readSession(check);
                        if (verified) return verified;
                        if (readSession(signed)) throw new Error('Lampa не сохранила сессию AniStar.');
                        throw new Error('AniStar не подтвердил вход.');
                    });
                });
            }).then(function (signedIn) {
                setSession(signedIn);
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
                setSession(null);
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
            var text = clean(row.textContent);
            if (label.test(text)) return text.replace(label, '').trim();
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

    function playerText(value) {
        return decodeHtml(value).replace(/\\+\//g, '/').replace(/\\+u0026/gi, '&');
    }

    function playerUrl(doc, article) {
        var attributes = ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-iframe', 'data-url', 'data-link', 'data-player'];
        var frames = doc.querySelectorAll('iframe');
        var player = '';

        function candidate(value) {
            return /videoas_p2p_new\.php/i.test(value || '') ? siteUrl(playerText(value), article) : '';
        }

        Array.prototype.some.call(frames, function (frame) {
            return attributes.some(function (name) {
                player = candidate(frame.getAttribute(name));
                return Boolean(player);
            });
        });
        if (player) return player;

        var html = playerText(doc.documentElement ? doc.documentElement.outerHTML : '');
        var pattern = /[^"'<>\s=]*videoas_p2p_new\.php[^"'<>\s]*/gi;
        var match;
        while ((match = pattern.exec(html))) {
            if ((player = candidate(match[0]))) return player;
        }

        var embedded = doc.querySelectorAll('.video_as iframe, #vid_2 iframe, .video-box iframe, .video-container iframe, #player iframe');
        Array.prototype.some.call(embedded, function (frame) {
            return attributes.some(function (name) {
                player = siteUrl(playerText(frame.getAttribute(name)), article);
                return Boolean(player);
            });
        });
        return player;
    }

    function readArticle(doc, card) {
        var content = doc.querySelector('#dle-content');
        var scope = content || doc;
        var heading = scope.querySelector('.news h1, .fullstory h1, article h1, .title_left h1');
        var player = playerUrl(doc, card.url);
        var root = heading ? (heading.closest('.news, .fullstory, article') || scope) :
            scope.querySelector('.news, .fullstory') || (player && scope);
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
        var rating = nodeText(root, '.ratingtypeplusminus, .rating');
        var score = rating.match(/(\d+(?:[.,]\d+)?)\s*\/\s*10/);
        movie.vote_average = score ? Number(score[1].replace(',', '.')) : 0;
        movie.anistar = {
            genres: readLinks(head, '/filter/janrs/'),
            directors: readLinks(head, '/filter/director/'),
            authors: readLinks(head, '/filter/author/'),
            translation: labeledValue(root, /^Озвучка:/i),
            series: labeledValue(root, /^Серии:/i),
            released: nodeText(root, '.reason'),
            player: player,
            comments: readComments(doc)
        };
        var runtime = movie.anistar.series.match(/(\d+)\s*мин/i);
        movie.anistar.duration = runtime ? runtime[1] + ' мин' : '';
        return movie;
    }

    function loadFull(object, success, failure) {
        var card = object.card || { url: object.url };
        if (!newsId(card.url)) {
            failure();
            return;
        }
        var component = object.activity && object.activity.component;
        pageDocument(desktopUrl(card.url), session ? { auth: true } : { plainGet: true }).then(function (doc) {
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
        var origin = Lampa.Activity.active();
        if (!origin || !origin.activity || origin.component === VIEW || origin.anistarWatchLoading) return;
        if (movie.adult && !canWatch()) {
            Lampa.Noty.show('Тайтл скрыт настройками профиля Lampa.');
            return;
        }
        origin.anistarWatchLoading = true;
        origin.activity.loader(true);
        loadEpisodes(movie).then(function () {
            if (Lampa.Activity.active() !== origin) return;
            Lampa.Activity.push({
                component: VIEW, source: SOURCE, url: '', title: 'Онлайн · ' + decodeHtml(movie.title),
                movie: movie, episode: episode || 0, page: 1
            });
        }).catch(function (error) {
            if (Lampa.Activity.active() === origin) Lampa.Noty.show(error.message);
        }).finally(function () {
            delete origin.anistarWatchLoading;
            if (origin.activity && !origin.activity.component.destroyed) origin.activity.loader(false);
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
        if (!view.body || typeof view.tag !== 'function') return;
        var group = view.tag(title, entries.map(function (entry) {
            return { id: entry.url, name: escapeHtml(entry.title) };
        }), function (entry) {
            openList(decodeHtml(entry.name), { anistarRoute: entry.id });
        });
        $(group).on('hover:focus', function () { view.last = this; });
        view.body.find('.full-descr__tags').append(group);
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
            if (details.comments.length) {
                detailAction(owner, 'Комментарии', details.comments.length, function () {
                    Lampa.Activity.push({ component: COMMENTS, source: SOURCE, title: 'Комментарии',
                        page: 1, movie: movie, url: '' });
                });
            }
            return;
        }
        if (event.name !== 'start') return;

        var card = $(owner.html);
        var main = card.find('.full-start-new__details, .full-start__details').first();
        var year = movie.release_date.slice(0, 4);
        if (main.length) {
            main.empty();
            [year, details.translation, details.series && 'Серии: ' + details.series].filter(Boolean).forEach(function (value, index) {
                if (index) main.append('<span class="full-start-new__split">●</span>');
                main.append($('<span></span>').text(value));
            });
        }
        card.find('.full-start-new__title, .full-start-new__tagline').css({
            whiteSpace: 'normal', overflowWrap: 'anywhere'
        });
        card.find('.full-start-new__reactions').hide();
        var ratingBox = card.find('.full-start__rate.rate--tmdb');
        ratingBox.toggleClass('hide', !movie.vote_average).find('.source--name').text(NAME);
        if (details.released) {
            var released = $('<div class="anistar-released"></div>').text(details.released);
            if (main.length) main.after(released);
            else card.find('.full-start-new__title, .full-start__title').first().after(released);
        }
        var buttons = card.find('.full-start-new__buttons, .full-start__buttons').first();
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
            buttons.children('.full-start__button').not('.anistar-action').hide().removeClass('selector');
            if (!watch.parent().length) buttons.append(watch);
            if (!favorite.parent().length) buttons.append(favorite);
            if (initial) {
                initial = false;
                owner.last = watch[0];
            }
        }

        buttonsOnly();
        owner.use({ onlyGroupButtons: buttonsOnly });
    }

    function episodeIdentity(title, type) {
        var season = title.match(/(?:\bseason\s*|сезон\s*|\bs(?=\d+e))\s*(\d+)/i) ||
            title.match(/(\d+)\s*[-–]?\s*(?:й\s*)?сезон/i);
        var number = title.match(/(?:серия|эпизод|episode|\bs\d+e)\s*№?\s*(\d+(?:[.,]\d+)?)/i) ||
            title.match(/(\d+(?:[.,]\d+)?)\s*(?:[-–]\s?(?:я|й)\s*)?(?:серия|эпизод|episode)/i) ||
            title.match(/^\s*№?\s*(\d+(?:[.,]\d+)?)(?=\s*(?:$|[:.\-–—]))/);
        var special = (type + ' ' + title).match(/спешл|спец(?:выпуск|эпизод)|special|\bOVA\b|\bONA\b|\bOAD\b|\bNCOP\b|\bNCED\b|трейлер|trailer|фильм|\bmovie\b/i);
        var kind = '';
        if (special && !/(?:фильм|movie)/i.test(special[0])) {
            var label = special[0];
            kind = /^(?:спешл|спец|special)/i.test(label) ? 'Спецвыпуск' :
                /^(?:трейлер|trailer)$/i.test(label) ? 'Трейлер' : label.toUpperCase();
            if (!number) number = title.match(/(?:спешл|спецвыпуск|спецэпизод|special|ova|ona|oad|ncop|nced|трейлер|trailer)\s*№?\s*(\d+(?:[.,]\d+)?)/i);
        } else if (special && !number) kind = 'Фильм';
        return { season: season ? Number(season[1]) : 1, kind: kind, number: number ? Number(number[1].replace(',', '.')) : null };
    }

    function parsePlaylist(html, base) {
        var doc = parser.parseFromString(html, 'text/html');
        var translation = nodeText(doc, '#ListDub > span');
        var dubNames = new Map();
        Array.prototype.forEach.call(doc.querySelectorAll('#ListDub li'), function (entry) {
            var id = (entry.getAttribute('data-id') || entry.getAttribute('value') || entry.id).match(/\d+/);
            if (id) dubNames.set(id[0], clean(entry.textContent));
        });

        var text = String(html || '');
        var entryPattern = /\btitle['"]?\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*,\s*['"]?media_id['"]?\s*:\s*("[^"]*"|'[^']*'|\d+)/g;
        var matches = [];
        var match;
        while ((match = entryPattern.exec(text))) matches.push(match);
        var episodes = matches.map(function (entry, index) {
            var block = text.slice(entry.index, matches[index + 1] && matches[index + 1].index);
            var rawTitle = clean(playerText(entry[1].slice(1, -1)).replace(/\\(['"])/g, '$1'));
            var mediaId = entry[2].replace(/^['"]|['"]$/g, '');
            var kind = (block.match(/\b(?:episode_type|type_episode)['"]?\s*:\s*['"]([^'"]+)/i) || [])[1] || '';
            var identity = episodeIdentity(rawTitle, kind);
            var statedNumber = block.match(/\b(?:episode_number|episode_num|num_episode)['"]?\s*:\s*['"]?(\d+(?:[.,]\d+)?)/i);
            if (statedNumber) identity.number = Number(statedNumber[1].replace(',', '.'));
            var statedSeason = block.match(/\b(?:season_number|season_num)['"]?\s*:\s*['"]?(\d+)/i);
            if (statedSeason) identity.season = Number(statedSeason[1]);
            var quality = new Map();
            var sections = /\b(?:files|files_as|files_mp4)['"]?\s*:\s*\[((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\]'"\x5c])*)\]/g;
            var section;
            while ((section = sections.exec(block))) {
                var files = section[1].match(/\{(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^{}'"])*\}/g) || [];
                files.forEach(function (file) {
                    var size = Number((file.match(/\btitle['"]?\s*:\s*['"]?(\d+)/i) || [])[1]);
                    var stream = file.match(/\b(?:file|url)['"]?\s*:\s*(['"])(.*?)\1/i);
                    var url = stream && urlOf(playerText(stream[2]), base, true);
                    if (!url || !size) return;
                    var hls = /\.m3u8$/i.test(url.pathname);
                    var previous = quality.get(size);
                    if (!previous || (!previous.hls && hls)) quality.set(size, { url: url.href, hls: hls, size: size });
                });
            }
            var dub = (block.match(/\btype_dub['"]?\s*:\s*['"]?(\d+)/) || [])[1] || '';
            var imagePath = (block.match(/\b(?:image|poster|thumbnail)['"]?\s*:\s*['"]([^'"]+)['"]/) || [])[1];
            var image = imagePath && urlOf(playerText(imagePath), base);
            return Object.assign(identity, { mediaId: mediaId, dub: dub, image: image && image.href,
                files: Array.from(quality.values()).sort(function (left, right) { return right.size - left.size; }),
                translation: dubNames.get(dub) || (dubNames.size <= 1 ? translation : '') });
        });

        var numbers = new Map();
        function usedNumbers(episode) {
            var group = [episode.season, episode.kind].join('/');
            if (!numbers.has(group)) numbers.set(group, new Set());
            return numbers.get(group);
        }
        episodes.forEach(function (episode) {
            if (episode.number !== null) usedNumbers(episode).add(episode.number);
        });
        episodes.forEach(function (episode) {
            if (episode.number === null && !episode.kind) {
                var used = usedNumbers(episode);
                episode.number = 1;
                while (used.has(episode.number)) episode.number += 1;
                used.add(episode.number);
            }
            episode.title = (episode.kind || 'Серия') + (episode.number === null ? '' : ' ' + episode.number);
        });
        return episodes.sort(function (left, right) {
            return left.season - right.season || Number(Boolean(left.kind)) - Number(Boolean(right.kind)) ||
                (left.number || 0) - (right.number || 0);
        });
    }

    function mergeEpisodes(episodes) {
        var byEpisode = new Map();
        episodes.forEach(function (entry) {
            var key = [entry.season, entry.kind, entry.number === null ? entry.mediaId : entry.number].join('/');
            var previous = byEpisode.get(key);
            if (!previous || (!previous.files.length && entry.files.length)) byEpisode.set(key, entry);
        });
        return Array.from(byEpisode.values());
    }

    function playerItems(movie) {
        var player = movie.anistar.player;
        if (!player) return Promise.reject(new Error('В карточке AniStar нет плеера.'));
        var options = android() ? { auth: Boolean(session), headers: { Referer: movie.url } } :
            session ? { auth: true } : { plainGet: true };
        return request(player, options).then(function (html) {
            var episodes = parsePlaylist(html, player);
            if (!episodes.length) throw new Error('AniStar не вернул доступные серии.');
            return episodes;
        });
    }

    function loadEpisodes(movie) {
        var cached = watchPlaylists.get(movie);
        if (cached) return Promise.resolve(cached);
        return playerItems(movie).then(function (episodes) {
            watchPlaylists.set(movie, episodes);
            return episodes;
        });
    }

    function timeline(movie, episode) {
        if (!Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return undefined;
        var id = [movie.id, episode.dub, episode.number].join('/');
        if (episode.kind || episode.season !== 1) id += '/' + [episode.season, episode.kind, episode.mediaId].join('/');
        return Lampa.Timeline.view(Lampa.Utils.hash(id));
    }

    function play(movie, episode, episodes) {
        if (!episode.files.length) {
            Lampa.Noty.show('AniStar пока не вернул видео для этой серии.');
            return;
        }
        var preferred = String(Lampa.Storage.get('video_quality_default', '1080')).replace(/p$/i, '') + 'p';
        var activity = Lampa.Activity.active();
        var headers = { Referer: movie.anistar.player, Origin: SITE };
        if (window.navigator && window.navigator.userAgent) headers['User-Agent'] = window.navigator.userAgent;
        function media(entry) {
            var qualities = {};
            entry.files.forEach(function (file) { qualities[file.size + 'p'] = file.url; });
            return {
                title: decodeHtml(movie.title) + ' / ' + entry.title,
                url: qualities[preferred] || entry.files[0].url,
                quality: qualities, headers: headers,
                movie: movie, season: entry.season, episode: entry.number === null ? 1 : entry.number, timeline: timeline(movie, entry)
            };
        }
        var item = media(episode);
        playerOrigin = { data: item, activity: activity };
        Lampa.Player.play(item);
        if (typeof Lampa.Player.playlist === 'function') Lampa.Player.playlist(episodes.filter(function (entry) { return entry.files.length; }).map(media));
    }

    function rowComponent() {
        var component = {};
        var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250 });
        var body = $('<div class="mapping--list anistar-row-list"></div>');
        var hooks;
        var running = false;
        scroll.append(body);
        component.body = body;
        component.use = function (options) { hooks = options; };

        function focus() {
            if (!running || component.destroyed || Lampa.Controller.enabled().name !== 'content') return;
            Lampa.Controller.collectionSet(body, false, true);
            var target = component.last || body.find('.selector')[0];
            if (target) Lampa.Controller.collectionFocus(target, body, true);
        }

        component.create = function () {
            scroll.minus();
            component.activity.loader(true);
            hooks.onCreate.call(component);
        };
        component.build = function (data) {
            data.results.forEach(hooks.onlyCreateAndAppend, component);
            component.activity.loader(false);
            focus();
        };
        component.empty = function (message) {
            component.activity.loader(false);
            var active = Lampa.Activity.active();
            if (!active || active.activity !== component.activity) return;
            Lampa.Noty.show(message || 'Тайтлы не найдены.');
            Lampa.Activity.backward();
        };
        component.render = function (raw) { return raw ? scroll.render()[0] : scroll.render(); };
        component.start = function () {
            running = true;
            var navigator = window.Navigator && typeof window.Navigator.canmove === 'function' ? window.Navigator : Lampa.Navigator;
            function move(direction, fallback) {
                if (navigator && navigator.canmove(direction)) navigator.move(direction);
                else if (fallback) Lampa.Controller.toggle(fallback);
            }
            Lampa.Controller.add('content', {
                link: component, toggle: focus,
                left: function () { move('left', 'menu'); },
                right: function () { move('right'); },
                up: function () { move('up', 'head'); },
                down: function () { move('down'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };
        component.pause = component.stop = function () { running = false; };
        component.destroy = function () {
            component.destroyed = true;
            scroll.destroy();
            body.remove();
        };
        component.append = function (row) {
            row.on('hover:focus', function () {
                component.last = this;
                scroll.update(row, true);
            }).appendTo(body);
        };
        return component;
    }

    function appendRow(owner, html) {
        owner.append(html);
    }

    function watchComponent(object) {
        var component = rowComponent();
        var movie = object.movie;
        var currentDub = null;
        var groups = new Map();
        var items;
        var multipleSeasons = false;
        var layout = $('<div class="anistar-online"></div>');
        var sidebar = $('<aside class="anistar-online__info"></aside>').appendTo(layout);
        var column = $('<div class="anistar-online__episodes"></div>').appendTo(layout);
        var originalRender = component.render;
        column.append(originalRender());
        component.render = function (raw) { return raw ? layout[0] : layout; };
        var originalDestroy = component.destroy;
        component.destroy = function () { originalDestroy(); layout.remove(); };

        function showInfo() {
            if (movie.poster) sidebar.append($('<img alt="">').attr('src', movie.poster));
            var info = catalogTemplate('season_info', '.season-info__title',
                '<div class="season-info"><div class="season-info__title"></div><div class="season-info__head"></div><div class="season-info__overview"></div></div>');
            info.removeClass('selector');
            info.find('.season-info__title').text(decodeHtml(movie.title));
            info.find('.season-info__head').text([movie.release_date.slice(0, 4),
                movie.anistar.genres.map(function (genre) { return genre.title; }).join(', ')].filter(Boolean).join(' • '));
            info.find('.season-info__overview').text(decodeHtml(movie.overview));
            sidebar.append(info);
        }

        function translations() {
            Lampa.Select.show({
                title: 'Озвучка',
                items: [{ title: 'Все серии', value: null, selected: currentDub === null }].concat(
                    Array.from(groups.entries(), function (group) {
                        var label = group[1][0].translation || (group[0] ? 'Озвучка ' + group[0] : NAME);
                        return { title: escapeHtml(label), value: group[0], selected: group[0] === currentDub };
                    })
                ),
                onBack: function () { Lampa.Controller.toggle('content'); },
                onSelect: function (entry) {
                    if (entry.value === currentDub) Lampa.Controller.toggle('content');
                    else Lampa.Activity.replace({ anistarDub: entry.value, episode: 0 });
                }
            });
        }

        component.use({
            onCreate: function () {
                var owner = this;
                if (movie.adult && !canWatch()) {
                    Promise.resolve().then(function () { owner.empty('Тайтл скрыт настройками профиля Lampa.'); });
                    return;
                }
                showInfo();
                loadEpisodes(movie).then(function (episodes) {
                    if (owner.destroyed) return;
                    episodes.forEach(function (entry) {
                        if (!groups.has(entry.dub)) groups.set(entry.dub, []);
                        groups.get(entry.dub).push(entry);
                    });
                    currentDub = groups.has(object.anistarDub) ? object.anistarDub : null;
                    items = mergeEpisodes(currentDub === null ? episodes : groups.get(currentDub));
                    multipleSeasons = new Set(items.map(function (entry) { return entry.season; })).size > 1;
                    owner.build({ results: [{ source: true }].concat(items) });
                }).catch(function (error) {
                    if (!owner.destroyed) owner.empty(error.message);
                });
            },
            onlyCreateAndAppend: function (entry) {
                if (entry.source) {
                    var sourceLabel = currentDub === null && groups.size > 1 ? 'Все серии' :
                        items[0].translation || movie.anistar.translation || NAME;
                    var source = $('<div class="anistar-online__source"></div>').text('Источник · ' + sourceLabel);
                    if (groups.size > 1) source.addClass('selector').on('hover:enter', translations);
                    this.append(source);
                    return;
                }
                var row = catalogTemplate('season_episode', '.season-episode__title',
                    '<div class="season-episode selector"><div class="season-episode__img"><img alt=""></div><div class="season-episode__body"><div class="season-episode__head"><div class="season-episode__title"></div><div class="season-episode__time"></div></div><div class="season-episode__timeline"></div><div class="season-episode__footer"><div class="season-episode__info"></div><div class="season-episode__quality"></div></div></div></div>');
                row.addClass('selector');
                row.find('.season-episode__title').text(entry.title);
                row.find('.season-episode__time').text(entry.kind ? '' : movie.anistar.duration || '');
                var episodeInfo = entry.translation || movie.anistar.translation || NAME;
                if (multipleSeasons) episodeInfo = 'Сезон ' + entry.season + ' · ' + episodeInfo;
                row.find('.season-episode__info').text(episodeInfo);
                row.find('.season-episode__quality').text(entry.files.length ? entry.files[0].size + 'p' : 'Видео недоступно');
                row.find('.season-episode__loader').hide();
                var thumb = row.find('.season-episode__img').addClass('season-episode__img--loaded');
                thumb.find('img').on('error', function () { $(this).hide(); })
                    .attr('src', entry.image || movie.poster || './img/img_broken.svg');
                if (entry.number !== null) {
                    thumb.append($('<div class="season-episode__episode-number"></div>').text(entry.number));
                }
                var progress = timeline(movie, entry);
                if (progress && typeof Lampa.Timeline.render === 'function') {
                    row.find('.season-episode__timeline').append(Lampa.Timeline.render(progress));
                }
                row.on('hover:enter', function () { play(movie, entry, items); });
                this.append(row);
                if (!this.last || (!entry.kind && Number(object.episode) === entry.number)) this.last = row[0];
            }
        });
        return component;
    }

    function commentsComponent(object) {
        var component = rowComponent();
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
            '.anistar-action{gap:.6em}',
            '.anistar-action svg{width:1.4em;height:1.4em}',
            '.anistar-released{font-weight:700;margin:.7em 0}',
            '.anistar-online{display:flex;gap:1.5em;padding:0 1.5em;align-items:flex-start}',
            '.anistar-online__info{flex:0 0 27%;max-height:72vh;overflow:hidden}',
            '.anistar-online__info>img{display:block;width:6.5em;border-radius:.3em;margin:0 0 .8em}',
            '.anistar-online__info .season-info{background:transparent;padding:0}',
            '.anistar-online__episodes{min-width:0;flex:1}',
            '.anistar-online__source{background:rgba(255,255,255,.08);padding:.75em 1em;margin:0 0 .75em;border-radius:.3em}',
            '.anistar-online__source.focus{outline:.18em solid currentColor}',
            '.anistar-online .season-episode__img img{object-fit:cover}',
            '@media(max-width:700px){.anistar-online__info{display:none}.anistar-online{padding:0 .7em}}',
            '.anistar-comment{border-radius:.35em;background:rgba(255,255,255,.08);padding:1em 1.2em;margin:.45em 0}',
            '.anistar-comment small{display:block;opacity:.65;margin:.4em 0}',
            '.anistar-comment p{line-height:1.4}',
            '.anistar-comment.focus{background:#fff;color:#222}'
        ].join('\n')).appendTo('head');
    }

    function init() {
        if (Lampa.Api.sources[SOURCE]) return;
        restoreAccount();
        var cached = Lampa.Storage.get(GENRE_CACHE, {});
        if (cached && Array.isArray(cached.items)) {
            cached.items.forEach(function (entry) { if (siteUrl(entry.url)) genreIndex.set(entry.url, entry); });
        }
        Lampa.Api.sources[SOURCE] = { list: loadList, full: loadFull, clear: function () {} };
        Lampa.Component.add('anistar_catalog', catalogComponent);
        Lampa.Component.add(VIEW, watchComponent);
        Lampa.Component.add(COMMENTS, commentsComponent);
        Lampa.Menu.addButton(ICON, NAME, function () {
            Lampa.Activity.push(listState(NAME, { anistarHome: true }));
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
