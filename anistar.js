/*!
 * ============================================================
 * AniStar для Lampa
 * Версия: 0.4.46
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
    var READY_FLAG = 'anistar_0446_ready';

    var BASE_URL = 'https://anistar.org/anime/';
    var SITE_HOST = 'anistar.org';

    var PLUGIN_VERSION = '0.4.46';

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

        '.anistar-more.focus { outline:3px solid #fff; outline-offset:3px; }',
        '.anistar-search-title { display:flex; align-items:center; gap:1em; padding:.85em 1.1em; margin:.25em 0; border-radius:.35em; background:rgba(255,255,255,.07); min-height:3em; }',
        '.anistar-search-title.focus { background:rgba(255,255,255,.22); outline:2px solid #fff; outline-offset:1px; }',
        '.anistar-search-title__number { opacity:.55; min-width:2em; }',
        '.anistar-search-title__poster { display:block; width:6em; height:9em; min-width:6em; min-height:9em; max-width:6em; max-height:9em; flex:0 0 6em; aspect-ratio:2/3; object-fit:cover; border-radius:.3em; background:rgba(255,255,255,.08); }',
        '.anistar-search-title__name { font-size:1.08em; line-height:1.35; }',
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
        ' aspect-ratio:2/3;',
        ' flex:0 0 auto;',
        ' overflow:hidden;',
        ' border-radius:.4em;',
        ' background:rgba(255,255,255,.08);',
        '}',

        '.anistar-detail__poster img {',
        ' display:block;',
        ' width:100%;',
        ' height:100%;',
        ' aspect-ratio:2/3;',
        ' object-fit:contain;',
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
            return new URL(url).hostname.toLowerCase() === SITE_HOST;
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

    function bestSrcset(value) {
        var entries = String(value || '').split(',');
        var best = '';
        var bestScore = -1;

        entries.forEach(function (entry) {
            var parts = entry.trim().split(/\s+/);
            if (!parts[0]) return;
            var descriptor = parts[1] || '';
            var score = 0;
            var width = descriptor.match(/^(\d+)w$/i);
            var density = descriptor.match(/^([\d.]+)x$/i);
            if (width) score = parseInt(width[1], 10);
            else if (density) score = Math.round(parseFloat(density[1]) * 10000);
            else score = 1;
            if (score > bestScore) {
                bestScore = score;
                best = parts[0];
            }
        });

        return best;
    }

    function getPoster(image, base) {
        if (!image || !image.getAttribute) return '';

        // Сначала проверяем атрибуты, которые обычно содержат исходный файл,
        // и только затем ленивую/экранную миниатюру.
        var attrs = [
            'data-original', 'data-original-src', 'data-poster',
            'data-image', 'data-full', 'data-zoom-image',
            'data-srcset', 'srcset', 'data-lazy-src', 'data-src', 'src'
        ];
        var src = '';

        for (var i = 0; i < attrs.length && !src; i++) {
            var value = image.getAttribute(attrs[i]) || '';
            if (attrs[i].indexOf('srcset') !== -1) value = bestSrcset(value);
            src = value;
        }

        if (!src) {
            var style = image.getAttribute('style') || '';
            var background = style.match(/background(?:-image)?\s*:[^;]*url\((['"]?)(.*?)\1\)/i);
            if (background) src = background[2];
        }

        src = String(src || '').trim().replace(/^['"]|['"]$/g, '');
        if (!src || /^data:image\//i.test(src)) return '';

        return absoluteUrl(src.replace(/&amp;/g, '&'), base);
    }

    function isImageUrl(value, base) {
        var url = absoluteUrl(value, base);
        if (!url || !isAniStarUrl(url)) return false;
        try {
            return /\.(jpg|jpeg|png|webp|avif)(?:$|[?#])/i.test(url);
        } catch (e) {
            return false;
        }
    }

    // На AniStar ID публикации совпадает с ID каталога постера:
    // /10938-title.html -> /uploads/posters/10938/original.jpg
    // Этот путь подтверждён страницей тайтла 10938.
    function getPosterByAnimeId(animeUrl) {
        try {
            var parsed = new URL(animeUrl, BASE_URL);
            var match = parsed.pathname.match(/^\/(\d+)-[^/]+\.html$/i);
            if (!match) return '';
            return 'https://' + SITE_HOST + '/uploads/posters/' + match[1] + '/original.jpg';
        } catch (e) {
            return '';
        }
    }

    function isOriginalPosterUrl(value, base) {
        var url = absoluteUrl(value, base);
        if (!url || !isAniStarUrl(url)) return false;
        try {
            var path = new URL(url).pathname;
            return /\/uploads\/posters\/[^/]+\/original\.(jpg|jpeg|png|webp)$/i.test(path) ||
                /\/uploads\/posters\/\d+\/[^/]+\.(jpg|jpeg|png|webp)$/i.test(path) &&
                !/(thumb|small|medium|preview|resize|mini)/i.test(path);
        } catch (e) {
            return false;
        }
    }

    function getFullPoster(card, animeUrl, base) {
        if (!card) return '';
        var target = normalizeUrl(animeUrl);
        var node = card;
        var depth = 0;

        while (node && depth < 8) {
            var links = node.querySelectorAll ? node.querySelectorAll('a[href]') : [];
            var hasTarget = false;
            Array.prototype.forEach.call(links, function (link) {
                var href = absoluteUrl(link.getAttribute('href'), base);
                if (isAnimeUrl(href) && normalizeUrl(href) === target) hasTarget = true;
            });

            if (hasTarget) {
                var preferred = [];
                var otherImages = [];

                Array.prototype.forEach.call(links, function (link) {
                    var href = absoluteUrl(link.getAttribute('href'), base);
                    if (!isImageUrl(href, base)) return;
                    if (isOriginalPosterUrl(href, base)) preferred.push(href);
                    else otherImages.push(href);
                });

                if (preferred.length) return preferred[0];

                // Иногда полноразмерная картинка находится в ссылке вокруг
                // постера, но файл назван не original.jpg.
                if (otherImages.length) {
                    var posterFiles = otherImages.filter(function (href) {
                        return /\/uploads\/posters\//i.test(href);
                    });
                    if (posterFiles.length) return posterFiles[0];
                }

                var images = node.querySelectorAll ? node.querySelectorAll('img, source[srcset]') : [];
                var candidates = [];
                for (var i = 0; i < images.length; i++) {
                    var imageUrl = getPoster(images[i], base);
                    if (imageUrl) candidates.push(imageUrl);
                }
                if (candidates.length) return candidates[0];
            }

            node = node.parentElement;
            depth++;
        }

        return '';
    }

    /*
     * Запрашиваем десктопную тему AniStar, исключая мобильную разметку.
     */
    function fullVersionUrl(value) {
        try {
            var parsed = new URL(value, BASE_URL);
            parsed.searchParams.set('skin_name', 'new36');
            return parsed.href;
        } catch (e) {
            return value;
        }
    }

    /*
     * Получаем отдельный постер со страницы конкретного тайтла.
     * Предпочитаем оригинал из основного содержимого, затем Open Graph.
     */
    function getArticlePoster(html, pageUrl) {
        var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        var scopes = [
            doc.querySelector('#dle-content'),
            doc.querySelector('.fullstory'),
            doc.querySelector('.full-text'),
            doc.querySelector('article'),
            doc.querySelector('.news')
        ];
        var scope = null;
        for (var i = 0; i < scopes.length; i++) {
            if (scopes[i]) {
                scope = scopes[i];
                break;
            }
        }

        if (scope) {
            var originalLinks = scope.querySelectorAll('a[href]');
            for (var j = 0; j < originalLinks.length; j++) {
                if (isOriginalPosterUrl(originalLinks[j].getAttribute('href'), pageUrl)) {
                    return absoluteUrl(originalLinks[j].getAttribute('href'), pageUrl);
                }
            }
        }

        var meta = doc.querySelector('meta[property="og:image"], meta[name="twitter:image"], meta[property="twitter:image"]');
        if (meta) {
            var metaUrl = absoluteUrl(meta.getAttribute('content'), pageUrl);
            if (metaUrl && isAniStarUrl(metaUrl)) return metaUrl;
        }

        var images = (scope || doc).querySelectorAll('img');
        for (var k = 0; k < images.length; k++) {
            var src = getPoster(images[k], pageUrl);
            if (src && isAniStarUrl(src)) return src;
        }
        return '';
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
            // Ищем обложку в ближайших родителях: в поисковой выдаче
            // заголовок и изображение могут находиться в соседних блоках.
            var image = null;
            var imageNode = link;
            var imageDepth = 0;

            while (imageNode && imageDepth < 6 && !image) {
                var imageCandidates = imageNode.querySelectorAll
                    ? imageNode.querySelectorAll('img, [style*="background"]')
                    : [];

                for (var imageIndex = 0; imageIndex < imageCandidates.length; imageIndex++) {
                    if (getPoster(imageCandidates[imageIndex], pageUrl)) {
                        image = imageCandidates[imageIndex];
                        break;
                    }
                }

                imageNode = imageNode.parentElement;
                imageDepth++;
            }

            if (!image && card) {
                var pictureSource = card.querySelector('picture source[srcset], source[srcset]');
                if (pictureSource) image = pictureSource;
            }

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

                poster: getPosterByAnimeId(url) || getFullPoster(card, url, pageUrl) || getPoster(image, pageUrl),
                posterFallback: getFullPoster(card, url, pageUrl) || getPoster(image, pageUrl)

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
     * POST-запрос. DLE часто отправляет штатную форму поиска именно POST-методом.
     */
    this.post = function (url, data, success, error) {
        var target = PROXY_URL
            ? PROXY_URL + encodeURIComponent(url)
            : url;

        request.native(
            target,
            function (response) {
                if (typeof success === 'function') success(response);
            },
            function (xhr, status) {
                console.error('[AniStar] POST request error:', xhr, status);
                if (typeof error === 'function') error(xhr, status);
            },
            data,
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

    /*
 * Поиск DLE: сначала отправляем штатную POST-форму, затем при пустой
 * выдаче или ошибке пробуем GET-вариант. Оба варианта используют одни
 * и те же параметры формы и один парсер каталога.
 */
/*
 * AniStar принимает параметры поиска в кодировке Windows-1251.
 * encodeURIComponent() отправляет UTF-8, из-за чего сайт видел
 * кириллицу как «РњРѕ...». Кодируем строку в байты CP1251 вручную.
 */
function encodeAniStarQuery(value) {
    var special = {
        '\u0402': 0x80, '\u0403': 0x81, '\u201A': 0x82, '\u0453': 0x83,
        '\u201E': 0x84, '\u2026': 0x85, '\u2020': 0x86, '\u2021': 0x87,
        '\u20AC': 0x88, '\u2030': 0x89, '\u0409': 0x8A, '\u2039': 0x8B,
        '\u040A': 0x8C, '\u040C': 0x8D, '\u040B': 0x8E, '\u040F': 0x8F,
        '\u0452': 0x90, '\u2018': 0x91, '\u2019': 0x92, '\u201C': 0x93,
        '\u201D': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
        '\u2122': 0x99, '\u0459': 0x9A, '\u203A': 0x9B, '\u045A': 0x9C,
        '\u045C': 0x9D, '\u045B': 0x9E, '\u045F': 0x9F, '\u00A0': 0xA0,
        '\u040E': 0xA1, '\u045E': 0xA2, '\u0408': 0xA3, '\u0490': 0xA5,
        '\u0401': 0xA8, '\u0404': 0xAA, '\u0407': 0xAF, '\u0406': 0xB2,
        '\u0456': 0xB3, '\u0491': 0xB4, '\u0451': 0xB8, '\u0454': 0xBA,
        '\u0458': 0xBC, '\u0405': 0xBD, '\u0455': 0xBE, '\u0457': 0xBF
    };
    var result = '';
    var text = String(value || '');

    for (var i = 0; i < text.length; i++) {
        var code = text.charCodeAt(i);
        var byte;

        if (code === 0x20) {
            result += '+';
            continue;
        }
        if (code >= 0x41 && code <= 0x5A ||
            code >= 0x61 && code <= 0x7A ||
            code >= 0x30 && code <= 0x39 ||
            code === 0x2D || code === 0x2E || code === 0x5F || code === 0x7E) {
            result += text.charAt(i);
            continue;
        }
        if (code >= 0x0410 && code <= 0x044F) {
            byte = code - 0x350;
        } else if (Object.prototype.hasOwnProperty.call(special, text.charAt(i))) {
            byte = special[text.charAt(i)];
        }

        if (typeof byte === 'number') {
            result += '%' + ('0' + byte.toString(16).toUpperCase()).slice(-2);
        } else {
            var encoded = encodeURIComponent(text.charAt(i));
            result += encoded.replace(/%[0-9a-f]{2}/gi, function (part) {
                return part.toUpperCase();
            });
        }
    }

    return result;
}


function requestAniStarSearch(network, query, complete, error) {
    var searchUrl = new URL('/', BASE_URL).origin +
        '/?do=search&mode=advanced&subaction=search&titleonly=3&story=' +
        encodeAniStarQuery(query) + '&skin_name=new36';

    // GET с CP1251: POST через объект Lampa кодирует кириллицу как UTF-8,
    // что на AniStar приводит к искажённому тексту запроса.
    network.get(searchUrl, function (html) {
        complete(html, searchUrl, 'GET-CP1251');
    }, error);
}


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

        // Поиск открывается поверх каталога через штатные Select/Input Lampa.
        // Исходная сетка остаётся в DOM, поэтому при возврате сохраняются
        // уже загруженные страницы, позиция прокрутки и выбранная карточка.
        var searchMode = false;
        var searchGrid = null;
        var savedCatalogFocus = null;
        var lastCatalogFocus = null;
        var lastSearchFocus = null;
        var searchRequest = null;

        function restoreCatalogView() {
            if (!searchMode) return;
            searchMode = false;

            if (searchGrid) {
                searchGrid.remove();
                searchGrid = null;
            }

            grid.show();

            try {
                // Input.edit возвращает управление тому контроллеру,
                // из которого была открыта клавиатура (в нашем случае Select).
                // Сам Select к этому моменту уже закрыт, поэтому принудительно
                // возвращаем активный контроллер каталога.
                Lampa.Controller.toggle('content', true);
                Lampa.Controller.collectionSet(root, false, true);
                var target = savedCatalogFocus && savedCatalogFocus.length &&
                    savedCatalogFocus.closest('body').length
                    ? savedCatalogFocus
                    : (lastCatalogFocus && lastCatalogFocus.length &&
                        lastCatalogFocus.closest('body').length ? lastCatalogFocus : grid.find('.anistar-card').first());
                if (target.length) Lampa.Controller.collectionFocus(target[0], root, true);
            } catch (e) {
                console.warn('[AniStar] Restore catalog focus:', e);
            }
        }

        function showSearchResults(list, query) {
            if (destroyed) return;

            if (!searchMode) {
                savedCatalogFocus = root.find('.anistar-card.focus').first();
                searchMode = true;
                grid.hide();
                searchGrid = $('<div class="anistar-grid anistar-search-grid"></div>');
                root.append(searchGrid);
            } else {
                searchGrid.empty();
            }

            if (!list.length) {
                searchGrid.append(
                    $('<div class="anistar-more"></div>').text('По запросу «' + query + '» ничего не найдено')
                );
            } else {
                list.forEach(function (item) {
                    // Поиск использует те же карточки, что и основной каталог.
                    // Нормализуем поля, потому что Lampa Search отдаёт poster_path,
                    // а ссылка AniStar может находиться в anistar_url или id.
                    var cardItem = $.extend({}, item, {
                        url: item.url || item.anistar_url || item.id || '',
                        poster: item.poster || item.anistar_poster || item.poster_path || '',
                        title: item.title || item.name || 'Без названия',
                        name: item.name || item.title || 'Без названия'
                    });

                    var card = createCard(cardItem);
                    card.on('hover:focus', function () {
                        lastSearchFocus = $(this);
                        scrollCardIntoView(this);
                    });
                    searchGrid.append(card);
                });
            }

            try {
                // После закрытия экранной клавиатуры Lampa может оставить
                // активным уже скрытый контроллер Select. Возвращаем content
                // ДО установки коллекции результатов, иначе пульт зависает.
                Lampa.Controller.toggle('content', true);
                Lampa.Controller.collectionSet(searchGrid, false, true);
                var firstResult = searchGrid.find('.anistar-card').first();

                if (firstResult.length) {
                    lastSearchFocus = firstResult;
                    Lampa.Controller.collectionFocus(firstResult[0], searchGrid, true);
                } else {
                    // Даже пустая выдача должна иметь selector в коллекции,
                    // иначе Navigator сохраняет старую/пустую коллекцию.
                    var emptyAction = $('<div class="selector anistar-more"></div>');
                    emptyAction.text('Ничего не найдено. Нажми OK, чтобы повторить поиск.');
                    emptyAction.on('hover:enter', function () {
                        showAniStarFilter();
                    });
                    searchGrid.append(emptyAction);
                    Lampa.Controller.collectionSet(searchGrid, false, true);
                    Lampa.Controller.collectionFocus(emptyAction[0], searchGrid, true);
                }
            } catch (e) {
                console.warn('[AniStar] Search collection:', e);
            }
        }

        function runCatalogSearch(value) {
            var query = cleanText(value);
            if (!query) {
                Lampa.Noty.show('Введи название аниме для поиска.');
                return;
            }

            if (searchRequest) searchRequest.clear();
            searchRequest = new AniStarNetwork();

            Lampa.Noty.show('Ищем на AniStar: ' + query);

            requestAniStarSearch(searchRequest, query, function (html, searchUrl, method) {
                if (destroyed) return;

                try {
                    var sourceHtml = String(html || '');
                    var parsed = parseCatalog(sourceHtml, searchUrl);
                    var debugDoc = new DOMParser().parseFromString(sourceHtml, 'text/html');
                    var allLinks = debugDoc.querySelectorAll('a[href]');
                    var animeLikeLinks = [];
                    var hrefSamples = [];

                    Array.prototype.forEach.call(allLinks, function (link) {
                        var href = absoluteUrl(link.getAttribute('href'), searchUrl);
                        if (isAniStarUrl(href) && /\\.html(?:$|[?#])/i.test(href) &&
                            animeLikeLinks.indexOf(href) < 0) animeLikeLinks.push(href);
                        if (hrefSamples.length < 8) {
                            hrefSamples.push(cleanText(link.textContent).slice(0, 45) +
                                ' → ' + String(link.getAttribute('href') || '').slice(0, 100));
                        }
                    });

                    console.log('[AniStar] Catalog search diagnostics:', {
                        query: query,
                        method: method,
                        url: searchUrl,
                        finalTitle: cleanText(debugDoc.title),
                        htmlLength: sourceHtml.length,
                        links: allLinks.length,
                        parsedTitles: parsed.items.length,
                        animeLikeLinks: animeLikeLinks.slice(0, 10),
                        hrefSamples: hrefSamples,
                        bodyText: cleanText(debugDoc.body && debugDoc.body.textContent).slice(0, 700)
                    });

                    if (!parsed.items.length) {
                        var bodyExcerpt = cleanText(debugDoc.body && debugDoc.body.textContent).slice(0, 180);
                        Lampa.Noty.show('AniStar (' + method + '): ' + allLinks.length + ' ссылок, ' +
                            animeLikeLinks.length + ' страниц .html. ' + (bodyExcerpt || 'Ответ пустой'));
                    }

                    showSearchResults(parsed.items, query);
                } catch (e) {
                    console.error('[AniStar] Catalog search parse error:', e);
                    Lampa.Noty.show('Не удалось обработать результаты поиска AniStar.');
                }
            }, function (xhr, status) {
                if (destroyed) return;
                console.error('[AniStar] Catalog search request failed:', status || xhr);
                Lampa.Noty.show('Не удалось выполнить поиск AniStar.');
            });
        }

        function showAniStarFilter() {
            if (!Lampa.Select || typeof Lampa.Select.show !== 'function') {
                Lampa.Noty.show('Меню фильтра недоступно в этой версии Lampa.');
                return;
            }

            Lampa.Select.show({
                title: 'Фильтр',
                items: [{ title: 'Поиск' }],
                onBack: function () {
                    Lampa.Controller.toggle('content');
                },
                onSelect: function () {
                    if (!Lampa.Input || typeof Lampa.Input.edit !== 'function') {
                        Lampa.Noty.show('Поле поиска недоступно в этой версии Lampa.');
                        Lampa.Controller.toggle('content');
                        return;
                    }

                    Lampa.Input.edit({
                        title: 'Поиск по AniStar',
                        value: '',
                        free: true,
                        nosave: true
                    }, function (newValue) {
                        runCatalogSearch(newValue);
                    });
                }
            });
        }


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
                    var fallback = item.posterFallback || '';
                    if (fallback && fallback !== item.poster && !img.data('fallback-tried')) {
                        img.data('fallback-tried', true);
                        img.attr('src', fallback);
                        return;
                    }

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
                    lastCatalogFocus = $(this);
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
                var activeGrid = searchMode && searchGrid ? searchGrid : grid;
                var current = keepFocus
                    ? activeGrid.find('.anistar-card.focus').first()
                    : $();
                if (!current.length) {
                    current = searchMode ? lastSearchFocus : lastCatalogFocus;
                }
                if (!current || !current.length || !activeGrid[0].contains(current[0])) {
                    current = activeGrid.find('.anistar-card').first();
                }

                // В коллекцию попадают только видимые элементы: скрытая сетка
                // каталога не должна перехватывать фокус во время поиска.
                Lampa.Controller.collectionSet(root, false, true);

                if (current.length && current[0].offsetParent !== null) {
                    Lampa.Controller.collectionFocus(current[0], root, true);
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
                        var activeGrid = searchMode && searchGrid ? searchGrid : grid;
                        var target = searchMode ? lastSearchFocus : lastCatalogFocus;

                        Lampa.Controller.collectionSet(root, false, true);

                        if (!target || !target.length || !activeGrid[0].contains(target[0]) ||
                            target[0].offsetParent === null) {
                            target = activeGrid.find('.anistar-card').first();
                        }

                        if (!target.length) target = activeGrid.find('.selector').first();

                        if (target.length) {
                            if (searchMode && target.hasClass('anistar-card')) lastSearchFocus = target;
                            else if (!searchMode && target.hasClass('anistar-card')) lastCatalogFocus = target;
                            Lampa.Controller.collectionFocus(target[0], root, true);
                        }
                    } catch (e) {
                        console.warn('[AniStar] Controller restore:', e);
                    }
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
                    if (nav && nav.canmove && nav.canmove('right')) nav.move('right');
                    else if (!searchMode) showAniStarFilter();
                },
                back: function () {
                    if (searchMode) restoreCatalogView();
                    else Lampa.Activity.backward();
                }
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

                fullVersionUrl(url),


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

            // Контроллер content общий для Lampa. Следующая Activity сама
            // зарегистрирует свой обработчик при start(); здесь его не удаляем.

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
        var lastDetailFocus = null;
        var detailController = null;

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
        watch.on('hover:focus', function () {
            lastDetailFocus = watch;
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
                    frame.getAttribute('data-original'),
                    frame.getAttribute('data-iframe'),
                    frame.getAttribute('data-url'),
                    frame.getAttribute('data-link'),
                    frame.getAttribute('data-player')
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
                    var attrPattern = /(?:src|data-src|data-lazy-src|data-original|data-iframe|data-url|data-link|data-player)\s*=\s*(['"])(.*?)\1/ig;
                    var attrMatch;

                    while ((attrMatch = attrPattern.exec(tag))) {
                        if (/videoas_p2p_new\.php/i.test(attrMatch[2])) {
                            candidates.push(attrMatch[2]);
                        }
                    }
                }
            }

            /*
             * В некоторых публикациях адрес плеера отличается.
             * Проверяем iframe внутри известных видеоконтейнеров,
             * не подхватывая рекламные iframe со всей страницы.
             */
            if (!candidates.length) {
                var videoFrames = doc.querySelectorAll(
                    '.video_as iframe, #vid_2 iframe, .video-box iframe, ' +
                    '.video-container iframe, .video-block iframe, ' +
                    '.player iframe, #player iframe, #video iframe, ' +
                    '.tabs-box iframe, .tabs-content iframe'
                );

                Array.prototype.forEach.call(videoFrames, function (frame) {
                    var attrs = [
                        frame.getAttribute('src'),
                        frame.getAttribute('data-src'),
                        frame.getAttribute('data-lazy-src'),
                        frame.getAttribute('data-original'),
                        frame.getAttribute('data-iframe'),
                        frame.getAttribute('data-url'),
                        frame.getAttribute('data-link'),
                        frame.getAttribute('data-player')
                    ];

                    attrs.forEach(function (value) {
                        if (!value) return;
                        var candidate = absoluteUrl(value, item.url);
                        if (!candidate || /^(?:about:blank|javascript:)/i.test(candidate)) return;
                        if (/youtube|doubleclick|googlesyndication|yandex\.ru\/metrika/i.test(candidate)) return;
                        candidates.push(value);
                    });
                });
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
                row.on('hover:focus', function () {
                    lastDetailFocus = row;
                });

                episodeList.append(row);
            });

            if (window.Lampa && Lampa.Controller) {
                try {
                    // Регистрируем весь экран, а не только список серий:
                    // так пульт сохраняет единый контекст навигации между
                    // кнопкой «Смотреть» и динамически добавленными сериями.
                    Lampa.Controller.collectionSet(root, false, true);
                    var first = episodeList.find('.anistar-episode').first();
                    if (first.length) {
                        lastDetailFocus = first;
                        Lampa.Controller.collectionFocus(first[0], root, true);
                    }
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

            // Нормализуем ссылку, полученную из результата поиска.
            // В карточках каталога url уже абсолютный, но поисковая выдача
            // может содержать относительный адрес или альтернативное поле id.
            var articleUrl = absoluteUrl(item.url || item.id, BASE_URL);
            if (!articleUrl || !isAnimeUrl(articleUrl)) {
                loading = false;
                showError('Некорректная ссылка на страницу аниме.');
                console.warn('[AniStar] Invalid detail URL:', item);
                return;
            }

            network.get(articleUrl, function (pageHtml) {
                if (destroyed) return;

                var playerUrl = getASPlayerUrl(pageHtml);

                if (!playerUrl) {
                    var failedDoc = new DOMParser().parseFromString(String(pageHtml || ''), 'text/html');
                    var failedTitle = cleanText(failedDoc.title || '');
                    var failedText = cleanText(failedDoc.body && failedDoc.body.textContent || '').slice(0, 240);
                    console.warn('[AniStar] AS iframe missing on article:', {
                        requestedUrl: articleUrl,
                        itemUrl: item.url,
                        itemId: item.id,
                        htmlLength: String(pageHtml || '').length,
                        pageTitle: failedTitle,
                        bodyText: failedText
                    });
                    loading = false;
                    showError('Не найден iframe AS. Страница: ' + (failedTitle || articleUrl));
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


        function loadDetailPoster() {
            var articleUrl = absoluteUrl(item.url || item.id, BASE_URL);
            if (!articleUrl || !isAnimeUrl(articleUrl)) return;

            network.get(fullVersionUrl(articleUrl), function (pageHtml) {
                if (destroyed) return;
                var source = getArticlePoster(pageHtml, articleUrl);
                if (!source) {
                    console.warn('[AniStar] Detail poster not found:', articleUrl);
                    return;
                }
                var image = poster.find('img').first();
                if (!image.length) {
                    image = $('<img>');
                    poster.empty().append(image);
                }
                image.attr('src', source);
                item.poster = source;
                console.log('[AniStar] Detail poster loaded:', source);
            }, function () {
                console.warn('[AniStar] Detail poster request failed:', articleUrl);
            });
        }

        this.create = function () {
            // Обновляем обложку независимо от загрузки серий.
            loadDetailPoster();
            return this.render();
        };

        this.render = function () {
            return root;
        };

        this.start = function () {
            if (!window.Lampa || !Lampa.Controller) return;

            function navigator() {
                return window.Navigator || (window.Lampa && Lampa.Navigator) || null;
            }

            function activeTarget() {
                if (lastDetailFocus && lastDetailFocus.length &&
                    lastDetailFocus.closest('body').length &&
                    lastDetailFocus[0].offsetParent !== null) {
                    return lastDetailFocus;
                }

                var focused = root.find('.selector.focus:visible').first();
                if (focused.length) return focused;

                var firstEpisode = episodeList.find('.anistar-episode:visible').first();
                return firstEpisode.length ? firstEpisode : watch;
            }

            detailController = {
                link: this,
                toggle: function () {
                    try {
                        Lampa.Controller.collectionSet(root, false, true);
                        var target = activeTarget();
                        if (target.length) Lampa.Controller.collectionFocus(target[0], root, true);
                    } catch (e) {
                        console.warn('[AniStar] Detail controller restore:', e);
                    }
                },
                left: function () {
                    var nav = navigator();
                    if (nav && nav.canmove && nav.canmove('left')) nav.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                right: function () {
                    var nav = navigator();
                    if (nav && nav.canmove && nav.canmove('right')) nav.move('right');
                },
                up: function () {
                    var nav = navigator();
                    if (nav && nav.canmove && nav.canmove('up')) nav.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () {
                    var nav = navigator();
                    if (nav && nav.canmove && nav.canmove('down')) nav.move('down');
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            };

            try {
                // У каждого экрана свой обработчик content. При возврате назад
                // родительская Activity зарегистрирует свой контроллер в start().
                Lampa.Controller.add('content', detailController);
                Lampa.Controller.toggle('content', true);
            } catch (e) {
                console.warn('[AniStar] Ошибка навигации экрана:', e);
            }
        };

        this.stop = function () {};

        this.destroy = function () {
            destroyed = true;
            // Не удаляем content: при возврате родительская Activity
            // зарегистрирует свой контроллер в собственном start().
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
                noimage: false,
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

                requestAniStarSearch(searchNetwork, query, function (html, searchUrl, method) {
                    try {
                        var parsed = parseCatalog(html, searchUrl);
                        var debugDoc = new DOMParser().parseFromString(String(html || ''), 'text/html');
                        var debugLinks = debugDoc.querySelectorAll('a[href]');
                        var debugAnimeLinks = [];
                        Array.prototype.forEach.call(debugLinks, function (link) {
                            var href = absoluteUrl(link.getAttribute('href'), searchUrl);
                            if (isAnimeUrl(href) && debugAnimeLinks.indexOf(href) < 0) {
                                debugAnimeLinks.push(href);
                            }
                        });
                        console.log('[AniStar] Search diagnostics:', {
                            query: query,
                            method: method,
                            url: searchUrl,
                            htmlLength: String(html || '').length,
                            pageTitle: cleanText(debugDoc.title),
                            links: debugLinks.length,
                            animeLinks: debugAnimeLinks.length,
                            samples: debugAnimeLinks.slice(0, 5),
                            bodyText: cleanText(debugDoc.body && debugDoc.body.textContent).slice(0, 500)
                        });
                        if (!parsed.items.length && Lampa.Noty && typeof Lampa.Noty.show === 'function') {
                            var debugBody = cleanText(debugDoc.body && debugDoc.body.textContent).slice(0, 260);
                            Lampa.Noty.show(
                                'AniStar ' + method + ': HTML ' + String(html || '').length +
                                '; ссылок ' + debugLinks.length +
                                '; тайтлов ' + debugAnimeLinks.length +
                                '. Текст: ' + (debugBody || 'пусто').slice(0, 220)
                            );
                        }
                        var results = parsed.items.map(function (item) {
                            return {
                                id: item.url,
                                title: item.title,
                                name: item.title,
                                // Не задаём poster_path: Lampa считает его путём TMDB
                                // и прогоняет через Lampa.Api.img(), ломая внешний URL AniStar.
                                // Для внешних постеров используем прямые поля poster и img.
                                poster: item.poster || '',
                                img: item.poster || '',
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

                // Закрываем глобальный поиск до открытия новой Activity:
                // done() переключает Controller на content и не должен
                // перезаписывать контроллер только что открытого экрана.
                if (typeof done === 'function') done();

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




