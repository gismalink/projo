# Release Runbook (test/prod)

Актуализация: 2026-02-18

## 1) Модель окружений
- `dev` — локально на машине разработчика, без внешней публикации.
- `test` — публичный стенд для проверки релизного кандидата.
- `prod` — публичный боевой контур.

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
2. Публикация ветки и PR в `master`.
3. Проверка CI (`verify`, `Audit API dependencies`).
4. Deploy на `test`.
5. Проверка на `test`:
   - `npm run verify`,
   - `SMOKE_API=1 npm run verify`,
   - ручной smoke критических сценариев.
6. Promote того же релизного коммита на `prod`.

## 3.1) Пошагово: dev -> test -> prod

### Шаг A. Подготовка релиз-кандидата (локально)
1. Создать feature-ветку от `master` и внести изменения.
2. Выполнить проверки:
   - `npm run verify`
   - `npm run audit:api`
3. Открыть PR в `master`, дождаться зелёного CI и merge.

### Шаг B. Фиксация коммита для promotion
1. После merge получить SHA релиза:
   - `git fetch origin`
   - `git log origin/master -1 --oneline`
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
