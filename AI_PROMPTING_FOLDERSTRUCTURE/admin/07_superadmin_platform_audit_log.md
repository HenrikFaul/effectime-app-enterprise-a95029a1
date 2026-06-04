# 07 — Superadmin Platform Audit Log (`/superadmin` → Audit tab)

## Scope
Read-only viewer for `platform_audit_events` with filter (actor, action, target_type, date range) + CSV export.

**Non-goals:** mutate audit rows (NEVER allowed); per-workspace audit (lives in the workspace dashboard).

## Component tree
- `src/components/superadmin/PlatformAuditLogTab.tsx` (308 LOC) — wired in `SuperadminControlPlane.tsx` as the `'audit'` tab.

## Data contract
Source table: `public.platform_audit_events`
Columns (authoritative): `id, actor_id, actor_email, action, target_type, target_id, payload jsonb, ip, user_agent, created_at, recovery_session boolean, impersonator_id uuid`.

Read RLS: superadmin only. The table MUST have:
```sql
GRANT SELECT ON public.platform_audit_events TO authenticated;  -- gated by RLS to superadmin
GRANT INSERT ON public.platform_audit_events TO authenticated;  -- writes happen from edge fn with service_role; this grant is for SECURITY DEFINER triggers
GRANT ALL    ON public.platform_audit_events TO service_role;
```
**There MUST be no UPDATE or DELETE grant to any role except `postgres`.** Audit immutability is a hard invariant.

## State machine
- Filter changes → debounced 300 ms refetch
- Pagination: cursor on `(created_at DESC, id DESC)` — keyset, NOT offset (table will grow)
- CSV export → streamed from edge fn, max 50k rows per request

## Security
- Read-only UI. No mutation controls.
- Export is logged: emitting a CSV writes a `superadmin.audit.export` row itself.

## i18n — namespace `superadmin.audit.*`
All filter labels, column headers, empty state, export button, toast strings.

## Audit-log
- Read: no audit (forensic INFO log at edge with 60 s debounce).
- Export: `superadmin.audit.export` with payload `{ row_count, filters }`.

## Acceptance
1. Filter by action `superadmin.workspace.recovery_on` returns only matching rows.
2. Date range filter applied server-side.
3. CSV export of 10k rows completes < 5 s.
4. UI never displays any mutation button.

## Regression-protection
- **NEVER** add UPDATE/DELETE grants on `platform_audit_events`.
- **NEVER** add a "clear log" UI action.
- The `impersonator_id` column MUST be displayed when populated (recovery-session highlight row).
- Keyset pagination MUST stay; offset pagination breaks at 1M+ rows.

## Change log
- 2026-06-04 v3.49.11 — initial extraction.
