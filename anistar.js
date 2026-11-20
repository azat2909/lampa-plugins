/*!
 * ============================================================
 * AniStar для Lampa
 * Версия: 0.4.0
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
 * - Автоматическая пагинация при перемещении фокуса.
 * - Защита от повторной загрузки страниц и тайтлов.
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

    var READY_FLAG = 'anistar_040_ready';

    var BASE_URL = 'https://anistar.org/anime/';
    var SITE_HOST = 'anistar.org';

    var PLUGIN_VERSION = '0.4.0';

    // Если используется собственный прокси, укажи его здесь.
    // Оставь пустым, если прокси не нужен.
    var PROXY_URL = '';

    // Сколько рядов карточек должно оставаться
    // до автоматической загрузки следующей страницы.
    var PREFETCH_ROWS = 2;

    // Максимальное количество карточек на одной странице,
    // которое будет добавлено в каталог.
    var PAGE_SIZE = 100;


    // Не запускаем плагин повторно.
    if (window[READY_FLAG]) return;


    /* =========================================================
     * 2. CSS
     * ========================================================= */

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

        '.anistar-loading {',
        ' width:100%;',
        ' padding:1.5em;',
        ' box-sizing:border-box;',
        ' text-align:center;',
        ' opacity:.7;',
        '}',

        '.anistar-error {',
        ' width:100%;',
        ' padding:1.5em;',
        ' box-sizing:border-box;',
        ' text-align:center;',
        ' opacity:.8;',
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
        ' line-height:1.5;',
        ' opacity:.8;',
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

        if (document.getElementById('anistar_styles')) {
            return;
        }

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

            return new URL(
                url,
                base || BASE_URL
            ).href;

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


    /*
     * Адрес публикации AniStar:
     * /12345-nazvanie-anime.html
     */
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


    function safeText(element) {

        if (!element) return '';

        return cleanText(element.textContent);

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
            image.getAttribute('data-original-url') ||
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

        if (!src) return '';

        if (/^(data:|blob:)/i.test(src)) {
            return '';
        }

        return absoluteUrl(src, base);

    }


    /* =========================================================
     * 5. ПОИСК КОНТЕЙНЕРА КАРТОЧКИ
     * ========================================================= */

    function findCardContainer(link) {

        if (!link) return null;

        var selectors = [
            '.shortstory',
            '.base',
            '.news',
            '.item',
            '.anime-item',
            '.movie-item',
            '.shortstory__content',
            'article',
            'li'
        ];

        for (var i = 0; i < selectors.length; i++) {

            var card = link.closest(selectors[i]);

            if (card) {
                return card;
            }

        }

        return link.parentElement;

    }


    /* =========================================================
     * 6. ПАРСЕР КАТАЛОГА
     * ========================================================= */

    function parseCatalog(html, pageUrl) {

        var doc = new DOMParser().parseFromString(
            String(html || ''),
            'text/html'
        );

        var items = [];
        var seen = {};

        var links = doc.querySelectorAll('a[href]');


        /*
         * Получаем тайтлы.
         */

        Array.prototype.forEach.call(
            links,
            function (link) {

                var url = absoluteUrl(
                    link.getAttribute('href'),
                    pageUrl
                );

                if (!isAnimeUrl(url)) return;

                url = normalizeUrl(url);

                if (seen[url]) return;


                var card = findCardContainer(link);


                /*
                 * Название.
                 */

                var title = cleanText(
                    link.getAttribute('title') ||
                    link.textContent
                );


                /*
                 * Если ссылка не содержит названия,
                 * ищем заголовок в контейнере.
                 */

                if (!title || title.length < 2) {

                    var heading = card && card.querySelector(
                        'h1,h2,h3,h4,.title,.name,.shortstory__title'
                    );

                    if (heading) {
                        title = safeText(heading);
                    }

                }


                /*
                 * Изображение.
                 */

                var image =
                    link.querySelector('img') ||
                    (card && card.querySelector('img'));


                /*
                 * Если заголовок не найден,
                 * пробуем взять alt изображения.
                 */

                if (
                    (!title || title.length < 2) &&
                    image
                ) {

                    title = cleanText(
                        image.getAttribute('alt')
                    );

                }


                if (!title || title.length < 2) {
                    return;
                }

                if (title.length > 220) {
                    return;
                }


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

            }
        );


        /*
         * Поиск следующей страницы.
         */

        var next = '';

        var paginationSelectors = [
            '.navigation a[href]',
            '.pagination a[href]',
            '.pages a[href]',
            '.nav-links a[href]',
            '.pagination__list a[href]',
            'a[rel~="next"]'
        ];

        var pagination = doc.querySelectorAll(
            paginationSelectors.join(',')
        );


        /*
         * Сначала ищем явно обозначенную кнопку
         * следующей страницы.
         */

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

                var aria = (
                    link.getAttribute('aria-label') || ''
                ).toLowerCase();

                var title = (
                    link.getAttribute('title') || ''
                ).toLowerCase();


                var isNext =
                    rel.indexOf('next') !== -1 ||
                    /next|следующ|далее/.test(cls) ||
                    /следующ|далее/.test(text) ||
                    /следующ|далее/.test(aria) ||
                    /следующ|далее/.test(title) ||
                    text === '»' ||
                    text === '›' ||
                    text === '>';

                if (!isNext) {
                    return false;
                }


                var href = absoluteUrl(
                    link.getAttribute('href'),
                    pageUrl
                );

                if (!href || !isAniStarUrl(href)) {
                    return false;
                }

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


        /*
         * Дополнительная проверка:
         * иногда сайт обозначает следующую страницу
         * только стрелкой без класса next.
         */

        if (!next) {

            Array.prototype.some.call(
                pagination,
                function (link) {

                    var text = cleanText(
                        link.textContent
                    );

                    if (
                        text !== '»' &&
                        text !== '›' &&
                        text !== '>'
                    ) {
                        return false;
                    }

                    var href = absoluteUrl(
                        link.getAttribute('href'),
                        pageUrl
                    );

                    if (
                        !href ||
                        !isAniStarUrl(href) ||
                        normalizeUrl(href) === normalizeUrl(pageUrl)
                    ) {
                        return false;
                    }

                    next = href;

                    return true;

                }
            );

        }


        return {

            items: items,

            next: next

        };

    }


    /* =========================================================
     * 7. СЕТЕВОЙ ЗАПРОС
     * ========================================================= */

    function AniStarNetwork() {

        var request = new Lampa.Reguest();


        /*
         * GET-запрос.
         */

        this.get = function (url, success, error) {

            var target = PROXY_URL
                ? PROXY_URL + encodeURIComponent(url)
                : url;


            request.native(

                target,

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


        /*
         * Отмена запросов.
         */

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
     * 8. КОМПОНЕНТ КАТАЛОГА
     * ========================================================= */

    function AniStarCatalog(object) {

        var self = this;

        var network = new AniStarNetwork();

        var destroyed = false;

        var loading = false;

        var pageUrl = object.page_url || BASE_URL;

        var nextUrl = '';

        var items = [];

        var loadedItems = {};

        var loadedPages = {};

        var currentPage = 0;

        var loadError = false;


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
         * Индикатор загрузки.
         */

        var loader = $(
            '<div class="anistar-loading" style="display:none;">' +
                'Загрузка каталога AniStar...' +
            '</div>'
        );


        /*
         * Сообщение об ошибке.
         */

        var errorMessage = $(
            '<div class="anistar-error" style="display:none;">' +
                'Не удалось загрузить следующую страницу' +
            '</div>'
        );


        root.append(grid);
        root.append(loader);
        root.append(errorMessage);


        /* =====================================================
         * 9. ИНДИКАТОР ЗАГРУЗКИ
         * ===================================================== */

        function showLoading(state) {

            if (destroyed) return;

            if (state) {

                loader.show();

                errorMessage.hide();

            }

            else {

                loader.hide();

            }

        }


        function showError() {

            if (destroyed) return;

            errorMessage.show();

        }


        function hideError() {

            errorMessage.hide();

        }


        /* =====================================================
         * 10. ОПРЕДЕЛЕНИЕ КОЛИЧЕСТВА КОЛОНОК
         * ===================================================== */

        function getColumnCount() {

            var cards = grid.find('.anistar-card');

            if (cards.length < 2) {
                return 1;
            }


            var firstTop = cards.eq(0)[0].offsetTop;

            var columns = 0;


            for (var i = 0; i < cards.length; i++) {

                var element = cards[i];

                if (element.offsetTop !== firstTop) {
                    break;
                }

                columns++;

            }


            return Math.max(1, columns);

        }


        /* =====================================================
         * 11. ПРОВЕРКА НЕОБХОДИМОСТИ АВТОЗАГРУЗКИ
         * ===================================================== */

        function checkAutoLoad(index) {

            if (destroyed) return;

            if (loading) return;

            if (!nextUrl) return;

            if (loadError) {
                // При повторном достижении конца каталога
                // разрешаем повторную попытку.
            }


            var total = items.length;

            if (!total) return;


            /*
             * Сколько карточек остаётся после текущей.
             */

            var remaining = total - index - 1;


            /*
             * Определяем количество карточек в ряду.
             */

            var columns = getColumnCount();


            /*
             * Два последних ряда.
             */

            var threshold = columns * PREFETCH_ROWS;


            /*
             * Если пользователь дошёл до последних рядов,
             * запускаем загрузку следующей страницы.
             */

            if (remaining <= threshold) {

                console.log(
                    '[AniStar] Auto load triggered:',
                    'index =',
                    index,
                    'remaining =',
                    remaining
                );

                loadNextPage();

            }

        }


        /* =====================================================
         * 12. СОЗДАНИЕ КАРТОЧКИ
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


            /*
             * Постер.
             */

            if (item.poster) {

                var img = $('<img loading="lazy">');

                img.attr('src', item.poster);

                img.attr('alt', item.title);


                img.on('error', function () {

                    $(this).remove();

                    if (!poster.find('.anistar-card__placeholder').length) {

                        poster.append(
                            '<div class="anistar-card__placeholder">▶</div>'
                        );

                    }

                });


                poster.append(img);

            }

            else {

                poster.append(
                    '<div class="anistar-card__placeholder">▶</div>'
                );

            }


            /*
             * Название.
             */

            title.text(item.title);


            card.append(poster);
            card.append(title);


            /*
             * Сохраняем индекс карточки.
             */

            card.attr('data-anistar-index', index);


            /*
             * Автоматическая загрузка при получении фокуса.
             *
             * Событие hover:focus вызывается Lampa,
             * когда пользователь перемещается по карточкам
             * с помощью пульта.
             */

            card.on('hover:focus', function () {

                checkAutoLoad(index);

            });


            /*
             * Открытие страницы тайтла.
             */

            card.on('hover:enter', function () {

                Lampa.Activity.push({

                    url: '',

                    title: item.title,

                    component: DETAIL_ID,

                    page: 1,

                    item: item

                });

            });


            return card;

        }


        /* =====================================================
         * 13. ДОБАВЛЕНИЕ КАРТОЧЕК В СЕТКУ
         * ===================================================== */

        function renderItems(list) {

            var added = 0;


            list.forEach(function (item) {

                if (!item.url) return;

                var key = normalizeUrl(item.url);


                /*
                 * Защита от дубликатов.
                 */

                if (loadedItems[key]) {
                    return;
                }


                /*
                 * Ограничение количества карточек
                 * на одной загруженной странице.
                 */

                if (added >= PAGE_SIZE) {
                    return;
                }


                loadedItems[key] = true;

                items.push(item);


                /*
                 * Индекс новой карточки.
                 */

                var index = items.length - 1;


                /*
                 * Добавляем элемент в конец сетки.
                 *
                 * ВАЖНО:
                 * Не очищаем grid и не перерисовываем
                 * ранее созданные карточки.
                 */

                grid.append(
                    createCard(item, index)
                );


                added++;

            });


            return added;

        }


        /* =====================================================
         * 14. ЗАГРУЗКА СТРАНИЦЫ
         * ===================================================== */

        function load(url, isNextPage) {

            if (loading || destroyed || !url) {
                return;
            }


            var normalized = normalizeUrl(url);


            /*
             * Защита от повторной загрузки страницы.
             */

            if (loadedPages[normalized]) {
                return;
            }


            loading = true;

            loadError = false;

            showLoading(true);

            hideError();


            /*
             * Показываем штатный индикатор Lampa
             * только при первоначальной загрузке.
             *
             * При автоподгрузке не перекрываем каталог.
             */

            if (!isNextPage) {
                self.activity.loader(true);
            }


            network.get(

                url,


                /* =============================================
                 * УСПЕШНЫЙ ОТВЕТ
                 * ============================================= */

                function (html) {

                    if (destroyed) return;


                    loading = false;

                    showLoading(false);

                    self.activity.loader(false);


                    try {

                        var parsed = parseCatalog(
                            html,
                            url
                        );


                        /*
                         * Проверяем результат парсинга.
                         */

                        if (
                            !parsed.items.length &&
                            !items.length
                        ) {

                            Lampa.Noty.show(
                                'HTML получен, но тайтлы не найдены. ' +
                                'Необходимо проверить разметку AniStar.'
                            );

                            return;

                        }


                        /*
                         * Помечаем страницу загруженной.
                         */

                        loadedPages[normalized] = true;

                        currentPage++;


                        /*
                         * Добавляем новые карточки.
                         */

                        var added = renderItems(
                            parsed.items
                        );


                        /*
                         * Сохраняем URL следующей страницы.
                         */

                        nextUrl = parsed.next || '';


                        /*
                         * Если страница вернула только дубликаты,
                         * проверяем, не закончилась ли пагинация.
                         */

                        if (!nextUrl) {

                            console.log(
                                '[AniStar] No next page'
                            );

                        }


                        console.log(
                            '[AniStar] Page loaded:',
                            currentPage
                        );

                        console.log(
                            '[AniStar] Received:',
                            parsed.items.length
                        );

                        console.log(
                            '[AniStar] Added:',
                            added
                        );

                        console.log(
                            '[AniStar] Total:',
                            items.length
                        );


                        /*
                         * Если новых карточек нет, но следующая
                         * страница существует, не запускаем
                         * бесконечную цепочку запросов автоматически.
                         *
                         * Следующая попытка произойдёт,
                         * когда пользователь снова переместит фокус.
                         */

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


                /* =============================================
                 * ОШИБКА ЗАПРОСА
                 * ============================================= */

                function (error) {

                    if (destroyed) return;


                    loading = false;

                    loadError = true;


                    showLoading(false);

                    showError();


                    self.activity.loader(false);


                    console.error(
                        '[AniStar] Network error:',
                        error
                    );


                    Lampa.Noty.show(
                        'Не удалось загрузить AniStar. ' +
                        'Проверь подключение или CORS.'
                    );


                    /*
                     * nextUrl не очищаем.
                     *
                     * При повторном достижении последних карточек
                     * пользователь сможет повторить запрос.
                     */

                }

            );

        }


        /* =====================================================
         * 15. АВТОМАТИЧЕСКАЯ ЗАГРУЗКА СЛЕДУЮЩЕЙ СТРАНИЦЫ
         * ===================================================== */

        function loadNextPage() {

            if (destroyed) return;

            if (loading) return;

            if (!nextUrl) return;


            var url = nextUrl;


            /*
             * Если URL уже загружался,
             * не делаем повторный запрос.
             */

            if (loadedPages[normalizeUrl(url)]) {

                console.warn(
                    '[AniStar] Page already loaded:',
                    url
                );

                nextUrl = '';

                return;

            }


            console.log(
                '[AniStar] Loading next page:',
                url
            );


            load(url, true);

        }


        /* =====================================================
         * 16. ЖИЗНЕННЫЙ ЦИКЛ КАТАЛОГА
         * ===================================================== */

        this.create = function () {

            load(pageUrl, false);

            return this.render();

        };


        this.render = function () {

            return root;

        };


        this.start = function () {

            console.log(
                '[AniStar] Catalog started'
            );

        };


        this.stop = function () {

            console.log(
                '[AniStar] Catalog stopped'
            );

        };


        this.destroy = function () {

            destroyed = true;

            loading = false;

            network.clear();

            root.remove();


            console.log(
                '[AniStar] Catalog destroyed'
            );

        };


        this.empty = function () {

            self.activity.loader(false);

            self.activity.empty();

        };

    }


    /* =========================================================
     * 17. ЭКРАН ИНФОРМАЦИИ О ТАЙТЛЕ
     * ========================================================= */

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


        title.text(
            item.title || 'Аниме'
        );


        /*
         * Постер.
         */

        if (item.poster) {

            var image = $('<img>');

            image.attr('src', item.poster);

            image.attr('alt', item.title || '');

            poster.append(image);

        }


        /*
         * Описание.
         *
         * Пока выводится заглушка.
         * Получение описания и серий будет отдельным этапом.
         */

        var description = $(
            '<div class="anistar-detail__description">' +
                'Страница аниме на AniStar.' +
            '</div>'
        );


        /*
         * Кнопка открытия страницы источника.
         */

        var open = $(
            '<div class="selector anistar-detail__link">' +
                'Открыть страницу AniStar' +
            '</div>'
        );


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

        };


        this.stop = function () {

        };


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
     * 18. ПУНКТ ЛЕВОГО МЕНЮ
     * ========================================================= */

    function addMenu() {

        var menu = $('.menu .menu__list').eq(0);


        if (!menu.length) {

            console.warn(
                '[AniStar] Menu not found'
            );

            return;

        }


        /*
         * Защита от повторного добавления.
         */

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


        console.log(
            '[AniStar] Menu item added'
        );

    }


    /* =========================================================
     * 19. РЕГИСТРАЦИЯ КОМПОНЕНТОВ
     * ========================================================= */

    function init() {

        if (window[READY_FLAG]) {
            return;
        }


        if (
            !window.Lampa ||
            !Lampa.Component ||
            !Lampa.Activity ||
            !Lampa.Reguest
        ) {

            console.error(
                '[AniStar] Required Lampa API is unavailable'
            );

            return;

        }


        /*
         * Добавляем CSS.
         */

        addStyles();


        /*
         * Регистрируем каталог.
         */

        if (!Lampa.Component.get(PLUGIN_ID)) {

            Lampa.Component.add(
                PLUGIN_ID,
                AniStarCatalog
            );

        }


        /*
         * Регистрируем страницу тайтла.
         */

        if (!Lampa.Component.get(DETAIL_ID)) {

            Lampa.Component.add(
                DETAIL_ID,
                AniStarDetail
            );

        }


        /*
         * Добавляем пункт меню.
         */

        addMenu();


        /*
         * Только теперь отмечаем плагин
         * как успешно инициализированный.
         */

        window[READY_FLAG] = true;


        console.log(
            '[AniStar] Initialized. Version: ' +
            PLUGIN_VERSION
        );

    }


    /* =========================================================
     * 20. ЗАПУСК ПОСЛЕ ГОТОВНОСТИ LAMPA
     * ========================================================= */

    if (
        window.Lampa &&
        window.appready
    ) {

        init();

    }

    else if (
        window.Lampa &&
        Lampa.Listener
    ) {

        Lampa.Listener.follow(

            'app',

            function (event) {

                if (event.type === 'ready') {

                    init();

                }

            }

        );

    }

    else {

        console.error(
            '[AniStar] Lampa Listener is unavailable'
        );

    }

})();
