/*!
 * AnimeHub 0.3.0 — источник HentaiHub 0.49 для Lampa на Android TV.
 */
(function () {
    'use strict';

    var SOURCE = 'animehub';
    var NAME = 'AnimeHub';
    var API = 'https://api.hentaigo.me/api/';
    var HENTAIHUB_VERSION = '0.49';
    var PAGE_SIZE = 30;
    var TIMEOUT = 15000;
    var HOME = 'animehub_home';
    var COLLECTIONS = 'animehub_collections';
    var COMMENTS = 'animehub_comments';
    var SECTIONS = [
        { title: 'Обновленные', url: 'editdate' },
        { title: 'Новые', url: 'date' },
        { title: 'Популярные', url: 'news_read' },
        { title: 'Коллекции', url: 'collections' }
    ];

    if (window.animehub_catalog_ready) return;
    window.animehub_catalog_ready = true;

    var catalogs = new WeakMap();
    var playback = new WeakMap();
    var playbackOrigins = new WeakMap();
    var canWatch = new WeakSet();
    var checkingUpdate = false;

    function request(path, body, success, failure) {
        nativeRequest(API + path, 'POST', body, 'json', success, failure);
    }

    function nativeRequest(url, method, body, type, success, failure) {
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

        timer = setTimeout(fail, TIMEOUT + 2000);
        try {
            network.native(url, complete, fail, body ? JSON.stringify(body) : undefined, {
                type: method,
                dataType: type,
                headers: body ? { 'Content-Type': 'application/json' } : {},
                timeout: TIMEOUT
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
        var parts = title.split(/\s+\/\s+|\s*\|\s*/).map(function (part) { return part.trim(); });
        var english = parts.length > 1 && /[А-Яа-яЁё]/.test(parts[0]) &&
            parts.slice(1).find(latinTitle);
        if (english) {
            return { title: parts[0], english: english };
        }

        english = plain(alternatives).split(/\s+\/\s+|[|;\n]/).map(function (part) {
            return part.trim();
        }).find(latinTitle);

        return { title: title, english: english && english.toLowerCase() !== title.toLowerCase() ? english : '' };
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

    function collectionCard(record) {
        if (!record || !/^\d+$/.test(String(record.id))) return null;
        var title = plain(record.title);
        var ids = entryIds(record.news_lists);
        if (!title || !ids.length) return null;
        return {
            id: SOURCE + ':collection:' + record.id,
            source: SOURCE,
            title: title,
            poster: httpsUrl(record.img_link),
            animehubCollection: ids,
            adult: true,
            restrict: 18,
            params: { style: { name: 'collection' } }
        };
    }

    function catalogCard(record) {
        if (!record || !/^\d+$/.test(String(record.id))) return null;
        var fields = record.xfields_data || {};
        var title = plain(record.title);
        if (!title) return null;

        return {
            id: SOURCE + ':' + record.id,
            animehub_id: Number(record.id),
            source: SOURCE,
            media_type: 'movie',
            title: title,
            release_date: releaseDate(fields),
            poster: imageUrl(fields.poster, true),
            adult: true,
            restrict: 18
        };
    }

    function fullCard(record) {
        var card = catalogCard(record);
        var fields = record.xfields_data || {};
        var titles = detailTitles(card.title, fields.alt_titles);
        var translate = plain(fields.translate_type);
        var description = plain(record.full_story);

        card.title = escapeHtml(titles.title);
        card.original_title = escapeHtml(titles.english);
        card.tagline = card.original_title;
        card.animehub_studios = names(fields.studios, /\s*[,;|]\s*|\s+\/\s+/);
        card.overview = [description, translate && 'Перевод: ' + translate]
            .filter(Boolean).map(escapeHtml).join('<br>');
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
        card.animehub_rating = countValue(record.rating);
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
        if (object.url === 'collections') {
            return { path: 'users/collections/list', body: { page: page, limit: PAGE_SIZE }, collections: true };
        }
        if (Array.isArray(ids)) {
            body.ids = ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
            body.limit = body.ids.length;
            body.page = 1;
            return { path: 'news', body: body, total: Math.ceil(ids.length / PAGE_SIZE) };
        }
        if (object.genres || object.companies) {
            if (object.genres) body.tags = [String(object.genres)];
            if (object.companies) body.studios = [String(object.companies)];
            return { path: 'filter', body: body };
        }
        if (SECTIONS.some(function (section) { return section.url === object.url; })) body.sort = object.url;
        return { path: 'news', body: body };
    }

    function loadList(object, success, failure) {
        var page = Number(object.page) || 1;
        var component = object.activity && object.activity.component;
        var state = catalogs.get(object);
        if (!state || state.component !== component) {
            state = { component: component, ids: new Set(), lastPage: 0 };
            catalogs.set(object, state);
        }
        var query = listing(object, page);

        function fail() {
            if (catalogs.get(object) !== state || (component && component.destroyed)) return;
            if (page > state.lastPage && state.lastPage > 0 && object.page === page) {
                object.page = state.lastPage;
            }
            failure();
        }

        if (query.body.ids && !query.body.ids.length) {
            success({ results: [], page: page, total_pages: query.total || 1 });
            return;
        }

        request(query.path, query.body, function (data) {
            if (catalogs.get(object) !== state || (component && component.destroyed)) return;
            var records = query.collections ? data && data.playlists : recordList(data);
            if (!Array.isArray(records)) {
                fail();
                return;
            }

            var cards = records.map(query.collections ? collectionCard : catalogCard).filter(Boolean).filter(function (card) {
                if (state.ids.has(card.id)) return false;
                state.ids.add(card.id);
                return true;
            });
            if (query.body.ids) {
                var order = new Map(query.body.ids.map(function (id, index) { return [id, index]; }));
                cards.sort(function (a, b) { return order.get(a.animehub_id) - order.get(b.animehub_id); });
            }
            // Lampa advances while the API still returns full pages.
            var total = query.total || page + Number(records.length >= PAGE_SIZE && cards.length > 0);
            state.lastPage = page;
            if (component) component.total_pages = total;
            success({ results: cards, page: page, total_pages: total });
        }, fail);
    }

    function fetchShelf(section, done) {
        loadList({ url: section.url, page: 1 }, function (data) {
            done({
                title: section.title,
                source: SOURCE,
                url: section.url,
                results: data.results,
                total_pages: data.total_pages
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

    function enrichFull(movie, success) {
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

        var tags = movie.genres.slice(0, 3).map(function (genre) { return genre.id; });
        if (!tags.length) {
            done();
            return;
        }
        request('filter', { mode: 'short', tags: tags, sort: 'news_read', page: 1, limit: 18 }, function (data) {
            var items = cards(data);
            if (!finished && items.length) result.recomend = { results: items, total_pages: 1 };
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
            playback.set(movie, { title: plain(movie.title), options: playerOptions(record.xfields_data || {}) });
            if (!Lampa.Utils.canWatchChildren('18+', Lampa.Account.Permit.profile.age)) {
                success({ movie: movie });
                return;
            }
            enrichFull(movie, function (data) {
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

    function mp4UploadEmbed(value) {
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
            var url = directStream(item.source || item.link || item.url, item.format || item.type);
            var embed = url ? '' : mp4UploadEmbed(item.link);
            if (!url && !embed) return;
            var name = embed ? 'MP4Upload' : (plain(item.title) || new URL(url).hostname);
            if (!byName.has(name)) byName.set(name, { title: name, streams: [] });
            var streams = byName.get(name).streams;
            if (!streams.some(function (stream) { return stream.url === url && stream.embed === embed; })) {
                streams.push({ url: url, embed: embed, quality: qualityOf(item.quality) });
            }
        });
        return Array.from(byName.values()).map(function (provider) {
            provider.streams.sort(function (a, b) {
                return Number(Boolean(b.url)) - Number(Boolean(a.url)) || b.quality - a.quality;
            });
            return provider;
        });
    }

    function playerOptions(fields) {
        var main = asObject(fields.plyr_json) || {};
        var labels = { voice: 'Озвучка', subs: 'Субтитры', raw: 'Оригинал' };
        var extras = rows(asObject(fields.json_player_voice)).concat(rows(asObject(fields.json_player_subs)));
        var options = [];

        Object.keys(labels).forEach(function (kind) {
            var group = main[kind];
            var extra = extras.filter(function (item) { return item && item.type === kind; });
            var studios = kind === 'voice' && group && !Array.isArray(group) && !group.source && !group.url
                ? Object.keys(group) : [];

            if (studios.length) {
                studios.forEach(function (studio) {
                    var matches = extra.filter(function (item) {
                        return !item.edit || plain(item.edit).toLowerCase() === plain(studio).toLowerCase();
                    });
                    options.push({
                        title: labels[kind] + (studios.length > 1 ? ' · ' + plain(studio) : ''),
                        primary: streamsFor(group[studio]),
                        backup: providers(studios.length === 1 ? extra : matches)
                    });
                });
            } else {
                options.push({ title: labels[kind], primary: streamsFor(group), backup: providers(extra) });
            }
        });
        return options.filter(function (option) { return option.primary.length || option.backup.length; });
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

    function play(movie, video, item, activity) {
        var first = item.streams[0];
        if (first.embed) {
            function unavailable() {
                if (Lampa.Activity.active() === activity) {
                    Lampa.Noty.show('Дополнительный плеер сейчас недоступен.');
                }
            }
            nativeRequest(first.embed, 'GET', null, 'text', function (html) {
                if (Lampa.Activity.active() !== activity) return;
                // Read the public media source in the embed without running the page.
                var match = typeof html === 'string' &&
                    html.match(/\bplayer\.src\(\s*\{\s*type:\s*["']video\/mp4["']\s*,\s*src:\s*["']([^"']+)["']/i);
                var url = match && directStream(match[1], 'mp4');
                if (!url || !/(^|\.)mp4upload\.com$/i.test(new URL(url).hostname)) {
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
        item.streams.forEach(function (stream) {
            if (stream.url && stream.quality && !quality[stream.quality + 'p']) {
                quality[stream.quality + 'p'] = stream.url;
            }
        });

        var data = { url: first.url, title: video.title, card: movie };
        if (Object.keys(quality).length > 1) data.quality = quality;
        launch(data, activity);
    }

    function openPlayers(movie, video) {
        var external = Lampa.Storage.field('player') === 'android';
        var options = video.options.map(function (option) {
            var backup = option.backup.filter(function (provider) {
                return provider.streams[0].url || external;
            });
            return { title: escapeHtml(option.title), primary: option.primary, backup: backup };
        }).filter(function (option) { return option.primary.length || option.backup.length; });
        if (!options.length) {
            Lampa.Noty.show('Для выбранного типа плеера видео недоступно.');
            return;
        }

        var activity = Lampa.Activity.active();
        function choose(streams) {
            Lampa.Select.closeAll();
            restoreFocus(activity);
            play(movie, video, { streams: streams }, activity);
        }

        Lampa.Select.show({
            title: 'Перевод',
            items: options,
            nohide: true,
            onBack: function () { Lampa.Controller.toggle('content'); },
            onSelect: function (option) {
                var players = [];
                if (option.primary.length) players.push({ title: 'Основной', streams: option.primary });
                if (option.backup.length) players.push({ title: 'Дополнительный' });
                Lampa.Select.show({
                    title: 'Плеер',
                    nohide: true,
                    items: players,
                    onSelect: function (player) {
                        if (player.streams) {
                            choose(player.streams);
                            return;
                        }
                        Lampa.Select.show({
                            title: 'Дополнительные плееры',
                            nohide: true,
                            items: option.backup.map(function (provider) {
                                return { title: escapeHtml(provider.title), streams: provider.streams };
                            }),
                            onSelect: function (provider) { choose(provider.streams); }
                        });
                    }
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
        if (movie.animehub_rating !== null) {
            var rating = row.find('.rate--tmdb').removeClass('hide');
            rating.children().first().text((movie.animehub_rating > 0 ? '+' : '') + format.format(movie.animehub_rating));
            rating.find('.source--name').text(NAME);
        }
        var values = [];
        if (movie.animehub_views !== null) values.push(format.format(movie.animehub_views) + ' просмотров');
        if (movie.animehub_votes !== null) values.push(format.format(movie.animehub_votes) + ' голосов');
        if (values.length) {
            row.append($('<span class="animehub-view-stats"></span>')
                .text('Статистика просмотра · ' + values.join(' · ')));
        }
    }

    function onlyNativeActions(card) {
        var standard = '.button--play, .button--book, .button--reaction, .button--subscribe, ' +
            '.button--options, .view--trailer';
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
            showStudios(event.item, movie.animehub_studios);
            return;
        }
        if (event.name === 'cards' && event.data.animehubRelated) {
            event.item.render().find('.items-line__title').text('Связанные');
            return;
        }
        if (event.name !== 'start') return;

        var card = event.item.html;
        onlyNativeActions(card);
        showStatistics(card, movie);
        var video = canWatch.has(movie) && playback.get(movie);
        var observer = new MutationObserver(function () { onlyNativeActions(card); });
        var buttons = card.find('.full-start-new__buttons, .buttons--container');
        buttons.each(function () { observer.observe(this, { childList: true, subtree: true }); });
        event.item.use({
            onGroupButtons: function () {
                onlyNativeActions(this.html);
                if (!video || !video.options.length) return;
                var button = this.html.find('.button--play');
                button.removeClass('hide').off('hover:enter').on('hover:enter', function () {
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
        Lampa.Component.add(COMMENTS, animeComments);
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
