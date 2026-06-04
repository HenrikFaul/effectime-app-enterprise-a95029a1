# 02 — App Admin Users (`/admin` → Users tab)

## Scope
List, search, filter, grant/revoke admin role, delete user — on the **app-level** admin (event/voting app users). Workspace member creation lives separately (see 08).

**Non-goals:** workspace member CRUD, tier-scoped role permissions, password policy (see 08).

## Component tree
- `src/pages/Admin.tsx` (Tabs shell)
  - `<AdminUsers />` — `src/components/admin/AdminUsers.tsx` (lines 1–208)
    - search input (debounced 300 ms, line 47–50)
    - filter `Select` — values: `all | registered | temporary | admin` (line 102–113)
    - row `DropdownMenu` with `AlertDialog` confirm on delete (line 161–198)

## Data contract
Edge: `supabase/functions/admin/index.ts`
| Action | Body | Returns |
|---|---|---|
| `list-users` | `{ search?, filter? }` | `{ users: AdminUser[] }` |
| `update-role` | `{ user_id, role: 'admin', grant: boolean }` | `{ ok: true }` or `{ error }` |
| `delete-user` | `{ user_id }` | `{ ok: true }` or `{ error }` |

`AdminUser` (lines 16–28): `id, email, display_name, is_temporary, linked_event_id, created_at, last_sign_in_at, roles[], event_count, vote_count, provider`.

Source tables: `auth.users`, `public.user_roles`, `public.profiles`, `public.events`, `public.votes`. The edge function joins with `service_role`.

## State machine
- `loading` → 5 skeleton rows
- empty → `t('admin.no_results')`
- per-row `actionLoading=user_id` → spinner replaces `MoreVertical` icon
- Optimistic UI after success: row removed (delete) or `roles[]` patched (toggle) — **before** refetch
- Error → `toast.error(data?.error || t('admin.*_error'))` — UI does NOT mutate

## Security
- Page-level role gate (see 01).
- Edge MUST re-verify admin role on every action.
- `delete-user` MUST refuse to delete the caller (self-delete blocked at edge).
- `update-role` MUST refuse to grant `admin` if the caller is not already `admin` (defense in depth — server cannot trust client).
- Cascade: deleting a user MUST cascade to `user_roles`, `profiles`, but MUST keep audit-log rows (`platform_audit_events.actor_id` becomes nullable).

## i18n — namespace `admin.*`
Required keys (all locales): `users_title, search_placeholder, filter_all, filter_registered, filter_temporary, filter_admin, no_results, users_count, anonymous, badge_guest, registered_short, last_login_short, event_count, vote_count, remove_admin, grant_admin, delete_user_action, delete_user_dialog_title, delete_user_dialog_description, cancel, delete_confirm, delete_user_error, delete_user_success, toggle_role_error, admin_role_removed, admin_role_granted`.

## Audit-log
Every `update-role` AND `delete-user` MUST write `platform_audit_events`:
```sql
INSERT INTO platform_audit_events (actor_id, action, target_type, target_id, payload, created_at)
VALUES (caller, 'admin.role.grant'|'admin.role.revoke'|'admin.user.delete', 'auth.user', target, jsonb_build_object(...), now());
```

## Acceptance
1. Search `"foo"` → debounced (no request before 300 ms idle).
2. Grant admin → badge appears within 1 render; refresh page → still admin.
3. Delete user → confirm dialog → row removed; refresh → user gone; `platform_audit_events` has matching row.
4. Filter `admin` → only rows with `roles` including `admin`.

## Regression-protection
- **NEVER** call `supabase.from('user_roles').delete()` from the client — role storage is the privilege-escalation surface (`.governance` user-roles rule).
- The 300 ms debounce on search is intentional; do not remove without a perf review.
- AlertDialog confirm on delete is **mandatory** — silent delete killed 3 wrong users in v2.x (see `codingLessonsLearnt.md`).

## Change log
- 2026-06-04 v3.49.11 — initial extraction.
