# Terminology audit — tier / feature / routing domain

**Scope:** every `feature_key`, `route_path`, `menu_path`, `module` column in
`public.*`, plus their consumers in `src/`. Read-only audit. No schema or
code change in this commit. Pair with `db-audit/role_model_normalization.md`.

**Authoritative inputs:** live `information_schema` + `pg_catalog` snapshot
on 2026-05-17 against project `oezlzzmzzvbvinuysxaz`, and `rg` over `src/`.

---

## 1. The two `feature_key` namespaces (CRITICAL)

`feature_key` is a single column name reused for **two completely different
concepts**. This is the largest terminology defect in the schema.

| Table | Meaning of `feature_key` | Distinct values | Example values |
|---|---|---:|---|
| `public.features` | Concrete UI / route leaf — one feature_key = one entry point | 172 | `clock_in_gps`, `ai_copilot_chat`, `agile_gantt`, `attendance_log` |
| `public.enterprise_role_permissions` | Abstract permission domain — coarse capability bucket | 19 | `calendar`, `members`, `settings`, `approvals`, `reports`, `leave_management` |

**Quantitative evidence of the conflict**

- `enterprise_role_permissions` rows: **558**
- distinct `feature_key` values: **19**
- rows whose `feature_key` exists in `public.features`: **84** (15 %)
- rows whose `feature_key` does **NOT** exist in `public.features`: **474** (85 %)

So 85 % of the permission rows are joined-by-name to a `features` row that
does not exist. The column shares a name but is not the same key space. No
FK enforces this — and one cannot exist, because the namespaces differ.

**Recommendation:** rename one of the columns to make the semantic split
visible.

| Current column | Proposed canonical name | Rationale |
|---|---|---|
| `features.feature_key` | `features.feature_key` *(unchanged — concrete leaf)* | This is the leaf identifier consumed by `useFeature.ts`, tier resolution, sidebar gating. |
| `enterprise_role_permissions.feature_key` | `enterprise_role_permissions.permission_domain` | Coarse capability bucket. Joins to a (to-be-created) `enterprise_permission_domains` catalog table, never to `features`. |

If renaming is too expensive, the minimum fix is a **CHECK constraint +
catalog table** for `enterprise_role_permissions` so the 19 valid values are
enumerated and orphan keys can never re-appear.

---

## 2. Route path inconsistency: `/app/*` vs `/w/:workspaceId/*` (HIGH)

Per `AGENTS.md` and `.governance/ui_ux_rules.md` § "Workspace identifier in
URL" (non-negotiable from v3.16.0), every workspace-scoped route must use
the shape `/w/<workspaceId>/<rest>`. The picker is `/app`, the dashboard is
`/w/:workspaceId`.

Current `features.route_path` distribution:

| Bucket | Count | % | Status |
|---|---:|---:|---|
| Canonical (`/w/:workspaceId%`) | 31 | 18 % | OK |
| Legacy (`/app/...`) | 111 | 65 % | **VIOLATION** — pre-v3.16.0 shape |
| Other (`/admin/*`, `/superadmin/*`, top-level) | 30 | 17 % | OK (platform-level, not workspace-scoped) |

**Quantitative evidence**: 111 / 172 = 65 % of feature rows reference URL
shapes that the governance retired in v3.16.0. The actual route files in
`src/routes/` may or may not still serve those paths — that needs a separate
cross-check pass.

**Recommendation:**
1. Audit `src/routes/` (TanStack file-based router) to determine which
   `/app/*` paths still resolve.
2. For each surviving `/app/*` feature row, decide one of:
   - Migrate to `/w/:workspaceId/...` (preferred; matches governance).
   - Reclassify as platform-level (no workspace UUID needed).
3. After the route-file audit, run a single `UPDATE public.features` to
   rewrite `route_path` to the canonical shape, in one migration.
4. Do **not** run the UPDATE before step 1 — every rewritten row whose
   route file no longer exists silently 404s the menu link.

---

## 3. `menu_path` (text[]) — shape is consistent, content is mixed-language

All 172 rows have `menu_path` set (0 NULLs). The array is a breadcrumb
("Erőforrások", "Agile", "Gantt"). Content observations from sample:

- Mixed Hungarian + English in the same breadcrumb
  (e.g. `[Calendar AI Copilot]`, `[Munkaóra Audit]`, `[My Portal Clock in]`).
- This is **not** rendered directly to users — `WorkspaceSidebar.tsx` and
  `RolePermissionManager.tsx` use it as a structural grouping key, not as
  display text (UI text is fed by `src/i18n/resources/*.ts`).
