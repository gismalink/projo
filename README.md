# Projo Planner

Актуализация: 2026-02-18

Это продуктовый годовой планер для команд и руководителей, который помогает собирать реалистичный план проектов с прозрачной загрузкой людей и прогнозом стоимости. Система учитывает рабочий календарь, выходные и отпуска, показывает влияние назначений на доступность сотрудников и снижает риск перегрузки на этапе планирования. В одном интерфейсе доступны управление командой (роли, отделы, грейды), планирование по таймлайну, контроль факта/потерь часов и быстрые сценарии перепланирования без ручных таблиц.

## Stack
- API: NestJS + Prisma + PostgreSQL + JWT + role guards
- Web: React + Vite + TypeScript
- Infra: Docker Compose (PostgreSQL)

## Реализовано в текущем инкременте
- Шаблоны состава проекта (`team-templates`) в Settings: CRUD, редактирование названия и списка ролей.
- Привязка шаблона к проекту: выбор при создании и инлайн-редактировании проекта на Timeline.
- Диагностика недостающих ролей на Timeline считается по выбранному шаблону проекта.
- В заголовке строки проекта отображается чип с названием выбранного шаблона.
- В базе по умолчанию присутствуют шаблоны:
   - `web proj` (`PM UI QA BACK ANLST FRONT`)
   - `unity lab` (`PM UI UX QA ANLST UNITY 3DART`)

## Quick start
1. Copy env files:
   - `cp .env.example .env`
   - `cp apps/api/.env.example apps/api/.env`
   - `cp apps/web/.env.example apps/web/.env`
2. Start database: `docker compose up -d`
3. Install deps: `npm install`
4. Prepare Prisma client and DB schema:
   - `npm run prisma:generate -w @projo/api`
   - `npm run prisma:migrate -w @projo/api`
5. Start apps:
   - Both: `npm run dev:all`
   - API only: `npm run dev:api`
   - Web only: `npm run dev:web`

## Verification
- Full check: `npm run verify`
- Full check + runtime smoke API test: `SMOKE_API=1 npm run verify`
- API smoke test only: `npm run test:e2e:api`

## Default bootstrap admin
- Credentials are read from env:
   - `BOOTSTRAP_ADMIN_EMAIL`
   - `BOOTSTRAP_ADMIN_PASSWORD`
- Optional legacy-password rotation support:
   - `LEGACY_BOOTSTRAP_ADMIN_PASSWORD`

Bootstrap admin is created automatically on API startup if the required env variables are set.

## Project docs
- Architecture: `docs/architecture-overview.md`
- API reference: `docs/api-reference.md`
- Product specification: `docs/product-spec.md`
- Implementation roadmap: `docs/implementation-roadmap.md`
- Workflow checklist: `docs/workflow-checklist.md`
- Stabilization audit (2026-02-15): `docs/audits/stabilization-audit-2026-02-15.md`
- Technical audit (2026-02-16): `docs/audits/technical-audit-2026-02-16.md`
- Technical audit (2026-02-18): `docs/audits/technical-audit-2026-02-18.md`

## Documentation ownership
- API methods, roles and request contracts: `docs/api-reference.md`
- Product scope, business rules and acceptance criteria: `docs/product-spec.md`
- Technical architecture and module boundaries: `docs/architecture-overview.md`
- Delivery status and next priorities: `docs/implementation-roadmap.md`
- Development workflow and release checklist: `docs/workflow-checklist.md`
