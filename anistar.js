/*!
 * ============================================================
 * AniStar для Lampa
 * Версия: 0.3.1
 * ============================================================
 *
 * Источник: https://anistar.org/anime/
 * Платформа: Lampa 3.x / Android TV
 *
 * Возможности:
 * - Каталог AniStar в левом меню.
 * - Получение HTML сайта.
 * - Парсинг названий и постеров.
 * - Сетка карточек.
 * - Навигация пультом Android TV.
 * - Пагинация.
 * - Экран информации о тайтле.
 *
 * Интерфейс строится на штатной Activity Lampa.
 *
 * ============================================================
 */

(function () {
    'use strict';

    /* =========================================================
     * 1. НАСТРОЙКИ
     * ========================================================= */

    var PLUGIN_ID = 'anistar_catalog';
    var READY_FLAG = 'anistar_031_ready';

    var BASE_URL = 'https://anistar.org/anime/';
    var SITE_HOST = 'anistar.org';

    var PLUGIN_VERSION = '0.3.1';

    var PROXY_URL = '';

    var PAGE_SIZE = 100;

    if (window[READY_FLAG]) return;

    /*
     * Флаг готовности устанавливается только после успешной
     * регистрации компонентов. Иначе ранний запуск мог навсегда
     * заблокировать повторную инициализацию.
     */
    var initialized = false;
    var initAttempts = 0;
    var initTimer = null;
    var menuObserver = null;


    /* =========================================================
     * 2. CSS
     * =========================================================
     *
     * Сетка создаётся средствами CSS.
     * Это позволяет не зависеть от неизвестных внутренних
     * методов Maker и сохранять управление selector в Lampa.
     */

    var css = [
        '.anistar-screen {',
        ' width:100%;',
        ' box-sizing:border-box;',
        ' padding:0 2.5em 3em;',
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
        ' border-radius:0.35em;',
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

        '.anistar-more {',
        ' margin:2em auto;',
        ' padding:1em 2em;',
        ' text-align:center;',
        ' width:max-content;',
        ' max-width:100%;',
        ' border-radius:.4em;',
        ' background:rgba(255,255,255,.12);',
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

        '.anistar-detail__link {',
        ' margin-top:1.5em;',
        ' padding:1em;',
        ' background:rgba(255,255,255,.12);',
        ' border-radius:.4em;',
        ' width:max-content;',
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
        } catch (e) {
            return '';
        }
    }


    function normalizeUrl(url) {
        try {
            var parsed = new URL(url);

            parsed.hash = '';

            return parsed.href;
        } catch (e) {
            return url;
        }
    }


    function isAniStarUrl(url) {
        try {
            var host = new URL(url).hostname;

            return host === SITE_HOST ||
                host === 'www.' + SITE_HOST;
        } catch (e) {
            return false;
        }
    }


    /*
     * AniStar использует адреса публикаций:
     * /12345-nazvanie-anime.html
     */
    function isAnimeUrl(url) {
        try {
            var parsed = new URL(url);

            return isAniStarUrl(url) &&
                /^\/\d+-[^/]+\.html$/i.test(parsed.pathname);

        } catch (e) {
            return false;
        }
    }


    /* =========================================================
     * 4. ПОЛУЧЕНИЕ ПОСТЕРА
     * ========================================================= */

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
     * 5. ПАРСЕР КАТАЛОГА
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


            /*
             * Ищем контейнер карточки.
             */
            var card = link.closest(
                '.shortstory, .base, .news, .item, ' +
                '.anime-item, .movie-item, article, li'
            );

            if (!card) {
                card = link.parentElement;
            }


            /*
             * Получаем заголовок.
             */
            var title = cleanText(
                link.getAttribute('title') ||
                link.textContent
            );


            /*
             * Ищем заголовок в родительском контейнере.
             */
            if (!title || title.length < 2) {

                var heading = card && card.querySelector(
                    'h1,h2,h3,h4,.title,.name'
                );

                if (heading) {
                    title = cleanText(heading.textContent);
                }
            }


            /*
             * Ищем изображение.
             */
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


        /*
         * Поиск ссылки следующей страницы.
         */
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

                if (normalizeUrl(href) === normalizeUrl(pageUrl)) {
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
     * 6. СЕТЕВОЙ ЗАПРОС
     * ========================================================= */

    function AniStarNetwork() {

        var request = new Lampa.Reguest();

        this.get = function (url, success, error) {

            var target = PROXY_URL
                ? PROXY_URL + encodeURIComponent(url)
                : url;

            /*
             * Используем штатный GET-метод Lampa.
             * Сигнатура соответствует руководству плагинов.
             */
            request.get(
                target,
                success,
                error
            );

        };

        this.clear = function () {
            request.clear();
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

        var pageUrl = object.page_url || BASE_URL;

        var nextUrl = '';

        var loaded = {};

        var items = [];


        /*
         * Основной контейнер.
         */
        var root = $(
            '<div class="anistar-screen"></div>'
        );


        /*
         * Сетка карточек.
         */
        var grid = $(
            '<div class="anistar-grid"></div>'
        );


        /*
         * Кнопка следующей страницы.
         */
        var more = $(
            '<div class="selector anistar-more">' +
            'Загрузить ещё' +
            '</div>'
        );


        root.append(grid);

        root.append(more);


        /* =====================================================
         * 8. ОТРИСОВКА КАРТОЧКИ
         * ===================================================== */

        function createCard(item) {

            var card = $(
                '<div class="selector anistar-card"></div>'
            );

            var poster = $(
                '<div class="anistar-card__poster"></div>'
            );

            var title = $(
                '<div class="anistar-card__title"></div>'
            );


            /*
             * Добавляем постер.
             */
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


            // Название.
            title.text(item.title);


            card.append(poster);

            card.append(title);


            /*
             * Открытие страницы тайтла по OK на пульте.
             */
            card.on('hover:enter', function () {

                Lampa.Activity.push({

                    url: '',

                    title: item.title,

                    component: 'anistar_detail',

                    page: 1,

                    item: item

                });

            });


            return card;

        }


        /* =====================================================
         * 9. ЗАПОЛНЕНИЕ СЕТКИ
         * ===================================================== */

        function renderItems(list) {

            list.forEach(function (item) {

                if (!item.url || loaded[item.url]) return;

                loaded[item.url] = true;

                items.push(item);

                grid.append(
                    createCard(item)
                );

            });

        }


        /* =====================================================
         * 10. ЗАГРУЗКА КАТАЛОГА
         * ===================================================== */

        function load(url) {

            if (loading || destroyed || !url) return;

            loading = true;

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


                        if (!parsed.items.length && !items.length) {

                            Lampa.Noty.show(
                                'HTML получен, но тайтлы не найдены. ' +
                                'Необходимо проверить разметку AniStar.'
                            );

                            return;

                        }


                        // Отображаем найденные карточки.
                        renderItems(parsed.items);


                        // Сохраняем следующую страницу.
                        nextUrl = parsed.next || '';


                        if (nextUrl) {
                            more.show();
                        }
                        else {
                            more.hide();
                        }


                        /*
                         * После загрузки возвращаем фокус
                         * на первую карточку, если он отсутствует.
                         */
                        console.log(
                            '[AniStar] Loaded:',
                            parsed.items.length
                        );

                        console.log(
                            '[AniStar] Total:',
                            items.length
                        );

                    }

                    catch (e) {

                        console.error(
                            '[AniStar] Parse error:',
                            e
                        );

                        Lampa.Noty.show(
                            'Ошибка обработки каталога AniStar'
                        );

                    }

                },


                function (error) {

                    if (destroyed) return;

                    loading = false;

                    self.activity.loader(false);

                    console.error(
                        '[AniStar] Network error:',
                        error
                    );

                    Lampa.Noty.show(
                        'Не удалось загрузить AniStar. ' +
                        'Проверь подключение или CORS.'
                    );

                }

            );

        }


        /* =====================================================
         * 11. ПАГИНАЦИЯ
         * ===================================================== */

        more.on('hover:enter', function () {

            if (!nextUrl || loading) return;

            load(nextUrl);

        });


        /* =====================================================
         * 12. ЖИЗНЕННЫЙ ЦИКЛ КАТАЛОГА
         * ===================================================== */

        this.create = function () {

            load(pageUrl);

            return this.render();

        };


        this.render = function () {
            return root;
        };


        this.start = function () {};


        this.stop = function () {};


        this.destroy = function () {

            destroyed = true;

            network.clear();

            root.remove();

        };


        this.empty = function () {

            self.activity.loader(false);

            self.activity.empty();

        };

    }


    /* =========================================================
     * 13. ЭКРАН ИНФОРМАЦИИ О ТАЙТЛЕ
     * =========================================================
     *
     * На данном этапе открываем страницу тайтла
     * внутри каталога и показываем его постер и ссылку.
     *
     * Извлечение описания и списка серий будет следующим
     * этапом разработки.
     */

    function AniStarDetail(object) {

        var self = this;

        var network = new AniStarNetwork();

        var item = object.item || {};

        var destroyed = false;

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

        title.text(item.title || 'Аниме');


        if (item.poster) {

            var image = $('<img>');

            image.attr('src', item.poster);

            poster.append(image);

        }


        var description = $(
            '<div class="anistar-detail__description">' +
            'Страница аниме на AniStar' +
            '</div>'
        );


        /*
         * Кнопка открытия страницы источника.
         *
         * Пока список серий ещё не извлекается.
         */
        var open = $(
            '<div class="selector anistar-detail__link">' +
            'Открыть страницу AniStar' +
            '</div>'
        );


        open.on('hover:enter', function () {

            if (!item.url) return;

            if (window.Lampa && Lampa.Android) {
                // Внешний переход не выполняем автоматически.
            }

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


        this.start = function () {};


        this.stop = function () {};


        this.destroy = function () {

            destroyed = true;

            network.clear();

            root.remove();

        };


        this.empty = function () {

            self.activity.loader(false);

            self.activity.empty();

        };

    }


    /* =========================================================
     * 14. ПУНКТ ЛЕВОГО МЕНЮ
     * ========================================================= */

    function addMenu() {

        var menu = $('.menu .menu__list').eq(0);

        if (!menu.length) {
            return false;
        }

        // Защита от повторного добавления.
        if (menu.find('.anistar-menu-item').length) {
            return true;
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

        console.log('[AniStar] Menu item added');

        return true;
    }


    /*
     * Меню в Lampa может появиться позже события app ready.
     * Поэтому наблюдаем за DOM и добавляем пункт при появлении списка.
     */
    function watchMenu() {

        // Сначала пробуем добавить пункт немедленно.
        addMenu();

        // Наблюдатель остаётся активным: Lampa может пересоздать меню.
        if (menuObserver || !window.MutationObserver || !document.body) {
            return;
        }

        menuObserver = new window.MutationObserver(function () {
            addMenu();
        });

        menuObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }


    /* =========================================================
     * 15. РЕГИСТРАЦИЯ КОМПОНЕНТОВ
     * ========================================================= */

    function init() {

        if (initialized || window[READY_FLAG]) return;

        if (
            !window.Lampa ||
            !Lampa.Component ||
            !Lampa.Activity ||
            !Lampa.Reguest
        ) {
            initAttempts++;

            if (initAttempts <= 20) {
                if (initTimer) clearTimeout(initTimer);
                initTimer = setTimeout(init, 500);
            }
            else {
                console.error(
                    '[AniStar] Required Lampa API is unavailable'
                );
            }

            return;
        }

        try {
            // Добавляем CSS.
            addStyles();

            // Регистрируем каталог.
            if (!Lampa.Component.get(PLUGIN_ID)) {
                Lampa.Component.add(
                    PLUGIN_ID,
                    AniStarCatalog
                );
            }

            // Регистрируем страницу тайтла.
            if (!Lampa.Component.get('anistar_detail')) {
                Lampa.Component.add(
                    'anistar_detail',
                    AniStarDetail
                );
            }

            initialized = true;
            window[READY_FLAG] = true;

            // Добавляем пункт меню сразу или ждём его появления.
            watchMenu();

            console.log(
                '[AniStar] Initialized. Version: ' +
                PLUGIN_VERSION
            );
        }
        catch (e) {
            console.error('[AniStar] Initialization error:', e);
            initialized = false;
            window[READY_FLAG] = false;
        }
    }


    /* =========================================================
     * 16. ЗАПУСК ПОСЛЕ ГОТОВНОСТИ LAMPA
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
