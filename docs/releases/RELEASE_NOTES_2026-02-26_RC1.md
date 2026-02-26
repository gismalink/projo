# Release Notes — RC1 (2026-02-26)

## Scope
- Repo: `projo`
- Branch: `feature/gitops-test-branch-policy`
- Candidate SHA: `23ed340`
- Commit window: `2e53bf7..23ed340`

## Included changes

### Product / UX
- Timeline: weekly bars aligned to real week boundaries and then limited to Monday–Friday (`c13f978`, `2dc840f`).
- Timeline: holiday/weekend overlays switched to opaque pastel for readability (`900fec5`).
- Timeline: project duplicate/delete actions added in UI (`6c3cede`).
- Company selector: shows plans count as `Company (N)` with reactive updates (`19c55f6`).
- Account modal in SSO mode hides local credential management fields (`817e59a`).

### API / Domain logic
- KPI normalization fixes for annual utilization and monthly averaging guards (`3f4af5a`, `f06e64e`, `cfbb908`).
- Employee deletion decoupled from legacy project-member coupling; legacy links cleanup added (`374c3f6`).
- SSO proxy hardening: upstream timeout and controlled `503 ERR_SSO_UPSTREAM_UNAVAILABLE` (`7fcf8e8`).
- CORS hardening: deny-path changed to `callback(null, false)` with safe origin logging (`e6dd467`).

### Platform / Release engineering
- API smoke tests made env-resilient with availability preflight and skip-safe behavior (`c6e5a50`).
- Host compose `VITE_*` build args moved to env-substitution single source (`bb495b8`).
- Deploy scripts now write deployed SHA markers and warn on detached HEAD (`692ed27`).
- Release runbook enhanced with explicit pre-prod checklist (`23ed340`).

## Verification evidence
- `npm run check` — green.
- `SMOKE_API=1 npm run check` — green/skip-safe in non-local auth environments.
- `E2E_API_URL=https://test.projo.gismalink.art/api SMOKE_API=1 npm run check` — green with expected auth-disabled skips.
- Test deploy(s): `deploy-test-from-ref.sh` successful.
- Platform smoke: `ssh mac-mini 'cd ~/srv/edge && ./scripts/test-smoke.sh --local test'` -> `== smoke: OK ==`.
- Manual SSO critical flow: login/logout confirmed working by operator.

## Risk notes
- Main residual risk is operational (`prod`) checklist completion: DB backup + post-prod monitoring window.
- Build currently reports non-blocking Vite chunk-size warning (>500 kB).

## Rollback
1. Identify previous stable SHA on `origin/main`.
2. Run prod deploy script against that SHA:
   - `ssh mac-mini 'cd ~/srv/projo && ./scripts/examples/deploy-prod-from-ref.sh origin/main ~/srv/projo'`
   - or explicit stable ref/tag if needed.
3. Verify health:
   - `curl -fsS https://projo.gismalink.art/api/health`
   - `curl -I https://projo.gismalink.art`
4. Check marker/log files:
   - `~/srv/projo/.deploy/last-deploy-prod.env`
   - `~/srv/projo/.deploy/deploy-history.log`
