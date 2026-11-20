
(function () {
    'use strict';

    var PLUGIN = 'anistar_lampa_ready';
    var BASE = 'https://anistar.org/';
    var LIST = 'anistar_list';
    var EPISODES = 'anistar_episodes';

    if (window[PLUGIN]) return;
    window[PLUGIN] = true;

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (ch) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
        });
    }

    function absoluteUrl(url) {
        try { return new URL(url, BASE).href; }
        catch (e) { return ''; }
    }

    function parseDocument(html) {
        return new DOMParser().parseFromString(String(html || ''), 'text/html');
    }

    function getText(node) {
        return (node && node.textContent || '').replace(/\s+/g, ' ').trim();
    }

    // Получение каталога аниме
    function parseCatalog(html) {
        var doc = parseDocument(html);
        var found = {};
        var items = [];

        Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (a) {
            var href = absoluteUrl(a.getAttribute('href'));
            var title = getText(a);

            if (!href || !title || !/anistar\.org$/i.test(new URL(href).hostname)) return;
            if (!/\/\d+-[^/]+\.html(?:$|[?#])/i.test(href)) return;
            if (title.length < 3 || title.length > 180) return;
            if (/^(смотреть|image|главная|новинки|аниме)$/i.test(title)) return;
            if (found[href]) return;

            var block = a.closest('article, .shortstory, .shortstory__title, .item, .movie-item, .post') || a.parentElement;
            var image = block && block.querySelector('img');
            var poster = image ? (image.getAttribute('data-src') || image.getAttribute('src') || image.getAttribute('data-original') || '') : '';

            if (/^смотреть$/i.test(title)) {
                var heading = block && block.querySelector('h1,h2,h3,.title,.shortstory__title');
                title = getText(heading);
            }

            if (!title) return;

            found[href] = true;
            items.push({
                title: title,
                url: href,
                poster: absoluteUrl(poster),
                description: ''
            });
        });

        return items;
    }

    // Получение списка серий
    function parseEpisodes(html, anime) {
        var doc = parseDocument(html);
        var episodes = [];
        var seen = {};

        Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (a) {
            var title = getText(a);
            var href = absoluteUrl(a.getAttribute('href'));

            if (!href || !title) return;
            if (!/серия\s*\d+/i.test(title)) return;
            if (seen[href]) return;

            seen[href] = true;

            episodes.push({
                title: title.trim(),
                url: href,
                anime: anime
            });
        });

        return episodes;
    }

    function showError(activity, message) {
        activity.loader(false);
        Lampa.Noty.show(message || 'Не удалось загрузить данные AniStar');
    }

    // Экран каталога
    function ListScreen(object) {
        var self = this;
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var alive = true;

        this.create = function () {
            self.activity.loader(true);

            network.native(object.pageUrl || BASE, function (html) {
                if (!alive) return;

                self.activity.loader(false);

                var items = parseCatalog(html);

                if (!items.length) {
                    Lampa.Noty.show('AniStar: не удалось найти карточки аниме на странице');
                    self.activity.empty();
                    return;
                }

                items.forEach(function (item) {
                    var card = $(
                        '<div class="anistar-card" style="display:flex;align-items:center;margin:0.7em 0;padding:0.5em;background:rgba(255,255,255,0.04);border-radius:0.4em;">' +
                            '<div style="width:5.5em;min-width:5.5em;height:7.7em;margin-right:1em;background:rgba(255,255,255,0.08);border-radius:0.25em;overflow:hidden;">' +
                                (item.poster ? '<img src="' + escapeHtml(item.poster) + '" style="width:100%;height:100%;object-fit:cover;">' : '') +
                            '</div>' +
                            '<div style="flex:1;min-width:0;">' +
                                '<div style="font-size:1.05em;font-weight:600;">' + escapeHtml(item.title) + '</div>' +
                                '<div style="opacity:.65;font-size:.85em;margin-top:.5em;">AniStar</div>' +
                                '<div class="selector anistar-watch" style="display:inline-block;margin-top:.8em;padding:.45em 1em;border-radius:.3em;background:rgba(255,255,255,.12);">▶ Смотреть</div>' +
                            '</div>' +
                        '</div>'
                    );

                    card.find('.anistar-watch').on('hover:enter', function (event) {
                        if (event && event.stopPropagation) event.stopPropagation();

                        Lampa.Activity.push({
                            url: '',
                            title: item.title,
                            component: EPISODES,
                            anime: item,
                            page: 1
                        });
                    });

                    scroll.append(card);
                });

            }, function () {
                if (alive) showError(self.activity, 'Ошибка загрузки каталога AniStar');
            }, { dataType: 'text' });

            return this.render();
        };

        this.start = function () {};
        this.stop = function () {};
        this.render = function () { return scroll.render(); };

        this.empty = function () {
            self.activity.loader(false);
            self.activity.empty();
        };

        this.destroy = function () {
            alive = false;
            network.clear();
            scroll.destroy();
        };
    }

    // Экран серий
    function EpisodesScreen(object) {
        var self = this;
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var alive = true;
        var anime = object.anime || {};

        this.create = function () {
            self.activity.loader(true);

            network.native(anime.url, function (html) {
                if (!alive) return;

                self.activity.loader(false);

                var doc = parseDocument(html);
                var description = '';
                var heading = doc.querySelector('h1');
                var intro = doc.querySelector('.full-text, .fullstory, .description, .shortstory__text');

                if (intro) description = getText(intro);

                if (heading) {
                    scroll.append($(
                        '<div style="font-size:1.2em;font-weight:600;margin:0.6em 0;">' +
                        escapeHtml(getText(heading)) +
                        '</div>'
                    ));
                }

                if (description) {
                    scroll.append($(
                        '<div style="opacity:.75;margin:0.5em 0 1em;">' +
                        escapeHtml(description.slice(0, 700)) +
                        '</div>'
                    ));
                }

                var episodes = parseEpisodes(html, anime);

                if (!episodes.length) {
                    scroll.append($('<div style="padding:1em;opacity:.7;">Список серий на странице не найден.</div>'));
                    return;
                }

                episodes.forEach(function (episode) {
                    var row = $(
                        '<div class="selector" style="padding:1em;margin:.35em 0;background:rgba(255,255,255,.06);border-radius:.3em;">▶ ' +
                        escapeHtml(episode.title) +
                        '</div>'
                    );

                    row.on('hover:enter', function () {
                        // Пока открываем страницу серии на AniStar.
                        // Интеграция видеопотока с плеером Lampa будет следующим этапом.
                        if (Lampa.Platform && Lampa.Platform.open) {
                            Lampa.Platform.open(episode.url);
                        } else {
                            window.open(episode.url, '_blank');
                        }
                    });

                    scroll.append(row);
                });

            }, function () {
                if (alive) showError(self.activity, 'Ошибка загрузки страницы аниме');
            }, { dataType: 'text' });

            return this.render();
        };

        this.start = function () {};
        this.stop = function () {};
        this.render = function () { return scroll.render(); };

        this.empty = function () {
            self.activity.loader(false);
            self.activity.empty();
        };

        this.destroy = function () {
            alive = false;
            network.clear();
            scroll.destroy();
        };
    }

    // Регистрация каталога и пункта бокового меню
    function init() {
        if (!window.Lampa || !Lampa.Component || !Lampa.Reguest) return;

        if (!Lampa.Component.get(LIST)) {
            Lampa.Component.add(LIST, ListScreen);
        }

        if (!Lampa.Component.get(EPISODES)) {
            Lampa.Component.add(EPISODES, EpisodesScreen);
        }

        if (!$('.menu .menu__list .anistar-menu-item').length) {
            var item = $(
                '<li class="menu__item selector anistar-menu-item">' +
                    '<div class="menu__ico">' +
                        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
                            '<path fill="currentColor" d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 3v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2z"/>' +
                        '</svg>' +
                    '</div>' +
                    '<div class="menu__text">Анистар</div>' +
                '</li>'
            );

            item.on('hover:enter', function () {
                Lampa.Activity.push({
                    url: '',
                    title: 'Анистар',
                    component: LIST,
                    page: 1
                });
            });

            $('.menu .menu__list').eq(0).append(item);
        }
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') init();
        });
    }

})();
