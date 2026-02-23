# План реализации (актуализация: 2026-02-23)

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

### P1.5 — Миграция на Central SSO (auth.gismalink.art)
1. [x] Зафиксировать целевую модель:
   - [x] `test/prod`: только SSO (без local email/password логина),
   - [x] `dev(local)`: допускается local auth (опционально) для удобства разработки.
2. [x] API: принимать JWT central auth (без отдельного exchange-токена):
   - [x] валидировать issuer (`JWT_ALLOWED_ISSUERS`) и ключи (`JWT_SECRETS`),
   - [x] авто-provision user по email (если включено `SSO_AUTO_PROVISION=true`).
3. [x] Web: заменить экран login/register на SSO-only в `VITE_AUTH_MODE="sso"`:
   - [x] редирект на central auth с `returnUrl` обратно в projo,
   - [x] после возврата — получить JWT через `GET /api/sso/get-token` и продолжить сессию.
4. [x] Отключить local auth в `test/prod` через env-flag:
   - [x] `POST /auth/login` и `POST /auth/register` возвращают 410 `ERR_AUTH_LOCAL_AUTH_DISABLED`.
5. [x] Logout:
   - [x] UI logout чистит локальный токен и инициирует logout в central auth.
6. [x] Документация и смоук:
   - [x] обновить `docs/api-reference.md` / `docs/release-runbook.md` с шагами SSO,
   - [x] добавить минимальный smoke: login->me->projects->logout.

### P2 — Разворачивание на существующем Mac-сервере (`gismalink.art`)
1. [x] Сохранить текущий сайт на `gismalink.art` без деградации.
2. [x] Настроить reverse-proxy (Dockerized `caddy`) с host-routing:
   - [x] `gismalink.art` -> текущий legacy upstream,
   - [x] `test.projo.gismalink.art` -> `projo-web-test` + `projo-api-test`,
   - [x] `projo.gismalink.art` -> `projo-web-prod` + `projo-api-prod`.
3. [x] Подготовить DNS записи:
   - [x] `A test.projo.gismalink.art -> <public-ip>`,
   - [x] `A projo.gismalink.art -> <public-ip>`.
4. [x] Разделить docker-стэки `test` и `prod`:
   - [x] отдельные `.env.test` / `.env.prod`,
   - [x] отдельные volume/сети/секреты,
   - [x] Postgres только во внутренней сети (без внешней публикации).
5. [x] Внедрить runbook запуска/обновления/rollback.

### P3 — Качество и проверка поставки
0. [x] CI quality-gates:
   - [x] `npm run check` на PR/push (`.github/workflows/ci.yml`),
   - [x] nightly runtime smoke API (local auth + ephemeral DB) (`.github/workflows/nightly-api-smoke.yml`).
1. [ ] Закрепить минимальный набор post-deploy проверок для `test`:
   - [ ] `npm run check`,
   - [ ] `SMOKE_API=1 npm run check`,
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
3. [ ] Добавить страницу статистики для владельца/админа:
   - [ ] общее количество пользователей,
   - [ ] общее количество проектов,
   - [ ] количество проектов по каждому пользователю.
4. [ ] Исследовать и реализовать мультикурсор в рамках проекта (desktop-only):
   - [ ] пользователи в одном проекте видят курсоры друг друга в реальном времени,
   - [ ] поддержать роли viewer/editor/owner,
   - [ ] не включать функциональность на мобильных устройствах.
5. [ ] Проверить адаптивность ключевых экранов и исправить стили для мобильных устройств.
6. [ ] Добавить кнопку «Создать шаблонный проект» (seed demo-данных):
   - [ ] создать 10 сотрудников с ролями и именами вида `Дизайнер Дизайнерски`, `Моделлер Моделлерски`, `Юнити Юнитевски`, `Юнити Грантовски`, `Веб Вебовски`, `Бэк Бэковски`, `Анали Аналитовски`, `Текст Текстисовски`, `Руководски`, `Тестировски`,
   - [ ] назначить каждому отдел и грейд,
   - [ ] создать 2–3 проекта,
   - [ ] равномерно распределить сотрудников по этапам и проектам.
7. [ ] Добавить предварительную валидацию полей на фронте (до отправки формы на API).
   - [x] Авторизация (`login/register`): email format + min длины полей до API-запроса.
8. [x] В попапе авторизации центрировать кнопки «Войти» и «Зарегистрировать».
9. [x] На скамейке у выделенного сотрудника показывать «галочку» для явного отличия выбранного состояния от hover.
10. [x] Для выделенного сотрудника в timeline показывать только проекты, в которых он участвует, и только его самого в этих проектах (полная фильтрация связанных данных).
11. [x] Добавить выделение целого отдела на скамейке с фильтрацией timeline по выбранному отделу.
   - [x] Сделать выбор сотрудник/отдел взаимоисключающим.
   - [x] Добавить заметный selected-state отдела (стиль + галочка).
   - [x] Принудительно раскрывать проекты, где есть подсветка/фильтрация.
12. [ ] Подготовить следующий пакет продуктовых улучшений (отчеты, фильтры, интеграционные API-контракты).

## 4) Definition of Done для ближайшего этапа
- [x] Security-пункты P0 закрыты или имеют согласованные mitigation + дедлайн.
- [x] `test` и `prod` контуры опубликованы, изолированы и проходят smoke.
- [x] `dev` остается локальным, без внешней публикации.
- [x] Документирован runbook для deploy/rollback.

## 5) Связанные документы
- `docs/audits/security-audit-2026-02-18.md`
- `docs/architecture-overview.md`
- `docs/product-spec.md`
- `docs/workflow-checklist.md`
- `docs/release-runbook.md`
- `docs/server-deploy-mac.md`
