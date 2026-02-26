# Company switch/delete smoke — 2026-02-27

## Scope
- Feature: company selector counters + owner-only company delete.
- Environment: `test` (`https://test.projo.gismalink.art`).
- Branch/SHA: `feature/gitops-test-branch-policy` / `ce06e73`.

## Manual smoke checklist
1. Login and open company selector in header.
2. Switch between at least two companies and confirm timeline reloads without 401.
3. Verify options are displayed as `Company name (N)` and counters are non-negative.
4. For owner company, rename still works.
5. For owner company, click delete (trash icon), confirm action.
6. Verify deleted company disappears from selector and session remains authorized.
7. Verify active company remains defined and projects list/timeline continue to load.

## Result
- Status: **PASS**.
- Notes:
  - Company switching works after recent updates.
  - Company deletion works and rotates token correctly.
  - No auth context loss observed after delete.
