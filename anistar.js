/*!
 * ============================================================
 * AniStar для Lampa
 * Версия: 0.4.24
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
    var READY_FLAG = 'anistar_0424_ready';

    var BASE_URL = 'https://anistar.org/anime/';
    var SITE_HOST = 'anistar.org';

    var PLUGIN_VERSION = '0.4.24';

    var PROXY_URL = '';

    var PAGE_SIZE = 100;

    if (window[READY_FLAG]) return;

    window[READY_FLAG] = true;


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

        '.anistar-episodes {',
        ' margin-top:1.5em;',
        ' display:flex;',
        ' flex-direction:column;',
        ' gap:.55em;',
        '}',
        '.anistar-episode {',
        ' padding:1em 1.2em;',
        ' border-radius:.4em;',
        ' background:rgba(255,255,255,.10);',
        '}',
        '.anistar-episode.focus {',
        ' background:rgba(255,255,255,.24);',
        ' outline:2px solid #fff;',
        '}',
        '.anistar-detail__status {',
        ' margin-top:1em;',
        ' opacity:.7;',
        '}',
        '.anistar-detail__link {',
        ' margin-top:1.5em;',
        ' padding:1em;',
        ' background:rgba(255,255,255,.12);',
        ' border-radius:.4em;',
        ' width:max-content;',
        '}',
        '.anistar-detail__link.focus {',
        ' background:rgba(255,255,255,.30);',
        ' outline:3px solid rgba(255,255,255,.95);',
        ' outline-offset:2px;',
        ' color:#fff;',
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


    /*
     * Убираем только дату в конце названия, не затрагивая
     * номера сезонов, годов в названии и прочие цифры.
     */
    function cleanAnimeTitle(value) {
        return cleanText(value)
            .replace(/\s*[\[(]?(?:\d{2}[.\-/]\d{2}[.\-/]\d{4}|\d{4}[.\-/]\d{2}[.\-/]\d{2})[\])]?(?=\s*$)/, '')
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

                title: cleanAnimeTitle(title),

                name: cleanAnimeTitle(title),

                url: url,

                poster: getPoster(image, pageUrl)

            });

        });


        /*
         * Пагинация AniStar: страницы имеют числовые URL:
         * /anime/ и /anime/page/2/, /anime/page/3/ и т.д.
         * Старый поиск только по стрелке «Следующая» не находил
         * такие ссылки, поэтому здесь сначала ищем номер страницы.
         */
        var next = '';
        var currentPage = 1;

        try {
            var currentPath = new URL(pageUrl).pathname;
            var currentMatch = currentPath.match(/\/anime\/page\/(\d+)\/?$/i);
            if (currentMatch) currentPage = parseInt(currentMatch[1], 10) || 1;
        } catch (e) {}

        var pagination = doc.querySelectorAll(
            '.navigation a[href], .pagination a[href], .pages a[href], ' +
            '.paginator a[href], .nav-links a[href], a[rel~="next"], a[href]'
        );

        var numbered = [];
        var hasPageLinks = false;

        Array.prototype.forEach.call(pagination, function (link) {
            var href = absoluteUrl(link.getAttribute('href'), pageUrl);
            if (!href || !isAniStarUrl(href)) return;

            try {
                var parsedUrl = new URL(href);
                var match = parsedUrl.pathname.match(/\/anime\/page\/(\d+)\/?$/i);
                var pageNumber = match ? parseInt(match[1], 10) :
                    (/\/anime\/?$/i.test(parsedUrl.pathname) ? 1 : 0);

                if (pageNumber > 0) hasPageLinks = true;

                if (pageNumber > currentPage) {
                    numbered.push({ number: pageNumber, url: href });
                }
            } catch (e) {}
        });

        numbered.sort(function (a, b) {
            return a.number - b.number;
        });

        if (numbered.length) {
            // Берём именно следующую страницу, если она есть.
            var expected = numbered.filter(function (item) {
                return item.number === currentPage + 1;
            })[0];
            next = (expected || numbered[0]).url;
        }

        // На AniStar используется стандартный путь /anime/page/N/.
        // Если шаблон страницы не отдал ссылку в DOM, строим адрес
        // следующей страницы самостоятельно, не останавливая каталог.
        if (!next && !hasPageLinks) {
            try {
                var basePath = new URL(BASE_URL).origin + '/anime/';
                next = basePath + 'page/' + (currentPage + 1) + '/';
            } catch (e) {}
        }

        // Резервный вариант для пагинации со стрелкой/текстом.
        if (!next) {
            Array.prototype.some.call(pagination, function (link) {
                var text = cleanText(link.textContent).toLowerCase();
                var rel = (link.getAttribute('rel') || '').toLowerCase();
                var cls = (link.className || '').toString().toLowerCase();
                var isNext = rel.indexOf('next') !== -1 ||
                    /next|следующ|далее/.test(cls) ||
                    /следующ|далее/.test(text) || text === '»' || text === '›';
                if (!isNext) return false;

                var href = absoluteUrl(link.getAttribute('href'), pageUrl);
                if (!href || !isAniStarUrl(href)) return false;
                if (normalizeUrl(href) === normalizeUrl(pageUrl)) return false;
                next = href;
                return true;
            });
        }

        return {
            items: items,
            next: next
        };

    }


    
