# Role model normalization — audit + proposed canonical model

**Scope:** every column whose name matches `%role%`, `%position%`,
`business_role`, plus the role-related enums and tables. Read-only audit. No
schema or code change in this commit. Pair with
`db-audit/terminology_audit.md`.

**Authoritative inputs:** live `information_schema` + `pg_catalog` snapshot
on 2026-05-17 against project `oezlzzmzzvbvinuysxaz`.

---

## 1. Why this audit exists

The word "role" is overloaded across at least **five different concepts**
in this schema, with **no precedence rule** documented anywhere:

1. **Platform privilege** — `public.user_roles.role :: app_role` enum.
2. **Coarse enterprise role enum** — `public.enterprise_role` enum
   (`owner`, `resourceAssistant`, `member`) used by
   `enterprise_memberships.role`, `enterprise_invitations.role`,
   `enterprise_approval_chains.approver_role`,
   `enterprise_escalation_rules.escalate_to_role`.
3. **Workspace-level role definition** — `enterprise_role_definitions`
   (54 rows) + `enterprise_workspace_roles` (0 rows) +
   `enterprise_role_permissions` (558 rows). Keyed by `role_key text`.
4. **Business role / job category** — a free-form `business_role text`
   column appearing in **13 different tables**.
5. **Catalog of business roles** — `enterprise_catalog_roles` (366 rows) +
   `enterprise_team_roles` (54 rows) + `enterprise_workspace_role_skills`,
   joined via `role_id uuid` (a completely different key space from
   the four above).

Plus `position` in `enterprise_open_shift_waitlist` is **not** a role — it
is an integer queue position. The name collision is incidental but adds
noise to any `%role|position%` grep.

---

## 2. Complete inventory (live snapshot)

### 2.1 Enums

| Enum | Values | Used by |
|---|---|---|
| `public.app_role` | `admin`, `user` | `user_roles.role` |
| `public.enterprise_role` | `owner`, `resourceAssistant`, `member` | `enterprise_memberships.role`, `enterprise_invitations.role`, `enterprise_approval_chains.approver_role`, `enterprise_escalation_rules.escalate_to_role` |

### 2.2 Role-bearing tables (row counts as of snapshot)

| Table | Rows | Key column(s) | Concept |
|---|---:|---|---|
| `user_roles` | 3 | `(user_id, role app_role)` | Platform privilege (super-admin gate) |
| `enterprise_memberships` | 185 | `role enterprise_role`, `business_role text`, `business_role_id uuid` | Workspace membership + job category |
| `enterprise_workspace_roles` | **0** | `(workspace_id, role_key)` + `catalog_role_id uuid` | Per-workspace role definition (**unused so far**) |
| `enterprise_role_definitions` | 54 | `(workspace_id, role_key)` | Per-workspace role definition (alternate table) |
| `enterprise_role_permissions` | 558 | `(role_key, feature_key)` | Permission grants per role |
| `enterprise_catalog_roles` | 366 | `id uuid` + name | Cross-workspace catalog of business roles |
| `enterprise_team_roles` | 54 | `business_role text` | Team-level role assignments |
| `enterprise_member_role_allocations` | 174 | `business_role text` | % allocation of a member to a business role |
| `enterprise_workspace_role_skills` | n/a | `role_id uuid` | Skill ↔ role mapping (workspace) |
| `enterprise_catalog_role_skills` | n/a | `role_id uuid` | Skill ↔ role mapping (catalog) |

### 2.3 Free-form `business_role text` (no FK, no enum, no catalog link)

Column appears in **13 tables**:

```
enterprise_coverage_rules.business_role
enterprise_member_role_allocations.business_role
enterprise_memberships.business_role         (alongside business_role_id)
enterprise_office_coverage_rules.business_role
enterprise_office_coverage_rules.business_roles  (text[])
enterprise_office_min_staffing.business_role
enterprise_open_shift_requests.business_role
enterprise_project_assignments.business_role
enterprise_project_rates.business_role
enterprise_project_resource_requirements.business_role
enterprise_scenario_assignments.business_role
enterprise_shift_assignments.business_role
enterprise_shift_cancellations.business_role
enterprise_team_roles.business_role
```

