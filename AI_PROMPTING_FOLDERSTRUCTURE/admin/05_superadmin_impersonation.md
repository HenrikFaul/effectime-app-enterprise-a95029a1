# 05 — Superadmin Impersonation / Workspace Recovery Mode (SECURITY-CRITICAL)

## Scope
Allow a verified superadmin to enter a customer workspace **read-only-by-default** to diagnose incidents — implemented via `recovery_mode` on `workspaces` plus a session-scoped flag.

**Non-goals:** changing customer data without the customer's consent ticket; bypass of RLS.

## Component tree
- `SuperadminControlPlane.tsx` recovery toggle — line 465 (`workspace-action` + `action_type='enable_recovery'|'disable_recovery'`)
- Workspace-side banner: top of `WorkspaceDashboard` MUST show a persistent red banner whenever `workspaces.recovery_mode = true` showing "Superadmin recovery session active by {actor_email} since {timestamp} — reason: {reason}".

## Data contract
Edge: `superadmin-hub` action `workspace-action`
- Body: `{ workspace_id, action_type: 'enable_recovery', reason, expires_in_minutes? }` (default expiry: 30 minutes, hard cap: 240).
- Side effects:
  1. `UPDATE workspaces SET recovery_mode = true, recovery_started_at = now(), recovery_started_by = caller, recovery_reason = body.reason, recovery_expires_at = now() + interval` WHERE id = workspace_id.
  2. INSERT `platform_audit_events` (`superadmin.workspace.recovery_on`).
  3. A scheduled job (`pg_cron`) MUST auto-disable recovery when `recovery_expires_at < now()` and write `superadmin.workspace.recovery_auto_off`.

## State machine
- `enable_recovery` → confirm dialog requiring (a) typed workspace name, (b) free-text reason ≥ 20 chars, (c) explicit checkbox "I have a customer-approved support ticket".
- `disable_recovery` → one-click; no confirm required (de-escalation is always safe).

## Security
- This is the **highest-blast-radius** action in the platform. All four guards MUST be present:
  1. Edge re-verifies superadmin.
  2. Confirm dialog with the three explicit confirmations.
  3. Banner on the customer's workspace dashboard while active.
  4. Auto-expiry via `pg_cron`.
- All actions in a workspace while `recovery_mode = true` MUST set `request.recovery_session = true` in PostgREST headers (or equivalent) so RLS policies can log impersonated writes distinctly.
- **No write may bypass audit.** Every INSERT/UPDATE/DELETE under recovery mode MUST be tagged in audit with `impersonator_id`.

## i18n — namespace `superadmin.recovery.*`
Required keys (all locales): `enable_button, disable_button, dialog_title, dialog_workspace_name_label, dialog_reason_label, dialog_ticket_checkbox, dialog_expiry_label, banner_active, banner_started_by, banner_reason, banner_expires_at, toast_enabled, toast_disabled, error_reason_too_short, error_no_ticket`.

## Audit-log
| Event | `action` | payload |
|---|---|---|
| Enable | `superadmin.workspace.recovery_on` | `{ workspace_id, reason, expires_at, ticket_acknowledged: true }` |
| Disable manually | `superadmin.workspace.recovery_off` | `{ workspace_id }` |
| Auto-expire | `superadmin.workspace.recovery_auto_off` | `{ workspace_id, expired_at }` |
| Mutation while recovery | append `recovery_session: true, impersonator_id: <uuid>` to ANY audit payload during the session |

## Acceptance
1. Enable recovery without ticket checkbox → button disabled.
2. Enable recovery without 20-char reason → button disabled.
3. Banner appears on customer workspace within 1 polling cycle (≤ 15 s).
4. After 30 min default, auto-off fires and banner disappears.
5. Any write done by the superadmin while in recovery shows `impersonator_id` in audit.

## Regression-protection
- **NEVER** allow the impersonator's session to write without the banner being visible to other workspace members.
- **NEVER** remove the auto-expiry job.
- **NEVER** allow `recovery_mode = true` without a matching active `platform_audit_events` row — daily reconciliation job MUST close orphans.
- A future "true impersonation" (session-take-over) feature is OUT OF SCOPE for this prompt — would require a separate spec.

## Change log
- 2026-06-04 v3.49.11 — initial extraction; documents the existing recovery_mode flow and the security guards that MUST exist before any "deeper" impersonation is built.
