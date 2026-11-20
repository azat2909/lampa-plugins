
/*!
 * ============================================================
 * AniStar — каталог аниме для Lampa
 * ============================================================
 *
 * Версия: 0.3.1
 * Платформа: Lampa 3.4.7
 * Android APK: 1.13.6-586
 * Источник: https://anistar.org/anime/
 *
 * ИЗМЕНЕНИЯ 0.3.1:
 *
 * 1. Каталог переведён на Lampa.Maker.
 * 2. Используется штатная структура Main -> Line -> Card.
 * 3. Добавлены штатные обработчики Callback.
 * 4. Добавлена навигация пультом через onFocus/onEnter.
 * 5. Добавлена подгрузка страниц через onMore.
 * 6. Сетевые запросы выполняются через request.native().
 * 7. Сохранён парсер HTML AniStar.
 * 8. Сохранено левое меню.
 * 9. Добавлена защита от повторной инициализации.
 *
 * ВАЖНО:
 * Плагин использует API Lampa 3.x.
 * Для сетевого доступа к AniStar может потребоваться прокси,
 * если сервер блокирует запросы с устройства.
 *
 * ============================================================
 */

(function () {
    'use strict';


    /* =========================================================
     * 1. НАСТРОЙКИ ПЛАГИНА
     * ========================================================= */

    var PLUGIN_ID = 'anistar_catalog';
    var DETAIL_ID = 'anistar_detail';

    var PLUGIN_VERSION = '0.3.1';

    var READY_FLAG = 'anistar_031_ready';

    var BASE_URL = 'https://anistar.org/anime/';
    var SITE_HOST = 'anistar.org';

    /*
     * Если используется собственный Cloudflare Worker,
     * его адрес можно указать здесь.
     *
     * Оставляем пустым для прямого подключения.
     */
    var PROXY_URL = '';

    /*
     * Максимальное количество повторных попыток
     * инициализации, если Lampa ещё не готова.
     */
    var INIT_ATTEMPTS = 100;

    var INIT_INTERVAL = 200;


    // Защита от повторной загрузки одного плагина.
    if (window[READY_FLAG]) return;

    window[READY_FLAG] = true;


    /* =========================================================
     * 2. CSS
     * ========================================================= */

    var CSS = [

        /*
         * Основной экран каталога.
         */
        '.anistar-screen {',
        ' width:100%;',
        ' box-sizing:border-box;',
        ' padding:0 2em 3em;',
        '}',

        /*
         * Заголовок строки.
         */
        '.anistar-line-title {',
        ' margin-bottom:1em;',
        ' font-size:1.25em;',
        ' font-weight:bold;',
        '}',

        /*
         * Карточка аниме.
         */
        '.anistar-card {',
        ' position:relative;',
        ' width:100%;',
        ' box-sizing:border-box;',
        '}',

        /*
         * Изображение постера.
         */
        '.anistar-card__poster {',
        ' width:100%;',
        ' aspect-ratio:2/3;',
        ' overflow:hidden;',
        ' border-radius:.35em;',
        ' background:rgba(255,255,255,.08);',
        '}',

        '.anistar-card__poster img {',
        ' display:block;',
        ' width:100%;',
        ' height:100%;',
        ' object-fit:cover;',
        '}',

        /*
         * Заглушка, если постер отсутствует.
         */
        '.anistar-card__placeholder {',
        ' display:flex;',
        ' width:100%;',
        ' height:100%;',
        ' align-items:center;',
        ' justify-content:center;',
        ' font-size:2em;',
        ' opacity:.5;',
        '}',

        /*
         * Название аниме.
         */
        '.anistar-card__title {',
        ' margin-top:.5em;',
        ' font-size:.95em;',
        ' line-height:1.3;',
        ' overflow:hidden;',
        ' display:-webkit-box;',
        ' -webkit-line-clamp:2;',
        ' -webkit-box-orient:vertical;',
        '}',

        /*
         * Подсветка выбранной карточки.
         */
        '.anistar-card.focus .anistar-card__poster {',
        ' outline:3px solid #fff;',
        ' outline-offset:3px;',
        '}',

        /*
         * Экран информации о тайтле.
         */
        '.anistar-detail {',
        ' display:flex;',
        ' gap:2em;',
        ' padding:2em;',
        ' align-items:flex-start;',
        '}',

        '.anistar-detail__poster {',
        ' width:220px;',
        ' max-width:35%;',
        ' flex-shrink:0;',
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

        '.anistar-detail__button {',
        ' display:inline-block;',
        ' padding:1em 1.5em;',
        ' margin-top:1.5em;',
        ' background:rgba(255,255,255,.12);',
        ' border-radius:.4em;',
        '}',

        '.anistar-detail__button.focus {',
        ' background:rgba(255,255,255,.3);',
        '}',

        '@media(max-width:700px) {',
        ' .anistar-detail { flex-direction:column; }',
        ' .anistar-detail__poster { width:180px; max-width:70%; }',
        '}'

    ].join('\n');


    /*
     * Добавляем CSS только один раз.
     */
    function addStyles() {

        if (document.getElementById('anistar_styles')) {
            return;
        }

        var style = document.createElement('style');

        style.id = 'anistar_styles';
        style.type = 'text/css';
        style.textContent = CSS;

        (document.head || document.documentElement)
            .appendChild(style);

    }


    /* =========================================================
     * 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     * ========================================================= */

    // Удаляем лишние пробелы из текста.
    function cleanText(value) {

        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim();

    }


    // Преобразуем относительную ссылку в абсолютную.
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


    // Удаляем якорь из адреса.
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


    // Проверяем домен AniStar.
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
     * Проверяем формат адреса страницы аниме.
     *
     * Пример:
     * https://anistar.org/10847-nazvanie.html
     */
    function isAnimeUrl(url) {

        try {

            var parsed = new URL(url);

            return isAniStarUrl(url) &&
                /^\/\d+-[^/]+\.html$/i.test(
                    parsed.pathname
                );

        }

        catch (e) {

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


        /*
         * Если src отсутствует, используем srcset.
         */
        if (!src) {

            var srcset =

                image.getAttribute('data-srcset') ||

                image.getAttribute('srcset') ||

                '';

            if (srcset) {

                src = srcset
                    .split(',')[0]
                    .trim()
                    .split(/\s+/)[0];

            }

        }

        return absoluteUrl(src, base);

    }


    /* =========================================================
     * 5. ПАРСЕР КАТАЛОГА ANISTAR
     * ========================================================= */

    function parseCatalog(html, pageUrl) {

        var doc = new DOMParser().parseFromString(
            String(html || ''),
            'text/html'
        );

        var items = [];

        var seen = {};


        /*
         * Ищем все ссылки на странице.
         *
         * Не привязываемся к конкретным CSS-классам сайта.
         */
        var links = doc.querySelectorAll('a[href]');


        Array.prototype.forEach.call(
            links,

            function (link) {

                var url = absoluteUrl(
                    link.getAttribute('href'),
                    pageUrl
                );

                // Пропускаем ссылки, не являющиеся страницами аниме.
                if (!isAnimeUrl(url)) return;

                url = normalizeUrl(url);

                // Убираем дубликаты.
                if (seen[url]) return;


                /*
                 * Определяем контейнер карточки.
                 */
                var card = link.closest(

                    '.shortstory, ' +
                    '.base, ' +
                    '.news, ' +
                    '.item, ' +
                    '.anime-item, ' +
                    '.movie-item, ' +
                    'article, ' +
                    'li'

                );

                if (!card) {

                    card = link.parentElement;

                }


                /*
                 * Получаем название аниме.
                 */
                var title = cleanText(

                    link.getAttribute('title') ||

                    link.textContent

                );


                /*
                 * Если название не найдено в ссылке,
                 * ищем заголовок в контейнере карточки.
                 */
                if (!title || title.length < 2) {

                    var heading = card && card.querySelector(

                        'h1,h2,h3,h4,.title,.name'

                    );

                    if (heading) {

                        title = cleanText(
                            heading.textContent
                        );

                    }

                }


                // Получаем постер.
                var image =

                    link.querySelector('img') ||

                    (
                        card &&
                        card.querySelector('img')
                    );


                /*
                 * Если заголовок отсутствует,
                 * пробуем использовать alt изображения.
                 */
                if (
                    (!title || title.length < 2) &&
                    image
                ) {

                    title = cleanText(
                        image.getAttribute('alt')
                    );

                }


                // Проверяем корректность названия.
                if (!title || title.length < 2) return;

                if (title.length > 220) return;


                // Исключаем служебные ссылки.
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

                    poster: getPoster(
                        image,
                        pageUrl
                    ),

                    img: getPoster(
                        image,
                        pageUrl
                    ),

                    source: 'anistar'

                });

            }

        );


        /* =====================================================
         * 6. ПОИСК СЛЕДУЮЩЕЙ СТРАНИЦЫ
         * ===================================================== */

        var next = '';

        var pagination = doc.querySelectorAll(

            '.navigation a[href], ' +
            '.pagination a[href], ' +
            '.pages a[href], ' +
            '.pagenavi a[href], ' +
            'a[rel~="next"], ' +
            'a[href]'

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

                var aria = (
                    link.getAttribute('aria-label') || ''
                ).toLowerCase();


                /*
                 * Распознаём разные варианты обозначения
                 * следующей страницы.
                 */
                var isNext =

                    rel.indexOf('next') !== -1 ||

                    /next|следующ|далее/.test(cls) ||

                    /next|следующ|далее/.test(aria) ||

                    text === '»' ||

                    text === '›' ||

                    text === 'следующая' ||

                    text === 'далее' ||

                    text === 'следующая страница';


                if (!isNext) return false;


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


        return {

            items: items,

            next: next

        };

    }


    /* =========================================================
     * 7. СЕТЕВОЙ МОДУЛЬ
     * =========================================================
     *
     * В предыдущей версии использовался request.get().
     *
     * В некоторых сборках Lampa этот метод приводил
     * к ошибке ReferenceError: clear is not defined.
     *
     * Поэтому используем request.native().
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


                // Успешный ответ.
                function (data) {

                    if (typeof success === 'function') {

                        success(data);

                    }

                },


                // Ошибка запроса.
                function (xhr, status) {

                    console.error(
                        '[AniStar] Network error:',
                        xhr,
                        status
                    );

                    if (typeof error === 'function') {

                        error(xhr, status);

                    }

                },


                // GET-запрос, POST-данные не нужны.
                false,


                // Настройки.
                {
                    dataType: 'text',
                    timeout: 20000
                }

            );

        };


        /*
         * Отмена сетевых запросов.
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
     * 8. ПОДГОТОВКА ДАННЫХ ДЛЯ LAMPA
     * ========================================================= */

    /*
     * Приводим данные AniStar к формату карточек Lampa.
     */
    function prepareItem(item) {

        return {

            id: item.id,

            title: item.title,

            name: item.title,

            url: item.url,

            poster: item.poster,

            img: item.poster,

            source: 'anistar',

            type: 'anime',

            params: {

                style: {
                    name: 'small'
                }

            }

        };

    }


    /* =========================================================
     * 9. СОЗДАНИЕ КАТАЛОГА MAIN
     * ========================================================= */

    function AniStarCatalog(object) {

        object = object || {};

        var destroyed = false;

        var loading = false;

        var network = new AniStarNetwork();


        var pageUrl = object.page_url || BASE_URL;

        var nextUrl = '';

        var pageNumber = 1;


        // Все загруженные тайтлы.
        var items = [];

        // Защита от дубликатов.
        var loaded = {};


        // Хранилище строк каталога.
        var rows = [];


        /*
         * Создаём штатный компонент Main.
         *
         * Именно он отвечает за вертикальную прокрутку
         * и отображение строк каталога Lampa.
         */
        var main = Lampa.Maker.make(

            'Main',

            {

                title: 'Анистар',

                results: []

            }

        );


        /* =====================================================
         * 10. СОЗДАНИЕ КАРТОЧЕК
         * ===================================================== */

        function makeCardData(item) {

            var data = prepareItem(item);


            /*
             * createInstance позволяет использовать
             * штатную карточку Card с модулем Callback.
             *
             * Callback необходим для обработки событий
             * управления пультом Android TV.
             */
            data.params = {

                createInstance: function (cardData) {

                    return Lampa.Maker.make(

                        'Card',

                        cardData,

                        function (module) {

                            return module.only(
                                'Create',
                                'Callback'
                            );

                        }

                    );

                },


                /*
                 * События карточки.
                 */
                emit: {

                    /*
                     * Получение фокуса.
                     */
                    onFocus: function () {

                        if (destroyed) return;

                        console.log(
                            '[AniStar] Focus:',
                            item.title
                        );

                    },


                    /*
                     * Нажатие OK.
                     */
                    onEnter: function () {

                        if (destroyed) return;

                        openDetail(item);

                    }

                }

            };


            return data;

        }


        /* =====================================================
         * 11. СОЗДАНИЕ СТРОКИ КАТАЛОГА
         * ===================================================== */

        function makeRow(list, title) {

            var results = list.map(function (item) {

                return makeCardData(item);

            });


            return {

                title: title || 'Анистар',

                results: results,

                params: {

                    module: Lampa.Maker
                        .module('Line')
                        .toggle('Callback')

                }

            };

        }


        /* =====================================================
         * 12. ПОСТРОЕНИЕ КАТАЛОГА
         * ===================================================== */

        function buildCatalog() {

            if (destroyed) return;


            /*
             * Передаём Main все загруженные строки.
             *
             * Строки создаются через штатный Maker.
             */
            main.build(rows);


            console.log(
                '[AniStar] Catalog built:',
                items.length
            );

        }


        /* =====================================================
         * 13. ПОЛУЧЕНИЕ СЛЕДУЮЩЕЙ СТРАНИЦЫ
         * ===================================================== */

        function loadNextPage() {

            if (
                destroyed ||
                loading ||
                !nextUrl
            ) {
                return;
            }


            var url = nextUrl;

            nextUrl = '';


            loadPage(url);

        }


        /* =====================================================
         * 14. ОБРАБОТКА ДАННЫХ СТРОКИ
         * ===================================================== */

        function bindLine(line, lineData) {

            if (!line || typeof line.use !== 'function') {
                return;
            }


            line.use({

                /*
                 * onMore вызывается механизмом Line
                 * при необходимости получить дополнительные
                 * элементы каталога.
                 */
                onMore: function () {

                    if (destroyed || loading) return;

                    /*
                     * Подгружаем следующую страницу AniStar.
                     */
                    loadNextPage();

                }

            });

        }


        /* =====================================================
         * 15. ПОДКЛЮЧЕНИЕ ОБРАБОТЧИКОВ MAIN
         * ===================================================== */

        main.use({

            /*
             * Событие создания каталога.
             */
            onCreate: function () {

                loadPage(pageUrl);

            },


            /*
             * Вызывается при создании каждой строки Line.
             */
            onInstance: function (line, lineData) {

                bindLine(line, lineData);

            }

        });


        /* =====================================================
         * 16. ЗАГРУЗКА СТРАНИЦЫ ANISTAR
         * ===================================================== */

        function loadPage(url) {

            if (
                destroyed ||
                loading ||
                !url
            ) {
                return;
            }


            loading = true;


            console.log(
                '[AniStar] Loading:',
                url
            );


            /*
             * Используем штатный индикатор загрузки Activity.
             */
            if (
                main.activity &&
                main.activity.loader
            ) {

                main.activity.loader(true);

            }


            network.get(

                url,


                /* ---------------------------------------------
                 * УСПЕШНЫЙ ОТВЕТ
                 * --------------------------------------------- */

                function (html) {

                    if (destroyed) return;

                    loading = false;


                    try {

                        /*
                         * Скрываем индикатор загрузки.
                         */
                        if (
                            main.activity &&
                            main.activity.loader
                        ) {

                            main.activity.loader(false);

                        }


                        /*
                         * Разбираем HTML AniStar.
                         */
                        var parsed = parseCatalog(
                            html,
                            url
                        );


                        console.log(
                            '[AniStar] Parsed:',
                            parsed.items.length
                        );


                        /*
                         * Добавляем новые тайтлы.
                         */
                        var newItems = [];


                        parsed.items.forEach(function (item) {

                            if (!item.url) return;

                            if (loaded[item.url]) return;


                            loaded[item.url] = true;

                            items.push(item);

                            newItems.push(item);

                        });


                        /*
                         * Если на первой странице ничего
                         * не найдено, сообщаем об ошибке.
                         */
                        if (
                            !items.length &&
                            !newItems.length
                        ) {

                            Lampa.Noty.show(
                                'HTML AniStar получен, ' +
                                'но тайтлы не найдены.'
                            );

                            return;

                        }


                        /*
                         * Сохраняем адрес следующей страницы.
                         */
                        nextUrl = parsed.next || '';


                        /*
                         * Создаём новую строку только
                         * при наличии новых тайтлов.
                         */
                        if (newItems.length) {

                            pageNumber++;

                            rows.push(

                                makeRow(

                                    newItems,

                                    pageNumber === 2
                                        ? 'Анистар'
                                        : 'Анистар — продолжение'

                                )

                            );


                            /*
                             * Обновляем штатный каталог.
                             */
                            buildCatalog();

                        }


                        console.log(
                            '[AniStar] Total loaded:',
                            items.length
                        );


                        console.log(
                            '[AniStar] Next page:',
                            nextUrl
                        );


                        /*
                         * Если следующей страницы нет,
                         * больше запросы не выполняются.
                         */
                        if (!nextUrl) {

                            console.log(
                                '[AniStar] End of catalog'
                            );

                        }

                    }

                    catch (e) {

                        loading = false;

                        console.error(
                            '[AniStar] Parse error:',
                            e
                        );

                        Lampa.Noty.show(
                            'Ошибка обработки каталога AniStar'
                        );

                    }

                },


                /* ---------------------------------------------
                 * ОШИБКА СЕТИ
                 * --------------------------------------------- */

                function (xhr, status) {

                    if (destroyed) return;

                    loading = false;


                    if (
                        main.activity &&
                        main.activity.loader
                    ) {

                        main.activity.loader(false);

                    }


                    var code = xhr && xhr.status
                        ? xhr.status
                        : 0;


                    console.error(
                        '[AniStar] Request failed:',
                        code,
                        status
                    );


                    Lampa.Noty.show(

                        code

                            ? 'Ошибка AniStar. HTTP ' + code

                            : 'Не удалось подключиться к AniStar. ' +
                              'Проверь сеть, DNS, TLS или CORS.'

                    );

                }

            );

        }


        /* =====================================================
         * 17. ОТКРЫТИЕ СТРАНИЦЫ ТАЙТЛА
         * ===================================================== */

        function openDetail(item) {

            if (!item) return;


            Lampa.Activity.push({

                url: '',

                title: item.title,

                component: DETAIL_ID,

                item: item

            });

        }


        /* =====================================================
         * 18. ЖИЗНЕННЫЙ ЦИКЛ КОМПОНЕНТА
         * ===================================================== */

        /*
         * Возвращаем штатный Main.
         *
         * Lampa сама управляет созданием, отображением,
         * фокусом и прокруткой этого компонента.
         */
        return main;

    }


    /* =========================================================
     * 19. ЭКРАН ИНФОРМАЦИИ О ТАЙТЛЕ
     * ========================================================= */

    function AniStarDetail(object) {

        object = object || {};

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
         * Пока показываем базовую информацию.
         * Извлечение описания и серий будет следующим этапом.
         */
        var description = $(
            '<div class="anistar-detail__description"></div>'
        );

        description.text(
            'Страница аниме на AniStar'
        );


        /*
         * Кнопка перехода к источнику.
         */
        var open = $(
            '<div class="selector anistar-detail__button">' +
            'Открыть страницу AniStar' +
            '</div>'
        );


        /*
         * Обработка фокуса.
         */
        open.on('hover:focus', function () {

            open.addClass('focus');

        });


        /*
         * Нажатие OK.
         *
         * Пока выводим ссылку уведомлением.
         * Внешнее открытие страницы будет реализовано
         * отдельным этапом.
         */
        open.on('hover:enter', function () {

            if (!item.url) return;

            Lampa.Noty.show(
                item.url
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

            root.remove();

        };


        this.empty = function () {

            this.activity.loader(false);

            this.activity.empty();

        };

    }


    /* =========================================================
     * 20. ДОБАВЛЕНИЕ КАТАЛОГА В ЛЕВОЕ МЕНЮ
     * ========================================================= */

    var menuButton = null;


    function addMenu() {

        /*
         * Предпочтительный способ Lampa 3.x —
         * штатный Lampa.Menu.addButton().
         */
        if (
            Lampa.Menu &&
            typeof Lampa.Menu.addButton === 'function'
        ) {

            if (menuButton) return;


            var icon =

                '<svg viewBox="0 0 24 24" ' +
                'xmlns="http://www.w3.org/2000/svg">' +

                '<path fill="currentColor" d="' +
                'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z' +
                'm-2 14V8l7 4-7 4Z"/>' +

                '</svg>';


            menuButton = Lampa.Menu.addButton(

                icon,

                'Анистар',

                function () {

                    openCatalog();

                }

            );


            console.log(
                '[AniStar] Menu button added'
            );

            return;

        }


        /*
         * Резервный вариант для сборок,
         * где Lampa.Menu.addButton отсутствует.
         */
        var menu = $('.menu .menu__list').eq(0);


        if (!menu.length) {

            console.warn(
                '[AniStar] Menu list not found'
            );

            return;

        }


        if (menu.find('.anistar-menu-item').length) {
            return;
        }


        var button = $(

            '<li class="menu__item selector anistar-menu-item">' +

                '<div class="menu__ico">' +

                    '<svg viewBox="0 0 24 24">' +

                        '<path fill="currentColor" d="' +
                        'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z' +
                        'm-2 14V8l7 4-7 4Z"/>' +

                    '</svg>' +

                '</div>' +

                '<div class="menu__text">Анистар</div>' +

            '</li>'

        );


        button.on('hover:enter', function () {

            openCatalog();

        });


        menu.append(button);

    }


    /*
     * Открытие каталога AniStar.
     */
    function openCatalog() {

        Lampa.Activity.push({

            url: '',

            title: 'Анистар',

            component: PLUGIN_ID,

            page_url: BASE_URL

        });

    }


    /* =========================================================
     * 21. РЕГИСТРАЦИЯ КОМПОНЕНТОВ
     * ========================================================= */

    function registerComponents() {

        /*
         * Проверяем доступность Maker.
         */
        if (
            !Lampa.Maker ||
            typeof Lampa.Maker.make !== 'function'
        ) {

            console.error(
                '[AniStar] Lampa.Maker is unavailable'
            );

            Lampa.Noty.show(
                'AniStar: отсутствует Lampa.Maker'
            );

            return false;

        }


        /*
         * Проверяем наличие необходимых модулей.
         */
        if (
            typeof Lampa.Maker.module !== 'function'
        ) {

            console.error(
                '[AniStar] Lampa.Maker.module unavailable'
            );

            return false;

        }


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


        return true;

    }


    /* =========================================================
     * 22. ИНИЦИАЛИЗАЦИЯ
     * ========================================================= */

    function init() {

        if (
            !window.Lampa ||
            !Lampa.Component ||
            !Lampa.Activity ||
            !Lampa.Reguest ||
            !Lampa.Listener
        ) {

            console.error(
                '[AniStar] Required Lampa API unavailable'
            );

            return false;

        }


        // Добавляем стили.
        addStyles();


        // Регистрируем компоненты.
        if (!registerComponents()) {
            return false;
        }


        // Добавляем пункт меню.
        addMenu();


        console.log(
            '[AniStar] Initialized. Version: ' +
            PLUGIN_VERSION
        );


        return true;

    }


    /* =========================================================
     * 23. ОЖИДАНИЕ ГОТОВНОСТИ LAMPA
     * ========================================================= */

    function waitForLampa() {

        var attempts = 0;


        var timer = setInterval(function () {

            attempts++;


            /*
             * Проверяем, что приложение готово.
             */
            if (
                window.Lampa &&
                window.appready
            ) {

                clearInterval(timer);

                init();

                return;

            }


            /*
             * Если API уже доступно, но appready
             * отсутствует, проверяем событие ready.
             */
            if (
                window.Lampa &&
                Lampa.Component &&
                Lampa.Activity &&
                attempts > 5
            ) {

                if (init()) {

                    clearInterval(timer);

                    return;

                }

            }


            // Ограничиваем количество попыток.
            if (attempts >= INIT_ATTEMPTS) {

                clearInterval(timer);

                console.error(
                    '[AniStar] Initialization timeout'
                );

            }

        }, INIT_INTERVAL);

    }


    /*
     * Запускаем плагин после готовности Lampa.
     */
    if (window.appready) {

        init();

    }

    else if (
        window.Lampa &&
        Lampa.Listener &&
        typeof Lampa.Listener.follow === 'function'
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

        waitForLampa();

    }


})();
