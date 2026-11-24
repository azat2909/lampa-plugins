# API HentaiHub 0.49

AnimeHub использует API из Android-приложения HentaiHub 0.49. Базовый адрес — `https://api.hentaigo.me`. Полные пути ниже уже содержат префикс `/api`.

Сравнение APK 0.47 и 0.49 показало одинаковый базовый адрес, HTTP-методы, маршруты и поля моделей запросов и ответов. В обеих версиях у Retrofit 27 методов и 26 уникальных маршрутов. Методы каталога и полной карточки используют один `POST /api/news`.

## Формат запросов

Основной формат — `Content-Type: application/json`. Для загрузки изображения применяется `multipart/form-data`. Поля в таблицах отражают модели APK. Обязательность полей и права доступа подтверждаются отдельно для каждого запроса.

`news`, `filter`, `series`, `search` и `check-updates` проверены без входа на 24 ноября 2026 года. Запросы, которые меняют данные аккаунта или отправляют статистику, сверены с кодом APK.

## Список маршрутов

### Каталог, карточки и поиск

| Запрос | Назначение | Поля |
| --- | --- | --- |
| `POST /api/news` | Каталог или полная карточка | `cat`, `ids`, `limit`, `mode`, `page`, `refresh`, `skipCache`, `skipLoad`, `sort`, `token` |
| `POST /api/search` | Поиск | `search`, `where` |
| `POST /api/filter` | Фильтры каталога | `cat`, `limit`, `mode`, `negative`, `order`, `page`, `sort`, `strictly`, `studios`, `tags`, `token`, `yearFrom`, `yearTo` |
| `POST /api/series` | Записи из той же серии | `id`, `token` |
| `POST /api/users/recommended` | Рекомендации | `cat`, `ids`, `limit`, `mode`, `page`, `refresh`, `skipCache`, `skipLoad`, `sort`, `token` |

### Аккаунт и профиль

| Запрос | Назначение | Поля |
| --- | --- | --- |
| `POST /api/users/login` | Вход | `email`, `password` |
| `POST /api/users/register` | Регистрация | `confirmPassword`, `deviceKey`, `email`, `masterKey`, `name`, `password` |
| `POST /api/users/info/personal_info` | Свой профиль | `token` |
| `POST /api/users/info/public_info` | Публичный профиль | `name` |
| `POST /api/users/editdata` | Обновление профиля | `avatar`, `confidence`, `email`, `password`, `status`, `token` |
| `POST /api/users/upload` | Загрузка изображения | `token`, `type` и файл (`multipart/form-data`) |

### Списки и коллекции

| Запрос | Назначение | Поля |
| --- | --- | --- |
| `POST /api/users/lists` | Добавление записи в список | `list`, `newsId`, `targetList`, `token` |
| `POST /api/users/collections/list` | Список коллекций | `limit`, `name`, `page`, `token` |
| `POST /api/users/collections/add` | Создание коллекции | `confidence`, `descr`, `img_link`, `news_lists`, `playlistId`, `title`, `token` |
| `POST /api/users/collections/edit` | Изменение коллекции | `confidence`, `descr`, `img_link`, `news_lists`, `playlistId`, `title`, `token` |
| `POST /api/users/collections/delete` | Удаление коллекции | `playlistId`, `token` |

### Комментарии, оценки и жалобы

| Запрос | Назначение | Поля |
| --- | --- | --- |
| `POST /api/comments/news` | Комментарии к записи | `limit`, `order`, `page`, `parent`, `parentId`, `postId`, `sort` |
| `POST /api/comments/replies` | Ответы на комментарий | `limit`, `order`, `page`, `parent`, `parentId`, `postId`, `sort` |
| `POST /api/users/action/comments/add` | Добавление комментария | `news_id`, `parent_id`, `text`, `token` |
| `PUT /api/users/action/comments/edit` | Правка комментария | `comment_id`, `text`, `token` |
| `POST /api/users/action/comments/delete` | Удаление комментария | `comment_id`, `token` |
| `POST /api/users/action/comments/rating` | Оценка комментария | `comment_id`, `rating`, `token` |
| `POST /api/users/action/news_rating` | Оценка записи | `news_id`, `rating`, `token` |
| `POST /api/users/action/complain` | Жалоба | `n_id`, `text`, `token` |

### Служебные запросы