Plus default-value columns:
`enterprise_member_templates.default_business_role`,
`enterprise_member_templates.default_role`,
`enterprise_access_systems.default_owner_role`,
`enterprise_access_systems.default_approver_role`,
`enterprise_agile_issues.suggested_role`,
`enterprise_onboarding_template_steps.owner_role`,
`enterprise_daily_rules.role_filter`,
`enterprise_daily_rules.role_filters` (text[]).

**Risk:** any typo creates a silently divergent role. There is no central
authority, no FK, no CHECK. `enterprise_memberships.business_role` lives
alongside `business_role_id uuid`, suggesting an in-progress migration to
FK-backed roles that was never completed.

---

## 3. Conflict map (where the five concepts collide)

| Question the codebase cannot answer cleanly today | Why |
|---|---|
| Who is "owner" of a workspace? | `enterprise_memberships.role = 'owner'` (enum), but `enterprise_role_definitions` may also define a `role_key = 'owner'` (text). Two source-of-truth candidates. |
| What permissions does a member have? | `enterprise_role_permissions.role_key` joins to `enterprise_role_definitions.role_key`, **not** to `enterprise_memberships.role`. There is no link from a user to their `role_key`. |
| What business role does a member hold? | `enterprise_memberships.business_role` (text) **or** `business_role_id` (uuid → `enterprise_catalog_roles`) — both present, both populated, no rule for which wins. |
| Can a query group "all shift assignments for role X"? | Only by string match on `business_role`, which is not normalized; typos and renames silently break the grouping. |
| Is `enterprise_workspace_roles` (0 rows) live or dead code? | Cannot tell — the schema exists, the RLS exists, but no row was ever written. `enterprise_role_definitions` (54 rows) appears to have superseded it. |

---

## 4. Proposed canonical model

| Layer | Canonical table | Key | Purpose | Action |
|---|---|---|---|---|
| **Platform** | `user_roles` | `(user_id, role app_role)` | Super-admin gate, platform-wide | **Keep as-is.** Already canonical. |
| **Workspace membership** | `enterprise_memberships` | `(user_id, workspace_id)` + `role enterprise_role` | "Is this user in this workspace, and at what coarse level?" | **Keep `role enterprise_role`** as the coarse access level. |
| **Workspace role catalog** | `enterprise_role_definitions` | `(workspace_id, role_key)` | Per-workspace named roles ("Finance Approver") | **Keep.** Drop `enterprise_workspace_roles` (0 rows, superseded). |
| **Permission grants** | `enterprise_role_permissions` | `(role_key, permission_domain)` | What can a `role_key` do? | Rename `feature_key` → `permission_domain` (see `terminology_audit.md` §1). |
| **Business role catalog** | `enterprise_catalog_roles` | `id uuid` + display name | Reusable job categories ("Backend Engineer", "Nurse") | **Keep.** Make it the only source for `business_role`. |
| **Member ↔ business role** | `enterprise_memberships.business_role_id` (FK) | uuid | Which job categories does this member hold? | **Drop the free-form `business_role text`** column once `business_role_id` is backfilled. |
| **Business role usage in operational tables** (shifts, projects, coverage) | `business_role_id uuid` FK to `enterprise_catalog_roles` | uuid | Replace 13 free-form `business_role text` columns | Add FK columns, backfill from text, drop text columns. |

**Position** stays out of the role model — it is queue position. Rename to
`queue_position` in `enterprise_open_shift_waitlist` for clarity (cosmetic).

---

## 5. Disposition of each existing object

