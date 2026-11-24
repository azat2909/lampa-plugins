/*!
 * AnimeHub 0.4.3 — источник HentaiHub 0.49 для Lampa на Android TV.
 */
(function () {
    'use strict';

    var SOURCE = 'animehub';
    var NAME = 'AnimeHub';
    var API = 'https://api.hentaigo.me/api/';
    var HENTAIHUB_VERSION = '0.49';
    var PAGE_SIZE = 30;
    var INITIAL_PAGES = 5;
    var SHELF_SIZE = 10;
    var RANDOM_PAGES = 40;
    var TIMEOUT = 15000;
    var HOME = 'animehub_home';
    var COLLECTIONS = 'animehub_collections';
    var COMMENTS = 'animehub_comments';
    var RANDOM = 'animehub_random';
    var POPULAR = 'animehub_popular';
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
        { title: 'По новизне', value: 'date' },
        { title: 'По обновлению', value: 'editdate' },
        { title: 'По популярности', value: 'news_read' }
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
    var playback = new WeakMap();
    var playbackOrigins = new WeakMap();
    var canWatch = new WeakSet();
    var filterChoices = { tags: new Set(GENRES), studios: new Set(STUDIOS) };
    var eliteStudios = [];
    var catalogFilters = { sort: 'date' };
    var randomShelf = [];
    var checkingUpdate = false;

    function request(path, body, success, failure) {
        nativeRequest(API + path, 'POST', body, 'json', success, failure);
    }

    function nativeRequest(url, method, body, type, success, failure, timeout) {
        var bridge = window.AndroidJS;
        if (!bridge || typeof bridge.httpReq !== 'function' || !Lampa.Platform.is('android')) {
            Lampa.Noty.show('Для AnimeHub нужен Android-клиент Lampa.');
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
            network.native(url, complete, fail, body ? JSON.stringify(body) : undefined, {
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
        if (plain(record.category).toLowerCase() === 'неизвестно' &&
            !names(fields.studios, /[,;|]/).length && !plain(fields.translate_type)) return null;

        var title = plain(record.title);
        if (!title || /^(?:\[(?:манга|manga)\]|(?:манга|manga)\s*[:—–-])/i.test(title)) return null;

        return {
            id: SOURCE + ':' + record.id,
            animehub_id: Number(record.id),
            animehub_episode: episodeNumber(record, title),
            source: SOURCE,
            media_type: 'movie',
            title: title,
            release_date: releaseDate(fields),
            poster: imageUrl(fields.poster, true),
            adult: true,
            restrict: 18,
            params: { emit: { onCreate: decorateCover } }
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
        card.animehub_studios = names(fields.studios, /\s*[,;|]\s*|\s+\/\s+/);
        card.overview = escapeHtml(description);
        card.animehub_translation = plain(fields.translate_type);
        card.poster = imageUrl(fields.poster, false);
        card.img = card.poster || './img/img_broken.svg';
        card.background_image = imageUrl(fields.screen, false);
        card.runtime = Math.max(0, Math.round((Number(fields.duration) || 0) / 60));
        card.genres = names(fields.hentai_tags, /\s*[,;|]\s*/).map(function (tag) {
            return { id: tag, name: escapeHtml(tag) };
        });
        card.production_companies = [];
        card.production_countries = [];
        card.vote_average = 0;
        card.animehub_views = countValue(record.news_read);
        card.animehub_votes = countValue(record.vote_num);
        return card;
    }

    function countValue(value) {
        if (value == null || value === '') return null;
        var number = Number(value);
        return Number.isSafeInteger(number) ? number : null;
    }

    function listing(object, page) {
        var body = { mode: 'short', page: page, limit: PAGE_SIZE };
        var ids = object.animehubCollection;
        if (object.animehubSearch) {
            return { path: 'search', body: { search: object.animehubSearch }, total: 1 };
        }
        if (object.animehubFilters || object.animehubPeriod || object.genres || object.companies) {
            var filters = object.animehubFilters || {};
            var tag = filters.tags || object.genres;
            var studio = filters.studios || object.companies;
            if (tag) body.tags = [String(tag)];
            if (studio) body.studios = [String(studio)];
            if (filters.year) body.yearFrom = body.yearTo = filters.year;
            if (filters.sort || object.animehubPeriod) body.sort = object.animehubPeriod || filters.sort;
            return { path: 'filter', body: body };
        }
        if (object.url === 'rand') {
            body.sort = 'rand';
            body.page = ((object.animehubRandomPage || 1) + page - 2) % RANDOM_PAGES + 1;
            body.skipCache = true;
            if (object.animehubRandomPage) body.refresh = true;
            return { path: 'news', body: body, total: object.component === RANDOM ? INITIAL_PAGES : 1 };
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
        var firstPage = Number(object.page) || 1;
        var component = object.activity && object.activity.component;
        var state = catalogs.get(object);
        if (!state || state.component !== component) {
            state = { component: component, ids: new Set(), lastPage: 0 };
            catalogs.set(object, state);
        }
        var visited = new Set();
        var lastInitialPage = firstPage === 1 && object.component ? INITIAL_PAGES : firstPage;
        var results = [];
        var completed = 0;
        var totalPages = 1;

        function fail() {
            if (catalogs.get(object) !== state || (component && component.destroyed)) return;
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
            state.lastPage = page;
            object.page = page;
            if (object.component === RANDOM) total = page;
            if (component) component.total_pages = total;
            if (object.component === RANDOM) results.push(randomReloadCard());
            success({ results: results, page: page, total_pages: total });
        }

        function accept(cards, page, total) {
            results.push.apply(results, cards);
            completed = page;
            totalPages = total;
            if (page < lastInitialPage && page < total) load(page + 1);
            else finish(page, total);
        }

        function load(page) {
            var query = listing(object, page);
            if (query.body.ids && !query.body.ids.length) {
                finish(page, query.total || 1);
                return;
            }

            request(query.path, query.body, function (data) {
                if (catalogs.get(object) !== state || (component && component.destroyed)) return;
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
                var total = query.total || page + Number(records.length >= PAGE_SIZE);
                if (!cards.length && page < total && page >= lastInitialPage && !results.length && object.component !== RANDOM) {
                    var signature = records.map(function (record) { return record && record.id; }).sort().join(',');
                    if (!visited.has(signature)) {
                        visited.add(signature);
                        load(page + 1);
                        return;
                    }
                    total = page;
                }
                accept(cards, page, total);
            }, fail);
        }

        if (object.component === RANDOM && object.animehubUseShelf && randomShelf.length) {
            randomShelf.forEach(function (card) { state.ids.add(card.id); });
            accept(randomShelf, 1, INITIAL_PAGES);
        } else load(firstPage);
    }

    function fetchShelf(section, done) {
        loadList({ url: section.url, page: 1 }, function (data) {
            if (section.url === 'rand') randomShelf = data.results;
            var hasMore = data.results.length > SHELF_SIZE || section.url === 'rand' || section.url === 'news_read';
            done({
                title: section.title,
                source: SOURCE,
                url: section.url,
                results: data.results.slice(0, SHELF_SIZE),
                total_pages: Math.max(data.total_pages, hasMore ? 2 : 1)
            });
        }, function () { done(null); });
    }

    function loadHome(object, success, failure) {
        var component = object.activity && object.activity.component;
        var pending = SECTIONS.length;
        var sections = new Array(pending);
        SECTIONS.forEach(function (section, index) {
            fetchShelf(section, function (data) {
                sections[index] = data;
                if (--pending) return;
                if (component && component.destroyed) return;
                var available = sections.filter(function (row) { return row && row.results.length; });
                if (available.length) success(available);
                else failure();
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
                        Lampa.Activity.push({
                            component: COLLECTIONS, source: SOURCE, url: 'collections', page: 1, title: data.title
                        });
                    }
                });
            }
        });
    }

    function animeCollections(object) {
        return mainComponent('category_full', object, { onInstance: collectionEnter });
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
        var tab = $('<button type="button" class="simple-button selector animehub-popular-tab" aria-haspopup="dialog">Популярное</button>').css({
            position: 'fixed',
            top: '50%',
            right: 0,
            zIndex: 2,
            transform: 'translateY(-50%)',
            writingMode: 'vertical-rl',
            whiteSpace: 'nowrap',
            padding: '0.9em 0.45em',
            font: 'inherit',
            color: 'inherit',
            border: 0
        });
        function open() {
            if (Lampa.Activity.active() === object) showPopular(object);
        }
        function offerTab() {
            if (Lampa.Controller.own(this)) Lampa.Controller.collectionAppend(tab);
        }
        tab.on('hover:enter', open);

        return mainComponent('category_full', object, {
            onStart: function () { this.render().append(tab.show()); },
            onPause: function () { tab.hide(); },
            onToggle: offerTab,
            onScroll: offerTab,
            onController: function (controller) {
                var nativeRight = controller.right;
                controller.right = function () {
                    var navigator = window.Navigator;
                    if (navigator && typeof navigator.canmove === 'function' && !navigator.canmove('right')) open();
                    else nativeRight.apply(this, arguments);
                };
            }
        });
    }

    function showPopular(object) {
        function back() { restoreFocus(object); }
        Lampa.Select.show({
            title: 'Популярное',
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
        });
    }

    function collectFilters(fields) {
        names(fields.hentai_tags, /\s*[,;|]\s*/).forEach(function (tag) { filterChoices.tags.add(tag); });
        names(fields.studios, /\s*[,;|]\s*|\s+\/\s+/).forEach(function (studio) { filterChoices.studios.add(studio); });
    }

    function editFilterText(title, value, done) {
        var cancelled = false;
        var keyboard = Lampa.Input.edit({
            title: title, value: value || '', keyboard: 'lampa', layout: 'clarify', align: 'center', nosave: true
        }, function (input) {
            // Input calls back for both Enter and Back. Let the Back listener run first.
            Promise.resolve().then(function () {
                done(cancelled ? null : String(input || '').trim());
            });
        });
        keyboard.listener.follow('back', function () { cancelled = true; });
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
            return { title: escapeHtml(option.title), value: option.value, selected: option.value === draft[key] };
        });
        if (manual) items.push({ title: 'Ввести вручную', manual: true });
        Lampa.Select.show({
            title: title,
            items: items,
            onBack: back,
            onSelect: function (entry) {
                if (entry.manual) {
                    editFilterText(title, draft[key], function (input) {
                        if (input) {
                            var normalized = normalizeFilterName(input);
                            var match = options.find(function (option) {
                                return normalizeFilterName(option.title) === normalized;
                            });
                            draft[key] = match ? match.value : input;
                        }
                        back();
                    });
                    return;
                }
                draft[key] = entry.value;
                back();
            }
        });
    }

    function normalizeFilterName(name) {
        return name.trim().replace(/\s+/g, ' ').toLowerCase();
    }

    function loadEliteStudios(done) {
        nativeRequest(ELITE_STUDIOS + '?t=' + Date.now(), 'GET', null, 'text', function (data) {
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
        if (key === 'studios') {
            var known = new Map();
            sorted.forEach(function (value) {
                var name = normalizeFilterName(value);
                if (!known.has(name) || value.indexOf('\u00a0') !== -1) known.set(name, value);
            });
            var order = new Set(eliteStudios.concat(Array.from(known.keys())));
            sorted = Array.from(order).filter(function (name) { return known.has(name); }).map(function (name) {
                return known.get(name);
            });
        }
        return [{ title: 'Все', value: '' }].concat(sorted.map(function (value) {
            return { title: value.replace(/\s+/g, ' '), value: value };
        }));
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
                    selectFilter('Студии', 'studios', filterOptions('studios'), draft, repeat, true);
                }
            });
        }
        var sort = SORT_OPTIONS.find(function (option) { return option.value === draft.sort; }) || SORT_OPTIONS[0];
        var items = [
            { title: 'Поиск', action: search },
            { title: 'Жанры', subtitle: escapeHtml(draft.tags || 'Все'), action: select('Жанры', 'tags', function () { return filterOptions('tags'); }, true) },
            { title: 'Студии', subtitle: escapeHtml(draft.studios || 'Все'), action: studios },
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
        Lampa.Select.show({
            title: 'Фильтр',
            items: items,
            onBack: function () { Lampa.Controller.toggle('head'); },
            onSelect: function (entry) { entry.action(); }
        });
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
            .slice(0, PAGE_SIZE);
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
        var match = String(value || '').match(/(?:^|\D)(\d{3,4})(?:p|\D|$)/i);
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
            nativeRequest(first.embed, 'GET', null, 'text', function (html) {
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
        var external = Lampa.Storage.field('player') === 'android';
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
            if (option.primary.length) players.push({ title: 'Основной', streams: option.primary });
            if (option.backup.length) players.push({ title: 'Дополнительный', streams: option.backup });
            Lampa.Select.show({
                title: 'Плеер',
                nohide: true,
                items: players,
                onSelect: function (player) { choose(player.streams); }
            });
        }

        Lampa.Select.show({
            title: 'Перевод',
            items: groups,
            nohide: true,
            onBack: function () { Lampa.Controller.toggle('content'); },
            onSelect: function (group) {
                if (group.kind !== 'voice' || group.options.length === 1) {
                    showPlayer(group.options[0]);
                    return;
                }
                Lampa.Select.show({
                    title: 'Озвучка',
                    nohide: true,
                    items: group.options.map(function (option) {
                        return { title: escapeHtml(option.title), option: option };
                    }),
                    onSelect: function (entry) { showPlayer(entry.option); }
                });
            }
        });
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
        row.find('.full-start__rate').remove();
        var values = [];
        if (movie.animehub_views !== null) values.push(format.format(movie.animehub_views) + ' просмотров');
        if (movie.animehub_votes !== null) values.push(format.format(movie.animehub_votes) + ' голосов');
        if (values.length) {
            row.append($('<span class="animehub-view-stats"></span>')
                .text(values.join(' · ')));
        }
    }

    function showTranslation(card, movie, video) {
        var label = video && video.options.map(function (group) { return group.title; }).join(', ');
        if (!label) label = /^raw$/i.test(movie.animehub_translation) ? 'Оригинал' : movie.animehub_translation;
        var translation = $('<div class="full-start-new__details"></div>')
            .append($('<strong></strong>').text('Перевод'));
        if (label) translation.append($('<span></span>').text(' · ' + label));
        // Use the native metadata style without leaving a reaction element that Lampa can repaint.
        card.find('.full-start-new__reactions').replaceWith(translation);
    }

    function onlyNativeActions(card) {
        var standard = '.button--play, .button--book, .button--subscribe, .view--trailer';
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
        showTranslation(card, movie, playback.get(movie));
        var video = canWatch.has(movie) && playback.get(movie);
        var observer = new MutationObserver(function () { onlyNativeActions(card); });
        var buttons = card.find('.full-start-new__buttons, .buttons--container');
        buttons.each(function () { observer.observe(this, { childList: true, subtree: true }); });
        event.item.use({
            onGroupButtons: function () {
                onlyNativeActions(this.html);
                var available = Boolean(video && playbackGroups(video).length);
                var button = this.html.find('.button--play').off('hover:enter').toggleClass('hide', !available);
                if (!available) return;
                button.on('hover:enter', function () {
                    openPlayers(movie, video);
                });
            },
            onDestroy: function () { observer.disconnect(); }
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

        Lampa.Api.sources[SOURCE] = { category: loadHome, list: loadList, full: loadFull, clear: function () {} };
        Lampa.Component.add(HOME, animeHome);
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

        var icon = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h7v7H4zm9 0h7v7h-7zm0 9h7v7h-7zm-9 0h7v7H4z"/></svg>';
        Lampa.Menu.addButton(icon, NAME, function () {
            Lampa.Activity.push({ title: NAME, component: HOME, source: SOURCE, page: 1, url: '' });
            checkUpdate();
        });
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (event) {
        if (event.type === 'ready') init();
    });
})();
