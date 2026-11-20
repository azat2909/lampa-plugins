
/*!
 * AniStar для Lampa
 * Версия: 0.2.0
 *
 * Каталог аниме с сайта https://anistar.org/anime/
 * Интерфейс использует штатные компоненты и стили Lampa.
 *
 * ВАЖНО О СЕТЕВЫХ ЗАПРОСАХ:
 * Lampa.Reguest.native() вызывается с пятью аргументами:
 * native(url, success, error, postData, settings).
 *
 * Если сайт не разрешает CORS, браузерная версия Lampa
 * не сможет прочитать HTML напрямую.
 * Для этого потребуется собственный серверный прокси.
 */
(function () {
    'use strict';

    /* =========================================================
     * 1. НАСТРОЙКИ ПЛАГИНА
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
     * Если понадобится прокси, укажем его адрес здесь.
     */
    var PROXY_URL = '';

    // Иконка каталога в левом меню.
    var ICON =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2.1 14.8V7.2L17 12l-7.1 4.8Z"/>' +
        '</svg>';

    // Не допускаем повторную инициализацию.
    if (window[READY_FLAG]) return;

    window[READY_FLAG] = true;


    /* =========================================================
     * 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     * ========================================================= */

    // Преобразование относительной ссылки в абсолютную.
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

    // Проверка принадлежности ссылки сайту AniStar.
    function isAniStarUrl(url) {
        try {
            var host = new URL(url).hostname;

            return host === SITE_HOST ||
                host === 'www.' + SITE_HOST;

        } catch (e) {
            return false;
        }
    }

    // Нормализация URL для исключения повторов.
    function normalizeUrl(url) {
        try {
            var parsed = new URL(url);

            parsed.hash = '';

            return parsed.href;

        } catch (e) {
            return url;
        }
    }


    /* =========================================================
     * 3. ПАРСИНГ HTML КАТАЛОГА ANISTAR
     * =========================================================
     *
     * Получаем HTML сайта и извлекаем:
     *
     * - название аниме;
     * - ссылку на страницу;
     * - адрес постера;
     * - ссылку следующей страницы.
     *
     * Селекторы пока предусматривают несколько вариантов
     * HTML-разметки. После проверки в реальном Lampa их
     * можно будет уточнить.
     */

    function parsePage(html, pageUrl) {

        var doc = new DOMParser().parseFromString(
            String(html || ''),
            'text/html'
        );

        var results = [];
        var seen = {};

        // Возможные контейнеры карточек аниме.
        var cardSelectors = [
            '.shortstory',
            '.shortstory__item',
            '.anime-item',
            '.th-item',
            '.movie-item',
            '.poster-item',
            'article'
        ].join(',');

        var cards = doc.querySelectorAll(cardSelectors);


        /*
         * Если основные контейнеры не обнаружены,
         * пробуем определить карточки через изображения.
         */
        if (!cards.length) {

            var images = doc.querySelectorAll('a[href] img');
            var fallbackCards = [];

            Array.prototype.forEach.call(images, function (img) {

                var parent = img.closest('article, .item, li, div');

                if (
                    parent &&
                    fallbackCards.indexOf(parent) === -1
                ) {
                    fallbackCards.push(parent);
                }

            });

            cards = fallbackCards;

        }


        /*
         * Перебираем найденные карточки.
         */
        Array.prototype.forEach.call(cards, function (card) {

            var links = card.querySelectorAll('a[href]');

            var image = card.querySelector('img');

            var poster = '';


            /*
             * Получаем адрес постера.
             *
             * Проверяем варианты lazy loading:
             * data-src, data-original, data-lazy-src, src.
             */
            if (image) {

                poster =
                    image.getAttribute('data-src') ||
                    image.getAttribute('data-original') ||
                    image.getAttribute('data-lazy-src') ||
                    image.getAttribute('data-original-src') ||
                    image.getAttribute('src') ||
                    '';

                poster = absoluteUrl(poster, pageUrl);

            }


            var chosenLink = null;
            var title = '';


            /*
             * Ищем ссылку с названием аниме.
             *
             * Ссылки «Смотреть», «Подробнее» и элементы
             * навигации не должны становиться карточками.
             */
            Array.prototype.forEach.call(links, function (link) {

                if (chosenLink) return;

                var href = absoluteUrl(
                    link.getAttribute('href'),
                    pageUrl
                );

                if (!href || !isAniStarUrl(href)) return;

                var linkText = cleanText(
                    link.getAttribute('title') ||
                    link.textContent
                );

                var imageAlt = link.querySelector('img')
                    ? cleanText(
                        link.querySelector('img').getAttribute('alt')
                    )
                    : '';

                var candidateTitle = linkText || imageAlt;

                if (!candidateTitle) return;

                if (
                    /^(смотреть|подробнее|читать|перейти|»|›|следующая)$/i.test(candidateTitle)
                ) {
                    return;
                }

                if (
                    normalizeUrl(href) ===
                    normalizeUrl(BASE_URL)
                ) {
                    return;
                }

                if (/\/(?:page|index)\//i.test(href)) return;

                chosenLink = link;

                title = candidateTitle;

            });


            /*
             * Дополнительный поиск названия.
             *
             * Иногда заголовок располагается в h2/h3,
             * а ссылка находится внутри этого заголовка.
             */
            if (!chosenLink) {

                var heading = card.querySelector(
                    'h1,h2,h3,h4,.title,.name'
                );

                if (heading) {

                    var headingLink = heading.querySelector('a[href]');

                    if (headingLink) {

                        var headingHref = absoluteUrl(
                            headingLink.getAttribute('href'),
                            pageUrl
                        );

                        var headingText = cleanText(
                            heading.textContent
                        );

                        if (
                            isAniStarUrl(headingHref) &&
                            headingText
                        ) {

                            chosenLink = headingLink;

                            title = headingText;

                        }

                    }

                }

            }


            // Пропускаем неподходящие элементы.
            if (!chosenLink || !title) return;

            if (title.length < 2 || title.length > 200) return;


            // Получаем окончательную ссылку на аниме.
            var itemUrl = normalizeUrl(
                absoluteUrl(
                    chosenLink.getAttribute('href'),
                    pageUrl
                )
            );


            if (!itemUrl || seen[itemUrl]) return;


            // Исключаем очевидную рекламу и служебные ссылки.
            if (
                /^(новая крутая аниме игра|смотреть|подробнее)$/i.test(title)
            ) {
                return;
            }


            seen[itemUrl] = true;


            /*
             * Сохраняем найденное аниме.
             *
             * В дальнейшем сюда можно добавить:
             * year, genre, description, rating, episodes.
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

                    text === 'далее';


                if (!isNext) return false;


                var candidate = absoluteUrl(
                    link.getAttribute('href'),
                    pageUrl
                );


                if (!candidate || !isAniStarUrl(candidate)) {
                    return false;
                }

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


        // Сетевой класс Lampa.
        var network = new Lampa.Reguest();


        // Штатный компонент прокрутки.
        var scroll = new Lampa.Scroll({

            mask: true,

            over: true

        });


        // Корневой контейнер каталога.
        var root = $(
            '<div class="anistar-catalog"></div>'
        );


        // Контейнер пагинации.
        var footer = $(
            '<div class="anistar-catalog__footer"></div>'
        );


        // Кнопка загрузки следующих страниц.
        var moreButton = $(
            '<div class="selector anistar-catalog__more">Загрузить ещё</div>'
        );


        // URL первой страницы.
        var pageUrl = object && object.page_url
            ? object.page_url
            : BASE_URL;


        // Уже загруженные тайтлы.
        var loaded = {};


        var destroyed = false;

        var loading = false;

        var nextUrl = '';

        var pageNumber = 1;


        /*
         * Формирование URL запроса.
         *
         * Если PROXY_URL пустой, используем прямой адрес сайта.
         * Если указан прокси, передаём ему исходный URL.
         */
        function requestUrl(url) {

            if (!PROXY_URL) return url;

            return PROXY_URL + encodeURIComponent(url);

        }


        /*
         * Вывод уведомления об ошибке.
         */
        function showError(message) {

            if (destroyed) return;

            self.activity.loader(false);

            Lampa.Noty.show(

                message || 'Не удалось загрузить каталог AniStar',

                {
                    style: 'error',
                    time: 7000
                }

            );

        }


        /* =====================================================
         * 6. СОЗДАНИЕ КАРТОЧКИ АНИМЕ
         * ===================================================== */

        function addCard(item) {

            var card = $(
                '<div class="card card--small selector anistar-card"></div>'
            );

            var view = $(
                '<div class="card__view"></div>'
            );

            var title = $(
                '<div class="card__title"></div>'
            );


            // Если постер найден, добавляем изображение.
            if (item.poster) {

                var img = $(
                    '<img class="card__img" loading="lazy">'
                );

                img.attr('src', item.poster);

                img.attr('alt', item.title);

                view.append(img);

            }

            else {

                view.addClass(
                    'anistar-card__no-poster'
                );

            }


            // Добавляем название.
            title.text(item.title);


            // Формируем карточку.
            card.append(view);

            card.append(title);


            /*
             * Пока открытие страниц аниме не реализовано.
             *
             * На следующем этапе здесь будет открываться
             * полноценная карточка тайтла с описанием и сериями.
             */
            card.on('hover:enter', function () {

                Lampa.Noty.show(
                    'Страница тайтла будет добавлена на следующем этапе'
                );

            });


            // Добавляем карточку в штатную прокрутку.
            scroll.append(card);

        }


        /* =====================================================
         * 7. ОТОБРАЖЕНИЕ СТРАНИЦЫ КАТАЛОГА
         * ===================================================== */

        function renderPage(data) {

            if (destroyed) return;

            self.activity.loader(false);

            loading = false;


            var added = 0;


            /*
             * Добавляем найденные аниме.
             * Повторно уже загруженные карточки не добавляем.
             */
            data.results.forEach(function (item) {

                if (!item.url || loaded[item.url]) return;

                loaded[item.url] = true;

                addCard(item);

                added++;

            });


            // Сохраняем адрес следующей страницы.
            nextUrl = data.next || '';


            /*
             * Если ни одного тайтла не найдено,
             * показываем диагностическое сообщение.
             */
            if (!Object.keys(loaded).length) {

                showError(
                    'HTML AniStar получен, но карточки не распознаны. ' +
                    'Нужно уточнить CSS-селекторы сайта.'
                );

                return;

            }


            /*
             * Добавляем блок пагинации только один раз.
             */
            if (!footer.parent().length) {

                footer.append(moreButton);

                scroll.append(footer);

            }


            if (nextUrl) {

                moreButton.show();

                moreButton.text('Загрузить ещё');

            }

            else {

                moreButton.hide();

                if (!added) {
                    Lampa.Noty.show('Больше тайтлов не найдено');
                }

            }

        }


        /* =====================================================
         * 8. ЗАГРУЗКА HTML САЙТА ANISTAR
         * ===================================================== */

        function load(url) {

            if (loading || destroyed || !url) return;

            loading = true;

            self.activity.loader(true);


            /*
             * ВАЖНО!
             *
             * Сигнатура Lampa.Reguest.native:
             *
             * native(
             *     url,
             *     success,
             *     error,
             *     postData,
             *     settings
             * )
             *
             * Для GET запроса postData = false.
             * Настройки dataType и timeout передаются пятым аргументом.
             */

            network.native(

                requestUrl(url),


                /*
                 * УСПЕШНАЯ ЗАГРУЗКА
                 */
                function (html) {

                    if (destroyed) return;

                    try {

                        if (typeof html !== 'string') {
                            html = String(html || '');
                        }


                        // Проверяем, что сервер действительно вернул HTML.
                        if (!html || html.length < 100) {

                            loading = false;

                            showError(
                                'AniStar вернул пустой или слишком короткий ответ'
                            );

                            return;

                        }


                        // Парсим полученный HTML.
                        var parsed = parsePage(html, url);


                        pageNumber++;


                        // Отображаем найденные карточки.
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


                /*
                 * ОШИБКА СЕТЕВОГО ЗАПРОСА
                 */
                function (xhr, error) {

                    loading = false;

                    if (destroyed) return;


                    self.activity.loader(false);


                    var status = xhr && xhr.status
                        ? xhr.status
                        : 0;

                    var reason = '';


                    // Получаем подробное описание ошибки Lampa.
                    if (network.errorDecode) {

                        try {

                            reason = network.errorDecode(
                                xhr,
                                error
                            );

                        }

                        catch (e) {}

                    }


                    // Диагностическая информация для разработчика.
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
                     * Это также может быть:
                     * - ошибка DNS;
                     * - проблема TLS/SSL;
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


                // Четвёртый аргумент: POST-данные. Для GET — false.
                false,


                // Пятый аргумент: настройки запроса.
                {
                    dataType: 'text',
                    timeout: 20000
                }

            );

        }


        /* =====================================================
         * 9. ПАГИНАЦИЯ
         * ===================================================== */

        moreButton.on('hover:enter', function () {

            if (!nextUrl || loading) return;

            moreButton.text('Загрузка...');

            load(nextUrl);

        });


        /* =====================================================
         * 10. ЖИЗНЕННЫЙ ЦИКЛ КОМПОНЕНТА
         * ===================================================== */

        // Создание компонента.
        this.create = function () {

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
     * 11. ДОБАВЛЕНИЕ ПУНКТА В ЛЕВОЕ МЕНЮ LAMPA
     * ========================================================= */

    function addMenuItem() {

        // Находим основной список меню.
        var menu = $('.menu .menu__list').eq(0);


        if (!menu.length) {

            console.warn(
                '[AniStar] menu list not found'
            );

            return;

        }


        // Не допускаем дублирования пункта.
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
         * Нажатие на «Анистар».
         *
         * Открываем зарегистрированный компонент каталога.
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
     * 12. ИНИЦИАЛИЗАЦИЯ ПЛАГИНА
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


        // Добавляем пункт в меню.
        addMenuItem();


        console.log(
            '[AniStar] plugin initialized, version 0.2.0'
        );

    }


    /* =========================================================
     * 13. ОЖИДАНИЕ ГОТОВНОСТИ LAMPA
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
