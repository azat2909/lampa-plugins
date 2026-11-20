
(function () {
    'use strict';

    var PLUGIN_FLAG = 'plugin_anistar_ready';
    var BASE_URL = 'https://anistar.org/';
    var CATALOG_COMPONENT = 'anistar_catalog';
    var DETAIL_COMPONENT = 'anistar_detail';

    if (window[PLUGIN_FLAG]) return;
    window[PLUGIN_FLAG] = true;

    // --------------------------------------------------
    // Общие функции
    // --------------------------------------------------

    function textOf(element) {
        return (element && element.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char];
        });
    }

    function absoluteUrl(value) {
        try {
            var url = new URL(value, BASE_URL);

            if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                return '';
            }

            var host = url.hostname.toLowerCase();

            if (host !== 'anistar.org' && host !== 'www.anistar.org') {
                return '';
            }

            return url.href;
        }
        catch (error) {
            return '';
        }
    }

    function isAnimeUrl(url) {
        try {
            var parsed = new URL(url);

            return /^\/\d+-[^/]+\.html$/i.test(parsed.pathname);
        }
        catch (error) {
            return false;
        }
    }

    function parseDocument(html) {
        return new DOMParser().parseFromString(
            String(html || ''),
            'text/html'
        );
    }

    function getImageUrl(img) {
        if (!img) return '';

        return absoluteUrl(
            img.getAttribute('data-src') ||
            img.getAttribute('data-original') ||
            img.getAttribute('data-lazy-src') ||
            img.getAttribute('src') ||
            ''
        );
    }

    function getCardContainer(anchor) {
        var current = anchor;
        var depth = 0;

        while (current && depth < 6) {
            if (
                current.matches &&
                current.matches(
                    'article, .shortstory, .shortstory-item, ' +
                    '.movie-item, .item, .post, .news-item'
                )
            ) {
                return current;
            }

            current = current.parentElement;
            depth++;
        }

        return anchor.parentElement || anchor;
    }

    function findCardTitle(anchor, container) {
        var title = textOf(anchor);

        if (
            title &&
            !/^(смотреть|image|изображение|подробнее|читать далее)$/i.test(title)
        ) {
            return title;
        }

        var heading = container.querySelector(
            'h1, h2, h3, h4, .title, .shortstory__title, .news-title'
        );

        title = textOf(heading);

        if (
            title &&
            !/^(смотреть|image|изображение)$/i.test(title)
        ) {
            return title;
        }

        // Ищем текстовую ссылку на ту же страницу.
        var links = container.querySelectorAll('a[href]');

        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var href = absoluteUrl(link.getAttribute('href'));

            if (href !== absoluteUrl(anchor.getAttribute('href'))) {
                continue;
            }

            title = textOf(link);

            if (
                title &&
                !/^(смотреть|image|изображение|подробнее)$/i.test(title)
            ) {
                return title;
            }
        }

        return '';
    }

    function findCardPoster(anchor, container) {
        var image = container.querySelector('img');
        var poster = getImageUrl(image);

        if (poster) return poster;

        var href = absoluteUrl(anchor.getAttribute('href'));
        var links = container.querySelectorAll('a[href]');

        for (var i = 0; i < links.length; i++) {
            if (absoluteUrl(links[i].getAttribute('href')) !== href) {
                continue;
            }

            poster = getImageUrl(links[i].querySelector('img'));

            if (poster) return poster;
        }

        return '';
    }

    // --------------------------------------------------
    // Парсер каталога
    // --------------------------------------------------

    function parseCatalog(html) {
        var doc = parseDocument(html);
        var items = [];
        var found = {};

        var links = doc.querySelectorAll('a[href]');

        Array.prototype.forEach.call(links, function (anchor) {
            var url = absoluteUrl(anchor.getAttribute('href'));

            if (!url || !isAnimeUrl(url)) return;
            if (found[url]) return;

            var container = getCardContainer(anchor);
            var title = findCardTitle(anchor, container);

            if (!title) return;
            if (title.length < 2 || title.length > 200) return;

            if (/^(главная|новинки|аниме|манга|дорамы)$/i.test(title)) {
                return;
            }

            found[url] = true;

            items.push({
                title: title,
                url: url,
                poster: findCardPoster(anchor, container)
            });
        });

        return items;
    }

    // --------------------------------------------------
    // Поиск следующей страницы
    // --------------------------------------------------

    function findNextPage(html, currentUrl) {
        var doc = parseDocument(html);
        var links = doc.querySelectorAll(
            'a[rel="next"], .pagination a, .navigation a, a[href]'
        );

        var current = absoluteUrl(currentUrl);

        // Сначала ищем rel="next".
        var relNext = doc.querySelector('a[rel="next"]');

        if (relNext) {
            var relUrl = absoluteUrl(relNext.getAttribute('href'));

            if (relUrl && relUrl !== current) return relUrl;
        }

        // Затем ищем кнопку следующей страницы.
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var label = textOf(link).toLowerCase();

            if (
                label === '»' ||
                label === '›' ||
                label === '>' ||
                label === 'следующая' ||
                label === 'далее' ||
                label === 'следующая страница'
            ) {
                var nextUrl = absoluteUrl(link.getAttribute('href'));

                if (nextUrl && nextUrl !== current) {
                    return nextUrl;
                }
            }
        }

        return '';
    }

    // --------------------------------------------------
    // Связанные сезоны и части
    // --------------------------------------------------

    function parseRelated(html, currentUrl) {
        var doc = parseDocument(html);
        var result = [];
        var found = {};

        var walker = doc.createTreeWalker(
            doc.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        var marker = null;
        var node;

        while ((node = walker.nextNode())) {
            if (/серия состоит из/i.test(node.nodeValue || '')) {
                marker = node.parentElement;
                break;
            }
        }

        if (!marker) return result;

        // Поднимаемся до контейнера, в котором находятся связанные ссылки.
        var container = marker;
        var depth = 0;

        while (container && depth < 5) {
            if (container.querySelectorAll('a[href]').length > 0) break;

            container = container.parentElement;
            depth++;
        }

        if (!container) return result;

        var links = container.querySelectorAll('a[href]');
        var current = absoluteUrl(currentUrl);

        Array.prototype.forEach.call(links, function (anchor) {
            var url = absoluteUrl(anchor.getAttribute('href'));
            var title = textOf(anchor);

            if (!url || !title) return;
            if (url === current) return;
            if (!isAnimeUrl(url)) return;
            if (found[url]) return;

            found[url] = true;

            result.push({
                title: title.replace(/^#\s*\d+\s*/, '').trim() || title,
                url: url
            });
        });

        return result;
    }

    // --------------------------------------------------
    // Сетевые запросы
    // --------------------------------------------------

    function requestHtml(url, success, failure) {
        var request = new Lampa.Reguest();

        request.native(
            url,
            function (html) {
                success(html);
            },
            function (error) {
                if (failure) failure(error);
            },
            {
                dataType: 'text'
            }
        );

        return request;
    }

    function clearRequest(request) {
        if (request && typeof request.clear === 'function') {
            request.clear();
        }
    }

    function showError(message) {
        if (Lampa.Noty && Lampa.Noty.show) {
            Lampa.Noty.show(message);
        }
    }

    function openExternal(url) {
        if (!url) return;

        if (Lampa.Platform && typeof Lampa.Platform.open === 'function') {
            Lampa.Platform.open(url);
        }
        else {
            window.open(url, '_blank');
        }
    }

    // --------------------------------------------------
    // Открытие карточки
    // --------------------------------------------------

    function openDetail(item) {
        Lampa.Activity.push({
            url: '',
            title: item.title,
            component: DETAIL_COMPONENT,
            data: {
                anime: item
            },
            page: 1
        });
    }

    // --------------------------------------------------
    // Экран каталога
    // --------------------------------------------------

    function CatalogScreen(object) {
        var self = this;
        var scroll = new Lampa.Scroll({
            mask: true,
            over: true
        });

        var request = null;
        var alive = true;

        var pageUrl = absoluteUrl(
            object.data && object.data.pageUrl
                ? object.data.pageUrl
                : BASE_URL
        ) || BASE_URL;

        this.create = function () {
            self.activity.loader(true);

            request = requestHtml(
                pageUrl,
                function (html) {
                    if (!alive) return;

                    self.activity.loader(false);

                    var items = parseCatalog(html);

                    if (!items.length) {
                        showError(
                            'AniStar: на странице не найдены карточки аниме'
                        );

                        self.activity.empty();
                        return;
                    }

                    items.forEach(function (item) {
                        var poster = item.poster
                            ? '<img src="' + escapeHtml(item.poster) +
                              '" loading="lazy" style="' +
                              'width:100%;height:100%;object-fit:cover;">'
                            : '';

                        var card = $(
                            '<div class="selector anistar-card" style="' +
                                'display:flex;' +
                                'align-items:center;' +
                                'padding:.7em;' +
                                'margin:.5em 0;' +
                                'border-radius:.4em;' +
                                'background:rgba(255,255,255,.05);' +
                            '">' +
                                '<div style="' +
                                    'width:6em;' +
                                    'min-width:6em;' +
                                    'height:8.5em;' +
                                    'margin-right:1em;' +
                                    'overflow:hidden;' +
                                    'border-radius:.3em;' +
                                    'background:rgba(255,255,255,.08);' +
                                '">' +
                                    poster +
                                '</div>' +
                                '<div style="flex:1;min-width:0;">' +
                                    '<div style="font-size:1.05em;font-weight:600;">' +
                                        escapeHtml(item.title) +
                                    '</div>' +
                                    '<div style="opacity:.6;margin-top:.5em;font-size:.85em;">' +
                                        'AniStar' +
                                    '</div>' +
                                    '<div style="margin-top:.7em;opacity:.85;">' +
                                        'Открыть описание →' +
                                    '</div>' +
                                '</div>' +
                            '</div>'
                        );

                        card.on('hover:enter', function () {
                            openDetail(item);
                        });

                        scroll.append(card);
                    });

                    var nextPage = findNextPage(html, pageUrl);

                    if (nextPage) {
                        var nextButton = $(
                            '<div class="selector" style="' +
                                'padding:1em;' +
                                'margin:1em 0;' +
                                'text-align:center;' +
                                'border-radius:.4em;' +
                                'background:rgba(255,255,255,.08);' +
                            '">' +
                                'Следующая страница →' +
                            '</div>'
                        );

                        nextButton.on('hover:enter', function () {
                            Lampa.Activity.push({
                                url: '',
                                title: 'Анистар',
                                component: CATALOG_COMPONENT,
                                data: {
                                    pageUrl: nextPage
                                },
                                page: 1
                            });
                        });

                        scroll.append(nextButton);
                    }
                },
                function () {
                    if (!alive) return;

                    self.activity.loader(false);

                    showError('Ошибка загрузки каталога AniStar');
                    self.activity.empty();
                }
            );

            return this.render();
        };

        this.start = function () {};
        this.stop = function () {};

        this.render = function () {
            return scroll.render();
        };

        this.destroy = function () {
            alive = false;
            clearRequest(request);
            scroll.destroy();
        };
    }

    // --------------------------------------------------
    // Экран информации об аниме
    // --------------------------------------------------

    function DetailScreen(object) {
        var self = this;
        var scroll = new Lampa.Scroll({
            mask: true,
            over: true
        });

        var request = null;
        var alive = true;

        var data = object.data || {};
        var anime = data.anime || {};

        this.create = function () {
            if (!anime.url || !isAnimeUrl(anime.url)) {
                showError('Не найдена корректная ссылка на аниме');
                self.activity.empty();

                return this.render();
            }

            self.activity.loader(true);

            request = requestHtml(
                anime.url,
                function (html) {
                    if (!alive) return;

                    self.activity.loader(false);

                    var doc = parseDocument(html);

                    var heading = doc.querySelector('h1');
                    var title = textOf(heading) || anime.title;

                    var descriptionNode = doc.querySelector(
                        '.full-text, .fullstory, .description, ' +
                        '.shortstory__text, .full-story'
                    );

                    var description = textOf(descriptionNode);

                    scroll.append($(
                        '<div style="' +
                            'font-size:1.3em;' +
                            'font-weight:600;' +
                            'margin:1em 0;' +
                        '">' +
                            escapeHtml(title) +
                        '</div>'
                    ));

                    var poster = anime.poster;

                    if (!poster) {
                        poster = getImageUrl(doc.querySelector(
                            '.fullstory img, .full-text img, .poster img, article img'
                        ));
                    }

                    if (poster) {
                        scroll.append($(
                            '<div style="' +
                                'width:11em;' +
                                'max-height:16em;' +
                                'overflow:hidden;' +
                                'margin:1em 0;' +
                                'border-radius:.3em;' +
                            '">' +
                                '<img src="' + escapeHtml(poster) + '" ' +
                                    'loading="lazy" style="width:100%;height:auto;">' +
                            '</div>'
                        ));
                    }

                    if (description) {
                        scroll.append($(
                            '<div style="' +
                                'line-height:1.5;' +
                                'opacity:.8;' +
                                'margin:1em 0;' +
                            '">' +
                                escapeHtml(description.slice(0, 2500)) +
                            '</div>'
                        ));
                    }

                    var related = parseRelated(html, anime.url);

                    if (related.length) {
                        scroll.append($(
                            '<div style="' +
                                'font-size:1.1em;' +
                                'font-weight:600;' +
                                'margin:1.5em 0 .7em;' +
                            '">' +
                                'Связанные сезоны и части' +
                            '</div>'
                        ));

                        related.forEach(function (part) {
                            var row = $(
                                '<div class="selector" style="' +
                                    'padding:1em;' +
                                    'margin:.4em 0;' +
                                    'border-radius:.3em;' +
                                    'background:rgba(255,255,255,.06);' +
                                '">' +
                                    escapeHtml(part.title) +
                                '</div>'
                            );

                            row.on('hover:enter', function () {
                                openDetail({
                                    title: part.title,
                                    url: part.url,
                                    poster: ''
                                });
                            });

                            scroll.append(row);
                        });
                    }

                    var siteButton = $(
                        '<div class="selector" style="' +
                            'padding:1em;' +
                            'margin:1em 0;' +
                            'border-radius:.3em;' +
                            'background:rgba(255,255,255,.1);' +
                        '">' +
                            'Открыть страницу на AniStar' +
                        '</div>'
                    );

                    siteButton.on('hover:enter', function () {
                        openExternal(anime.url);
                    });

                    scroll.append(siteButton);
                },
                function () {
                    if (!alive) return;

                    self.activity.loader(false);

                    showError('Ошибка загрузки страницы аниме');
                    self.activity.empty();
                }
            );

            return this.render();
        };

        this.start = function () {};
        this.stop = function () {};

        this.render = function () {
            return scroll.render();
        };

        this.destroy = function () {
            alive = false;
            clearRequest(request);
            scroll.destroy();
        };
    }

    // --------------------------------------------------
    // Инициализация и меню
    // --------------------------------------------------

    function init() {
        if (
            !window.Lampa ||
            !Lampa.Component ||
            !Lampa.Reguest ||
            !Lampa.Activity
        ) {
            return;
        }

        if (!Lampa.Component.get(CATALOG_COMPONENT)) {
            Lampa.Component.add(CATALOG_COMPONENT, CatalogScreen);
        }

        if (!Lampa.Component.get(DETAIL_COMPONENT)) {
            Lampa.Component.add(DETAIL_COMPONENT, DetailScreen);
        }

        if ($('.menu .menu__list .anistar-menu-item').length) {
            return;
        }

        var menuItem = $(
            '<li class="menu__item selector anistar-menu-item">' +
                '<div class="menu__ico">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
                        '<path fill="currentColor" d="' +
                            'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 3v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2z' +
                        '"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="menu__text">Анистар</div>' +
            '</li>'
        );

        menuItem.on('hover:enter', function () {
            Lampa.Activity.push({
                url: '',
                title: 'Анистар',
                component: CATALOG_COMPONENT,
                data: {
                    pageUrl: BASE_URL
                },
                page: 1
            });
        });

        $('.menu .menu__list').eq(0).append(menuItem);
    }

    // --------------------------------------------------
    // Запуск после готовности Lampa
    // --------------------------------------------------

    function start() {
        if (window.appready) {
            init();
        }
        else if (
            window.Lampa &&
            Lampa.Listener &&
            typeof Lampa.Listener.follow === 'function'
        ) {
            Lampa.Listener.follow('app', function (event) {
                if (event.type === 'ready') {
                    init();
                }
            });
        }
    }

    start();

})();
