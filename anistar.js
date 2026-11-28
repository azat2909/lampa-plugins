/*!
 * Anistar для Lampa
 * Версия 0.5.28
 */
(function () {
    'use strict';

    var SOURCE = 'anistar';
    var NAME = 'Anistar';
    var VERSION = '0.5.28';
    var DEFAULT_SITE = 'https://anistar.org';
    var DESKTOP_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    var SITE = DEFAULT_SITE;
    var previousSite = DEFAULT_SITE;
    var SITE_KEY = 'anistar_site_url';
    var HOME_SECTION = 'anistar_home_section';
    var HIDE_UNCOVERED = 'anistar_hide_uncovered';
    var ANIME_PATH = '/anime/';
    var HOME_SECTIONS = [{ title: 'Аниме', value: 'anime' }, { title: 'Хентай', value: 'hentai' }];
    var CATALOG_PATH = /^\/(anime|hentai)(?:\/page\/(\d+))?\/?$/i;
    var LEGACY_CARD = '.shortstory, .base, .news, .item, .anime-item, .movie-item, article, li';
    var VIEW = 'anistar_watch';
    var COMMENTS = 'anistar_comments';
    var FAVORITES = 'anistar_favorites';
    var PAGE_SIZE = 20;
    var MAX_PAGE_SIZE = 25;
    var SEARCH_PAGE_SIZE = 10;
    var SEARCH_PATH = '/?do=search&mode=advanced&subaction=search&titleonly=3&story=';
    var TIMEOUT = 18000;
    var ACCOUNT_LOGIN = 'anistar_login';
    var ACCOUNT_PASSWORD = 'anistar_password';
    var ACCOUNT_KEY = 'anistar_account_v1';
    var ACCOUNT_SIGNED_OUT = 'anistar_signed_out';
    var GENRE_CACHE = 'anistar_genres_v2';
    var LOGIN_PROMPT = 'Войдите в аккаунт в настройках Anistar';
    var ICON = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.9 6.1 6.7.9-4.8 4.8 1.1 6.7-5.9-3.2-5.9 3.2 1.1-6.7L2.4 9l6.7-.9z"/></svg>';
    var STATUS = [
        { title: 'Избранное', path: '/favorites/' },
        { title: 'Смотрю', path: '/status-anime/2/', id: 2 },
        { title: 'Просмотрено', path: '/status-anime/1/', id: 1 },
        { title: 'В планах', path: '/status-anime/3/', id: 3 },
        { title: 'Брошено', path: '/status-anime/4/', id: 4 }
    ];
    var FAVORITE_TABS = STATUS.filter(function (entry) { return entry.id !== 1; });
    var SORT = [
        ['По дате', 'date'],
        ['По популярности', 'rating'],
        ['По посещаемости', 'news_read'],
        ['По комментариям', 'comm_num'],
        ['По алфавиту', 'title']
    ].reduce(function (options, field) {
        return options.concat([
            { title: field[0] + ' ↓', key: field[1], direction: 'desc' },
            { title: field[0] + ' ↑', key: field[1], direction: 'asc' }
        ]);
    }, []);
    var GENRES = [
        ['Боевики','thriller'], ['Вампиры','vampires'], ['Гарем','ani-garem'], ['Детектив','detective'],
        ['Драма','drama'], ['История','history'], ['Киберпанк','cyberpunk'], ['Комедия','comedy'],
        ['Махо-седзе','maho-shoujo'], ['Меха','fur'], ['Мистика','mysticism'], ['Музыкальное','music'],
        ['Пародии','parodies'], ['Повседневность','everyday-life'], ['Приключения','adventures'],
        ['Романтика','romance'], ['Сёдзе','shoujo'], ['Сёнен','senen'], ['Сёнен-ай','senen-ay'],
        ['Спорт','sports'], ['Триллер','horror'], ['Ужасы','horor'], ['Фантастика','fantasy'],
        ['Фэнтези','fentezi'], ['Школа','school'], ['Эччи','echchi-erotic']
    ];
    var parser = new DOMParser();
    var genreIndex = new Map();
    var lists = new WeakMap();
    var defaultFilters = { sort: 0, year: '', genre: '', query: '' };
    var genreDirectories = { anime: new Map(), hentai: new Map() };
    var genreRefresh = {};
    var tizenDesktopSession;
    var playerOrigin;
    var session;
    var loginWork;
    var nativeCookies = new Map();
    var bookmarkPages = new Map();
    var bookmarkRevision = 0;
    var watchPlaylists = new WeakMap();
    var sortPlans = new WeakMap();
    var publicNotes = new Map();
    var catalogYears = new Map();
    var articleNotes = new Map();
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
        if (/[?&]skin_name=/i.test(url.search)) return url.href.replace(/([?&])skin_name=[^&]*/gi, '$1skin_name=new36');
        return url.href + (url.search ? '&' : '?') + 'skin_name=new36';
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
        bookmarkRevision += 1;
        persistAccount();
    }

    function persistAccount() {
        Lampa.Storage.set(hostStorageKey(ACCOUNT_KEY), session ? {
            name: session.name, logout: session.logout, cookies: Array.from(nativeCookies.entries())
        } : null);
    }

    function restoreAccount() {
        if (signedOut()) return;
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
            if (native) {
                var cookies = options.desktopSkin ? new Map(jar || []) : jar;
                if (options.desktopSkin) cookies.set('dle_skin', 'new36');
                if (cookies && cookies.size) {
                    headers.Cookie = Array.from(cookies, function (entry) { return entry.join('='); }).join('; ');
                }
            }
            if (body !== undefined) headers['Content-Type'] = 'application/x-www-form-urlencoded';
            var settings = { dataType: options.binary && native ? 'base64' : 'text', timeout: timeout };
            if (plainGet) {
                // Keep the request shape used by 0.4.55 on Android TV and Tizen.
                body = false;
            } else {
                settings.type = method;
                settings.headers = headers;
                settings.returnHeaders = native && Boolean(jar || options.returnHeaders || options.binary);
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
                        if (options.binary && response.encoding === 'base64') {
                            try {
                                var bytes = Uint8Array.from(atob(html), function (character) { return character.charCodeAt(0); });
                                var prefix = new TextDecoder().decode(bytes.subarray(0, 4096));
                                var charset = (prefix.match(/charset\s*=\s*['"]?([\w-]+)/i) || [])[1] || 'windows-1251';
                                html = new TextDecoder(charset).decode(bytes);
                            } catch (error) {
                                finish(reject, new Error('Не удалось прочитать кодировку страницы AniStar.'));
                                return;
                            }
                        }
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
    function signedOut() { return Lampa.Storage.get(hostStorageKey(ACCOUNT_SIGNED_OUT), false) === true; }

    function loginAccount(explicit) {
        if (!explicit && signedOut()) return Promise.reject(new Error(LOGIN_PROMPT));
        if (loginWork) return loginWork;
        var name = loginName();
        var password = loginPassword();
        if (!name || !password) return Promise.reject(new Error(LOGIN_PROMPT));
        var origin = SITE;
        var url = SITE + ANIME_PATH;
        var home = desktopDocument(freshUrl(url), { auth: true });
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
            return desktopRequest(desktopUrl(target), { body: form(fields), auth: true, headers: { Referer: url } }).then(function () {
                return desktopDocument(freshUrl(url), { auth: true });
            }).then(function (verified) {
                var account = readSession(verified);
                if (!account || account.name.toLowerCase() !== name.toLowerCase()) throw new Error('AniStar не подтвердил вход. Проверьте логин и пароль.');
                return account;
            });
        }).then(function (account) {
            if (origin !== SITE) throw new Error('Адрес AniStar изменился.');
            if (!explicit && signedOut()) throw new Error(LOGIN_PROMPT);
            if (explicit) Lampa.Storage.set(hostStorageKey(ACCOUNT_SIGNED_OUT), false);
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
        function get() { return desktopDocument(freshUrl(url), { auth: true }); }
        if (signedOut() || (!session && (!loginName() || !loginPassword()))) return Promise.reject(new Error(LOGIN_PROMPT));
        return get().then(function (doc) {
            if (signedOut()) throw new Error(LOGIN_PROMPT);
            var account = readSession(doc);
            if (account && (!loginName() || account.name.toLowerCase() === loginName().toLowerCase())) {
                if (!session) setSession(account);
                return doc;
            }
            if (origin !== SITE) throw new Error('Адрес AniStar изменился.');
            if (session) { nativeCookies.clear(); setSession(null); }
            return loginAccount().then(get).then(function (verified) {
                if (signedOut() || !readSession(verified)) throw new Error(LOGIN_PROMPT);
                return verified;
            });
        });
    }

    function logoutAccount() {
        return desktopRequest(desktopUrl(session.logout), { auth: true }, pageDocument).then(requireDesktopLayout).then(function (doc) {
            if (readSession(doc)) throw new Error('AniStar не завершил сеанс.');
            Lampa.Storage.set(hostStorageKey(ACCOUNT_SIGNED_OUT), true);
            nativeCookies.clear();
            setSession(null);
        });
    }

    function pageDocument(url, options) {
        function parse(html) {
            return parser.parseFromString(html, 'text/html');
        }
        return request(url, options).then(function (html) {
            if (android() && typeof TextDecoder === 'function' && !(options && options.body) &&
                /charset\s*=\s*['"]?windows-1251/i.test(html.slice(0, 4096)) && /\ufffd[^<]{0,30}\ufffd/.test(html)) {
                var retry = Object.assign({}, options, { plainGet: false, binary: true });
                return request(url, retry).then(parse, function () { return parse(html); });
            }
            return parse(html);
        });
    }

    function desktopRequestOptions(options) {
        if (!android()) return options;
        return Object.assign({}, options, { plainGet: false, desktopSkin: true,
            headers: Object.assign({}, options.headers, { 'User-Agent': DESKTOP_AGENT }) });
    }

    function isCompactLayout(doc) {
        return Boolean(doc.querySelector('link[href*="templates/smartphone/"], script[src*="templates/smartphone/"]'));
    }

    function requireDesktopLayout(doc) {
        if (isCompactLayout(doc)) throw new Error('AniStar вернул мобильную версию. Не удалось открыть полную версию сайта.');
        return doc;
    }

    function ensureTizenDesktop() {
        if (tizenDesktopSession) return tizenDesktopSession;
        // AniStar's “Полная версия сайта” link sets the desktop cookie for this origin.
        var pending = pageDocument(SITE + '/?action_skin_change=1&skin_name=new36', { auth: true }).then(requireDesktopLayout);
        tizenDesktopSession = pending;
        pending.catch(function () {
            if (tizenDesktopSession === pending) tizenDesktopSession = null;
        });
        return pending;
    }

    function tizenDesktopOptions(options) {
        return Object.assign({}, options, { plainGet: false, auth: true });
    }

    function desktopRequest(url, options, send) {
        send = send || request;
        if (android()) return send(url, desktopRequestOptions(options));
        if (!tizen()) return send(url, options);
        var origin = SITE;
        return ensureTizenDesktop().then(function () {
            if (origin !== SITE) throw new Error('Адрес AniStar изменился.');
            return send(url, tizenDesktopOptions(options));
        });
    }

    function tizenDesktopDocument(url, options) {
        var origin = SITE;
        var authenticated = tizenDesktopOptions(options);
        var sessionReady = ensureTizenDesktop();
        function load(address) {
            if (origin !== SITE) throw new Error('Адрес AniStar изменился.');
            return pageDocument(address, authenticated);
        }
        return sessionReady.then(function () {
            return load(url);
        }).then(function (doc) {
            if (!isCompactLayout(doc)) return doc;
            if (tizenDesktopSession === sessionReady) tizenDesktopSession = null;
            return ensureTizenDesktop().then(function () { return load(freshUrl(url)); }).then(requireDesktopLayout);
        });
    }

    function desktopDocument(url, options) {
        url = desktopUrl(url);
        if (tizen() && !android()) return tizenDesktopDocument(url, options);
        var desktop = desktopRequestOptions(options);
        var document = pageDocument(url, desktop).then(requireDesktopLayout);
        if (desktop === options) return document;
        return document.catch(function () {
            return pageDocument(url, options).then(requireDesktopLayout);
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
        var placeholder = '';
        for (var i = 0; i < attributes.length; i++) {
            var value = node.getAttribute(attributes[i]);
            var url = urlOf(value, article);
            if (!url) continue;
            if (hasCover(url.href)) return url.href;
            if (!placeholder) placeholder = url.href;
        }
        return placeholder;
    }

    function hideUncovered() {
        return String(Lampa.Storage.get(HIDE_UNCOVERED, false)) === 'true';
    }

    function hasCover(url) {
        return Boolean(url && !/\/(?:no[-_]?(?:image|poster|cover|photo)|img[-_]broken|placeholder|spacer|blank|lazyload|loading|1x1)(?:\.[a-z0-9]+)?(?:[?#]|$)/i.test(url));
    }

    function articleYear(node) {
        var scope = node.querySelector('.head, .news_head, .news-info') || node;
        var field = scope.querySelector('[data-year], [itemprop="datePublished"][content]');
        var value = (node.getAttribute && node.getAttribute('data-year')) ||
            (field && (field.getAttribute('data-year') || field.getAttribute('content')));
        if (/^\d{4}$/.test(value || '')) return value;
        var anchors = node.querySelectorAll('a[href*="/filter/year/"], a[href*="type=year"][href*="xf="]');
        for (var index = 0; index < anchors.length; index++) {
            var year = clean(anchors[index].textContent);
            if (/^\d{4}$/.test(year)) return year;
            var match = anchors[index].getAttribute('href').match(/(?:\/filter\/year\/|[?&]xf=)(\d{4})(?=[/#?&]|$)/i);
            if (match) return match[1];
        }
        var label = /Год(?:\s+(?:выпуска|выхода))?\s*:?\s*(\d{4})/i;
        var info = clean(scope.textContent).match(label) || (scope !== node && clean(node.textContent).match(label));
        return info ? info[1] : '';
    }

    function cardYear(card) {
        var year = card.release_year || (card.release_date || '').slice(0, 4) || (card.first_air_date || '').slice(0, 4);
        return /^\d{4}$/.test(year || '') ? year : '';
    }

    function articleRating(node) {
        var values = node.querySelectorAll('[itemprop="ratingValue"], [data-rating-value]');
        for (var index = 0; index < values.length; index++) {
            var field = values[index];
            var raw = clean(field.getAttribute('content') || field.getAttribute('data-rating-value') || field.textContent);
            if (!/^\d+(?:[.,]\d+)?$/.test(raw)) continue;
            var value = Number(raw.replace(',', '.'));
            if (value > 0 && value <= 10) return value;
        }
        var rating = nodeText(node, '.rating, .ratingtypeplusminus, .ratingtypeplusminus2');
        var score = rating.match(/(\d+(?:[.,]\d+)?)\s*\/\s*10/);
        var number = score ? Number(score[1].replace(',', '.')) : 0;
        return number > 0 && number <= 10 ? number : 0;
    }

    function articleIsHentai(node, fallback) {
        var genres = node.querySelector('.head') || node;
        return Boolean((fallback && fallback.anistarHentai) || hasCategory(node, /^(?:\/anime)?\/hentai\/?$/i) ||
            titleGenres(genres).some(function (genre) {
                return normalizeGenre(genre.title) === 'хентай' || /^\/filter\/janrs\/(?:хентай|hentai)$/.test(genrePath(genre.url));
            }));
    }

    function articleAge(node, fallback, hentai) {
        if (hentai) return 18;
        if (fallback && fallback.adult) return Math.max(18, fallback.anistarAge || 0);
        var genres = node.querySelector('.head') || node;

        var marks = node.querySelectorAll('[itemprop="contentRating"], [data-age], [data-age-rating], .age-rating, .age-limit');
        for (var index = 0; index < marks.length; index++) {
            var field = marks[index];
            var raw = clean(field.getAttribute('content') || field.getAttribute('data-age-rating') || field.getAttribute('data-age') || field.textContent);
            var mark = raw.match(/^(\d{1,2})\s*(?:\+|лет)?$/i);
            if (mark && Number(mark[1]) <= 21) return Number(mark[1]);
        }
        var label = clean(genres.textContent).match(/(?:Возраст(?:ное ограничение|ной рейтинг)?|Для зрителей)\s*:?\s*(?:от\s+)?(\d{1,2})(?!\d)/i);
        if (label && Number(label[1]) <= 21) return Number(label[1]);
        if (!fallback) return null;
        return fallback.anistarAge != null ? fallback.anistarAge : (fallback.restrict || null);
    }

    function basicCard(node, article, fallback) {
        var id = newsId(article);
        var joinedTitle = usableTitle(nodeText(node, '.title_left h1, .title_left > a, h1, h2')) || (fallback && fallback.title);
        if (!id || !joinedTitle) return null;
        var titles = joinedTitle.split(/\s*\/\s*/).map(clean).filter(Boolean);
        var mainTitle = titles.find(function (title) { return /[А-Яа-яЁё]/.test(title); }) || titles[0];
        var alternate = titles.filter(function (title) { return title !== mainTitle; }).join(' / ');
        var year = (fallback && cardYear(fallback)) || articleYear(node) || catalogYears.get(id) || '';
        var image = node.querySelector('img.main-img, img[itemprop="image"], .news_avatar img');
        var poster = posterUrl(image, article);
        var hentai = articleIsHentai(node, fallback);
        var age = articleAge(node, fallback, hentai);
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
            anistarHentai: hentai,
            adult: age >= 18,
            vote_average: articleRating(node) || (fallback && fallback.vote_average) || 0,
            anistarReleased: releaseNote(node) || (fallback && fallback.anistarReleased) || '',
            anistarAge: age,
            restrict: age || 0
        };
    }

    function catalogMetrics(node, rating) {
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
        return { rating: rating, date: Number.isFinite(stamp) ? stamp : 0,
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
            card.anistarSort = catalogMetrics(node, card.vote_average);
            card.posterFallback = card.poster;
            card.poster = SITE + '/uploads/posters/' + id + '/original.jpg';
            rows.set(id, { card: card, genres: titleGenres(node.querySelector('.head') || node), categories: cardCategories(node) });
        });
        return Array.from(rows.values());
    }

    function catalogPageNumber(url, section) {
        var address = siteUrl(url);
        if (!address) return 0;
        var page = new URL(address);
        var match = page.pathname.match(CATALOG_PATH);
        if (match) return match[1].toLowerCase() === section ? Number(match[2] || 1) : 0;
        if (page.pathname !== '/index.php' || page.searchParams.get('do') !== 'cat' || page.searchParams.get('category') !== section) return 0;
        var number = page.searchParams.get('cstart') || '1';
        return /^\d+$/.test(number) ? Number(number) : 0;
    }

    function nextSectionPage(doc, url, section) {
        var current = catalogPageNumber(url, section);
        var best = Infinity;
        Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (link) {
            var href = siteUrl(link.getAttribute('href'), url);
            var page = catalogPageNumber(href, section);
            if (page > current && page < best) best = page;
        });
        return best < Infinity ? sectionUrl(section) + 'page/' + best + '/' : '';
    }

    function cardCategories(node) {
        return Array.from(node.querySelectorAll('.tags a[href], .category a[href]'), function (link) {
            return siteUrl(link.getAttribute('href'));
        });
    }

    function catalogPage(doc, url, personal) {
        var section = catalogPageNumber(url, 'anime') ? 'anime' : catalogPageNumber(url, 'hentai') ? 'hentai' : '';
        var root = doc.querySelector('#dle-content') || ((section || personal || doc.querySelector('.news, .shortstory')) && doc);
        if (!root) throw new Error('AniStar не вернул каталог.');
        var rows = [];
        var seen = new Set();
        Array.prototype.forEach.call(root.querySelectorAll('.news, .shortstory, .fullstory'), function (node) {
            var link = node.querySelector('.title_left > a[href], .title_left h2 a[href], .title_left h3 a[href], .short-title a[href]');
            var card = link && basicCard(node, siteUrl(link.getAttribute('href'), url));
            if (!card || seen.has(card.id)) return;
            seen.add(card.id);
            card.anistarSort = catalogMetrics(node, card.vote_average);
            if (section === 'anime') {
                card.posterFallback = card.poster;
                card.poster = SITE + '/uploads/posters/' + newsId(card.url) + '/original.jpg';
            }
            rows.push({ card: card, genres: titleGenres(node.querySelector('.head') || node),
                categories: cardCategories(node) });
        });
        if (!rows.length) rows = legacyCatalogRows(root, url);
        rows.forEach(function (row) {
            if (section === 'hentai') {
                row.card.anistarHentai = true;
                row.card.adult = true;
                row.card.anistarAge = 18;
                row.card.restrict = 18;
            }
            if (row.card.release_year) catalogYears.set(newsId(row.card.url), row.card.release_year);
            if (row.card.anistarReleased) articleNotes.set(newsId(row.card.url), row.card.anistarReleased);
        });
        var link = root.querySelector('.pagenav .r a[href], a[rel~="next"]');
        var next = link && siteUrl(link.getAttribute('href'), url);
        if (section) {
            var nextPage = catalogPageNumber(next, section);
            next = nextPage > catalogPageNumber(url, section) ? sectionUrl(section) + 'page/' + nextPage + '/' : nextSectionPage(doc, url, section);
        }
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
        var path = sitePath(url).replace(/^\/anime\//i, '/');
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
        return (state.year && yearUrl(state.year)) || (state.genre && siteUrl(state.genre)) || sectionUrl(state.anistarSection);
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
        return { url: desktopUrl(url), fields: fields };
    }

    function sortOptions(sort, formData, jar) {
        var fields = Object.assign({}, formData.fields, { dlenewssortby: sort.key, dledirection: sort.direction });
        return { body: form(fields), auth: true, cookieJar: jar, headers: android() ? { Referer: formData.url } : {} };
    }

    function searchUrl(state, page) {
        var url = SITE + SEARCH_PATH + searchEncode(state.query);
        if (page === 1) return url;
        return url + '&' + form({ search_start: page, result_from: (page - 1) * SEARCH_PAGE_SIZE + 1 });
    }

    function rememberGenres(rows) {
        var changed = false;
        rows.forEach(function (row) {
            row.genres.forEach(function (genre) {
                genreIndex.set(genre.url, genre);
                if (row.card.anistarHentai && storeGenre('hentai', genre)) changed = true;
            });
        });
        if (changed) saveGenres('hentai');
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
        var active = doc.querySelector('#news_set_sort .sort-actv[onclick]');
        var choice = active && active.getAttribute('onclick').match(/dle_change_sort\(\s*['"](\w+)['"]\s*,\s*['"](asc|desc)['"]/i);
        // DLE displays the active order on the link; hidden inputs can retain defaults.
        if (choice) return choice[1].toLowerCase() === sort.key && choice[2].toLowerCase() !== sort.direction;
        var key = doc.querySelector('#news_set_sort input[name="dlenewssortby"]');
        var direction = doc.querySelector('#news_set_sort input[name="dledirection"]');
        return Boolean(key && key.value && direction && direction.value &&
            key.value.toLowerCase() === sort.key && direction.value.toLowerCase() === sort.direction);
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
        var url = state.query ? searchUrl(state, cursor) : cursor;
        var sorting = Boolean(!state.query && (state.sortApplied || state.anistarHome));
        var sort = SORT[state.sort] || SORT[0];
        var plan;
        if (sorting) {
            plan = sortPlans.get(state) || { jar: new Map(), mode: '' };
            sortPlans.set(state, plan);
        }
        var backup = yearCatalog(state) && cursor === yearUrl(state.year) ?
            SITE + '/index.php?' + form({ do: 'xfsearch', xf: state.year, type: 'year', r: 'anime' }) : '';

        function read(doc, address) {
            var page = catalogPage(doc, address, Boolean(state.query));
            if (state.query) {
                var next = doc.querySelector('#nextlink[onclick], #nextlink [onclick], .pagenav .r [onclick]');
                var match = next && next.getAttribute('onclick').match(/list_submit\(\s*['"]?(\d+)/);
                var linked = page.next && Number(new URL(page.next).searchParams.get('search_start'));
                var nextPage = match ? Number(match[1]) : linked;
                page.next = nextPage > cursor ? nextPage : 0;
            }
            if (/^(?:\/anime)?\/hentai(?:\/|$)/i.test(sitePath(address))) page.rows.forEach(function (row) {
                row.card.anistarHentai = true;
                row.card.adult = true;
                row.card.anistarAge = 18;
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
            function ordinary() { return desktopDocument(address, { plainGet: true }); }
            function sortedGet() { return desktopDocument(freshUrl(address), { auth: true, cookieJar: plan.jar }); }
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
                }).catch(function () {
                    plan.mode = 'local';
                    return ordinary().then(function (doc) { return local(read(doc, address)); });
                });
            }
            return ordinary().then(function (doc) {
                var baseline = read(doc, address);
                if (sortApplied(doc, sort)) return baseline;
                var fields = sortForm(doc, address);
                if (!fields) {
                    if (!state.sortApplied) return baseline;
                    plan.mode = 'local';
                    return local(baseline);
                }
                return desktopRequest(fields.url, sortOptions(sort, fields, plan.jar), pageDocument).then(function (response) {
                    return sortedGet().catch(function () { return requireDesktopLayout(response); });
                }).then(function (sorted) {
                    var page = read(sorted, address);
                    if (sortApplied(sorted, sort) && page.rows.length && browserOrder(page) !== browserOrder(baseline)) {
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

    function storeGenre(section, entry) {
        var url = entry && siteUrl(entry.url);
        if (!url || !entry.title || normalizeGenre(entry.title) === 'хентай' ||
            (section === 'hentai' && !/^\/filter\/janrs\/[^/]+\/?$/i.test(sitePath(url)))) return false;
        var key = normalizeGenre(entry.title);
        var genres = genreDirectories[section];
        if (genres.has(key)) return false;
        var option = { url: url, title: entry.title };
        genres.set(key, option);
        genreIndex.set(url, option);
        return true;
    }

    function saveGenres(section) {
        Lampa.Storage.set(hostStorageKey(GENRE_CACHE + '_' + section), { items: Array.from(genreDirectories[section].values()) });
    }

    function initGenres() {
        HOME_SECTIONS.forEach(function (section) {
            var cached = Lampa.Storage.get(hostStorageKey(GENRE_CACHE + '_' + section.value), {});
            if (cached && Array.isArray(cached.items)) cached.items.forEach(function (entry) { storeGenre(section.value, entry); });
        });
        if (!genreDirectories.anime.size) GENRES.forEach(function (entry) {
            storeGenre('anime', { url: SITE + '/' + entry[1] + '/', title: entry[0] });
        });
    }

    function refreshGenres(section) {
        if (!genreRefresh[section]) {
            var origin = SITE;
            function discover(address, remaining) {
                if (!address || !remaining || origin !== SITE) return Promise.resolve();
                return desktopDocument(address, { plainGet: true }).then(function (doc) {
                    if (origin !== SITE) return;
                    var page = catalogPage(doc, address);
                    rememberGenres(page.rows);
                    return discover(page.next, remaining - 1);
                });
            }
            var seed = section === 'hentai' ? discover(sectionUrl(section), 5) : desktopDocument(sectionUrl(section), { plainGet: true }).then(function (doc) {
                if (origin !== SITE) return;
                var genres = readGenreDirectory(doc);
                if (!genres.length) throw new Error('AniStar не вернул справочник жанров.');
                genreDirectories.anime.clear();
                genres.forEach(function (genre) { storeGenre('anime', genre); });
                saveGenres('anime');
            });
            genreRefresh[section] = seed.catch(function () {
                if (origin === SITE) delete genreRefresh[section];
            });
        }
        return genreRefresh[section];
    }

    function canWatch() {
        var permit = Lampa.Account && Lampa.Account.Permit;
        return Boolean(permit && (!permit.child ||
            Lampa.Utils.canWatchChildren('18+', permit.profile && permit.profile.age)));
    }

    function normalizeGenre(value) {
        return clean(value).toLowerCase().replace(/ё/g, 'е').replace(/[\s‐–—-]+/g, ' ');
    }

    function genrePath(url) {
        var path = sitePath(url).replace(/^\/anime\//i, '/').replace(/\/$/, '');
        try {
            return decodeURIComponent(path.replace(/\+/g, ' ')).toLowerCase();
        } catch (error) {
            return path.replace(/\+/g, ' ').replace(/%([0-9a-f]{2})/ig, function (code, hex) {
                var byte = parseInt(hex, 16);
                if (byte >= 0xc0) return String.fromCharCode(byte + 0x350);
                if (byte === 0xa8 || byte === 0xb8) return 'ё';
                return byte < 128 ? String.fromCharCode(byte) : code;
            }).toLowerCase();
        }
    }

    function matchesGenre(row, url) {
        var genre = genreIndex.get(siteUrl(url));
        var path = genrePath(url);
        var label = genre ? genre.title : path.indexOf('/filter/janrs/') === 0 ? path.slice(14) : '';
        return (path === '/hentai' && row.card.adult) || row.genres.some(function (entry) {
            return genrePath(entry.url) === path || (label && normalizeGenre(entry.title) === normalizeGenre(label));
        }) || (row.categories || []).some(function (category) {
            return genrePath(category) === path;
        });
    }

    function filtered(row, state, onGenrePage) {
        if (state.anistarSection && Boolean(row.card.anistarHentai) !== (state.anistarSection === 'hentai')) return false;
        if (state.year && row.card.release_year && row.card.release_year !== String(state.year)) return false;
        if (state.year && (onGenrePage || !yearCatalog(state)) && !row.card.release_year) return false;
        if (onGenrePage && (!routeIsGenre(state.anistarRoute) || !state.genre || genrePath(state.genre) === genrePath(state.anistarRoute))) return true;
        if (yearCatalog(state) && routeIsGenre(state.anistarRoute) && !matchesGenre(row, state.anistarRoute)) return false;
        if (!state.genre || (!state.query && !state.year && !state.anistarRoute)) return true;
        return matchesGenre(row, state.genre);
    }

    function getList(state) {
        var list = lists.get(state);
        var hideMissing = hideUncovered();
        if (!list || list.hideUncovered !== hideMissing) {
            list = { next: catalogStart(state), cards: [], ids: new Set(), visited: new Set(), hideUncovered: hideMissing };
            lists.set(state, list);
        }
        return list;
    }

    function fillList(state, list, remaining, source) {
        source = source || list;
        var shown = list.shown || 0;
        if (!source.next || !remaining || list.cards.length - shown >= PAGE_SIZE ||
            (state.activity && state.activity.component.destroyed)) return Promise.resolve();
        var cursor = source.next;
        var onGenrePage = source !== list;
        return readCatalogPage(cursor, source.state || state).then(function (page) {
            list.localSort = list.localSort || page.localSort;
            list.visited.add(cursor);
            source.next = list.visited.has(page.next) ? '' : page.next;
            page.rows.forEach(function (row) {
                if (list.ids.has(row.card.id) || !filtered(row, state, onGenrePage)) return;
                var poster = row.card.posterFallback === undefined ? row.card.poster : row.card.posterFallback;
                if (list.hideUncovered && !hasCover(poster)) return;
                if (row.card.adult && !canWatch()) {
                    list.restricted = true;
                    return;
                }
                list.ids.add(row.card.id);
                list.cards.push(row.card);
                source.added = true;
            });
            if (list.added && list.genreSource && list.genreSource.added && (state.sortApplied || state.anistarHome)) list.localSort = true;
            return fillList(state, list, remaining - 1, source);
        }, function (error) {
            if (list.cards.length === shown) throw error;
        });
    }

    function fillBatch(state, list) {
        var genre = state.genre || (routeIsGenre(state.anistarRoute) && state.anistarRoute);
        var filteredList = state.query || state.year || genre || state.sortApplied || state.anistarRoute;
        if (!genre || !yearCatalog(state)) return fillList(state, list, filteredList ? 8 : 5);
        if (!list.genreSource) list.genreSource = {
            next: siteUrl(genre), state: Object.assign({}, state, { genre: '', year: '', anistarRoute: genre })
        };
        function scanGenre() { return fillList(state, list, 8, list.genreSource); }
        return fillList(state, list, 6).then(scanGenre, function (error) {
            if (!list.genreSource.next) throw error;
            return scanGenre().then(function () {
                if (list.cards.length === (list.shown || 0) && !list.genreSource.next) throw error;
            });
        });
    }

    function hasMorePages(list) { return Boolean(list.next || (list.genreSource && list.genreSource.next)); }

    function emptyMessage(list) {
        if (list.restricted) return 'Тайтлы 18+ скрыты настройками профиля Lampa.';
        return hasMorePages(list) ? 'На проверенных страницах AniStar совпадений нет. Уточните фильтр.' : 'Тайтлы не найдены.';
    }

    function loadList(state, success, failure) {
        var list = getList(state);
        var page = Number(state.page) || 1;
        var start = list.shown || 0;
        var work = page === 1 && list.cards.length ? Promise.resolve() : fillBatch(state, list);
        work.then(function () {
            if (state.activity && state.activity.component.destroyed) return;
            list.shown = Math.min(start + MAX_PAGE_SIZE, list.cards.length);
            var results = list.cards.slice(start, list.shown);
            if (list.localSort) results.sort(compareCards.bind(null, state));
            success({ page: page, results: results, sortOrder: list.localSort ? list.cards.slice(0, list.shown).sort(compareCards.bind(null, state)) : null,
                total_pages: page + (hasMorePages(list) || list.shown < list.cards.length ? 1 : 0),
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

    function openList(title, options, replaceCurrent) {
        var origin = Lampa.Activity.active();
        if (!origin || origin.source !== SOURCE || !origin.activity || origin.anistarLoading) return;
        var state = listState(title, options);
        var list = getList(state);
        origin.anistarLoading = true;
        Lampa.Controller.toggle('content');
        origin.activity.loader(true);
        settle(fillBatch(state, list).then(function () {
            if (Lampa.Activity.active() !== origin) return;
            if (!list.cards.length) Lampa.Noty.show(emptyMessage(list));
            else {
                if (list.localSort && !list.cards.some(function (card) {
                    var field = (SORT[state.sort] || SORT[0]).key;
                    return field === 'title' || field === 'date' || (card.anistarSort && card.anistarSort[field] != null);
                })) Lampa.Noty.show('Сайт не меняет порядок и не публикует счётчики для этой сортировки.');
                origin.activity.loader(false);
                if (replaceCurrent || (origin.anistarResults && state.anistarResults)) Lampa.Activity.replace(state, true);
                else Lampa.Activity.push(state);
            }
        }).catch(function (error) {
            if (Lampa.Activity.active() === origin) Lampa.Noty.show(error.message);
        }), function () {
            delete origin.anistarLoading;
            if (origin.activity && !origin.activity.component.destroyed) origin.activity.loader(false);
        });
    }

    function openFavorites() {
        bookmarkPages.clear();
        Lampa.Activity.push(listState('Избранное', { component: FAVORITES }));
    }

    function openFavoriteList(entry, replace) {
        var state = listState(entry.title, { anistarList: entry });
        if (replace) Lampa.Activity.replace(state, true);
        else Lampa.Activity.push(state);
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

    function renderCatalogYear(item, data) {
        var year = cardYear(data);
        var age = item.find('.card__age').first();
        if (!year) {
            age.remove();
            return;
        }
        if (!age.length) age = $('<div class="card__age"></div>');
        age.addClass('anistar-card-year').removeClass('hide').text(year);
        var title = item.find('.card__title').first();
        if (title.length) title.after(age);
        else item.append(age);
    }

    function openCatalogTitle(data) {
        Lampa.Activity.push({ component: 'full', method: 'movie', source: SOURCE, card: data, id: data.id, url: '' });
    }

    function catalogCard(data, onUnavailable) {
        var item = catalogTemplate('card', '.card__img',
            '<div class="card selector"><div class="card__view"><img class="card__img"></div><div class="card__title"></div><div class="card__age"></div></div>');
        item.addClass('card--loaded selector');
        var image = item.find('.card__img').attr('alt', '').attr('loading', 'lazy');
        var fallback = data.posterFallback;
        image.on('error', function () {
            var alternate = fallback;
            fallback = '';
            if (alternate && alternate !== image.attr('src') && (!onUnavailable || hasCover(alternate))) image.attr('src', alternate);
            else if (onUnavailable) onUnavailable(item);
            else image.off('error').attr('src', './img/img_broken.svg');
        }).attr('src', data.poster || './img/img_broken.svg');
        item.find('.card__title').first().text(data.title);
        renderCatalogYear(item, data);
        item.on('hover:long', function () { chooseStatus(data); });
        item.on('hover:enter', function () { openCatalogTitle(data); });
        return item;
    }

    function moveCatalogFocus(direction, fallback) {
        var navigator = window.Navigator && typeof window.Navigator.canmove === 'function' ? window.Navigator : Lampa.Navigator;
        if (navigator && typeof navigator.canmove === 'function' && navigator.canmove(direction)) {
            navigator.move(direction);
            return true;
        }
        if (fallback) Lampa.Controller.toggle(fallback);
        return false;
    }

    function favoritePreview(entry) {
        var state = listState(entry.title, { anistarList: entry });
        var list = getList(state);
        return fillList(state, list, 2).then(function () { return list.cards.slice(0, MAX_PAGE_SIZE); });
    }

    function loadFavoriteRows(object, success, failure) {
        var component = object.activity && object.activity.component;
        var modules = Lampa.Maker.module('Card');
        var mask = modules.remove(modules.MASK.base, 'Menu');
        var error;
        Promise.all(FAVORITE_TABS.map(function (entry) {
            return favoritePreview(entry).then(function (cards) {
                if (!cards.length) return null;
                return { title: entry.title, source: SOURCE, anistarList: entry, total_pages: 2,
                    results: cards.map(function (card) {
                        return Object.assign({}, card, { poster: card.posterFallback || card.poster,
                            anistarCard: card, params: { module: mask } });
                    }) };
            }).catch(function (reason) { error = error || reason; return null; });
        })).then(function (rows) {
            if (component && component.destroyed) return;
            var available = rows.filter(Boolean);
            if (available.length) success(available);
            else {
                if (ownsScreen(object, component)) Lampa.Noty.show(error ? error.message : 'В Избранном пока нет тайтлов.');
                failure();
            }
        });
    }

    function favoritesComponent(object) {
        var Native = typeof Lampa.Component.get === 'function' && Lampa.Component.get('category');
        if (typeof Native !== 'function' || !Lampa.Maker || typeof Lampa.Maker.module !== 'function' ||
            signedOut() || (!session && (!loginName() || !loginPassword()))) return new favoritesFallback(object);
        var cardModules = Lampa.Maker.module('Card');
        if (!cardModules || !cardModules.MASK || typeof cardModules.remove !== 'function') return new favoritesFallback(object);
        var component = new Native(object);
        if (!component || typeof component.use !== 'function' || typeof component.start !== 'function') return new favoritesFallback(object);

        var origin = SITE;
        var hideMissing = hideUncovered();
        var version = bookmarkRevision;
        var reloading = false;
        var start = component.start;
        component.updateCatalogSettings = function () {
            if (component.destroyed || !ownsScreen(object, component) ||
                (version === bookmarkRevision && origin === SITE && hideMissing === hideUncovered())) return false;
            if (reloading) return true;
            reloading = true;
            Promise.resolve().then(function () {
                reloading = false;
                if (!component.destroyed && ownsScreen(object, component)) Lampa.Activity.replace(listState('Избранное', { component: FAVORITES }), true);
            });
            return true;
        };
        component.start = function () {
            if (!component.updateCatalogSettings()) start.apply(component, arguments);
        };
        component.use({
            onBuild: function () { version = bookmarkRevision; },
            onInstance: function (line, row) {
                line.use({
                    onlyMore: function () { openFavoriteList(row.anistarList); },
                    onInstance: function (item, data) {
                        var card = data.anistarCard;
                        item.use({
                            onlyEnter: function () { openCatalogTitle(card); },
                            onCreate: function () {
                                var item = this;
                                var root = $(item.render(true));
                                root.on('hover:long', function () { chooseStatus(card); });
                                if (hideMissing && item.img) item.img.onerror = function () {
                                    clearTimeout(item.img_timer);
                                    root.addClass('hide').removeClass('selector');
                                };
                            }
                        });
                    }
                });
            }
        });
        return component;
    }

    function favoritesFallback(object) {
        var component = this;
        var scroll = new Lampa.Scroll({ mask: true, over: true, scroll_by_item: true });
        var body = $('<div class="anistar-favorites"></div>');
        var rails = [];
        var focused;
        var running = false;
        var reloading = false;
        var origin = SITE;
        var hideMissing = hideUncovered();
        var version = bookmarkRevision;
        scroll.append(body);

        function focus() {
            if (!running || component.destroyed || Lampa.Controller.enabled().name !== 'content') return;
            Lampa.Controller.collectionSet(body, false, true);
            var target = focused && body[0].contains(focused) ? focused : (body.find('.card.selector')[0] || body.find('.selector')[0]);
            if (target) Lampa.Controller.collectionFocus(target, body, true);
        }

        function row(entry) {
            var line = catalogTemplate('items_line', '.items-line__body',
                '<div class="items-line"><div class="items-line__head"><div class="items-line__title"></div></div><div class="items-line__body"></div></div>').appendTo(body);
            line.find('.items-line__title').text(entry.title);
            var more = $('<div class="items-line__more selector">Ещё</div>').appendTo(line.find('.items-line__head'));
            more.on('hover:enter', function () { openFavoriteList(entry); });
            more.on('hover:focus', function () { focused = this; scroll.update(line); });
            var rail = new Lampa.Scroll({ horizontal: true, step: 300 });
            rails.push(rail);
            var cards = $('<div class="mapping--line anistar-favorites-rail"></div>');
            rail.append(cards);
            line.find('.items-line__body').append(rail.render());

            return favoritePreview(entry).then(function (preview) {
                if (component.destroyed) return;
                preview.forEach(function (data) {
                    var item = catalogCard(data, hideMissing ? function (missing) { missing.remove(); focus(); } : null);
                    item.on('hover:focus', function () {
                        focused = this;
                        rail.update(item);
                        scroll.update(line);
                    }).appendTo(cards);
                });
            }, function (error) { return error.message; });
        }

        this.create = function () {
            scroll.minus();
            component.activity.loader(true);
            Promise.all(FAVORITE_TABS.map(row)).then(function (errors) {
                if (component.destroyed) return;
                version = bookmarkRevision;
                var error = errors.find(Boolean);
                if (error === LOGIN_PROMPT) {
                    var login = $('<div class="full-start__button selector anistar-favorite-login"></div>').text(LOGIN_PROMPT).prependTo(body);
                    login.on('hover:enter', openAccountSettings);
                } else if (error && ownsScreen(object, component)) Lampa.Noty.show(error);
                component.activity.loader(false);
                focus();
            });
        };
        this.render = function (raw) { return raw ? scroll.render()[0] : scroll.render(); };
        this.updateCatalogSettings = function () {
            if (component.destroyed || !ownsScreen(object, component) ||
                (version === bookmarkRevision && origin === SITE && hideMissing === hideUncovered())) return false;
            if (reloading) return true;
            reloading = true;
            Promise.resolve().then(function () {
                if (component.destroyed || !ownsScreen(object, component)) { reloading = false; return; }
                Lampa.Activity.replace(listState('Избранное', { component: FAVORITES }), true);
            });
            return true;
        };
        this.start = function () {
            running = true;
            if (this.updateCatalogSettings()) return;
            Lampa.Controller.add('content', {
                link: component, toggle: focus,
                left: function () { moveCatalogFocus('left', 'menu'); },
                up: function () { moveCatalogFocus('up', 'head'); },
                down: function () { moveCatalogFocus('down'); },
                right: function () { moveCatalogFocus('right'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };
        this.pause = this.stop = function () { running = false; };
        this.destroy = function () {
            component.destroyed = true;
            rails.forEach(function (rail) { rail.destroy(); });
            scroll.destroy();
            body.remove();
        };
    }

    function catalogComponent(object) {
        var component = this;
        object.page = 1;
        var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250, end_ratio: 2 });
        var grid = $('<div class="mapping--grid cols--6"></div>');
        var personal = object.anistarList;
        var view = personal ? $('<div class="anistar-favorites-list"></div>').append(grid) : grid;
        var ids = new Set();
        var itemsById = new Map();
        var focused = null;
        var loading = false;
        var total = 1;
        var running = false;
        var destroyed = false;
        var hideMissing = hideUncovered();
        var catalogOrigin = SITE;
        var preferredSection = object.anistarHome ? homeSection() : '';
        var bookmarksVersion = bookmarkRevision;
        var settingsUpdateQueued = false;
        var failedCoverPages = 2;
        scroll.append(view);

        function refreshFocus() {
            if (!running || destroyed || Lampa.Controller.enabled().name !== 'content') return;
            Lampa.Controller.collectionSet(view, false, true);
            var target = focused && view[0].contains(focused) ? focused : view.find('.selector')[0];
            if (target) Lampa.Controller.collectionFocus(target, view, true);
        }

        function append(data) {
            if (ids.has(data.id)) return;
            ids.add(data.id);
            var item = catalogCard(data, hideMissing ? function (missing) {
                if (focused === missing[0]) focused = null;
                itemsById.delete(data.id);
                missing.remove();
                refreshFocus();
                if (!itemsById.size && failedCoverPages > 0 && next()) failedCoverPages -= 1;
            } : null);
            item.appendTo(grid);
            itemsById.set(data.id, item);
            item.on('hover:focus', function () {
                focused = this;
                scroll.update(item);
                var index = grid.children().index(this);
                if (index >= 0 && index >= grid.children().length - 5) next();
            });
        }

        function load(initial) {
            if (loading || destroyed) return;
            if (component.updateCatalogSettings()) return;
            loading = true;
            if (initial) component.activity.loader(true);
            loadList(object, function (page) {
                if (destroyed) return;
                if (personal && initial) bookmarksVersion = bookmarkRevision;
                total = page.total_pages;
                page.results.forEach(append);
                if (page.sortOrder) page.sortOrder.forEach(function (card) {
                    var item = itemsById.get(card.id);
                    if (item) grid.append(item);
                });
                if (initial && !page.results.length && ownsScreen(object, component)) Lampa.Noty.show(page.message);
                if (initial) component.activity.loader(false);
                refreshFocus();
                loading = false;
            }, function (error) {
                loading = false;
                if (destroyed) return;
                if (initial) component.activity.loader(false);
                if (personal && initial && error.message === LOGIN_PROMPT) {
                    var button = $('<div class="full-start__button selector anistar-favorite-login"></div>').text(LOGIN_PROMPT).appendTo(view);
                    button.on('hover:enter', openAccountSettings);
                    button.on('hover:focus', function () { focused = this; scroll.update(button); });
                    refreshFocus();
                } else if (running && ownsScreen(object, component)) Lampa.Noty.show(error.message || 'Список недоступен.');
            });
        }

        function next() {
            if (loading || destroyed || !running || object.page >= total) return false;
            object.page += 1;
            load(false);
            return true;
        }

        this.create = function () {
            if (object.anistarHome) refreshGenres(object.anistarSection || homeSection());
            scroll.minus();
            scroll.onEnd = next;
            load(true);
        };
        this.render = function (raw) { return raw ? scroll.render()[0] : scroll.render(); };
        this.updateCatalogSettings = function () {
            if (!ownsScreen(object, component) || destroyed) return false;
            var sectionChanged = object.anistarHome && preferredSection !== homeSection();
            var siteChanged = (object.anistarHome || personal) && catalogOrigin !== SITE;
            var bookmarksChanged = personal && bookmarksVersion !== bookmarkRevision;
            if (!sectionChanged && !siteChanged && !bookmarksChanged && hideMissing === hideUncovered()) return false;
            if (settingsUpdateQueued) return true;
            settingsUpdateQueued = true;
            Promise.resolve().then(function () {
                settingsUpdateQueued = false;
                if (destroyed || !ownsScreen(object, component)) return;
                if (object.anistarHome) {
                    Lampa.Activity.replace(homeState(sectionChanged || siteChanged ? null : object.anistarFilters), true);
                } else if (personal) {
                    openFavoriteList(personal, true);
                } else if (typeof component.activity.refresh === 'function') {
                    component.activity.refresh();
                }
            });
            return true;
        };
        this.start = function () {
            running = true;
            if (this.updateCatalogSettings()) return;
            Lampa.Controller.add('content', {
                link: component,
                toggle: refreshFocus,
                left: function () { moveCatalogFocus('left', 'menu'); },
                up: function () { moveCatalogFocus('up', 'head'); },
                down: function () { if (!moveCatalogFocus('down')) next(); },
                right: function () {
                    if (!moveCatalogFocus('right') && !object.anistarList) showFilter(object);
                },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };
        this.pause = this.stop = function () { running = false; };
        this.destroy = function () {
            destroyed = true;
            component.destroyed = true;
            scroll.destroy();
            view.remove();
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

    function genreOptions(section) {
        var locale = section === 'hentai' ? 'en' : 'ru';
        var items = Array.from(genreDirectories[section].values()).sort(function (left, right) {
            return left.title.localeCompare(right.title, locale, { sensitivity: 'base', ignorePunctuation: true });
        }).map(function (entry) {
            return { title: escapeHtml(entry.title), value: entry.url };
        });
        items.unshift({ title: 'Все', value: '' });
        return items;
    }

    function homeSection() { return Lampa.Storage.get(HOME_SECTION, 'anime') === 'hentai' ? 'hentai' : 'anime'; }

    function sectionUrl(section) { return SITE + (section === 'hentai' ? '/hentai/' : ANIME_PATH); }

    function homeState(filters) {
        var values = Object.assign({}, defaultFilters, filters);
        values.genre = siteUrl(values.genre);
        return listState(NAME, Object.assign({ anistarHome: true, anistarSection: homeSection(), anistarFilters: values }, values));
    }

    function openHome() {
        var active = Lampa.Activity.active();
        if (active && active.component === 'anistar_catalog' && active.anistarHome) Lampa.Activity.replace(homeState(), true);
        else Lampa.Activity.push(homeState());
    }

    function showFilter(activity) {
        var base = activity.anistarFilters || defaultFilters;
        var draft = Object.assign({}, activity.anistarFilterDraft || base);
        var controller = Lampa.Controller.enabled().name;
        var section = activity.anistarSection || homeSection();

        function render() {
            if (Lampa.Activity.active() !== activity) return;
            var genre = genreIndex.get(draft.genre);
            Lampa.Select.show({
                title: 'Фильтр',
                items: [
                    { title: 'Поиск', subtitle: escapeHtml(draft.query), action: search },
                    { title: 'Избранное', action: openFavorites },
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
                            draft.query = query;
                            apply(true);
                        }
                    }
                });
            $('.settings-input').last().addClass('anistar-search-keyboard');
        }

        function sort() {
            choose('Сортировка', 'sort', SORT.map(function (entry, index) {
                return { title: entry.title, value: index };
            }));
        }

        function genres() {
            if (genreDirectories[section].size) choose('Жанры', 'genre', genreOptions(section));
            else refreshGenres(section).then(function () {
                if (Lampa.Activity.active() !== activity) return;
                if (!genreDirectories[section].size) Lampa.Noty.show('Не удалось загрузить жанры AniStar.');
                choose('Жанры', 'genre', genreOptions(section));
            });
        }

        function years() {
            var options = [{ title: 'Любой', value: '' }];
            for (var year = new Date().getFullYear() + 1; year >= 1900; year--) {
                options.push({ title: String(year), value: String(year) });
            }
            choose('Год', 'year', options);
        }

        function apply(searching) {
            if (Lampa.Activity.active() !== activity || activity.anistarLoading) return;
            var route = activity.anistarRoute;
            if (routeIsGenre(route) && draft.genre !== base.genre) route = '';
            if (!draft.query && !draft.genre && !draft.year && !draft.sortApplied && !route) {
                Lampa.Activity.replace(homeState(), true);
                return;
            }
            activity.anistarFilterDraft = draft;
            if (activity.anistarHome && searching !== true) {
                openList(NAME, homeState(draft), true);
                return;
            }
            openList(draft.query ? 'Поиск · ' + draft.query : route ? activity.title : 'Каталог AniStar', Object.assign({
                anistarResults: true, anistarRoute: route, anistarSection: activity.anistarSection, anistarFilters: draft
            }, draft));
        }

        function reset() {
            if (Lampa.Activity.active() !== activity) return;
            Lampa.Activity.replace(homeState(), true);
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
        return desktopRequest(endpoint, options).catch(function () { return favoriteLink(movie, desired); });
    }

    function favoriteLink(movie, desired) {
        var url = SITE + '/index.php?' + form({ do: 'favorites', doaction: desired ? 'add' : 'del', id: newsId(movie.url) });
        return desktopRequest(url, { auth: true, headers: { Referer: desktopUrl(movie.url) } });
    }

    function setStatus(movie, status) {
        return desktopRequest(SITE + '/engine/ajax/statuspost.php', {
            body: form({ id: newsId(movie.url), status: status }),
            headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: desktopUrl(movie.url) }, auth: true
        });
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

        if (signedOut() || (!session && (!loginName() || !loginPassword()))) { prompt(); return; }
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

                    var update = entry.id ? setStatus(movie, desired ? entry.id : 0) : setFavorite(movie, desired);
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
                        bookmarkRevision += 1;
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
            var values = { login: loginName(), password: loginPassword() ? '********' : '', profile: session ? session.name : '',
                home: homeSection() === 'hentai' ? 'Хентай' : 'Аниме', address: SITE };
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
            settle(loginAccount(true).then(function () {
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
            settle(logoutAccount().then(function () {
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
            function restore() { Lampa.Controller.toggle('settings_component'); focus('home'); }
            optionMenu('Главная страница по умолчанию', HOME_SECTIONS, homeSection(), function (value) {
                Lampa.Storage.set(HOME_SECTION, value);
                render();
                restore();
            }, restore);
        });
        Lampa.SettingsApi.addParam({
            component: SOURCE,
            param: { name: HIDE_UNCOVERED, type: 'trigger', default: false },
            field: { name: 'Скрыть тайтлы без обложек' },
            onRender: function (item) { item.addClass('anistar-settings-row'); }
        });
        function refreshCatalogAfterSettings() {
            var active = Lampa.Activity.active();
            var component = active && (active.component === 'anistar_catalog' || active.component === FAVORITES) && active.activity && active.activity.component;
            if (component && component.updateCatalogSettings) component.updateCatalogSettings();
        }
        if (Lampa.Settings && Lampa.Settings.listener) Lampa.Settings.listener.follow('close', refreshCatalogAfterSettings);
        if (Lampa.Controller.listener) Lampa.Controller.listener.follow('toggle', function (event) {
            if (event.name === 'head' || event.name === 'content') refreshCatalogAfterSettings();
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
                publicNotes.clear();
                catalogYears.clear();
                articleNotes.clear();
                genreRefresh = {};
                tizenDesktopSession = null;
                genreIndex.clear();
                genreDirectories.anime.clear();
                genreDirectories.hentai.clear();
                Lampa.Storage.set(SITE_KEY, address === DEFAULT_SITE ? '' : address);
                restoreAccount();
                initGenres();
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
        return readLinks(row || head, '/filter/janrs/');
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
            if (text && text.indexOf('\ufffd') === -1) return text;
        }
        var paragraphs = scope.querySelectorAll('p, h3, h4, center, .news_text strong, .full-text b, .descripts span');
        for (var row = 0; row < paragraphs.length; row++) {
            var note = clean(paragraphs[row].textContent);
            if (note.length < 260 && /^Добавлен[аоы]?\s/i.test(note) && /сер(?:ия|ии|ий)|эпизод|фильм|спешл/i.test(note)) return note;
        }
        return '';
    }

    function explicitDesktopUrl(value) {
        return desktopUrl(value) + '&action_skin_change=1';
    }

    function readPublicReleaseNote(url) {
        var address = siteUrl(url);
        var cached = publicNotes.get(address);
        if (cached) return cached;
        function extract(doc) {
            return releaseNote(doc.querySelector('#dle-content') || doc);
        }
        var pending = desktopDocument(address, { plainGet: true }).then(function (doc) {
            var note = extract(doc);
            if (note) return note;
            return desktopDocument(explicitDesktopUrl(address), { plainGet: true }).then(extract);
        }, function () { return desktopDocument(explicitDesktopUrl(address), { plainGet: true }).then(extract); });
        publicNotes.set(address, pending);
        pending.then(function () {}, function () {
            if (publicNotes.get(address) === pending) publicNotes.delete(address);
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
        movie.title = escapeHtml(movie.title);
        movie.tagline = escapeHtml(movie.tagline);
        movie.original_title = movie.tagline;
        movie.overview = description ? escapeHtml(clean(description.textContent)) : '';
        movie.img = movie.poster;
        movie.genres = [];
        movie.production_companies = [];
        movie.production_countries = [];
        movie.anistar = {
            genres: titleGenres(head),
            directors: readLinks(head, '/filter/director/'),
            authors: readLinks(head, '/filter/author/'),
            translation: labeledValue(root, /^Озвучка:/i),
            series: labeledValue(root, /^Серии:/i),
            released: releaseNote(root) || (content && releaseNote(content)) || movie.anistarReleased || articleNotes.get(newsId(movie.url)) || '',
            player: player,
            comments: readComments(doc)
        };
        saveReleaseNote(movie, movie.anistar.released);
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
        desktopDocument(card.url, options).then(function (doc) {
            return readArticle(doc, card);
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

    function saveReleaseNote(movie, note) {
        if (!note) return;
        movie.anistar.released = note;
        movie.anistarReleased = note;
        articleNotes.set(newsId(movie.url), note);
    }

    function renderReleaseNote(card, movie) {
        var note = movie.anistar.released || movie.anistarReleased || articleNotes.get(newsId(movie.url)) || movie.anistar.availableRelease;
        if (!note || !card.length) return;
        var root = card[0];
        var details = root.querySelector('.full-start-new__details, .full-start__details');
        if (!details || !details.parentNode) return;
        var row = root.querySelector('.anistar-released') || document.createElement('div');
        row.className = 'anistar-released';
        row.textContent = note;
        if (details.previousSibling !== row) details.parentNode.insertBefore(row, details);
    }

    function latestAvailableEpisode(movie) {
        return loadEpisodes(movie).then(function (episodes) {
            var latest;
            episodes.forEach(function (entry) {
                if (entry.kind || entry.number === null || !entry.files.length) return;
                if (!latest || entry.season > latest.season || (entry.season === latest.season && entry.number > latest.number)) latest = entry;
            });
            if (latest) movie.anistar.availableRelease = 'Доступна серия ' + String(latest.number).replace('.', ',');
        });
    }

    function renderFullRatings(card, details, movie) {
        var vote = movie.vote_average;
        var age = movie.anistarAge;
        var line = card.find('.full-start-new__rate-line, .full-start__rate-line').first();
        if (!line.length && details.length && (vote || age != null)) {
            line = $('<div class="full-start-new__rate-line"></div>');
            details.before(line);
        }
        if (!line.length) return;
        line.addClass('anistar-full-rates').toggleClass('hide', !vote && age == null);

        var rating = line.find('.rate--tmdb').first();
        if (vote && !rating.length) {
            rating = $('<div class="full-start__rate rate--tmdb"><div></div><div class="source--name"></div></div>');
            line.prepend(rating);
        }
        rating.toggleClass('hide', !vote);
        if (vote) {
            var score = rating.children().not('.source--name').first();
            if (!score.length) score = $('<div></div>').prependTo(rating);
            score.text(vote >= 10 ? '10' : vote.toFixed(1));
            var source = rating.find('.source--name').first();
            if (!source.length) source = $('<div class="source--name"></div>').appendTo(rating);
            source.text('AniStar');
        }

        var restriction = line.find('.full-start__pg').first();
        if (age != null && !restriction.length) {
            restriction = $('<div class="full-start__pg"></div>');
            line.append(restriction);
        }
        restriction.toggleClass('hide', age == null).text(age == null ? '' : age + '+');
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

        function currentCard() { return $(typeof owner.render === 'function' && owner.render(true) || owner.html); }
        var card = currentCard();
        card.addClass('anistar-full-card');
        var main = card.find('.full-start-new__details, .full-start__details').first();
        var title = card.find('.full-start-new__title, .full-start__title').first();
        if (!main.length && title.length) {
            var anchor = card.find('.full-start__tagline, .full-start__title-original, .full--tagline').first();
            main = $('<div class="full-start__details"></div>');
            (anchor.length ? anchor : title).after(main);
        }
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
            main.addClass('anistar-full-details').empty();
            [details.series && 'Серии: ' + details.series, details.translation, genreText].filter(Boolean).forEach(function (value, index) {
                if (index) main.append($('<span class="full-start-new__split">●</span>'));
                main.append($('<span></span>').text(value));
            });
        }
        card.find('.full-start-new__reactions').hide();
        renderFullRatings(card, main, movie);
        function syncReleaseNote() { renderReleaseNote(currentCard(), movie); }
        syncReleaseNote();
        if (!details.released && !movie.anistarReleased && !details.availableRelease) {
            readPublicReleaseNote(movie.url).catch(function () { return ''; }).then(function (note) {
                if (note) saveReleaseNote(movie, note);
                else if (details.player) return latestAvailableEpisode(movie);
            }).then(function () {
                if (!owner.destroyed) syncReleaseNote();
            }).catch(function () {});
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
            syncReleaseNote();
            buttons.children('.full-start__button').not('.anistar-action').hide().removeClass('selector');
            if (!watch.parent().length) buttons.append(watch);
            if (!favorite.parent().length) buttons.append(favorite);
            if (initial) {
                initial = false;
                owner.last = watch[0];
            }
        }

        buttonsOnly();
        owner.use({ onlyGroupButtons: buttonsOnly, onToggle: syncReleaseNote });
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
        return desktopRequest(player, options).then(function (html) {
            var episodes = parsePlaylist(html, player);
            if (!episodes.length) throw new Error('AniStar не вернул доступные серии.');
            return episodes;
        });
    }

    function loadEpisodes(movie) {
        var cached = watchPlaylists.get(movie);
        if (cached) return cached;
        var pending = playerItems(movie);
        watchPlaylists.set(movie, pending);
        pending.catch(function () {
            if (watchPlaylists.get(movie) === pending) watchPlaylists.delete(movie);
        });
        return pending;
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
        var external = android() && typeof Lampa.Storage.field === 'function' && Lampa.Storage.field('player') === 'android';
        function media(entry) {
            var choices = builtInSources(entry.files);
            var qualities = {};
            choices.forEach(function (file) { qualities[file.size + 'p'] = file.url; });
            var url = qualities[preferred] || choices[0].url;
            var available = choices.find(function (file) { return file.url === url; });
            var reserve = choices.find(function (file) { return file.url !== url; });
            if (!reserve && !available.publicManifest) reserve = entry.files.find(function (file) { return file.url !== url; });
            if (external && available.publicManifest) {
                url = url.replace(/#anistar\.m3u8$/, '');
                Object.keys(qualities).forEach(function (quality) {
                    qualities[quality] = qualities[quality].replace(/#anistar\.m3u8$/, '');
                });
            }
            var data = {
                title: decodeHtml(movie.title) + ' / ' + entry.title,
                url: url, quality: qualities,
                movie: movie, card: movie, season: entry.season,
                episode: entry.number === null ? 1 : entry.number, timeline: timeline(movie, entry)
            };
            if (reserve && !external) data.url_reserve = reserve.url;
            if (external) data.headers = { Referer: movie.anistar.player, Origin: SITE };
            return data;
        }
        var item = media(episode);
        // Android Lampa uses ViMu's file-list mode when given several videos.
        if (!external) item.playlist = episodes.filter(function (entry) { return entry.files.length; }).map(media);
        playerOrigin = { data: item, activity: activity };
        Lampa.Player.play(item);
        if (!external && typeof Lampa.Player.playlist === 'function') Lampa.Player.playlist(item.playlist);
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
            '.mapping--grid .anistar-card-year{display:block}',
            '.anistar-favorites-rail{padding:0 1.5em 1em}',
            '.anistar-favorite-login{width:fit-content;margin:0 1.5em 1.4em;padding:.8em 1.25em}',
            '.anistar-full-card .full-start-new__tagline,.anistar-full-card .full--tagline{margin-bottom:.55em}',
            '.anistar-full-card .anistar-full-rates{margin:.35em 0 .55em;flex-wrap:wrap;row-gap:.35em}',
            '.anistar-full-card .anistar-full-rates:not(.hide){display:flex;align-items:center}',
            '.anistar-full-card .anistar-full-details{margin-top:0;margin-bottom:.9em;line-height:1.35}',
            '.anistar-released{display:block;padding:.4em 0;color:inherit;text-align:left;font-size:1.3em;font-weight:800;line-height:1.3;white-space:normal;overflow-wrap:break-word}',
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
        Lampa.Api.sources[SOURCE] = { category: loadFavoriteRows, list: loadList, full: loadFull, clear: function () {} };
        Lampa.Component.add('anistar_catalog', catalogComponent);
        Lampa.Component.add(FAVORITES, favoritesComponent);
        Lampa.Component.add(VIEW, watchComponent);
        Lampa.Component.add(COMMENTS, commentsComponent);
        Lampa.Menu.addButton(ICON, NAME, openHome);
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
