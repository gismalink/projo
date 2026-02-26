# Frontend Performance & Responsiveness Plan

Дата: 2026-02-26
Статус: draft (execution plan)

## 1) Цель
Сделать производительность интерфейса измеримой и управляемой, особенно для Timeline-сценариев (scroll, drag/resize, bench interactions), чтобы решения по релизу принимались по метрикам, а не субъективно.

## 2) Область
- Web app: `apps/web/*`
- Критический экран: Timeline
- Контуры проверки: `local` и `test`

## 3) Базовые сценарии профилирования
1. Открыть Timeline и дождаться полной загрузки данных.
2. Вертикальный скролл по списку проектов.
3. Drag assignment (move/resize) в пределах года.
4. Drag project bar (move/resize start/end).
5. Работа с bench-фильтрами (employee/department) и повторный drag.

## 4) Как измерять

### 4.1 Bundle / build baseline
Команда:
- `npm run build -w @projo/web`

Фиксировать:
- размер `dist/assets/*.js` и `gzip`,
- размер CSS и `gzip`,
- время сборки,
- предупреждения Vite о chunk size.

### 4.2 Browser runtime (Chrome DevTools Performance)
Профиль с включенными Screenshots и Web Vitals на каждом сценарии из раздела 3.

Фиксировать:
- Long Tasks,
- FPS во время drag/scroll,
- долю времени Scripting / Rendering / Painting,
- пики Layout/Style recalculation.

### 4.3 React DevTools Profiler
Профилировать Timeline-сценарии и отмечать:
- commit duration,
- частоту re-render ключевых компонентов,
- самые дорогие коммиты и причины.

### 4.4 Throttling profile
Повторить сценарии в режиме:
- CPU throttling: x4,
- Network: Fast 3G и Slow 4G.

Фиксировать:
- время до интерактивности Timeline,
- задержку между действием пользователя (drag/drop) и видимым обновлением UI.

## 5) Performance budgets (release gate)
Бюджеты на текущий этап (можно уточнить после 2–3 итераций замеров):
- Max Long Task: `<= 100ms` в целевых Timeline-сценариях.
- p95 визуального отклика drag/drop: `<= 150ms`.
- JS bundle (gzip): зафиксировать baseline и не допускать роста > `10%` без явного обоснования.

## 6) Артефакт каждой итерации
На каждую итерацию — markdown snapshot с полями:
- Date
- Commit SHA
- Env (`local`/`test`)
- Bundle metrics
- Runtime metrics (Long Tasks, FPS, commit duration)
- Выводы и action items
- Go / No-Go

Рекомендуемый шаблон файла:
- `docs/performance/frontend-performance-YYYY-MM-DD.md`

## 7) Definition of Done
- Есть актуальный baseline и повторяемый checklist прогонов (`local + test + throttling`).
- Для Timeline подтверждено отсутствие критических UI-freeze (нет Long Task > 100ms в целевых сценариях).
- Для release candidate есть формализованное Go/No-Go решение по budget.

## 8) Связанные документы
- `docs/performance-baseline-2026-02-15.md`
- `docs/performance/load-testing-plan.md`
- `docs/implementation-roadmap.md`
