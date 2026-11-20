
(function () {
    'use strict';

    var PLUGIN_FLAG = 'plugin_anistar_ready';
    var CATALOG_COMPONENT = 'anistar_catalog';
    var EPISODES_COMPONENT = 'anistar_episodes';
    var SITE_URL = 'https://anistar.org/';
    var CARD_URL_RE = /^https?:\/\/(?:www\.)?anistar\.org\/\d+-[^/]+\.html(?:[?#].*)?$/i;

    if (window[PLUGIN_FLAG]) return;
    window[PLUGIN_FLAG] = true;

    function absoluteUrl(value) {
        if (!value) return '';
        try {
            return new URL(value, SITE_URL).href;
        } catch (error) {
            var link = document.createElement('a');
            link.href = SITE_URL;
            link.href = value;
            return link.href || '';
        }
    }

    function textOf(node) {
        return (node && node.textContent ? node.textContent : '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char];
        });
    }

    function parseHtml(html) {
        return new DOMParser().parseFromString(String(html || ''), 'text/html');
    }

    function findCardContainer(anchor) {
        var node = anchor;
        var depth = 0;

        while (node && node.parentElement && depth < 6) {
            node = node.parentElement;
            depth++;

            if (node.matches && node.matches('article, .shortstory, .shortstory__item, .movie-item, .item')) {
                return node;
            }
        }

        return anchor.parentElement && anchor.parentElement.parentElement
            ? anchor.parentElement.parentElement
            : anchor.parentElement;
    }

    // Получение карточек аниме с сайта AniStar
    function parseCatalog(html) {
        var doc = parseHtml(html);
        var byUrl = {};

        Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (anchor) {
            var url = absoluteUrl(anchor.getAttribute('href'));
            if (!url || !CARD_URL_RE.test(url)) return;

            var title = textOf(anchor);
            var container = findCardContainer(anchor);
            var image = container && container.querySelector('img');

            var poster = image
                ? (image.getAttribute('data-src') ||
                   image.getAttribute('data-original') ||
                   image.getAttribute('data-lazy-src') ||
                   image.getAttribute('src') || '')
                : '';

            if (!byUrl[url]) {
                byUrl[url] = {
                    title: '',
                    url: url,
                    poster: '',
                    description: ''
                };
            }

            if (title && !/^(смотреть|подробнее|читать далее)$/i.test(title) &&
                (!byUrl[url].title || title.length > byUrl[url].title.length)) {
                byUrl[url].title = title;
            }

            if (poster && !byUrl[url].poster) {
                byUrl[url].poster = absoluteUrl(poster);
            }

            var description = container && container.querySelector(
                '.shortstory__text, .shortstory__desc, .description'
            );

            if (description && !byUrl[url].description) {
                byUrl[url].description = textOf(description);
            }
        });

        return Object.keys(byUrl).map(function (url) {
            var item = byUrl[url];

            if (!item.title) {
                item.title = url.split('/').pop()
                    .replace(/^\d+-/, '')
                    .replace(/\.html.*$/i, '')
                    .replace(/-/g, ' ');
            }

            return item;
        });
    }

    // Получение списка серий
    function parseEpisodes(html) {
        var doc = parseHtml(html);
        var result = [];
        var seen = {};

        Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (anchor) {
            var title = textOf(anchor);
            var url = absoluteUrl(anchor.getAttribute('href'));
            var match = title.match(/серия\s*(\d+)/i);

            if (!match || !url || seen[url]) return;

            seen[url] = true;

            result.push({
                title: title,
                number: parseInt(match[1], 10),
                url: url
            });
        });

        result.sort(function (a, b) {
            return b.number - a.number;
        });

        return result;
    }

    function notify(message) {
        if (window.Lampa && Lampa.Noty) {
            Lampa.Noty.show(message);
        }
    }

    function requestHtml(url, success, failure) {
        var request = new Lampa.Reguest();

        request.native(url, function (html) {
            success(String(html || ''), request);
        }, function (error) {
            if (failure) failure(error, request);
        }, {
            dataType: 'text'
        });

        return request;
    }

    // Открытие экрана серий
    function openEpisodes(anime) {
        Lampa.Activity.push({
            url: '',
            title: anime.title,
            component: EPISODES_COMPONENT,
            anime: anime,
            data: {
                anime: anime
            },
            page: 1
        });
    }

    // Отображение каталога
    function renderCatalogCards(root, items) {
        var list = root.find('.anistar-catalog__items');
        list.empty();

        items.forEach(function (item) {
            var poster = item.poster
                ? '<img class="anistar-card__poster" src="' +
                    escapeHtml(item.poster) + '" alt="">'
                : '<div class="anistar-card__poster anistar-card__poster--empty">AniStar</div>';

            var card = $(
                '<div class="anistar-card">' +
                    '<div class="anistar-card__image">' +
                        poster +
                    '</div>' +
                    '<div class="anistar-card__info">' +
                        '<div class="anistar-card__title">' +
                            escapeHtml(item.title) +
                        '</div>' +
                        '<div class="anistar-card__source">AniStar</div>' +
                        '<div class="selector anistar-card__watch">▶ Смотреть</div>' +
                    '</div>' +
                '</div>'
            );

            card.find('.anistar-card__watch').on('hover:enter', function () {
                openEpisodes(item);
            });

            card.on('hover:enter', function () {
                openEpisodes(item);
            });

            list.append(card);
        });
    }

    // Регистрация компонентов Lampa
    function registerComponents() {

        Lampa.Component.add(CATALOG_COMPONENT, {
            template: `
                <div class="anistar-screen">
                    <div class="anistar-screen__heading">
                        Каталог AniStar
                    </div>

                    <div class="anistar-catalog__status">
                        Загрузка каталога…
                    </div>

                    <div class="anistar-catalog__items"></div>
                </div>
            `,

            data: function () {
                return {};
            },

            mounted: function () {
                var root = $(this.$el);
                var status = root.find('.anistar-catalog__status');

                var request = requestHtml(
                    SITE_URL,
                    function (html) {
                        var items = parseCatalog(html);

                        if (!items.length) {
                            status.text(
                                'Не удалось найти карточки аниме. Возможно, AniStar изменил разметку сайта.'
                            );
                            return;
                        }

                        status.remove();
                        renderCatalogCards(root, items);
                    },
                    function () {
                        status.text(
                            'Ошибка загрузки каталога AniStar. Проверьте подключение к сайту.'
                        );
                    }
                );

                this.$anistarRequest = request;
            },

            destroyed: function () {
                if (this.$anistarRequest) {
                    this.$anistarRequest.clear();
                }
            }
        });

        // Экран серий
        Lampa.Component.add(EPISODES_COMPONENT, {
            template: `
                <div class="anistar-screen">
                    <div class="anistar-screen__heading">
                        {{anime.title}}
                    </div>

                    <div class="anistar-episodes__status">
                        Загрузка списка серий…
                    </div>

                    <div class="anistar-episodes__items"></div>

                    <div class="anistar-episodes__note">
                        Ссылки, найденные на AniStar, могут вести на раздачи файлов.
                        Воспроизведение через плеер Lampa будет добавлено отдельно.
                    </div>
                </div>
            `,

            data: function () {
                return {
                    anime: this.anime || (this.data && this.data.anime) || {}
                };
            },

            mounted: function () {
                var component = this;
                var root = $(this.$el);
                var status = root.find('.anistar-episodes__status');
                var anime = this.anime || {};

                if (!anime.url) {
                    status.text('Не найдена ссылка на страницу аниме.');
                    return;
                }

                var request = requestHtml(
                    anime.url,
                    function (html) {
                        var doc = parseHtml(html);
                        var episodes = parseEpisodes(html);
                        var heading = textOf(doc.querySelector('h1'));
                        var list = root.find('.anistar-episodes__items');

                        if (heading) {
                            root.find('.anistar-screen__heading').text(heading);
                        }

                        if (!episodes.length) {
                            status.text('Список серий на странице не найден.');
                            return;
                        }

                        status.remove();

                        episodes.forEach(function (episode) {
                            var row = $(
                                '<div class="selector anistar-episode">' +
                                    '<span class="anistar-episode__title">' +
                                        escapeHtml(episode.title) +
                                    '</span>' +
                                    '<span class="anistar-episode__arrow">›</span>' +
                                '</div>'
                            );

                            row.on('hover:enter', function () {
                                notify(
                                    'Серия найдена на AniStar. Подключение воспроизведения будет следующим этапом.'
                                );
                            });

                            list.append(row);
                        });
                    },
                    function () {
                        status.text('Ошибка загрузки страницы аниме.');
                    }
                );

                component.$anistarRequest = request;
            },

            destroyed: function () {
                if (this.$anistarRequest) {
                    this.$anistarRequest.clear();
                }
            }
        });
    }

    // Добавление пункта в левое меню
    function addMenuItem() {
        var menu = $('.menu .menu__list').eq(0);

        if (!menu.length || menu.find('.anistar-menu-item').length) {
            return;
        }

        var item = $(
            '<li class="menu__item selector anistar-menu-item">' +
                '<div class="menu__ico">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
                        '<path fill="currentColor" d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 3v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2z"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="menu__text">Анистар</div>' +
            '</li>'
        );

        item.on('hover:enter', function () {
            Lampa.Activity.push({
                url: '',
                title: 'Анистар',
                component: CATALOG_COMPONENT,
                data: {},
                page: 1
            });
        });

        menu.append(item);
    }

    // Стили каталога
    function addStyles() {
        if (document.getElementById('anistar-plugin-styles')) {
            return;
        }

        var css = `
            .anistar-screen {
                box-sizing: border-box;
                width: 100%;
                padding: 1.2em 1.5em 3em;
                overflow-y: auto;
            }

            .anistar-screen__heading {
                font-size: 1.45em;
                font-weight: 600;
                margin: 0 0 1em;
            }

            .anistar-catalog__status,
            .anistar-episodes__status {
                opacity: .7;
                padding: 1em 0;
            }

            .anistar-card {
                display: flex;
                align-items: center;
                gap: 1.1em;
                padding: .7em;
                margin: 0 0 .7em;
                border-radius: .45em;
                background: rgba(255,255,255,.045);
            }

            .anistar-card__image {
                flex: 0 0 6em;
                width: 6em;
                height: 8.5em;
                overflow: hidden;
                border-radius: .25em;
                background: rgba(255,255,255,.08);
            }

            .anistar-card__poster {
                display: block;
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .anistar-card__poster--empty {
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: .5;
                font-size: .8em;
            }

            .anistar-card__info {
                min-width: 0;
                flex: 1;
            }

            .anistar-card__title {
                font-size: 1.05em;
                font-weight: 600;
                line-height: 1.35;
            }

            .anistar-card__source {
                opacity: .55;
                font-size: .8em;
                margin-top: .35em;
            }

            .anistar-card__watch {
                display: inline-block;
                margin-top: .75em;
                padding: .45em .9em;
                border-radius: .3em;
                background: rgba(255,255,255,.12);
            }

            .anistar-episode {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: .9em 1em;
                margin: .35em 0;
                border-radius: .35em;
                background: rgba(255,255,255,.055);
            }

            .anistar-episode__arrow {
                opacity: .55;
                font-size: 1.4em;
            }

            .anistar-episodes__note {
                opacity: .55;
                font-size: .82em;
                line-height: 1.4;
                margin-top: 1.2em;
            }
        `;

        var style = document.createElement('style');
        style.id = 'anistar-plugin-styles';
        style.textContent = css;

        document.head.appendChild(style);
    }

    // Запуск плагина
    function init() {
        if (!window.Lampa || !Lampa.Component || !Lampa.Activity) {
            console.error('AniStar: API Lampa недоступен');
            return;
        }

        try {
            registerComponents();
            addStyles();
            addMenuItem();

            console.log('AniStar: плагин инициализирован');
        } catch (error) {
            console.error('AniStar: ошибка инициализации', error);
            notify('Ошибка инициализации плагина Анистар');
        }
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                init();
            }
        });
    }

})();
