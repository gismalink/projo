# План реализации (актуализация: 2026-02-18)

## 1) Назначение документа
- Этот файл хранит только **план предстоящих работ** и приоритеты.
- После закрытия блока задач, сделанный функционал фиксируется в документах и убирается отсюда.

## 2) Где фиксируется закрытое
- Технические результаты и срезы качества: `docs/audits/*`.
- Актуальная архитектура и инварианты: `docs/architecture-overview.md`.
- Актуальное продуктовое поведение: `docs/product-spec.md`.
- История изменений по коммитам/PR: git history.

## 3) Активные приоритеты

### P0 — Security remediation (из `security-audit-2026-02-18`)
1. [x] Закрыть high-уязвимости dependency-цепочки в `apps/api`:
   - [x] мигрировать `bcrypt` на `^6.0.0` (или согласованный эквивалент),
   - [x] добиться `0 high/critical` для `npm audit -w apps/api --omit=dev --audit-level=high`.
2. [x] Ограничить CORS-policy:
   - [x] заменить `app.enableCors()` на allowlist через env (`ALLOWED_ORIGINS`),
   - [x] задать явные `methods/allowedHeaders/credentials`.
3. [x] Добавить базовый API hardening:
   - [x] подключить `helmet` с согласованной CSP-политикой,
   - [x] добавить rate-limit (`@nestjs/throttler`) для auth/public endpoints,
   - [x] усилить лимиты для `/auth/login`.
4. [x] Встроить security-gate в CI:
   - [x] отдельный job `npm audit` с fail threshold,
   - [x] policy по регулярному обновлению уязвимых зависимостей.

### P1 — Модель окружений и релизный контур
1. [x] Зафиксировать модель: `dev` локально (на машине разработчика), `test/prod` публично.
2. [x] Описать environment matrix:
   - [x] отдельные env-файлы,
   - [x] отдельные секреты,
   - [x] отдельные БД для `test` и `prod`.
3. [x] Ввести релизный поток: `dev(local) -> test(public) -> prod(public)`.
4. [x] Определить rollback-процедуру для приложения и БД.

### P2 — Разворачивание на существующем Mac-сервере (`gismalink.art`)
1. [ ] Сохранить текущий сайт на `gismalink.art` без деградации.
2. [ ] Настроить reverse-proxy (Dockerized `nginx`/`caddy`/`traefik`) с host-routing:
   - [ ] `gismalink.art` -> текущий legacy upstream,
   - [ ] `test.projo.gismalink.art` -> `projo-web-test` + `projo-api-test`,
   - [ ] `projo.gismalink.art` -> `projo-web-prod` + `projo-api-prod`.
3. [ ] Подготовить DNS записи:
   - [ ] `A test.projo.gismalink.art -> <public-ip>`,
   - [ ] `A projo.gismalink.art -> <public-ip>`.
4. [ ] Разделить docker-стэки `test` и `prod`:
   - [ ] отдельные `.env.test` / `.env.prod`,
   - [ ] отдельные volume/сети/секреты,
   - [ ] Postgres только во внутренней сети (без внешней публикации).
5. [x] Внедрить runbook запуска/обновления/rollback.

### P3 — Качество и проверка поставки
1. [ ] Закрепить минимальный набор post-deploy проверок для `test`:
   - [ ] `npm run verify`,
   - [ ] `SMOKE_API=1 npm run verify`,
   - [ ] ручной smoke критического user-flow.
2. [ ] Добавить release checklist перед `prod`:
   - [ ] backup БД,
   - [ ] green test-smoke,
   - [ ] подтвержденный changelog,
   - [ ] мониторинг после выката.
3. [ ] Добавить базовую наблюдаемость:
   - [ ] access/error logs,
   - [ ] uptime/5xx/latency метрики,
   - [ ] алерты на деградацию health-check.

### P4 — Функциональные улучшения после стабилизации
1. [ ] Довести стабильность UX/метрик timeline на краевых сценариях.
2. [ ] Усилить тестовое покрытие критических сценариев (assignment/member, shift/resize, auth-flow).
3. [ ] Подготовить следующий пакет продуктовых улучшений (отчеты, фильтры, интеграционные API-контракты).

## 4) Definition of Done для ближайшего этапа
- [ ] Security-пункты P0 закрыты или имеют согласованные mitigation + дедлайн.
- [ ] `test` и `prod` контуры опубликованы, изолированы и проходят smoke.
- [x] `dev` остается локальным, без внешней публикации.
- [x] Документирован runbook для deploy/rollback.

## 5) Связанные документы
- `docs/audits/security-audit-2026-02-18.md`
- `docs/architecture-overview.md`
- `docs/product-spec.md`
- `docs/workflow-checklist.md`
- `docs/release-runbook.md`
- `docs/server-deploy-mac.md`
