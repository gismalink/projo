# Security Audit — 2026-02-18

## Scope
Аудит выполнен после UI/API изменений (plan stats, timeline UX, dropdown UX).
Проверка включала:
- dependency-аудит для `apps/api` и `apps/web`,
- обзор backend security baseline (auth, CORS, headers, throttling),
- быстрый статический обзор web на опасные runtime-паттерны (`dangerouslySetInnerHTML`, `eval`, `new Function`).

## Verification baseline
- `npm audit -w apps/api --omit=dev --audit-level=moderate` — **failed (3 high)**.
- `npm audit -w apps/web --omit=dev --audit-level=moderate` — **passed (0 vulnerabilities)**.
- `npm run -w apps/web build` — **passed**.

## Findings

### 1) High: транзитивные уязвимости через `bcrypt@5.x` (API)
**Status:** Open  
**Evidence:** `apps/api/package.json` использует `bcrypt@^5.1.1`; `npm audit` сообщает 3 high уязвимости в цепочке `bcrypt -> @mapbox/node-pre-gyp -> tar`.

Актуальные advisory из вывода audit:
- GHSA-8qq5-rm4j-mr97
- GHSA-r6q2-hw4h-h46w
- GHSA-34x7-hfp2-rc4v
- GHSA-83g3-92jg-28cx

**Risk:** Возможные path traversal / arbitrary file overwrite/read сценарии при эксплуатации уязвимого `tar` в цепочке поставки.

**Recommendation:**
1. Мигрировать `bcrypt` на `^6.0.0` (breaking change), затем прогнать полный regression (`verify` + auth smoke).
2. Если миграция блокируется, временно перейти на `bcryptjs` с проверкой производительности/совместимости.
3. Зафиксировать dependency policy: регулярный `npm audit` в CI.

---

### 2) Medium: CORS включен без ограничений
**Status:** Open  
**Evidence:** `apps/api/src/main.ts` — `app.enableCors();` без allowlist origins.

**Risk:** Любой origin может обращаться к API из браузера; увеличивается поверхность CSRF-like и token misuse сценариев (при ошибках клиентской интеграции/хранения токенов).

**Recommendation:**
- Вынести CORS-политику в env (`ALLOWED_ORIGINS`) и задать явный allowlist.
- Указать `methods`/`allowedHeaders`/`credentials` осознанно.

---

### 3) Medium: отсутствуют hardening headers и rate limiting на API
**Status:** Open  
**Evidence:** В `apps/api/src` не обнаружены `helmet`/`@nestjs/throttler`/эквивалентные middleware.

**Risk:**
- Нет базовых HTTP security headers (X-Content-Type-Options, CSP baseline и т.д.).
- Нет встроенного ограничения brute-force/abuse на login и чувствительных endpoints.

**Recommendation:**
1. Добавить `helmet` (с согласованным CSP для фронта).
2. Добавить `@nestjs/throttler` для auth и публичных endpoints.
3. Для `/auth/login` рассмотреть более строгий лимит (например, per-IP/per-email window).

---

### 4) Informational: JWT baseline реализован корректно
**Status:** Accepted / Good practice  
**Evidence:**
- `JwtModule` и `JwtStrategy` используют `JWT_ACCESS_SECRET` через `ConfigService.getOrThrow`.
- `ignoreExpiration: false`, `expiresIn: '1h'`.

**Comment:** Базовая конфигурация корректная; рекомендуется rotation policy/операционный регламент для секрета.

---

### 5) Informational: web XSS hotspots не обнаружены в явном виде
**Status:** No immediate issue  
**Evidence:** В `apps/web/src` не найдено `dangerouslySetInnerHTML`, `innerHTML=`, `eval`, `new Function`.

## Priority remediation plan
1. **P0**: устранить уязвимую цепочку `bcrypt@5.x` (обновление до 6.x или переход на `bcryptjs`).
2. **P1**: ограничить CORS allowlist через env.
3. **P1**: добавить `helmet` + throttling для auth/public endpoints.
4. **P2**: добавить security-check job в CI (`npm audit` + fail threshold).

## Suggested acceptance criteria
- `npm audit -w apps/api --omit=dev --audit-level=high` возвращает 0 high/critical.
- CORS работает только для разрешенных origin.
- Auth endpoints защищены rate limit’ом и покрыты smoke тестом на блокировку.
- API поднимается с `helmet` без регрессий web-клиента.

## Artifacts
- Report: `docs/audits/security-audit-2026-02-18.md`