| Запрос | Назначение | Поля |
| --- | --- | --- |
| `POST /api/check-updates` | Проверка обновления APK | `version` |
| `POST /api/stats` | Статистика просмотра | `action`, `news_id`, `player_timer`, `rating`, `rewind_counter`, `videoDuration`, `watchedTime` |

## Примеры для AnimeHub

### Каталог и карточка

Первая страница каталога — `POST /api/news`.

```json
{"mode":"short","page":1,"limit":30}
```

Следующая страница использует `page: 2`. Сервер отдаёт массив записей. В проверенных ответах для одной записи встречались и массив из одного элемента, и одиночный объект. Счётчик страниц в этих ответах отсутствует.

Разделы «Обновленные», «Новые» и «Популярные» используют `sort` со значениями `editdate`, `date` и `news_read` соответственно. Для раздела «Коллекции» применяется `POST /api/users/collections/list` с `page` и `limit`. В массиве `playlists` поле `news_lists` содержит ID тайтлов через запятую. Плагин запрашивает эти тайтлы через `/api/news` с полем `ids`.

Полная карточка по ID — `POST /api/news`.

```json
{"mode":"full","ids":[3852],"page":1,"limit":1}
```

| Поле ответа | Применение в AnimeHub |
| --- | --- |
| `id` | Идентификатор записи для запроса полной карточки |
| `title` | Основное название и английское название, если они идут через ` / ` |
| `category` | Метка категории для исключения манги |
| `full_story` | Описание |
| `news_read`, `vote_num` | Просмотры и голоса |
| `related_ids` | ID тайтлов для «Рекомендуем также» |
| `xfields_data.alt_titles` | Запасной источник для английского названия |
| `xfields_data.poster` и `xfields_data.screen` | Постер и фон. В объектах изображений используются `url` и, при наличии, `thumb` |
| `xfields_data.studios` | Студия |
| `xfields_data.release_date` и `xfields_data.year` | Дата или год выпуска |
| `xfields_data.duration` | Длительность в секундах |
| `xfields_data.hentai_tags` | Метки каталога |
| `xfields_data.translate_type` | Описание вида перевода |

`POST /api/filter` принимает, например, `{"mode":"short","page":1,"limit":30,"tags":["<метка>"]}`. `POST /api/search` принимает `{"search":"<название>"}`. `POST /api/series` принимает `{"id":3852}` и возвращает объект с массивом `items`.

Для отбора по студии используется массив `studios` в `/api/filter`. «Связанные» берутся из `/api/series`. Для «Рекомендуем также» AnimeHub передаёт ID из `related_ids` в `POST /api/news` и сохраняет их порядок. Персональный запрос `/api/users/recommended` без токена вернул HTTP 401.

На обложке AnimeHub показывает `эп.2` по явному номеру эпизода или по числу в конце названия. Поле `xfields_data.season` в проверенных карточках содержит сезон года и для номера эпизода не используется.

`POST /api/comments/news` принимает `{"postId":3852,"page":1,"limit":12}` и отдаёт комментарии. Для отображения используются `id`, `autor`, `date`, `text` и `rating`.

### Видеопотоки

В полной карточке `xfields_data.plyr_json` содержит основной плеер. Ключи `voice`, `subs` и `raw` соответствуют озвучке, субтитрам и оригиналу. Озвучка может быть разбита на группы по студиям. Вариант видео содержит `source`, `type` и `quality`.

`xfields_data.json_player_subs` и `xfields_data.json_player_voice` содержат дополнительные варианты с полями `link`, `quality`, `title`, `type`. Поле `edit` связывает дополнительный источник с озвучкой.

При выборе «Дополнительный» AnimeHub сразу передаёт MP4 плееру, выбранному в Lampa. Для извлечённого со страницы MP4Upload потока требуется `Referer`. В этом случае AnimeHub использует внешний Android-плеер. При отсутствии MP4 можно запустить другой источник, если API передал прямую ссылку на видео. Страницы Moon, Hydra и UPS без прямого потока отфильтровываются.

### Проверка обновления

`POST /api/check-updates` принимает версию APK, с которой сравнивается релиз сервера.

```json
{"version":"0.49"}
```

При отсутствии обновления сервер вернул `{"hasUpdate":false}`. При отправке `0.47` сервер вернул `hasUpdate: true`, объект `latest` с полями `version` и `link` и объект `updates`. Ключи `updates` — версии, значения содержат `date` и `description`. Для уведомления в Lampa AnimeHub использует `hasUpdate` и `latest.version`.
