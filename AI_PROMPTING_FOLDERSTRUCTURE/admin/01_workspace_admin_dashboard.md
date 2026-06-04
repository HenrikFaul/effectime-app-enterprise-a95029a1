# 01 — App Admin Dashboard (`/admin` → Dashboard tab)

## Scope
KPI overview + mini bar charts + top-events list on the app-level admin panel. Read-only.

**Non-goals:** user mutation (see 02), workspace tier change (see 04), platform-wide metrics (see 03).

## Component tree
- `src/pages/Admin.tsx` (lines 1–94) — role gate + tab shell
  - `<AdminDashboard />` — `src/components/admin/AdminDashboard.tsx` (lines 1–178)
    - `<StatCard />` — local presentational
    - `<MiniBarChart />` — local presentational (no recharts dependency)

## Data contract
Edge function: `supabase.functions.invoke('admin', { body: { action: 'get-stats' } })`
- File: `supabase/functions/admin/index.ts` lines 128–219.
- Returns:
  ```ts
  {
    overview: {
      total_users, registered_users, temporary_users,
      total_events, active_events, total_votes, total_deletions
    },
    charts: {
      registrations_by_day: Record<YYYY-MM-DD, number>,
      events_by_month:     Record<YYYY-MM, number>,
      votes_by_day:        Record<YYYY-MM-DD, number>
    },
    top_events: Array<{ id, title, participants, votes, is_active }>
  }
  ```
- Source tables: `auth.users`, `events`, `votes`, `account_deletions`. All counts MUST be computed on the edge with `service_role`; never expose the client to raw `auth.users`.

## State machine
- `loading=true` → 8 `<Skeleton>` placeholders.
- Edge error → silent (data stays `null`); the page renders only the sections with data. **Do not throw**; an admin panel that white-screens on a single failed sub-query is worse than a partial render.
- Empty chart → `t('admin.no_data')` placeholder card.

## Security
- Page-level: `Admin.tsx` lines 22–34 — `user_roles.role = 'admin'` check via Supabase client. Redirects to `/app` if absent.
- Edge: `admin/index.ts` MUST re-verify the JWT's `sub` has the `admin` role before any data query.
- No tier gate (this is an app-level admin, not a workspace admin).

## i18n — namespace `admin.*`
Required keys (every locale, `src/i18n/resources/{en,hu,de,at,ro,cs,sk,pl}.ts`):
`stat_total_users, stat_registered, stat_guests, stat_deleted_accounts, stat_total_events, stat_active_events, stat_total_votes, chart_registrations, chart_votes, chart_events, top_events_title, inactive, participants_count, votes_count, no_data`.

## Audit-log
Read-only — no `platform_audit_events` writes required for `get-stats`. The edge function MAY log a `read` event at INFO level for forensic purposes; it MUST NOT log per-render (debounce ≥ 60 s).

## Acceptance
1. Non-admin user → redirected to `/app` within 1 render.
2. Admin user → 8 stat cards + 3 mini charts + top-events list visible inside 2 s on warm cache.
3. Edge 500 → no white screen; cards just stay empty with skeleton resolved.

## Regression-protection
- **NEVER** add a recharts dependency here — `<MiniBarChart>` is intentionally CSS-only to keep the admin route bundle < 30 kB.
- **NEVER** read `auth.users` directly from the client.
- The role check MUST stay in `Admin.tsx` (not pushed into the route) — removing it caused the v3.21.2 admin-leak regression (see `codingLessonsLearnt.md`).

## Change log
- 2026-06-04 v3.49.11 — initial extraction from source.
