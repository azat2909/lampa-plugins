(function () {
    'use strict';

    // Защита от повторной инициализации плагина
    if (window.plugin_anistar_ready) return;
    window.plugin_anistar_ready = true;

    // --- 1. Компонент для отображения каталога ---
    function AnistarCatalog(object) {
        var network = new Lampa.Reguest(); // Создаем экземпляр для запросов
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var html = $('<div class="anistar-catalog"></div>');
        var inited = false;
        var last_req = null; // Ссылка на последний запрос для возможности его отмены

        // Метод создания и загрузки контента
        this.create = function () {
            inited = true;
            this.activity.loader(true);

            // Загружаем страницу каталога
            last_req = network.get('https://anistar.org/anime/', function (response) {
                if (!inited) return; // Если экран уже закрыли, ничего не делаем
                this.activity.loader(false);
                renderCatalog(response);
            }.bind(this), function () {
                if (!inited) return;
                this.activity.loader(false);
                Lampa.Noty.show('Не удалось загрузить каталог Анистар. Проверьте соединение.', { style: 'error' });
            }.bind(this));

            return this.render();
        };

        // Функция парсинга HTML и отрисовки сетки
        function renderCatalog(htmlText) {
            // Парсим ответ сервера
            var $parsed = $('<div>').append($.parseHTML(htmlText));

            // !!! ВАЖНО: Селекторы .b-content__inline_item и .short-item являются ПРИМЕРОМ. 
            // Если сетка пустая, откройте сайт anistar.org в браузере на ПК, 
            // нажмите F12 (Инструменты разработчика) и найдите актуальные CSS-классы для карточек аниме.
            var items = $parsed.find('.b-content__inline_item'); 
            if (items.length === 0) {
                items = $parsed.find('.short-item'); // Пробуем альтернативный селектор
            }
            
            if (items.length === 0) {
                Lampa.Noty.show('Не удалось найти тайтлы на странице. Возможно, сайт изменил верстку.', { style: 'error' });
                return;
            }

            // Создаем контейнеры для сетки в стиле Lampa
            var grid = $('<div class="category-full"></div>');
            var itemsContainer = $('<div class="category-full__list"></div>');
            
            items.each(function (index, element) {
                var $item = $(element);
                
                // Извлекаем данные (селекторы могут потребовать правок)
                var link = $item.find('a').first().attr('href');
                if (!link) return; // Пропускаем, если нет ссылки

                var img = $item.find('img').attr('src') || $item.find('img').attr('data-src');
                if (!img) {
                    img = 'https://via.placeholder.com/200x300?text=No+Image';
                }
                
                var title = $item.find('.b-content__inline_item-link').text().trim() || 
                            $item.find('a').first().attr('title') || 
                            'Без названия';

                // Делаем ссылку абсолютной
                if (link && link.startsWith('/')) {
                    link = 'https://anistar.org' + link;
                }

                // Формируем карточку
                var card = $(
                    '<div class="card selector">' +
                        '<div class="card__img">' +
                            '<img src="' + img + '" alt="' + title + '">' +
                        '</div>' +
                        '<div class="card__title">' + title + '</div>' +
                    '</div>'
                );

                // Обработчик нажатия на пульте (Enter)
                card.on('hover:enter', function () {
                    Lampa.Noty.show('Выбран: ' + title);
                    // В будущем здесь можно добавить переход на экран с деталями:
                    // Lampa.Activity.push({ url: '', title: title, component: 'anistar_detail', link: link, page: 1 });
                });

                itemsContainer.append(card);
            });

            grid.append(itemsContainer);
            html.append(grid);
            scroll.append(grid);
            
            // Устанавливаем фокус на первую карточку
            Lampa.Controller.collectionSet(grid);
            Lampa.Controller.collectionFocus(grid.find('.card').first(), grid);
        }

        this.start = function () {
            // Вызывается при возврате на экран из другого раздела
            Lampa.Controller.collectionSet(this.render());
            Lampa.Controller.collectionFocus(html.find('.card').first(), this.render());
        };

        this.render = function () {
            return html;
        };

        // Метод очистки ресурсов при закрытии экрана
        this.destroy = function () {
            inited = false;
            
            // Отменяем активный запрос, чтобы избежать ошибок в консоли и утечек памяти
            if (last_req && typeof last_req.clear === 'function') {
                last_req.clear();
            } else if (network && typeof network.clear === 'function') {
                network.clear();
            }

            if (scroll) scroll.destroy();
            if (html) html.remove();
        };
    }

    // --- 2. Функция добавления пункта в меню ---
    function addMenuItem() {
        if ($('.menu__item[data-anistar]').length > 0) return; // Проверка на дубликат

        var button = $(
            '<li class="menu__item selector" data-anistar="true">' +
                '<div class="menu__ico">' +
                    '<svg viewBox="0 0 24 24" width="24" height="24">' +
                        '<path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="menu__text">Анистар</div>' +
            '</li>'
        );

        button.on('hover:enter', function () {
            Lampa.Activity.push({
                url: '',
                title: 'Анистар',
                component: 'anistar_catalog',
                page: 1
            });
        });

        // Вставляем в начало главного меню
        $('.menu .menu__list').eq(0).append(button);
    }

    // --- 3. Инициализация плагина ---
    function startPlugin() {
        // Регистрируем компонент
        if (!Lampa.Component.get('anistar_catalog')) {
            Lampa.Component.add('anistar_catalog', AnistarCatalog);
        }
        // Добавляем кнопку в меню
        addMenuItem();
    }

    // Ждем полной загрузки приложения
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
