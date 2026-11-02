# План: ремонт CI и dependency security Projo

Дата: 2026-11-03. Статус: backlog по явному решению владельца «Оформить отдельной задачей»; обновления зависимостей сейчас не применяются.

Причина отсрочки: отдельный существующий security baseline Projo обнаружен при SSO-ремонте. Сами SSO-маршруты приняты в test; это не приёмка общего release gate. Возврат — после отдельного поручения выполнить этот план. Production не изменять без явного GO после test.

## Зафиксированное состояние

- Main947ebdb уже имел красные CI и Security Audit до SSO-изменений. [Исходный main CI](https://github.com/gismalink/projo/actions/runs/25332306445), [main audit](https://github.com/gismalink/projo/actions/runs/25332306432).
- [Первый PR audit](https://github.com/gismalink/projo/actions/runs/41530978806):23finding nodes —7moderate/15high/1critical. Это число npm audit nodes, не уникальных CVE. Lock SHA256 и исходные данные сохранены в [baseline/trial receipt](../../audits/2026-11-03-dependency-security-baseline.json).
- Неподготовленный Prisma client ломал обычный CI build (AppRole/Prisma type exports). Исправлено отдельно05ee683: verify-all генерирует client до проверок и запускает реальный SSO routing test. [CI lint/test/build SUCCESS](https://github.com/gismalink/projo/actions/runs/41532135213); [security gate всё ещё FAILURE](https://github.com/gismalink/projo/actions/runs/41532135248).
- Изолированный npm audit fix --package-lock-only --ignore-scripts --omit=dev --workspace=@projo/api, без force:25resolved changes,0мажорных; trial дал15nodes —9moderate/6high/0critical. Он не перенесён в рабочий lock и не выкачен. Оставшиеся high связаны с Nest platform-express/multer и Prisma config/effect/deepmerge-ts; точную достижимость и безопасную совместимость ещё нужно проверить.
- SSO PR1 отдельно проверен настоящими test Passport fixtures: current-user/get-token, public issuer, logout/rejection, Datowave session exchange и cleanup. [SSO PR](https://github.com/gismalink/projo/pull/1). Успех SSO не обходит Security Audit и не разрешает merge/release с красным gate.

## Работы и приёмка

- [x] Добавить Prisma generation и SSO regression в общий verify-all; lint/test/build CI прошёл05ee683.
- [ ] Повторить audit на выбранном текущем SHA; сохранить исходный raw result/lock hash. Разделить реально используемые runtime пути, Prisma/build tooling и недостижимые dev paths без искусственного удаления findings.
- [ ] Применить совместимые адресные исправления lock/manifest. Для оставшихся high исследовать upstream исправления; любые transitive overrides/мажоры требуют доказательства API/behavior совместимости. Не использовать audit fix --force, downgrade ради счётчика, исключение gate или снижение severity threshold.
- [ ] Проверить, почему CLI/config цепочка Prisma попадает в audited omit-dev scope и runtime image. Отделение tooling допустимо только при работающих build/generate/migrate/deploy, без сокрытия реально нужной runtime зависимости.
- [ ] Пройти API/web build/typechecks/tests, SSO routing и CI. npm run audit:api должен завершиться exit0 при существующем high threshold; остаточные moderate явно описать. Сохранить принятый Prisma generation шаг.
- [ ] Повторить test-only API rollout и реальную SSO session/cookie/public-issuer/logout/revocation приёмку; добавить multipart/import regression для затронутого upload middleware, проверить Prisma generation и migrations на собственной временной БД. Чужие/prod сервисы и пользовательские данные не менять.
- [ ] После всех gates оформить reviewable PR/merge; production только из default branch после test и отдельного разрешения. Исторические rejected receipts сохранять без переписывания.

Пользовательские локальные изменения apps/api/tsconfig.json и импортный XLSX/ZIP не относятся к этой задаче. Не включать их в коммит и не использовать как скрытую зависимость CI приёмки.
