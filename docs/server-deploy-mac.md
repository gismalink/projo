# Server Deploy Guide (Mac host)

Актуализация: 2026-02-24

## Оперативное правило (для команд в чате)
- Фраза «деплой на test» означает запуск **на сервере по SSH**, а не локально на текущей машине.
- Runtime repo на сервере: `~/srv/projo`.
- Команда по умолчанию (в test деплоим ref/ветку или main):
   - `ssh mac-mini 'cd ~/srv/projo && ./scripts/examples/deploy-test-from-ref.sh origin/main ~/srv/projo'`
- Фраза «деплой в prod/продакшн» означает promotion уже проверенного SHA из `origin/main`.
- Команда по умолчанию для `prod`:
   - `ssh mac-mini 'cd ~/srv/projo && ./scripts/examples/deploy-prod-from-ref.sh origin/main ~/srv/projo'`

## 1) Что поднимает этот контур
- Изолированные `test/prod` БД и приложения `projo` в одном docker-compose контуре.
- Reverse-proxy (Caddy) вынесен в отдельный stack `edge` и маршрутизирует трафик на `projo-*` сервисы через external network `edge_public`.

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

Важно про web (Vite):
- `VITE_*` переменные вшиваются в bundle на этапе `vite build`.
- Поэтому для `test/prod` нужно прокидывать `VITE_API_URL`, `VITE_AUTH_MODE`, `VITE_AUTH_BASE_URL` в build (см. `infra/docker-compose.host.yml` -> `build.args`).

Важно:
- Перед запуском убедиться, что на сервере есть external network `edge_public`.
- Порты `80/443` в этом compose больше не публикуются (ими управляет отдельный `edge` stack).

Проверка:
- `docker compose -f infra/docker-compose.host.yml ps`
- `curl -I https://test.projo.gismalink.art`
- `curl -I https://projo.gismalink.art`
- `curl -I https://projo.gismalink.art/api/health`

## 5) Обновление релиза
1. Использовать deploy-скрипты (они:
   - делают `git fetch` + checkout detached SHA,
   - пересобирают образы,
   - перезапускают только нужные сервисы,
   - ждут `.../api/health`).
2. Test:
   - `./scripts/examples/deploy-test-from-ref.sh origin/main ~/srv/projo`
3. После проверки test — prod тем же SHA (из `origin/main`):
   - `./scripts/examples/deploy-prod-from-ref.sh origin/main ~/srv/projo`
4. Выполнить smoke-проверки из `docs/release-runbook.md`.

## 6) Rollback
1. Вернуться на предыдущий стабильный commit/tag.
2. Выполнить:
   - `docker compose -f infra/docker-compose.host.yml --env-file infra/.env.host up -d --force-recreate`
3. Если проблема в миграции БД — восстановить соответствующий backup `test`/`prod`.

## 7) Ограничения текущего каркаса
- Контур предназначен как bootstrap-конфигурация для P2.
- Для production-hardening следующего шага рекомендуется перейти на prebuilt image pipeline (вместо runtime `npm ci` внутри контейнеров).
