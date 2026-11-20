
/*!
 * ============================================================
 * AniStar для Lampa
 * Версия: 0.3.0 — исправленная
 * ============================================================
 *
 * Источник: https://anistar.org/anime/
 * Платформа: Lampa 3.x / Android TV
 *
 * Исправлено:
 * - Используется Lampa.Request.get().
 * - Флаг запуска устанавливается после инициализации.
 * - Улучшен поиск карточек, названий и постеров.
 * - Исправлена обработка ошибок и тайм-аутов.
 * - Добавлена защита от повторной загрузки.
 * - Исправлена работа Activity.
 * - Добавлена обработка пагинации.
 *
 * Воспроизведение видео через плеер Lampa пока не реализовано.
 * ============================================================
 */

(function () {
    'use strict';

    /* =========================================================
     * 1. НАСТРОЙКИ
     * ========================================================= */

    var PLUGIN_ID = 'anistar_catalog';
    var DETAIL_ID = 'anistar_detail';
    var READY_FLAG = 'anistar_030_ready';

    var BASE_URL = 'https://anistar.org/anime/';
    var SITE_HOST = 'anistar.org';

    var PLUGIN_VERSION = '0.3.0';

    // Пустое значение — запрос напрямую к AniStar.
    // Прокси можно добавить позднее, если потребуется.
    var PROXY_URL = '';

    // Тайм-аут ожидания ответа, миллисекунды.
    var REQUEST_TIMEOUT = 20000;

    if (window[READY_FLAG]) return;

    /* =========================================================
     * 2. СТИЛИ
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

        '.anistar-card.focus {',
        ' transform:scale(1.035);',
        ' z-index:2;',
        '}',

        '.anistar-card.focus .anistar-card__poster {',
        ' outline:3px solid #fff;',
        ' outline-offset:3px;',
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

        '.anistar-message {',
        ' padding:2em;',
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

        '.anistar-detail__link {',
        ' margin-top:1.5em;',
        ' padding:1em;',
        ' background:rgba(255,255,255,.12);',
        ' border-radius:.4em;',
        ' width:max-content;',
        '}',

        '@media (max-width:700px) {',
        ' .anistar-screen { padding:0 1em 2em; }',
        ' .anistar-grid {',
        '  grid-template-columns:repeat(3,minmax(0,1fr));',
        '  gap:1em .6em;',
        ' }',
        ' .anistar-detail { flex-direction:column; }',
        ' .anistar-detail__poster {',
        '  max-width:70%;',
        '  width:180px;',
        ' }',
        '}',

        '@media (min-width:1200px) {',
        ' .anistar-grid {',
        '  grid-template-columns:repeat(7,minmax(0,1fr));',
        ' }',
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
            var host = new URL(url).hostname.toLowerCase();

            return host === SITE_HOST ||
                host === 'www.' + SITE_HOST;
        } catch (e) {
            return false;
        }
    }

    /*
     * Формат страницы публикации AniStar:
     * /12345-nazvanie-anime.html
     */
    function isAnimeUrl(url) {
        try {
            var parsed = new URL(url);

            return isAniStarUrl(url) &&
                /^\/\d+-.+\.html$/i.test(parsed.pathname);
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
            image.getAttribute('data-image') ||
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

        if (!src || /^(data:|blob:)/i.test(src)) return '';

        return absoluteUrl(src, base);
    }

    /* =========================================================
     * 5. ПОИСК КОНТЕЙНЕРА КАРТОЧКИ
     * ========================================================= */

    function findCard(link) {
        var card = link.closest(
            '.shortstory, .base, .news, .item, ' +
            '.anime-item, .movie-item, article, li'
        );

        if (card) return card;

        var parent = link;

        for (var i = 0; i < 4; i++) {
            if (!parent || !parent.parentElement) break;

            parent = parent.parentElement;

            if (parent.querySelector('img')) {
                return parent;
            }
        }

        return link.parentElement || link;
    }

    /* =========================================================
     * 6. ПАРСИНГ КАТАЛОГА
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

            var card = findCard(link);

            var title = cleanText(
                link.getAttribute('title') ||
                link.textContent
            );

            var heading = card.querySelector(
                'h1,h2,h3,h4,.title,.name,.shortstory-title'
            );

            if ((!title || title.length < 2) && heading) {
                title = cleanText(heading.textContent);
            }

            var image =
                link.querySelector('img') ||
                card.querySelector('img');

            if ((!title || title.length < 2) && image) {
                title = cleanText(
                    image.getAttribute('alt') ||
                    image.getAttribute('title')
                );
            }

            if (!title || title.length < 2) return;
            if (title.length > 220) return;

            if (/^(смотреть|подробнее|читать|перейти|следующая)$/i.test(title)) {
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

        /* Поиск следующей страницы. */

        var next = '';

        var pagination = doc.querySelectorAll(
            '.navigation a[href], ' +
            '.pagination a[href], ' +
            '.pages a[href], ' +
            '.nav-links a[href], ' +
            'a[rel~="next"]'
        );

        Array.prototype.some.call(pagination, function (link) {
            var text = cleanText(link.textContent).toLowerCase();

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
        });

        // Дополнительно проверяем ссылку на следующий номер страницы.
        if (!next) {
            var current = doc.querySelector(
                '.navigation .current, ' +
                '.pagination .current, ' +
                '.pages .current'
            );

            var currentPage = current
                ? parseInt(cleanText(current.textContent), 10) || 1
                : 1;

            Array.prototype.some.call(pagination, function (link) {
                var number = parseInt(
                    cleanText(link.textContent),
                    10
                );

                if (number !== currentPage + 1) return false;

                var href = absoluteUrl(
                    link.getAttribute('href'),
                    pageUrl
                );

                if (!href || !isAniStarUrl(href)) return false;

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
     * 7. СЕТЕВОЙ ЗАПРОС
     * ========================================================= */

    function AniStarNetwork() {
        var aborted = false;
        var timer = null;

        this.get = function (url, success, error) {
            aborted = false;

            if (timer) {
                clearTimeout(timer);
                timer = null;
            }

            var target = PROXY_URL
                ? PROXY_URL + encodeURIComponent(url)
                : url;

            /*
             * В документации Lampa указан вызов:
             * Lampa.Request.get(url, callback).
             *
             * Не передаём неподтверждённый третий аргумент.
             */
            if (
                !Lampa.Request ||
                typeof Lampa.Request.get !== 'function'
            ) {
                if (error) {
                    error(new Error('Lampa.Request.get недоступен'));
                }
                return;
            }

            var completed = false;

            function finishError(err) {
                if (completed || aborted) return;

                completed = true;

                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }

                if (error) error(err);
            }

            function finishSuccess(data) {
                if (completed || aborted) return;

                if (data === undefined || data === null || data === '') {
                    finishError(new Error('Пустой ответ сервера'));
                    return;
                }

                completed = true;

                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }

                if (success) success(data);
            }

            // Если callback не пришёл, завершаем ожидание по тайм-ауту.
            timer = setTimeout(function () {
                finishError(
                    new Error('Тайм-аут ожидания ответа AniStar')
                );
            }, REQUEST_TIMEOUT);

            try {
                Lampa.Request.get(target, finishSuccess);
            } catch (e) {
                finishError(e);
            }
        };

        this.clear = function () {
            aborted = true;

            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };
    }

    /* =========================================================
     * 8. ВСПОМОГАТЕЛЬНАЯ РАБОТА С ACTIVITY
     * ========================================================= */

    function activityLoader(component, state) {
        if (
            component &&
            component.activity &&
            typeof component.activity.loader === 'function'
        ) {
            component.activity.loader(state);
        }
    }

    function showError(message) {
        if (window.Lampa && Lampa.Noty) {
            Lampa.Noty.show(message);
        } else {
            console.warn('[AniStar]', message);
        }
    }

    /* =========================================================
     * 9. КОМПОНЕНТ КАТАЛОГА
     * ========================================================= */

    function AniStarCatalog(object) {
        var self = this;

        object = object || {};

        var network = new AniStarNetwork();

        var destroyed = false;
        var loading = false;

        var pageUrl = object.page_url || BASE_URL;
        var nextUrl = '';

        var loaded = {};
        var items = [];

        var root = $('<div class="anistar-screen"></div>');
        var message = $('<div class="anistar-message"></div>');
        var grid = $('<div class="anistar-grid"></div>');

        var more = $(
            '<div class="selector anistar-more">Загрузить ещё</div>'
        );

        root.append(message);
        root.append(grid);
        root.append(more);

        message.hide();
        more.hide();

        function showMessage(text) {
            message.text(text);
            message.show();
        }

        function hideMessage() {
            message.hide();
        }

        /* Создание карточки. */

        function createCard(item) {
            var card = $('<div class="selector anistar-card"></div>');
            var poster = $('<div class="anistar-card__poster"></div>');
            var title = $('<div class="anistar-card__title"></div>');

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
            } else {
                poster.append(
                    '<div class="anistar-card__placeholder">▶</div>'
                );
            }

            title.text(item.title);

            card.append(poster);
            card.append(title);

            // OK на пульте открывает экран тайтла.
            card.on('hover:enter', function () {
                if (destroyed) return;

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

        /* Добавление карточек в сетку. */

        function renderItems(list) {
            list.forEach(function (item) {
                if (!item.url || loaded[item.url]) return;

                loaded[item.url] = true;
                items.push(item);

                grid.append(createCard(item));
            });
        }

        /* Загрузка страницы каталога. */

        function load(url) {
            if (loading || destroyed || !url) return;

            loading = true;

            showMessage(
                items.length
                    ? 'Загрузка следующей страницы…'
                    : 'Загрузка каталога AniStar…'
            );

            activityLoader(self, true);

            network.get(
                url,

                function (html) {
                    if (destroyed) return;

                    loading = false;
                    activityLoader(self, false);

                    try {
                        var parsed = parseCatalog(html, url);

                        if (!parsed.items.length && !items.length) {
                            showMessage(
                                'HTML получен, но карточки не найдены. ' +
                                'Возможно, сайт изменил разметку.'
                            );

                            console.warn(
                                '[AniStar] HTML получен, карточки не найдены.'
                            );

                            return;
                        }

                        hideMessage();

                        renderItems(parsed.items);

                        nextUrl = parsed.next || '';

                        if (nextUrl) {
                            more.show();
                        } else {
                            more.hide();
                        }

                        console.log(
                            '[AniStar] Загружено:',
                            parsed.items.length,
                            'Всего:',
                            items.length
                        );

                    } catch (e) {
                        console.error('[AniStar] Parse error:', e);

                        showMessage(
                            'Ошибка обработки каталога AniStar.'
                        );
                    }
                },

                function (error) {
                    if (destroyed) return;

                    loading = false;
                    activityLoader(self, false);

                    console.error('[AniStar] Network error:', error);

                    showMessage(
                        'Не удалось загрузить AniStar. ' +
                        'Проверь подключение или доступность сайта.'
                    );
                }
            );
        }

        /* Пагинация. */

        more.on('hover:enter', function () {
            if (!nextUrl || loading || destroyed) return;

            var url = nextUrl;

            // Сбрасываем адрес, чтобы исключить двойной запрос.
            nextUrl = '';

            load(url);
        });

        /* Жизненный цикл компонента. */

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
            activityLoader(self, false);

            if (
                self.activity &&
                typeof self.activity.empty === 'function'
            ) {
                self.activity.empty();
            }
        };
    }

    /* =========================================================
     * 10. ЭКРАН ИНФОРМАЦИИ О ТАЙТЛЕ
     * ========================================================= */

    function AniStarDetail(object) {
        object = object || {};

        var item = object.item || {};

        var root = $('<div class="anistar-screen"></div>');
        var detail = $('<div class="anistar-detail"></div>');

        var poster = $('<div class="anistar-detail__poster"></div>');
        var info = $('<div class="anistar-detail__info"></div>');

        var title = $('<div class="anistar-detail__title"></div>');
        title.text(item.title || 'Аниме');

        if (item.poster) {
            var image = $('<img>');

            image.attr('src', item.poster);
            image.attr('alt', item.title || '');

            poster.append(image);
        }

        var description = $('<div></div>');
        description.text('Страница аниме на AniStar');

        var open = $(
            '<div class="selector anistar-detail__link">' +
            'Показать ссылку на AniStar' +
            '</div>'
        );

        open.on('hover:enter', function () {
            if (!item.url) return;

            showError('Страница AniStar: ' + item.url);
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
            root.remove();
        };

        this.empty = function () {
            if (
                this.activity &&
                typeof this.activity.empty === 'function'
            ) {
                this.activity.empty();
            }
        };
    }

    /* =========================================================
     * 11. ПУНКТ ЛЕВОГО МЕНЮ
     * ========================================================= */

    function addMenu() {
        var menu = $('.menu .menu__list').eq(0);

        if (!menu.length) {
            console.warn('[AniStar] Левое меню пока недоступно');
            return false;
        }

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

        return true;
    }

    /* =========================================================
     * 12. РЕГИСТРАЦИЯ КОМПОНЕНТОВ
     * ========================================================= */

    function init() {
        if (window[READY_FLAG]) return;

        if (
            !window.Lampa ||
            !Lampa.Component ||
            !Lampa.Activity ||
            !Lampa.Request
        ) {
            console.error(
                '[AniStar] Необходимые API Lampa недоступны.'
            );

            return;
        }

        try {
            addStyles();

            // Регистрируем каталог.
            if (!Lampa.Component.get(PLUGIN_ID)) {
                Lampa.Component.add(
                    PLUGIN_ID,
                    AniStarCatalog
                );
            }

            // Регистрируем экран тайтла.
            if (!Lampa.Component.get(DETAIL_ID)) {
                Lampa.Component.add(
                    DETAIL_ID,
                    AniStarDetail
                );
            }

            // Добавляем пункт меню.
            var menuAdded = addMenu();

            if (!menuAdded) {
                console.warn(
                    '[AniStar] Компоненты зарегистрированы, ' +
                    'но пункт меню пока не найден.'
                );
            }

            // Флаг ставим только после регистрации компонентов.
            window[READY_FLAG] = true;

            console.log(
                '[AniStar] Запущен. Версия:',
                PLUGIN_VERSION
            );

        } catch (e) {
            console.error('[AniStar] Init error:', e);

            showError('Ошибка запуска плагина AniStar.');
        }
    }

    /* =========================================================
     * 13. ЗАПУСК ПОСЛЕ ГОТОВНОСТИ LAMPA
     * ========================================================= */

    if (window.appready) {
        init();
    } else if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                init();
            }
        });
    } else {
        console.error(
            '[AniStar] Не удалось дождаться готовности Lampa.'
        );
    }

})();
