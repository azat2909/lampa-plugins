
/*!
 * ============================================================
 * AniStar — плагин каталога аниме для Lampa
 * ============================================================
 *
 * Версия: 0.2.1
 * Источник: https://anistar.org/anime/
 *
 * Назначение:
 * Добавляет каталог «Анистар» в левое меню Lampa.
 * Загружает HTML сайта AniStar, извлекает названия,
 * ссылки и постеры аниме.
 *
 * ВАЖНО:
 * 1. Используется штатный интерфейс Lampa.
 * 2. Собственный интерфейс приложения не создаётся.
 * 3. Данные извлекаются непосредственно из HTML.
 * 4. Для прямого запроса сайт должен быть доступен Lampa.
 * 5. Если запрос блокируется CORS, потребуется прокси.
 *
 * ============================================================
 */

(function () {
    'use strict';

    /* =========================================================
     * 1. ОСНОВНЫЕ НАСТРОЙКИ
     * ========================================================= */

    var PLUGIN = 'anistar_catalog';
    var READY_FLAG = 'plugin_anistar_catalog_ready';

    var BASE_URL = 'https://anistar.org/anime/';
    var SITE_HOST = 'anistar.org';
    var PAGE_TITLE = 'Анистар';

    /*
     * Необязательный адрес собственного прокси.
     *
     * Пока оставляем пустым.
     *
     * Если будет создан Cloudflare Worker, который возвращает
     * HTML AniStar, здесь можно указать его адрес.
     *
     * Например:
     * var PROXY_URL = 'https://example.workers.dev/?url=';
     */
    var PROXY_URL = '';

    // Иконка каталога в левом меню Lampa.
    var ICON =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2.1 14.8V7.2L17 12l-7.1 4.8Z"/>' +
        '</svg>';

    // Защита от повторной инициализации.
    if (window[READY_FLAG]) return;

    window[READY_FLAG] = true;


    /* =========================================================
     * 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     * ========================================================= */

    /*
     * Преобразование относительной ссылки в абсолютную.
     *
     * Например:
     * /uploads/poster.jpg
     *
     * Превратится в:
     * https://anistar.org/uploads/poster.jpg
     */
    function absoluteUrl(url, base) {
        if (!url) return '';

        try {
            return new URL(url, base || BASE_URL).href;
        } catch (e) {
            return '';
        }
    }


    // Удаление лишних пробелов и переносов строк.
    function cleanText(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim();
    }


    // Проверяем, что ссылка принадлежит AniStar.
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
     * Нормализация URL.
     *
     * Удаляем hash, чтобы одна и та же страница
     * не добавлялась в каталог несколько раз.
     */
    function normalizeUrl(url) {
        try {
            var parsed = new URL(url);
            parsed.hash = '';

            return parsed.href;

        } catch (e) {
            return url;
        }
    }


    /*
     * Проверка, является ли ссылка страницей тайтла.
     *
     * AniStar использует формат публикаций DLE:
     *
     * /10847-lazurnoe-nasledie-3-sezon.html
     *
     * Поэтому нельзя ограничиваться ссылками /anime/.
     */
    function isAnimePageUrl(url) {
        try {
            var parsed = new URL(url);

            if (!isAniStarUrl(url)) return false;

            return /^\/\d+-[^/]+\.html$/i.test(
                parsed.pathname
            );

        } catch (e) {
            return false;
        }
    }


    /*
     * Извлечение наиболее подходящего адреса изображения.
     *
     * Поддерживаются:
     * src
     * data-src
     * data-original
     * data-lazy-src
     * data-original-src
     * srcset
     */
    function getImageUrl(image, pageUrl) {
        if (!image) return '';

        var poster =
            image.getAttribute('data-src') ||
            image.getAttribute('data-original') ||
            image.getAttribute('data-lazy-src') ||
            image.getAttribute('data-original-src') ||
            image.getAttribute('src') ||
            '';

        // Если обычный адрес отсутствует, проверяем srcset.
        if (!poster && image.getAttribute('srcset')) {

            var srcset = image.getAttribute('srcset')
                .split(',');

            if (srcset.length) {
                poster = srcset[0]
                    .trim()
                    .split(/\s+/)[0];
            }
        }

        // Некоторые сайты используют data-srcset.
        if (!poster && image.getAttribute('data-srcset')) {

            poster = image.getAttribute('data-srcset')
                .split(',')[0]
                .trim()
                .split(/\s+/)[0];
        }

        if (!poster) return '';

        return absoluteUrl(poster, pageUrl);
    }


    /* =========================================================
     * 3. ПАРСИНГ HTML КАТАЛОГА ANISTAR
     * =========================================================
     *
     * Основная задача этого блока — найти все ссылки
     * на страницы аниме и извлечь данные карточек.
     *
     * ВАЖНО:
     * Мы не привязываемся к одному CSS-классу.
     * Сайт может менять HTML-шаблон, поэтому поиск
     * выполняется по формату ссылок на публикации.
     *
     * Поддерживаемый формат:
     * /12345-nazvanie-anime.html
     */

    function parsePage(html, pageUrl) {

        var doc = new DOMParser().parseFromString(
            String(html || ''),
            'text/html'
        );

        var results = [];
        var seen = {};


        /*
         * Получаем все ссылки страницы.
         *
         * Вместо поиска только по .shortstory или .anime-item
         * проверяем URL каждой ссылки.
         */
        var links = doc.querySelectorAll('a[href]');


        Array.prototype.forEach.call(links, function (link) {

            // Получаем абсолютный адрес.
            var href = absoluteUrl(
                link.getAttribute('href'),
                pageUrl
            );

            // Пропускаем ссылки, не принадлежащие AniStar.
            if (!href || !isAniStarUrl(href)) return;

            // Оставляем только страницы аниме.
            if (!isAnimePageUrl(href)) return;


            /*
             * Ищем изображение непосредственно внутри ссылки.
             */
            var imageInLink = link.querySelector('img');


            /*
             * Получаем родительский контейнер карточки.
             *
             * Проверяем несколько распространённых вариантов
             * HTML-разметки каталогов DLE и других CMS.
             */
            var card = link.closest(
                '.shortstory, ' +
                '.shortstory__item, ' +
                '.base, ' +
                '.news, ' +
                '.item, ' +
                '.anime-item, ' +
                '.th-item, ' +
                '.movie-item, ' +
                '.poster-item, ' +
                '.card, ' +
                'article, ' +
                'li'
            );


            // Если контейнер не найден, используем родителей ссылки.
            if (!card) {
                card = link.parentElement &&
                    (
                        link.parentElement.parentElement ||
                        link.parentElement
                    );
            }


            /*
             * Определяем заголовок.
             *
             * Приоритет:
             * 1. Атрибут title ссылки.
             * 2. Текст ссылки.
             * 3. Alt изображения.
             * 4. Заголовок внутри карточки.
             */
            var title = cleanText(
                link.getAttribute('title') ||
                link.textContent ||
                (
                    imageInLink &&
                    imageInLink.getAttribute('alt')
                )
            );


            // Если название не найдено, ищем заголовок рядом.
            if (!title || title.length < 2) {

                var heading = card && card.querySelector(
                    'h1, h2, h3, h4, ' +
                    '.title, .name, ' +
                    '.shortstory__title, ' +
                    '.news-title'
                );

                if (heading) {
                    title = cleanText(heading.textContent);
                }
            }


            // Определяем изображение карточки.
            var image = imageInLink ||
                (card && card.querySelector('img'));


            // Если название отсутствует, пробуем alt изображения.
            if (
                (!title || title.length < 2) &&
                image &&
                image.getAttribute('alt')
            ) {
                title = cleanText(
                    image.getAttribute('alt')
                );
            }


            /*
             * Проверяем корректность названия.
             */
            if (
                !title ||
                title.length < 2 ||
                title.length > 220
            ) {
                return;
            }


            /*
             * Исключаем служебные названия.
             */
            if (
                /^(смотреть|подробнее|читать|перейти|»|›|следующая|предыдущая)$/i.test(title)
            ) {
                return;
            }

            // Исключаем очевидную рекламу.
            if (/новая крутая аниме игра/i.test(title)) {
                return;
            }


            // Нормализуем ссылку на страницу аниме.
            var itemUrl = normalizeUrl(href);


            // Удаляем дублирующиеся страницы.
            if (seen[itemUrl]) return;

            seen[itemUrl] = true;


            // Получаем адрес постера.
            var poster = getImageUrl(
                image,
                pageUrl
            );


            /*
             * Сохраняем найденный тайтл.
             *
             * id     — уникальный идентификатор;
             * title  — название аниме;
             * name   — дополнительное поле названия;
             * url    — ссылка на страницу;
             * poster — адрес постера.
             */
            results.push({

                id: itemUrl,

                title: title,

                name: title,

                url: itemUrl,

                poster: poster

            });

        });


        /* =====================================================
         * 4. ПОИСК СЛЕДУЮЩЕЙ СТРАНИЦЫ
         * ===================================================== */

        var nextUrl = '';

        var paginationLinks = doc.querySelectorAll(
            '.navigation a[href], ' +
            '.pagination a[href], ' +
            '.pages a[href], ' +
            '.pagenavi a[href], ' +
            'a[rel~="next"][href], ' +
            'a[href]'
        );


        Array.prototype.some.call(
            paginationLinks,
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


                // Проверяем обозначения следующей страницы.
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


                var candidate = absoluteUrl(
                    link.getAttribute('href'),
                    pageUrl
                );


                if (!candidate || !isAniStarUrl(candidate)) {
                    return false;
                }


                // Не допускаем переход на текущую страницу.
                if (
                    normalizeUrl(candidate) ===
                    normalizeUrl(pageUrl)
                ) {
                    return false;
                }


                nextUrl = candidate;

                return true;

            }
        );


        // Возвращаем список тайтлов и следующую страницу.
        return {

            results: results,

            next: nextUrl

        };

    }


    /* =========================================================
     * 5. КОМПОНЕНТ КАТАЛОГА LAMPA
     * ========================================================= */

    function AniStarCatalog(object) {

        var self = this;


        // Штатный сетевой компонент Lampa.
        var network = new Lampa.Reguest();


        // Штатный компонент прокрутки Lampa.
        var scroll = new Lampa.Scroll({

            mask: true,

            over: true

        });


        // Корневой контейнер.
        var root = $(
            '<div class="anistar-catalog"></div>'
        );


        // Контейнер пагинации.
        var footer = $(
            '<div class="anistar-catalog__footer"></div>'
        );


        // Кнопка загрузки следующей страницы.
        var moreButton = $(
            '<div class="selector anistar-catalog__more">' +
            'Загрузить ещё' +
            '</div>'
        );


        // Определяем URL начальной страницы.
        var pageUrl = object && object.page_url
            ? object.page_url
            : BASE_URL;


        // Хранилище уже загруженных тайтлов.
        var loaded = {};


        // Состояние компонента.
        var destroyed = false;
        var loading = false;


        // URL следующей страницы.
        var nextUrl = '';

        // Номер страницы.
        var pageNumber = 1;


        /*
         * Формирование адреса запроса.
         *
         * Если PROXY_URL не указан, обращаемся напрямую.
         * Если указан — передаём URL прокси.
         */
        function requestUrl(url) {

            if (!PROXY_URL) return url;

            return PROXY_URL + encodeURIComponent(url);

        }


        /* =====================================================
         * 6. ОБРАБОТКА ОШИБОК
         * ===================================================== */

        function showError(message) {

            if (destroyed) return;

            // Отключаем индикатор загрузки.
            self.activity.loader(false);

            // Показываем уведомление Lampa.
            Lampa.Noty.show(

                message ||
                'Не удалось загрузить каталог AniStar',

                {
                    style: 'error',
                    time: 7000
                }

            );

        }


        /* =====================================================
         * 7. СОЗДАНИЕ КАРТОЧКИ АНИМЕ
         * ===================================================== */

        function addCard(item) {

            // Штатная структура карточки Lampa.
            var card = $(
                '<div class="card card--small selector anistar-card"></div>'
            );

            var view = $(
                '<div class="card__view"></div>'
            );

            var title = $(
                '<div class="card__title"></div>'
            );


            /*
             * Если постер найден, отображаем его.
             */
            if (item.poster) {

                var img = $(
                    '<img class="card__img" loading="lazy">'
                );

                img.attr('src', item.poster);

                img.attr('alt', item.title);

                view.append(img);

            }

            else {

                // Заглушка, если постер отсутствует.
                view.addClass(
                    'anistar-card__no-poster'
                );

            }


            // Добавляем название.
            title.text(item.title);


            // Собираем карточку.
            card.append(view);

            card.append(title);


            /*
             * В версии 0.2.1 открытие страницы тайтла
             * ещё не реализовано.
             *
             * Следующим этапом будет добавлена страница:
             * - описание;
             * - жанры;
             * - год;
             * - список серий;
             * - видеоплеер Lampa.
             */
            card.on('hover:enter', function () {

                Lampa.Noty.show(
                    'Открытие страницы тайтла будет добавлено на следующем этапе'
                );

            });


            // Добавляем карточку в штатную прокрутку Lampa.
            scroll.append(card);

        }


        /* =====================================================
         * 8. ОТОБРАЖЕНИЕ КАТАЛОГА
         * ===================================================== */

        function renderPage(data) {

            if (destroyed) return;

            // Скрываем индикатор загрузки.
            self.activity.loader(false);

            loading = false;


            var added = 0;


            /*
             * Добавляем найденные тайтлы.
             *
             * Повторно уже загруженные карточки не добавляем.
             */
            data.results.forEach(function (item) {

                if (!item.url || loaded[item.url]) return;

                loaded[item.url] = true;

                addCard(item);

                added++;

            });


            // Сохраняем ссылку на следующую страницу.
            nextUrl = data.next || '';


            /*
             * Если ни одного тайтла не найдено,
             * показываем диагностическое сообщение.
             */
            if (!Object.keys(loaded).length) {

                showError(
                    'HTML AniStar получен, но карточки не распознаны. ' +
                    'Проверьте HTML-разметку сайта и формат ссылок.'
                );

                return;

            }


            // Добавляем блок пагинации.
            if (!footer.parent().length) {

                footer.append(moreButton);

                scroll.append(footer);

            }


            // Если следующая страница существует.
            if (nextUrl) {

                moreButton.show();

                moreButton.text('Загрузить ещё');

            }

            else {

                moreButton.hide();

                if (!added) {

                    Lampa.Noty.show(
                        'Больше тайтлов не найдено'
                    );

                }

            }

        }


        /* =====================================================
         * 9. ЗАГРУЗКА HTML ANISTAR
         * ===================================================== */

        function load(url) {

            // Не допускаем параллельных запросов.
            if (loading || destroyed || !url) return;

            loading = true;

            self.activity.loader(true);


            /*
             * СИГНАТУРА Lampa.Reguest.native():
             *
             * native(
             *     url,
             *     success,
             *     error,
             *     postData,
             *     settings
             * )
             *
             * Для GET-запроса четвёртый аргумент — false.
             * Настройки находятся в пятом аргументе.
             */

            network.native(

                requestUrl(url),


                /* ---------------------------------------------
                 * УСПЕШНЫЙ ОТВЕТ
                 * --------------------------------------------- */

                function (html) {

                    if (destroyed) return;

                    try {

                        // Преобразуем ответ в строку.
                        if (typeof html !== 'string') {
                            html = String(html || '');
                        }


                        // Проверяем, что HTML действительно получен.
                        if (!html || html.length < 100) {

                            loading = false;

                            showError(
                                'AniStar вернул пустой или слишком короткий ответ'
                            );

                            return;

                        }


                        // Разбираем HTML.
                        var parsed = parsePage(
                            html,
                            url
                        );


                        // Увеличиваем номер страницы.
                        pageNumber++;


                        // Отображаем результаты.
                        renderPage(parsed);

                    }

                    catch (error) {

                        loading = false;

                        showError(
                            'Ошибка разбора AniStar: ' +
                            (error.message || error)
                        );

                        console.error(
                            '[AniStar] parse error:',
                            error
                        );

                    }

                },


                /* ---------------------------------------------
                 * ОШИБКА СЕТЕВОГО ЗАПРОСА
                 * --------------------------------------------- */

                function (xhr, error) {

                    loading = false;

                    if (destroyed) return;


                    // Отключаем индикатор загрузки.
                    self.activity.loader(false);


                    var status = xhr && xhr.status
                        ? xhr.status
                        : 0;

                    var reason = '';


                    /*
                     * Получаем подробное описание ошибки
                     * средствами Lampa.Reguest.
                     */
                    if (network.errorDecode) {

                        try {

                            reason = network.errorDecode(
                                xhr,
                                error
                            );

                        }

                        catch (e) {}

                    }


                    // Диагностика для разработчика.
                    console.error(
                        '[AniStar] request failed:',
                        {
                            url: requestUrl(url),
                            status: status,
                            error: error,
                            response: xhr && xhr.responseText
                        }
                    );


                    /*
                     * Статус 0 не обязательно означает CORS.
                     *
                     * Возможные причины:
                     * - CORS;
                     * - DNS;
                     * - TLS/SSL;
                     * - блокировка сайта;
                     * - отсутствие подключения.
                     */
                    if (status === 0) {

                        showError(
                            'Не удалось соединиться с AniStar ' +
                            '(сетевой статус 0). Возможны CORS, ' +
                            'блокировка сайта, DNS или TLS. ' +
                            'Подробности доступны в консоли Lampa.'
                        );

                    }

                    else {

                        showError(
                            'Ошибка AniStar. HTTP ' +
                            status +
                            (reason ? ': ' + reason : '')
                        );

                    }

                },


                // Четвёртый аргумент — POST-данные. Для GET: false.
                false,


                // Пятый аргумент — настройки запроса.
                {
                    dataType: 'text',
                    timeout: 20000
                }

            );

        }


        /* =====================================================
         * 10. ПАГИНАЦИЯ
         * ===================================================== */

        moreButton.on('hover:enter', function () {

            if (!nextUrl || loading) return;

            moreButton.text('Загрузка...');

            load(nextUrl);

        });


        /* =====================================================
         * 11. ЖИЗНЕННЫЙ ЦИКЛ КОМПОНЕНТА LAMPA
         * ===================================================== */

        // Создание компонента.
        this.create = function () {

            // Добавляем штатную прокрутку.
            root.append(
                scroll.render()
            );

            // Загружаем первую страницу.
            load(pageUrl);

            return this.render();

        };


        // Возвращаем корневой контейнер.
        this.render = function () {

            return root;

        };


        // Активация компонента.
        this.start = function () {};


        // Временная остановка компонента.
        this.stop = function () {};


        // Уничтожение компонента.
        this.destroy = function () {

            destroyed = true;

            // Отменяем сетевые запросы.
            network.clear();

            // Уничтожаем прокрутку.
            scroll.destroy();

            // Удаляем DOM.
            root.remove();

        };


        // Пустое состояние.
        this.empty = function () {

            self.activity.loader(false);

            self.activity.empty();

        };

    }


    /* =========================================================
     * 12. ДОБАВЛЕНИЕ ПУНКТА В ЛЕВОЕ МЕНЮ LAMPA
     * ========================================================= */

    function addMenuItem() {

        // Получаем список пунктов левого меню.
        var menu = $('.menu .menu__list').eq(0);


        if (!menu.length) {

            console.warn(
                '[AniStar] menu list not found'
            );

            return;

        }


        // Проверяем, не добавлен ли пункт ранее.
        if (
            menu.find('.' + PLUGIN + '__menu').length
        ) {
            return;
        }


        // Создаём пункт меню штатными классами Lampa.
        var button = $(

            '<li class="menu__item selector ' +
            PLUGIN +
            '__menu">' +

                '<div class="menu__ico">' +
                ICON +
                '</div>' +

                '<div class="menu__text">' +
                PAGE_TITLE +
                '</div>' +

            '</li>'

        );


        /*
         * Обработка нажатия на пункт «Анистар».
         */
        button.on('hover:enter', function () {

            Lampa.Activity.push({

                url: '',

                title: PAGE_TITLE,

                component: PLUGIN,

                page: 1,

                page_url: BASE_URL

            });

        });


        // Добавляем пункт в левое меню.
        menu.append(button);

    }


    /* =========================================================
     * 13. ИНИЦИАЛИЗАЦИЯ ПЛАГИНА
     * ========================================================= */

    function init() {

        // Проверяем готовность API Lampa.
        if (
            !window.Lampa ||
            !Lampa.Component ||
            !Lampa.Activity
        ) {

            console.error(
                '[AniStar] Lampa API is not ready'
            );

            return;

        }


        // Регистрируем компонент каталога.
        if (!Lampa.Component.get(PLUGIN)) {

            Lampa.Component.add(
                PLUGIN,
                AniStarCatalog
            );

        }


        // Добавляем пункт в левое меню.
        addMenuItem();


        console.log(
            '[AniStar] plugin initialized, version 0.2.1'
        );

    }


    /* =========================================================
     * 14. ОЖИДАНИЕ ГОТОВНОСТИ LAMPA
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
