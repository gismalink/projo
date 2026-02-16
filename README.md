# Projo Planner

Это продуктовый годовой планер для команд и руководителей, который помогает собирать реалистичный план проектов с прозрачной загрузкой людей и прогнозом стоимости. Система учитывает рабочий календарь, выходные и отпуска, показывает влияние назначений на доступность сотрудников и снижает риск перегрузки на этапе планирования. В одном интерфейсе доступны управление командой (роли, отделы, грейды), планирование по таймлайну, контроль факта/потерь часов и быстрые сценарии перепланирования без ручных таблиц.

## Stack
- API: NestJS + Prisma + PostgreSQL + JWT + role guards
- Web: React + Vite + TypeScript
- Infra: Docker Compose (PostgreSQL)

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
- email: `admin@projo.local`
- password: `ProjoAdmin!2026`

Created automatically on API startup if not found.

## Project docs
- Architecture: `docs/architecture-overview.md`
- API reference: `docs/api-reference.md`
- Product specification: `docs/product-spec.md`
- Implementation roadmap: `docs/implementation-roadmap.md`
- Workflow checklist: `docs/workflow-checklist.md`

## Documentation ownership
- API methods, roles and request contracts: `docs/api-reference.md`
- Product scope, business rules and acceptance criteria: `docs/product-spec.md`
- Technical architecture and module boundaries: `docs/architecture-overview.md`
- Delivery status and next priorities: `docs/implementation-roadmap.md`
- Development workflow and release checklist: `docs/workflow-checklist.md`