- Still, mixed-language structural keys are a maintainability hazard:
  contributors will keep inventing variants.

**Recommendation:** convert `menu_path` to **stable English** structural
keys (e.g. `['resources','agile','gantt']`), and rely on i18n for display.
Low-risk change because nothing parses the human-readable strings.

---

## 4. `module` — vocabulary is clean, but undocumented

`features.module` has 29 distinct values across 172 rows. No NULL. No FK.
Values look canonical (`admin`, `agile`, `ai`, `analytics`, `approvals`,
`attendance`, …). No catalog table enumerates them, so a typo would silently
create a 30th "module".

**Recommendation:** add a tiny `public.feature_modules` catalog table
(`module text primary key`, optional `display_label_key`, `sort_order`) and
a FK from `features.module`. Cheap, prevents future drift.

---

## 5. Code-side surface — small and contained

`rg "feature_key" src/` returns hits in only these production files (i18n +
generated `types.ts` excluded):

- `src/hooks/useFeature.ts` — reads `tenant_enabled_features().feature_key`
  (concrete leaf namespace).
- `src/hooks/useEnterprisePermissions.ts` — reads
  `enterprise_role_definitions.feature_key` + `enterprise_role_permissions.feature_key`
  (permission-domain namespace).
- `src/components/superadmin/FeatureTiersTab.tsx` — concrete leaf.
- `src/components/enterprise/RolePermissionManager.tsx` — permission domain.
- `src/components/shell/WorkspaceSidebar.tsx` — concrete leaf (menu gating).
- `src/lib/tiering/labels.ts` — concrete leaf.
- `src/components/enterprise/WorkspaceDashboard.tsx` — concrete leaf.
- `src/test/featureTiering.test.ts`, `src/test/migrationInvariants.test.ts`.

This is the good news: only **two consumer surfaces** exist, and the rename
in §1 affects exactly one of them (`useEnterprisePermissions.ts` +
`RolePermissionManager.tsx`). The leaf-namespace consumers are untouched.

---

## 6. Canonical map (proposed)

| Concept | Canonical column | Canonical type | Catalog | Notes |
|---|---|---|---|---|
| Concrete UI / route leaf | `features.feature_key` | `text` (snake_case) | `public.features` | Already canonical. |
| Module grouping | `features.module` | `text` (snake_case) | NEW `public.feature_modules` | Add FK. |
| Workspace route path | `features.route_path` | `text` | — | Must match `/w/:workspaceId/...` or platform-level. |
| Structural breadcrumb | `features.menu_path` | `text[]` (snake_case English keys) | — | Display text via i18n. |
| Permission capability bucket | `enterprise_role_permissions.permission_domain` *(rename)* | `text` (snake_case) | NEW `public.enterprise_permission_domains` | 19 values today. |
| Role inside workspace | `enterprise_role_permissions.role_key` | `text` | `enterprise_role_definitions.role_key` | See `role_model_normalization.md`. |

---

## 7. Proposed remediation sequence (NOT executed)

Each step is a separate PR / `versioning/*.md` entry per `AGENTS.md`. None
of these are executed by this audit.

1. **Catalog tables only** (zero behavior change)
   - Create `public.feature_modules` (29 rows backfilled from
     `SELECT DISTINCT module FROM features`).
   - Create `public.enterprise_permission_domains` (19 rows backfilled).
   - No FK yet, no rename yet.
2. **Route-path audit + rewrite** (one PR)
   - Walk `src/routes/` and produce a mapping table.
   - Rewrite the 111 legacy `route_path` values in one migration.
3. **Permission-domain rename** (one PR)
   - Rename `enterprise_role_permissions.feature_key` →
     `permission_domain` with a backwards-compatible view for one release.
   - Update `useEnterprisePermissions.ts` + `RolePermissionManager.tsx`.
   - Add FK to `enterprise_permission_domains`.
4. **`menu_path` English keys** (one PR)
   - Convert breadcrumb arrays to snake_case English. Pure data migration.
5. **FK on `features.module`** (one PR)
   - After §1 the catalog exists; add the FK.

---

## 8. What this audit does NOT cover

- The tier system (`tenant_subscriptions`, `tier_features`, `addon_features`,
  `tenant_feature_overrides`) — that domain has its own canonical model and
  is internally consistent; the only seam to this audit is that
  `tier_features` joins to `features.feature_key`, which is already the
  canonical leaf key. No defect found there.
- The role model — see `db-audit/role_model_normalization.md`.
- Edge functions — separate audit pack.
