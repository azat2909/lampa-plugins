/*!
 * Anistar для Lampa
 * Версия 0.5.14
 */
(function () {
    'use strict';

    var SOURCE = 'anistar';
    var NAME = 'Anistar';
    var VERSION = '0.5.14';
    var DEFAULT_SITE = 'https://anistar.org';
    var SITE = DEFAULT_SITE;
    var previousSite = DEFAULT_SITE;
    var SITE_KEY = 'anistar_site_url';
    var HOME_GENRE = 'anistar_home_genre';
    var CATALOG_PATH = /^\/anime(?:\/page\/(\d+))?\/?$/i;
    var LEGACY_CARD = '.shortstory, .base, .news, .item, .anime-item, .movie-item, article, li';
    var VIEW = 'anistar_watch';
    var COMMENTS = 'anistar_comments';
    var PAGE_SIZE = 20;
    var SEARCH_PAGE_SIZE = 10;
    var SEARCH_PATH = '/?do=search&mode=advanced&subaction=search&titleonly=3&story=';
    var TIMEOUT = 18000;
    var ACCOUNT_LOGIN = 'anistar_login';
    var ACCOUNT_PASSWORD = 'anistar_password';
    var ACCOUNT_KEY = 'anistar_account_v1';
    var GENRE_CACHE = 'anistar_anime_genres_v1';
    var LOGIN_PROMPT = 'Войдите в аккаунт в настройках Anistar';
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
    var GENRES = [
        ['Боевики','thriller'], ['Вампиры','vampires'], ['Гарем','ani-garem'], ['Детектив','detective'],
        ['Драма','drama'], ['История','history'], ['Киберпанк','cyberpunk'], ['Комедия','comedy'],
        ['Махо-седзе','maho-shoujo'], ['Меха','fur'], ['Мистика','mysticism'], ['Музыкальное','music'],
        ['Пародии','parodies'], ['Повседневность','everyday-life'], ['Приключения','adventures'],
        ['Романтика','romance'], ['Сёдзе','shoujo'], ['Сёнен','senen'], ['Сёнен-ай','senen-ay'],
        ['Спорт','sports'], ['Триллер','horror'], ['Ужасы','horor'], ['Фантастика','fantasy'],
        ['Фэнтези','fentezi'], ['Хентай','hentai'], ['Школа','school'], ['Эччи','echchi-erotic']
    ];
    var parser = new DOMParser();
    var genreIndex = new Map();
    var lists = new WeakMap();
    var defaultFilters = { sort: 0, year: '', genre: '', query: '' };
    var genreRefresh;
    var playerOrigin;
    var session;
    var loginWork;
    var nativeCookies = new Map();
    var bookmarkPages = new Map();
    var watchPlaylists = new WeakMap();
    var sortPlans = new WeakMap();
    var articleMetadata = new Map();
    var CONNECT_ERROR = 'Не удалось подключиться к Anistar. Попробуйте указать актуальный адрес сайта в настройках AniStar';

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
            var url = new URL(siteUrl(value, base) || value, base || SITE);
            var supported = url.protocol === 'https:' || (allowHttp && url.protocol === 'http:');
            return supported && !url.username && !url.password ? url : null;
        } catch (error) {
            return null;
        }
    }

    function configuredOrigin(value) {
        var address = clean(value);
        if (!address) return DEFAULT_SITE;
        try {
            var url = new URL(address.indexOf('://') === -1 ? 'https://' + address : address);
            if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) return url.origin;
        } catch (error) {}
        return '';
    }

    function siteUrl(value, base) {
        if (!value || !String(value).trim()) return '';
        try {
            var url = new URL(value, base || SITE);
            if (url.protocol === 'http:') url.protocol = 'https:';
            if (url.username || url.password) return '';
            if (url.origin === SITE) return url.href.split('#')[0];
            if (url.origin === DEFAULT_SITE || url.origin === 'https://www.anistar.org' || url.origin === previousSite) {
                return SITE + url.pathname + url.search;
            }
        } catch (error) {}
        return '';
    }

    function hostStorageKey(key) {
        return SITE === DEFAULT_SITE ? key : key + ':' + SITE;
    }

    function desktopUrl(value) {
        var url = new URL(siteUrl(value));
        // Keep pre-encoded Windows-1251 query values intact.
        return url.searchParams.has('skin_name') ? url.href : url.href + (url.search ? '&' : '?') + 'skin_name=new36';
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

    function tizen() {
        return Boolean(Lampa.Platform.is('tizen') || (window.navigator && /tizen/i.test(window.navigator.userAgent || '')));
    }

    function settle(work, finish) {
        return work.then(function (value) { finish(); return value; }, function (error) { finish(); throw error; });
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
        Lampa.Storage.set(hostStorageKey(ACCOUNT_KEY), session ? {
            name: session.name, logout: session.logout, cookies: Array.from(nativeCookies.entries())
        } : null);
    }

    function restoreAccount() {
        var saved = Lampa.Storage.get(hostStorageKey(ACCOUNT_KEY), null);
        if (!saved || typeof saved.name !== 'string' || !siteUrl(saved.logout)) return;
        session = { name: saved.name, logout: siteUrl(saved.logout) };
        if (Array.isArray(saved.cookies)) saved.cookies.forEach(function (pair) {
            if (Array.isArray(pair) && pair.length === 2 && /^[\w-]+$/.test(pair[0]) &&
                typeof pair[1] === 'string' && !/[;\r\n]/.test(pair[1])) nativeCookies.set(pair[0], pair[1]);
        });
    }

    function saveCookies(headers, jar) {
        var key = headers && Object.keys(headers).find(function (name) { return name.toLowerCase() === 'set-cookie'; });
        var cookies = key && headers[key];
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
                changed = jar.delete(key) || changed;
            } else if (jar.get(key) !== value) {
                jar.set(key, value);
                changed = true;
            }
        });
        if (changed && session && jar === nativeCookies) persistAccount();
    }

    function request(url, options) {
        options = options || {};
        url = siteUrl(url);
        if (!url) return Promise.reject(new Error('Некорректный адрес AniStar.'));
        var requestSite = SITE;
        var plainGet = options.plainGet === true;
        var native = !plainGet && android();
        return new Promise(function (resolve, reject) {
            var network = new Lampa.Reguest();
            var body = options.body;
            var headers = Object.assign({}, options.headers);
            var method = body === undefined ? 'GET' : 'POST';
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
                    : CONNECT_ERROR;
                finish(reject, new Error(message));
            }

            var jar = options.cookieJar || (options.auth ? nativeCookies : null);
            if (native && jar && jar.size) {
                headers.Cookie = Array.from(jar, function (entry) { return entry.join('='); }).join('; ');
            }
            if (body !== undefined) headers['Content-Type'] = 'application/x-www-form-urlencoded';
            var settings = { dataType: 'text', timeout: timeout };
            if (plainGet) {
                // Keep the request shape used by 0.4.55 on Android TV and Tizen.
                body = false;
            } else {
                settings.type = method;
                settings.headers = headers;
                settings.returnHeaders = native && Boolean(jar || options.returnHeaders);
                settings.withCredentials = options.auth === true;
                if (tizen() && options.auth) settings.xhrFields = { withCredentials: true };
            }
            try {
                network[plainGet || native || tizen() ? 'native' : 'silent'](url, function (response) {
                    if (returned) return;
                    if (requestSite !== SITE) {
                        finish(reject, new Error('Адрес AniStar изменился.'));
                        return;
                    }
                    var html = response;
                    if (native && typeof response === 'string' && /^\s*\{/.test(response)) {
                        try { response = JSON.parse(response); } catch (error) {}
                    }
                    if (native && response && typeof response.body === 'string') {
                        html = response.body;
                        if (jar && (!response.currentUrl || response.currentUrl.indexOf(SITE + '/') === 0)) saveCookies(response.headers, jar);
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

    function freshUrl(url) {
        url = desktopUrl(url);
        return url + '&_=' + Date.now();
    }

    function loginPassword() { return Lampa.Storage.get(hostStorageKey(ACCOUNT_PASSWORD), ''); }
    function loginName() { return Lampa.Storage.get(hostStorageKey(ACCOUNT_LOGIN), ''); }

    function loginAccount() {
        if (loginWork) return loginWork;
        var name = loginName();
        var password = loginPassword();
        if (!name || !password) return Promise.reject(new Error(LOGIN_PROMPT));
        var origin = SITE;
        var url = SITE + '/anime/';
        var home = pageDocument(freshUrl(url), { auth: true });
        loginWork = home.then(function (page) {
            var known = readSession(page);
            if (known && known.name.toLowerCase() === name.toLowerCase()) return known;
            var login = page.querySelector('input[name="login_name"]');
            var loginForm = login && login.closest('form');
            if (!loginForm || !loginForm.querySelector('input[name="login_password"]')) throw new Error('AniStar не вернул форму входа.');
            var target = siteUrl(loginForm.getAttribute('action') || url, url);
            if (!target || (loginForm.getAttribute('method') || '').toLowerCase() !== 'post') throw new Error('Форма входа AniStar изменилась.');
            var fields = Object.create(null);
            Array.prototype.forEach.call(loginForm.querySelectorAll('input[type="hidden"][name]'), function (field) {
                fields[field.name] = field.value;
            });
            fields.login_name = name;
            fields.login_password = password;
            return pageDocument(desktopUrl(target), { body: form(fields), auth: true, headers: { Referer: url } }).then(function () {
                return pageDocument(freshUrl(url), { auth: true });
            }).then(function (verified) {
                var account = readSession(verified);
                if (!account || account.name.toLowerCase() !== name.toLowerCase()) throw new Error('AniStar не подтвердил вход. Проверьте логин и пароль.');
                return account;
            });
        }).then(function (account) {
            if (origin !== SITE) throw new Error('Адрес AniStar изменился.');
            setSession(account);
            return account;
        });
        var pending = loginWork;
        pending.then(clear, clear);
        function clear() { if (loginWork === pending) loginWork = null; }
        return pending;
    }

    function accountDocument(url) {
        var origin = SITE;
        function get() { return pageDocument(freshUrl(url), { auth: true }); }
        if (!session && !loginName()) return Promise.reject(new Error(LOGIN_PROMPT));
        return get().then(function (doc) {
            var account = readSession(doc);
            if (account && (!loginName() || account.name.toLowerCase() === loginName().toLowerCase())) {
                if (!session) setSession(account);
                return doc;
            }
            if (origin !== SITE) throw new Error('Адрес AniStar изменился.');
            if (session) { nativeCookies.clear(); setSession(null); }
            return loginAccount().then(get).then(function (verified) {
                if (!readSession(verified)) throw new Error(LOGIN_PROMPT);
                return verified;
            });
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

    function articleYear(node) {
        var anchors = node.querySelectorAll('a[href*="/filter/year/"], a[href*="type=year"][href*="xf="]');
        for (var index = 0; index < anchors.length; index++) {
            var year = clean(anchors[index].textContent);
            if (/^\d{4}$/.test(year)) return year;
            var match = anchors[index].getAttribute('href').match(/(?:\/filter\/year\/|[?&]xf=)(\d{4})(?=[/#?&]|$)/i);
            if (match) return match[1];
        }
        var info = clean(node.textContent).match(/Год(?:\s+(?:выпуска|выхода))?\s*:?\s*(\d{4})/i);
        return info ? info[1] : '';
    }

    function cardYear(card) {
        var year = card.release_year || (card.release_date || '').slice(0, 4) || (card.first_air_date || '').slice(0, 4);
        return /^\d{4}$/.test(year || '') ? year : '';
    }

    function basicCard(node, article, fallback) {
        var id = newsId(article);
        var joinedTitle = usableTitle(nodeText(node, '.title_left h1, .title_left > a, h1, h2')) || (fallback && fallback.title);
        if (!id || !joinedTitle) return null;
        var titles = joinedTitle.split(/\s*\/\s*/).map(clean).filter(Boolean);
        var mainTitle = titles.find(function (title) { return /[А-Яа-яЁё]/.test(title); }) || titles[0];
        var alternate = titles.filter(function (title) { return title !== mainTitle; }).join(' / ');
        var year = articleYear(node) || (fallback && cardYear(fallback)) || '';
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
            release_year: year,
            release_date: /^\d{4}$/.test(year) ? year + '-01-01' : '',
            poster: poster || (fallback && fallback.poster) || '',
            adult: isAdult,
            anistarReleased: releaseNote(node) || (fallback && fallback.anistarReleased) || '',
            restrict: isAdult ? 18 : 0
        };
    }

    function catalogMetrics(node) {
        var score = nodeText(node, '.rating').match(/(\d+(?:[.,]\d+)?)\s*\/\s*10/);
        var time = node.querySelector('time[datetime]');
        var dateIcon = node.querySelector('.date-icon');
        var date = (time && time.getAttribute('datetime')) || nodeText(node, '.date, .news_date, .date-icon') ||
            (dateIcon && clean(dateIcon.parentElement.textContent)) || '';
        var parts = date.match(/(\d{1,2})[.-](\d{1,2})[.-](\d{4})(?:\D+(\d{1,2}):(\d{2}))?/);
        var stamp = parts ? Date.UTC(+parts[3], +parts[2] - 1, +parts[1], +(parts[4] || 0), +(parts[5] || 0)) : Date.parse(date);
        var relative = date.match(/^(Сегодня|Вчера)\D+(\d{1,2}):(\d{2})/i);
        if (relative) {
            var today = new Date();
            stamp = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - (/^вчера/i.test(relative[1]) ? 1 : 0), +relative[2], +relative[3]);
        }
        function counter(selector, attributes) {
            var item = node.querySelector(selector);
            if (!item) return null;
            var value = attributes.map(function (name) { return item.getAttribute(name); }).find(function (entry) { return entry !== null; });
            var digits = String(value === undefined ? item.textContent : value).replace(/[^\d]/g, '');
            return digits ? Number(digits) : null;
        }
        var views = counter('.news_read, .news-read, .views, [data-count-views], [data-views], [itemprop="userInteractionCount"]',
            ['data-count-views', 'data-views', 'content']);
        var comments = counter('.comm_num, .news-comments, a[href*="#comment"], [data-comments], [itemprop="commentCount"]',
            ['data-comments', 'content']);
        return { rating: Number(nodeText(node, '[itemprop="ratingValue"]').replace(',', '.')) || (score ? Number(score[1].replace(',', '.')) : 0), date: Number.isFinite(stamp) ? stamp : 0,
            news_read: views, comm_num: comments };
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
            card.anistarSort = catalogMetrics(node);
            card.posterFallback = card.poster;
            card.poster = SITE + '/uploads/posters/' + id + '/original.jpg';
            rows.set(id, { card: card, genres: titleGenres(node.querySelector('.head') || node), categories: cardCategories(node) });
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

    function cardCategories(node) {
        return Array.from(node.querySelectorAll('.tags a[href], .category a[href]'), function (link) {
            return siteUrl(link.getAttribute('href'));
        });
    }

    function catalogPage(doc, url, personal) {
        var animeCatalog = CATALOG_PATH.test(sitePath(url));
        var root = doc.querySelector('#dle-content') || ((animeCatalog || personal || doc.querySelector('.news, .shortstory')) && doc);
        if (!root) throw new Error('AniStar не вернул каталог.');
        var rows = [];
        var seen = new Set();
        Array.prototype.forEach.call(root.querySelectorAll('.news, .shortstory, .fullstory'), function (node) {
            var link = node.querySelector('.title_left > a[href], .title_left h2 a[href], .title_left h3 a[href], .short-title a[href]');
            var card = link && basicCard(node, siteUrl(link.getAttribute('href'), url));
            if (!card || seen.has(card.id)) return;
            seen.add(card.id);
            card.anistarSort = catalogMetrics(node);
            if (animeCatalog) {
                card.posterFallback = card.poster;
                card.poster = SITE + '/uploads/posters/' + newsId(card.url) + '/original.jpg';
            }
            rows.push({ card: card, genres: titleGenres(node.querySelector('.head') || node),
                categories: cardCategories(node) });
        });
        if (!rows.length) rows = legacyCatalogRows(root, url);
        var link = root.querySelector('.pagenav .r a[href], a[rel~="next"]');
        var next = link && siteUrl(link.getAttribute('href'), url);
        if (animeCatalog && animePageNumber(next) <= animePageNumber(url)) next = nextAnimePage(doc, url);
        return { rows: rows, next: next && next !== url ? next : '' };
    }

    function yearUrl(year) {
        return SITE + '/filter/year/' + year + '/';
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

    function routeIsGenre(url) {
        var path = sitePath(url);
        return /^\/filter\/janrs\//i.test(path) || GENRES.some(function (entry) { return path === '/' + entry[1] + '/'; });
    }

    function yearCatalog(state) {
        return state.year && !state.query && (!state.anistarRoute || routeIsGenre(state.anistarRoute));
    }

    function catalogStart(state) {
        if (state.anistarList) return SITE + state.anistarList.path;
        if (state.query) return 1;
        if (yearCatalog(state)) return yearUrl(state.year);
        if (state.anistarRoute) return siteUrl(state.anistarRoute);
        return (state.year && yearUrl(state.year)) || (state.genre && siteUrl(state.genre)) || SITE + '/anime/';
    }

    function sortForm(doc, address) {
        var element = doc.querySelector('#news_set_sort');
        if (!element) return null;
        var url = siteUrl(element.getAttribute('action') || address, address);
        var fields = Object.create(null);
        Array.prototype.forEach.call(element.querySelectorAll('input[name]'), function (input) {
            fields[input.name] = input.value;
        });
        if (!url || !fields.set_new_sort || !fields.set_direction_sort) return null;
        return { url: url, fields: fields };
    }

    function sortOptions(sort, formData, jar) {
        var fields = Object.assign({}, formData.fields, { dlenewssortby: sort.key, dledirection: sort.direction });
        return { body: form(fields), auth: true, cookieJar: jar, headers: android() ? { Referer: formData.url } : {} };
    }

    function searchUrl(state, page) {
        var url = SITE + SEARCH_PATH + searchEncode(state.query) + '&skin_name=new36';
        if (page === 1) return url;
        return url + '&' + form({ search_start: page, result_from: (page - 1) * SEARCH_PAGE_SIZE + 1 });
    }

    function rememberGenres(rows) {
        rows.forEach(function (row) {
            row.genres.forEach(function (genre) { genreIndex.set(genre.url, genre); });
        });
    }

    function readBookmarkPage(url) {
        var saved = bookmarkPages.get(url);
        if (saved) return saved;
        var pending = accountDocument(url).then(function (doc) { return catalogPage(doc, url, true); });
        bookmarkPages.set(url, pending);
        pending.catch(function () {
            if (bookmarkPages.get(url) === pending) bookmarkPages.delete(url);
        });
        return pending;
    }

    function sortApplied(doc, sort) {
        var key = doc.querySelector('#news_set_sort input[name="dlenewssortby"]');
        var direction = doc.querySelector('#news_set_sort input[name="dledirection"]');
        if (key && key.value && direction && direction.value) {
            return key.value.toLowerCase() === sort.key && direction.value.toLowerCase() === sort.direction;
        }
        var active = doc.querySelector('#news_set_sort .sort-actv[onclick]');
        var choice = active && active.getAttribute('onclick').match(/dle_change_sort\(\s*['"](\w+)['"]\s*,\s*['"](asc|desc)['"]/i);
        if (!choice || choice[1].toLowerCase() !== sort.key) return false;
        var image = doc.querySelector('#news_set_sort img[src*="asc.gif"], #news_set_sort img[src*="desc.gif"]');
        var iconDirection = image && image.getAttribute('src').match(/\b(asc|desc)\.gif/i);
        return iconDirection ? iconDirection[1].toLowerCase() === sort.direction : choice[2].toLowerCase() !== sort.direction;
    }

    function compareCards(state, left, right) {
        var sort = SORT[state.sort] || SORT[0];
        var a = left.anistarSort || {};
        var b = right.anistarSort || {};
        if (sort.key === 'news_read' || sort.key === 'comm_num') {
            if (a[sort.key] == null && b[sort.key] != null) return 1;
            if (b[sort.key] == null && a[sort.key] != null) return -1;
        }
        var compared = sort.key === 'title' ? left.title.localeCompare(right.title, 'ru') : (a[sort.key] || 0) - (b[sort.key] || 0);
        if (!compared && sort.key === 'date') compared = Number(left.id.split(':').pop()) - Number(right.id.split(':').pop());
        return sort.direction === 'asc' ? compared : -compared;
    }

    function readCatalogPage(cursor, state) {
        if (state.anistarList) return readBookmarkPage(siteUrl(cursor));
        var url = state.query ? searchUrl(state, cursor) : desktopUrl(cursor);
        var sorting = Boolean(!state.query && state.sortApplied);
        var sort = SORT[state.sort] || SORT[0];
        var plan;
        if (sorting) {
            plan = sortPlans.get(state) || { jar: new Map(nativeCookies), mode: '' };
            sortPlans.set(state, plan);
        }
        var backup = yearCatalog(state) && cursor === yearUrl(state.year) ?
            desktopUrl(SITE + '/index.php?' + form({ do: 'xfsearch', xf: state.year, type: 'year', r: 'anime' })) : '';

        function read(doc, address) {
            var page = catalogPage(doc, address, Boolean(state.query));
            if (state.query) {
                var next = doc.querySelector('#nextlink[onclick], #nextlink [onclick], .pagenav .r [onclick]');
                var match = next && next.getAttribute('onclick').match(/list_submit\(\s*['"]?(\d+)/);
                var linked = page.next && Number(new URL(page.next).searchParams.get('search_start'));
                var nextPage = match ? Number(match[1]) : linked;
                page.next = nextPage > cursor ? nextPage : 0;
            }
            if (/^\/hentai(?:\/|$)/i.test(sitePath(address))) page.rows.forEach(function (row) {
                row.card.adult = true;
                row.card.restrict = 18;
            });
            if (yearCatalog(state)) page.rows.forEach(function (row) {
                if (!row.card.release_year) {
                    row.card.release_year = String(state.year);
                    row.card.release_date = row.card.release_year + '-01-01';
                }
            });
            rememberGenres(page.rows);
            return page;
        }

        function fetchPage(address) {
            function ordinary() { return pageDocument(address, { plainGet: true }); }
            function sortedGet() { return pageDocument(freshUrl(address), { auth: true, cookieJar: plan.jar }); }
            function browserOrder(page) {
                return page.rows.map(function (row) { return row.card.id; }).join(',');
            }
            function local(page) {
                page.localSort = true;
                return page;
            }

            if (!sorting) return ordinary().then(function (doc) { return read(doc, address); });
            if (plan.mode === 'local') return ordinary().then(function (doc) { return local(read(doc, address)); });
            if (plan.mode === 'server') {
                return sortedGet().then(function (doc) {
                    var page = read(doc, address);
                    if (sortApplied(doc, sort)) return page;
                    plan.mode = 'local';
                    return local(page);
                });
            }
            return ordinary().then(function (doc) {
                var baseline = read(doc, address);
                var fields = sortForm(doc, address);
                if (!fields) { plan.mode = 'local'; return local(baseline); }
                return pageDocument(fields.url, sortOptions(sort, fields, plan.jar)).then(function (response) {
                    return sortedGet().catch(function () { return response; });
                }).then(function (sorted) {
                    var page = read(sorted, address);
                    if (sortApplied(sorted, sort) && page.rows.length &&
                        (browserOrder(page) !== browserOrder(baseline) || sortApplied(doc, sort))) {
                        plan.mode = 'server';
                        return page;
                    }
                    plan.mode = 'local';
                    return local(baseline);
                }).catch(function () { plan.mode = 'local'; return local(baseline); });
            });
        }

        function fallback() {
            if (plan) plan.mode = '';
            return fetchPage(backup);
        }
        return fetchPage(url).then(function (page) {
            return backup && !page.rows.length ? fallback() : page;
        }, function (error) {
            if (backup) return fallback();
            throw error;
        });
    }

    function readGenreDirectory(doc) {
        var links = [];
        Array.prototype.forEach.call(doc.querySelectorAll('.news .head, .shortstory .head'), function (head) {
            titleGenres(head).forEach(function (entry) {
                if (!links.some(function (genre) { return genre.url === entry.url; })) links.push(entry);
            });
        });
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

    function initGenres() {
        GENRES.forEach(function (entry) {
            var url = SITE + '/' + entry[1] + '/';
            genreIndex.set(url, { url: url, title: entry[0] });
        });
        var cached = Lampa.Storage.get(hostStorageKey(GENRE_CACHE), {});
        if (cached && Array.isArray(cached.items)) cached.items.forEach(function (entry) {
            var url = siteUrl(entry.url);
            if (url && !genreIndex.has(url)) genreIndex.set(url, { url: url, title: entry.title });
        });
    }

    function refreshGenres() {
        if (!genreRefresh) {
            var origin = SITE;
            genreRefresh = pageDocument(desktopUrl(SITE + '/filter/janrs/'), { plainGet: true }).then(function (doc) {
                if (origin !== SITE) return;
                var genres = readGenreDirectory(doc);
                if (!genres.length) throw new Error('AniStar не вернул справочник жанров.');
                genres.forEach(function (genre) { genreIndex.set(genre.url, genre); });
                Lampa.Storage.set(hostStorageKey(GENRE_CACHE), { items: Array.from(genreIndex.values()) });
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

    function normalizeGenre(value) {
        return clean(value).toLowerCase().replace(/ё/g, 'е').replace(/[\s‐–—-]+/g, ' ');
    }

    function matchesGenre(row, url) {
        var genre = genreIndex.get(siteUrl(url));
        var path = sitePath(url).toLowerCase().replace(/\/$/, '');
        return (path === '/hentai' && row.card.adult) || row.genres.some(function (entry) {
            return sitePath(entry.url).toLowerCase().replace(/\/$/, '') === path ||
                (genre && normalizeGenre(entry.title) === normalizeGenre(genre.title));
        }) || (row.categories || []).some(function (category) {
            var categoryPath = sitePath(category).toLowerCase().replace(/\/$/, '');
            return categoryPath === path || categoryPath === '/anime' + path;
        });
    }

    function filtered(row, state) {
        if (state.year && row.card.release_year && row.card.release_year !== String(state.year)) return false;
        if (state.year && !yearCatalog(state) && !row.card.release_year) return false;
        if (yearCatalog(state) && routeIsGenre(state.anistarRoute) && !matchesGenre(row, state.anistarRoute)) return false;
        if (!state.genre || (!state.query && !state.year && !state.anistarRoute)) return true;
        return matchesGenre(row, state.genre);
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
            list.localSort = list.localSort || page.localSort;
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
        var pages = state.year && (state.genre || state.anistarRoute) ? 5 : (page === 1 ? 2 : 1);
        var work = page === 1 && list.cards.length ? Promise.resolve() : fillList(state, list, pages);
        work.then(function () {
            if (state.activity && state.activity.component.destroyed) return;
            list.shown = list.cards.length;
            var results = list.cards.slice(start);
            if (list.localSort) results.sort(compareCards.bind(null, state));
            success({ page: page, results: results, sortOrder: list.localSort ? list.cards.slice().sort(compareCards.bind(null, state)) : null,
                total_pages: page + (list.next ? 1 : 0),
                message: emptyMessage(list) });
        }).catch(function (error) {
            if (state.activity && state.activity.component.destroyed) return;
            if (page > 1 && Number(state.page) === page) state.page = page - 1;
            failure(error);
        });
    }

    function ownsScreen(state, component) {
        var active = Lampa.Activity.active();
        return Boolean(active && active.source === SOURCE &&
            (active === state || (component && active.activity && active.activity.component === component)));
    }

    function listState(title, options) {
        return Object.assign({ title: title, component: 'anistar_catalog', source: SOURCE, page: 1, url: '' }, options);
    }

    function openList(title, options) {
        var origin = Lampa.Activity.active();
        if (!origin || origin.source !== SOURCE || !origin.activity || origin.anistarLoading) return;
        var state = listState(title, options);
        var list = getList(state);
        origin.anistarLoading = true;
        Lampa.Controller.toggle('content');
        origin.activity.loader(true);
        var combined = (state.query && (state.year || state.genre)) || (state.year && state.genre) ||
            (state.anistarRoute && (state.year || state.genre));
        settle(fillList(state, list, combined ? 8 : 1).then(function () {
            if (list.localSort && list.cards.length && list.next && Lampa.Activity.active() === origin) {
                return fillList(state, list, 1).catch(function () {});
            }
        }).then(function () {
            if (Lampa.Activity.active() !== origin) return;
            if (!list.cards.length) Lampa.Noty.show(emptyMessage(list));
            else {
                if (list.localSort && !list.cards.some(function (card) {
                    var field = (SORT[state.sort] || SORT[0]).key;
                    return field === 'title' || field === 'date' || (card.anistarSort && card.anistarSort[field] != null);
                })) Lampa.Noty.show('Сайт не меняет порядок и не публикует счётчики для этой сортировки.');
                origin.activity.loader(false);
                if (origin.anistarResults && state.anistarResults) Lampa.Activity.replace(state, true);
                else Lampa.Activity.push(state);
            }
        }).catch(function (error) {
            if (Lampa.Activity.active() === origin) Lampa.Noty.show(error.message);
        }), function () {
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
        var itemsById = new Map();
        var focused = null;
        var loading = false;
        var total = 1;
        var running = false;
        var destroyed = false;
        var metadataQueue = [];
        var metadataRunning = 0;
        scroll.append(root);

        function refreshFocus() {
            if (!running || destroyed || Lampa.Controller.enabled().name !== 'content') return;
            Lampa.Controller.collectionSet(root, false, true);
            var target = focused && root[0].contains(focused) ? focused : root.find('.selector')[0];
            if (target) Lampa.Controller.collectionFocus(target, root, true);
        }

        function loadMetadata() {
            while (!destroyed && running && ownsScreen(object, component) && metadataRunning < 3 && metadataQueue.length) {
                var queued = metadataQueue.shift();
                metadataRunning += 1;
                updateYear(queued);
            }
        }

        function updateYear(queued) {
            settle(readArticleMetadata(queued.card.url).then(function (metadata) {
                if (destroyed || !metadata.year) return;
                queued.card.release_year = metadata.year;
                queued.card.release_date = metadata.year + '-01-01';
                queued.card.anistarReleased = queued.card.anistarReleased || metadata.note;
                queued.element.text(metadata.year);
            }).catch(function () {}), function () {
                metadataRunning -= 1;
                loadMetadata();
            });
        }

        function append(data) {
            if (ids.has(data.id)) return;
            ids.add(data.id);
            var item = catalogTemplate('card', '.card__img',
                '<div class="card selector"><div class="card__view"><img class="card__img"></div><div class="card__title"></div><div class="card__age"></div></div>');
            item.addClass('card--loaded selector anistar-catalog-card');
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
            var label = item.find('.card__title').first().text(data.title);
            item.find('.card__age').remove();
            var age = $('<div class="anistar-card-year"></div>').text(cardYear(data));
            if (label.length) label.after(age);
            else item.append(age);
            if (!cardYear(data)) metadataQueue.push({ card: data, element: age });
            item.appendTo(grid);
            itemsById.set(data.id, item);
            item.on('hover:long', function () { chooseStatus(data); });
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
                if (page.sortOrder) page.sortOrder.forEach(function (card) { grid.append(itemsById.get(card.id)); });
                if (initial && !page.results.length && ownsScreen(object, component)) Lampa.Noty.show(page.message);
                if (initial) component.activity.loader(false);
                refreshFocus();
                loadMetadata();
                loading = false;
                if (initial && page.results.length && page.results.length < PAGE_SIZE) next();
            }, function (error) {
                loading = false;
                if (destroyed) return;
                if (initial) component.activity.loader(false);
                if (running && ownsScreen(object, component)) Lampa.Noty.show(error.message || 'Список недоступен.');
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
            loadMetadata();
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

    function genreOptions() {
        var known = new Map();
        genreIndex.forEach(function (entry) {
            var key = entry.title.toLowerCase().replace(/ё/g, 'е');
            if (!known.has(key)) known.set(key, entry);
        });
        var items = Array.from(known.values()).sort(function (left, right) {
            return left.title.localeCompare(right.title, 'ru', { sensitivity: 'base' });
        }).map(function (entry) {
            return { title: escapeHtml(entry.title), value: entry.url };
        });
        items.unshift({ title: 'Все', value: '' });
        return items;
    }

    function homeGenre() {
        var saved = Lampa.Storage.get(hostStorageKey(HOME_GENRE), null);
        var url = saved && siteUrl(saved.url);
        if (!url || !saved.title) return null;
        if (!genreIndex.has(url)) genreIndex.set(url, { url: url, title: saved.title });
        return genreIndex.get(url);
    }

    function homeState(useDefault) {
        var genre = useDefault && homeGenre();
        var values = Object.assign({}, defaultFilters, { genre: genre ? genre.url : '' });
        return listState(NAME, Object.assign({ anistarHome: true, anistarFilters: values }, values));
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
                render();
            }, render);
        }

        function search() {
            editText({ title: 'Поиск по AniStar', value: draft.query, keyboard: 'lampa', layout: 'clarify', align: 'center' },
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
            $('.settings-input').last().addClass('anistar-search-keyboard');
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
            choose('Жанры', 'genre', genreOptions());
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
                Lampa.Activity.replace(homeState(false), true);
                return;
            }
            openList(activity.anistarRoute ? activity.title : 'Каталог AniStar', Object.assign({
                anistarResults: true, anistarRoute: activity.anistarRoute, anistarFilters: draft
            }, draft));
        }

        function reset() {
            if (Lampa.Activity.active() === activity) Lampa.Activity.replace(homeState(true), true);
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
        var menu = logout && logout.closest('ul, .login, .loginbox, .login-box');
        var profile = menu && menu.querySelector('a[href*="/user/"]');
        var accountName = loginName();
        if (!profile && logout && accountName) profile = Array.prototype.find.call(doc.querySelectorAll('a[href*="/user/"]'), function (link) {
            return clean(link.textContent).toLowerCase() === accountName.toLowerCase();
        });
        var profileUrl = profile && siteUrl(profile.getAttribute('href'));
        var logoutUrl = logout && siteUrl(logout.getAttribute('href'));
        var match = profileUrl && new URL(profileUrl).pathname.match(/^\/user\/([^/]+)\/?$/);
        return match && logoutUrl ? { name: decodeURIComponent(match[1]), logout: logoutUrl } : null;
    }

    function articleSettings(doc, movie) {
        var id = String(newsId(movie.url));
        var active = doc.querySelector('.anime_status .status_val');
        var label = active && clean(active.textContent).toLowerCase();
        var option = Array.from(doc.querySelectorAll('.anime_status .selected_form [data-value]')).find(function (item) {
            return label && clean(item.textContent).toLowerCase() === label;
        });
        var status = active && active.getAttribute('data-value');
        var value = status !== null && status !== undefined && /^\d$/.test(status) ? Number(status) : option && Number(option.getAttribute('data-value'));
        var favorite = doc.getElementById('fav-id-' + id);
        var controls = Array.from(doc.querySelectorAll('a[href*="doaction="], [onclick*="doFavorites"]'));
        if (favorite) controls.unshift(favorite);
        var favoriteState;
        controls.some(function (control) {
            var anchor = control.matches('a[href]') ? control : control.querySelector('a[href]');
            var href = anchor && siteUrl(anchor.getAttribute('href'), movie.url);
            if (!href) return false;
            var url = new URL(href);
            var action = url.searchParams.get('doaction');
            if (url.searchParams.get('do') !== 'favorites' || url.searchParams.get('id') !== id || !/^(add|del)$/.test(action)) return false;
            favoriteState = action === 'del';
            return true;
        });
        if (favoriteState === undefined) controls.some(function (control) {
            var handler = control.getAttribute('onclick') || '';
            var args = handler.match(/doFavorites\(\s*['"]?(\d+)['"]?\s*,\s*['"](plus|minus)['"]/i);
            if (!args || args[1] !== id) return false;
            favoriteState = args[2].toLowerCase() === 'minus';
            return true;
        });
        return { status: value, favorite: favoriteState };
    }

    function bookmarkContains(entry, movie) {
        var seen = new Set();
        var id = newsId(movie.url);
        function find(url) {
            if (!url || seen.has(url)) return Promise.resolve(false);
            seen.add(url);
            return readBookmarkPage(url).then(function (page) {
                return page.rows.some(function (row) { return newsId(row.card.url) === id; }) || find(page.next);
            });
        }
        return find(SITE + entry.path);
    }

    function currentBookmarks(doc, movie) {
        var current = articleSettings(doc, movie);
        var favorite = bookmarkContains(STATUS[0], movie).catch(function () {
            return current.favorite;
        });
        var status = current.status > 0 ? Promise.resolve(current.status) :
            Promise.all(STATUS.slice(1).map(function (entry) {
                return bookmarkContains(entry, movie).then(function (found) { return found ? entry.id : 0; }, function () { return 0; });
            })).then(function (ids) { return ids.find(Boolean) || 0; });
        return Promise.all([favorite, status]).then(function (values) {
            current.favorite = values[0] === true;
            current.status = values[1];
            return current;
        });
    }

    function setFavorite(movie, desired) {
        var id = newsId(movie.url);
        var options = { auth: true, headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: desktopUrl(movie.url) } };
        var endpoint = SITE + '/engine/ajax/favorites.php?' + form({
            fav_id: id, action: desired ? 'plus' : 'minus', skin: 'new36', _: Date.now()
        });
        return request(endpoint, options).catch(function () { return favoriteLink(movie, desired); });
    }

    function favoriteLink(movie, desired) {
        var url = SITE + '/index.php?' + form({ do: 'favorites', doaction: desired ? 'add' : 'del', id: newsId(movie.url) });
        return request(url, { auth: true, headers: { Referer: desktopUrl(movie.url) } });
    }

    function openAccountSettings() {
        function open() {
            Lampa.Controller.toggle('settings');
            Lampa.Settings.create(SOURCE);
        }
        if (Lampa.ParentalControl && typeof Lampa.ParentalControl.personal === 'function') {
            Lampa.ParentalControl.personal('settings', open, false, true);
        } else open();
    }

    function chooseStatus(movie) {
        var activity = Lampa.Activity.active();
        var controller = Lampa.Controller.enabled().name;

        function restore() {
            if (Lampa.Activity.active() === activity) Lampa.Controller.toggle(controller);
        }

        function prompt() {
            Lampa.Select.show({ title: 'Статусы', items: [{ title: LOGIN_PROMPT }],
                onSelect: openAccountSettings, onBack: restore });
        }

        if (!session && !loginName()) { prompt(); return; }
        bookmarkPages.clear();
        accountDocument(movie.url).then(function (doc) {
            if (Lampa.Activity.active() === activity) return currentBookmarks(doc, movie);
        }).then(function (current) {
            if (!current || Lampa.Activity.active() !== activity) return;
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
                            headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: desktopUrl(movie.url) }, auth: true
                        })
                        : setFavorite(movie, desired);
                    pending = true;
                    function verify() {
                        bookmarkPages.clear();
                        return accountDocument(movie.url).then(function (updated) {
                            return currentBookmarks(updated, movie);
                        }).then(function (bookmarks) {
                            current = bookmarks;
                            var actual = entry.id ? current.status === entry.id : current.favorite;
                            if (!entry.id || actual === desired) return actual;
                            return bookmarkContains(entry, movie).then(function (found) {
                                if (found) current.status = entry.id;
                                else if (current.status === entry.id) current.status = 0;
                                return found;
                            });
                        });
                    }
                    settle(update.then(verify).then(function (actual) {
                        if (!entry.id && actual !== desired) return favoriteLink(movie, desired).then(verify);
                        return actual;
                    }).then(function (actual) {
                        items.forEach(function (row) {
                            row.checked = row.entry.id ? row.entry.id === current.status : current.favorite;
                            var element = elements.get(row.entry.path);
                            if (element) element.toggleClass('selectbox-item--checked', row.checked);
                        });
                        if (actual !== desired) {
                            throw new Error('AniStar не подтвердил изменение статуса.');
                        }
                    }).catch(function (error) {
                        Lampa.Noty.show(error.message);
                    }), function () {
                        pending = false;
                    });
                }
            });
        }).catch(function (error) {
            if (Lampa.Activity.active() !== activity) return;
            if (error.message === LOGIN_PROMPT) prompt();
            else Lampa.Noty.show(error.message);
        });
    }

    function installSettings() {
        var rows = {};
        var busy = false;

        function render() {
            var values = { login: loginName(), password: loginPassword() ? '********' : '', profile: session ? session.name : '', home: (homeGenre() || {}).title || 'Все', address: SITE };
            Object.keys(rows).forEach(function (key) {
                var personal = key === 'profile' || key === 'signout';
                rows[key].toggleClass('hide', key !== 'address' && key !== 'home' && personal !== Boolean(session));
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
            if (!loginName() || !loginPassword()) {
                Lampa.Noty.show('Введите логин и пароль AniStar.');
                return;
            }
            busy = true;
            settle(loginAccount().then(function () {
                render();
                focus('signout');
                Lampa.Noty.show('Вы вошли в AniStar.');
            }).catch(function (error) {
                Lampa.Noty.show(error.message);
            }), function () { busy = false; render(); });
        }

        function signOut() {
            if (busy || !session) return;
            busy = true;
            settle(pageDocument(session.logout, { auth: true }).then(function (doc) {
                if (readSession(doc)) throw new Error('AniStar не завершил сеанс.');
                nativeCookies.clear();
                setSession(null);
                Lampa.Storage.set(hostStorageKey(ACCOUNT_PASSWORD), '');
                render();
                focus('login');
            }).catch(function (error) {
                Lampa.Noty.show(error.message);
            }), function () { busy = false; });
        }

        function row(key, label, action) {
            Lampa.SettingsApi.addParam({
                component: SOURCE,
                param: { name: SOURCE + '_account_' + key, type: action ? 'button' : 'static' },
                field: { name: label },
                onChange: action,
                onRender: function (item) {
                    rows[key] = item;
                    item.addClass('anistar-settings-row');
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
            editText({ title: 'Логин', value: loginName(), nomic: true }, function (value) {
                if (value !== null) Lampa.Storage.set(hostStorageKey(ACCOUNT_LOGIN), value.trim());
                render();
            });
        });
        row('password', 'Пароль', function () {
            if (busy) return;
            editText({ title: 'Пароль', value: loginPassword(), nomic: true }, function (value) {
                if (value !== null) Lampa.Storage.set(hostStorageKey(ACCOUNT_PASSWORD), value);
                render();
            });
        });
        row('signin', 'Выполнить вход', signIn);
        row('profile', 'Профиль');
        row('signout', 'Выйти из аккаунта', signOut);
        Lampa.SettingsApi.addParam({
            component: SOURCE, param: { name: SOURCE + '_more', type: 'title' }, field: { name: 'Еще' }
        });
        row('home', 'Главная страница по умолчанию', function () {
            var selected = homeGenre();
            refreshGenres();
            function restore() { Lampa.Controller.toggle('settings_component'); focus('home'); }
            optionMenu('Главная страница по умолчанию', genreOptions(), selected ? selected.url : '', function (value) {
                Lampa.Storage.set(hostStorageKey(HOME_GENRE), genreIndex.get(value) || null);
                render();
                restore();
            }, restore);
        });
        row('address', 'Актуальный адрес сайта', function () {
            if (busy) return;
            editText({ title: 'Актуальный адрес сайта', value: SITE === DEFAULT_SITE ? '' : SITE, free: true, nomic: true }, function (value) {
                if (value === null) return;
                var address = configuredOrigin(value);
                if (!address) {
                    Lampa.Noty.show('Введите адрес сайта, например https://anistar.org.');
                    return;
                }
                if (address === SITE) return;
                previousSite = SITE;
                SITE = address;
                session = null;
                loginWork = null;
                nativeCookies.clear();
                bookmarkPages.clear();
                lists = new WeakMap();
                watchPlaylists = new WeakMap();
                sortPlans = new WeakMap();
                articleMetadata.clear();
                genreRefresh = null;
                genreIndex.clear();
                Lampa.Storage.set(SITE_KEY, address === DEFAULT_SITE ? '' : address);
                restoreAccount();
                initGenres();
                var activity = Lampa.Activity.active();
                if (activity && activity.component === 'anistar_catalog' && activity.activity) {
                    activity.page = 1;
                    if (typeof activity.activity.refresh === 'function') activity.activity.refresh();
                }
                render();
                Lampa.Noty.show('Адрес AniStar сохранён.');
            });
        });
        Lampa.SettingsApi.addParam({
            component: SOURCE,
            param: { name: SOURCE + '_about', type: 'static' },
            field: { name: 'О плагине', description: 'Версия ' + VERSION }
        });
    }

    function titleGenres(head) {
        var entries = Array.from(head.querySelectorAll('li'));
        var row = entries.find(function (entry) { return /^Жанр(?:ы)?\s*:/i.test(clean(entry.textContent)); });
        return row || !entries.length ? readLinks(row || head, '/filter/janrs/') : [];
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
        var root = doc.querySelector('#dle-comments-list');
        if (!root) return [];
        var entries = new Set();
        Array.prototype.forEach.call(root.querySelectorAll('[id^="comm-id-"], .coment_text, .comment__text, .comment-body, .comment-content'), function (body) {
            var comment = body.closest('.comment, [id^="comment-id-"]') || body.parentElement;
            if (!comment || !root.contains(comment)) return;
            entries.add(comment);
        });
        return Array.from(entries, function (comment) {
            return {
                author: nodeText(comment, '.autor_nav a[href*="/user/"], .comment__author, .autor_nav, [itemprop="author"]') || 'Гость',
                date: nodeText(comment, '.scomment, .comment__date, .comment-date, time'),
                text: nodeText(comment, '[id^="comm-id-"], .coment_text, .comment__text, .comment-body, .comment-content'),
                anistarComment: true
            };
        }).filter(function (comment) { return comment.text; });
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

    function releaseNote(scope) {
        var explicit = scope.querySelectorAll('.reason, .release-note, .series-added, .news_reason');
        for (var index = 0; index < explicit.length; index++) {
            var text = clean(explicit[index].textContent);
            if (text) return text;
        }
        var paragraphs = scope.querySelectorAll('.news_text p, .full-text p, .descripts p, p, h3, h4');
        for (var row = 0; row < paragraphs.length; row++) {
            var note = clean(paragraphs[row].textContent);
            if (note.length < 260 && /^Добавлен[аоы]?\s/i.test(note) && /сер(?:ия|ии|ий)|эпизод|фильм|спешл/i.test(note)) return note;
        }
        return '';
    }

    function explicitDesktopUrl(value) {
        return desktopUrl(value) + '&action_skin_change=1';
    }

    function readArticleMetadata(url) {
        var address = siteUrl(url);
        var cached = articleMetadata.get(address);
        if (cached) return cached;
        function extract(doc) {
            var root = doc.querySelector('#dle-content') || doc;
            return { year: articleYear(root), note: releaseNote(root) };
        }
        var pending = pageDocument(desktopUrl(address), { plainGet: true }).then(function (doc) {
            var metadata = extract(doc);
            if (metadata.year) return metadata;
            return pageDocument(explicitDesktopUrl(address), { plainGet: true }).then(extract).catch(function () { return metadata; });
        });
        articleMetadata.set(address, pending);
        pending.then(function () {}, function () {
            if (articleMetadata.get(address) === pending) articleMetadata.delete(address);
        });
        return pending;
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
        if (!movie.release_year) {
            movie.release_year = articleYear(scope);
            if (movie.release_year) movie.release_date = movie.release_year + '-01-01';
        }
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
            genres: titleGenres(head),
            directors: readLinks(head, '/filter/director/'),
            authors: readLinks(head, '/filter/author/'),
            translation: labeledValue(root, /^Озвучка:/i),
            series: labeledValue(root, /^Серии:/i),
            released: releaseNote(root) || (content && releaseNote(content)) || movie.anistarReleased || releaseNote(doc),
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
        var options = session ? { auth: true } : { plainGet: true };
        pageDocument(desktopUrl(card.url), options).then(function (doc) {
            var movie = readArticle(doc, card);
            if ((movie.release_year && movie.anistar.released) || (component && component.destroyed)) return movie;
            return pageDocument(explicitDesktopUrl(card.url), options).then(function (alternate) {
                var updated = readArticle(alternate, card);
                if (!movie.release_year && updated.release_year) {
                    movie.release_year = updated.release_year;
                    movie.release_date = updated.release_date;
                }
                movie.anistar.released = movie.anistar.released || updated.anistar.released;
                return movie;
            }).catch(function () { return movie; });
        }).then(function (movie) {
            if (component && component.destroyed) return;
            if (movie.adult && !canWatch()) {
                failure();
                return;
            }
            var result = { movie: movie };
            if (movie.anistar.comments.length && Lampa.Maker && typeof Lampa.Maker.make === 'function') result.discuss = { result: movie.anistar.comments, anistarComments: true };
            success(result);
        }).catch(function (error) {
            if (component && component.destroyed) return;
            if (ownsScreen(object, component)) Lampa.Noty.show(error.message);
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
        settle(loadEpisodes(movie).then(function () {
            if (Lampa.Activity.active() !== origin) return;
            Lampa.Activity.push({
                component: VIEW, source: SOURCE, url: '', title: 'Онлайн · ' + decodeHtml(movie.title),
                movie: movie, episode: episode || 0, page: 1
            });
        }).catch(function (error) {
            if (Lampa.Activity.active() === origin) Lampa.Noty.show(error.message);
        }), function () {
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
        var movie = event.data && event.data.movie || event.props && event.props.get('movie');
        if (!movie || movie.source !== SOURCE || !movie.anistar) return;
        var details = movie.anistar;
        if (event.type === 'start' && event.link && typeof event.link.use === 'function') {
            event.link.use({ onInstance: function (line) {
                if (!line.data || !line.data.anistarComments) return;
                line.data.results = line.data.results.filter(function (entry) { return entry.anistarComment; });
                line.use({
                    onlyCreateAndAppend: function (entry) {
                        var review = Lampa.Maker.make('Discuss', { text: escapeHtml(entry.text), like_count: '',
                            params: { line: { full_text: false } } }, function (modules) { return modules.only('Line'); });
                        review.create();
                        var html = $(review.render(true));
                        styleComment(html, entry, false);
                        html.on('hover:enter', function () { openComments(movie); });
                        this.emit('append', review, entry);
                    },
                    onlyMore: function () { openComments(movie); }
                });
            } });
            return;
        }
        if (event.type !== 'build') return;
        var owner = event.item;
        if (event.name === 'description') {
            detailLinks(owner, 'Жанр', details.genres);
            detailLinks(owner, 'Производство', details.directors);
            detailLinks(owner, 'Автор', details.authors);
            if (details.comments.length && (!Lampa.Maker || typeof Lampa.Maker.make !== 'function')) {
                detailAction(owner, 'Комментарии', details.comments.length, function () { openComments(movie); });
            }
            return;
        }
        if (event.name !== 'start') return;

        var card = $(owner.html);
        var main = card.find('.full-start-new__details, .full-start__details').first();
        var title = card.find('.full-start-new__title, .full-start__title').first();
        var subtitle = card.find('.full-start-new__tagline, .full-start__tagline, .full--tagline').first();
        var year = movie.release_year || (movie.release_date || '').slice(0, 4);
        if (year) {
            var head = card.find('.full-start-new__head, .full-start__head').first();
            if (!head.length && title.length) {
                head = $('<div class="full-start-new__head"></div>');
                title.before(head);
            }
            if (head.length && head.text().indexOf(year) === -1) head.prepend($('<span></span>').text(year));
            head.removeClass('hide').show();
        }
        var genreText = details.genres.map(function (genre) { return genre.title; }).join(' | ');
        if (main.length) {
            main.empty();
            [details.series && 'Серии: ' + details.series, details.translation, genreText].filter(Boolean).forEach(function (value, index) {
                if (index) main.append($('<span class="full-start-new__split">●</span>'));
                main.append($('<span></span>').text(value));
            });
        }
        card.find('.full-start-new__title, .full-start-new__tagline').css({
            whiteSpace: 'normal', overflowWrap: 'anywhere'
        });
        card.find('.full-start-new__reactions').hide();
        var ratingBox = card.find('.full-start__rate.rate--tmdb');
        ratingBox.toggleClass('hide', !movie.vote_average).find('.source--name').text(NAME);
        var note = details.released || movie.anistarReleased;
        if (note) {
            var released = card.find('.anistar-released').first();
            if (!released.length) released = $('<div class="anistar-released"></div>');
            released.text(note);
            if (main.length) main.before(released);
            else if (subtitle.length) subtitle.after(released);
            else if (title.length) title.after(released);
        }
        var buttons = card.find('.full-start-new__buttons, .full-start__buttons').first();
        if (!buttons.length) return;

        var originalPlay = buttons.find('.button--play').first();
        var playIcon = originalPlay.find('svg')[0];
        var watch = fullAction('Смотреть', playIcon ? playIcon.outerHTML :
            '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m8 4 12 8-12 8z"/></svg>', function () {
            openWatch(movie);
        }, owner);
        var bookIcon = buttons.find('.button--book svg')[0];
        var favorite = fullAction('Избранное', bookIcon ? bookIcon.outerHTML :
            '<svg viewBox="0 0 24 24"><path d="M5 3h14v18l-7-4-7 4z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
            function () { chooseStatus(movie); }, owner);
        watch.on('hover:long', function () { chooseStatus(movie); });
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

    function streamFile(url, size) {
        // AniStar's public sfv stream uses an MP4 filename for an HLS manifest.
        var publicManifest = /^sfv\d*\.an-media\.org$/i.test(url.hostname) && /\.mp4$/i.test(url.pathname);
        var hls = publicManifest || /\.m3u8$/i.test(url.pathname);
        if (publicManifest && !/\.m3u8/i.test(url.href)) url.hash = 'anistar.m3u8';
        return { url: url.href, hls: hls, size: size, publicManifest: publicManifest };
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
            var sources = new Map();
            var sections = /\b(?:files|files_as|files_mp4)['"]?\s*:\s*\[((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\]'"\x5c])*)\]/g;
            var section;
            while ((section = sections.exec(block))) {
                var files = section[1].match(/\{(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^{}'"])*\}/g) || [];
                files.forEach(function (file) {
                    var size = Number((file.match(/\btitle['"]?\s*:\s*['"]?(\d+)/i) || [])[1]);
                    var stream = file.match(/\b(?:file|url)['"]?\s*:\s*(['"])(.*?)\1/i);
                    var url = stream && urlOf(playerText(stream[2]), base, true);
                    if (!url || !size) return;
                    var source = streamFile(url, size);
                    sources.set(source.url, source);
                });
            }
            var dub = (block.match(/\btype_dub['"]?\s*:\s*['"]?(\d+)/) || [])[1] || '';
            var imagePath = (block.match(/\b(?:image|poster|thumbnail)['"]?\s*:\s*['"]([^'"]+)['"]/) || [])[1];
            var image = imagePath && urlOf(playerText(imagePath), base);
            return Object.assign(identity, { mediaId: mediaId, dub: dub, image: image && image.href,
                files: Array.from(sources.values()).sort(function (left, right) { return right.size - left.size; }),
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

    function builtInSources(files) {
        var direct = files.filter(function (file) { return file.publicManifest; });
        var choices = direct.length ? direct : files;
        var unique = new Map();
        choices.forEach(function (file) {
            var prior = unique.get(file.size);
            if (!prior || (file.hls && !prior.hls)) unique.set(file.size, file);
        });
        return Array.from(unique.values()).sort(function (left, right) { return right.size - left.size; });
    }

    function play(movie, episode, episodes) {
        if (!episode.files.length) {
            Lampa.Noty.show('AniStar пока не вернул видео для этой серии.');
            return;
        }
        var preferred = String(Lampa.Storage.get('video_quality_default', '1080')).replace(/p$/i, '') + 'p';
        var activity = Lampa.Activity.active();
        function media(entry) {
            var choices = builtInSources(entry.files);
            var qualities = {};
            choices.forEach(function (file) { qualities[file.size + 'p'] = file.url; });
            var url = qualities[preferred] || choices[0].url;
            var available = choices.find(function (file) { return file.url === url; });
            var reserve = choices.find(function (file) { return file.url !== url; });
            if (!reserve && !available.publicManifest) reserve = entry.files.find(function (file) { return file.url !== url; });
            var data = {
                title: decodeHtml(movie.title) + ' / ' + entry.title,
                url: url, quality: qualities, launch_player: 'lampa',
                movie: movie, card: movie, season: entry.season,
                episode: entry.number === null ? 1 : entry.number, timeline: timeline(movie, entry)
            };
            if (reserve) data.url_reserve = reserve.url;
            return data;
        }
        var item = media(episode);
        var playlist = episodes.filter(function (entry) { return entry.files.length; }).map(media);
        item.playlist = playlist;
        playerOrigin = { data: item, activity: activity };
        if (typeof Lampa.Player.runas === 'function') Lampa.Player.runas('lampa');
        Lampa.Player.play(item);
        if (typeof Lampa.Player.playlist === 'function') Lampa.Player.playlist(playlist);
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
                var playable = builtInSources(entry.files);
                row.find('.season-episode__quality').text(playable.length ? playable[0].size + 'p' : 'Видео недоступно');
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

    function openComments(movie) {
        Lampa.Activity.push({ component: COMMENTS, source: SOURCE, title: 'Комментарии', page: 1, movie: movie, url: '' });
    }

    function styleComment(html, entry, full) {
        var text = !full && entry.text.length > 120 ? entry.text.slice(0, 120) + '…' : entry.text;
        html.find('.full-review__text').text(text);
        html.find('.full-review__footer').text([entry.author, entry.date].filter(Boolean).join(' · '));
        if (full) html.addClass('full-review--full-text');
    }

    function commentsComponent(object) {
        var component = rowComponent();
        component.use({
            onCreate: function () { this.build({ results: object.movie.anistar.comments }); },
            onlyCreateAndAppend: function (entry) {
                var row = catalogTemplate('full_review', '.full-review__text',
                    '<div class="full-review selector"><div class="full-review__text"></div><div class="full-review__footer"></div></div>');
                styleComment(row, entry, true);
                this.append(row);
            }
        });
        return component;
    }

    function installStyle() {
        $('<style></style>').text([
            '.anistar-action{gap:.6em}',
            '.anistar-action svg{width:1.4em;height:1.4em}',
            '.anistar-released{display:block;font-weight:700;font-size:1.14em;line-height:1.35;margin:0 0 1em}',
            '.anistar-catalog-card>.anistar-card-year{display:block;font-size:.9em;line-height:1.3;margin-top:.5em;opacity:.85}',
            '.anistar-catalog-card>.anistar-card-year:empty{display:none}',
            '.anistar-settings-row .settings-param__value{margin-top:.45em;overflow-wrap:anywhere}',
            '.anistar-search-keyboard.settings-input{position:fixed;inset:0;width:100%;height:100%;padding:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;transform:none;background:#202024;backdrop-filter:none}',
            '.anistar-search-keyboard .settings-input__content{position:relative;top:auto;right:auto;bottom:auto;left:auto;margin:0;transform:none;max-width:94vw;max-height:94vh;background:transparent;box-shadow:none}',
            '.anistar-online{display:flex;gap:1.5em;padding:0 1.5em;align-items:flex-start}',
            '.anistar-online__info{flex:0 0 27%;max-height:72vh;overflow:hidden}',
            '.anistar-online__info>img{display:block;width:6.5em;border-radius:.3em;margin:0 0 .8em}',
            '.anistar-online__info .season-info{background:transparent;padding:0}',
            '.anistar-online__episodes{min-width:0;flex:1}',
            '.anistar-online__source{background:rgba(255,255,255,.08);padding:.75em 1em;margin:0 0 2.4em;border-radius:.3em}',
            '.anistar-online__source.focus{outline:.18em solid currentColor}',
            '.anistar-online .season-episode__img img{object-fit:cover}',
            '@media(max-width:700px){.anistar-online__info{display:none}.anistar-online{padding:0 .7em}}'
        ].join('\n')).appendTo('head');
    }

    function init() {
        if (Lampa.Api.sources[SOURCE]) return;
        SITE = configuredOrigin(Lampa.Storage.get(SITE_KEY, '')) || DEFAULT_SITE;
        restoreAccount();
        initGenres();
        Lampa.Api.sources[SOURCE] = { list: loadList, full: loadFull, clear: function () {} };
        Lampa.Component.add('anistar_catalog', catalogComponent);
        Lampa.Component.add(VIEW, watchComponent);
        Lampa.Component.add(COMMENTS, commentsComponent);
        Lampa.Menu.addButton(ICON, NAME, function () {
            Lampa.Activity.push(homeState(true));
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
