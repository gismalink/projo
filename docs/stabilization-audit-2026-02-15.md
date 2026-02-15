# Stabilization Audit — 2026-02-15

## Scope
Проверка изменений по Timeline/Calendar waves и связанных backend/frontend до перехода к финальной стабилизации.

## What was audited
- Корректность критического пользовательского сценария: login → timeline → project bars → assignment bars.
- Календарная интеграция: sync, чтение по году, health endpoint, fallback-поведение при ошибках календаря.
- UI-стабильность timeline: drag/resize, квантование 1d/1w/1m, визуал сетки и календарных оверлеев.
- Проверочный контур: lint/test/build + runtime smoke API.

## Verified runtime behaviors
1. Project charts visible even if calendar endpoints fail.
   - Frontend использует non-blocking загрузку calendar/health через settled-подход.
2. Calendar migrations applied and schema is in sync.
   - Таблицы `CalendarDay`/`CalendarYearSync` присутствуют после миграции `20260215160000_0013_calendar_day`.
3. Calendar API critical endpoints return success (local smoke):
   - `GET /api/health`
   - `POST /api/auth/login`
   - `GET /api/timeline/year?year=YYYY`
   - `GET /api/calendar/YYYY`
   - `GET /api/calendar/health/status`
4. Holidays mapping fixed.
   - Даты праздников нормализуются в `YYYY-MM-DD` перед построением карты, что устраняет потерю `isHoliday`.
5. Drag quantization fixed for resize-end.
   - Правая граница снапится к концу недели/месяца в 1w/1m.

## Quality gates status
- Lint: PASS
- Tests: PASS (тестов мало/placeholder в части пакетов)
- Build (api/web/shared): PASS
- Optional runtime smoke API: PASS

## UX/status notes
- Timeline visuals уплощены в календарных областях (сетка/оверлеи), при этом скругления карточки нагрузки сохранены.
- Добавлена расширенная легенда дней (working/weekend/holiday/vacation).
- Добавлены метрики fact/lost hours в assignment и проектных KPI.

## Risks remaining
1. Limited automated coverage:
   - Нет полноценных integration/e2e тестов для DnD и календарного перерасчета.
2. Runtime smoke depends on live API process:
   - Для `SMOKE_API=1` API должен быть запущен.
3. Performance not profiled yet:
   - Нет измерений latency/CPU/memory на больших данных timeline.

## Recommended next stabilization step
- Выполнить пункт «Профилирование производительности»:
  - базовые метрики рендера timeline (1d/1w/1m),
  - проверка API `timeline/year` и `calendar/year` под нагрузкой,
  - фиксация baseline в отдельном документе.
