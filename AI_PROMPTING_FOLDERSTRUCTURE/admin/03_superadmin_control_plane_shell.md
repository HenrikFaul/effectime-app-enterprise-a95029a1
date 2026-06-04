# 03 — Superadmin Control Plane Shell (`/superadmin`)

## Scope
Page shell, tab routing, platform-overview cards, cron-jobs view, trigger-edge-function panel, locale registry, email queue status, platform version chip.

**Non-goals:** tenant CRUD (04), impersonation (05), feature/tier mgmt (06), audit log (07).

## Component tree
- `src/pages/Superadmin.tsx` (lines 1–66)
  - `<SuperadminControlPlane />` — `src/components/superadmin/SuperadminControlPlane.tsx` (1297 LOC)
    - tab list: `overview | workspaces | tiers | flags | audit | ops` (see lines ~225, ~1100)
    - overview panel — calls `platform-overview` (line 228)
    - cron-jobs panel — `list-cron-jobs` (line 875)
    - trigger-edge-function panel — `trigger-edge-function` (line 894)
    - locale-registry panel — `locale-registry` (line 1029)
    - email-queue-status panel — `email-queue-status` (line 1120)

## Data contract
Edge function: `supabase/functions/superadmin-hub/index.ts`. All actions go through this single function, dispatched by `body.action`.

| Action | Returns | Notes |
|---|---|---|
| `platform-overview` | `{ total_workspaces, active_users_7d, mrr, error_rate, ... }` | KPI cards |
| `list-cron-jobs` | `{ jobs: [{ jobname, schedule, last_run, last_status }] }` | from `cron.job` + `cron.job_run_details` |
| `trigger-edge-function` | `{ ok, response }` | manual ops fallback; rate-limited 1/min per function |
| `locale-registry` | `{ locales, missing_keys_per_locale }` | parity check report |
| `email-queue-status` | `{ pending, failed_24h, succeeded_24h }` | from `email_queue` |
| `platform-version` | `{ version, sha, deployed_at }` | from build env |

## State machine
- Tab state in URL: `?tab=<name>` via `useSearchParams` — pushState (NOT replace) so browser Back works (`.governance/ui_ux_rules.md`).
- Each panel has independent `loading | data | error` triplet.
- A failed panel MUST NOT crash sibling panels.

## Security
- Edge MUST re-verify superadmin on every action. Source of truth: `public.has_role(auth.uid(), 'super_admin')` OR `platform_admins` table — pick ONE and document here when migrating.
- `trigger-edge-function` is the highest-blast-radius action: log to audit BEFORE invocation, then again on completion with success/error.

## i18n — namespace `superadmin.*`
Required keys (all locales): tab labels (`tab_overview, tab_workspaces, tab_tiers, tab_flags, tab_audit, tab_ops`), panel titles, KPI labels, button labels. See `src/i18n/resources/en.ts` — search for `superadmin.`.

## Audit-log
- `platform-overview` / read panels → no audit on read (forensic INFO log optional).
- `trigger-edge-function` → MANDATORY `platform_audit_events` row with `action='superadmin.ops.trigger_fn'`, payload includes `function_name` and `response_summary`.

## Acceptance
1. Non-superadmin user → 403 from edge, page redirects to `/app`.
2. Tab change → URL updates, Back button returns to previous tab (not landing).
3. Cron-jobs panel loads even if email-queue panel errors.
4. `trigger-edge-function` shows confirm dialog and audits both BEFORE and AFTER.

## Regression-protection
- **NEVER** add a non-superadmin code path to `/superadmin`.
- **NEVER** call `setSearchParams(..., { replace: true })` for tab navigation.
- Each panel MUST have its own try/catch; one panel's error MUST NOT unmount siblings.

## Change log
- 2026-06-04 v3.49.11 — initial extraction.
