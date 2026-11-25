/*!
 * AnimeHub 0.5.9 — источник HentaiHub 0.49 для Lampa на Android TV и Tizen.
 */
(function () {
    'use strict';

    var SOURCE = 'animehub';
    var NAME = 'AnimeHub';
    var VERSION = '0.5.9';
    var ICON = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h7v7H4zm9 0h7v7h-7zm0 9h7v7h-7zm-9 0h7v7H4z"/></svg>';
    var API = 'https://api.hentaigo.me/api/';
    var HENTAIHUB_VERSION = '0.49';
    var PAGE_SIZE = 20;
    var FILTER_FIRST_PAGE_SIZE = 40;
    var RELATED_LIMIT = 30;
    var INITIAL_PAGES = 5;
    var RANDOM_PAGES = 40;
    var TIMEOUT = 15000;
    var HOME = 'animehub_home';
    var BOOKMARK_HOME = 'animehub_bookmark_home';
    var BOOKMARK_BATCH_SIZE = 60;
    var COLLECTIONS = 'animehub_collections';
    var COMMENTS = 'animehub_comments';
    var RANDOM = 'animehub_random';
    var POPULAR = 'animehub_popular';
    var ACCOUNT_TOKEN = 'animehub_account_token';
    var UPDATE_SETTING = 'animehub_check_update';
    var BOOKMARKS = [
        { key: 'favorite', list: 1, title: 'Избранное' },
        { key: 'viewed', list: 0, title: 'Просмотрено' },
        { key: 'watch_later', list: 2, title: 'В планах' },
        { key: 'other', list: 3, title: 'Брошено' }
    ];
    var VOTE_LISTS = [
        { key: 'likes', rating: 1, title: 'Лайки' },
        { key: 'dislikes', rating: -1, title: 'Дизлайки' }
    ];
    var DICE_ICON = 'https://raw.githubusercontent.com/azat2909/lampa-plugins/main/icons/animehub-dice.svg';
    var ELITE_STUDIOS = 'https://raw.githubusercontent.com/azat2909/lampa-plugins/main/filter/studio-elite';
    var TRANSLATIONS = { voice: 'Озвучка', subs: 'Субтитры', raw: 'Оригинал' };
    var SECTIONS = [
        { title: 'Обновленные', url: 'editdate' },
        { title: 'Новые', url: 'date' },
        { title: 'Популярные', url: 'news_read' },
        { title: 'Горячее', url: 'hot' },
        { title: 'Случайное', url: 'rand' },
        { title: 'Коллекции', url: 'collections' }
    ];
    var PERIODS = [
        { title: 'За день', value: 'views_1' },
        { title: 'За неделю', value: 'views_7' },
        { title: 'За месяц', value: 'views_31' },
        { title: 'За полгода', value: 'views_180' },
        { title: 'За год', value: 'views_365' }
    ];
    var SORT_OPTIONS = [
        { title: 'По дате добавления', value: 'date' },
        { title: 'По дате редактирования', value: 'editdate' },
        { title: 'По названию', value: 'title' },
        { title: 'По числу просмотров', value: 'news_read' },
        { title: 'По рейтингу', value: 'rating' },
        { title: 'Горячее', value: 'hot' },
        { title: 'По популярности за день', value: 'views_1' },
        { title: 'По популярности за неделю', value: 'views_7' },
        { title: 'По популярности за месяц', value: 'views_31' },
        { title: 'По популярности за полгода', value: 'views_180' },
        { title: 'По популярности за год', value: 'views_365' }
    ];
    // Initial catalog choices from HentaiHub 0.49's FilterScreen.
    var GENRES = ['Исекай', 'Романтика', 'Классика', 'Комедия', 'Махо-сёдзё', 'Ужасы', 'Фэнтези', 'Юри', 'Эротика'];
    // The API matches some studio names with non-breaking spaces.
    var STUDIOS = [
        'Moonstone Cherry', 'Studio Deen', 'Pink Pineapple', 'MS Pictures', '3D-Works',
        'PoRO', 'Mary Jane', 'Queen Bee', 'Vanilla', 'Suzuki Mirano',
        '2D-Works', 'T-Rex', 'Bunnywalker', 'Pixy Soft', 'MediaBank',
        'nur', 'Magin Label', 'Collaboration Works', 'Showten', '37c-Binetsu',
        'Green Bunny', 'Majin Petit', 'Discovery', 'NuTech Digital', 'SELFISH',
        'ChiChinoya', 'Edge', 'Suiseisha', 'Digital Works', 'Pashmina',
        'ZIZ', 'Lune Pictures', 'White Bear', 'GOLD BEAR', 'Amour',
        'Arms', 'Schoolzone', 'Five Ways', 'Milky', 'Umemaro-3D',
        'Studio 9 Maiami', 'Y.O.U.C.', 'Lemon Heart', 'King Bee', 'Marigold',
        'Soft on Demand', 'Antechinus', 'Bootleg', 'Mousou Senka', 'BOMB! CUTE! BOMB!',
        'X City', 'Media Blasters', 'Animac', 'Valkyria', 'Nihikime no Dozeu',
        'Hot Bear', 'Blue Eyes', 'D3', 'Vicineko', 'Studio FOW',
        'Toranoana', 'Magic Bus', 'Comic Media', 'Shadow Prod. Co.', 'Shinyusha',
        'Rabbit Gate', 'Celeb', 'BugBug', 'Central Park Media', 'L.',
        'Studio Fantasia', 'Cranberry', 'Echo', 'Любительский'
    ];

    if (window.animehub_catalog_ready) return;
    window.animehub_catalog_ready = true;

    var catalogs = new WeakMap();
    var menuPositions = new WeakMap();
    var bookmarkGroupCache = new Map();
    var playback = new WeakMap();
    var playbackOrigins = new WeakMap();
    var canWatch = new WeakSet();
    var filterChoices = { tags: new Set(GENRES), studios: new Set(STUDIOS) };
    var eliteStudios = [];
    var catalogFilters = { sort: 'date' };
    var randomShelf;
    var checkingUpdate = false;
    var accountToken = '';
    var accountProfile = null;
    var profileRequest;
    var changingBookmark = false;
    var pendingVotes = new Set();
    var signingIn = false;
    var loginEmail = '';
    var loginPassword = '';
    var settingsRows = {};
    var accountEvents;

    function request(path, body, success, failure) {
        sendRequest(API + path, 'POST', body, 'json', success, failure);
    }

    function readProfile(renew) {
        if (!accountToken) return Promise.resolve(null);
        if (!renew && profileRequest) return profileRequest;
        var token = accountToken;
        var pending = new Promise(function (resolve) {
            request('users/info/personal_info', { token: token }, resolve, function () { resolve(null); });
        }).then(function (data) {
            if (accountToken !== token || profileRequest !== pending) return null;
            profileRequest = null;
            if (!data || !data.lists || typeof data.lists !== 'object' || Array.isArray(data.lists)) return null;
            accountProfile = data;
            accountEvents.send('change');
            return data;
        });
        profileRequest = pending;
        return pending;
    }

    function setAccount(token, profile) {
        accountToken = token;
        accountProfile = profile;
        profileRequest = null;
        bookmarkGroupCache.clear();
        loginPassword = '';
        Lampa.Storage.set(ACCOUNT_TOKEN, token);
        accountEvents.send('change');
    }

    function bookmarkIds(key, profile) {
        if (key === 'likes' || key === 'dislikes') return entryIds(profile && profile[key]);
        return entryIds(profile && profile.lists && profile.lists[key]);
    }

    function openBookmarkList(entry) {
        if (!accountToken) {
            Lampa.Noty.show('Войдите в HentaiHub в настройках AnimeHub.');
            return;
        }
        Lampa.Activity.push({
            component: BOOKMARK_HOME, source: SOURCE, url: '', page: 1,
            title: entry.title, animehubBookmark: entry.key
        });
    }

    function groupBookmarkCards(ids, cardsById) {
        var groups = new Map();
        ids.forEach(function (id) {
            var card = cardsById.get(id);
            if (!card) return;
            var studios = card.animehub_studios;
            var seen = new Set();
            (studios.length ? studios : ['']).forEach(function (studio) {
                var key = normalizeFilterName(studio);
                if (seen.has(key)) return;
                seen.add(key);
                if (!groups.has(key)) {
                    groups.set(key, { title: studio.replace(/\s+/g, ' ') || 'Без студии', cards: [] });
                }
                groups.get(key).cards.push(card);
            });
        });
        return groups;
    }

    function loadBookmarkGroups(key, profile) {
        var ids = bookmarkIds(key, profile);
        var signature = ids.join(',');
        var cached = bookmarkGroupCache.get(key);
        if (cached && cached.signature === signature) return cached.pending;
        var token = accountToken;
        var cardsById = new Map();
        var offset = 0;
        var failed = false;

        function fetchBatch() {
            if (failed || accountToken !== token || offset >= ids.length) return Promise.resolve();
            var batch = ids.slice(offset, offset + BOOKMARK_BATCH_SIZE);
            offset += BOOKMARK_BATCH_SIZE;
            return new Promise(function (resolve, reject) {
                request('news', { mode: 'short', ids: batch, page: 1, limit: batch.length }, function (data) {
                    var records = recordList(data);
                    if (records) resolve(records);
                    else reject();
                }, reject);
            }).then(function (records) {
                records.forEach(function (record) {
                    var card = catalogCard(record);
                    if (card) cardsById.set(card.animehub_id, card);
                });
                return fetchBatch();
            });
        }

        var workers = Math.min(3, Math.ceil(ids.length / BOOKMARK_BATCH_SIZE));
        var pending = Promise.all(Array.from({ length: workers }, fetchBatch)).then(function () {
            return accountToken === token ? groupBookmarkCards(ids, cardsById) : null;
        }).catch(function () {
            failed = true;
            var current = bookmarkGroupCache.get(key);
            if (current && current.pending === pending) bookmarkGroupCache.delete(key);
            return null;
        });
        bookmarkGroupCache.set(key, { signature: signature, pending: pending });
        return pending;
    }

    function loadBookmarkHome(object, success, failure) {
        if (!accountToken) { failure(); return; }
        var token = accountToken;
        var component = object.activity && object.activity.component;
        readProfile().then(function (profile) {
            return profile && token === accountToken ? loadBookmarkGroups(object.animehubBookmark, profile) : null;
        }).then(function (groups) {
            if (component && component.destroyed) return;
            if (token !== accountToken || !groups || !groups.size) {
                failure();
                return;
            }
            var sorted = Array.from(groups.entries()).sort(function (a, b) {
                if (!a[0]) return 1;
                if (!b[0]) return -1;
                return a[1].title.localeCompare(b[1].title, 'ru');
            });
            success(sorted.map(function (entry) {
                return {
                    title: escapeHtml(entry[1].title), source: SOURCE,
                    animehubBookmarkStudio: entry[0], animehubStudioTitle: entry[1].title,
                    results: entry[1].cards.slice(0, PAGE_SIZE),
                    total_pages: Math.ceil(entry[1].cards.length / PAGE_SIZE)
                };
            }));
        });
    }

    function loadBookmarkStudio(object, success, failure) {
        if (!accountToken) { failure(); return; }
        var page = Number(object.page) || 1;
        var component = object.activity && object.activity.component;
        var token = accountToken;
        var profile = accountProfile && accountProfile.lists ? Promise.resolve(accountProfile) : readProfile();
        profile.then(function (data) {
            return data && token === accountToken ? loadBookmarkGroups(object.animehubBookmark, data) : null;
        }).then(function (groups) {
            if (component && component.destroyed) return;
            if (token !== accountToken || !groups) {
                if (page > 1 && Number(object.page) === page) object.page = page - 1;
                failure();
                return;
            }
            var group = groups.get(object.animehubBookmarkStudio);
            var cards = group ? group.cards : [];
            var total = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
            if (component) component.total_pages = total;
            success({ results: cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page: page, total_pages: total });
        });
    }

    function bookmarkShelf() {
        return {
            title: '', source: SOURCE, total_pages: 1,
            results: BOOKMARKS.concat(VOTE_LISTS).map(function (entry) {
                return {
                    title: entry.title,
                    count: accountProfile && accountProfile.lists ? bookmarkIds(entry.key, accountProfile).length : '—',
                    limit: 0,
                    params: {
                        createInstance: function (item) {
                            return Lampa.Maker.make('Register', item, function (modules) {
                                return modules.only('Line', 'Callback');
                            });
                        },
                        emit: {
                            onlyEnter: function () { openBookmarkList(entry); },
                            onCreate: function () {
                                var tile = $(this.render(true));
                                this.animehubRefreshCount = function () {
                                    var count = accountProfile && accountProfile.lists ?
                                        bookmarkIds(entry.key, accountProfile).length : '—';
                                    tile.find('.register__counter').text(count);
                                };
                                accountEvents.follow('change', this.animehubRefreshCount);
                                this.animehubRefreshCount();
                            },
                            onDestroy: function () {
                                accountEvents.remove('change', this.animehubRefreshCount);
                            }
                        }
                    }
                };
            })
        };
    }

    function showBookmarks(movie, button) {
        var activity = Lampa.Activity.active();
        var controller = Lampa.Controller.enabled().name;
        function back() {
            if (Lampa.Activity.active() === activity) Lampa.Controller.toggle(controller);
        }
        if (!accountToken) {
            Lampa.Select.show({
                title: 'Закладки',
                items: [{ title: 'Войдите в HentaiHub в настройках AnimeHub', noenter: true }],
                onBack: back
            });
            return;
        }
        var token = accountToken;
        readProfile().then(function (profile) {
            if (Lampa.Activity.active() !== activity || token !== accountToken) return;
            if (!profile) {
                Lampa.Noty.show('Не удалось загрузить списки HentaiHub.');
                return;
            }
            var id = movie.animehub_id;
            function checked(entry) { return bookmarkIds(entry.key, accountProfile).includes(id); }
            var items = BOOKMARKS.map(function (entry) {
                return { title: entry.title, bookmark: entry, checkbox: true, checked: checked(entry) };
            });
            var drawn = new Map();
            showRememberedSelect('bookmarks', {
                title: 'Закладки',
                items: items,
                onDraw: function (element, item) { drawn.set(item.bookmark.key, { item: item, element: element }); },
                onBack: back,
                onCheck: function (item, element) {
                    var entry = item.bookmark;
                    var desired = item.checked;
                    item.checked = checked(entry);
                    element.toggleClass('selectbox-item--checked', item.checked);
                    if (changingBookmark || accountToken !== token || desired === item.checked) return;
                    changingBookmark = true;
                    var body = { token: token, newsId: id, list: desired ? entry.list : -1 };
                    if (!desired) body.targetList = String(entry.list);
                    else if (entry.key !== 'favorite') body.targetList = 'all_except_favorite';

                    function fail() {
                        changingBookmark = false;
                        if (accountToken === token) Lampa.Noty.show('Не удалось обновить закладки HentaiHub.');
                    }
                    request('users/lists', body, function (data) {
                        if (data && data.success === false) { fail(); return; }
                        if (accountToken !== token) { changingBookmark = false; return; }
                        readProfile(true).then(function (latest) {
                            changingBookmark = false;
                            if (accountToken !== token) return;
                            if (!latest) { fail(); return; }
                            drawn.forEach(function (row) {
                                row.item.checked = checked(row.item.bookmark);
                                row.element.toggleClass('selectbox-item--checked', row.item.checked);
                            });
                            if (button) updateBookmarkIcon(movie, button);
                            if (checked(entry) !== desired) fail();
                        });
                    }, fail);
                }
            }, activity);
        });
    }

    function updateBookmarkIcon(movie, button) {
        var stored = BOOKMARKS.some(function (entry) {
            return bookmarkIds(entry.key, accountProfile).includes(movie.animehub_id);
        });
        button.find('svg path').attr('fill', stored ? 'currentColor' : 'transparent');
    }

    function voteState(id, profile) {
        return {
            likes: bookmarkIds('likes', profile).includes(id),
            dislikes: bookmarkIds('dislikes', profile).includes(id)
        };
    }

    function castVote(movie, rating, refresh) {
        if (rating !== 1 && rating !== -1) return;
        if (!accountToken) {
            Lampa.Noty.show('Войдите в HentaiHub в настройках AnimeHub.');
            return;
        }
        var id = movie.animehub_id;
        if (pendingVotes.has(id)) return;
        var token = accountToken;
        pendingVotes.add(id);

        function done(message) {
            pendingVotes.delete(id);
            if (message && accountToken === token) Lampa.Noty.show(message);
        }

        readProfile().then(function (profile) {
            if (token !== accountToken) { done(); return; }
            if (!profile) { done('Не удалось загрузить голос HentaiHub.'); return; }
            var old = voteState(id, profile);
            var selected = rating === 1 ? old.likes : old.dislikes;
            var desired = selected ? 0 : rating;

            function confirm() {
                if (token !== accountToken) { done(); return; }
                readProfile(true).then(function (latest) {
                    if (token !== accountToken) { done(); return; }
                    var current = voteState(id, latest);
                    if (!latest || current.likes !== (desired === 1) || current.dislikes !== (desired === -1)) {
                        done('Не удалось подтвердить голос в HentaiHub.');
                        return;
                    }
                    if (Number.isSafeInteger(movie.animehub_likes) && Number.isSafeInteger(movie.animehub_dislikes)) {
                        movie.animehub_likes = Math.max(0, movie.animehub_likes + Number(current.likes) - Number(old.likes));
                        movie.animehub_dislikes = Math.max(0, movie.animehub_dislikes + Number(current.dislikes) - Number(old.dislikes));
                        movie.animehub_votes = movie.animehub_likes + movie.animehub_dislikes;
                    }
                    done();
                    refresh();
                });
            }

            // The APK sends the pressed polarity even when tapping it again to remove the vote.
            request('users/action/news_rating', { token: token, news_id: id, rating: rating }, confirm, confirm);
        });
    }

    function signIn() {
        if (signingIn || accountToken) return;
        if (!loginEmail || !loginPassword) {
            Lampa.Noty.show('Введите Email и пароль HentaiHub.');
            return;
        }
        var credentials = { email: loginEmail, password: loginPassword };
        loginPassword = '';
        signingIn = true;
        accountEvents.send('change');
        function fail() {
            signingIn = false;
            accountEvents.send('change');
            Lampa.Noty.show('Не удалось войти в HentaiHub. Проверьте Email и пароль.');
        }
        request('users/login', credentials, function (data) {
            if (!data || typeof data.token !== 'string' || !data.token) {
                fail();
                return;
            }
            signingIn = false;
            loginEmail = '';
            setAccount(data.token, data.user || null);
            focusAccountRow('logout');
            readProfile();
            Lampa.Noty.show('Вы вошли в HentaiHub.');
        }, fail);
    }

    function renderAccountSettings() {
        var signedIn = Boolean(accountToken);
        var user = accountProfile || {};
        var values = {
            email: loginEmail,
            password: loginPassword ? '********' : '',
            name: plain(user.name) || '—',
            profile_email: plain(user.email) || '—'
        };
        Object.keys(settingsRows).forEach(function (key) {
            var row = settingsRows[key];
            var show = /^(name|profile_email|logout)$/.test(key) === signedIn;
            // Settings binds its handlers once, including the action rows that start hidden.
            row.toggleClass('hide', !show);
            row.find('.settings-param__value').text(values[key] || '');
        });
    }

    function focusAccountRow(key) {
        if (Lampa.Controller.enabled().name !== 'settings_component') return;
        var row = settingsRows[key];
        var target = row && row[0];
        if (!target || !target.isConnected || target.offsetParent === null) return;
        var panel = target.parentElement;
        Lampa.Controller.collectionSet(panel, false, true);
        Lampa.Controller.collectionFocus(target, panel, true);
    }

    function installSettings() {
        Lampa.SettingsApi.addComponent({ component: SOURCE, name: NAME, icon: ICON });
        function section(key, label) {
            Lampa.SettingsApi.addParam({
                component: SOURCE, param: { name: key, type: 'title' }, field: { name: label }
            });
        }
        section('animehub_account', 'Аккаунт');
        function row(key, label, action) {
            Lampa.SettingsApi.addParam({
                component: SOURCE,
                param: { name: 'animehub_account_' + key, type: action ? 'button' : 'static' },
                field: { name: label },
                onChange: action,
                onRender: function (item) {
                    settingsRows[key] = item;
                    if (!action) item.removeClass('selector');
                    if (!item.find('.settings-param__value').length) {
                        item.append('<div class="settings-param__value"></div>');
                    }
                    renderAccountSettings();
                    if (key === 'name' && accountToken && !(accountProfile && accountProfile.lists)) readProfile();
                }
            });
        }
        row('email', 'Email', function () {
            editText({ title: 'Email', value: loginEmail, nomic: true, nosave: true }, function (value) {
                if (value !== null) loginEmail = value;
                renderAccountSettings();
            });
        });
        row('password', 'Пароль', function () {
            editText({ title: 'Пароль', value: loginPassword, nomic: true, nosave: true }, function (value) {
                if (value !== null) loginPassword = value;
                renderAccountSettings();
            });
        });
        row('login', 'Выполнить вход', signIn);
        row('name', 'Логин');
        row('profile_email', 'Email');
        row('logout', 'Выйти из аккаунта', function () {
            setAccount('', null);
            focusAccountRow('email');
        });
        section('animehub_more', 'Еще');
        Lampa.SettingsApi.addParam({
            component: SOURCE,
            param: { name: UPDATE_SETTING, type: 'select', values: { yes: 'Да', no: 'Нет' }, default: 'yes' },
            field: { name: 'Проверить обновление', description: 'Версия APK: ' + HENTAIHUB_VERSION }
        });
        Lampa.SettingsApi.addParam({
            component: SOURCE,
            param: { name: 'animehub_about', type: 'static' },
            field: { name: 'О плагине', description: 'Версия: ' + VERSION }
        });
        accountEvents.follow('change', renderAccountSettings);
    }

    function hasAndroidBridge() {
        var bridge = window.AndroidJS;
        return Lampa.Platform.is('android') && bridge && typeof bridge.httpReq === 'function';
    }

    function sendRequest(url, method, body, type, success, failure, timeout) {
        var android = hasAndroidBridge();
        if (!android && !Lampa.Platform.is('tizen')) {
            Lampa.Noty.show('Для AnimeHub нужна Lampa на Android или установленная Lampa на Tizen.');
            failure();
            return;
        }

        var network = new Lampa.Reguest();
        var settled = false;
        var timer;

        function finish(callback) {
            return function (data) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                network.clear();
                callback(data);
            };
        }

        var fail = finish(failure);
        var complete = finish(function (data) {
            if (type === 'json' && typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (error) {
                    failure();
                    return;
                }
            }
            success(data);
        });

        timeout = timeout || TIMEOUT;
        timer = setTimeout(fail, timeout + 2000);
        try {
            var transport = android ? 'native' : 'silent';
            network[transport](url, complete, fail, body ? JSON.stringify(body) : undefined, {
                type: method,
                dataType: type,
                headers: body ? { 'Content-Type': 'application/json' } : {},
                timeout: timeout
            });
        } catch (error) {
            fail();
        }
    }

    function httpsUrl(value) {
        if (typeof value !== 'string' || !value.trim()) return '';
        try {
            var url = new URL(value, API);
            return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    function imageUrl(value, preferThumb) {
        if (typeof value === 'string') return httpsUrl(value);
        return value ? (preferThumb && httpsUrl(value.thumb)) || httpsUrl(value.url) : '';
    }

    function plain(value) {
        if (typeof value !== 'string') return '';
        var text = document.createElement('textarea');
        text.innerHTML = value.replace(/<br\s*\/?>|<\/p\s*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/</g, '&lt;');
        return text.value.trim();
    }

    function escapeHtml(value) {
        return value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function latinTitle(value) {
        return /[A-Za-z]/.test(value) && !/[А-Яа-яЁё\u3040-\u30ff\u3400-\u9fff]/.test(value);
    }

    function detailTitles(title, alternatives) {
        var slash = title.indexOf('/');
        if (slash !== -1) {
            var heading = title.slice(0, slash).trim();
            var subtitle = title.slice(slash + 1).trim();
            return { title: heading || subtitle || title, subtitle: heading ? subtitle : '' };
        }

        var parts = title.split(/\s*\|\s*/).map(function (part) { return part.trim(); });
        var english = parts.length > 1 && /[А-Яа-яЁё]/.test(parts[0]) &&
            parts.slice(1).find(latinTitle);
        if (english) {
            return { title: parts[0], subtitle: english };
        }

        english = plain(alternatives).split(/\s+\/\s+|[|;\n]/).map(function (part) {
            return part.trim();
        }).find(latinTitle);

        return { title: title, subtitle: english && english.toLowerCase() !== title.toLowerCase() ? english : '' };
    }

    function releaseDate(fields) {
        var date = String(fields.release_date || '');
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
        var year = String(fields.year || '');
        return /^\d{4}$/.test(year) ? year : '';
    }

    function recordList(data) {
        if (Array.isArray(data)) return data;
        return data && data.id != null ? [data] : null;
    }

    function names(value, delimiter) {
        var list = Array.isArray(value) ? value : plain(value).split(delimiter);
        return Array.from(new Set(list.map(plain).filter(Boolean)));
    }

    function entryIds(value) {
        var list = Array.isArray(value) ? value : String(value || '').split(/[\s,]+/);
        return Array.from(new Set(list.map(Number).filter(function (id) {
            return Number.isSafeInteger(id) && id > 0;
        })));
    }

    function isManga(value) {
        return /(?:^|[\s,/|(\[—–-])(?:манга|manga)(?=$|[\s,/:|)\]—–-])/i.test(plain(value));
    }

    function episodeNumber(record, title) {
        var fields = record.xfields_data || {};
        var number = [record.episode_number, fields.episode_number, record.episode, fields.episode].find(function (value) {
            return /^\d{1,4}$/.test(String(value));
        });
        if (number !== undefined) return Number(number);

        var parts = title.split(/\s+\/\s+|\s*\|\s*/);
        var explicit = /(?:^|[\s([,;:—–-])(?:эп(?:изод)?\.?|серия|ep(?:isode)?\.?)\s*[№#]?\s*(\d{1,4})(?!\d)|(?:^|[\s([,;:—–-])(\d{1,4})(?:-я)?\s+(?:серия|эпизод)(?=$|[\s)\].,!?:;])|(?:^|[\s([,;:—–-])S\d{1,3}E(\d{1,4})(?!\d)/i;
        for (var i = 0; i < parts.length; i++) {
            var match = explicit.exec(parts[i]);
            if (match) return Number(match[1] || match[2] || match[3]);
        }
        for (var j = parts.length - 1; j >= 0; j--) {
            var suffix = /(\d+)\s*[\])]?\s*[.!?…]*$/.exec(parts[j]);
            if (suffix && Number.isSafeInteger(Number(suffix[1]))) return Number(suffix[1]);
        }
        return null;
    }

    function decoratePoster(poster, episode) {
        poster.find('.card__type').filter(function () { return /^adult$/i.test($(this).text().trim()); }).remove();
        if (episode != null) {
            poster.append($('<div class="card__vote"></div>').text('эп.' + episode));
        }
    }

    function decorateCover() {
        decoratePoster($(this.render(true)).find('.card__view'), this.data.animehub_episode);
    }

    function setupTitleCover() {
        decorateCover.call(this);
        var card = this.data;
        // Lampa's Menu module leaves long press unhandled when it has no actions.
        if (Array.isArray(this.menu_list)) this.menu_list.length = 0;
        $(this.render(true)).on('hover:long', function () { showBookmarks(card); });
    }

    function collectionCard(record) {
        if (!record || !/^\d+$/.test(String(record.id))) return null;
        var title = plain(record.title);
        var ids = entryIds(record.news_lists);
        if (!title || !ids.length || isManga(title)) return null;
        return {
            id: SOURCE + ':collection:' + record.id,
            source: SOURCE,
            title: title,
            poster: httpsUrl(record.img_link),
            animehubCollection: ids,
            adult: true,
            restrict: 18,
            params: { style: { name: 'collection' }, emit: { onCreate: decorateCover } }
        };
    }

    function catalogCard(record) {
        if (!record || !/^\d+$/.test(String(record.id)) || isManga(record.category)) return null;
        var fields = record.xfields_data || {};
        var studios = names(fields.studios, /\s*[,;|]\s*|\s+\/\s+/);
        if (plain(record.category).toLowerCase() === 'неизвестно' &&
            !studios.length && !plain(fields.translate_type)) return null;

        var title = plain(record.title);
        if (!title || /^(?:\[(?:манга|manga)\]|(?:манга|manga)\s*[:—–-])/i.test(title)) return null;

        return {
            id: SOURCE + ':' + record.id,
            animehub_id: Number(record.id),
            animehub_studios: studios,
            animehub_episode: episodeNumber(record, title),
            source: SOURCE,
            media_type: 'movie',
            title: title,
            release_date: releaseDate(fields),
            poster: imageUrl(fields.poster, true),
            adult: true,
            restrict: 18,
            params: { emit: { onCreate: setupTitleCover } }
        };
    }

    function fullCard(record) {
        var card = catalogCard(record);
        var fields = record.xfields_data || {};
        var titles = detailTitles(card.title, fields.alt_titles);
        var description = plain(record.full_story);

        card.title = escapeHtml(titles.title);
        card.original_title = escapeHtml(titles.subtitle);
        card.tagline = card.original_title;
        card.overview = escapeHtml(description);
        card.animehub_translation = plain(fields.translate_type);
        card.poster = imageUrl(fields.poster, false);
        card.img = card.poster || './img/img_broken.svg';
        card.background_image = imageUrl(fields.screen, false);
        card.runtime = Math.max(0, Math.round((Number(fields.duration) || 0) / 60));
        card.genres = names(fields.hentai_tags, /\s*[,;|]\s*/).filter(function (tag) {
            return normalizeFilterName(tag) !== 'русская озвучка';
        }).map(function (tag) {
            return { id: tag, name: escapeHtml(tag) };
        });
        card.production_companies = [];
        card.production_countries = [];
        card.vote_average = 0;
        card.animehub_views = countValue(record.news_read);
        card.animehub_votes = countValue(record.vote_num);
        var rating = countValue(record.rating);
        if (rating !== null && card.animehub_votes !== null && Math.abs(rating) <= card.animehub_votes) {
            card.animehub_likes = Math.round((card.animehub_votes + rating) / 2);
            card.animehub_dislikes = card.animehub_votes - card.animehub_likes;
        }
        return card;
    }

    function countValue(value) {
        if (value == null || value === '') return null;
        var number = Number(value);
        return Number.isSafeInteger(number) ? number : null;
    }

    function genreTag(object) {
        return (object.animehubFilters || {}).tags || object.genres;
    }

    function listing(object, page) {
        var body = { mode: 'short', page: page, limit: PAGE_SIZE };
        var ids = object.animehubBookmark ? (catalogs.get(object) || {}).bookmarkIds || [] : object.animehubCollection;
        if (object.animehubSearch) {
            return { path: 'search', body: { search: object.animehubSearch }, total: 1 };
        }
        if (object.animehubFilters || object.animehubPeriod || object.genres || object.companies) {
            var filters = object.animehubFilters || {};
            var tag = genreTag(object);
            var studio = filters.studios || object.companies;
            var sort = filters.sort === 'duration' ? 'date' : filters.sort;
            if (tag) body.tags = [String(tag)];
            if (studio) body.studios = [String(studio)];
            if (filters.year) body.yearFrom = body.yearTo = filters.year;
            if (sort || object.animehubPeriod) body.sort = object.animehubPeriod || sort;
            return { path: 'filter', body: body };
        }
        if (object.url === 'rand') {
            body.sort = 'rand';
            body.page = ((object.animehubRandomPage || 1) + page - 2) % RANDOM_PAGES + 1;
            body.skipCache = true;
            if (object.animehubRandomPage) body.refresh = true;
            return { path: 'news', body: body, total: object.component === RANDOM || object.animehubShelf ? INITIAL_PAGES : 1 };
        }
        if (object.url === 'collections') {
            return { path: 'users/collections/list', body: { page: page, limit: PAGE_SIZE }, collections: true };
        }
        if (Array.isArray(ids)) {
            body.ids = ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
            body.limit = body.ids.length;
            body.page = 1;
            return { path: 'news', body: body, total: Math.ceil(ids.length / PAGE_SIZE) };
        }
        if (SECTIONS.some(function (section) { return section.url === object.url; })) body.sort = object.url;
        return { path: 'news', body: body };
    }

    function loadList(object, success, failure) {
        if (object.animehubBookmark && typeof object.animehubBookmarkStudio === 'string') {
            loadBookmarkStudio(object, success, failure);
            return;
        }
        var firstPage = Number(object.page) || 1;
        var component = object.activity && object.activity.component;
        var state = catalogs.get(object);
        if (!state || state.component !== component) {
            state = { component: component, ids: new Set(), lastPage: 0, prefetched: new Map() };
            if (object.animehubBookmark) state.bookmarkIds = bookmarkIds(object.animehubBookmark, accountProfile);
            catalogs.set(object, state);
        }
        var visited = new Set();
        var random = object.component === RANDOM;
        var filters = object.animehubFilters || {};
        var countVisible = !object.animehubSearch &&
            Boolean(genreTag(object) || filters.sortSelected || (filters.sort && filters.sort !== 'date'));
        var visiblePageSize = firstPage === 1 ? FILTER_FIRST_PAGE_SIZE : PAGE_SIZE;
        var lastInitialPage = random && firstPage === 1 ? INITIAL_PAGES : firstPage;
        var results = countVisible && state.visibleBuffer ? state.visibleBuffer.slice() : [];
        var completed = 0;
        var totalPages = 1;

        function isCurrent() {
            return catalogs.get(object) === state && !(component && component.destroyed);
        }

        function prefetch(page) {
            var last = listing(object, page).total || INITIAL_PAGES;
            for (var next = page + 1; next <= Math.min(last, INITIAL_PAGES); next++) {
                var query = listing(object, next);
                if (query.body.ids && !query.body.ids.length) break;
                state.prefetched.set(next, new Promise(function (resolve) {
                    request(query.path, query.body, resolve, function () { resolve(null); });
                }));
            }
        }

        function fail() {
            if (!isCurrent()) return;
            if (completed && results.length) {
                finish(completed, totalPages);
                return;
            }
            if (firstPage > state.lastPage && state.lastPage > 0 && Number(object.page) === firstPage) {
                object.page = state.lastPage;
            }
            failure();
        }

        function finish(page, total) {
            var lastApiPage = page;
            if (countVisible) {
                // Keep the extra visible cards from the last API page for the next Lampa page.
                state.visibleNextPage = lastApiPage + 1;
                state.visibleExhausted = total <= lastApiPage;
                state.visibleBuffer = results.splice(visiblePageSize);
                page = firstPage;
                total = page + Number(!state.visibleExhausted || state.visibleBuffer.length > 0);
            }
            state.lastPage = page;
            object.page = page;
            if (random) total = page;
            if (component) component.total_pages = total;
            if (random) results.push(randomReloadCard());
            success({ results: results, page: page, total_pages: total });
            if (firstPage === 1 && object.component && !random && total > page && !state.visibleExhausted && isCurrent()) {
                prefetch(lastApiPage);
            }
        }

        function accept(cards, page, total) {
            results.push.apply(results, cards);
            completed = page;
            totalPages = total;
            var needsCards = countVisible ? results.length < visiblePageSize : object.animehubShelf && results.length < PAGE_SIZE;
            if (page < total && (page < lastInitialPage || needsCards)) load(page + 1);
            else finish(page, total);
        }

        function load(page) {
            var query = listing(object, page);
            if (query.body.ids && !query.body.ids.length) {
                finish(page, query.total || 1);
                return;
            }

            function consume(data) {
                if (!isCurrent()) return;
                var records = query.collections ? data && data.playlists : recordList(data);
                if (!Array.isArray(records)) {
                    fail();
                    return;
                }
                var cards = [];
                records.forEach(function (record) {
                    var card = query.collections ? collectionCard(record) : catalogCard(record);
                    if (!card || state.ids.has(card.id)) return;
                    state.ids.add(card.id);
                    if (!query.collections) collectFilters(record.xfields_data || {});
                    cards.push(card);
                });
                if (query.body.ids) {
                    var order = new Map(query.body.ids.map(function (id, index) { return [id, index]; }));
                    cards.sort(function (a, b) { return order.get(a.animehub_id) - order.get(b.animehub_id); });
                }
                var total = query.total || page + Number(records.length >= query.body.limit);
                if (!cards.length && page < total && !random) {
                    var signature = records.map(function (record) { return record && record.id; }).sort().join(',');
                    if (visited.has(signature)) total = page;
                    else {
                        visited.add(signature);
                        if (!countVisible && page >= lastInitialPage && !results.length && !object.animehubShelf) {
                            load(page + 1);
                            return;
                        }
                    }
                }
                accept(cards, page, total);
            }

            var cached = state.prefetched.get(page);
            state.prefetched.delete(page);
            if (!cached) {
                request(query.path, query.body, consume, fail);
                return;
            }
            cached.then(function (data) {
                if (!isCurrent()) return;
                if (data == null) request(query.path, query.body, consume, fail);
                else consume(data);
            });
        }

        if (random && object.animehubUseShelf && randomShelf && randomShelf.results.length) {
            randomShelf.results.forEach(function (card) { state.ids.add(card.id); });
            accept(randomShelf.results, randomShelf.page, INITIAL_PAGES);
        } else if (countVisible && state.visibleExhausted) {
            finish(state.visibleNextPage - 1, state.visibleNextPage - 1);
        } else load(countVisible && state.visibleNextPage ? state.visibleNextPage : firstPage);
    }

    function fetchShelf(section, done) {
        loadList({ url: section.url, page: 1, animehubShelf: true }, function (data) {
            if (section.url === 'rand') randomShelf = data;
            var hasMore = data.results.length > PAGE_SIZE || section.url === 'rand' || section.url === 'news_read';
            done({
                title: section.title,
                source: SOURCE,
                url: section.url,
                results: data.results.slice(0, PAGE_SIZE),
                total_pages: Math.max(data.total_pages, hasMore ? 2 : 1)
            });
        }, function () { done(null); });
    }

    function loadHome(object, success, failure) {
        if (object.component === BOOKMARK_HOME) {
            loadBookmarkHome(object, success, failure);
            return;
        }
        readProfile();
        var component = object.activity && object.activity.component;
        var pending = SECTIONS.length;
        var sections = new Array(pending);
        SECTIONS.forEach(function (section, index) {
            fetchShelf(section, function (data) {
                sections[index] = data;
                if (--pending) return;
                if (component && component.destroyed) return;
                if (Lampa.Platform.is('tizen') && !sections.some(Boolean)) {
                    Lampa.Noty.show('AnimeHub: не удалось подключиться к API из Lampa на Tizen.');
                }
                var available = sections.filter(function (row) { return row && row.results.length; });
                available.unshift(bookmarkShelf());
                success(available);
            });
        });
    }

    function openCollection(card) {
        Lampa.Activity.push({
            component: 'category_full', source: SOURCE, url: '', page: 1,
            title: card.title, animehubCollection: card.animehubCollection
        });
    }

    function collectionEnter(card, data) {
        if (data.animehubCollection) {
            card.use({ onlyEnter: function () { openCollection(data); } });
        }
    }

    function mainComponent(name, object, hooks) {
        var Native = Lampa.Component.get(name);
        var component = new Native(object);
        component.use(hooks);
        return component;
    }

    function animeHome(object) {
        return mainComponent('category', object, {
            onInstance: function (line, data) {
                if (data.url === 'rand') {
                    line.use({
                        onlyMore: function () {
                            Lampa.Activity.push({
                                component: RANDOM, source: SOURCE, url: data.url, page: 1, title: data.title,
                                animehubUseShelf: true
                            });
                        }
                    });
                    return;
                }
                if (data.url === 'news_read') {
                    line.use({
                        onlyMore: function () {
                            Lampa.Activity.push({
                                component: POPULAR, source: SOURCE, url: data.url, page: 1, title: data.title
                            });
                        }
                    });
                    return;
                }
                if (data.url !== 'collections') return;
                line.use({
                    onInstance: collectionEnter,
                    onlyMore: function () {
                        var cover = $(this.render(true)).find('.card--collection')[0];
                        Lampa.Activity.push({
                            component: COLLECTIONS, source: SOURCE, url: 'collections', page: 1, title: data.title,
                            animehubCollectionWidth: cover && window.getComputedStyle(cover).width
                        });
                    }
                });
            }
        });
    }

    function animeBookmarkHome(object) {
        return mainComponent('category', object, {
            onInstance: function (line, data) {
                line.use({
                    onlyMore: function () {
                        Lampa.Activity.push({
                            component: 'category_full', source: SOURCE, url: '', page: 1, title: data.animehubStudioTitle,
                            animehubBookmark: object.animehubBookmark,
                            animehubBookmarkStudio: data.animehubBookmarkStudio
                        });
                    }
                });
            }
        });
    }

    function animeCollections(object) {
        return mainComponent('category_full', object, {
            onInstance: function (card, data) {
                collectionEnter(card, data);
                if (!object.animehubCollectionWidth) return;
                card.use({
                    onCreate: function () { $(this.render(true)).css('width', object.animehubCollectionWidth); }
                });
            }
        });
    }

    function randomReloadCard() {
        return {
            id: SOURCE + ':random:reload',
            source: SOURCE,
            title: 'Загрузить другое',
            animehubRandomReload: true,
            params: {
                emit: {
                    onCreate: function () {
                        var view = $(this.render(true)).find('.card__view');
                        view.find('.card__img').css('visibility', 'hidden');
                        view.css({
                            position: 'relative',
                            backgroundColor: '#292a2f'
                        }).append($('<img alt="" draggable="false">').attr('src', DICE_ICON).css({
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: '48%',
                            height: 'auto',
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none'
                        }));
                    }
                }
            }
        };
    }

    function animeRandom(object) {
        return mainComponent('category_full', object, {
            onInstance: function (card, data) {
                if (!data.animehubRandomReload) return;
                card.use({
                    onlyEnter: function () {
                        // Repeated requests for the same API page can return the cached sequence.
                        var currentPage = object.animehubRandomPage || 1;
                        Lampa.Activity.replace({
                            page: 1, animehubUseShelf: false,
                            animehubRandomPage: (currentPage - 1 + INITIAL_PAGES) % RANDOM_PAGES + 1
                        });
                    }
                });
            }
        });
    }

    function animePopular(object) {
        return mainComponent('category_full', object, {
            onlyRight: function () {
                if (Lampa.Activity.active() === object) showPopular(object);
            }
        });
    }

    function showPopular(object) {
        function back() { restoreFocus(object); }
        showRememberedSelect('period', {
            title: 'Популярные',
            items: PERIODS.map(function (period) {
                return { title: period.title, period: period, selected: period.value === object.animehubPeriod };
            }),
            onBack: back,
            onSelect: function (entry) {
                if (Lampa.Activity.active() !== object) return;
                if (entry.period.value === object.animehubPeriod) {
                    back();
                    return;
                }
                var next = {
                    component: POPULAR,
                    source: SOURCE,
                    url: 'news_read',
                    page: 1,
                    title: 'Популярные · ' + entry.period.title.toLowerCase(),
                    animehubPeriod: entry.period.value
                };
                if (object.animehubPeriod) Lampa.Activity.replace(next);
                else Lampa.Activity.push(next);
            }
        }, object);
    }

    function showRememberedSelect(key, options, activity) {
        activity = activity || Lampa.Activity.active();
        if (!activity) {
            Lampa.Select.show(options);
            return;
        }
        var positions = menuPositions.get(activity);
        if (!positions) {
            positions = new Map();
            menuPositions.set(activity, positions);
        }
        var previous = positions.get(key);
        function isPrevious(item) {
            return !item.separator && normalizeFilterName(item.title) === previous;
        }
        if (previous && options.items.some(isPrevious)) {
            options.items = options.items.map(function (item) {
                if (item.separator) return item;
                return Object.assign({}, item, {
                    picked: item.picked || item.selected,
                    selected: isPrevious(item)
                });
            });
            options.nomark = true;
        }
        var onSelect = options.onSelect;
        options.onFocus = function (item) { positions.set(key, normalizeFilterName(item.title)); };
        if (onSelect) options.onSelect = function (item) {
            positions.set(key, normalizeFilterName(item.title));
            return onSelect.apply(this, arguments);
        };
        Lampa.Select.show(options);
    }

    function collectFilters(fields) {
        names(fields.hentai_tags, /\s*[,;|]\s*/).forEach(function (tag) { filterChoices.tags.add(tag); });
        names(fields.studios, /\s*[,;|]\s*|\s+\/\s+/).forEach(function (studio) { filterChoices.studios.add(studio); });
    }

    function editText(options, done) {
        var cancelled = false;
        var keyboard = Lampa.Input.edit(options, function (input) {
            // Input calls back for both Enter and Back. Let the Back listener run first.
            Promise.resolve().then(function () {
                done(cancelled ? null : String(input || '').trim());
            });
        });
        keyboard.listener.follow('back', function () { cancelled = true; });
    }

    function editFilterText(title, value, done) {
        editText({
            title: title, value: value || '', keyboard: 'lampa', layout: 'clarify', align: 'center', nosave: true
        }, done);
        if (title === 'Поиск') centerSearchKeyboard();
    }

    function centerSearchKeyboard() {
        var overlay = $('.settings-input').last();
        var inner = overlay.find('.settings-input__content');
        var surfaces = [inner[0], overlay[0], document.body];
        var color = surfaces.map(function (surface) {
            return surface && window.getComputedStyle(surface).backgroundColor;
        }).find(function (value) {
            return value && value !== 'transparent' && !/^rgba\(.*?,\s*0\)$/.test(value);
        });
        // Make the theme color opaque to cover the catalog behind the keyboard.
        if (color) color = color.replace(/^rgba\(([^,]+,[^,]+,[^,]+),[^)]+\)$/, 'rgb($1)');
        overlay.css({
            position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
            width: '100%', height: '100%', padding: 0, boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: color || '#202024', backdropFilter: 'none', transform: 'none'
        });
        inner.css({
            position: 'relative', top: 'auto', right: 'auto', bottom: 'auto', left: 'auto',
            margin: 0, transform: 'none', maxWidth: '94vw', maxHeight: '94vh',
            background: 'transparent', boxShadow: 'none'
        });
    }

    function selectFilter(title, key, options, draft, back, manual) {
        var items = options.map(function (option) {
            if (option.separator) return { title: option.title, separator: true };
            return { title: escapeHtml(option.title), value: option.value, selected: option.value === draft[key] };
        });
        if (manual) items.push({ title: 'Ввести вручную', manual: true });
        showRememberedSelect('filter:' + key, {
            title: title,
            items: items,
            onBack: back,
            onSelect: function (entry) {
                if (entry.manual) {
                    editFilterText(title, draft[key], function (input) {
                        if (input) {
                            var normalized = normalizeFilterName(input);
                            var match = options.find(function (option) {
                                return !option.separator && normalizeFilterName(option.title) === normalized;
                            });
                            draft[key] = match ? match.value : input;
                        }
                        back();
                    });
                    return;
                }
                draft[key] = entry.value;
                if (key === 'sort') draft.sortSelected = true;
                back();
            }
        });
    }

    function normalizeFilterName(name) {
        return name.trim().replace(/\s+/g, ' ').toLowerCase();
    }

    function loadEliteStudios(done) {
        sendRequest(ELITE_STUDIOS + '?t=' + Date.now(), 'GET', null, 'text', function (data) {
            if (typeof data === 'string') {
                eliteStudios = data.split(/\r?\n/).map(normalizeFilterName).filter(Boolean);
            }
            done();
        }, done, 4000);
    }

    function filterOptions(key) {
        var sorted = Array.from(filterChoices[key]).sort(function (a, b) {
            return a.localeCompare(b, 'ru');
        });
        function option(value) {
            return { title: value.replace(/\s+/g, ' '), value: value };
        }
        var options = [{ title: 'Все', value: '' }];
        if (key !== 'studios') return options.concat(sorted.map(option));

        var known = new Map();
        sorted.forEach(function (value) {
            var name = normalizeFilterName(value);
            if (!known.has(name) || value.indexOf('\u00a0') !== -1) known.set(name, value);
        });
        var favorites = [];
        eliteStudios.forEach(function (name) {
            if (!known.has(name)) return;
            favorites.push(option(known.get(name)));
            known.delete(name);
        });
        if (favorites.length) {
            options = options.concat({ title: 'Избранные', separator: true }, favorites);
            if (known.size) options.push({ title: 'Остальные', separator: true });
        }
        return options.concat(Array.from(known.values(), option));
    }

    function filterYears() {
        var options = [{ title: 'Любой', value: 0 }];
        for (var year = new Date().getFullYear() + 1; year >= 1900; year--) {
            options.push({ title: String(year), value: year });
        }
        return options;
    }

    function showCatalogFilter(activity, draft) {
        if (Lampa.Activity.active() !== activity) return;
        function repeat() { showCatalogFilter(activity, draft); }
        function select(title, key, options, manual) {
            return function () { selectFilter(title, key, options(), draft, repeat, manual); };
        }
        function search() {
            editFilterText('Поиск', activity.animehubSearch, function (query) {
                if (Lampa.Activity.active() !== activity) return;
                if (!query) {
                    repeat();
                    return;
                }
                openFilter('Поиск AnimeHub', 'animehubSearch', query);
            });
        }
        function studios() {
            loadEliteStudios(function () {
                if (Lampa.Activity.active() === activity) {
                    selectFilter('Студия', 'studios', filterOptions('studios'), draft, repeat, true);
                }
            });
        }
        var sort = SORT_OPTIONS.find(function (option) { return option.value === draft.sort; }) || SORT_OPTIONS[0];
        var items = [
            { title: 'Поиск', action: search },
            { title: 'Жанры', subtitle: escapeHtml(draft.tags || 'Все'), action: select('Жанры', 'tags', function () { return filterOptions('tags'); }, true) },
            { title: 'Студия', subtitle: escapeHtml(draft.studios || 'Все'), action: studios },
            { title: 'Год выпуска', subtitle: String(draft.year || 'Любой'), action: select('Год выпуска', 'year', filterYears) },
            { title: 'Сортировка', subtitle: sort.title, action: select('Сортировка', 'sort', function () { return SORT_OPTIONS; }) }
        ];
        items.push(
            { title: 'Показать', action: function () {
                catalogFilters = Object.assign({}, draft);
                openFilter('Фильтр AnimeHub', 'animehubFilters', catalogFilters);
            } },
            { title: 'Сбросить', action: function () {
                catalogFilters = { sort: 'date' };
                draft = { tags: '', studios: '', year: 0, sort: catalogFilters.sort };
                repeat();
            } }
        );
        showRememberedSelect('filter', {
            title: 'Фильтр',
            items: items,
            onBack: function () { Lampa.Controller.toggle('head'); },
            onSelect: function (entry) { entry.action(); }
        }, activity);
    }

    function installHeaderFilter() {
        var filter = Lampa.Head.addIcon('<svg><use xlink:href="#sprite-filter"></use></svg>', function () {
            var activity = Lampa.Activity.active();
            if (activity && activity.source === SOURCE) {
                showCatalogFilter(activity, Object.assign({ tags: '', studios: '', year: 0 }, catalogFilters));
            }
        }).addClass('animehub-header-filter').attr({ title: 'Фильтр', 'aria-label': 'Фильтр' });

        function sync(activity) {
            var visible = Boolean(activity && activity.source === SOURCE);
            filter.toggleClass('hide', !visible).toggleClass('selector', visible);
            var search = Lampa.Head.render().find('.open--search').first();
            if (search.length && filter.next()[0] !== search[0]) filter.insertBefore(search);
        }
        sync(Lampa.Activity.active());
        Lampa.Listener.follow('activity', function (event) {
            if (event.type === 'start') sync(event.object);
            if (event.type === 'destroy') setTimeout(function () { sync(Lampa.Activity.active()); }, 0);
        });
    }

    function commentPage(id, page, done) {
        request('comments/news', { postId: id, page: page, limit: 12 }, function (data) {
            var entries = recordList(data);
            if (!entries) {
                done(null);
                return;
            }
            var comments = entries.map(function (item) {
                if (!item || item.id == null) return null;
                var text = plain(item.text);
                return text ? {
                    id: item.id, text: text, author: plain(item.autor) || 'Гость',
                    date: plain(item.date), likes: countValue(item.rating), animehubComment: true,
                    params: {}
                } : null;
            }).filter(Boolean);
            done({ results: comments, total_pages: page + Number(entries.length >= 12 && comments.length > 0) });
        }, function () { done(null); });
    }

    function appendComment(owner, entry, full) {
        var review = Lampa.Maker.make('Discuss', {
            text: escapeHtml(entry.text),
            like_count: entry.likes == null ? '' : entry.likes,
            params: { line: { full_text: full } }
        }, function (modules) { return modules.only('Line'); });
        review.create();
        var html = $(review.render(true));
        html.find('.full-review__text').text(entry.text);
        html.find('.full-review__footer').text(
            [entry.author, entry.date, entry.likes == null ? '' : 'Оценка ' + entry.likes].filter(Boolean).join(' · ')
        );
        html.on('hover:enter', function () {
            var controller = Lampa.Controller.enabled().name;
            Lampa.Select.show({
                title: entry.author,
                items: [],
                onFullDraw: function (scroll) {
                    scroll.body().prepend($('<div class="selectbox__text selector"></div>').text(entry.text));
                },
                onBack: function () { Lampa.Controller.toggle(controller); }
            });
        });
        owner.emit('append', review, entry);
    }

    function openComments(movie) {
        Lampa.Activity.push({
            component: COMMENTS, source: SOURCE, url: '', page: 1,
            title: 'Комментарии', id: movie.animehub_id
        });
    }

    function animeComments(object) {
        Lampa.Arrays.extend(object, { params: { items: { mapping: 'list' } } });
        var component = Lampa.Maker.make('Category', object, function (modules) {
            return modules.only('Explorer', 'Next', 'Empty', 'Items');
        });

        function load(resolve, reject) {
            var page = object.page;
            commentPage(object.id, page, function (data) {
                if (component.destroyed) return;
                if (!data) {
                    if (page > 1) object.page = page - 1;
                    reject();
                    return;
                }
                component.total_pages = data.total_pages;
                resolve(data);
            });
        }

        component.use({
            onCreate: function () { load(this.build.bind(this), this.empty.bind(this)); },
            onNext: load,
            onCreateAndAppend: function (entry) { appendComment(this, entry, true); }
        });
        return component;
    }

    function enrichFull(record, movie, success) {
        var result = { movie: movie };
        var pending = 3;
        var finished = false;
        var timeout = setTimeout(complete, 5000);

        function complete() {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            success(result);
        }

        function done() {
            if (--pending === 0) complete();
        }

        commentPage(movie.animehub_id, 1, function (data) {
            if (!finished && data && data.results.length) {
                result.discuss = {
                    result: data.results,
                    total_pages: data.total_pages,
                    animehubComments: true
                };
            }
            done();
        });

        function cards(items) {
            return (recordList(items) || []).map(catalogCard).filter(function (card) {
                return card && card.id !== movie.id;
            });
        }

        request('series', { id: movie.animehub_id }, function (data) {
            var items = cards(data && data.items);
            if (!finished && items.length) {
                result.collection = { results: items, total_pages: 1, animehubRelated: true };
            }
            done();
        }, done);

        var ids = entryIds(record.related_ids).filter(function (id) { return id !== movie.animehub_id; })
            .slice(0, RELATED_LIMIT);
        if (!ids.length) {
            done();
            return;
        }
        request('news', { mode: 'short', ids: ids, page: 1, limit: ids.length }, function (data) {
            var byId = new Map(cards(data).map(function (card) { return [card.animehub_id, card]; }));
            var items = ids.map(function (id) { return byId.get(id); }).filter(Boolean);
            if (!finished && items.length) result.recomend = {
                results: items, total_pages: 1, animehubRecommended: true
            };
            done();
        }, done);
    }

    function loadFull(object, success, failure) {
        var component = object.activity && object.activity.component;
        function fail() {
            if (!component || !component.destroyed) failure();
        }

        var id = Number((object.card || {}).animehub_id || String(object.id).replace(/^animehub:/, ''));
        if (!Number.isSafeInteger(id) || id < 1) {
            failure();
            return;
        }

        request('news', { mode: 'full', ids: [id], page: 1, limit: 1 }, function (data) {
            if (component && component.destroyed) return;
            var records = recordList(data) || [];
            var record = records.find(function (item) { return item && Number(item.id) === id; });
            if (!record || !catalogCard(record)) {
                failure();
                return;
            }

            var movie = fullCard(record);
            collectFilters(record.xfields_data || {});
            playback.set(movie, { title: plain(movie.title), options: playerOptions(record.xfields_data || {}) });
            if (!Lampa.Utils.canWatchChildren('18+', Lampa.Account.Permit.profile.age)) {
                success({ movie: movie });
                return;
            }
            enrichFull(record, movie, function (data) {
                if (!component || !component.destroyed) success(data);
            });
        }, fail);
    }

    function rows(value) {
        if (Array.isArray(value)) return value;
        return value && typeof value === 'object' ? [value] : [];
    }

    function directStream(value, format) {
        var url = httpsUrl(value);
        if (!url) return '';
        var path = new URL(url).pathname;
        var type = String(format || '').toLowerCase();
        if (/\.(?:mp4|m3u8|webm|mkv|mpd)$/i.test(path) ||
            /^(?:video\/(?:mp4|webm)|mp4|hls|m3u8|webm|mpd)$/.test(type)) return url;
        return '';
    }

    function qualityOf(value) {
        var quality = String(value || '').trim();
        var named = { HD: 720, FHD: 1080, FULLHD: 1080, '2K': 1440, '4K': 2160 };
        var height = named[quality.toUpperCase().replace(/\s+/g, '')];
        if (typeof height === 'number') return height;
        var dimensions = quality.match(/^\d{3,4}\s*[x×]\s*(\d{3,4})$/i);
        if (dimensions) return Number(dimensions[1]);
        var match = quality.match(/(?:^|\D)(\d{3,4})(?:p|\D|$)/i);
        return match ? Number(match[1]) : 0;
    }

    function mp4Embed(value) {
        var url = httpsUrl(value);
        if (!url) return '';
        var parsed = new URL(url);
        return /^(?:www\.)?mp4upload\.com$/i.test(parsed.hostname) &&
            /^\/embed-[\w-]+\.html$/i.test(parsed.pathname) ? url : '';
    }

    function streamsFor(value) {
        var unique = new Set();
        return rows(value).map(function (item) {
            if (!item) return null;
            var url = directStream(item.source || item.link || item.url, item.format || item.type);
            if (!url || unique.has(url)) return null;
            unique.add(url);
            return { url: url, quality: qualityOf(item.quality) };
        }).filter(Boolean).sort(function (a, b) {
            return b.quality - a.quality;
        });
    }

    function asObject(data) {
        if (typeof data !== 'string') return data;
        try {
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    function providers(items) {
        var byName = new Map();
        items.forEach(function (item) {
            var link = item.source || item.link || item.url;
            var url = directStream(link, item.format || item.type);
            var embed = url ? '' : mp4Embed(link);
            if (!url && !embed) return;
            var name = embed ? 'MP4' : (plain(item.title) || new URL(url).hostname);
            if (/^(?:mp4|mp4upload)$/i.test(name)) name = 'MP4';
            if (!byName.has(name)) byName.set(name, { title: name, streams: [] });
            var streams = byName.get(name).streams;
            if (!streams.some(function (stream) { return stream.url === url && stream.embed === embed; })) {
                streams.push({ url: url, embed: embed, quality: qualityOf(item.quality) });
            }
        });
        var ordered = Array.from(byName.values()).sort(function (a, b) {
            return Number(b.title === 'MP4') - Number(a.title === 'MP4');
        });
        return ordered.map(function (provider) {
            provider.streams.sort(function (a, b) {
                return Number(Boolean(b.url)) - Number(Boolean(a.url)) || b.quality - a.quality;
            });
            return provider;
        });
    }

    function playerOptions(fields) {
        var main = asObject(fields.plyr_json) || {};
        var extras = rows(asObject(fields.json_player_voice)).concat(rows(asObject(fields.json_player_subs)));
        var voice = main.voice;
        var studios = voice && !Array.isArray(voice) && !voice.source && !voice.url && !voice.link
            ? Object.keys(voice) : [];
        var tracks = new Map();

        function track(name) {
            var key = name.toLowerCase();
            if (!tracks.has(key)) tracks.set(key, {
                title: name || 'Без указания студии', primary: [], extras: []
            });
            return tracks.get(key);
        }

        studios.forEach(function (studio) {
            track(plain(studio)).primary = streamsFor(voice[studio]);
        });
        if (voice && !studios.length) track('').primary = streamsFor(voice);
        extras.filter(function (item) { return item && item.type === 'voice'; }).forEach(function (item) {
            var studio = plain(item.edit);
            if (!studio && tracks.size === 1) {
                tracks.values().next().value.extras.push(item);
            } else track(studio).extras.push(item);
        });

        return Object.keys(TRANSLATIONS).map(function (kind) {
            var options = kind === 'voice' ? Array.from(tracks.values()).map(function (item) {
                return { title: item.title, primary: item.primary, backup: providers(item.extras) };
            }) : [{
                title: TRANSLATIONS[kind],
                primary: streamsFor(main[kind]),
                backup: providers(extras.filter(function (item) { return item && item.type === kind; }))
            }];
            return {
                kind: kind,
                title: TRANSLATIONS[kind],
                options: options.filter(function (item) { return item.primary.length || item.backup.length; })
            };
        }).filter(function (group) { return group.options.length; });
    }

    function restoreFocus(activity) {
        if (!activity || Lampa.Activity.active() !== activity) return;
        if (activity.activity && typeof activity.activity.toggle === 'function') activity.activity.toggle();
        else Lampa.Controller.toggle('content', true);
    }

    function launch(data, activity) {
        if (Lampa.Activity.active() !== activity) return;
        playbackOrigins.set(data, activity);
        Lampa.Player.play(data);
    }

    function mediaFromEmbed(html, embed) {
        if (typeof html !== 'string' || html.length > 750000) return '';
        function findUrl(value) {
            if (typeof value !== 'string' || !value.trim()) return '';
            try {
                var url = directStream(new URL(plain(value), embed).href);
                return url && /(^|\.)mp4upload\.com$/i.test(new URL(url).hostname) ? url : '';
            } catch (error) {
                return '';
            }
        }

        var patterns = [
            /<video\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/ig,
            /<source\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/ig,
            /\bplayer\.src\(\s*\{[^{}]{0,500}?\bsrc\s*:\s*["']([^"']+)["']/ig
        ];
        var source = '';
        patterns.some(function (pattern) {
            var match;
            while ((match = pattern.exec(html))) {
                source = findUrl(match[1]);
                if (source) return true;
            }
            return false;
        });
        return source;
    }

    function play(movie, video, streams, activity) {
        var first = streams[0];
        if (first.embed) {
            function unavailable() {
                if (Lampa.Activity.active() === activity) Lampa.Noty.show('Не удалось получить прямую ссылку MP4.');
            }
            sendRequest(first.embed, 'GET', null, 'text', function (html) {
                if (Lampa.Activity.active() !== activity) return;
                var url = mediaFromEmbed(html, first.embed);
                if (!url) {
                    unavailable();
                    return;
                }
                launch({
                    url: url,
                    title: video.title,
                    card: movie,
                    headers: { Referer: first.embed }
                }, activity);
            }, unavailable);
            return;
        }

        var quality = {};
        streams.forEach(function (stream) {
            if (stream.url && stream.quality && !quality[stream.quality + 'p']) {
                quality[stream.quality + 'p'] = stream.url;
            }
        });

        var data = { url: first.url, title: video.title, card: movie };
        if (Object.keys(quality).length > 1) data.quality = quality;
        launch(data, activity);
    }

    function playbackGroups(video) {
        var external = hasAndroidBridge() && Lampa.Storage.field('player') === 'android';
        return video.options.map(function (group) {
            var options = group.options.map(function (option) {
                var backup = [];
                option.backup.some(function (provider) {
                    backup = provider.streams.filter(function (stream) { return stream.url || external; });
                    return backup.length > 0;
                });
                return { title: option.title, primary: option.primary, backup: backup };
            }).filter(function (option) { return option.primary.length || option.backup.length; });
            return { kind: group.kind, title: group.title, options: options };
        }).filter(function (group) { return group.options.length; });
    }

    function playerMenuItem(title, streams) {
        var item = { title: title, streams: streams };
        var available = streams[0].embed ? [streams[0]] : streams.filter(function (stream) { return stream.url; });
        var maxHeight = available.reduce(function (max, stream) { return Math.max(max, stream.quality); }, 0);
        if (maxHeight) {
            var labels = { 720: 'HD', 1080: 'FHD', 1440: '2K', 2160: '4K' };
            var label = labels[maxHeight] || maxHeight + 'p';
            item.html = Lampa.Template.get('selectbox_item', { title: title });
            item.html.find('.selectbox-item__title').append(
                $('<span>').css({ opacity: 0.6, marginLeft: '0.45em' }).text(' • ' + label)
            );
        }
        return item;
    }

    function openPlayers(movie, video) {
        var groups = playbackGroups(video);
        if (!groups.length) {
            Lampa.Noty.show('Для выбранного типа плеера видео недоступно.');
            return;
        }

        var activity = Lampa.Activity.active();
        function choose(streams) {
            Lampa.Select.closeAll();
            restoreFocus(activity);
            play(movie, video, streams, activity);
        }

        function showPlayer(option) {
            var players = [];
            if (option.primary.length) players.push(playerMenuItem('Основной', option.primary));
            if (option.backup.length) players.push(playerMenuItem('Дополнительный', option.backup));
            showRememberedSelect('player', {
                title: 'Плеер',
                nohide: true,
                items: players,
                onSelect: function (player) { choose(player.streams); }
            }, activity);
        }

        showRememberedSelect('translation', {
            title: 'Перевод',
            items: groups,
            nohide: true,
            onBack: function () { restoreFocus(activity); },
            onSelect: function (group) {
                if (group.kind !== 'voice' || group.options.length === 1) {
                    showPlayer(group.options[0]);
                    return;
                }
                showRememberedSelect('voice', {
                    title: 'Озвучка',
                    nohide: true,
                    items: group.options.map(function (option) {
                        return { title: escapeHtml(option.title), option: option };
                    }),
                    onSelect: function (entry) { showPlayer(entry.option); }
                }, activity);
            }
        }, activity);
    }

    function openFilter(title, key, value) {
        var state = { title: title, component: 'category_full', source: SOURCE, url: '', page: 1 };
        state[key] = value;
        Lampa.Activity.push(state);
    }

    function showStudios(description, studios) {
        if (!studios.length) return;
        var items = studios.map(function (studio) { return { id: studio, name: escapeHtml(studio) }; });
        var button = description.tag('Производство', items, function (studio) {
            openFilter(studio.id, 'companies', studio.id);
        });
        description.body.find('.full-descr__tags').append(button);
    }

    function showStatistics(card, movie) {
        var row = card.find('.full-start-new__rate-line');
        var format = new Intl.NumberFormat('ru-RU');
        row.find('.full-start__rate, .animehub-view-stats').remove();
        var values = [];
        if (movie.animehub_views !== null) values.push(format.format(movie.animehub_views) + ' просмотров');
        if (movie.animehub_votes !== null) values.push(format.format(movie.animehub_votes) + ' голосов');
        if (values.length) {
            row.append($('<span class="animehub-view-stats"></span>')
                .text(values.join(' · ')));
        }
    }

    function installVoteStyle() {
        $('<style id="animehub-vote-style"></style>').text(`
            .animehub-reaction-counts {
                display: flex; flex-wrap: wrap; align-items: center;
                margin: -.5em; margin-bottom: 1em; min-height: 3.6em;
            }
            .animehub-reaction-counts > div { padding: .5em; }
            .animehub-vote__icon {
                position: relative; display: inline-block; flex: none; color: #a0a5a8;
            }
            .animehub-vote-button.focus { box-shadow: inset 0 0 0 .12em currentColor; }
            .animehub-vote-button[aria-pressed="true"] .animehub-vote__icon { color: #f14b59; }
            .animehub-vote__icon::before, .animehub-vote__icon::after {
                content: ""; position: absolute; top: 9%; width: 50%; height: 86%;
                background: currentColor; border-radius: 100px 100px 0 0;
            }
            .animehub-vote__icon::before { left: 50%; transform: rotate(-45deg); transform-origin: 0 100%; }
            .animehub-vote__icon::after { left: 0; transform: rotate(45deg); transform-origin: 100% 100%; }
            .animehub-vote__icon--broken {
                clip-path: polygon(evenodd, 0 0, 46% 0, 38% 32%, 58% 50%, 42% 82%, 42% 100%,
                    54% 100%, 54% 82%, 71% 50%, 50% 27%, 58% 0, 100% 0, 100% 100%, 0 100%);
            }
        `).appendTo('head');
    }

    function showTitleMetadata(card, movie, video) {
        var labels = names(movie.animehub_translation, /\s*[,;|]\s*/);
        var groups = video ? video.options : [];
        var licensed = labels.concat(groups.map(function (group) { return group.title; })).map(normalizeFilterName);
        var translation = ['voice', 'subs', 'raw'].filter(function (key) {
            return licensed.includes(normalizeFilterName(TRANSLATIONS[key])) ||
                (key === 'raw' && licensed.includes('raw')) ||
                (key === 'voice' && licensed.includes('русская озвучка'));
        }).map(function (key) { return TRANSLATIONS[key]; }).join(' | ');
        var tags = movie.genres.slice(0, 5).map(function (genre) {
            return Lampa.Utils.capitalizeFirstLetter(genre.id);
        }).join(' | ');
        var time = movie.runtime ? String(Math.floor(movie.runtime / 60)).padStart(2, '0') +
            ':' + String(movie.runtime % 60).padStart(2, '0') : '';
        var details = card.find('.full-start-new__details').first().empty();
        [time, translation || labels.join(' | '), tags].filter(Boolean).forEach(function (value, index) {
            if (index) details.append('<span class="full-start-new__split">●</span>');
            details.append($('<span></span>').text(value));
        });

        var reactions = $('<div class="animehub-reaction-counts"></div>');
        VOTE_LISTS.forEach(function (entry) {
            var button = $('<div class="reaction selector animehub-vote-button" role="button"></div>')
                .attr('data-rating', entry.rating);
            button.append($('<span class="reaction__icon animehub-vote__icon" aria-hidden="true"></span>')
                .toggleClass('animehub-vote__icon--broken', entry.rating === -1));
            button.append($('<div class="reaction__count" aria-hidden="true"></div>'));
            reactions.append($('<div></div>').append(button));
        });
        var nativeReactions = card.find('.full-start-new__reactions');
        if (nativeReactions.length) nativeReactions.replaceWith(reactions);
        else details.after(reactions);
        updateVoteButtons(reactions, movie);
    }

    function updateVoteButtons(reactions, movie) {
        var votes = voteState(movie.animehub_id, accountProfile);
        var format = new Intl.NumberFormat('ru-RU');
        // Never highlight both, including when a stale profile returns conflicting flags.
        var singleVote = votes.likes !== votes.dislikes;
        VOTE_LISTS.forEach(function (entry) {
            var button = reactions.find('[data-rating="' + entry.rating + '"]');
            var count = movie['animehub_' + entry.key];
            var label = Number.isSafeInteger(count) ? format.format(count) : '—';
            button.attr('aria-pressed', String(singleVote && votes[entry.key]));
            button.attr('aria-label', entry.title + ' ' + label);
            button.find('.reaction__count').text(label);
        });
    }

    function onlyNativeActions(card) {
        var standard = '.button--play, .button--book, .animehub-bookmark-button, .button--subscribe, .view--trailer';
        card.find('.button--priority').remove();
        card.find('.buttons--container > *, .full-start-new__buttons > .selector, .full-start__button')
            .not(standard).remove();
    }

    function configureCommentLine(line, movie) {
        if (!line.data || !line.data.animehubComments) return;
        // The native comments row inserts the CUB add tile. AnimeHub displays its own comments.
        line.data.results = line.data.results.filter(function (item) { return item.animehubComment; });
        line.use({
            onlyCreateAndAppend: function (entry) { appendComment(this, entry, false); },
            onlyMore: function () { openComments(movie); }
        });
    }

    function onFull(event) {
        var movie = event.data && event.data.movie || event.props && event.props.get('movie');
        if (!movie || movie.source !== SOURCE) return;
        if (event.type === 'start') {
            // Lampa emits start only for profiles allowed to watch this card.
            canWatch.add(movie);
            event.link.use({ onInstance: function (line) { configureCommentLine(line, movie); } });
            return;
        }
        if (event.type !== 'build') return;
        if (event.name === 'description') {
            event.item.render().find('.warning-box--full-adult').addClass('hide').removeClass('selector');
            showStudios(event.item, movie.animehub_studios);
            return;
        }
        if (event.name === 'cards' && (event.data.animehubRelated || event.data.animehubRecommended)) {
            event.item.render().find('.items-line__title')
                .text(event.data.animehubRelated ? 'Связанные' : 'Рекомендации');
            return;
        }
        if (event.name !== 'start') return;

        var card = event.item.html;
        card.find('.full-start-new__title, .full-start-new__tagline').css({
            display: '-webkit-box',
            '-webkit-box-orient': 'vertical',
            '-webkit-line-clamp': '2',
            overflow: 'hidden',
            'overflow-wrap': 'anywhere',
            'white-space': 'normal'
        });
        decoratePoster(card.find('.full-start-new__poster'), movie.animehub_episode);
        onlyNativeActions(card);
        showStatistics(card, movie);
        showTitleMetadata(card, movie, playback.get(movie));
        card.find('.button--play > span').css('display', 'block');
        var nativeBookmark = card.find('.button--book').first();
        var bookmark = nativeBookmark.clone(false).removeClass('button--book loading').addClass('animehub-bookmark-button');
        bookmark.find('span').last().text('Закладки').css('display', 'block');
        bookmark.on('hover:focus hover:enter', function () { event.item.last = this; });
        bookmark.on('hover:enter', function () { showBookmarks(movie, bookmark); });
        nativeBookmark.replaceWith(bookmark);
        var reactions = card.find('.animehub-reaction-counts');
        reactions.find('.animehub-vote-button').on('hover:focus hover:enter', function () { event.item.last = this; })
            .on('hover:enter', function () {
                castVote(movie, Number($(this).attr('data-rating')), function () {
                    updateVoteButtons(reactions, movie);
                    showStatistics(card, movie);
                });
            });
        function refreshAccountCard() {
            updateBookmarkIcon(movie, bookmark);
            updateVoteButtons(reactions, movie);
        }
        accountEvents.follow('change', refreshAccountCard);
        refreshAccountCard();
        if (accountToken) readProfile();
        var video = canWatch.has(movie) && playback.get(movie);
        var initialFocus = true;
        var observer = new MutationObserver(function () { onlyNativeActions(card); });
        var buttons = card.find('.full-start-new__buttons, .buttons--container');
        buttons.each(function () { observer.observe(this, { childList: true, subtree: true }); });
        event.item.use({
            onlyGroupButtons: function () {
                onlyNativeActions(this.html);
                var available = Boolean(video && playbackGroups(video).length);
                var button = this.html.find('.button--play').off('hover:enter').toggleClass('hide', !available);
                if (initialFocus) {
                    initialFocus = false;
                    if (available && button.length) this.last = button[0];
                }
                if (!available) return;
                button.on('hover:enter', function () {
                    openPlayers(movie, video);
                });
            },
            onDestroy: function () {
                observer.disconnect();
                accountEvents.remove('change', refreshAccountCard);
            }
        });
    }

    function checkUpdate() {
        if (checkingUpdate) return;
        checkingUpdate = true;

        function done() { checkingUpdate = false; }

        request('check-updates', { version: HENTAIHUB_VERSION }, function (data) {
            done();
            var latest = data && data.latest && data.latest.version;
            if (data && data.hasUpdate === true && typeof latest === 'string' && /^\d+(\.\d+)+$/.test(latest)) {
                Lampa.Noty.show('Доступна новая версия HentaiHub ' + latest, { time: 5000 });
            }
        }, done);
    }

    function init() {
        if (Lampa.Api.sources[SOURCE]) return;

        accountEvents = Lampa.Subscribe();
        accountToken = Lampa.Storage.get(ACCOUNT_TOKEN, '') || '';
        installSettings();
        installVoteStyle();
        Lampa.Api.sources[SOURCE] = { category: loadHome, list: loadList, full: loadFull, clear: function () {} };
        Lampa.Component.add(HOME, animeHome);
        Lampa.Component.add(BOOKMARK_HOME, animeBookmarkHome);
        Lampa.Component.add(COLLECTIONS, animeCollections);
        Lampa.Component.add(RANDOM, animeRandom);
        Lampa.Component.add(POPULAR, animePopular);
        Lampa.Component.add(COMMENTS, animeComments);
        installHeaderFilter();
        Lampa.Listener.follow('full', onFull);
        Lampa.Player.listener.follow('close', function (event) {
            var activity = playbackOrigins.get(event.data);
            if (!activity) return;
            playbackOrigins.delete(event.data);
            restoreFocus(activity);
        });

        Lampa.Menu.addButton(ICON, NAME, function () {
            Lampa.Activity.push({ title: NAME, component: HOME, source: SOURCE, page: 1, url: '' });
            if (Lampa.Storage.field(UPDATE_SETTING) !== 'no') checkUpdate();
        });
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (event) {
        if (event.type === 'ready') init();
    });
})();
