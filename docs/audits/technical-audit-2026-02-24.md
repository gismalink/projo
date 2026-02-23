# Технический аудит — 2026-02-24

Область: `apps/api`, `apps/web`, deploy/infra (`infra/*`, `scripts/examples/*`), согласованность документации.

## Краткое резюме
- Текущее состояние разворачивается и работает стабильно в `test/prod` (SSO-only) с усиленной security-базой (CORS allowlist, helmet, throttling).
- Ключевые оставшиеся риски: **дрейф конфигурации** (Vite env — compile-time; отсутствие build args приводит к сломанному prod bundle) и **операционная ясность** (deploy-скрипты оставляют repo в detached HEAD; build args захардкожены по окружениям).

## Находки

### A) Безопасность
**A1. CORS allowlist может отвечать ошибкой вместо «чистого» deny**
- Файл: `apps/api/src/main.ts`
- Сейчас: для запрещённого origin вызывается `callback(new Error('Origin is not allowed by CORS'))`.
- Риск: ответы могут выглядеть как 500; шумнее для клиентов и усложняет диагностику.
- Рекомендация: deny через `callback(null, false)` и (опционально) безопасное логирование origin / request id (без утечек секретов).

**A2. SSO proxy делает upstream fetch без timeout**
- Файл: `apps/api/src/auth/sso.controller.ts`
- Риск: зависание upstream может удерживать ресурсы и деградировать сервис под нагрузкой.
- Рекомендация: добавить timeout через `AbortController` (например 3–5с) и возвращать контролируемую ошибку.

**A3. Dependency audit — чисто**
- Команда: `npm run audit:api` (omit dev) => `0 vulnerabilities`.

### B) Надёжность / Ops
**B1. Vite `VITE_*` — compile-time; отсутствие build args ломает prod «тихо»**
- Файлы: `infra/Dockerfile.host`, `infra/docker-compose.host.yml`, `apps/web/src/api/client.ts`
- Симптом (уже ловили): bundle собирается с дефолтами (`localhost:4000/api`, `AUTH_MODE=local`), если build args не прокинуты.
- Рекомендация (короткий срок, уже сделано): держать build args в compose.
- Рекомендация (hardening): заменить fallback `VITE_API_URL` в web с `http://localhost:4000/api` на `/api`, чтобы misconfig был менее разрушительным.

**B2. Захардкоженные URL в compose build args**
- Файл: `infra/docker-compose.host.yml`
- Риск: дрейф при смене доменов; дублирование значений между test/prod.
- Рекомендация: перевести `build.args` на env-substitution (или вынести в `infra/.env.host`), чтобы был единый источник значений.

**B3. Deploy-скрипты всегда делают checkout в detached HEAD**
- Файлы: `scripts/examples/deploy-test-from-ref.sh`, `scripts/examples/deploy-prod-from-ref.sh`
- Плюсы: воспроизводимый деплой по resolved SHA.
- Риски: repo остаётся detached; можно случайно закоммитить «в никуда» (уже случилось локально в этой сессии).
- Рекомендация: явное предупреждение в конце + (опционально) запись `./.deployed-sha` для наблюдаемости.

### C) Производительность
**C1. Demo seed использует много последовательных Prisma-запросов**
- Файл: `apps/api/src/demo/demo.service.ts`
- Риск: для редких запусков нормально, но много round-trip’ов.
- Рекомендация: оставить как есть для MVP; если seed запускается часто — батчинг (предзагрузка existing employees/projects/members/assignments и минимальные записи).

### D) Поддерживаемость
**D1. Нейминг ролей легко спутать (AppRole vs employee Role)**
- Файлы: `apps/api` (enum `AppRole`) и модель `Role` (роли сотрудников, например `PM`).
- Риск: путаница в документации/UI и ошибки в правах.
- Рекомендация: везде явно называть «app role» vs «employee role» (код/доки), не смешивать термины.

**D2. SSO bootstrap реализован на нескольких слоях**
- Web: fallback direct call на auth; API: proxy endpoints.
- Риск: изменения поведения требуют правок в двух местах.
- Рекомендация: выбрать один каноничный способ bootstrap для prod:
  - либо всегда дергать auth напрямую из web (CORS/credentials),
  - либо всегда через API proxy (и решить cookie scoping/policy).

## Рекомендуемый план (следующие 1–2 итерации)

### P0 — Hardening (1–2ч)
- [ ] CORS: заменить обработку запрещённого origin на «чистый» deny; добавить безопасное логирование.
- [ ] SSO proxy: добавить timeout на upstream fetch + контролируемую ошибку.

### P1 — Снижение дрейфа конфигов (2–4ч)
- [ ] Web: заменить fallback `VITE_API_URL` на `/api` (безопаснее для test/prod).
- [ ] Compose: перевести `VITE_*` build args на env-substitution и документировать единый источник значений.

### P2 — Оперирование (1–2ч)
- [ ] Deploy scripts: записывать marker с deployed SHA + печатать напоминание про detached HEAD.

## Примечания
- Аудит сделан по состоянию репозитория после работ по деплою SSO/test/prod от 2026-02-24.
