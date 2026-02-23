# Technical Audit — 2026-02-24

Scope: `apps/api`, `apps/web`, deploy/infra (`infra/*`, `scripts/examples/*`), docs alignment.

## Executive summary
- Current state is deployable and stable in `test/prod` (SSO-only) with tightened security baseline (CORS allowlist, helmet, throttling).
- Biggest remaining risks are **configuration drift** (Vite env is build-time; missing build args produces broken prod bundle) and **operational clarity** (deploy scripts leave repo in detached HEAD; build args are hard-coded per env).

## Findings

### A) Security
**A1. CORS allowlist behavior may return errors instead of clean deny**
- File: `apps/api/src/main.ts`
- Current: disallowed origin triggers `callback(new Error('Origin is not allowed by CORS'))`.
- Risk: error responses can look like 500s; also noisier for clients and can complicate debugging.
- Recommendation: deny with `callback(null, false)` and optionally log with request id / origin (without leaking secrets).

**A2. SSO proxy uses upstream fetch without timeout**
- File: `apps/api/src/auth/sso.controller.ts`
- Risk: upstream hangs can consume Node event loop resources under load.
- Recommendation: add `AbortController` timeout (e.g., 3–5s) and return a controlled error payload.

**A3. Dependency audit clean**
- Command: `npm run audit:api` (omit dev) => `0 vulnerabilities`.

### B) Reliability / Ops
**B1. Vite `VITE_*` config is build-time; missing build args breaks prod silently**
- Files: `infra/Dockerfile.host`, `infra/docker-compose.host.yml`, `apps/web/src/api/client.ts`
- Symptom we already hit: bundle compiled with defaults (`localhost:4000/api`, `AUTH_MODE=local`) when build args not wired.
- Recommendation (short-term, already implemented): keep build args in compose.
- Recommendation (hardening): change web default `VITE_API_URL` fallback from `http://localhost:4000/api` to `/api` so misconfiguration fails "less".

**B2. Hard-coded env URLs in compose build args**
- File: `infra/docker-compose.host.yml`
- Risk: drift when domain names change; duplication across test/prod.
- Recommendation: make `build.args` read from `apps/web/.env.*` values via env substitution (or move these into `infra/.env.host`), keeping a single source of truth.

**B3. Deploy scripts always checkout detached HEAD**
- Files: `scripts/examples/deploy-test-from-ref.sh`, `scripts/examples/deploy-prod-from-ref.sh`
- Pros: reproducible deploy by resolved SHA.
- Risks: leaves repo detached; humans may commit accidentally (low risk but happened locally in this session).
- Recommendation: print a clear warning at the end + optionally write `./.deployed-sha` file for observability.

### C) Performance
**C1. Demo seed uses many sequential Prisma queries**
- File: `apps/api/src/demo/demo.service.ts`
- Risk: for repeated runs it’s still OK, but it’s a lot of round-trips.
- Recommendation: keep as-is for MVP; if demo seed becomes frequent, batch queries (preload existing employees/projects/members/assignments and do minimal writes).

### D) Maintainability
**D1. Role naming is easy to confuse (AppRole vs employee Role)**
- Files: `apps/api` (AppRole enum) vs `Role` model (employee roles like `PM`).
- Risk: docs/UI confusion and permission mistakes.
- Recommendation: consistently call them "app role" vs "employee role" in code/comments/docs; avoid reusing the same names in docs.

**D2. SSO bootstrap logic exists in multiple layers**
- Web: fallback direct auth call; API: proxy endpoints.
- Risk: behavior changes require touching both.
- Recommendation: decide a single canonical bootstrap method for prod:
  - either always call auth directly from web (CORS/credentials),
  - or always call via API proxy (cookie scoping issues to solve via domain/cookie policy).

## Recommended plan (next 1–2 iterations)

### P0 — Hardening (1–2h)
- [ ] CORS: change disallowed origin handling to clean deny; add safe logging.
- [ ] SSO proxy: add fetch timeout + controlled error response.

### P1 — Configuration drift reduction (2–4h)
- [ ] Web: change `VITE_API_URL` default fallback to `/api` (safer for test/prod).
- [ ] Compose: move `VITE_*` build args to env-substitution and document single source of truth.

### P2 — Operability (1–2h)
- [ ] Deploy scripts: write `deployed sha` marker + print reminder about detached HEAD.

## Notes
- This audit is based on repo state after the 2026-02-24 SSO/test/prod deployment work.
