# 08 — Admin Password Policy, Direct User Creation & Reset (workspace + platform)

## Scope
Server-side enforced password policy used by:
- workspace admin **direct user creation** (v3.33.0) — `WorkspaceDashboard` members panel
- workspace admin **password reset for a member**
- superadmin **password reset for any user** (`superadmin-hub` action `reset-user-password` — when added)

**Non-goals:** end-user self-service password reset (separate flow).

## Source of truth
Postgres function `public.validate_password(_pw text) returns jsonb` — returns `{ ok: boolean, errors: text[] }`. This function MUST be called both:
1. **Client-side** (UX hint as the user types) via `supabase.rpc('validate_password', ...)`
2. **Server-side** in every edge function that sets a password (defense in depth)

A client-only check is a CVE-tier mistake.

## Policy (current)
- Length ≥ 12
- ≥ 1 uppercase, ≥ 1 lowercase, ≥ 1 digit, ≥ 1 special char from `!@#$%^&*()_+-=[]{}|;:,.<>?`
- NOT in a banned-password list (top 10k breached passwords) — maintained in `public.banned_passwords`
- NOT containing the user's email local-part (case-insensitive)

Any policy change MUST update `validate_password` + the i18n error keys + the AdminUsers UI hint + this prompt's "Policy" section, all in the same PR.

## Component tree
- Workspace member create dialog (search code for `direct-user-create` action)
- `WorkspaceDashboard` settings → "Reset password" row action (workspace admin only)
- `/superadmin` → workspace member detail (when implemented) — superadmin-only reset

## Data contract
- Create: edge fn `workspace-members` action `direct-create` → calls Supabase admin API `auth.admin.createUser({ email, password, email_confirm: true })` → inserts `workspace_members` + `user_roles`.
- Reset (workspace): edge fn action `reset-member-password` → admin API `auth.admin.updateUserById(id, { password })`. Requires the caller is workspace admin AND the target is in the same workspace.
- Reset (platform): superadmin-only equivalent, no workspace constraint, MUST write recovery-style audit.

## State machine
- Password field shows live policy hint (8 line items, each green/red as typed)
- Submit disabled until `validate_password.ok=true`
- On server error (e.g. duplicate email) → field-level error + toast

## Security
- Server-side `validate_password` call is non-negotiable.
- Email enumeration: server MUST return identical messages whether the email exists or not on reset flows that don't pre-list users.
- Workspace admin MUST be blocked from resetting a different workspace's user (cross-tenant escalation).
- All resets MUST invalidate the target user's existing sessions (Supabase `auth.admin.signOut(id)`).

## i18n — namespace `admin.password.*`
Required keys: `policy_length, policy_upper, policy_lower, policy_digit, policy_special, policy_banned, policy_email_local, hint_title, error_too_short, error_missing_upper, ..., reset_confirm_title, reset_confirm_desc, reset_success, reset_error`.

## Audit-log
| Event | `action` | payload |
|---|---|---|
| Direct create | `workspace.member.direct_create` | `{ workspace_id, new_user_id, created_by }` |
| Workspace reset | `workspace.member.password_reset` | `{ workspace_id, target_user_id, reset_by }` |
| Platform reset | `superadmin.user.password_reset` | `{ target_user_id, reset_by, reason }` |

## Acceptance
1. Client-side validator agrees with server `validate_password` on 100% of test vectors (`src/test/passwordPolicy.test.ts`).
2. Banned password rejected by server even if client is bypassed.
3. Cross-tenant reset attempt → 403.
4. After reset, target user's existing sessions invalidated within ≤ 30 s.

## Regression-protection
- **NEVER** ship a password endpoint without server-side `validate_password`.
- **NEVER** allow the workspace admin to reset a user outside their workspace.
- **NEVER** show "user not found" vs "password set" — uniform response on reset.
- The 8-item live hint UX is mandatory — silently-rejected passwords were the #1 admin-confusion ticket in v3.32.x.

## Change log
- 2026-06-04 v3.49.11 — initial extraction; aligns workspace + platform reset under one policy contract.
