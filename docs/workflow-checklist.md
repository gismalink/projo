# Workflow Checklist

Короткий чеклист на каждый инкремент.

## 1) Реализация
1. Уточнить scope и критерий готовности.
2. Внести изменения в API/Web.
3. Если меняется Prisma schema:
	- создать migration,
	- выполнить `npm run prisma:generate -w @projo/api`,
	- выполнить `npm run prisma:migrate -w @projo/api`.

## 2) Локальная проверка
1. Базовая проверка: `npm run verify`.
2. При изменениях API runtime-логики: `SMOKE_API=1 npm run verify`.
3. Ручной smoke-check критического пользовательского сценария.

## 3) Документация
1. Обновить `README.md` как индекс документации и инструкций запуска.
2. Обновить профильные документы в `docs/`:
	- `architecture-overview.md`,
	- `api-reference.md`,
	- `product-spec.md`,
	- `implementation-roadmap.md`.

## 4) Перед завершением
1. Проверить `git status` (без случайных артефактов).
2. Убедиться, что i18n-ключи согласованы для `ru/en`.
3. Сделать понятный коммит с кратким описанием изменения.

## Частые пропуски
1. Забытый Prisma migrate после изменения schema.
2. Несинхронность API DTO и frontend payload полей.
3. Обновление только README без синхронизации `docs/*`.
4. Успешный build без проверки фактического UX-сценария.
