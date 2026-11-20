
/*!
 * AniStar для Lampa
 * Версия: 0.4.0
 * Источник: https://anistar.org/anime/
 * Совместимость: Lampa 3.x / Android TV
 *
 * Каталог, навигация пультом, постеры и пагинация.
 */
(function () {
    'use strict';

    var PLUGIN_ID = 'anistar_catalog';
    var DETAIL_ID = 'anistar_detail';
    var READY_FLAG = 'anistar_040_ready';

    var BASE_URL = 'https://anistar.org/anime/';
    var SITE_HOST = 'anistar.org';

    // Оставьте пустым, если прокси не используется.
    // Если AniStar блокирует запросы по CORS, понадобится прокси.
    var PROXY_URL = '';

    if (window[READY_FLAG]) return;

    // Не ставим флаг до успешной регистрации компонентов.
    if (!window.Lampa || !Lampa.Component || !Lampa.Activity) {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') init();
        });
        return;
    }

    function init() {
        if (window[READY_FLAG]) return;

        if (!Lampa.Component || !Lampa.Activity || !Lampa.Reguest) {
            console.error('[AniStar] API Lampa недоступен');
            return;
        }

        addStyles();

        if (!Lampa.Component.get(PLUGIN_ID)) {
            Lampa.Component.add(PLUGIN_ID, AniStarCatalog);
        }

        if (!Lampa.Component.get(DETAIL_ID)) {
            Lampa.Component.add(DETAIL_ID, AniStarDetail);
        }

        addMenu();

        window[READY_FLAG] = true;
        console.log('[AniStar] Запущен. Версия 0.4.0');
    }

    // ---------------------------------------------------------
    // СТИЛИ
    // ---------------------------------------------------------

    function addStyles() {
        if (document.getElementById('anistar_styles')) return;

        var css = `
            .anistar-screen {
                width: 100%;
                box-sizing: border-box;
                padding: 0 2.5em 3em;
            }

            .anistar-grid {
                display: grid;
                grid-template-columns: repeat(7, minmax(0, 1fr));
                gap: 1.5em 1em;
                width: 100%;
                align-items: start;
            }

            .anistar-card {
                min-width: 0;
                cursor: pointer;
                box-sizing: border-box;
            }

            .anistar-card__poster {
                width: 100%;
                aspect-ratio: 2 / 3;
                overflow: hidden;
                border-radius: .4em;
                background: rgba(255,255,255,.08);
            }

            .anistar-card__poster img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }

            .anistar-card__placeholder {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2em;
                opacity: .4;
            }

            .anistar-card__title {
                margin-top: .55em;
                font-size: 1em;
                line-height: 1.3;
                overflow: hidden;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }

            .anistar-card.focus {
                transform: scale(1.04);
                z-index: 2;
            }

            .anistar-card.focus .anistar-card__poster {
                outline: 3px solid #fff;
                outline-offset: 3px;
            }

            .anistar-more {
                margin: 2em auto;
                padding: 1em 2em;
                text-align: center;
                width: max-content;
                max-width: 100%;
                border-radius: .4em;
                background: rgba(255,255,255,.12);
            }

            .anistar-message {
                padding: 2em;
                opacity: .8;
            }

            .anistar-detail {
                display: flex;
                gap: 2em;
                padding: 2em;
                align-items: flex-start;
            }

            .anistar-detail__poster {
                width: 220px;
                max-width: 35%;
                flex-shrink: 0;
            }

            .anistar-detail__poster img {
                display: block;
                width: 100%;
                border-radius: .4em;
            }

            .anistar-detail__info {
                flex: 1;
                min-width: 0;
            }

            .anistar-detail__title {
                font-size: 1.5em;
                font-weight: bold;
                margin-bottom: 1em;
            }

            .anistar-detail__link {
                margin-top: 1.5em;
                padding: 1em;
                background: rgba(255,255,255,.12);
                border-radius: .4em;
                width: max-content;
            }

            @media (max-width: 1200px) {
                .anistar-grid {
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                }
            }

            @media (max-width: 700px) {
                .anistar-screen {
                    padding: 0 1em 2em;
                }

                .anistar-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 1em .6em;
                }

                .anistar-detail {
                    flex-direction: column;
                }

                .anistar-detail__poster {
                    max-width: 70%;
                    width: 180px;
                }
            }
        `;

        var style = document.createElement('style');
        style.id = 'anistar_styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ---------------------------------------------------------
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ---------------------------------------------------------

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

    function isAnimeUrl(url) {
        if (!isAniStarUrl(url)) return false;

        try {
            var path = new URL(url).pathname;

            // Страницы публикаций AniStar.
            return /\.html$/i.test(path) &&
                path !== '/index.html';
        } catch (e) {
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

        if (/^(data:|blob:)/i.test(src)) return '';

        return absoluteUrl(src, base);
    }

    // ---------------------------------------------------------
    // ПАРСИНГ КАТАЛОГА
    // ---------------------------------------------------------

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

            if (!card) card = link.parentElement;

            var image =
                link.querySelector('img') ||
                (card && card.querySelector('img'));

            var heading = card && card.querySelector(
                'h1, h2, h3, h4, .title, .name'
            );

            var title = cleanText(
                link.getAttribute('title') ||
                (heading && heading.textContent) ||
                (image && image.getAttribute('alt')) ||
                link.textContent
            );

            // Отсекаем пустые и служебные ссылки.
            if (!title || title.length < 2 || title.length > 220) {
                return;
            }

            if (/^(смотреть|подробнее|читать|перейти|далее)$/i.test(title)) {
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

        Array.prototype.some.call(pagination, function (link) {
            var text = cleanText(link.textContent).toLowerCase();
            var rel = (link.getAttribute('rel') || '').toLowerCase();
            var cls = String(link.className || '').toLowerCase();

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

        return {
            items: items,
            next: next
        };
    }

    // ---------------------------------------------------------
    // СЕТЕВОЙ ЗАПРОС
    // ---------------------------------------------------------

    function AniStarNetwork() {
        var request = new Lampa.Reguest();

        this.get = function (url, success, error) {
            var target = PROXY_URL
                ? PROXY_URL + encodeURIComponent(url)
                : url;

            request.get(target, success, error);
        };

        this.clear = function () {
            if (request && request.clear) request.clear();
        };
    }

    // ---------------------------------------------------------
    // КАТАЛОГ
    // ---------------------------------------------------------

    function AniStarCatalog(object) {
        var self = this;

        var network = new AniStarNetwork();

        var destroyed = false;
        var loading = false;

        var pageUrl = object.page_url || BASE_URL;
        var nextUrl = '';

        var loaded = {};
        var items = [];

        var root = $('<div class="anistar-screen"></div>');
        var grid = $('<div class="anistar-grid"></div>');

        var message = $('<div class="anistar-message"></div>');
        var more = $('<div class="selector anistar-more">Загрузить ещё</div>');

        root.append(message);
        root.append(grid);
        root.append(more);

        more.hide();

        function showMessage(text) {
            message.text(text);
            message.show();
        }

        function hideMessage() {
            message.hide();
        }

        // Создание одной карточки.
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
                    poster.append(
                        '<div class="anistar-card__placeholder">▶</div>'
                    );
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

            // OK на пульте открывает страницу тайтла.
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

        function renderItems(list) {
            list.forEach(function (item) {
                if (!item.url || loaded[item.url]) return;

                loaded[item.url] = true;
                items.push(item);

                grid.append(createCard(item));
            });
        }

        function load(url) {
            if (loading || destroyed || !url) return;

            loading = true;
            showMessage('Загрузка каталога AniStar…');

            if (self.activity && self.activity.loader) {
                self.activity.loader(true);
            }

            network.get(
                url,

                function (html) {
                    if (destroyed) return;

                    loading = false;

                    if (self.activity && self.activity.loader) {
                        self.activity.loader(false);
                    }

                    try {
                        var parsed = parseCatalog(html, url);

                        if (!parsed.items.length && !items.length) {
                            showMessage(
                                'Не удалось найти карточки AniStar. ' +
                                'Возможно, сайт изменил разметку ' +
                                'или запрос заблокирован.'
                            );

                            console.warn(
                                '[AniStar] Получен ответ, но карточки не найдены'
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
                        console.error('[AniStar] Ошибка парсинга:', e);
                        showMessage('Ошибка обработки каталога AniStar.');
                    }
                },

                function (error) {
                    if (destroyed) return;

                    loading = false;

                    if (self.activity && self.activity.loader) {
                        self.activity.loader(false);
                    }

                    console.error('[AniStar] Ошибка сети:', error);

                    showMessage(
                        'Не удалось загрузить AniStar. ' +
                        'Возможна блокировка CORS.'
                    );
                }
            );
        }

        // Пагинация.
        more.on('hover:enter', function () {
            if (!nextUrl || loading) return;

            var url = nextUrl;
            nextUrl = '';

            load(url);
        });

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
            if (self.activity && self.activity.loader) {
                self.activity.loader(false);
            }

            if (self.activity && self.activity.empty) {
                self.activity.empty();
            }
        };
    }

    // ---------------------------------------------------------
    // ЭКРАН ТАЙТЛА
    // ---------------------------------------------------------

    function AniStarDetail(object) {
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
            'Открыть страницу AniStar' +
            '</div>'
        );

        // Открываем ссылку через штатный механизм Lampa.
        open.on('hover:enter', function () {
            if (!item.url) return;

            if (Lampa.Android && Lampa.Android.openUrl) {
                Lampa.Android.openUrl(item.url);
            } else {
                Lampa.Noty.show(item.url);
            }
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
            if (this.activity && this.activity.empty) {
                this.activity.empty();
            }
        };
    }

    // ---------------------------------------------------------
    // ПУНКТ ЛЕВОГО МЕНЮ
    // ---------------------------------------------------------

    function addMenu() {
        var menu = $('.menu .menu__list').eq(0);

        if (!menu.length) {
            console.warn('[AniStar] Не найдено левое меню');
            return;
        }

        if (menu.find('.anistar-menu-item').length) return;

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

    // ---------------------------------------------------------
    // ЗАПУСК
    // ---------------------------------------------------------

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') init();
        });
    }

})();