/* =========================================================
 * 6. СЕТЕВОЙ ЗАПРОС — ИСПРАВЛЕННАЯ ВЕРСИЯ
 * =========================================================
 *
 * ВАЖНО:
 * Не используем request.get().
 *
 * В некоторых сборках Lampa Request.get() вызывает
 * необъявленную функцию clear(), что приводит к ошибке:
 *
 * ReferenceError: clear is not defined
 *
 * Используем request.native(), который поддерживает
 * Android TV и не вызывает проблемный метод get().
 */

function AniStarNetwork() {

    // Создаём штатный сетевой объект Lampa.
    var request = new Lampa.Reguest();


    /*
     * GET-запрос к AniStar.
     */
    this.get = function (url, success, error) {

        // Если задан прокси, используем его.
        var target = PROXY_URL
            ? PROXY_URL + encodeURIComponent(url)
            : url;


        /*
         * Используем native вместо get.
         *
         * Аргументы:
         * 1. URL;
         * 2. Успешный callback;
         * 3. Callback ошибки;
         * 4. POST-данные (false для GET);
         * 5. Настройки запроса.
         */
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
     * Отмена активных запросов.
     *
     * Здесь clear вызывается правильно:
     * через экземпляр request.
     */
    this.clear = function () {

        if (request && typeof request.clear === 'function') {
            request.clear();
        }

    };

}



    /* =========================================================
     * 7. КОМПОНЕНТ КАТАЛОГА
     * ========================================================= */

    function AniStarCatalog(object) {

        var self = this;

        var network = new AniStarNetwork();

        // Штатный скролл Lampa: на Android TV он прокручивает контент
        // через translate3d, а не через window.scrollIntoView().
        var scroll = new Lampa.Scroll({ mask: true, over: true });

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


        root.append(grid);
        scroll.append(root);


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

                var card = createCard(item);
                card.on('hover:focus', function () {
                    // Lampa меняет focus-класс, но для произвольной DOM-сетки
                    // не всегда прокручивает Activity вместе с ним.
                    // Явно держим сфокусированную карточку в видимой области.
                    scrollCardIntoView(this);
                    maybeLoadNext(this);
                });
                grid.append(card);

            });

        }


        /* =====================================================
         * 10. АВТОПОДГРУЗКА И УПРАВЛЕНИЕ ПУЛЬТОМ
         * ===================================================== */

        var controller = null;
        var lastAutoLoadCount = -1;

        function scrollCardIntoView(card) {
            if (!card) return;

            try {
                // Lampa.Scroll сам рассчитывает позицию карточки внутри
                // .scroll__body и на TV двигает её через transform.
                if (scroll && typeof scroll.update === 'function') {
                    scroll.update(card);
                }
            } catch (e) {
                console.warn('[AniStar] Scroll update:', e);
            }
        }

        function refreshCollection(keepFocus) {
            if (!window.Lampa || !Lampa.Controller) return;
            try {
                // Сохраняем DOM-элемент до сброса коллекции:
                // Controller.clear() может снять с него класс focus.
                var current = keepFocus ? root.find('.anistar-card.focus').first() : $();
                if (!current.length) current = root.find('.anistar-card').first();

                // Обновляем коллекцию без глобального Controller.clear():
                // clear() в разных сборках Lampa может сбросить весь контекст
                // навигации, из-за чего пульт перестаёт управлять карточками.
                Lampa.Controller.collectionSet(root);

                if (current.length) {
                    Lampa.Controller.collectionFocus(current[0], root);
                }
            } catch (e) {
                console.warn('[AniStar] Collection refresh:', e);
            }
        }

        function maybeLoadNext(card) {
            if (!nextUrl || loading || destroyed) return;
            var index = grid.children('.anistar-card').index(card);
            // Начинаем подгружать, когда фокус дошёл до последних 12 карточек.
            if (index >= 0 && index >= grid.children('.anistar-card').length - 12 &&
                lastAutoLoadCount !== items.length) {
                lastAutoLoadCount = items.length;
                load(nextUrl);
            }
        }

        function getNavigator() {
            // В Lampa Navigator доступен как глобальный объект,
            // а не во всех сборках как Lampa.Navigator.
            return window.Navigator || (window.Lampa && Lampa.Navigator) || null;
        }

        function createController() {
            if (!window.Lampa || !Lampa.Controller) return;

            controller = {
                link: this,
                toggle: function () {
                    try {
                        Lampa.Controller.collectionSet(root);
                        var first = root.find('.anistar-card').first();
                        if (first.length) Lampa.Controller.collectionFocus(first[0], root);
                    } catch (e) {}
                },
                left: function () {
                    var nav = getNavigator();
                    if (nav && nav.canmove && nav.canmove('left')) nav.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                up: function () {
                    var nav = getNavigator();
                    if (nav && nav.canmove && nav.canmove('up')) nav.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () {
                    var nav = getNavigator();
                    if (nav && nav.move) nav.move('down');
                },
                right: function () {
                    var nav = getNavigator();
                    if (nav && nav.move) nav.move('right');
                },
                back: function () { Lampa.Activity.backward(); }
            };

            Lampa.Controller.add('content', controller);
            Lampa.Controller.toggle('content');
        }


        /* =====================================================
         * 11. ЗАГРУЗКА КАТАЛОГА
         * ===================================================== */

        function load(url) {

            if (loading || destroyed || !url) return;

            loading = true;

            // Полноэкранный loader нужен только при первом открытии.
            // При догрузке он перекрывает каталог и мешает навигации пультом.
            var initialLoad = items.length === 0;
            if (initialLoad) self.activity.loader(true);


            network.get(

                url,


                function (html) {

                    if (destroyed) return;

                    loading = false;

                    if (initialLoad) self.activity.loader(false);


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


                        // Сохраняем URL следующей страницы.
                        nextUrl = parsed.next || '';

                        // Обновляем коллекцию Lampa после добавления карточек.
                        refreshCollection(true);


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

                    // Разрешаем повторную попытку при следующем достижении края.
                    lastAutoLoadCount = -1;
                    if (initialLoad) self.activity.loader(false);

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
         * 12. ЖИЗНЕННЫЙ ЦИКЛ КАТАЛОГА
         * ===================================================== */

        this.create = function () {

            // Lampa.Scroll должен получить высоту области Activity.
            // Без minus() на TV viewport не рассчитывается корректно.
            scroll.minus();

            load(pageUrl);

            return this.render();

        };


        this.render = function () {
            return scroll.render();
        };


        this.start = function () {
            createController.call(this);
        };


        this.stop = function () {};


        this.destroy = function () {

            destroyed = true;

            if (window.Lampa && Lampa.Controller) {
                try { Lampa.Controller.remove('content'); } catch (e) {}
            }

            network.clear();

            scroll.destroy();
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

    /*
     * Удаляем HTML-сущности и экранирование, которые AniStar
     * использует в JS-массиве потоков.
     */
    function decodePlayerText(value) {
        var text = String(value || '').split('\\/').join('/');
        var node = document.createElement('textarea');
        node.innerHTML = text;
        return node.value;
    }


    /*
     * Извлекаем только HLS-потоки из Плеера AS.
     * files_as проверяется вместе с files: у AniStar часть
     * качеств в основном массиве содержит неочевидные URL.
     */
    function parseASPlaylist(html, playerUrl) {
        html = String(html || '').split('\n').join(' ').split('\r').join(' ');

        var starts = [];
        var entryPattern = /title:\s*"([^"]*)",\s*media_id:/g;
        var match;

        while ((match = entryPattern.exec(html))) {
            starts.push({
                index: match.index,
                title: decodePlayerText(match[1])
            });
        }

        var result = [];

        starts.forEach(function (entry, index) {
            var block = html.substring(
                entry.index,
                starts[index + 1] ? starts[index + 1].index : html.length
            );

            var all = [];

            [
                /(?:^|[^A-Za-z_])files:\s*\[([\s\S]*?)\]/,
                /files_as:\s*\[([\s\S]*?)\]/
            ].forEach(function (pattern) {
                var found = block.match(pattern);
                if (!found) return;

                var filePattern = /title:\s*"(\d+)",\s*file:\s*"([^"]+)"/g;
                var fileMatch;

                while ((fileMatch = filePattern.exec(found[1]))) {
                    var url = decodePlayerText(fileMatch[2])
                        .replace(/&amp;/g, '&')
                        .trim();

                    if (!url) continue;

                    all.push({
                        quality: parseInt(fileMatch[1], 10),
                        url: absoluteUrl(url, playerUrl),
                        hls: /\.m3u8(?:$|\?)/i.test(url)
                    });
                }
            });

            // Для каждого качества предпочитаем настоящий m3u8.
            var qualities = {};
            all.forEach(function (file) {
                if (!file.url || !/^https?:/i.test(file.url)) return;

                if (!qualities[file.quality] || (file.hls && !qualities[file.quality].hls)) {
                    qualities[file.quality] = file;
                }
            });

            var available = Object.keys(qualities).map(function (quality) {
                return qualities[quality];
            }).sort(function (a, b) {
                return b.quality - a.quality;
            });

            if (!available.length) return;

            var numberMatch = entry.title.match(/\d+/);
            var number = numberMatch ? parseInt(numberMatch[0], 10) : index + 1;

            result.push({
                number: number,
                title: entry.title || ('Серия ' + number),
                files: available
            });
        });

        result.sort(function (a, b) {
            return a.number - b.number;
        });

        return result;
    }


    function AniStarDetail(object) {
        var self = this;
        var network = new AniStarNetwork();
        var item = object.item || {};
        var destroyed = false;
        var loading = false;
        var episodes = [];
        var playerHeaders = null;

        var root = $('<div class="anistar-screen"></div>');
        var detail = $('<div class="anistar-detail"></div>');
        var poster = $('<div class="anistar-detail__poster"></div>');
        var info = $('<div class="anistar-detail__info"></div>');
        var title = $('<div class="anistar-detail__title"></div>');
        var description = $('<div class="anistar-detail__description"></div>');
        var watch = $('<div class="selector anistar-detail__link">Смотреть</div>');
        var status = $('<div class="anistar-detail__status"></div>');
        var episodeList = $('<div class="anistar-episodes"></div>');

        title.text(cleanAnimeTitle(item.title || 'Аниме'));
        description.text('Просмотр доступен через Плеер AS.');
        status.text('Нажми «Смотреть», чтобы загрузить список серий.');

        // Поддерживаем событие пульта Lampa и обычный click.
        watch.on('hover:enter click', function () {
            loadEpisodes();
        });

        if (item.poster) {
            var image = $('<img>');
            image.attr('src', item.poster);
            poster.append(image);
        }

        info.append(title);
        info.append(description);
        info.append(watch);
        info.append(status);
        info.append(episodeList);
        detail.append(poster);
        detail.append(info);
        root.append(detail);


        function showError(message) {
            if (destroyed) return;
            status.text(message);
            Lampa.Noty.show(message);
        }


        function getASPlayerUrl(pageHtml) {
            var html = String(pageHtml || '');
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var candidates = [];

            /*
             * Разметка AniStar меняется: iframe AS не всегда находится
             * внутри .video_as#vid_2. Поэтому проверяем все iframe,
             * включая варианты с lazy-load атрибутами.
             */
            var frames = doc.querySelectorAll('iframe');
            Array.prototype.forEach.call(frames, function (frame) {
                var attrs = [
                    frame.getAttribute('src'),
                    frame.getAttribute('data-src'),
                    frame.getAttribute('data-lazy-src'),
                    frame.getAttribute('data-original')
                ];

                attrs.forEach(function (value) {
                    if (value && /videoas_p2p_new\.php/i.test(value)) {
                        candidates.push(value);
                    }
                });
            });

            /*
             * Резервный поиск непосредственно в исходном HTML:
             * помогает, если DOMParser не распознал нестандартную
             * или отложенно загружаемую разметку iframe.
             */
            if (!candidates.length) {
                var iframePattern = /<iframe\b[^>]*>/gi;
                var iframeMatch;

                while ((iframeMatch = iframePattern.exec(html))) {
                    var tag = iframeMatch[0];
                    var attrPattern = /(?:src|data-src|data-lazy-src|data-original)\s*=\s*(['"])(.*?)\1/ig;
                    var attrMatch;

                    while ((attrMatch = attrPattern.exec(tag))) {
                        if (/videoas_p2p_new\.php/i.test(attrMatch[2])) {
                            candidates.push(attrMatch[2]);
                        }
                    }
                }
            }

            /*
             * Последний резерв: адрес AS может находиться в HTML/скрипте,
             * не попадая в атрибут iframe после разбора DOM.
             */
            if (!candidates.length) {
                // В некоторых ответах URL iframe приходит как экранированная
                // строка скрипта или HTML-сущность, поэтому нормализуем копию.
                var searchable = html
                    .replace(/\\\\\//g, '/')
                    .replace(/&amp;/g, '&')
                    .replace(/&#38;/g, '&')
                    .replace(/\\\\u0026/gi, '&');

                // Важно: здесь именно \\s (пробельный символ), а не \\\\s.
                // Ищем URL AS независимо от того, находится он в iframe,
                // ссылке или JavaScript-переменной.
                var playerPattern = /[^"'<>\s]*videoas_p2p_new\.php[^"'<>\s]*/ig;
                var playerMatch;

                while ((playerMatch = playerPattern.exec(searchable))) {
                    candidates.push(playerMatch[0]);
                }
            }

            if (!candidates.length) {
                console.warn('[AniStar] AS iframe not found. HTML length:', html.length);
                return '';
            }

            var src = String(candidates[0])
                .replace(/&amp;/g, '&')
                .replace(/&#38;/g, '&')
                .replace(/\u0026/gi, '&')
                .trim();

            return absoluteUrl(src, item.url);
        }


        function renderEpisodes() {
            episodeList.empty();

            if (!episodes.length) {
                status.text('В Плеере AS не удалось найти доступные серии.');
                return;
            }

            status.text('Доступно серий: ' + episodes.length + '. Выбери серию.');

            episodes.forEach(function (episode) {
                var row = $('<div class="selector anistar-episode"></div>');
                var best = episode.files[0];

                row.text(
                    'Серия ' + episode.number +
                    (episode.title && !/^\s*\d+\s*$/.test(episode.title)
                        ? ' — ' + episode.title
                        : '') +
                    '  ·  ' + best.quality + 'p'
                );

                row.on('hover:enter', function () {
                    playEpisode(episode);
                });

                episodeList.append(row);
            });

            if (window.Lampa && Lampa.Controller) {
                try {
                    Lampa.Controller.collectionSet(episodeList);
                    var first = episodeList.find('.anistar-episode').first();
                    if (first.length) Lampa.Controller.collectionFocus(first[0], episodeList);
                } catch (e) {
                    console.warn('[AniStar] Episode focus:', e);
                }
            }
        }


        function playEpisode(episode) {
            if (!episode || !episode.files || !episode.files.length) {
                Lampa.Noty.show('Для этой серии нет доступного видеопотока.');
                return;
            }

            if (!window.Lampa || !Lampa.Player || typeof Lampa.Player.play !== 'function') {
                Lampa.Noty.show('В этой версии Lampa недоступен штатный видеоплеер.');
                return;
            }

            var files = {};
            episode.files.forEach(function (file) {
                files[file.quality + 'p'] = file.url;
            });

            var preferred = String(Lampa.Storage.get('video_quality_default', '1080')) + 'p';
            var selected = files[preferred] || episode.files[0].url;

            var playlist = episodes.map(function (entry) {
                var entryFiles = {};
                entry.files.forEach(function (file) {
                    entryFiles[file.quality + 'p'] = file.url;
                });

                var quality = String(Lampa.Storage.get('video_quality_default', '1080')) + 'p';

                return {
                    url: entryFiles[quality] || entry.files[0].url,
                    quality: entryFiles,
                    title: cleanAnimeTitle(item.title || 'Аниме') + ' / Серия ' + entry.number,
                    headers: playerHeaders || undefined
                };
            });

            var current = {
                url: selected,
                quality: files,
                title: cleanAnimeTitle(item.title || 'Аниме') + ' / Серия ' + episode.number,
                headers: playerHeaders || undefined,
                playlist: playlist.length > 1 ? playlist : undefined
            };

            console.log('[AniStar] Play AS episode:', episode.number, selected);
            Lampa.Player.play(current);
            if (typeof Lampa.Player.playlist === 'function') {
                Lampa.Player.playlist(playlist);
            }
        }


        function loadEpisodes() {
            if (loading || destroyed) return;
            loading = true;

            if (!item.url) {
                loading = false;
                showError('Не найдена ссылка на страницу аниме.');
                return;
            }

            network.get(item.url, function (pageHtml) {
                if (destroyed) return;

                var playerUrl = getASPlayerUrl(pageHtml);

                if (!playerUrl) {
                    loading = false;
                    showError('На странице не найден iframe Плеера AS.');
                    return;
                }

                // Поток AS может проверять Referer iframe-страницы.
                // Сохраняем заголовки для передачи дальше в выбранный Lampa-плеер.
                var userAgent = '';
                try {
                    userAgent = window.navigator && window.navigator.userAgent
                        ? window.navigator.userAgent
                        : '';
                } catch (e) {}

                playerHeaders = {
                    Referer: playerUrl,
                    Origin: 'https://anistar.org'
                };
                if (userAgent) playerHeaders['User-Agent'] = userAgent;

                network.get(playerUrl, function (playerHtml) {
                    if (destroyed) return;

                    episodes = parseASPlaylist(playerHtml, playerUrl);
                    loading = false;
                    renderEpisodes();
                }, function () {
                    loading = false;
                    showError('Не удалось загрузить данные Плеера AS.');
                });
            }, function () {
                loading = false;
                showError('Не удалось загрузить страницу AniStar.');
            });
        }


        this.create = function () {
            // Серии загружаются только после нажатия «Смотреть».
            return this.render();
        };

        this.render = function () {
            return root;
        };

        this.start = function () {
            if (!window.Lampa || !Lampa.Controller) return;

            try {
                // Для Activity недостаточно только collectionSet:
                // экрану нужен собственный контроллер content, как у каталога.
                var detailController = {
                    link: this,
                    toggle: function () {
                        Lampa.Controller.collectionSet(root);
                        Lampa.Controller.collectionFocus(watch[0], root);
                    },
                    left: function () {
                        var nav = window.Navigator || Lampa.Navigator;
                        if (nav && nav.canmove && nav.canmove('left')) nav.move('left');
                        else Lampa.Controller.toggle('menu');
                    },
                    right: function () {
                        var nav = window.Navigator || Lampa.Navigator;
                        if (nav && nav.move) nav.move('right');
                    },
                    up: function () {
                        var nav = window.Navigator || Lampa.Navigator;
                        if (nav && nav.canmove && nav.canmove('up')) nav.move('up');
                        else Lampa.Controller.toggle('head');
                    },
                    down: function () {
                        var nav = window.Navigator || Lampa.Navigator;
                        if (nav && nav.move) nav.move('down');
                    },
                    back: function () {
                        Lampa.Activity.backward();
                    }
                };

                Lampa.Controller.add('content', detailController);
                Lampa.Controller.toggle('content');
                Lampa.Controller.collectionSet(root);
                Lampa.Controller.collectionFocus(watch[0], root);
            } catch (e) {
                console.warn('[AniStar] Ошибка контроллера экрана:', e);
            }
        };

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

            console.warn(
                '[AniStar] Menu not found'
            );

            return;

        }


        // Защита от повторного добавления.
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
     * 15. ИСТОЧНИК ПОИСКА LAMPA
     * ========================================================= */

    var searchSourceRegistered = false;
    var searchNetwork = null;

    function addSearchSource() {
        if (searchSourceRegistered) return;

        if (!Lampa.Search || typeof Lampa.Search.addSource !== 'function') {
            console.warn('[AniStar] Lampa.Search.addSource is unavailable');
            return;
        }

        searchNetwork = new AniStarNetwork();

        Lampa.Search.addSource({
            title: 'AniStar',

            params: {
                lazy: false,
                align_left: true,
                card_view: 6,
                noimage: true,
                object: {
                    source: 'anistar'
                }
            },

            search: function (params, oncomplete) {
                var query = String(params && params.query || '').trim();

                // Lampa в некоторых сценариях передаёт query уже URL-кодированным.
                // Нормализуем его и кодируем ровно один раз, включая голосовой ввод.
                try {
                    query = decodeURIComponent(query.replace(/\+/g, '%20'));
                } catch (e) {}

                query = query.trim();

                if (!query) {
                    oncomplete([]);
                    return;
                }

                // DLE search endpoint is at the domain root, not inside /anime/.
                var searchUrl = new URL('/', BASE_URL).origin +
                    '/?do=search&mode=advanced&subaction=search&story=' +
                    encodeURIComponent(query);

                searchNetwork.get(searchUrl, function (html) {
                    try {
                        var parsed = parseCatalog(html, searchUrl);
                        var results = parsed.items.map(function (item) {
                            return {
                                id: item.url,
                                title: item.title,
                                name: item.title,
                                poster_path: item.poster || '',
                                poster: item.poster || '',
                                source: 'anistar',
                                anistar_url: item.url,
                                anistar_poster: item.poster || ''
                            };
                        });

                        console.log('[AniStar] Search completed:', query, results.length);

                        oncomplete(results.length ? [{
                            title: 'AniStar',
                            results: results,
                            page: 1,
                            total_pages: 1,
                            total_results: results.length
                        }] : []);
                    }
                    catch (e) {
                        console.error('[AniStar] Search parse error', e);
                        oncomplete([]);
                    }
                }, function (xhr, status) {
                    console.error('[AniStar] Search request failed:', status || xhr);
                    oncomplete([]);
                });
            },

            onCancel: function () {
                if (searchNetwork) searchNetwork.clear();
            },

            onSelect: function (event, done) {
                var selected = event && (event.item_data || event.element) || {};

                Lampa.Activity.push({
                    url: '',
                    title: selected.title || selected.name || 'AniStar',
                    component: 'anistar_detail',
                    page: 1,
                    item: {
                        id: selected.anistar_url || selected.id,
                        url: selected.anistar_url || selected.id,
                        title: selected.title || selected.name || 'Аниме',
                        name: selected.title || selected.name || 'Аниме',
                        poster: selected.anistar_poster || selected.poster || selected.poster_path || ''
                    }
                });

                if (typeof done === 'function') done();
            }
        });

        searchSourceRegistered = true;

        console.log('[AniStar] Search source registered');
    }


    /* =========================================================
     * 16. РЕГИСТРАЦИЯ КОМПОНЕНТОВ
     * ========================================================= */

    function init() {

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


        // Добавляем CSS.
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
        if (!Lampa.Component.get('anistar_detail')) {

            Lampa.Component.add(
                'anistar_detail',
                AniStarDetail
            );

        }


        // Добавляем пункт меню.
        addMenu();

        // Регистрируем AniStar как отдельный источник глобального поиска Lampa.
        addSearchSource();


        console.log(
            '[AniStar] Initialized. Version: ' +
            PLUGIN_VERSION
        );

    }


    /* =========================================================
     * 17. ЗАПУСК ПОСЛЕ ГОТОВНОСТИ LAMPA
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




