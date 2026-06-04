# Admin & Superadmin — Deep Technical Prompt Index

> **Purpose.** Per-feature, regression-proof technical prompts for every admin and superadmin surface in Effectime. Any AI dev session that touches an admin or superadmin route MUST read this index first and then the matching feature file.
>
> **Created:** 2026-06-04 (v3.49.11) — closing the documentation gap surfaced by the v3.49.10 audit (no per-feature deep prompts existed for the admin surfaces apart from `docs/tiering/superadmin_spec.md` which only covered Feature/Tier management).

## Read order for any admin-touching session

1. `AGENTS.md` + `CLAUDE.md` (read order, anti-regression, versioning policy)
2. `.governance/controller.md` + `.governance/ui_ux_rules.md`
3. **This file** (`AI_PROMPTING_FOLDERSTRUCTURE/admin/00_INDEX.md`)
4. The specific feature file(s) below relevant to the change
5. `docs/tiering/master_spec.md` + `docs/tiering/rls_policies.md` if tier/permission is in scope
6. `codingLessonsLearnt.md` (HIBA-DB-002, HIBA-DB-003, HIBA-ADMIN-*)

## Surface map

| Route | Page file | Role gate | Deep prompt |
|---|---|---|---|
| `/admin` | `src/pages/Admin.tsx` | `user_roles.role = 'admin'` (legacy app-admin) | `01_workspace_admin_dashboard.md`, `02_workspace_admin_users.md` |
| `/superadmin` | `src/pages/Superadmin.tsx` | platform superadmin via `superadmin-hub` edge function | `03_superadmin_control_plane_shell.md` |
| `/superadmin` → Workspaces tab | `SuperadminControlPlane.tsx` lines ~225–600 | superadmin | `04_superadmin_tenant_management.md` |
| (action) Impersonate / recovery mode | `SuperadminControlPlane.tsx` `workspace-action` `enable_recovery` | superadmin | `05_superadmin_impersonation.md` |
| `/superadmin` → Tiers tab | `FeatureTiersTab.tsx` (1158 LOC) | superadmin | `06_superadmin_feature_tiers_tab.md` (supersedes `docs/tiering/superadmin_spec.md`) |
| `/superadmin` → Audit tab | `PlatformAuditLogTab.tsx` (308 LOC) | superadmin | `07_superadmin_platform_audit_log.md` |
| `/w/:id` → Members create | `WorkspaceDashboard` admin-users path | workspace admin | `08_admin_password_policy_and_reset.md` |

## Edge function surface (authoritative — every action MUST live in a prompt)

### `supabase/functions/admin/index.ts` (workspace-app admin)
| Action | Prompt |
|---|---|
| `list-users` | 02 |
| `get-stats` | 01 |
| `delete-user` | 02 |
| `update-role` | 02 |

### `supabase/functions/superadmin-hub/index.ts` (platform superadmin)
| Action | Prompt |
|---|---|
| `platform-overview` | 03 |
| `list-workspaces` | 04 |
| `workspace-action` (archive/unarchive/enable_recovery/disable_recovery/delete) | 04 + 05 |
| `change-workspace-tier` | 04 |
| `list-tiers` | 04, 06 |
| `list-feature-flags` / `toggle-feature-flag` | 06 |
| `list-cron-jobs` | 03 |
| `trigger-edge-function` | 03 |
| `locale-registry` | 03 |
| `email-queue-status` | 03 |
| `platform-version` | 03 |

## Authoring rules for every file in this folder

Every prompt MUST contain these sections in order:

1. **Scope & Non-goals**
2. **Component tree + file:line references**
3. **Data contract** — tables, RPCs, RLS policies, GRANTs, exact column list
4. **State machine / lifecycle** (loading / error / success / empty)
5. **Security & authorization** — role gate, tier gate, server-side recheck
6. **i18n** — namespace + key list; every string MUST exist in ALL locale files (`en, hu, de, at, ro, cs, sk, pl`)
7. **Audit-log requirements** — every mutating action MUST write `platform_audit_events`
8. **Acceptance / E2E checks** — concrete user flows
9. **Regression-protection list** — explicit "must keep working" items
10. **Change log of this prompt**

## Hard rules

- **No admin mutation may bypass `platform_audit_events`.** Read-only actions don't need audit; every write does.
- **No client-side role check is sufficient.** Edge function MUST re-verify `has_role(auth.uid(), 'admin')` or the superadmin equivalent.
- **No PII in URLs** (workspace UUID is the explicit exception per `.governance/ui_ux_rules.md`).
- **Tier change is only via `superadmin_change_workspace_tier(_workspace_id, _tier_key, _reason)` RPC** — no direct `UPDATE tenant_subscriptions SET tier_id = ...` is allowed.
- **`security_invoker=on` views** (v3.49.9) — every admin view read MUST be validated against the caller's role/policies, not the view creator's. Re-test after any view migration.
