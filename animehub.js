/*!
 * AnimeHub 0.1.0 — каталог для Lampa на Android TV.
 */
(function () {
    'use strict';

    var NAME = 'AnimeHub';
    var COMPONENT = 'animehub_catalog';
    var CATALOG_URL = 'https://api.hentaigo.me/api/news';
    var API_BASE = 'https://api.hentaigo.me/';
    var PAGE_SIZE = 30;
    var TIMEOUT = 15000;

    if (window.animehub_catalog_ready) return;
    window.animehub_catalog_ready = true;

    function addStyles() {
        $('<style>').text([
            '.animehub-catalog{padding:0 2em 2em}',
            '.animehub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(9em,1fr));gap:1.4em 1em}',
            '.animehub-card{min-width:0}',
            '.animehub-poster{position:relative;padding-top:150%;overflow:hidden;border-radius:.35em;background:rgba(255,255,255,.1)}',
            '.animehub-poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
            '.animehub-title{margin-top:.5em;line-height:1.3;min-height:2.6em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
            '.animehub-footer{display:flex;flex-direction:column;align-items:center;gap:.65em;margin:1.5em 0}',
            '.animehub-action{padding:.75em 1.5em;border-radius:.35em;background:rgba(255,255,255,.12);cursor:pointer}',
            '.animehub-card.focus .animehub-poster,.animehub-action.focus{outline:.18em solid white;outline-offset:.18em}'
        ].join('\n')).appendTo('head');
    }

    function httpsUrl(value) {
        if (typeof value !== 'string' || !value.trim()) return '';
        try {
            var url = new URL(value, API_BASE);
            return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    function createCard(item) {
        var card = $('<div class="animehub-card selector"></div>');
        var poster = $('<div class="animehub-poster"></div>').appendTo(card);
        var image = (item.xfields_data || {}).poster;
        var thumbnail = httpsUrl(image && image.thumb);
        var original = httpsUrl(typeof image === 'string' ? image : image && image.url);

        if (thumbnail || original) {
            $('<img alt="" loading="lazy" decoding="async">')
                .on('error', function () {
                    if (original && this.src !== original) this.src = original;
                    else $(this).remove();
                })
                .attr('src', thumbnail || original)
                .appendTo(poster);
        }
        $('<div class="animehub-title"></div>').text(item.title).appendTo(card);
        return card;
    }

    function Catalog() {
        var screen = this;
        var request = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var root = $('<div class="animehub-catalog"></div>');
        var grid = $('<div class="animehub-grid"></div>').appendTo(root);
        var footer = $('<div class="animehub-footer"></div>').appendTo(root);
        var notice = $('<div role="status"></div>').hide().appendTo(footer);
        var action = $('<div class="animehub-action selector"></div>').hide().appendTo(footer);
        var seen = Object.create(null);
        var nextPage = 1;
        var busy = false;
        var atEnd = false;
        var destroyed = false;
        var focused = null;
        var timer;

        scroll.append(root);

        function showNotice(message) {
            notice.text(message).toggle(Boolean(message));
        }

        function showAction(label) {
            action.text(label).toggle(Boolean(label));
        }

        function refreshFocus(preferred) {
            if (!Lampa.Controller.own(screen)) return;

            var target = preferred || focused;
            if (!target || !root[0].contains(target) || target.offsetParent === null) {
                target = grid.children().get(0) || action.get(0);
            }
            Lampa.Controller.collectionSet(root, false, true);
            if (target && target.offsetParent !== null) {
                Lampa.Controller.collectionFocus(target, root, true);
            }
        }

        function focus() {
            focused = this;
            scroll.update(this);
        }

        function onFailure(message) {
            showNotice(message || 'Не удалось загрузить каталог AnimeHub.');
            showAction('Повторить');
            refreshFocus();
        }

        function displayPage(data) {
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (error) {
                    onFailure();
                    return;
                }
            }
            if (!Array.isArray(data) && !(data && data.id != null && typeof data.title === 'string')) {
                onFailure('Сервер AnimeHub вернул неожиданный ответ.');
                return;
            }

            var entries = Array.isArray(data) ? data : [data];
            var fragment = document.createDocumentFragment();
            var firstNew = null;
            entries.forEach(function (item) {
                if (!item || item.id == null || typeof item.title !== 'string' || !item.title.trim()) return;
                var id = String(item.id);
                if (seen[id]) return;
                seen[id] = true;

                var card = createCard(item).on('hover:focus', focus).get(0);
                if (!firstNew) firstNew = card;
                fragment.appendChild(card);
            });

            grid.append(fragment);
            nextPage += 1;
            atEnd = entries.length < PAGE_SIZE || !firstNew;
            showNotice(grid.children().length ? '' : 'Каталог AnimeHub пуст.');
            showAction(atEnd ? '' : 'Загрузить ещё');
            var preferred = null;
            if (focused === action.get(0)) {
                preferred = firstNew || grid.children().get(-1);
            }
            refreshFocus(preferred);
        }

        function load() {
            if (destroyed || busy || atEnd) return;
            if (!window.AndroidJS || typeof AndroidJS.httpReq !== 'function' ||
                !Lampa.Platform.is('android') || typeof request.native !== 'function') {
                showNotice('Для загрузки AnimeHub нужен Android-клиент Lampa.');
                showAction('');
                return;
            }

            busy = true;
            showNotice('');
            showAction('Загрузка…');

            var completed = false;
            function finish(callback) {
                return function (response) {
                    if (destroyed || completed) return;
                    completed = true;
                    clearTimeout(timer);
                    request.clear();
                    busy = false;
                    callback(response);
                };
            }

            var success = finish(displayPage);
            var failure = finish(function () { onFailure(); });
            timer = setTimeout(failure, TIMEOUT + 2000);

            try {
                request.native(CATALOG_URL, success, failure, JSON.stringify({
                    mode: 'short',
                    page: nextPage,
                    limit: PAGE_SIZE
                }), {
                    type: 'POST',
                    dataType: 'json',
                    contentType: 'application/json',
                    headers: { 'Content-Type': 'application/json' },
                    timeout: TIMEOUT
                });
            } catch (error) {
                failure();
            }
        }

        function move(direction, fallback) {
            var nav = window.Navigator || Lampa.Navigator;
            if (nav && typeof nav.canmove === 'function' && nav.canmove(direction)) nav.move(direction);
            else if (fallback) Lampa.Controller.toggle(fallback);
        }

        action.on('hover:focus', focus).on('hover:enter', load);

        this.create = function () {
            scroll.minus();
            load();
            return this.render();
        };

        this.render = function () {
            return scroll.render();
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                link: screen,
                invisible: true,
                toggle: function () { refreshFocus(); },
                left: function () { move('left', 'menu'); },
                up: function () { move('up', 'head'); },
                down: function () { move('down'); },
                right: function () { move('right'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };

        this.stop = function () {};

        this.destroy = function () {
            destroyed = true;
            clearTimeout(timer);
            request.clear();
            scroll.destroy();
        };
    }

    function init() {
        if (Lampa.Component.get(COMPONENT)) return;
        Lampa.Component.add(COMPONENT, Catalog);
        addStyles();

        var icon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
            '<path fill="currentColor" d="M4 4h7v7H4zm9 0h7v7h-7zm0 9h7v7h-7zm-9 0h7v7H4z"/>' +
            '</svg>';
        var button = $('<li class="menu__item selector animehub-menu-item"></li>')
            .append($('<div class="menu__ico"></div>').html(icon))
            .append($('<div class="menu__text"></div>').text(NAME));

        function openCatalog() {
            Lampa.Activity.push({ url: '', title: NAME, component: COMPONENT, page: 1 });
        }

        if (Lampa.Menu && typeof Lampa.Menu.addElement === 'function') {
            Lampa.Menu.addElement(button, openCatalog);
        } else {
            $('.menu .menu__list').first().append(button.on('hover:enter', openCatalog));
        }
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (event) {
        if (event.type === 'ready') init();
    });
})();
