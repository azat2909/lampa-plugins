/*!
 * AnimeHub 0.2.0 — источник каталога и видео для Lampa на Android TV.
 */
(function () {
    'use strict';

    var SOURCE = 'animehub';
    var NAME = 'AnimeHub';
    var API = 'https://api.hentaigo.me/api/';
    var PAGE_SIZE = 30;
    var TIMEOUT = 15000;

    if (window.animehub_catalog_ready) return;
    window.animehub_catalog_ready = true;

    var catalogs = new WeakMap();
    var playback = new WeakMap();
    var canWatch = new WeakSet();

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
        var studios = plain(fields.studios);
        var translate = plain(fields.translate_type);
        var description = plain(record.full_story);
        var meta = [
            studios && 'Студия: ' + studios,
            translate && 'Перевод: ' + translate
        ].filter(Boolean);

        card.title = escapeHtml(card.title);
        card.original_title = escapeHtml(plain(fields.alt_titles));
        card.overview = [description].concat(meta).filter(Boolean).map(escapeHtml).join('<br>');
        card.poster = imageUrl(fields.poster, false);
        card.img = card.poster || './img/img_broken.svg';
        card.background_image = imageUrl(fields.screen, false);
        card.runtime = Math.max(0, Math.round((Number(fields.duration) || 0) / 60));
        card.genres = (Array.isArray(fields.hentai_tags) ? fields.hentai_tags : []).map(plain)
            .filter(Boolean).map(function (tag) { return { id: tag, name: escapeHtml(tag) }; });
        card.production_companies = [];
        card.production_countries = [];
        card.vote_average = 0;
        return card;
    }

    function loadList(object, success, failure) {
        var page = Number(object.page) || 1;
        var component = object.activity && object.activity.component;
        var state = catalogs.get(object);
        if (!state || state.component !== component) {
            state = { component: component, ids: new Set(), lastPage: 0 };
            catalogs.set(object, state);
        }
        var body = { mode: 'short', page: page, limit: PAGE_SIZE };
        var path = 'news';

        if (object.genres) {
            path = 'filter';
            body.tags = [String(object.genres)];
        }

        function fail() {
            if (catalogs.get(object) !== state || (component && component.destroyed)) return;
            if (page > state.lastPage && state.lastPage > 0 && object.page === page) {
                object.page = state.lastPage;
            }
            failure();
        }

        request(path, body, function (data) {
            if (catalogs.get(object) !== state || (component && component.destroyed)) return;
            var records = recordList(data);
            if (!records) {
                fail();
                return;
            }

            var cards = records.map(catalogCard).filter(Boolean).filter(function (card) {
                if (state.ids.has(card.id)) return false;
                state.ids.add(card.id);
                return true;
            });
            // The API returns no page count. Allow Lampa to advance while a full page has new entries.
            var total = page + Number(records.length >= PAGE_SIZE && cards.length > 0);
            state.lastPage = page;
            if (component) component.total_pages = total;
            success({ results: cards, page: page, total_pages: total });
        }, fail);
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
            playback.set(movie, { title: plain(record.title), options: playerOptions(record.xfields_data || {}) });
            success({ movie: movie });
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

    function translation(label, value, allowEmbed) {
        var unique = new Set();
        var streams = rows(value).map(function (item) {
            if (!item) return null;
            var url = directStream(item.source || item.link || item.url, item.format || item.type);
            var embed = !url && allowEmbed && mp4UploadEmbed(item.link);
            var key = url || embed;
            if (!key || unique.has(key)) return null;
            unique.add(key);
            return { url: url, embed: embed, quality: qualityOf(item.quality) };
        }).filter(Boolean).sort(function (a, b) {
            return Number(Boolean(b.url)) - Number(Boolean(a.url)) || b.quality - a.quality;
        });

        return streams.length ? { title: label, streams: streams } : null;
    }

    function asObject(data) {
        if (typeof data !== 'string') return data;
        try {
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    function playerOptions(fields) {
        var main = asObject(fields.plyr_json) || {};
        var labels = { voice: 'Озвучка', subs: 'Субтитры', raw: 'Оригинал' };
        var primary = [];
        var backup = [];

        Object.keys(labels).forEach(function (kind) {
            var group = main[kind];
            if (!group) return;
            if (kind === 'voice' && !Array.isArray(group) && !group.source && !group.url) {
                var studios = Object.keys(group);
                studios.forEach(function (studio) {
                    var label = labels[kind] + (studios.length > 1 ? ' · ' + plain(studio) : '');
                    var item = translation(label, group[studio]);
                    if (item) primary.push(item);
                });
            } else {
                var item = translation(labels[kind], group);
                if (item) primary.push(item);
            }
        });

        var extras = rows(asObject(fields.json_player_subs));
        Object.keys(labels).forEach(function (kind) {
            var group = extras.filter(function (item) { return item && item.type === kind; });
            var item = translation(labels[kind], group, true);
            if (item) backup.push(item);
        });

        return [
            primary.length && { title: 'Основной', translations: primary },
            backup.length && { title: 'Дополнительный', translations: backup }
        ].filter(Boolean);
    }

    function play(movie, video, item) {
        var first = item.streams[0];
        if (first.embed) {
            var active = Lampa.Activity.active();
            function unavailable() {
                if (Lampa.Activity.active() === active) {
                    Lampa.Noty.show('Дополнительный плеер сейчас недоступен.');
                }
            }
            nativeRequest(first.embed, 'GET', null, 'text', function (html) {
                if (Lampa.Activity.active() !== active) return;
                // Read the public media source in the embed without running the page.
                var match = typeof html === 'string' &&
                    html.match(/\bplayer\.src\(\s*\{\s*type:\s*["']video\/mp4["']\s*,\s*src:\s*["']([^"']+)["']/i);
                var url = match && directStream(match[1], 'mp4');
                if (!url || !/(^|\.)mp4upload\.com$/i.test(new URL(url).hostname)) {
                    unavailable();
                    return;
                }
                Lampa.Player.play({
                    url: url,
                    title: video.title,
                    card: movie,
                    headers: { Referer: first.embed }
                });
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
        Lampa.Player.play(data);
    }

    function openPlayers(movie, video) {
        var external = Lampa.Storage.field('player') === 'android';
        var options = video.options.map(function (player) {
            var translations = player.translations.filter(function (item) {
                return item.streams[0].url || external;
            });
            return { title: player.title, translations: translations };
        }).filter(function (player) { return player.translations.length; });
        if (!options.length) {
            Lampa.Noty.show('Для выбранного типа плеера видео недоступно.');
            return;
        }

        Lampa.Select.show({
            title: 'Плеер',
            items: options,
            nohide: true,
            onBack: function () { Lampa.Controller.toggle('content'); },
            onSelect: function (player) {
                Lampa.Select.show({
                    title: 'Перевод',
                    items: player.translations.map(function (item) {
                        return { title: escapeHtml(item.title), translation: item };
                    }),
                    onSelect: function (choice) { play(movie, video, choice.translation); }
                });
            }
        });
    }

    function onFull(event) {
        var movie = event.data && event.data.movie;
        if (!movie || movie.source !== SOURCE) return;
        if (event.type === 'start') {
            // Lampa emits start only for profiles allowed to watch this card.
            canWatch.add(movie);
            return;
        }
        if (event.type !== 'build' || event.name !== 'start' || !canWatch.has(movie)) return;

        var video = playback.get(movie);
        if (!video || !video.options.length) return;

        event.item.use({
            onGroupButtons: function () {
                var button = this.html.find('.button--play');
                button.removeClass('hide').off('hover:enter').on('hover:enter', function () {
                    openPlayers(movie, video);
                });
            }
        });
    }

    function init() {
        if (Lampa.Api.sources[SOURCE]) return;

        Lampa.Api.sources[SOURCE] = { list: loadList, full: loadFull, clear: function () {} };
        Lampa.Listener.follow('full', onFull);

        var icon = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h7v7H4zm9 0h7v7h-7zm0 9h7v7h-7zm-9 0h7v7H4z"/></svg>';
        Lampa.Menu.addButton(icon, NAME, function () {
            Lampa.Activity.push({ title: NAME, component: 'category_full', source: SOURCE, page: 1, url: '' });
        });
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (event) {
        if (event.type === 'ready') init();
    });
})();
