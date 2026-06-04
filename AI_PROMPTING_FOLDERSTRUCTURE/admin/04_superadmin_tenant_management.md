# 04 — Superadmin Tenant Management (`/superadmin` → Workspaces tab)

## Scope
List, filter, paginate, archive/unarchive, delete, change tier of every workspace on the platform.

**Non-goals:** impersonate / recovery mode (see 05); feature/tier matrix (see 06).

## Component tree
- `src/components/superadmin/SuperadminControlPlane.tsx`
  - Workspaces tab JSX (~lines 225–600)
    - workspace list — fetched at line 332 via `list-workspaces`
    - tier dropdown — fetched at line 368 via `list-tiers`
    - tier-change handler — line 409 (`change-workspace-tier`)
    - archive/unarchive handler — line 444 (`workspace-action` + `action_type`)
    - delete handler — line 488 (`workspace-action` + `action_type='delete'`)

## Data contract
Edge: `supabase/functions/superadmin-hub/index.ts`

| Action | Body | Returns | Side effect |
|---|---|---|---|
| `list-workspaces` | `{ search?, status?, tier?, page?, page_size? }` | `{ workspaces: Workspace[], total }` | none |
| `list-tiers` | `{}` | `{ tiers: [{ id, key, display_name }] }` | none |
| `change-workspace-tier` | `{ workspace_id, tier_key, reason }` | `{ ok }` | calls `public.superadmin_change_workspace_tier` RPC → updates `tenant_subscriptions.tier_id` + writes `platform_audit_events` |
| `workspace-action` | `{ workspace_id, action_type: 'archive'\|'unarchive'\|'enable_recovery'\|'disable_recovery'\|'delete' }` | `{ ok }` | updates `workspaces.status` and/or `workspaces.recovery_mode`; cascade on delete |

`Workspace` shape: `{ id, name, slug, status, tier_key, tier_display_name, member_count, created_at, owner_email, recovery_mode }`.

## State machine
- `loading` → row skeletons (do NOT render stale data underneath)
- per-row `actionLoading=workspace_id` → button replaced by spinner
- Optimistic UI on tier change: badge changes immediately; on edge error, badge reverts + toast
- delete → `<AlertDialog>` confirm with **typed workspace name** required to enable the destructive button

## Security
- Edge re-verifies superadmin on every call. No exception.
- `change-workspace-tier` MUST go through the SECURITY DEFINER RPC `public.superadmin_change_workspace_tier(_workspace_id uuid, _tier_key text, _reason text)`. **Direct `UPDATE tenant_subscriptions SET tier_id = ...` is forbidden** (governance rule from v3.17.0).
- `delete` action MUST cascade per the documented FK graph (`db-audit/00_fk_map.md`).
- Tier change `reason` is mandatory and stored in audit payload — empty string MUST be rejected at the edge.

## i18n — namespace `superadmin.workspaces.*`
Required keys: list filters, status badges, tier labels, action menu items, confirm-dialog copy, success/error toasts. Parity required across all 8 locales.

## Audit-log
EVERY mutating action writes `platform_audit_events`:
| Action | `action` value | payload |
|---|---|---|
| change-tier | `superadmin.workspace.tier_change` | `{ workspace_id, from_tier, to_tier, reason }` |
| archive | `superadmin.workspace.archive` | `{ workspace_id, previous_status }` |
| unarchive | `superadmin.workspace.unarchive` | `{ workspace_id, previous_status }` |
| delete | `superadmin.workspace.delete` | `{ workspace_id, name, member_count, owner_email }` |
| enable_recovery | `superadmin.workspace.recovery_on` | `{ workspace_id }` (see 05) |
| disable_recovery | `superadmin.workspace.recovery_off` | `{ workspace_id }` |

## Acceptance
1. Tier change requires non-empty reason → button disabled until typed.
2. After successful tier change, the workspace dashboard header (`WorkspaceTierBadge` reading `public.workspace_active_tier`) reflects the new tier within 1 refresh.
3. Delete requires typed workspace name match — case-sensitive.
4. Pagination preserves search/filter on tab Back/Forward.

## Regression-protection
- **NEVER** modify `tenant_subscriptions.tier_id` outside the RPC (v3.17.0 invariant).
- **NEVER** silently delete a workspace; the typed-name guard is non-negotiable.
- Tier-change reason MUST persist in `platform_audit_events` — required for SOC 2 evidence.
- v3.49.9 changed `enterprise_org_pulse_membership` to `security_invoker=on`; any new admin view used here MUST be set the same way.

## Change log
- 2026-06-04 v3.49.11 — initial extraction.
