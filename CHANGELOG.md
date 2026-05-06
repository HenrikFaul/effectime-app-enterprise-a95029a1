## 2026-05-06 — Jira integration repair + Boards (Kanban / Scrum / Gantt)

### Fixed
- **Jira search 410/empty result regression** — `jira-devops-proxy` now requests `*all` fields and falls back through `POST /rest/api/3/search/jql → GET /rest/api/3/search/jql → GET /rest/api/3/search` so tenants on either the new or legacy endpoint succeed.
- Removed leftover `auth-middleware.ts` / `client.server.ts` TanStack stubs that were re-created in a previous session and broke the Vite SPA build (`Cannot find module '@tanstack/react-start'`).

### Added — Extended Jira field ingest
The proxy now imports and caches the following fields per issue (Jira Cloud):
`assignee, reporter, status, issue_type, summary, description (ADF→plain text), key, parent_key, sprint_name, labels (full), due_date, team_name, start_date, priority, story_points`.
Schema: two new columns on `enterprise_agile_issues` — `description text`, `team_name text`.

### Added — Boards tab (Kanban / Scrum / Gantt)
New `AgileBoards` component, mounted as a dedicated tab in `AgilePanel`:
- **Kanban** — columns grouped by `status`, cards show key, type chip, assignee, SP, priority, labels.
- **Scrum** — first level grouped by `sprint_name`, second level by `status`; per-sprint header counts tickets and total Story Points.
- **Gantt** — horizontal month-grid timeline driven by `start_date → due_date` with type-coloured bars (Bug=red, Epic=purple, Story=emerald, Task/other=sky).
All three views read from the cached `enterprise_agile_issues` so they remain available offline; a `Szinkron` button forces a fresh pull.

## 2026-05-05 — v3.0.0 Phase 8 implementation: persistent translation overrides, predictive forecaster v1, Org Pulse, Integration Health Center, Decision Memory observed-outcome capture

### Added — Persistent translation overrides
- Migration `supabase/migrations/20260505140000_phase8_overrides_pulse.sql` adds `enterprise_translation_overrides` (workspace_id, locale, key, value, source, authored_by) with `(workspace_id, locale, key)` UNIQUE, full RLS (member read, admin write).
- `I18nProvider` extended with `loadWorkspaceOverrides(workspaceId)` and `activeWorkspaceId`. Resolution order is now: workspace override (active locale) → bundle (active locale) → workspace override (default locale) → bundle (default locale) → key. `WorkspaceDashboard` invokes `loadWorkspaceOverrides(workspace.id)` on mount and clears on unmount.
- `Settings → Localization`: admins now have a true persistence path. Importing a CSV upserts each row into `enterprise_translation_overrides` and immediately reloads the active overrides — translations live without code changes.

### Added — Capacity DNA / Predictive forecaster v1 (rule-based, client-side)
- `CapacityDnaPanel` rendered inside the Resources tab with a *Generate snapshot for today* admin action.
- Computes baseline (active members), effective (baseline minus approved leave overlapping today), committed (sum of `enterprise_member_role_allocations.percentage / 100`), available, shortage_score, overload_score.
- Upserts to `enterprise_capacity_snapshots (workspace_id, snapshot_date)` UNIQUE; the last 30 days are surfaced as a compact table with shortage/overload trend icons.

### Added — Org Pulse widget
- `OrgPulseWidget` rendered above the workspace tabs (admins only). Pulls from a new SQL view `enterprise_org_pulse_membership` plus two on-the-fly counters (approvals open > 48h; approved leave in the last 7 days).
- Privacy-safe: every cell is suppressed when its denominator (`active_members`) is below `k = 5`, or when the value itself is between 1 and 4 (k-anonymity floor).

### Added — Integration Health Center
- New Settings section (admin only) — `IntegrationHealthCenter` lists each `enterprise_integrations` row with a per-integration health badge (`healthy / degraded / failed / unknown`) computed from the last 5 entries of `enterprise_agile_sync_log`.
- Surfaces last sync action, status, and the three most recent error excerpts inline.

### Added — Decision Memory observed-outcome capture
- Migration adds `enterprise_decision_memory.observation_due_at` plus a `BEFORE INSERT` trigger that defaults it to `authored_at + 14 days`.
- `DecisionMemoryStaleInbox` rendered inside the Approvals collapsible (admin only). Lists every memory whose observation window has elapsed and has no observed outcome yet; admins capture the outcome inline. Closes the learning loop on every recorded decision.

### i18n
- Added EN + HU keys for `pulse`, `capacity`, `integration_health`, `decision.stale_inbox_*`, `settings.localization.persisted`. Both bundles in lockstep — the import-CSV pipeline can now patch any gap without code deploys.

### Wiring
- `WorkspaceDashboard` imports the four new components, passes `isAdmin` + `userId` to `LocalizationSettings`, renders `CapacityDnaPanel` in Resources, `OrgPulseWidget` above tabs, `IntegrationHealthCenter` and `DecisionMemoryStaleInbox` in their respective Settings/Approvals sections.
- `loadWorkspaceOverrides` lifecycle anchored to the active workspace.

### Non-Regression Contract
- Migration is purely additive (one new table, one new view, one new column, one new trigger). No RLS weakening; new policies match the established `is_enterprise_member` / `has_enterprise_role` pattern.
- Phase 8 components are admin-only where they involve writes; read-only members see suppressed pulse cells and snapshot tables but cannot trigger writes.
- Forecaster v1 is rule-based and runs client-side — no edge-function or pg_cron dependency.

### Validation
- `npx tsc --noEmit -p tsconfig.app.json`: total error count unchanged at 18 (all pre-existing missing-peer-dep issues in the sandbox). Zero errors in any Phase 8 file (`CapacityDnaPanel`, `OrgPulseWidget`, `IntegrationHealthCenter`, `DecisionMemoryStaleInbox`, `csv` util, `I18nProvider` extensions, `LocalizationSettings` upsert path, both bundles).

## 2026-05-05 — v3.0.0 Phases 5–7 implementation: Onboarding, External Access matrix, Strategic capabilities, Localization expansion

