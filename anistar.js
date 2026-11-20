
(function () {
    'use strict';

    var PLUGIN = 'anistar_lampa_ready';
    var BASE = 'https://anistar.org/';
    var LIST = 'anistar_list';
    var DETAILS = 'anistar_details';

    if (window[PLUGIN]) return;

    window[PLUGIN] = true;

    // --------------------------------------------------
    // Вспомогательные функции
    // --------------------------------------------------

    function absoluteUrl(url) {
        try {
            var result = new URL(url, BASE);

            if (result.protocol !== 'https:' && result.protocol !== 'http:') {
                return '';
            }

            if (!/(^|\.)anistar\.org$/i.test(result.hostname)) {
                return '';
            }

            return result.href;
        }
        catch (e) {
            return '';
        }
    }

    function getText(node) {
        return (node && node.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function parseDocument(html) {
        return new DOMParser().parseFromString(
            String(html || ''),
            'text/html'
        );
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

    function getImage(block) {
        if (!block) return '';

        var img = block.querySelector('img');

        if (!img) return '';

        return absoluteUrl(
            img.getAttribute('data-src') ||
            img.getAttribute('data-original') ||
            img.getAttribute('src') ||
            ''
        );
    }

    function isAnimeUrl(url) {
        return /\/\d+-[^/]+\.html(?:$|[?#])/i.test(url);
    }

    // --------------------------------------------------
    // Парсер каталога
    // --------------------------------------------------

    function parseCatalog(html) {
        var doc = parseDocument(html);
        var items = [];
        var seen = {};

        Array.prototype.forEach.call(
            doc.querySelectorAll('a[href]'),
            function (a) {
                var url = absoluteUrl(a.getAttribute('href'));

                if (!url || !isAnimeUrl(url)) return;
                if (seen[url]) return;

                var title = getText(a);

                // Пропускаем кнопки без названия.
                if (!title || /^смотреть$/i.test(title)) {
                    var parent = a.closest(
                        'article, .shortstory, .shortstory__title, .item, .post'
                    );

                    var heading = parent && parent.querySelector(
                        'h1, h2, h3, .title, .shortstory__title'
                    );

                    title = getText(heading);
                }

                if (!title || title.length < 2 || title.length > 200) {
                    return;
                }

                if (/^(главная|новинки|аниме|манга|дорамы)$/i.test(title)) {
                    return;
                }

                var block = a.closest(
                    'article, .shortstory, .item, .movie-item, .post'
                ) || a.parentElement;

                var poster = getImage(block);

                seen[url] = true;

                items.push({
                    title: title,
                    url: url,
                    poster: poster
                });
            }
        );

        return items;
    }

    // --------------------------------------------------
    // Парсер связанных сезонов и частей
    // --------------------------------------------------

    function parseRelated(html, currentUrl) {
        var doc = parseDocument(html);
        var result = [];
        var seen = {};

        var allLinks = doc.querySelectorAll('a[href]');

        Array.prototype.forEach.call(allLinks, function (a) {
            var url = absoluteUrl(a.getAttribute('href'));
            var title = getText(a);

            if (!url || !title) return;
            if (url === currentUrl) return;
            if (!isAnimeUrl(url)) return;
            if (seen[url]) return;

            var parentText = getText(a.parentElement);

            // На AniStar связанные части часто имеют вид #1, #2 и т.д.
            var isRelated =
                /^#\s*\d+/.test(parentText) ||
                /^#\s*\d+/.test(title) ||
                /серия состоит из|в каком порядке лучше смотреть/i.test(
                    parentText
                );

            if (!isRelated) return;

            seen[url] = true;

            result.push({
                title: title.replace(/^#\s*\d+\s*/, '').trim() || title,
                url: url
            });
        });

        return result;
    }

    // --------------------------------------------------
    // Загрузка HTML
    // --------------------------------------------------

    function requestHtml(url, success, failure) {
        var request = new Lampa.Reguest();

        request.native(
            url,
            function (html) {
                success(html);
            },
            function () {
                if (failure) failure();
            },
            {
                dataType: 'text'
            }
        );

        return request;
    }

    function showError(message) {
        Lampa.Noty.show(message || 'Не удалось загрузить AniStar');
    }

    // --------------------------------------------------
    // Открытие карточки аниме
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
    // Экран каталога
    // --------------------------------------------------

    function ListScreen(object) {
        var self = this;
        var scroll = new Lampa.Scroll({
            mask: true,
            over: true
        });

        var request = null;
        var alive = true;

        var pageUrl = object.data && object.data.pageUrl
            ? object.data.pageUrl
            : BASE;

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
                            'Не удалось найти карточки аниме на странице'
                        );

                        self.activity.empty();
                        return;
                    }

                    items.forEach(function (item) {
                        var card = $(
                            '<div class="selector anistar-item">' +
                                '<div class="anistar-poster">' +
                                    (item.poster
                                        ? '<img src="' +
                                            escapeHtml(item.poster) +
                                            '" loading="lazy">'
                                        : '') +
                                '</div>' +
                                '<div class="anistar-info">' +
                                    '<div class="anistar-title">' +
                                        escapeHtml(item.title) +
                                    '</div>' +
                                    '<div class="anistar-subtitle">' +
                                        'AniStar' +
                                    '</div>' +
                                '</div>' +
                            '</div>'
                        );

                        card.on('hover:enter', function () {
                            openDetails(item);
                        });

                        scroll.append(card);
                    });

                    // Поиск следующей страницы.
                    var next = null;

                    Array.prototype.forEach.call(
                        parseDocument(html).querySelectorAll('a[href]'),
                        function (a) {
                            var text = getText(a);

                            if (text === '»' || /^следующ/i.test(text)) {
                                next = absoluteUrl(a.getAttribute('href'));
                            }
                        }
                    );

                    if (next && next !== pageUrl) {
                        var nextButton = $(
                            '<div class="selector anistar-next">' +
                                'Следующая страница →' +
                            '</div>'
                        );

                        nextButton.on('hover:enter', function () {
                            Lampa.Activity.push({
                                url: '',
                                title: 'Анистар',
                                component: LIST,
                                data: {
                                    pageUrl: next
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

            if (request) request.clear();

            scroll.destroy();
        };
    }

    // --------------------------------------------------
    // Экран информации об аниме
    // --------------------------------------------------

    function DetailsScreen(object) {
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
            if (!anime.url) {
                showError('Не найдена ссылка на аниме');
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
                    var intro = doc.querySelector(
                        '.full-text, .fullstory, .description, .shortstory__text'
                    );

                    var title = getText(heading) || anime.title;
                    var description = getText(intro);

                    var header = $(
                        '<div class="anistar-details-title">' +
                            escapeHtml(title) +
                        '</div>'
                    );

                    scroll.append(header);

                    if (anime.poster) {
                        scroll.append($(
                            '<div class="anistar-details-poster">' +
                                '<img src="' +
                                escapeHtml(anime.poster) +
                                '" loading="lazy">' +
                            '</div>'
                        ));
                    }

                    if (description) {
                        scroll.append($(
                            '<div class="anistar-description">' +
                                escapeHtml(description.slice(0, 1500)) +
                            '</div>'
                        ));
                    }

                    var related = parseRelated(html, anime.url);

                    if (related.length) {
                        scroll.append($(
                            '<div class="anistar-section-title">' +
                                'Связанные сезоны и части' +
                            '</div>'
                        ));

                        related.forEach(function (part) {
                            var row = $(
                                '<div class="selector anistar-related">' +
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

                    // Открытие оригинальной страницы AniStar.
                    var siteButton = $(
                        '<div class="selector anistar-open-site">' +
                            'Открыть страницу AniStar' +
                        '</div>'
                    );

                    siteButton.on('hover:enter', function () {
                        if (Lampa.Platform && Lampa.Platform.open) {
                            Lampa.Platform.open(anime.url);
                        }
                        else {
                            window.open(anime.url, '_blank');
                        }
                    });

                    scroll.append(siteButton);
                },
                function () {
                    if (!alive) return;

                    self.activity.loader(false);
                    showError('Ошибка загрузки страницы аниме');
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

            if (request) request.clear();

            scroll.destroy();
        };
    }

    // --------------------------------------------------
    // Стили
    // --------------------------------------------------

    function addStyles() {
        if ($('#anistar-plugin-styles').length) return;

        $('head').append(
            '<style id="anistar-plugin-styles">' +

            '.anistar-item {' +
                'display:flex;' +
                'align-items:center;' +
                'padding:1em;' +
                'margin:.4em 0;' +
                'border-radius:.4em;' +
                'background:rgba(255,255,255,.04);' +
            '}' +

            '.anistar-poster {' +
                'width:5em;' +
                'min-width:5em;' +
                'height:7em;' +
                'margin-right:1em;' +
                'overflow:hidden;' +
                'border-radius:.3em;' +
                'background:rgba(255,255,255,.08);' +
            '}' +

            '.anistar-poster img {' +
                'width:100%;' +
                'height:100%;' +
                'object-fit:cover;' +
            '}' +

            '.anistar-info {' +
                'min-width:0;' +
                'flex:1;' +
            '}' +

            '.anistar-title {' +
                'font-size:1.05em;' +
                'font-weight:600;' +
            '}' +

            '.anistar-subtitle {' +
                'opacity:.5;' +
                'font-size:.85em;' +
                'margin-top:.5em;' +
            '}' +

            '.anistar-next, .anistar-related, .anistar-open-site {' +
                'padding:1em;' +
                'margin:.5em 0;' +
                'border-radius:.3em;' +
                'background:rgba(255,255,255,.06);' +
            '}' +

            '.anistar-details-title {' +
                'font-size:1.3em;' +
                'font-weight:600;' +
                'margin:1em 0;' +
            '}' +

            '.anistar-details-poster {' +
                'width:10em;' +
                'max-height:15em;' +
                'overflow:hidden;' +
                'margin:1em 0;' +
            '}' +

            '.anistar-details-poster img {' +
                'width:100%;' +
                'height:auto;' +
            '}' +

            '.anistar-description {' +
                'opacity:.8;' +
                'line-height:1.5;' +
                'margin:1em 0;' +
            '}' +

            '.anistar-section-title {' +
                'font-size:1.1em;' +
                'font-weight:600;' +
                'margin:1.5em 0 .7em;' +
            '}' +

            '</style>'
        );
    }

    // --------------------------------------------------
    // Инициализация
    // --------------------------------------------------

    function init() {
        if (!window.Lampa || !Lampa.Component || !Lampa.Reguest) {
            return;
        }

        if (!Lampa.Component.get(LIST)) {
            Lampa.Component.add(LIST, ListScreen);
        }

        if (!Lampa.Component.get(DETAILS)) {
            Lampa.Component.add(DETAILS, DetailsScreen);
        }

        addStyles();

        if ($('.menu .menu__list .anistar-menu-item').length) {
            return;
        }

        var menuItem = $(
            '<li class="menu__item selector anistar-menu-item">' +
                '<div class="menu__ico">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" ' +
                        'viewBox="0 0 24 24">' +
                        '<path fill="currentColor" d="' +
                        'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 3v12h12V6H6z' +
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
                component: LIST,
                data: {
                    pageUrl: BASE
                },
                page: 1
            });
        });

        $('.menu .menu__list').eq(0).append(menuItem);
    }

    if (window.appready) {
        init();
    }
    else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                init();
            }
        });
    }

})();
