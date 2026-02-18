# Server Deploy Guide (Mac host)

Актуализация: 2026-02-18

## 1) Что поднимает этот контур
- Reverse-proxy (Caddy) с host-routing:
  - `gismalink.art` -> legacy upstream,
  - `test.projo.gismalink.art` -> `projo-web-test` + `projo-api-test`,
  - `projo.gismalink.art` -> `projo-web-prod` + `projo-api-prod`.
- Изолированные `test/prod` БД и приложения в одном docker-compose контуре.

## 2) Подготовка DNS
Создать A-record на публичный IP сервера:
- `test.projo.gismalink.art`
- `projo.gismalink.art`

## 3) Подготовка env-файлов на сервере
1. Скопировать шаблоны:
   - `cp infra/.env.host.example infra/.env.host`
   - `cp apps/api/.env.test.example apps/api/.env.test`
   - `cp apps/api/.env.prod.example apps/api/.env.prod`
   - `cp apps/web/.env.test.example apps/web/.env.test`
   - `cp apps/web/.env.prod.example apps/web/.env.prod`
2. Заменить все `<replace-with-...>` на реальные секреты.
3. В `infra/.env.host` указать `LEGACY_UPSTREAM` для текущего сайта.

## 4) Первый запуск
Из корня репозитория:
- `docker compose -f infra/docker-compose.host.yml --env-file infra/.env.host up -d`

Проверка:
- `docker compose -f infra/docker-compose.host.yml ps`
- `curl -I https://test.projo.gismalink.art`
- `curl -I https://projo.gismalink.art`
- `curl -I https://projo.gismalink.art/api/health`

## 5) Обновление релиза
1. Обновить код (`git pull`).
2. Для `test` перезапустить только test-сервисы:
   - `docker compose -f infra/docker-compose.host.yml --env-file infra/.env.host up -d --force-recreate projo-api-test projo-web-test`
3. После проверки `test` продвинуть тот же commit в `prod`:
   - `docker compose -f infra/docker-compose.host.yml --env-file infra/.env.host up -d --force-recreate projo-api-prod projo-web-prod`
4. Выполнить smoke-проверки из `docs/release-runbook.md`.

## 6) Rollback
1. Вернуться на предыдущий стабильный commit/tag.
2. Выполнить:
   - `docker compose -f infra/docker-compose.host.yml --env-file infra/.env.host up -d --force-recreate`
3. Если проблема в миграции БД — восстановить соответствующий backup `test`/`prod`.

## 7) Ограничения текущего каркаса
- Контур предназначен как bootstrap-конфигурация для P2.
- Для production-hardening следующего шага рекомендуется перейти на prebuilt image pipeline (вместо runtime `npm ci` внутри контейнеров).
