# Performance Baseline — 2026-02-15

## Scope
Базовый профиль производительности для ключевых endpoint-ов и фронтового бандла после calendar/timeline изменений.

## Environment
- Local dev machine (macOS)
- API base URL: `http://localhost:4000/api`
- Year under test: `2026`
- API sample rounds per endpoint: `10`

## API latency baseline
Источник: `node ./scripts/profile-api.mjs`

- `/timeline/year?year=2026`
  - min: 2.40 ms
  - avg: 3.18 ms
  - p95: 6.62 ms
  - max: 6.62 ms

- `/calendar/2026`
  - min: 4.15 ms
  - avg: 5.39 ms
  - p95: 7.18 ms
  - max: 7.18 ms

- `/calendar/health/status`
  - min: 1.18 ms
  - avg: 1.54 ms
  - p95: 2.48 ms
  - max: 2.48 ms

## Frontend bundle baseline
Источник: `npm run --workspace apps/web build`

- CSS: `dist/assets/index-Cp9NYSRe.css` — 20.43 kB (gzip 4.46 kB)
- JS: `dist/assets/index-Dv4zbhZY.js` — 236.60 kB (gzip 70.84 kB)
- Build time: ~339 ms

## Interpretation
- API read endpoints для timeline/calendar укладываются в однозначные миллисекунды в локальном окружении.
- Bundle size остается в пределах текущего MVP-среза, заметных скачков не зафиксировано.

## Known limits of this baseline
- Нет профиля клиентского рендера по FPS/commit time в браузере (React Profiler/Performance panel).
- Нет замеров под синтетической нагрузкой (большие объемы проектов/assignments).
- Это baseline для локального dev-окружения, а не production benchmark.

## Next profiling step (optional)
- Добавить сценарий генерации большого seed-датасета и снять:
  - API p95/p99 при 1000+ assignments,
  - время первичного рендера timeline в браузере,
  - влияние 1d/1w/1m режимов на CPU.
