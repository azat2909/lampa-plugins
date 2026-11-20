
/*!
 * ============================================================
 * AniStar — плагин каталога аниме для Lampa
 * ============================================================
 *
 * Версия: 0.1.1
 * Автор: AniStar Plugin
 *
 * Источник аниме:
 * https://anistar.org/anime/
 *
 * Назначение:
 * Добавляет в левое меню Lampa каталог «Анистар».
 * Загружает HTML сайта AniStar, извлекает названия и постеры
 * аниме и отображает их штатными карточками Lampa.
 *
 * ВАЖНО:
 * 1. Собственный интерфейс не создаётся.
 * 2. Используются компоненты и стили Lampa.
 * 3. Сайт не предоставляет API — данные извлекаются из HTML.
 * 4. Для работы запросов сайт должен разрешать CORS.
 *
 * ============================================================
 */

(function () {

    'use strict';

    /*
     * ========================================================
     * 1. ОСНОВНЫЕ НАСТРОЙКИ ПЛАГИНА
     * ========================================================
     */

    // Уникальный идентификатор плагина.
    // Используется при регистрации компонента и создании меню.
    var PLUGIN = 'anistar_catalog';

    // Флаг предотвращает повторную инициализацию плагина.
    // Нужен, чтобы при повторном подключении скрипта
    // не создавать несколько одинаковых пунктов меню.
    var READY_FLAG = 'plugin_anistar_catalog_ready';

    // Главная страница каталога AniStar.
    var BASE_URL = 'https://anistar.org/anime/';

    // Название каталога в левом меню Lampa.
    var PAGE_TITLE = 'Анистар';

    // Иконка пункта меню.
    // Используется SVG, чтобы не зависеть от внешних изображений.
    var ICON =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 ' +
        '10 10 0 0 0 0-20Zm-2.1 14.8V7.2L17 12l-7.1 4.8Z"/>' +
        '</svg>';


    // Проверяем, был ли плагин уже запущен.
    if (window[READY_FLAG]) return;

    // Запоминаем факт запуска.
    window[READY_FLAG] = true;


    /*
     * ========================================================
     * 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     * ========================================================
     */

    /**
     * Преобразует относительную ссылку в абсолютную.
     *
     * Например:
     * /uploads/poster.jpg
     *
     * Превращается в:
     * https://anistar.org/uploads/poster.jpg
     *
     * Это необходимо, поскольку сайт может возвращать
     * относительные адреса изображений и страниц.
     */
    function absoluteUrl(url) {

        try {
            return new URL(url, BASE_URL).href;
        }
        catch (e) {
            return '';
        }

    }


    /**
     * Очищает текст от лишних пробелов и переносов строк.
     *
     * HTML часто содержит форматирование и переносы.
     * Для названий карточек Lampa нужен чистый текст.
     */
    function cleanText(value) {

        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim();

    }


    /*
     * ========================================================
     * 3. ПАРСИНГ СТРАНИЦЫ ANISTAR
     * ========================================================
     *
     * Поскольку у AniStar нет открытого API,
     * получаем исходный HTML страницы и разбираем его.
     *
     * DOMParser позволяет работать с HTML как с DOM-деревом,
     * не отображая страницу сайта внутри интерфейса Lampa.
     *
     * ВАЖНО:
     * CSS-селекторы ниже являются предварительными.
     * Их необходимо сверить с реальной HTML-разметкой AniStar.
     */

    function parsePage(html, pageUrl) {

        // Преобразуем полученный HTML в DOM-документ.
        var doc = new DOMParser().parseFromString(
            html,
            'text/html'
        );

        // Здесь будут храниться найденные аниме.
        var results = [];

        // Объект для удаления повторяющихся ссылок.
        var seen = {};


        /*
         * Ищем ссылки на страницы аниме.
         *
         * Используем несколько вариантов селекторов,
         * поскольку структура сайта может меняться.
         *
         * При обнаружении реальной разметки AniStar
         * лучше оставить только точные селекторы карточек.
         */
        var anchors = doc.querySelectorAll(

            '.shortstory a[href], ' +
            '.shortstory__title a[href], ' +
            '.anime-item a[href], ' +
            '.th-item a[href], ' +
            'article a[href], ' +
            'a[href*="/anime/"]'

        );


        /*
         * Перебираем найденные ссылки.
         */
        Array.prototype.forEach.call(anchors, function (anchor) {

            // Получаем абсолютную ссылку на страницу аниме.
            var href = absoluteUrl(
                anchor.getAttribute('href')
            );


            // Пропускаем пустые ссылки и ссылки на другие сайты.
            if (!href || href.indexOf('anistar.org/') === -1) {
                return;
            }


            // Не добавляем ссылку на главную страницу каталога.
            if (
                href.replace(/\/+$/, '') ===
                BASE_URL.replace(/\/+$/, '')
            ) {
                return;
            }


            // Исключаем ссылки пагинации.
            if (/\/anime\/(?:page\/)?\d+\/?$/.test(href)) {
                return;
            }


            /*
             * Получаем название аниме.
             *
             * Сначала проверяем атрибут title.
             * Если его нет, используем текст ссылки.
             * В качестве последнего варианта используем alt картинки.
             */
            var title = cleanText(

                anchor.getAttribute('title') ||
                anchor.textContent ||
                (
                    anchor.querySelector('img') &&
                    anchor.querySelector('img').getAttribute('alt')
                )

            );


            /*
             * Определяем родительский контейнер карточки.
             *
             * Из него будем получать постер.
             */
            var card = anchor.closest(

                '.shortstory, ' +
                '.shortstory__item, ' +
                '.anime-item, ' +
                '.th-item, ' +
                'article, ' +
                '.item'

            ) || anchor.parentElement;


            // Ищем изображение внутри карточки.
            var image = card && card.querySelector('img');

            var poster = '';


            /*
             * Получаем адрес постера.
             *
             * Многие сайты используют lazy loading.
             * Поэтому проверяем несколько атрибутов:
             *
             * data-src      — отложенная загрузка;
             * data-original — оригинальный адрес;
             * src           — обычный адрес изображения.
             */
            if (image) {

                poster =
                    image.getAttribute('data-src') ||
                    image.getAttribute('data-original') ||
                    image.getAttribute('src') ||
                    '';

                poster = absoluteUrl(poster);

            }


            // Не добавляем пустые или слишком длинные названия.
            if (!title || title.length < 2 || title.length > 180) {
                return;
            }


            // Исключаем служебные ссылки, которые не являются аниме.
            if (
                /^(смотреть|подробнее|аниме|новинки|жанры|следующая|предыдущая)$/i.test(title)
            ) {

                // Если у изображения есть alt, используем его.
                if (image && image.getAttribute('alt')) {

                    title = cleanText(
                        image.getAttribute('alt')
                    );

                }
                else {
                    return;
                }

            }


            // Исключаем повторяющиеся страницы.
            if (seen[href]) return;

            seen[href] = true;


            /*
             * Сохраняем найденное аниме.
             *
             * Структура объекта:
             *
             * id     — уникальный идентификатор;
             * title  — название;
             * name   — дополнительное поле с названием;
             * url    — ссылка на страницу аниме;
             * poster — адрес постера.
             *
             * В дальнейшем сюда можно добавить:
             * year, genre, description, rating, episodes.
             */
            results.push({

                id: href,

                title: title,

                name: title,

                url: href,

                poster: poster

            });

        });


        /*
         * ====================================================
         * 4. ПОИСК СЛЕДУЮЩЕЙ СТРАНИЦЫ
         * ====================================================
         *
         * Ищем ссылку «Следующая страница».
         *
         * Не формируем URL вручную, поскольку структура
         * пагинации должна определяться самим сайтом.
         */

        var nextUrl = '';

        var pageLinks = doc.querySelectorAll(

            '.navigation a[href], ' +
            '.pagination a[href], ' +
            '.pages a[href], ' +
            'a[href]'

        );


        Array.prototype.some.call(pageLinks, function (link) {

            // Текст ссылки.
            var label = cleanText(
                link.textContent
            ).toLowerCase();

            // Атрибут rel.
            var rel = (
                link.getAttribute('rel') || ''
            ).toLowerCase();

            // CSS-класс ссылки.
            var cls = (
                link.className || ''
            ).toString().toLowerCase();


            /*
             * Проверяем возможные обозначения следующей страницы.
             */
            if (

                rel === 'next' ||

                /next|стрелк|следующ/.test(cls) ||

                label === '»' ||
                label === '›' ||
                label === 'далее' ||
                label === 'следующая' ||
                label === 'следующая страница'

            ) {

                var candidate = absoluteUrl(
                    link.getAttribute('href')
                );


                // Проверяем, что ссылка относится к AniStar.
                if (

                    candidate &&
                    candidate.indexOf('anistar.org/') !== -1 &&
                    candidate !== pageUrl

                ) {

                    nextUrl = candidate;

                    return true;

                }

            }

            return false;

        });


        /*
         * Возвращаем результат парсинга.
         *
         * results — список найденных аниме;
         * next    — адрес следующей страницы.
         */
        return {

            results: results,

            next: nextUrl

        };

    }


    /*
     * ========================================================
     * 5. КОМПОНЕНТ КАТАЛОГА ANISTAR
     * ========================================================
     *
     * Компонент отвечает за отображение каталога.
     *
     * Здесь НЕ создаётся собственный полноценный интерфейс.
     * Используются штатные средства Lampa:
     *
     * Lampa.Scroll — прокрутка каталога;
     * Lampa.Reguest — сетевые запросы;
     * Lampa.Noty — уведомления;
     * Lampa.Activity — управление активностью.
     */

    function AniStarCatalog(object) {

        var self = this;


        /*
         * Создаём сетевой объект Lampa.
         *
         * Через него будем загружать HTML страниц AniStar.
         */
        var network = new Lampa.Reguest();


        /*
         * Создаём штатный компонент прокрутки Lampa.
         *
         * mask — маска прокрутки;
         * over — разрешение прокрутки содержимого.
         */
        var scroll = new Lampa.Scroll({

            mask: true,

            over: true

        });


        // Корневой контейнер компонента.
        var root = $(
            '<div class="anistar-catalog"></div>'
        );


        /*
         * Получаем URL страницы.
         *
         * Если пользователь открыл каталог впервые,
         * используем BASE_URL.
         *
         * В дальнейшем это позволит открывать другие страницы
         * каталога через параметры активности.
         */
        var pageUrl = object && object.page_url
            ? object.page_url
            : BASE_URL;


        // Хранилище уже добавленных карточек.
        var loaded = {};


        // Флаг уничтожения компонента.
        var destroyed = false;


        // Флаг активной загрузки.
        var loading = false;


        // URL следующей страницы каталога.
        var nextUrl = '';


        // Текущая страница.
        var pageNumber = 1;


        // Контейнер кнопки загрузки следующей страницы.
        var footer = $(
            '<div class="anistar-catalog__footer"></div>'
        );


        /*
         * ====================================================
         * 6. ОБРАБОТКА ОШИБОК
         * ====================================================
         *
         * Показываем сообщение пользователю,
         * если каталог не удалось загрузить.
         */

        function showError(message) {

            if (destroyed) return;

            // Отключаем индикатор загрузки.
            self.activity.loader(false);


            // Показываем уведомление Lampa.
            Lampa.Noty.show(

                message || 'Не удалось загрузить каталог AniStar',

                {
                    style: 'error',
                    time: 5000
                }

            );

        }


        /*
         * ====================================================
         * 7. СОЗДАНИЕ КАРТОЧКИ АНИМЕ
         * ====================================================
         *
         * Каждое найденное аниме отображается
         * штатной карточкой Lampa.
         *
         * В этой версии карточка пока не открывает страницу аниме.
         * Следующий этап — создание страницы подробной информации.
         */

        function addCard(item) {

            // Создаём карточку.
            var card = $(
                '<div class="card card--small selector anistar-card"></div>'
            );


            // Контейнер изображения.
            var view = $(
                '<div class="card__view"></div>'
            );


            // Элемент постера.
            var img = $(
                '<img class="card__img" loading="lazy">'
            );


            // Элемент названия.
            var title = $(
                '<div class="card__title"></div>'
            );


            /*
             * Если постер найден, устанавливаем его адрес.
             * Если постера нет, добавляем класс-заглушку.
             */
            if (item.poster) {

                img.attr('src', item.poster);

            }
            else {

                view.addClass(
                    'anistar-card__no-poster'
                );

            }


            // Записываем название аниме.
            title.text(item.title);


            // Собираем структуру карточки.
            view.append(img);

            card.append(view);

            card.append(title);


            /*
             * ОБРАБОТЧИК НАЖАТИЯ НА КАРТОЧКУ.
             *
             * Пока показываем уведомление.
             *
             * В дальнейшем здесь будет:
             * 1. Загрузка страницы выбранного аниме.
             * 2. Получение описания и характеристик.
             * 3. Получение списка серий.
             * 4. Получение ссылок на видеопотоки.
             * 5. Передача видео штатному плееру Lampa.
             */
            card.on('hover:enter', function () {

                Lampa.Noty.show(
                    'Открытие тайтла будет добавлено на следующем этапе'
                );

            });


            // Добавляем карточку в штатную прокрутку Lampa.
            scroll.append(card);

        }


        /*
         * ====================================================
         * 8. ОТОБРАЖЕНИЕ ПОЛУЧЕННОЙ СТРАНИЦЫ
         * ====================================================
         *
         * Получаем результат parsePage().
         * Добавляем новые карточки в каталог.
         * Проверяем наличие следующей страницы.
         */

        function renderPage(data, requestedUrl) {

            if (destroyed) return;


            // Скрываем индикатор загрузки.
            self.activity.loader(false);

            loading = false;


            // Если аниме не найдены, показываем пустое состояние.
            if (
                !data.results.length &&
                pageNumber === 1
            ) {

                self.activity.empty();

                return;

            }


            /*
             * Перебираем найденные тайтлы.
             *
             * Проверка loaded предотвращает повторное
             * добавление карточек при загрузке следующих страниц.
             */
            data.results.forEach(function (item) {

                if (loaded[item.url]) return;

                loaded[item.url] = true;

                addCard(item);

            });


            // Сохраняем URL следующей страницы.
            nextUrl = data.next || '';


            // Очищаем нижний блок.
            footer.empty();


            /*
             * Если найдена следующая страница,
             * создаём элемент «Загрузить ещё».
             */
            if (nextUrl) {

                var more = $(

                    '<div class="selector anistar-catalog__more">' +
                    'Загрузить ещё' +
                    '</div>'

                );


                /*
                 * При нажатии загружаем следующую страницу.
                 */
                more.on('hover:enter', function () {

                    load(nextUrl);

                });


                footer.append(more);

                scroll.append(footer);

            }

            else if (!data.results.length) {

                Lampa.Noty.show(
                    'Больше тайтлов не найдено'
                );

            }

        }


        /*
         * ====================================================
         * 9. ЗАГРУЗКА СТРАНИЦЫ ANISTAR
         * ====================================================
         *
         * Основная функция сетевого взаимодействия.
         *
         * Последовательность:
         *
         * 1. Проверяем возможность загрузки.
         * 2. Показываем индикатор.
         * 3. Загружаем HTML через Lampa.Reguest.
         * 4. Передаём HTML в parsePage().
         * 5. Отображаем найденные карточки.
         */

        function load(url) {

            // Не допускаем параллельную загрузку.
            if (loading || destroyed || !url) return;


            loading = true;


            // Включаем индикатор загрузки Lampa.
            self.activity.loader(true);


            /*
             * Выполняем запрос.
             *
             * Первый callback — успешная загрузка.
             * Второй callback — ошибка запроса.
             */
            network.native(

                url,


                /*
                 * УСПЕШНЫЙ ОТВЕТ
                 */
                function (html) {

                    if (destroyed) return;

                    try {

                        // Разбираем полученный HTML.
                        var parsed = parsePage(html, url);


                        /*
                         * Если на первой странице ничего не найдено,
                         * сообщаем об ошибке структуры парсера.
                         */
                        if (

                            !parsed.results.length &&
                            pageNumber === 1

                        ) {

                            self.activity.loader(false);

                            loading = false;

                            showError(
                                'Не удалось распознать список аниме на AniStar'
                            );

                            return;

                        }


                        // Увеличиваем номер страницы.
                        pageNumber++;


                        // Передаём результат в функцию отображения.
                        renderPage(parsed, url);

                    }

                    catch (e) {

                        loading = false;

                        showError(
                            'Ошибка разбора каталога AniStar'
                        );

                    }

                },


                /*
                 * ОШИБКА ЗАПРОСА
                 */
                function (xhr, error) {

                    loading = false;

                    if (destroyed) return;


                    // Отключаем индикатор.
                    self.activity.loader(false);


                    // Стандартное сообщение об ошибке.
                    var reason = 'Проверьте подключение к AniStar';


                    /*
                     * Пытаемся получить подробную ошибку
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


                    /*
                     * CORS:
                     *
                     * Если браузер запрещает запросы к AniStar
                     * с домена Lampa, напрямую получить HTML
                     * не получится.
                     *
                     * В этом случае потребуется серверный прокси.
                     */
                    showError(

                        'AniStar: ' + reason +
                        '. Возможно, сайт блокирует запросы из Lampa (CORS).'

                    );

                },


                // Дополнительный параметр Lampa.Reguest.
                false,


                // Параметры запроса.
                {
                    dataType: 'text',
                    timeout: 15000
                }

            );

        }


        /*
         * ====================================================
         * 10. ЖИЗНЕННЫЙ ЦИКЛ КОМПОНЕНТА LAMPA
         * ====================================================
         *
         * Lampa использует методы create, render, start,
         * stop и destroy для управления компонентами.
         */


        /*
         * CREATE
         *
         * Вызывается при создании компонента.
         * Создаём прокрутку и запускаем загрузку каталога.
         */
        this.create = function () {

            root.append(
                scroll.render()
            );


            // Загружаем первую страницу AniStar.
            load(pageUrl);


            // Возвращаем HTML-компонент.
            return this.render();

        };


        /*
         * RENDER
         *
         * Возвращает корневой контейнер компонента.
         */
        this.render = function () {

            return root;

        };


        /*
         * START
         *
         * Вызывается при активации компонента.
         * Здесь в дальнейшем можно разместить
         * дополнительную логику обновления каталога.
         */
        this.start = function () {};


        /*
         * STOP
         *
         * Вызывается при временном уходе с компонента.
         */
        this.stop = function () {};


        /*
         * DESTROY
         *
         * Вызывается при окончательном закрытии компонента.
         *
         * Важно очищать сетевые запросы и элементы интерфейса,
         * чтобы не создавать утечки памяти.
         */
        this.destroy = function () {

            destroyed = true;


            // Отменяем активные запросы.
            network.clear();


            // Уничтожаем компонент прокрутки.
            scroll.destroy();


            // Удаляем корневой элемент.
            root.remove();

        };


        /*
         * EMPTY
         *
         * Показывает стандартное пустое состояние Lampa.
         */
        this.empty = function () {

            self.activity.loader(false);

            self.activity.empty();

        };

    }


    /*
     * ========================================================
     * 11. ДОБАВЛЕНИЕ ПУНКТА «АНИСТАР» В ЛЕВОЕ МЕНЮ
     * ========================================================
     *
     * Используем существующее меню Lampa.
     * Новое меню не создаётся.
     *
     * Добавляем собственный пункт в список меню.
     */

    function addMenuItem() {


        /*
         * Находим основной список пунктов меню.
         *
         * Если меню ещё не создано, прекращаем выполнение.
         */
        var menu = $('.menu .menu__list').eq(0);


        if (!menu.length) return;


        // Проверяем, не был ли пункт добавлен ранее.
        if (
            menu.find('.' + PLUGIN + '__menu').length
        ) {
            return;
        }


        /*
         * Создаём пункт меню.
         *
         * Используем стандартные классы Lampa:
         *
         * menu__item — элемент меню;
         * selector   — поддержка навигации;
         * menu__ico   — контейнер иконки;
         * menu__text  — название пункта.
         */
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
         * ОБРАБОТЧИК НАЖАТИЯ НА «АНИСТАР».
         *
         * При нажатии открываем зарегистрированный компонент
         * через штатную систему Activity Lampa.
         */
        button.on('hover:enter', function () {

            Lampa.Activity.push({

                // URL внешнего источника здесь не используется.
                url: '',

                // Заголовок открываемого раздела.
                title: PAGE_TITLE,

                // Имя зарегистрированного компонента.
                component: PLUGIN,

                // Номер страницы.
                page: 1,

                // Адрес первой страницы каталога.
                page_url: BASE_URL

            });

        });


        // Добавляем пункт в существующее левое меню.
        menu.append(button);

    }


    /*
     * ========================================================
     * 12. ИНИЦИАЛИЗАЦИЯ ПЛАГИНА
     * ========================================================
     *
     * Здесь регистрируем компонент каталога
     * и добавляем пункт в левое меню.
     */

    function init() {


        /*
         * Проверяем наличие необходимых объектов Lampa.
         *
         * Если приложение ещё не готово,
         * регистрацию выполнять нельзя.
         */
        if (

            !window.Lampa ||
            !Lampa.Component ||
            !Lampa.Activity

        ) {
            return;
        }


        /*
         * Регистрируем компонент каталога.
         *
         * Lampa.Component.add:
         *
         * Первый аргумент — уникальное имя компонента.
         * Второй аргумент — функция-компонент.
         *
         * Проверка get() защищает от повторной регистрации.
         */
        if (!Lampa.Component.get(PLUGIN)) {

            Lampa.Component.add(

                PLUGIN,

                AniStarCatalog

            );

        }


        // Добавляем каталог в левое меню.
        addMenuItem();


        // Запись в консоль для диагностики.
        console.log(
            '[AniStar] catalog plugin initialized'
        );

    }


    /*
     * ========================================================
     * 13. ОЖИДАНИЕ ГОТОВНОСТИ LAMPA
     * ========================================================
     *
     * Плагин должен запускаться после инициализации приложения.
     *
     * appready — признак готовности Lampa.
     *
     * Если приложение уже готово, запускаем init().
     * Иначе подписываемся на событие ready.
     */

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


    /*
     * ========================================================
     * КОНЕЦ ПЛАГИНА ANISTAR
     * ========================================================
     */

})();
