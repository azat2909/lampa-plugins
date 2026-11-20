
(function () {
    'use strict';

    var PLUGIN_FLAG = 'plugin_anistar_ready';
    var BASE_URL = 'https://anistar.org/';
    var CATALOG = 'anistar_catalog';
    var DETAILS = 'anistar_details';

    if (window[PLUGIN_FLAG]) return;

    var initialized = false;

    // --------------------------------------------------
    // URL и текст
    // --------------------------------------------------

    function absoluteUrl(value) {
        try {
            var url = new URL(value, BASE_URL);
            var host = url.hostname.toLowerCase();

            if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                return '';
            }

            if (host !== 'anistar.org' && host !== 'www.anistar.org') {
                return '';
            }

            return url.href;
        }
        catch (e) {
            return '';
        }
    }

    function isAnimeUrl(value) {
        try {
            var url = new URL(value);

            return /^\/\d+-[^/]+\.html$/i.test(url.pathname);
        }
        catch (e) {
            return false;
        }
    }

    function textOf(element) {
        return (element && element.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (ch) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[ch];
        });
    }

    function parseDocument(html) {
        return new DOMParser().parseFromString(
            String(html || ''),
            'text/html'
        );
    }

    function getImageUrl(img) {
        if (!img) return '';

        var value =
            img.getAttribute('data-src') ||
            img.getAttribute('data-original') ||
            img.getAttribute('data-lazy-src') ||
            img.getAttribute('src') ||
            '';

        return absoluteUrl(value);
    }

    function isActionText(text) {
        return /^(смотреть|смотреть онлайн|подробнее|читать далее|image|изображение|перейти)$/i.test(
            String(text || '').trim()
        );
    }

    // --------------------------------------------------
    // Поиск контейнера карточки
    // --------------------------------------------------

    function findCardContainer(anchor) {
        var selectors = [
            'article',
            '.shortstory',
            '.shortstory-item',
            '.shortstory__item',
            '.movie-item',
            '.item',
            '.post',
            '.news-item'
        ].join(',');

        var parent = anchor.closest(selectors);

        if (parent) return parent;

        var current = anchor.parentElement;
        var depth = 0;

        while (current && depth < 5) {
            var links = current.querySelectorAll('a[href]');
            var images = current.querySelectorAll('img');

            if (links.length >= 2 || images.length > 0) {
                return current;
            }

            current = current.parentElement;
            depth++;
        }

        return anchor.parentElement || anchor;
    }

    // --------------------------------------------------
    // Парсер каталога
    // --------------------------------------------------

    function parseCatalog(html) {
        var doc = parseDocument(html);
        var groups = Object.create(null);
        var order = [];

        var links = doc.querySelectorAll('a[href]');

        Array.prototype.forEach.call(links, function (anchor) {
            var url = absoluteUrl(anchor.getAttribute('href'));

            if (!url || !isAnimeUrl(url)) return;

            if (!groups[url]) {
                groups[url] = {
                    url: url,
                    title: '',
                    poster: '',
                    container: null
                };

                order.push(url);
            }

            var group = groups[url];
            var title = textOf(anchor);

            if (
                title &&
                !isActionText(title) &&
                title.length >= 2 &&
                title.length <= 200
            ) {
                if (
                    !group.title ||
                    title.length > group.title.length
                ) {
                    group.title = title;
                }
            }

            // Сначала ищем изображение непосредственно в ссылке.
            if (!group.poster) {
                group.poster = getImageUrl(
                    anchor.querySelector('img')
                );
            }

            // Запоминаем контейнер карточки для дополнительного поиска.
            if (!group.container) {
                group.container = findCardContainer(anchor);
            }
        });

        var result = [];

        order.forEach(function (url) {
            var group = groups[url];
            var container = group.container;

            // Если заголовок не найден в ссылках, ищем его в карточке.
            if (container && !group.title) {
                var heading = container.querySelector(
                    'h1, h2, h3, h4, .title, ' +
                    '.shortstory__title, .news-title'
                );

                var headingText = textOf(heading);

                if (
                    headingText &&
                    !isActionText(headingText)
                ) {
                    group.title = headingText;
                }
            }

            // Ищем постер в контейнере.
            if (container && !group.poster) {
                var images = container.querySelectorAll('img');

                for (var i = 0; i < images.length; i++) {
                    var imageUrl = getImageUrl(images[i]);

                    if (imageUrl) {
                        group.poster = imageUrl;
                        break;
                    }
                }
            }

            if (!group.title) return;

            if (
                /^(главная|новинки|аниме|манга|дорамы|смотреть)$/i.test(
                    group.title
                )
            ) {
                return;
            }

            result.push({
                title: group.title,
                url: group.url,
                poster: group.poster
            });
        });

        return result;
    }

    // --------------------------------------------------
    // Поиск следующей страницы каталога
    // --------------------------------------------------

    function findNextPage(html, currentUrl) {
        var doc = parseDocument(html);
        var current = absoluteUrl(currentUrl);

        var relNext = doc.querySelector('a[rel="next"]');

        if (relNext) {
            var relUrl = absoluteUrl(
                relNext.getAttribute('href')
            );

            if (relUrl && relUrl !== current) {
                return relUrl;
            }
        }

        var containers = doc.querySelectorAll(
            '.pagination, .navigation, .nav-links, .pages'
        );

        var searchRoot = containers.length
            ? containers
            : [doc];

        for (var c = 0; c < searchRoot.length; c++) {
            var links = searchRoot[c].querySelectorAll
                ? searchRoot[c].querySelectorAll('a[href]')
                : [];

            for (var i = 0; i < links.length; i++) {
                var label = textOf(links[i]).toLowerCase();

                if (
                    label !== '»' &&
                    label !== '›' &&
                    label !== '>' &&
                    label !== 'следующая' &&
                    label !== 'далее' &&
                    label !== 'следующая страница'
                ) {
                    continue;
                }

                var nextUrl = absoluteUrl(
                    links[i].getAttribute('href')
                );

                if (nextUrl && nextUrl !== current) {
                    return nextUrl;
                }
            }
        }

        return '';
    }

    // --------------------------------------------------
    // Описание аниме
    // --------------------------------------------------

    function findDescription(doc) {
        var selectors = [
            '.full-text',
            '.fullstory',
            '.full-story',
            '.description',
            '.shortstory__text',
            '.shortstory'
        ];

        for (var i = 0; i < selectors.length; i++) {
            var element = doc.querySelector(selectors[i]);
            var value = textOf(element);

            if (value && value.length > 30) {
                return value;
            }
        }

        return '';
    }

    function findPagePoster(doc) {
        var selectors = [
            '.fullstory img',
            '.full-text img',
            '.full-story img',
            '.poster img',
            'article img'
        ];

        for (var i = 0; i < selectors.length; i++) {
            var image = doc.querySelector(selectors[i]);
            var url = getImageUrl(image);

            if (url) return url;
        }

        return '';
    }

    // --------------------------------------------------
    // Связанные сезоны и части
    // --------------------------------------------------

    function parseRelated(html, currentUrl) {
        var doc = parseDocument(html);
        var current = absoluteUrl(currentUrl);

        var result = [];
        var seen = Object.create(null);

        // Находим текстовый блок «Серия состоит из».
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

        // Ищем ближайший контейнер с несколькими ссылками на аниме.
        var container = marker;
        var depth = 0;

        while (container && depth < 5) {
            var links = container.querySelectorAll('a[href]');
            var count = 0;

            Array.prototype.forEach.call(links, function (a) {
                var url = absoluteUrl(a.getAttribute('href'));

                if (url && isAnimeUrl(url)) count++;
            });

            if (count > 0) break;

            container = container.parentElement;
            depth++;
        }

        if (!container) return result;

        var relatedLinks = container.querySelectorAll('a[href]');

        Array.prototype.forEach.call(relatedLinks, function (anchor) {
            var url = absoluteUrl(anchor.getAttribute('href'));
            var title = textOf(anchor);

            if (!url || !title) return;
            if (!isAnimeUrl(url)) return;
            if (url === current || seen[url]) return;

            seen[url] = true;

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
        if (
            request &&
            typeof request.clear === 'function'
        ) {
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

        if (
            Lampa.Platform &&
            typeof Lampa.Platform.open === 'function'
        ) {
            Lampa.Platform.open(url);
        }
        else {
            window.open(url, '_blank');
        }
    }

    // --------------------------------------------------
    // Открытие страницы аниме
    // --------------------------------------------------

    function openDetails(item) {
        Lampa.Activity.push({
            url: '',
            title: item.title,
            component: DETAILS,
            data: {
                anime: item
            },
            page: 1
        });
    }

    // --------------------------------------------------
    // Компонент каталога
    // --------------------------------------------------

    function CatalogScreen(object) {
        var self = this;

        var scroll = new Lampa.Scroll({
            mask: true,
            over: true
        });

        var request = null;
        var alive = true;

        var data = object.data || {};

        var pageUrl = absoluteUrl(
            data.pageUrl || BASE_URL
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
                            ? '<img src="' +
                                escapeHtml(item.poster) +
                                '" loading="lazy" style="' +
                                    'width:100%;' +
                                    'height:100%;' +
                                    'object-fit:cover;' +
                                '">'
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
                            openDetails(item);
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
                                component: CATALOG,
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
    // Компонент страницы аниме
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

                    var description = findDescription(doc);
                    var poster = anime.poster || findPagePoster(doc);

                    scroll.append($(
                        '<div style="' +
                            'font-size:1.3em;' +
                            'font-weight:600;' +
                            'margin:1em 0;' +
                        '">' +
                            escapeHtml(title) +
                        '</div>'
                    ));

                    if (poster) {
                        scroll.append($(
                            '<div style="' +
                                'width:11em;' +
                                'max-height:16em;' +
                                'overflow:hidden;' +
                                'margin:1em 0;' +
                                'border-radius:.3em;' +
                            '">' +
                                '<img src="' +
                                    escapeHtml(poster) +
                                    '" loading="lazy" style="' +
                                        'width:100%;' +
                                        'height:auto;' +
                                    '">' +
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

                    // Связанные сезоны и части.
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
                                openDetails({
                                    title: part.title,
                                    url: part.url,
                                    poster: ''
                                });
                            });

                            scroll.append(row);
                        });
                    }

                    // Открытие оригинальной страницы сайта.
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
    // Регистрация компонентов и меню
    // --------------------------------------------------

    function init() {
        if (initialized) return;

        if (
            !window.Lampa ||
            !Lampa.Component ||
            !Lampa.Activity ||
            !Lampa.Reguest
        ) {
            return;
        }

        initialized = true;
        window[PLUGIN_FLAG] = true;

        if (
            !Lampa.Component.get ||
            !Lampa.Component.get(CATALOG)
        ) {
            Lampa.Component.add(CATALOG, CatalogScreen);
        }

        if (
            !Lampa.Component.get ||
            !Lampa.Component.get(DETAILS)
        ) {
            Lampa.Component.add(DETAILS, DetailScreen);
        }

        var menuList = $('.menu .menu__list').eq(0);

        if (!menuList.length) {
            console.warn('AniStar: меню Lampa не найдено');
            return;
        }

        if (menuList.find('.anistar-menu-item').length) {
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
                component: CATALOG,
                data: {
                    pageUrl: BASE_URL
                },
                page: 1
            });
        });

        menuList.append(menuItem);

        console.log('AniStar: плагин инициализирован');
    }

    // --------------------------------------------------
    // Запуск после готовности Lampa
    // --------------------------------------------------

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

})();
