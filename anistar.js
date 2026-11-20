
/*!
 * ============================================================
 * AniStar для Lampa
 * Версия: 0.4.1
 * ============================================================
 *
 * Возможности:
 * - Каталог AniStar.
 * - Получение HTML и разбор карточек.
 * - Навигация штатным контроллером Lampa.
 * - Управление стрелками и OK на пульте.
 * - Автоматическая подгрузка следующих страниц.
 * - Защита от повторной загрузки страниц и карточек.
 * - Экран информации о тайтле.
 *
 * ============================================================
 */

(function () {
    'use strict';

    /* =========================================================
     * 1. НАСТРОЙКИ
     * ========================================================= */

    var PLUGIN_ID = 'anistar_catalog';
    var DETAIL_ID = 'anistar_detail';

    var READY_FLAG = 'anistar_041_ready';

    var BASE_URL = 'https://anistar.org/anime/';
    var SITE_HOST = 'anistar.org';

    var PLUGIN_VERSION = '0.4.1';

    // Сколько карточек загружать за один запрос.
    var PAGE_SIZE = 100;

    // За сколько карточек до конца начинать подгрузку.
    var PREFETCH_COUNT = 14;

    if (window[READY_FLAG]) return;

    window[READY_FLAG] = true;


    /* =========================================================
     * 2. CSS
     * ========================================================= */

    var css = [

        '.anistar-screen {',
        ' width:100%;',
        ' height:100%;',
        ' min-height:100%;',
        ' box-sizing:border-box;',
        ' padding:0 2.5em 3em;',
        ' overflow-y:auto;',
        ' overflow-x:hidden;',
        '}',

        '.anistar-grid {',
        ' display:grid;',
        ' grid-template-columns:repeat(auto-fill,minmax(135px,1fr));',
        ' gap:1.5em 1em;',
        ' width:100%;',
        ' align-items:start;',
        '}',

        '.anistar-card {',
        ' position:relative;',
        ' min-width:0;',
        ' width:100%;',
        ' cursor:pointer;',
        ' box-sizing:border-box;',
        '}',

        '.anistar-card__poster {',
        ' position:relative;',
        ' width:100%;',
        ' aspect-ratio:2/3;',
        ' overflow:hidden;',
        ' border-radius:.35em;',
        ' background:rgba(255,255,255,.08);',
        '}',

        '.anistar-card__poster img {',
        ' width:100%;',
        ' height:100%;',
        ' object-fit:cover;',
        ' display:block;',
        '}',

        '.anistar-card__placeholder {',
        ' width:100%;',
        ' height:100%;',
        ' display:flex;',
        ' align-items:center;',
        ' justify-content:center;',
        ' font-size:2em;',
        ' opacity:.4;',
        '}',

        '.anistar-card__title {',
        ' margin-top:.55em;',
        ' font-size:1em;',
        ' line-height:1.3;',
        ' overflow:hidden;',
        ' display:-webkit-box;',
        ' -webkit-line-clamp:2;',
        ' -webkit-box-orient:vertical;',
        '}',

        '.anistar-card.focus .anistar-card__poster {',
        ' outline:3px solid #fff;',
        ' outline-offset:3px;',
        '}',

        '.anistar-card.focus {',
        ' transform:scale(1.035);',
        ' z-index:2;',
        '}',

        '.anistar-loading {',
        ' padding:1.5em;',
        ' text-align:center;',
        ' opacity:.7;',
        '}',

        '.anistar-error {',
        ' padding:2em;',
        ' text-align:center;',
        '}',

        '.anistar-detail {',
        ' display:flex;',
        ' gap:2em;',
        ' padding:2em;',
        ' align-items:flex-start;',
        '}',

        '.anistar-detail__poster {',
        ' width:220px;',
        ' max-width:35%;',
        ' border-radius:.4em;',
        ' overflow:hidden;',
        '}',

        '.anistar-detail__poster img {',
        ' display:block;',
        ' width:100%;',
        ' border-radius:.4em;',
        '}',

        '.anistar-detail__info {',
        ' flex:1;',
        ' min-width:0;',
        '}',

        '.anistar-detail__title {',
        ' font-size:1.5em;',
        ' font-weight:bold;',
        ' margin-bottom:1em;',
        '}',

        '.anistar-detail__description {',
        ' opacity:.7;',
        '}',

        '.anistar-detail__link {',
        ' margin-top:1.5em;',
        ' padding:1em;',
        ' background:rgba(255,255,255,.12);',
        ' border-radius:.4em;',
        ' width:max-content;',
        '}',

        '.anistar-menu-item {',
        ' cursor:pointer;',
        '}',

        '@media (max-width:700px) {',
        ' .anistar-screen { padding:0 1em 2em; }',
        ' .anistar-grid { grid-template-columns:repeat(3,minmax(0,1fr)); gap:1em .6em; }',
        ' .anistar-detail { flex-direction:column; }',
        ' .anistar-detail__poster { max-width:70%; width:180px; }',
        '}',

        '@media (min-width:1200px) {',
        ' .anistar-grid { grid-template-columns:repeat(7,minmax(0,1fr)); }',
        '}'

    ].join('\n');


    function addStyles() {

        if (document.getElementById('anistar_styles')) return;

        var style = document.createElement('style');

        style.id = 'anistar_styles';
        style.type = 'text/css';
        style.textContent = css;

        document.head.appendChild(style);

    }


    /* =========================================================
     * 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     * ========================================================= */

    function cleanText(value) {

        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim();

    }


    function absoluteUrl(url, base) {

        if (!url) return '';

        try {
            return new URL(url, base || BASE_URL).href;
        }
        catch (e) {
            return '';
        }

    }


    function normalizeUrl(url) {

        try {

            var parsed = new URL(url);

            parsed.hash = '';

            return parsed.href;

        }
        catch (e) {
            return url;
        }

    }


    function isAniStarUrl(url) {

        try {

            var host = new URL(url).hostname;

            return host === SITE_HOST ||
                host === 'www.' + SITE_HOST;

        }
        catch (e) {
            return false;
        }

    }


    function isAnimeUrl(url) {

        try {

            var parsed = new URL(url);

            return isAniStarUrl(url) &&
                /^\/\d+-[^/]+\.html$/i.test(parsed.pathname);

        }
        catch (e) {
            return false;
        }

    }


    function getPoster(image, base) {

        if (!image) return '';

        var src =
            image.getAttribute('data-src') ||
            image.getAttribute('data-original') ||
            image.getAttribute('data-lazy-src') ||
            image.getAttribute('data-original-src') ||
            image.getAttribute('src') ||
            '';

        if (!src) {

            var srcset =
                image.getAttribute('data-srcset') ||
                image.getAttribute('srcset') ||
                '';

            if (srcset) {

                src = srcset.split(',')[0]
                    .trim()
                    .split(/\s+/)[0];

            }

        }

        return absoluteUrl(src, base);

    }


    /* =========================================================
     * 4. ПАРСЕР КАТАЛОГА
     * ========================================================= */

    function parseCatalog(html, pageUrl) {

        var doc = new DOMParser().parseFromString(
            String(html || ''),
            'text/html'
        );

        var items = [];
        var seen = {};

        var links = doc.querySelectorAll('a[href]');

        Array.prototype.forEach.call(links, function (link) {

            var url = absoluteUrl(
                link.getAttribute('href'),
                pageUrl
            );

            if (!isAnimeUrl(url)) return;

            url = normalizeUrl(url);

            if (seen[url]) return;

            var card = link.closest(
                '.shortstory, .base, .news, .item, ' +
                '.anime-item, .movie-item, article, li'
            );

            if (!card) {
                card = link.parentElement;
            }

            var title = cleanText(
                link.getAttribute('title') ||
                link.textContent
            );

            if (!title || title.length < 2) {

                var heading = card && card.querySelector(
                    'h1,h2,h3,h4,.title,.name'
                );

                if (heading) {
                    title = cleanText(heading.textContent);
                }

            }

            var image =
                link.querySelector('img') ||
                (card && card.querySelector('img'));

            if (
                (!title || title.length < 2) &&
                image
            ) {

                title = cleanText(
                    image.getAttribute('alt')
                );

            }

            if (!title || title.length < 2) return;
            if (title.length > 220) return;

            if (
                /^(смотреть|подробнее|читать|перейти|следующая)$/i.test(title)
            ) {
                return;
            }

            seen[url] = true;

            items.push({

                id: url,
                title: title,
                name: title,
                url: url,
                poster: getPoster(image, pageUrl)

            });

        });


        // Поиск следующей страницы.

        var next = '';

        var pagination = doc.querySelectorAll(
            '.navigation a[href], ' +
            '.pagination a[href], ' +
            '.pages a[href], ' +
            'a[rel~="next"]'
        );

        Array.prototype.some.call(
            pagination,
            function (link) {

                var text = cleanText(
                    link.textContent
                ).toLowerCase();

                var rel = (
                    link.getAttribute('rel') || ''
                ).toLowerCase();

                var cls = (
                    link.className || ''
                ).toString().toLowerCase();

                var isNext =
                    rel.indexOf('next') !== -1 ||
                    /next|следующ|далее/.test(cls) ||
                    /следующ|далее/.test(text) ||
                    text === '»' ||
                    text === '›';

                if (!isNext) return false;

                var href = absoluteUrl(
                    link.getAttribute('href'),
                    pageUrl
                );

                if (!href || !isAniStarUrl(href)) return false;

                if (
                    normalizeUrl(href) ===
                    normalizeUrl(pageUrl)
                ) {
                    return false;
                }

                next = href;

                return true;

            }
        );

        return {
            items: items,
            next: next
        };

    }


    /* =========================================================
     * 5. СЕТЕВОЙ ЗАПРОС
     * ========================================================= */

    function AniStarNetwork() {

        var request = new Lampa.Reguest();

        this.get = function (url, success, error) {

            request.native(

                url,

                function (data) {

                    if (typeof success === 'function') {
                        success(data);
                    }

                },

                function (xhr, status) {

                    console.error(
                        '[AniStar] Request error:',
                        xhr,
                        status
                    );

                    if (typeof error === 'function') {
                        error(xhr, status);
                    }

                },

                false,

                {
                    dataType: 'text',
                    timeout: 20000
                }

            );

        };


        this.clear = function () {

            if (
                request &&
                typeof request.clear === 'function'
            ) {
                request.clear();
            }

        };

    }


    /* =========================================================
     * 6. ОБЩИЕ ФУНКЦИИ НАВИГАЦИИ
     * ========================================================= */

    function moveNavigator(direction) {

        if (
            typeof Navigator !== 'undefined' &&
            Navigator &&
            typeof Navigator.canmove === 'function' &&
            typeof Navigator.move === 'function'
        ) {

            if (Navigator.canmove(direction)) {
                Navigator.move(direction);
            }

        }

    }


    function focusCollection(root, first) {

        if (
            !Lampa.Controller ||
            typeof Lampa.Controller.collectionSet !== 'function'
        ) {
            console.error(
                '[AniStar] Controller.collectionSet unavailable'
            );

            return;
        }

        var selectors = root.find('.selector');

        Lampa.Controller.collectionSet(root);

        if (
            first &&
            selectors.length &&
            typeof Lampa.Controller.collectionFocus === 'function'
        ) {

            Lampa.Controller.collectionFocus(
                selectors.eq(0)[0],
                root
            );

        }

    }


    function createController(component, root) {

        return {

            link: component,

            toggle: function () {

                var selectors = root.find('.selector');

                Lampa.Controller.collectionSet(root);

                Lampa.Controller.collectionFocus(
                    selectors.length ? selectors.eq(0)[0] : false,
                    root
                );

            },

            left: function () {

                if (
                    typeof Navigator !== 'undefined' &&
                    Navigator.canmove &&
                    Navigator.canmove('left')
                ) {

                    Navigator.move('left');

                }
                else {

                    Lampa.Controller.toggle('menu');

                }

            },

            up: function () {

                if (
                    typeof Navigator !== 'undefined' &&
                    Navigator.canmove &&
                    Navigator.canmove('up')
                ) {

                    Navigator.move('up');

                }
                else {

                    Lampa.Controller.toggle('head');

                }

            },

            down: function () {
                moveNavigator('down');
            },

            right: function () {
                moveNavigator('right');
            },

            back: function () {
                Lampa.Activity.backward();
            }

        };

    }


    /* =========================================================
     * 7. КОМПОНЕНТ КАТАЛОГА
     * ========================================================= */

    function AniStarCatalog(object) {

        var self = this;

        var network = new AniStarNetwork();

        var destroyed = false;
        var loading = false;
        var started = false;

        var pageUrl = object.page_url || BASE_URL;
        var nextUrl = '';

        var items = [];

        var loadedItems = {};
        var loadedPages = {};

        var root = $(
            '<div class="anistar-screen"></div>'
        );

        var grid = $(
            '<div class="anistar-grid"></div>'
        );

        var loadingElement = $(
            '<div class="anistar-loading">Загрузка AniStar...</div>'
        );

        root.append(grid);
        root.append(loadingElement);


        /* =====================================================
         * 7.1 ОБНОВЛЕНИЕ КОЛЛЕКЦИИ ФОКУСА
         * ===================================================== */

        function refreshCollection(focusFirst) {

            if (!started || destroyed) return;

            var current = root.find('.selector.focus').first();

            var selectors = root.find('.selector');

            Lampa.Controller.collectionSet(root);

            if (
                focusFirst ||
                !current.length
            ) {

                if (selectors.length) {

                    Lampa.Controller.collectionFocus(
                        selectors.eq(0)[0],
                        root
                    );

                }

            }
            else {

                Lampa.Controller.collectionFocus(
                    current[0],
                    root
                );

            }

        }


        /* =====================================================
         * 7.2 СОЗДАНИЕ КАРТОЧКИ
         * ===================================================== */

        function createCard(item, index) {

            var card = $(
                '<div class="selector anistar-card"></div>'
            );

            var poster = $(
                '<div class="anistar-card__poster"></div>'
            );

            var title = $(
                '<div class="anistar-card__title"></div>'
            );


            if (item.poster) {

                var img = $('<img loading="lazy">');

                img.attr('src', item.poster);
                img.attr('alt', item.title);

                img.on('error', function () {

                    $(this).remove();

                    poster.append(
                        '<div class="anistar-card__placeholder">▶</div>'
                    );

                });

                poster.append(img);

            }
            else {

                poster.append(
                    '<div class="anistar-card__placeholder">▶</div>'
                );

            }


            title.text(item.title);

            card.append(poster);
            card.append(title);


            // Открытие тайтла по OK.

            card.on('hover:enter', function () {

                Lampa.Activity.push({

                    url: '',

                    title: item.title,

                    component: DETAIL_ID,

                    page: 1,

                    item: item

                });

            });


            // Автоматическая подгрузка при приближении к концу.

            card.on('hover:focus', function () {

                checkAutoLoad(index);

            });


            return card;

        }


        /* =====================================================
         * 7.3 ОТОБРАЖЕНИЕ КАРТОЧЕК
         * ===================================================== */

        function renderItems(list) {

            var added = 0;

            list.forEach(function (item) {

                if (!item.url) return;

                if (loadedItems[item.url]) return;

                loadedItems[item.url] = true;

                var index = items.length;

                items.push(item);

                grid.append(
                    createCard(item, index)
                );

                added++;

            });

            console.log(
                '[AniStar] Added cards:',
                added
            );

            return added;

        }


        /* =====================================================
         * 7.4 АВТОПОДГРУЗКА
         * ===================================================== */

        function checkAutoLoad(index) {

            if (destroyed || loading || !nextUrl) return;

            var remaining = items.length - index - 1;

            if (remaining <= PREFETCH_COUNT) {

                loadNextPage();

            }

        }


        function loadNextPage() {

            if (!nextUrl || loading || destroyed) return;

            var url = nextUrl;

            if (loadedPages[normalizeUrl(url)]) return;

            load(url);

        }


        /* =====================================================
         * 7.5 ЗАГРУЗКА СТРАНИЦЫ
         * ===================================================== */

        function load(url) {

            if (loading || destroyed || !url) return;

            var normalized = normalizeUrl(url);

            if (loadedPages[normalized]) return;

            loadedPages[normalized] = true;

            loading = true;

            loadingElement
                .text('Загрузка...')
                .show();

            self.activity.loader(true);


            network.get(

                url,

                function (html) {

                    if (destroyed) return;

                    loading = false;

                    self.activity.loader(false);

                    try {

                        var parsed = parseCatalog(
                            html,
                            url
                        );


                        if (
                            !parsed.items.length &&
                            !items.length
                        ) {

                            loadingElement
                                .text('Не удалось найти карточки AniStar.')
                                .show();

                            Lampa.Noty.show(
                                'HTML получен, но карточки не найдены. Проверьте разметку сайта.'
                            );

                            return;

                        }


                        renderItems(parsed.items);

                        nextUrl = parsed.next || '';


                        if (!nextUrl) {

                            loadingElement
                                .text('Больше страниц нет.')
                                .show();

                        }
                        else {

                            loadingElement.hide();

                        }


                        console.log(
                            '[AniStar] Page loaded:',
                            url
                        );

                        console.log(
                            '[AniStar] Total cards:',
                            items.length
                        );

                        console.log(
                            '[AniStar] Next page:',
                            nextUrl
                        );


                        // Обновляем коллекцию после добавления карточек.

                        refreshCollection(false);

                    }
                    catch (e) {

                        console.error(
                            '[AniStar] Parse error:',
                            e
                        );

                        loadingElement
                            .text('Ошибка обработки каталога.')
                            .show();

                        Lampa.Noty.show(
                            'Ошибка обработки каталога AniStar'
                        );

                    }

                },


                function (error) {

                    if (destroyed) return;

                    loading = false;

                    delete loadedPages[normalized];

                    self.activity.loader(false);

                    loadingElement
                        .text('Не удалось загрузить AniStar.')
                        .show();

                    console.error(
                        '[AniStar] Network error:',
                        error
                    );

                    Lampa.Noty.show(
                        'Не удалось загрузить AniStar. Проверь подключение или CORS.'
                    );

                }

            );

        }


        /* =====================================================
         * 7.6 ЖИЗНЕННЫЙ ЦИКЛ
         * ===================================================== */

        this.create = function () {

            load(pageUrl);

            return this.render();

        };


        this.render = function () {

            return root;

        };


        this.start = function () {

            started = true;

            console.log(
                '[AniStar] Starting controller'
            );

            var controller = createController(
                self,
                root
            );

            Lampa.Controller.add(
                'content',
                controller
            );

            Lampa.Controller.toggle('content');

        };


        this.stop = function () {

            started = false;

        };


        this.destroy = function () {

            destroyed = true;
            started = false;

            network.clear();

            root.remove();

        };


        this.empty = function () {

            self.activity.loader(false);

            self.activity.empty();

        };

    }


    /* =========================================================
     * 8. ЭКРАН ИНФОРМАЦИИ О ТАЙТЛЕ
     * ========================================================= */

    function AniStarDetail(object) {

        var self = this;

        var item = object.item || {};

        var root = $(
            '<div class="anistar-screen"></div>'
        );

        var detail = $(
            '<div class="anistar-detail"></div>'
        );

        var poster = $(
            '<div class="anistar-detail__poster"></div>'
        );

        var info = $(
            '<div class="anistar-detail__info"></div>'
        );

        var title = $(
            '<div class="anistar-detail__title"></div>'
        );

        var description = $(
            '<div class="anistar-detail__description">' +
            'Страница аниме на AniStar' +
            '</div>'
        );

        var open = $(
            '<div class="selector anistar-detail__link">' +
            'Показать ссылку AniStar' +
            '</div>'
        );


        title.text(item.title || 'Аниме');


        if (item.poster) {

            var image = $('<img>');

            image.attr('src', item.poster);

            poster.append(image);

        }


        open.on('hover:enter', function () {

            if (!item.url) return;

            Lampa.Noty.show(
                'Ссылка на страницу: ' + item.url
            );

        });


        info.append(title);
        info.append(description);
        info.append(open);

        detail.append(poster);
        detail.append(info);

        root.append(detail);


        this.create = function () {

            return this.render();

        };


        this.render = function () {

            return root;

        };


        this.start = function () {

            var controller = createController(
                self,
                root
            );

            Lampa.Controller.add(
                'content',
                controller
            );

            Lampa.Controller.toggle('content');

        };


        this.stop = function () {};


        this.destroy = function () {

            root.remove();

        };


        this.empty = function () {

            self.activity.empty();

        };

    }


    /* =========================================================
     * 9. ПУНКТ ЛЕВОГО МЕНЮ
     * ========================================================= */

    function addMenu() {

        var menu = $('.menu .menu__list').eq(0);

        if (!menu.length) {

            console.warn(
                '[AniStar] Menu not found'
            );

            return;

        }


        if (menu.find('.anistar-menu-item').length) {
            return;
        }


        var button = $(

            '<li class="menu__item selector anistar-menu-item">' +

                '<div class="menu__ico">' +

                    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +

                        '<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2 14V8l7 4-7 4Z"/>' +

                    '</svg>' +

                '</div>' +

                '<div class="menu__text">Анистар</div>' +

            '</li>'

        );


        button.on('hover:enter', function () {

            Lampa.Activity.push({

                url: '',

                title: 'Анистар',

                component: PLUGIN_ID,

                page: 1,

                page_url: BASE_URL

            });

        });


        menu.append(button);

    }


    /* =========================================================
     * 10. РЕГИСТРАЦИЯ КОМПОНЕНТОВ
     * ========================================================= */

    function init() {

        if (
            !window.Lampa ||
            !Lampa.Component ||
            !Lampa.Activity ||
            !Lampa.Reguest ||
            !Lampa.Controller
        ) {

            console.error(
                '[AniStar] Required Lampa API is unavailable'
            );

            return;

        }


        addStyles();


        if (!Lampa.Component.get(PLUGIN_ID)) {

            Lampa.Component.add(
                PLUGIN_ID,
                AniStarCatalog
            );

        }


        if (!Lampa.Component.get(DETAIL_ID)) {

            Lampa.Component.add(
                DETAIL_ID,
                AniStarDetail
            );

        }


        addMenu();


        console.log(
            '[AniStar] Initialized. Version: ' +
            PLUGIN_VERSION
        );

    }


    /* =========================================================
     * 11. ЗАПУСК ПОСЛЕ ГОТОВНОСТИ LAMPA
     * ========================================================= */

    if (window.appready) {

        init();

    }
    else {

        Lampa.Listener.follow(
            'app',

            function (event) {

                if (event.type === 'ready') {
                    init();
                }

            }
        );

    }

})();
