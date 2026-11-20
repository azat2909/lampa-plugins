
/*
 * AniStar 0.3.2
 * Исправлено добавление кнопки в левое меню.
 */

var PLUGIN_VERSION = '0.3.2';
var READY_FLAG = 'anistar_032_ready';

function addMenu() {
    var menu = $('.menu .menu__list').eq(0);

    // Если меню ещё не создано, пробуем позже.
    if (!menu.length) return false;

    // Не добавляем кнопку повторно.
    if (menu.find('.anistar-menu-item').length) return true;

    var button = $(
        '<li class="menu__item selector anistar-menu-item">' +
            '<div class="menu__ico">' +
                ICON +
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

    console.log('[AniStar] Кнопка меню добавлена');

    return true;
}

function init() {
    if (window[READY_FLAG]) return;

    if (
        !window.Lampa ||
        !Lampa.Component ||
        !Lampa.Activity
    ) {
        console.error('[AniStar] API Lampa недоступен');
        return;
    }

    try {
        addStyles();

        if (!Lampa.Component.get(PLUGIN_ID)) {
            Lampa.Component.add(PLUGIN_ID, AniStarCatalog);
        }

        if (!Lampa.Component.get(DETAIL_ID)) {
            Lampa.Component.add(DETAIL_ID, AniStarDetail);
        }

        // Инициализация компонентов завершена.
        window[READY_FLAG] = true;

        /*
         * Повторяем поиск меню, пока Lampa его не создаст.
         * Ограничиваем количество попыток.
         */
        var attempts = 0;

        var menuTimer = setInterval(function () {
            attempts++;

            if (addMenu() || attempts >= 30) {
                clearInterval(menuTimer);
            }
        }, 1000);

        // Первая попытка сразу.
        if (addMenu()) {
            clearInterval(menuTimer);
        }

        console.log('[AniStar] Версия:', PLUGIN_VERSION);

    } catch (e) {
        console.error('[AniStar] Ошибка инициализации:', e);
    }
}

/* Запуск после готовности Lampa. */
if (window.appready) {
    init();
} else if (window.Lampa && Lampa.Listener) {
    Lampa.Listener.follow('app', function (event) {
        if (event.type === 'ready') init();
    });
}
