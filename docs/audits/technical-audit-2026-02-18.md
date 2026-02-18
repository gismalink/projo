# Technical Audit — 2026-02-18

## Scope
Аудит выполнен после серии изменений в ветке `feat/company-selector-mvp`:
- company selector + company-scoped settings defaults,
- исправления `cost-rates`/permissions/validation,
- nullable `Employee.email`,
- миграция web-стилей на Sass + декомпозиция partials,
- снятие hard-block assignment вне плановых дат проекта,
- декомпозиция и hardening глобальных list/header/form стилей.

## Verification baseline
- `npm run verify` — **passed** (lint/test/build по всем workspace).
- `apps/api` build — **passed**.
- `apps/web` build — **passed**.

## What was reviewed
- Контракты и валидации assignment flow (`apps/api/src/assignments/assignments.service.ts`).
- RBAC и DTO для `cost-rates` (`apps/api/src/cost-rates/*`).
- Контракты employees (`apps/api/src/employees/*`, Prisma schema).
- Sass architecture и каскад (`apps/web/src/styles/*`, `index.scss`, partials).
- Timeline warning model (`fact-range`) и drag/resize UX.
- Состояние project docs (`README.md`, `docs/*`).

## Findings

### Closed in this increment
1. Assignment за пределами plan-range больше не блокируется API.
   - Hard-limit `ASSIGNMENT_OUTSIDE_PROJECT_RANGE` удален из create/update checks.
   - Диагностика остается в UI через `fact-range` error в Timeline.

2. Снижены риски CSS-регрессий из-за глобальных селекторов.
   - `InstructionTab` отвязан от `roles-list`.
   - `roles-list` получил локальные правила в `roles.scss`.
   - Header/form/list стили вынесены из `global.scss` в partials.

3. Актуализирована структура документации.
   - Аудиты перенесены в `docs/audits/`.
   - Ключевые документы синхронизированы с текущим поведением системы.

### Open / follow-up items
1. Остался legacy error-code и i18n-текст для `ERR_ASSIGNMENT_OUTSIDE_PROJECT_RANGE`.
   - Код и переводы присутствуют, но runtime-ветка больше не используется.
   - Рекомендация: пометить как deprecated и удалить в следующем cleanup-инкременте.

2. API smoke в verify по умолчанию выключен.
   - Сейчас runtime smoke запускается только при `SMOKE_API=1`.
   - Рекомендация: добавить nightly/job с обязательным `SMOKE_API=1`.

3. Тестовое покрытие web runtime все еще минимальное.
   - `@projo/web` тесты: `No tests yet`.
   - Рекомендация: добавить базовые interaction/e2e сценарии для Timeline drag/resize + role/settings flows.

## Risk assessment
- **Low**: изменения по Sass затронули каскад, но верифицированы build + локальные UI fixes.
- **Medium**: снятие ограничения assignment-range меняет бизнес-правило; UX-команда должна подтвердить тексты ошибок/подсказок для пользователей.

## Recommended next actions
1. Cleanup deprecated `ERR_ASSIGNMENT_OUTSIDE_PROJECT_RANGE` (backend constants + i18n).
2. Зафиксировать в product docs UX-формулировку для “можно вне плана, но с ошибкой”.
3. Добавить API smoke в CI по расписанию и минимальный web e2e smoke.

## Audit artifacts
- Moved previous audits:
  - `docs/audits/stabilization-audit-2026-02-15.md`
  - `docs/audits/technical-audit-2026-02-16.md`
- New report:
  - `docs/audits/technical-audit-2026-02-18.md`