| Object | Decision | Reason |
|---|---|---|
| `app_role` enum | KEEP | Platform privilege. Stable. |
| `enterprise_role` enum | KEEP | Coarse workspace level. 3 values is fine. |
| `user_roles` | KEEP | Canonical platform-privilege table. |
| `enterprise_memberships.role` | KEEP | Coarse workspace level. |
| `enterprise_memberships.business_role` (text) | DROP after backfill | Free-form, no FK, duplicates `business_role_id`. |
| `enterprise_memberships.business_role_id` (uuid) | KEEP, promote to canonical | Already exists, just unused. |
| `enterprise_role_definitions` | KEEP | Canonical per-workspace role catalog. |
| `enterprise_workspace_roles` | DROP | 0 rows, superseded by `enterprise_role_definitions`. |
| `enterprise_role_permissions` | KEEP, rename column | Canonical permission grants (see terminology audit). |
| `enterprise_catalog_roles` | KEEP, promote | Canonical business-role catalog. |
| `enterprise_team_roles.business_role` | Convert to `business_role_id` FK | Same pattern. |
| `enterprise_member_role_allocations.business_role` | Convert to `business_role_id` FK | Same pattern. |
| All other `business_role text` columns (10 more) | Convert to `business_role_id` FK | Same pattern. |
| `enterprise_open_shift_waitlist.position` | Rename to `queue_position` | Not a role. Cosmetic. |
| `enterprise_member_templates.default_business_role`, `default_role` | Convert to FK (`default_business_role_id`) | Same pattern. |
| `enterprise_access_systems.default_owner_role`, `default_approver_role` | Convert to FK | Same pattern. |
| `enterprise_approval_chains.approver_role`, `enterprise_escalation_rules.escalate_to_role` | KEEP (enum) | These reference `enterprise_role` enum levels, not business roles. Semantically correct. |
| `enterprise_agile_issues.suggested_role` | Convert to FK | Same pattern. |
| `enterprise_onboarding_template_steps.owner_role` | Convert to FK | Same pattern. |

---

## 6. Proposed migration path (NOT executed)

Per `AGENTS.md`, each step is its own PR with `CHANGELOG.md`,
`versioning/*.md`, and `marketing/marketing_values/*.md`. None executed by
this audit.

### Step 1 — Drop the unused twin table (low risk)

- `DROP TABLE public.enterprise_workspace_roles;` — 0 rows, no incoming FK
  (verify via `pg_depend` in the migration).

### Step 2 — Backfill `business_role_id` everywhere (no destructive change)

- For each of the 13 tables, add `business_role_id uuid` column if missing.
- Backfill: `UPDATE t SET business_role_id = (SELECT id FROM enterprise_catalog_roles WHERE name = t.business_role)` per workspace.
- Report on unmatched rows. Decide per-row: create the missing catalog
  entry or null-out.
- **Do not drop the text columns yet.**

### Step 3 — Dual-write window (one release)

- Update all `INSERT`/`UPDATE` paths to write **both** `business_role` (text)
  and `business_role_id` (uuid).
- Add CHECK: `business_role_id IS NOT NULL` once the backfill is clean.

### Step 4 — Cut over reads

- Update RLS, RPCs, and `src/` consumers to read `business_role_id` (join
  to `enterprise_catalog_roles` for the display name).

### Step 5 — Drop the text columns

- Remove `business_role text` from all 13 tables and the default-value
  columns. One migration per table is fine; the whole step is one PR.

### Step 6 — Permission-domain rename

- Covered in `db-audit/terminology_audit.md` §1.

### Step 7 — Cosmetic

- Rename `enterprise_open_shift_waitlist.position` →
  `queue_position`.

---

## 7. Open questions (need product / data-owner answer before Step 2)

1. **Cross-workspace business roles**: should `enterprise_catalog_roles` be
   global, per-tenant, or per-workspace? Today it has 366 rows; we need to
   know what the right grouping is before adding FKs.
2. **`enterprise_role_definitions` vs `enterprise_role_permissions`
   ownership**: a row in `enterprise_role_permissions` references a
   `role_key` — is that meant to be workspace-scoped (i.e. (workspace_id,
   role_key)) or global? Today the table has no `workspace_id`, but
   `enterprise_role_definitions` does — making the join ambiguous.
3. **`business_role_id` on `enterprise_memberships`**: who is supposed to
   write it? The dual-existence with `business_role text` suggests an
   abandoned migration. Was there an original spec?

These three answers are blockers for Steps 2–5. Steps 1 and 7 can proceed
without them.

---

## 8. What this audit does NOT cover

- Skill model (`enterprise_workspace_role_skills`, `enterprise_catalog_role_skills`,
  `enterprise_workspace_skills`, `enterprise_catalog_skills`) — they
  reference `role_id`, so they ride along with the role normalization, but
  the skill domain itself is a separate audit.
- RLS policy bodies — they consume the role columns but were not rewritten
  here. After Step 5, every RLS policy that joins `business_role` must be
  reviewed.
- UI strings — the role names rendered to the user are i18n keys, not the
  raw `role_key` / `business_role` values. No UI change is implied by this
  normalization.
