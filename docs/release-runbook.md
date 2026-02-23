# Release Runbook (test/prod)

Актуализация: 2026-02-20

## Оперативное правило (для команд в чате)
- Фраза «деплой на test» означает запуск **на сервере по SSH**, а не локально.
- Команда по умолчанию:
   - `ssh mac-mini-projo 'export PATH=/usr/local/bin:$PATH; cd ~/projo && npm run deploy:test'`
- Если явно не указано иное, использовать именно этот сценарий обновления test-окружения.
- Фраза «деплой в prod/продакшн» означает запуск **на сервере по SSH** и promotion того же коммита, который уже прошёл проверку на `test`.
- Команда по умолчанию для `prod`:
   - `ssh mac-mini-projo 'export PATH=/usr/local/bin:$PATH; cd ~/projo && docker compose -f infra/docker-compose.host.yml --env-file infra/.env.host up -d --force-recreate projo-api-prod projo-web-prod'`

## 1) Модель окружений
- `dev` — локально на машине разработчика, без внешней публикации.
- `test` — публичный стенд для проверки релизного кандидата.
- `prod` — публичный боевой контур.
- Внешний reverse proxy для `test/prod` вынесен в отдельный `edge` stack; `projo` compose управляет только app+db сервисами.

## 2) Environment matrix
| Параметр | dev | test | prod |
|---|---|---|---|
| Web URL | `http://localhost:5173` | `https://test.projo.gismalink.art` | `https://projo.gismalink.art` |
| API URL | `http://localhost:4000/api` | `https://test.projo.gismalink.art/api` | `https://projo.gismalink.art/api` |
| DB | локальная (`localhost:5432`) | отдельная БД `projo_test` | отдельная БД `projo_prod` |
| API env template | `apps/api/.env.example` | `apps/api/.env.test.example` | `apps/api/.env.prod.example` |
| Web env template | `apps/web/.env.example` | `apps/web/.env.test.example` | `apps/web/.env.prod.example` |
| Секреты | локальные dev | отдельные test-secrets | отдельные prod-secrets |

## 3) Release flow
1. Разработка в `dev` (локально).
2. Публикация ветки и PR в default branch (`main`).
3. Проверка CI (`check`, `Audit API dependencies`).
4. Deploy на `test`.
5. Проверка на `test`:
   - `npm run check`,
   - `SMOKE_API=1 npm run check`,
   - ручной smoke критических сценариев.

Минимальный ручной smoke (SSO, test/prod):
- Открыть web (`test.projo...` / `projo...`) и выполнить вход через SSO (Google/Yandex).
- Убедиться, что загружается Timeline и нет 401 на запросах.
- (Опционально) проверить `GET /api/auth/me` и `GET /api/auth/projects` через UI.
- Выполнить logout и убедиться, что происходит редирект на central auth logout.
6. Promote того же релизного коммита на `prod`.

## 3.1) Пошагово: dev -> test -> prod

### Шаг A. Подготовка релиз-кандидата (локально)
1. Создать feature-ветку от `main` и внести изменения.
2. Выполнить проверки:
   - `npm run check`
   - `npm run audit:api`
3. Открыть PR в `main`, дождаться зелёного CI и merge.

### Шаг B. Фиксация коммита для promotion
1. После merge получить SHA релиза:
   - `git fetch origin`
   - `git log origin/main -1 --oneline`
2. (Опционально) поставить тег релиз-кандидата:
   - `git tag -a rc-YYYYMMDD-HHMM <sha> -m "release candidate"`
   - `git push origin rc-YYYYMMDD-HHMM`

### Шаг C. Deploy на test (сервер)
1. На сервере перейти в каталог репозитория и зафиксировать нужный SHA:
   - `git fetch --all --tags`
   - `git checkout <sha>`
2. Перезапустить только test-сервисы:
   - `docker compose -f infra/docker-compose.host.yml --env-file infra/.env.host up -d --force-recreate projo-api-test projo-web-test`
3. Проверить test:
   - `curl -fsS https://test.projo.gismalink.art/api/health`
   - `curl -I https://test.projo.gismalink.art`
   - ручной smoke ключевых сценариев.

### Упрощённый сценарий (одной SSH-командой)
- Для обычного обновления test до актуального `main`:
   - `ssh mac-mini-projo 'export PATH=/usr/local/bin:$PATH; cd ~/projo && npm run deploy:test'`
- Важно: в non-interactive SSH на macOS путь к Docker может не подхватываться автоматически, поэтому используется `export PATH=/usr/local/bin:$PATH`.

### Шаг D. Promote на prod (тот же SHA)
1. Не менять SHA (всё ещё `git checkout <sha>` на сервере).
2. Перезапустить только prod-сервисы:
   - `docker compose -f infra/docker-compose.host.yml --env-file infra/.env.host up -d --force-recreate projo-api-prod projo-web-prod`
3. Проверить prod:
   - `curl -fsS https://projo.gismalink.art/api/health`
   - `curl -I https://projo.gismalink.art`
4. Если есть проблема — rollback на предыдущий стабильный SHA и повтор `up -d --force-recreate` только для затронутого окружения.

## 4) Rollback procedure
### 4.1 App rollback
1. Определить последний стабильный commit/tag.
2. Переключить deployment на стабильную ревизию.
3. Проверить `/api/health` и критический user-flow.

### 4.2 DB rollback
1. Перед rollout всегда делать backup БД (`test` и `prod` отдельно).
2. Если миграция критично ломает работу:
   - остановить rollout,
   - восстановить БД из backup,
   - откатить приложение к совместимой ревизии.
3. После восстановления выполнить smoke-проверки.

## 5) Инварианты
- `dev` не публикуется наружу.
- `test` и `prod` используют разные БД, секреты и env-файлы.
- Прямые изменения в `prod` без прохождения `test` не допускаются.
- `prod` выкатывается только тем же SHA, который успешно прошёл `test`.
