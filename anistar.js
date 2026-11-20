(function () {
    'use strict';

    // Защита от повторной инициализации
    if (window.plugin_anistar_ready) return;
    window.plugin_anistar_ready = true;

    // --- 1. Компонент для отображения каталога ---
    function AnistarCatalog(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var html = $('<div class="anistar-catalog"></div>');
        var inited = false;

        // Этот метод вызывается при открытии экрана
        this.create = function () {
            inited = true;
            this.activity.loader(true);

            // Загружаем страницу каталога аниме
            network.get('https://anistar.org/anime/', function (response) {
                if (!inited) return;
                this.activity.loader(false);
                renderCatalog(response);
            }.bind(this), function () {
                if (!inited) return;
                this.activity.loader(false);
                Lampa.Noty.show('Не удалось загрузить каталог Анистар', { style: 'error' });
            }.bind(this));

            return this.render();
        };

        // Парсинг HTML и создание карточек
        function renderCatalog(htmlText) {
            // Создаём временный DOM-элемент для парсинга
            var $parsed = $('<div>').append($.parseHTML(htmlText));

            // !!! ВАЖНО: Селекторы ниже являются ПРИМЕРОМ. 
            // Их нужно проверить и адаптировать под реальную структуру сайта anistar.org.
            // Например, на момент написания ответа структура может быть такой:
            // .b-content__inline_item или .short-item
            var items = $parsed.find('.b-content__inline_item'); // Пример селектора

            if (items.length === 0) {
                // Если контейнер не найден, пробуем другой возможный селектор
                items = $parsed.find('.short-item'); // Альтернативный пример
            }
            
            if (items.length === 0) {
                Lampa.Noty.show('Не удалось найти тайтлы на странице. Возможно, сайт изменил структуру или блокирует запросы.', { style: 'error' });
                return;
            }

            // Создаём сетку (используем стили Lampa для карточек)
            var grid = $('<div class="category-full"></div>'); // Класс для сеточного отображения
            var itemsContainer = $('<div class="category-full__list"></div>');
            
            items.each(function (index, element) {
                var $item = $(element);
                
                // --- Извлечение данных (селекторы нужно проверить!) ---
                // Пример: ссылка, картинка, название
                var link = $item.find('a').first().attr('href');
                if (!link) return; // Пропускаем, если нет ссылки

                // Пытаемся найти картинку. Иногда она в data-src или background-image
                var img = $item.find('img').attr('src') || $item.find('img').attr('data-src');
                // Если картинки нет, ставим заглушку
                if (!img) {
                    img = 'https://via.placeholder.com/200x300?text=No+Image';
                }
                
                var title = $item.find('.b-content__inline_item-link').text().trim() || 
                            $item.find('a').first().attr('title') || 
                            'Без названия';

                // Формируем полный URL, если ссылка относительная
                if (link && link.startsWith('/')) {
                    link = 'https://anistar.org' + link;
                }

                // Создаём карточку в стиле Lampa
                var card = $(
                    '<div class="card selector">' +
                        '<div class="card__img">' +
                            '<img src="' + img + '" alt="' + title + '">' +
                        '</div>' +
                        '<div class="card__title">' + title + '</div>' +
                    '</div>'
                );

                // Обработчик нажатия (Enter на пульте)
                card.on('hover:enter', function () {
                    // Здесь в будущем можно добавить переход на страницу тайтла.
                    // Пока просто покажем уведомление.
                    Lampa.Noty.show('Выбран: ' + title);
                    // Пример перехода на детальную страницу (если бы она была):
                    // Lampa.Activity.push({
                    //     url: '', title: title, component: 'anistar_detail', link: link, page: 1
                    // });
                });

                itemsContainer.append(card);
            });

            grid.append(itemsContainer);
            html.append(grid);
            scroll.append(grid);
            
            // Устанавливаем фокус на первую карточку после загрузки
            Lampa.Controller.collectionSet(grid);
            Lampa.Controller.collectionFocus(grid.find('.card').first(), grid);
        }

        this.start = function () {
            // Устанавливаем фокус на контейнер при возврате на экран
            Lampa.Controller.collectionSet(this.render());
            Lampa.Controller.collectionFocus(html.find('.card').first(), this.render());
        };

        this.render = function () {
            return html;
        };

        this.destroy = function () {
            inited = false;
            network.clear();
            scroll.destroy();
            html.remove();
        };
    }

    // --- 2. Функция добавления пункта в меню ---
    function addMenuItem() {
        // Проверяем, не добавлен ли уже пункт
        if ($('.menu__item[data-anistar]').length > 0) return;

        // Создаём элемент меню
        var button = $(
            '<li class="menu__item selector" data-anistar="true">' +
                '<div class="menu__ico">' +
                    // Простая SVG-иконка (звезда)
                    '<svg viewBox="0 0 24 24" width="24" height="24">' +
                        '<path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="menu__text">Анистар</div>' +
            '</li>'
        );

        // Обработчик нажатия
        button.on('hover:enter', function () {
            Lampa.Activity.push({
                url: '',
                title: 'Анистар',
                component: 'anistar_catalog', // Имя компонента, который мы зарегистрировали
                page: 1
            });
        });

        // Добавляем в основной список меню (верхний)
        $('.menu .menu__list').eq(0).append(button);
    }

    // --- 3. Инициализация плагина ---
    function startPlugin() {
        // Регистрируем компонент
        if (!Lampa.Component.get('anistar_catalog')) {
            Lampa.Component.add('anistar_catalog', AnistarCatalog);
        }

        // Добавляем пункт меню
        addMenuItem();
    }

    // Запускаем после готовности приложения
    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                startPlugin();
            }
        });
    }

})();