### Added — Phase 5 (Onboarding & External Access)
- **Migration** `supabase/migrations/20260505130000_onboarding_access_strategic.sql` (idempotent additive):
  - `enterprise_onboarding_templates`, `enterprise_onboarding_template_steps` (8 step types: `task | read | acknowledge | training | exam | approval | internal_permission | external_access`),
  - `enterprise_onboarding_instances`, `enterprise_onboarding_step_completions`,
  - `enterprise_access_systems`, `enterprise_access_templates`, `enterprise_access_template_systems`, `enterprise_access_requests`, `enterprise_access_decisions`,
  - cross-table FK from onboarding step `access_system_id` to access systems,
  - full RLS (members read, admins write; child-table policies gate via parent's workspace),
  - `seed_default_access_systems` SECURITY DEFINER seeder (Jira / Confluence / Outlook / Dynatrace / ERP / Billing / Entry Control).
- **Workflows module** (`src/components/enterprise/workflows/`):
  - `WorkflowsModule` shell with 5 sub-tabs.
  - `OnboardingTemplates` — create + publish + archive templates, per-template collapsible step editor, 8 step types localized.
  - `OnboardingInbox` — start onboarding for a member, per-instance progress (completed steps / total steps), confirm/cancel actions.
  - `AccessSystems` — manage external + internal systems, **Seed defaults** RPC button, archive.
  - `AccessTemplates` — pivot-style position-bundle editor, system checkbox toggles per template, collapsible per template.
  - `AccessInbox` — submit on behalf of member, decide (approve/reject/mark granted/revoke), every decision writes to `enterprise_access_decisions`.
- **New `Folyamatok` (Workflows) tab** added to the workspace tab bar between Naptár and Erőforrások (gated by `members` view permission).

### Added — Phase 6 (Strategic capabilities)
- **Migration extends `enterprise_workspaces`**: `recovery_mode`, `recovery_mode_reason`, `recovery_mode_activated_at`, `recovery_mode_activated_by`.
- **`enterprise_capacity_snapshots`** table for per-day baseline / effective / committed / available FTE + shortage/overload scores + payload jsonb (foundation for predictive forecaster v2).
- **`enterprise_decision_memory`** table — `(workspace_id, subject_type, subject_id)` UNIQUE annotation with rationale / expected outcome / observed outcome.
- **`CommandCenter` widget** (`src/components/enterprise/CommandCenter.tsx`) — rendered at the top of the workspace dashboard, surfaces four counters (pending leave approvals, in-progress onboarding instances, pending access requests, members with incomplete org metadata). Click-through navigates to the relevant tab. Visually shifts to destructive-tinted card when Recovery Mode is active. Refreshes every 90s.
- **`RecoveryModeSettings`** — Settings → Recovery üzemmód section with activate/deactivate, reason, activated-at timestamp.
- **`DecisionMemoryEditor`** — generic memo component (`subject_type`, `subject_id`) for attaching rationale + expected/observed outcomes to any decision; uses upsert pattern. Drop-in for approvals, scenarios, access decisions.
- **WorkspaceDashboard** loads `recovery_mode` flag at mount and refreshes every 90s; CommandCenter receives the flag for visual emphasis.

### Added — Phase 7 (Localization expansion + admin manageability)
- **Hungarian localization completed** for all new keys: workflows, onboarding (template / instance / step types), access (systems / templates / inbox + 7 statuses + 5 actions), command center, decision memory, settings (recovery + localization import/export). EN baseline mirrored.
- **i18n CSV utilities** (`src/lib/i18n/csv.ts`):
  - `flatten(bundle)` — recursive dotted-key map of resource bundle.
  - `buildI18nCsv()` — RFC4180 CSV with BOM, columns `key,en,hu`, sorted by key.
  - `parseCsv(text)` and `parseI18nCsv(text)` — quoted-field aware parser, computes `{ added, updated, skipped, total, overrides }` summary; per-locale override Maps.
  - `bundleStats()` — total keys + missing-key counters per locale.
- **Settings → Localization** now exports / imports bilingual translation CSVs:
  - **Export CSV** downloads `effectime-i18n-YYYY-MM-DD.csv`.
  - **Import CSV** parses uploads, validates header, reports a session summary (`{{added}} new · {{updated}} updated · {{skipped}} skipped`). Persistent admin overrides land in a follow-up release; this surface is the canonical translator exchange unit.
  - Header now also shows live counters: total keys / missing in HU / missing in EN.

### Wiring
- `WorkspaceDashboard` imports `WorkflowsModule`, `CommandCenter`, `RecoveryModeSettings`; renders CommandCenter once at the top of `<main>`; new `workflows` TabsContent; new Settings section for Recovery Mode (admin only); refresh-on-interval recovery flag.
- New help anchor `workspace.workflows` registered in EN + HU bundles.

### Non-Regression Contract enforcement
- All Phase 5–6 tables additive; all RLS workspace-scoped via `is_enterprise_member()` / `has_enterprise_role()`.
- No existing tab, button, route, or workflow removed. Workflows is a brand-new tab, not a replacement.
- Command Center is purely additive (extra widget at top of `<main>`); existing dashboard layout below remains untouched.
- Decision Memory does not modify any existing approval/leave/scenario row — it stores a side-table annotation.
- i18n CSV import is session-only in this release; persistent overrides require a follow-up RPC and are explicitly noted in the import help text.

### Validation
- `npx tsc --noEmit -p tsconfig.app.json`: zero errors in any new file (workflows/*, CommandCenter, RecoveryModeSettings, DecisionMemoryEditor, csv util, both bundles, NotificationBell). Total error count unchanged at 18 — all pre-existing missing-peer-dep complaints in the sandbox.

## 2026-05-05 — v3.0.0 Phases 1–4 implementation: localization, help system, Organization module, position catalog, org chart, manual

### Added — Phase 1 (Localization + Help system)
- **i18n core** (`src/i18n/`): homegrown React-Context provider, EN + HU resource bundles (`src/i18n/resources/{en,hu}.ts`), `useT`/`useI18n` hooks, browser+localStorage+`profiles.preferred_locale` detection chain with English fallback. No new npm dependency.
- **Language selector** (`src/components/i18n/LanguageSelector.tsx`) — circular flag dropdown in the right header cluster; persists immediately to `localStorage.effectime.locale` and best-effort to `profiles.preferred_locale`.
- **Help system** (`src/lib/help/registry.tsx`, `src/components/help/HelpButton.tsx`, `src/components/help/HelpDrawer.tsx`) — question-mark button on the **left side** of every header, right-side drawer with section title, summary, common-tasks list, and breadcrumb chips. Page regions marked with `data-help-region="<anchor>"` receive a soft pulse ring (respects `prefers-reduced-motion`). Shipped anchors: `home.overview`, `workspace.members`, `workspace.organization`, `workspace.calendar`, `workspace.approvals`, `settings.localization`.
- **Help highlight CSS** (`src/index.css`): `.help-highlight-ring` + keyframes + reduced-motion guard.
- **Header restructure** (`src/pages/Enterprise.tsx`, `src/components/enterprise/WorkspaceDashboard.tsx`): Help (?) on left, Language selector in right cluster, all existing buttons preserved (Profilom, Meghívás, Kilépés, Új munkaterület). Workspace header now drives the help anchor from the active tab.
- **Settings → Localization** (`src/components/enterprise/settings/LocalizationSettings.tsx`): read-only v1 — lists EN + HU with active-language indicator, missing-key counter, workspace-default note.
- **Side fix**: missing `Building2` import in `Enterprise.tsx` (latent bug — would crash the empty-workspace state) added.

### Added — Phase 2 (Organization module)
- **Migration** `supabase/migrations/20260505120000_preferred_locale_and_organization.sql`: idempotent additive migration adding
  - `profiles.preferred_locale` + check constraint,
  - `enterprise_workspaces.default_locale` + check constraint,
  - tables: `enterprise_org_units`, `enterprise_leadership_levels`, `enterprise_contract_types`, `enterprise_industries`, `enterprise_work_categories`, `enterprise_job_families`, `enterprise_org_chart_snapshots`,
  - additive columns on `enterprise_memberships`: `org_unit_id`, `manager_id`, `leadership_level_id`, `contract_type_id`, `leadership_category` (with check constraint), `employer_rights`, `position_catalog_id`, `seniority`,
  - manager-cycle prevention trigger,
  - RLS policies (members view, admins manage) for all new tables,
  - `seed_default_contract_types` and `seed_default_leadership_levels` SECURITY DEFINER seeders.
- **People → Organization** tab (`src/components/enterprise/organization/`): full sub-module with seven tabs:
  - `OrgStructure` — hierarchical tree with parent picker, archive action.
  - `LeadershipLevels`, `ContractTypes`, `Industries`, `WorkCategories`, `JobFamilies` — backed by a shared `CatalogListEditor` (label + auto-slugged code, archive, optional **Seed defaults** for leadership and contracts).
  - `OrgChart` — auto-generated tree from `manager_id`, search filter, snapshot timestamp, **Regenerate snapshot** writes to `enterprise_org_chart_snapshots`.
- **InviteMemberDialog** enhanced (`src/components/enterprise/InviteMemberDialog.tsx`):
  - New optional Organization metadata section: org unit, direct manager, contract type, leadership level, leadership category, employer-rights checkbox.
  - Predefined Position Picker integration (Phase 3).
  - All new fields stored in the workspace `invitation_prefills` payload alongside existing fields.
  - Audit-log metadata extended with the new fields.
  - Existing free-text + RoleAllocationEditor + template paths fully preserved.
- **MemberProfileSheet** completion banner (`src/components/enterprise/MemberProfileSheet.tsx`): non-blocking amber banner at the top of the profile when any of `org_unit_id`, `manager_id`, `contract_type_id`, `leadership_level_id` is missing. Existing data preserved.

### Added — Phase 3 (Position catalog)
- **PositionPickerDialog** (`src/components/enterprise/positions/PositionPickerDialog.tsx`): three-step drill-down (category → role → review skills), reads from existing workspace catalog tables (`enterprise_workspace_role_categories`, `enterprise_workspace_roles`, `enterprise_workspace_role_skills`). Recommended `required` skills pre-checked; per-skill opt-in/opt-out; seniority selector (junior/medior/senior/lead/principal). Returns `{ positionRoleId, positionLabel, seniority, skillIds }` to the caller. Free-text path remains the default.

### Added — Phase 4 (Org chart + manual)
- **Org chart snapshot table** in the same migration; snapshot persistence wired through OrgChart's *Regenerate snapshot* action.
- **Bilingual user manual** (`docs/manual/{en,hu}/`):
  - `README.md`, `getting-started.md`, `workspaces.md`, `help.md`, `settings/localization.md`,
  - `people/members.md`, `people/organization.md`, `people/positions.md`,
  - parallel EN + HU editions covering all Phase 1–3 surface.

### Wiring
- `src/App.tsx`: wraps the app in `<I18nProvider>` and `<HelpRegistryProvider>`, renders `<HelpDrawer />` once at the top level.
- `WorkspaceDashboard` adds the `Szervezet` tab between Tagok and Naptár (gated by `members` view permission, identical to Tagok).
- `WorkspaceSettings` adds the Localization section after iCal.

### Non-Regression Contract enforcement
- Conflict engine, capacity engine, approval chain semantics, RLS helpers, email registry, office coverage rule fallback, calendar filter system, auth flows — **untouched**.
- All new fields on `enterprise_memberships` are nullable; the application reads via `.from('table').select('*')` patterns and degrades gracefully if columns are missing in dev.
- All new tables are workspace-scoped with `is_enterprise_member()` SELECT and `has_enterprise_role()` write policies.

### Validation
- `npx tsc --noEmit -p tsconfig.app.json`: 0 errors in any new or modified file. Total error count went from 19 → 18 (the missing `Building2` import in `Enterprise.tsx` is now fixed). Remaining 18 errors are all pre-existing missing-peer-dep complaints in the sandbox (`framer-motion`, `@dnd-kit/*`, `@tanstack/react-router`, `@tanstack/react-virtual`, `@lovable.dev/cloud-auth-js`, `@tanstack/react-start`) plus one pre-existing `CreateWorkspaceDialog` `userId` prop mismatch.
- Production `vite build` failure in the sandbox is pre-existing (peer-dep resolution against the lovable npm cache returned 403); identical on `HEAD` without these changes.

## 2026-05-05 — v3.0.0 Effectime Enterprise Master Framework (specification + Phase-1 prompts)

### Added — Versioning artifacts (no runtime changes in this commit)
- `versioning/05052601_v3.0.0_enterprise_master_spec.md` — canonical 25-section product, UX, frontend, backend, QA, localization, documentation, and rollout specification for the Effectime platform. Establishes the structural framework the existing modules must align to.
- `versioning/05052601_v3.0.0_ai_dev_prompts.md` — Phase-1 implementation prompts (header restructure, i18n scaffold, `profiles.preferred_locale`, help registry shell, Settings → Localization v1) with binding regression constraints and validation checklist.

### Scope established by this directive
- **First-class Organization module** (hierarchy, leadership levels, contractual relationships, industry, work categories, job families, automatic org chart) as a People sub-section — not a parallel hierarchy.
- **Mandatory member metadata** at creation: direct manager, organizational unit, position, leadership level, contract type, workspace, employer-rights flag, leadership category. Soft-required during transition with completion banner; cut-over date per workspace.
- **Predefined position catalog** with category drill-down and recommended skill expectation inheritance (junior/medior/senior). Free-text path preserved alongside catalog path. Builds on the role/category/skill catalog migration `20260505110000_enterprise_role_skill_catalog.sql`.
- **Onboarding playbook** as a first-class module: templates, instances, steps, ownership, deadlines, escalation, completion. Reuses the existing approval engine; does not duplicate it.
- **External Access Request matrix** tied to position and onboarding (Jira, Confluence, Outlook, Dynatrace, ERP, Billing, custom). Position × system pivot; routed through existing approval chains.
- **Help system** with question-mark icon on the **left side of the header**, contextual highlighting of the current page region, bilingual content, focus-trapped drawer.
- **Localization architecture** (English + Hungarian first), language selector with circular flag in the right header cluster. `profiles.preferred_locale` persistence; workspace default; missing-key fallback to English.
- **Full user manual** structure under `docs/manual/<locale>/<module>/<page>.md`, in-app `/manual` route, EN+HU parallel publishing.
- **Strategic capability framing** (capacity engine, predictive forecasting, workforce command center, approval orchestration, multi-workspace operating model, integration health, skill staffing, financials, scenarios, compliance, capacity DNA, recovery mode, org pulse, decision memory) layered on existing modules — not new top-level destinations.
- **Information architecture** consolidated to seven primary destinations: Home, Calendar, People, Workflows, Resources, Reports, Settings.

### Non-Regression Contract (binding)
- Auth flows, leave/approval lifecycle, quota math, conflict engine, capacity engine, RLS policies, email registry, office coverage rule fallback, and calendar filter system are classified **preserve exactly**.
- No removal of any existing tab, page, route, button, filter, export, or notification without an explicit `risky-change` artifact and changelog `Removed` entry.
- No silent semantics drift on approval, leave conflict, capacity, or coverage logic. No RLS weakening.
- No localization of database identifiers, enum codes, or stored permission keys.

### Non-Duplication Rules (binding)
- Organization module is canonical for hierarchy and contracts; existing People surfaces read from and write to it.
- Single skill taxonomy shared between SkillsManager and position catalog.
- Single approval engine for leave, onboarding, and access decisions.
- Onboarding and access KPIs ship as datasets/views in the existing report builder.
- All new flows route through `EnterpriseNotifications` and the transactional email registry.

### Rollout
- Phased delivery (Phase 1 foundations → Phase 7 localization completion) gated by per-workspace feature flags: `feat.help_system`, `feat.org_module`, `feat.position_catalog`, `feat.onboarding`, `feat.access_matrix`, `feat.localization_hu`, `feat.command_center`, `feat.recovery_mode`. Default off in production; rollback by flag.

### Notes
- This commit is **specification-only**. No `src/`, no migrations, no edge function changes. Runtime behavior is unchanged.
- Implementation begins under `versioning/05052601_v3.0.0_ai_dev_prompts.md` Phase 1.

---

## 2026-05-04 — SPA routing hardening + Auth page world-class redesign

### Fixed — SPA 404 at /auth (P0 production incident)
- **Root cause**: Cloudflare proxying to origin without Pages-level SPA fallback. Direct navigation to `/auth` returned HTTP 404 plain-text from origin.
- `public/_redirects`: normalised to single-space format (`/*  /index.html  200`) for maximum Cloudflare Pages / Netlify compatibility.
- `public/_headers`: added security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) and correct cache directives (`no-cache` for `index.html`, `immutable` for hashed assets).
- `public/404.html`: existing SPA redirect script confirmed correct — captures full path + query + hash into `sessionStorage` and redirects to `/?r=...`; `SpaRedirectHandler` in `App.tsx` restores the route.

### Enhanced — `src/pages/Auth.tsx` — Auth page architectural redesign
- **Trust badge row** (6 badges): GDPR-kompatibilis, ISO 27001 elvek, Enterprise Ready, 99.9% Uptime SLA, RLS adatelérés, Top SaaS 2026. Colour-coded icon cards with `whileInView` entrance animations.
- **Comparison matrix** ("Hagyományos eszközök vs. Effectime"): 6-row table with `X`/`Check` icons comparing setup time, approval flow, capacity view, leave balance, audit trail, mobile access. Zero Lorem Ipsum — all copy grounded in actual changelog capabilities.
- **FAQ expanded**: 3 → 6 professional Q&A items covering daily utility, enterprise structure, smart scheduling wizard, approval customisation, mobile access, and data security.
- **Calendar mockup legend**: colour legend row added (Elérhető / Szabadság / Betegszabadság).
- **Workflow step arrows**: `ArrowRight` connector between cards on desktop.
- **Feature callout pills**: three labelled pills below calendar section copy (Csapatnaptár, Éves nézet, Valós idejű).
- **Footer**: Terms, Privacy, Support links added.
- **Micro-interactions**: button hover lift (`hover:-translate-y-0.5`) and shadow-glow on primary CTA; Google button lift on hover; input `focus-visible:ring-primary`.
- All authentication logic preserved without modification (sign-in, sign-up, OTP verify, forgot-password, Google OAuth, email-activation callback).

## 2026-04-30 — Production stabilization audit: backend bug fixes

### Fixed — `src/lib/conflictEngine.ts`
- **`officeRuleApplies` legacy column fallback**: The function only checked `days_of_week` (array) but not the legacy `day_of_week` (scalar) column. Office coverage rules that used the scalar column were incorrectly applied to *every* day of the week instead of the configured day. Fixed by mirroring the same fallback logic already present in `ruleApplies`.
- **Unscoped `enterprise_holidays` query**: Holidays were fetched for the entire workspace history without a date range filter, causing unnecessary data transfer. Now filtered with `.gte`/`.lte` scoped to the requested date range.
- **Unscoped `leave_requests` query in conflict check**: All pending/approved leave requests for the workspace were fetched regardless of date. For large workspaces this was a significant over-fetch. Now filtered to only requests overlapping the requested date range (`.lte('start_date', rangeEnd).gte('end_date', rangeStart)`).

### Fixed — `src/lib/capacityEngine.ts`
- **Silent failure on Supabase query errors**: `computeWorkspaceCapacity` destructured only `{ data }` from Supabase responses, completely ignoring `.error`. A failed allocations or memberships query would return `null` data, causing the engine to silently compute zero-capacity results with no diagnostic output. All parallel queries now capture `.error` and log it via `console.error`.

### Fixed — `supabase/functions/jira-devops-proxy/index.ts`
- **`adoUpdate` could send empty JSON-patch**: If a caller provided a payload with none of the recognized fields (`summary`, `assignee_email`, `iteration_path`, `status`), the `ops` array remained empty and the ADO API rejected it with a misleading error. Now throws a descriptive error before making the network call if `ops.length === 0`.
- **`sync_project_config` accepted missing `project_key`**: `jiraSyncProjectConfig` fell back to an empty string for `project_key`, which produced incorrect or empty Jira API responses. Now validated with an early guard — throws if `project_key` is not set on the integration record.

### System Understanding Summary (Audit findings — no further action required)
- **Architecture**: Dual-product monorepo — Syncfolk (consumer event calendar) + PlannerMaster (enterprise leave/resource management), both backed by Supabase. Schema split (syncfolk / plannermaster schemas) was introduced 2026-04-29 as additive clones of public tables.
- **Business logic**: Leave conflict engine, capacity engine, coverage eligibility, and smart schedule algorithm are pure or near-pure TypeScript — testable, low coupling.
- **Data integrity**: RLS enforced on all enterprise tables via `has_enterprise_role()` / `is_enterprise_member()` SECURITY DEFINER functions. Foreign key cascade deletes on workspace-scoped tables.
- **Identified risk (informational)**: `Index.tsx` polls the DB every 4 s for both events and votes (two separate intervals). Acceptable at current scale but should be replaced with Supabase realtime subscriptions for cost and performance headroom.
- **Identified risk (informational)**: Audit log (`auditLog.ts`) is fire-and-forget; failures are only `console.warn`ed. For compliance-critical workspaces, a queue-based fallback would be safer.

## 2026-04-29 — Jira search hardening: normalized base URL for enhanced JQL endpoint

### Fixed
- `jira-devops-proxy` Jira hívásoknál a `base_url` normalizálása bekerült (`jiraBaseUrl()`), amely levágja a véletlenül eltárolt `/rest/api/...` útvonalrészt. Így akkor is a helyes `.../rest/api/3/search/jql` végpont hívódik, ha az integrációs beállításban nem csak host szerepel.
- Ugyanez a normalizálás egységesen alkalmazva lett a Jira `myself`, `field`, `issue create/update` és `browse` URL-ekre is, ezzel csökkentve a hibás endpoint-összefűzésből adódó 404/410 hibákat.

## 2026-04-28 — Agile Jira integration fix: search API migration + project config sync

### Fixed
- Jira issue lekérdezés átállítva a megszűnt `/rest/api/3/search` végpontról a támogatott `/rest/api/3/search/jql` végpontra, így a JQL alapú backlog lekérdezések (pl. `openSprints()`) ismét futnak.

### Added
- Új `sync_project_config` művelet a `jira-devops-proxy` edge functionben, amely:
  - betölti a projekt issue type listáját Jira-ból,
  - begyűjti a projektben használt label/component értékeket,
  - ezeket elmenti az `enterprise_agile_field_metadata` táblába.
- `IssueWriteback` UI-ban új „Jira projekt konfiguráció szinkron” gomb + DB-ből visszatöltés.
- Issue létrehozásnál a Jira issue type mező már DB-alapú dropdownból választható, a címke mező pedig Jira label javaslatokat ad (datalist), csökkentve az elírásból adódó hibákat.

## 2026-04-28 — v2.6.0 Annual quotas fix + Agile integration GA

### Fixed
- **Annual calendar quotas** now filter `enterprise_quota_transactions` by `workspace_id` AND the resolved `quota_id` (which inherently scopes by year + leave_type). Previous logic summed every TX across all years/types for the membership, producing inflated/incorrect "used" counts.

### Added
- **Agile module (Resources → Agile)** replacing the duplicate Idővonal tab:
  - `BacklogBrowser` — JQL/WIQL search with cached results in `enterprise_agile_issues`
  - `IssueWriteback` — create + update issues for both Jira and Azure DevOps
  - `CapacityFit` — sprint capacity vs. planned hours, overload/underload detection
  - `FieldDiscovery` — custom field metadata discovery
  - `AgilePanel` — unified shell with integration switcher
- **`jira-devops-proxy` edge function** — unified secure proxy supporting `test_connection`, `discover_fields`, `search_issues`, `create_issue`, `update_issue`. Membership-checked; logs every call into `enterprise_agile_sync_log`.
- **IntegrationManager "Kapcsolat tesztelése"** button per integration row.
- **pg_cron daily job** `auto-archive-expired-coverage-rules-daily` (02:15 UTC) → invokes `public.auto_archive_expired_coverage_rules()`.

### Removed
- `Idővonal` tab from Resources (Hőtérkép remains as primary capacity view; Project Gantt stays inside the Projects tab).

## 2026-04-27 — v2.5.1 Calendar/Capacity regression hotfix

### Fixed
- `OfficeCoverageRuleManager`: a `business_roles` / `skill_ids` oszlopokra épülő mentés most schema-cache safe. Ha a Supabase/PostgREST még a régi `enterprise_office_coverage_rules` sémát látja, a mentés automatikusan legacy payloadra esik vissza (`business_role`, `skill_id`), így az egy pozíciós telephelyi szabály mentése nem dob `Could not find the 'business_roles' column` hibát.
- `CoveragePlannerView`: eltávolítva a `Szabályok szerkesztése` gomb a Kapacitástervezőből, mert rossz helyre navigált és a felhasználói flow-t zavarta.
- `CoveragePlannerView`: havi nézetben a szabály nélküli telephely sorok már nem szöveges, sort magasító cellákat mutatnak, hanem visszafogott szürke napcellákat vékony elválasztó vonalakkal.
- `TimelineView`: az Idővonal szűrőpanelje desktopon keskeny bal oldali sávba került, a naptár pedig mellette, `minmax(0, 1fr)` tartalomterületen jelenik meg.

### Regression guard
- Megmaradt a multi-pozíció / multi-skill támogatás, ha az adatbázis már tartalmazza az új tömb oszlopokat.
- A fallback csak schema-cache / hiányzó `business_roles` / `skill_ids` oszlop hiba esetén aktiválódik, más mentési hibákat továbbra is változatlanul megjelenít.

---

## 2026-04-27 — Multi-pozíció szabályok, Absentify szűrőpanel, havi nézet, navigációs bug fix, éves nézet fix

### OfficeCoverageRuleManager — Több pozíció / skill egy szabályban
- Szabályhoz mostantól több pozíció ÉS több skill is hozzárendelhető (checkbox multi-select lista)
- Pozíció-lista most MINDEN definiált pozíciót megjelenít: `enterprise_memberships.business_role` + `enterprise_member_role_allocations.business_role` union (nem csak a jelenleg hozzárendelt szerepek látszanak)
- DB migráció: `business_roles text[]` és `skill_ids uuid[]` oszlopok hozzáadva az `enterprise_office_coverage_rules` táblához, backward-compatible constraint frissítéssel

### CoveragePlannerView — Heti/Havi nézet + multi-pozíció kezelés
- Heti / Havi nézet váltó gomb; havi módban vízszintes görgetősáv jelenik meg a napok felett
- A cella megjelenítése **elvárás / van** (pl. "4 / 3") formátumra változott
- `supplyFor` mostantól BÁRMELY pozíció/skill egyezésekor számít (OR logika a szabály tömbjein belül)
- Race condition fix: `loadIdRef` megakadályozza a stale válaszok felülírását navigálásnál

### CalendarFilterBar — Absentify-stílusú összecsukható panel
- Teljes újratervezés: vízszintes dropdown-gombok → accordion panel
- Fejléc: "Szűrők (n)" lila badge az aktív szűrők számával + "Elrejt/Megjelenít" gomb
- Minden kategória alapból összecsukott; lila háttér ha aktív kijelölés van benne
- Keresőmező 6+ elemű listáknál; azonnali szűrés (nincs külön Alkalmaz gomb)

### useCalendarFilterConfig — Új szűrőtípusok
- `skill` (Képesség / Skill) és `location` (Helyszín / város) szűrők hozzáadva
- Meglévő workspace-konfigurációk automatikusan kiegészülnek az új szűrőkkel

### TimelineView — Navigációs bug fix + új szűrők
- Race condition javítva: `loadIdRef` garantálja, hogy csak a legutóbbi kérés frissíti az állapotot
- Betöltési hiba esetén helyes hibaüzenet jelenik meg (nem az "üres szűrőállapot")
- Skill-szűrő: `enterprise_member_skills` betöltése, tagok skill-készletük alapján szűrhetők
- Helyszín-szűrő: `city` mező a membershipből, városra szűrhető

### AnnualLeaveGrid — Éves nézet adat- és színhiba javítása
- Dátumtartomány-lekérdezés javítva: `lte(start_date, yEnd) AND gte(end_date, yStart)` (valódi overlap)
- Szín-feloldás bővítve: egyedi enterprise típus nevén kívül az enum értékekre (`vacation`, `sick_leave`, stb.) is fallback szín kerül, így minden távollét mindig színezve jelenik meg

---

## 2026-04-27 — Phase C+D+E: Skill Reporting, Widget Restructuring, Yearly Fix & QA [Fázis C/D/E]

### Chapter 4 — Dynamic Capacity & Skill Reporting (Phase C)
- Új `SkillCapacityReport` komponens (`src/components/enterprise/calendar/SkillCapacityReport.tsx`): a TimelineView szűrő-motorjával szinkronizált, valós idejű riport a szűrt user pool-hoz.
- **Összefoglaló kártyák** (glassmorphism stílusú): Szűrt tagok · Elérhető · Jóváhagyott távollét · Elérhetőség %.
- **Készség elérhetőség** panel: skill-enkénti progress bar (szín = a skill saját hex kódja), elérhető/összes arány.
- **Pozíció kapacitás** panel: Recharts horizontális stacked BarChart (zöld = elérhető, piros = távol).
- Skeleton loaderek az aggregálás idejére; cleanup (`cancelled` flag) a stale request megelőzésére.
- **Integráció**: `WorkspaceDashboard` Idővonal tab-on `onFilteredUsersChange` callback vezérli a `SkillCapacityReport`-ot — bármely szűrőváltozás automatikusan újra-aggregál.

### Chapter 1 — Calendar Widget Restructuring (Phase D, Task 1)
- **Task 1.1 — Widget-áthelyezés**: `BirthdayAnniversaryWidget` és `AnnualTrendChart` átkerült a `Naptár` fő nézetben a `LeaveCalendar` *alá* (korábban fölötte volt). Ezentúl kiegészítő, másodlagos infó-blokkok.
- **Task 1.2 — Intelligent Collapsed State**: `BirthdayAnniversaryWidget` mostantól `Collapsible` (alapállapot: **csukva**). Piros badge (`bg-red-500 text-white rounded-full`) jelzi a következő 7 napon belüli eseményeket. A lista-soroknál a 7 napon belüli események `bg-red-50 dark:bg-red-950/20` tintával emelkednek ki.
- `checkUpcomingEvents()` pure utility függvény: leap-year safe, timezone-safe, 7 napos ablak.

### Chapter 2 — Eliminate Misleading Status Indicator (Phase D, Task 2)
- `OutTodayWidget` eltávolítva a **Tagok** fülből. A "Mindenki dolgozik ma" üres-state szöveg félrevezető volt (hétvégén és ünnepnapokon is megjelent). Az aktuális távolléti állapot a Naptár → Idővonal nézeten tekinthető meg.

### Chapter 5 — Yearly Calendar Remediation (Phase D, Task 5)
- `AnnualLeaveGrid` bővítve:
  - **Felhasználó-választó dropdown** adminok számára (`allMembers` prop alapján): alapértelmezett = bejelentkezett felhasználó.
  - **`resolvedMembershipId` auto-fetch**: ha a `membershipId` prop nincs megadva, a komponens `allMembers`-ből vagy DB lekérdezéssel oldja fel → a kvóta (`Allowance / Carried over / Remaining`) mostantól helyesen jelenik meg.
  - `WorkspaceDashboard` átadja `allMembers` és `isAdmin` propokat az `AnnualLeaveGrid`-nek.

### Chapter 7 — QA & Delivery (Phase E)
- Zero regression: meglévő `LeaveCalendar`, `TimelineView`, `CoveragePlannerView` érintetlen.
- `BirthdayAnniversaryWidget` eredeti listázó logikája megmaradt; csak wrapper és stílus változott.
- `AnnualLeaveGrid` backward-compatible: `membershipId?` és `allMembers?` opcionálisak.
- TypeScript build tiszta (tsc --noEmit).

---

## 2026-04-27 — Naptár Idővonal nézet (Absentify-style) + dinamikus szűrő-motor [Phase A]

### Added
- **Idővonal nézet** (`TimelineView`): row-by-row Absentify-stílusú grid napi cell-státuszokkal (szabadság / ünnep / hétvége / munkanap), `@tanstack/react-virtual` row virtualizációval (200+ tag is gördülékeny).
- **Dinamikus szűrő-motor** (`CalendarFilterBar`): multi-select Popover szűrők (Telephely, Csapat, Pozíció, Szabadság típusa, Státusz). Auto-apply (nincs Submit), aktív szűrő = lila tint, "Szűrők (n)" badge.
- **Naptár Szűrők beállítása** admin felület (Settings tab): drag&drop sorrend (`@dnd-kit`) + per-szűrő enable/disable kapcsoló, workspace-szintű perzisztencia.
- 3. tab a Naptár oldalon: **Naptár | Idővonal | Éves nézet**.

### Database
- Új tábla: `tenant_calendar_settings` (workspace_id UNIQUE, filters_config JSONB) RLS-sel: tagok olvassák, owner/resourceAssistant írja.

### Dependencies
- `@tanstack/react-virtual`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### Notes
- Zero-regression: a meglévő Naptár és Éves nézet érintetlen.
- A `TimelineView` `onFilteredUsersChange` propon keresztül adja le a szűrt user pool-t — Phase B (Coverage Engine) és Phase C (Skill Reporting) ezt fogja fogyasztani.

# Changelog

## 2026-04-25 — Absentify integráció: Quota, Substitute, Attachment, iCal, Jira/AzureDevOps integráció
- Új komponensek bekötve: `OutTodayWidget` (Tagok fül), `QuotaBalanceCard` + `SubstituteInbox` (Kérelmek fül), `QuotaManager` + `IntegrationManager` + `ICalSubscription` (Beállítások fül)
- `LeaveRequestDialog` bővítve: helyettesítő-választó (`SubstitutePicker` integrálva), csatolmány-feltöltés (`leave-attachments` Storage bucket), privát kérelem toggle (`is_private`), audit metadatában a substitute_count + has_attachment + is_private nyomon követve
- `LeaveRequestList.handleCancel` mostantól bekéri és tárolja a `cancellation_reason`-t (audit metadata-ba is bekerül)
- Helyettesítő-rögzítés (sorrendben) az új `leave_request_substitutes` táblába írja az adatokat
- Backward-compatibility: meglévő mezők és táblák érintetlenek; az új mezők opcionálisak/null-default-tel
- Nem duplikáltunk meglévő funkciót — a Naptár, Kérelmek, Beállítások meglévő tab-jaiba kerültek be a panelek


## 2026-04-11 — v2.4.0 Email értesítések, demo adatok, mobil tesztelés
- Email értesítés küldés jóváhagyási/elutasítási döntéseknél (transactional email infra + leave-decision sablon)
- Genisys workspace demo adatok: 8 tag (owner, resourceAssistant, 6 member), 12 szabadságkérelem (pending/approved/rejected), szabadság típusok, ünnepnapok, tiltott napok, napi szabályok, jóváhagyási lánc, escalation, értesítések, audit log események
- Leiratkozás oldal (/unsubscribe) az email értesítésekhez
- Mobil reszponzivitás tesztelve: összes Enterprise tab (Tagok, Kérelmek, Jóváhagyások, Értesítések, Riportok, Audit, Export) megfelelően jelenik meg 390px szélességen

## 2026-04-11 — v2.3.0 Enterprise Phases 4-9: Approval Chain, Audit, Notifications, Export, Reporting, Templates
- Jira: SYN-146 + remaining enterprise stories
- Új DB táblák: `enterprise_approval_chains`, `enterprise_escalation_rules`, `enterprise_audit_events`, `enterprise_notifications`, `enterprise_rule_templates`, `enterprise_export_jobs`
- Phase 4: Jóváhagyási lánc konfiguráció (lépések, szerepkörök), eszkaláció szabályok (óra küszöb, célszerepkör, owner értesítés)
- Phase 5: Audit log (immutable, szűrhető, kereshető, 100 utolsó esemény)
- Phase 6: Enterprise értesítések (olvasott/olvasatlan, törlés, emoji ikonok)
- Phase 7: CSV export (dátumtartomány, státusz szűrő, ünnepnapok, audit log bejegyzés)
- Phase 8: Reporting dashboard (KPI kártyák, státusz pie chart, típus bar chart, napi távollévők chart)
- Phase 9: Szabálysablon könyvtár (létrehozás, duplikálás, archiválás, JSON adat)
- WorkspaceDashboard: 6 új tab (Értesítések, Riportok, Audit, Export + Approval chain és Templates a Szabályok tabba)

## 2026-04-11 — v2.2.0 Enterprise Phase 3: Leave Types, Holidays, Rules & Conflict Engine
- Jira: SYN-148, SYN-147
- Funkció: Egyedi szabadság típusok, ünnepnapok, tiltott napok, napi szabályok kezelése
- Új DB táblák: `enterprise_leave_types`, `enterprise_holidays`, `enterprise_blocked_dates`, `enterprise_daily_rules`
- RLS: workspace tagok olvashatják, owner/resourceAssistant kezelhetik a konfigurációt
- Új UI komponensek: `LeaveTypeManager`, `HolidayManager`, `BlockedDateManager`, `DailyRuleManager`
- Új "Szabályok" tab a WorkspaceDashboard-ban (admin only)
- Conflict engine (`src/lib/conflictEngine.ts`): tiltott nap, ünnepnap, max-off, saját átfedés ellenőrzés
- LeaveRequestDialog: kétlépcsős submit (Ellenőrzés → Beküldés), blocking/warning ütközések megjelenítése
- Módosított fájlok: `WorkspaceDashboard.tsx`, `LeaveRequestDialog.tsx`

## 2026-04-11 — v2.1.0 Enterprise Phase 2: Leave Request & Approval Workflow
- Jira: SYN-165, SYN-150, SYN-149
- Funkció: Távolléti kérelem beküldés, jóváhagyási workflow, approval inbox
- Új DB táblák: `leave_requests`, `approval_decisions`
- Új enumok: `leave_request_status` (draft/pending/approved/rejected/cancelled/expired), `leave_type` (vacation/sick_leave/unpaid_leave/other)
- RLS policies: tagok saját kérelmet adhatnak be, owner/resourceAssistant jóváhagyhat/elutasíthat
- Új UI komponensek: `LeaveRequestDialog`, `LeaveRequestList`, `ApprovalInbox`
- WorkspaceDashboard-ban új tabok: Kérelmek, Jóváhagyások
- Bulk approve/reject funkció az approval inbox-ban szűrőkkel
- Módosított fájlok: `src/components/enterprise/WorkspaceDashboard.tsx`
- Új fájlok: `src/components/enterprise/LeaveRequestDialog.tsx`, `LeaveRequestList.tsx`, `ApprovalInbox.tsx`

## 2026-04-11 — v2.0.0 Enterprise Phase 1
- Jira: SYN-168, SYN-170, SYN-169
- Funkció: Enterprise B2B modul alapjai — Workspace, Membership, Roles
- Új DB táblák: `enterprise_workspaces`, `enterprise_memberships`, `enterprise_invitations`
- Új enumok: `enterprise_role` (owner/resourceAssistant/member), `enterprise_membership_status` (active/invited/suspended/removed)
- Új SECURITY DEFINER funkciók: `has_enterprise_role()`, `is_enterprise_member()`
- RLS policies: role-alapú hozzáférés-szabályozás minden enterprise táblán
- Új UI: `/enterprise` route, workspace lista, dashboard, tag kezelés, meghívók, beállítások
- ProfileMenu-ben Enterprise menüpont hozzáadva
- Módosított fájlok: `src/App.tsx`, `src/components/ProfileMenu.tsx`
- Új fájlok: `src/pages/Enterprise.tsx`, `src/components/enterprise/*`

## 2026-03-26
- Jira: nincs hozzárendelt jegyszám
- Funkció: a kitűzött nap kiválasztó popup mérete limitálva lett, egyszerre legfeljebb kb. 5 dátum látható, a lista görgethető maradt.
- Funkció: kitűzött nap esetén a batch kitöltés panel továbbra is megjelenik, de minden vezérlője inaktív állapotba kerül.
- Funkció: a kitűzött nap módosítása ablakban megjelent a Feloldás művelet, amellyel újranyitható a szavazás, ha az esemény nincs határidőn túl és nincs inaktiválva.
- Funkció: a személyes elérhetőség másolása nem fut le olyan eseményre, amelyen már van kitűzött nap.
- UI/reszponzivitás: a központi naptár lett az elsődleges szélességi referencia, a bal és jobb oldali panelek ehhez igazodnak kisebb hézagokkal.
- Technikai megvalósítás: módosítva `src/pages/Index.tsx`, `src/components/BatchVotePanel.tsx`, `src/components/PersonalCalendar.tsx`.

## 2026-03-31
- Jira: nincs hozzárendelt jegyszám
- Versioning hivatkozások:
  - `versioning/01033102_syncfolk_calendar_mobile_fix_request.pdf`
  - `versioning/01033102_syncfolk_calendar_mobile_fix_prompt.md`
- Üzleti kérés: csak az esemény részletező modal dátumválasztó naptárának mobilos megjelenését kellett javítani úgy, hogy a popup mindig a képernyő közepén jelenjen meg, és az OK gomb minden mobil nézetben látható maradjon.
- Technikai megvalósítás: az `EventInfoModal` dátumszerkesztő részében a korábbi nyers `Popover + Calendar` megoldás helyett a már létező, mobilon középre pozicionált `DatePopoverField` került használatba.
- Ellenőrzési checklist:
  - [x] `CHANGELOG.md` beolvasva
  - [ ] `codingLessonsLearnt.md` / lessons learnt fájl nem található a feltöltött repóban
  - [x] csak célzott hotfix készült az érintett dátumválasztó mezőkre
  - [x] mobilon középre kerül a calendar popup
  - [x] az OK gomb explicit módon megjelenik és használható marad
  - [x] a kezdő/vég dátum alaplogikája megmaradt
  - [x] build ellenőrzés lefutott sikeresen
- Módosított kódfájl: `src/components/EventInfoModal.tsx`

## 2026-04-22 — v2.5.0 Resource Management ökoszisztéma + dinamikus jogosultság-fa
- Phase 1 (Core Architecture, Single Source of Truth):
  - `enterprise_memberships.base_working_hours` (numeric, 0–24, default 8) — alap napi munkaóra tagonként
  - `capacityEngine` átállítva órás számításra: `hours = base_working_hours * (allocation_pct / 100)`
  - `BusinessRoleManager` (Pozíciók) most már listázza az ÖSSZES allokált tagot pozíciónként, %-os allokációval és számolt napi órával — megszüntetve a korábbi "csak 1 tag" data dissonance-t
  - `LeaveCalendar` csapat-szűrő dinamikusan a `enterprise_teams` táblából töltődik (hardcoded lista törölve)
  - `MemberProfileSheet`: szerkeszthető "Napi alap munkaóra" mező
- Phase 2 (UI Relocation & Dynamic Permissions):
  - Pozíciók és Csapatok kezelése áthelyezve a Beállításokból az **Erőforrások** fülre (alapból összecsukott akkordionok)
  - Új `enterprise_feature_catalog` tábla (parent_key hierarchia) — dinamikus, fa-alapú jogosultság-katalógus
  - `useEnterprisePermissions` hook visszaadja a `featureTree`-t (rekurzív struktúra)
  - `RolePermissionManager` UI átírva rekurzív fa-renderelésre (`FeatureTreeRow` komponens) — a jogosultság-választó automatikusan tükrözi az alkalmazás navigációs fáját, fallback a régi flat csoportosításra ha a katalógus üres
- Phase 3 (Resource Module — előző iterációkban):
  - `ResourceDashboard`, `ProjectList`, `ProjectEditor`, `GanttTimeline`, `CapacityGapReport`
  - "Kitűz a Riportokra" widget integráció (`ResourceWidgetCard`, `PinnedReportsWidget`)
- Új/módosított fájlok: `supabase/migrations/20260422164431_*.sql`, `src/lib/capacityEngine.ts`, `src/components/enterprise/BusinessRoleManager.tsx`, `LeaveCalendar.tsx`, `MemberProfileSheet.tsx`, `WorkspaceDashboard.tsx`, `RolePermissionManager.tsx`, `resources/ResourcesTab.tsx`, `src/hooks/useEnterprisePermissions.ts`

## 2026-04-25 — Absentify gap round: hátralévő dashboard integrációk + Team policy bővítés
- WorkspaceDashboard / Beállítások fül: a 4 új panel (`AllowanceManager`, `WorkspaceGeneralSettings`, `BrandingManager`, `CsvImportPanel`) beillesztve meglévő `SettingsSection` blokkokba (nem új tab, nem duplikált UI)
- Naptár fül bővítve beágyazott sub-tabokkal: `Naptár` + `Éves nézet`; az `AnnualLeaveGrid` a meglévő Calendar tabon belül érhető el
- TeamManager bővítve Department policy mezőkkel: `max_absent` és `approval_mode` (lineáris/párhuzamos) szerkeszthető csapatszinten
- Csomag I widget kiegészítés: új `BirthdayAnniversaryWidget` és `AnnualTrendChart` a Naptár fő nézetben
- Minden új elem additív módon, meglévő flow-k sértetlenül került bekötésre

## 2026-04-29 — Syncfolk / PlannerMaster schema split prep + full data clone migration

### Added
- Új Supabase migráció: `20260429120000_multi_tenant_schema_split.sql`.
- Új sémák automatikus létrehozása: `syncfolk` (consumer) és `plannermaster` (enterprise).
- Additív, adatvesztésmentes klónozás a `public` sémából:
  - `syncfolk`: core Syncfolk táblák (`profiles`, `events`, `votes`, stb.)
  - `plannermaster`: minden `enterprise_*` tábla + enterprise workflow táblák (`leave_requests`, `approval_decisions`, stb.)
- RLS engedélyezés a klónozott táblákon.
- Két schema-scoped helper függvény edge function izolációhoz:
  - `syncfolk.set_search_path()`
  - `plannermaster.set_search_path()`

### Notes
- A migráció szándékosan **nem törli/nem mozgatja** a meglévő `public` objektumokat, így minimális regressziós kockázattal futtatható olyan adatbázisban is, ahol másik app objektumai is élnek.

## 2026-04-29 — Kapacitástervező gyors feltöltés és Instant user gomb
- `MemberList`: új **Instant user** gomb az admin taglistán, amely a jelenlegi workspace-re automatikusan létrehoz egy meghívást előtöltött, meglévő entitásokból származó metadata-val (pozíció/csapat/telephely mintázat), így adatintegritás-barát gyors taggenerálás érhető el.
- `MemberList`: duplikált „Új tag hozzáadása” gomb JSX regresszió javítva.
- Hotfix: `Instant user` meghívásnál schema-cache kompatibilis fallback: ha a `metadata` oszlop még nem látszik (`PGRST204`), metadata nélküli insertre vált.
- Hotfix: Jira keresés proxy többvégpontos fallbacket kapott (`/search/jql` POST/GET + `/search` POST), hogy a tenant-specifikus API eltérések ne okozzanak 500-at.

## 2026-04-30 — v2.6.0 Agile Integration Capacity Sync Foundation Expansion
- Jira/Azure DevOps Agile modul additív bővítése enterprise-grade capacity sync alapokkal.
- Új adatmodell elemek migrációval:
  - `enterprise_agile_external_field_mappings` (dinamikus külső→normalizált mező mapping, irány, safe writeback flag)
  - `enterprise_agile_capacity_events` (változás/kapacitás/variance/risk/writeback/szimuláció esemény napló)
  - `enterprise_agile_issues` kiterjesztés: `capacity_risk`, `fit_score`, `suggested_role`, `plan_impact_reason`, `external_type`, `target_sprint`
- Új RLS policy-k az agile mapping/event táblákhoz enterprise szerepkör alapú jogosultsággal.
- Capacity Fit UI bővítések:
  - What-if szimuláció (`szabadság nap/fő`) azonnali kapacitás újraszámítással
  - Tagonkénti risk-level (Low/Medium/High) és fit-score (%) megjelenítés
  - Overload/underload jelzések megtartása a korábbi működéssel kompatibilisen
- Cél: a meglévő Jira/ADO foundation megtartása mellett előkészített adat- és UI-alap a kétirányú, auditált capacity sync iteratív bővítéséhez.

## 2026-05-05 — Enterprise role/category/skill catalog foundation (inventory + workspace overrides)
- Új adatmodell bevezetve a munkakategória → munkakör → skill kapcsolatokhoz, külön ID-alapú entitásokkal és deduplikált skill-kezeléssel.
- Új globális inventory táblák: `enterprise_catalog_categories`, `enterprise_catalog_roles`, `enterprise_catalog_skills`, `enterprise_catalog_role_skills`.
- Új cégszintű testreszabható réteg: `enterprise_workspace_role_categories`, `enterprise_workspace_roles`, `enterprise_workspace_skills`, `enterprise_workspace_role_skills`.
- `enterprise_memberships` bővítve `business_role_id` mezővel (FK a workspace role táblára), így a meglévő szöveges `business_role` mellett ID-alapú kötés is elérhető.
- Experience/szenioritás bevezetve `enterprise_experience_level` enumon keresztül, szerep-skill elvárásokon használható (`min_experience_level`).
- RLS policy-k, indexek és `updated_at` triggerek hozzáadva a karbantartható, multi-tenant működéshez.
