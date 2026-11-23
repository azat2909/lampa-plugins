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

Полная карточка по ID — `POST /api/news`.

```json
{"mode":"full","ids":[3852],"page":1,"limit":1}
```

| Поле ответа | Применение в AnimeHub |
| --- | --- |
| `id` | Идентификатор записи для запроса полной карточки |
| `title` | Основное название и английское название, если они идут через ` / ` |
| `full_story` | Описание |
| `xfields_data.alt_titles` | Запасной источник для английского названия |
| `xfields_data.poster` и `xfields_data.screen` | Постер и фон. В объектах изображений используются `url` и, при наличии, `thumb` |
| `xfields_data.studios` | Студия |
| `xfields_data.release_date` и `xfields_data.year` | Дата или год выпуска |
| `xfields_data.duration` | Длительность в секундах |
| `xfields_data.hentai_tags` | Метки каталога |
| `xfields_data.translate_type` | Описание вида перевода |

`POST /api/filter` принимает, например, `{"mode":"short","page":1,"limit":30,"tags":["<метка>"]}`. `POST /api/search` принимает `{"search":"<название>"}`. `POST /api/series` принимает `{"id":3852}` и возвращает объект с массивом `items`.

### Видеопотоки

В полной карточке `xfields_data.plyr_json` содержит основной плеер. Ключи `voice`, `subs` и `raw` соответствуют озвучке, субтитрам и оригиналу. Озвучка может быть разбита на группы по студиям. Вариант видео содержит `source`, `type` и `quality`.

`xfields_data.json_player_subs` содержит дополнительные варианты с полями `link`, `quality`, `title`, `type`. `link` может вести на страницу веб-плеера. Для запуска через штатный Player Lampa нужна прямая ссылка на видео. Проверенный MP4Upload требует `Referer` страницы плеера, поэтому AnimeHub использует такой вариант только с внешним Android-плеером.

### Проверка обновления

`POST /api/check-updates` принимает версию APK, с которой сравнивается релиз сервера.

```json
{"version":"0.49"}
```

При отсутствии обновления сервер вернул `{"hasUpdate":false}`. При отправке `0.47` сервер вернул `hasUpdate: true`, объект `latest` с полями `version` и `link` и объект `updates`. Ключи `updates` — версии, значения содержат `date` и `description`. Для уведомления в Lampa AnimeHub использует `hasUpdate` и `latest.version`.
