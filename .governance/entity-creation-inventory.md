# Entitás-létrehozási leltár (Workspace Dashboard)

> **GOVERNANCE SZABÁLY**
> Ez a fájl az egyetlen emberi-olvasható forrása az összes létrehozható entitásnak.
> Gépileg olvasható párja: `supabase/functions/seed-demo-workspace/seed-data.ts`
>
> **Ha új tab / menü / dialog kerül az appba ahol entitást lehet létrehozni:**
> 1. Frissítsd ezt a fájlt (UI belépési pont leírása)
> 2. Add hozzá a demo adatot a `seed-data.ts`-hez (statikus adatok)
> 3. Add hozzá az insert logikát a `seed/index.ts`-hez (megfelelő szekció: L–S)
> 4. Deploy: `seed-demo-workspace` edge function új verzióként
>
> **Seed lefedettség** — minden `✅` entitás automatikusan létrejön új demo workspace-ben.

Comprehensive inventory of all UI entry points where users can CREATE database entities (insert/upsert operations). Organized by Dashboard tab → Sub-tab → Section → Entity type.

---

## 1. Tagok (Members tab) — `MemberList.tsx`

### Új tag meghívása
- **Component:** `InviteMemberDialog.tsx`
- **Entities Created:**
  - `enterprise_invitations` → invitation record — ⚠️ nem seedelve (invite flow nem kell demo-ban)
  - `enterprise_memberships` → membership created on acceptance via `join-event` RPC — ✅ seedelve (A9)
  - `enterprise_member_role_allocations` → role allocation — ✅ seedelve (A11)
  - `enterprise_member_templates` ✅ → meghívó sablon (workspace_id, template_name, default_role, default_team, default_business_role, default_city, default_office_id) — seedelve (M)
- **Dialog Fields:** Email, name, role, office, city, location, business roles/allocations, org unit, contract type, leadership level, manager reference

### Tag telephely-prioritás szerkesztő
- **Component:** `MemberSitePriorityEditor.tsx`
- **Entities Created:**
  - `enterprise_member_site_priorities` ✅ → (workspace_id, membership_id, office_id, priority 1–n, notes) — seedelve (R)

---

## 2. Szervezet (Organization tab) — `OrganizationModule.tsx`

### 2.1 Szerkezet (OrgStructure)
- **Component:** `OrgStructure.tsx`
- **Entities Created:**
  - `enterprise_org_units` ✅ → szervezeti egység (division, department, team, etc.), hierarchikus fa — seedelve (B6): 2 top-level division + 3 sub-team
- **Parent Support:** Hierarchical tree structure
- **Button:** "Új egység"
- **Seed config key:** `org_units` (max 5, az összes seedelve ha > 0)

### 2.2 Csapatok (TeamManager)
- **Component:** `TeamManager.tsx`
- **Entities Created:**
  - `enterprise_teams` ✅ → team (name, description, approval mode, max absent) — seedelve (A5)
  - `enterprise_team_roles` ✅ → team role assignment (team_id, business_role) — seedelve (B7)
- **Sub-sections:** Team list with role management

### 2.3 Pozíciók / Munkakörök (BusinessRoleManager)
- **Component:** `BusinessRoleManager.tsx`
- **Entities Created:**
  - `enterprise_member_role_allocations` ✅ → role allocation to member (membership_id, business_role, percentage, is_priority) — seedelve (A11)
- **Sub-dialog:** `PositionPickerDialog.tsx` → predefined position catalog selection (no insert, read-only reference)
- **Note:** Positions themselves managed via catalogs (CatalogListEditor)

### 2.4 Jogosultság-menedzsment (RolePermissionManager)
- **Component:** `RolePermissionManager.tsx`
- **Entities Created:**
  - `enterprise_role_definitions` ✅ → (workspace_id, role_key, display_name, description, sort_order) — seedelve (L1)
  - `enterprise_role_permissions` ✅ → (workspace_id, role_key, feature_key, access_level: none|readonly|edit) — seedelve (L2)
- **Access Levels:** none, readonly, edit
- **Default Permissions:** Applied per feature key on role creation

### 2.5 Katalógus Szerkesztő (CatalogListEditor)
- **Component:** `organization/CatalogListEditor.tsx`
- **Entities Created:**
  - `enterprise_contract_types` ✅ → szerződéstípus (code, label, is_default) — seedelve (B3): 4 típus alapból, max 5; `CONTRACT_TYPE_DEFS` vezérli
  - `enterprise_industries` ✅ → iparág (code, label, is_default) — seedelve (B4): 3 alapból, max 5; `INDUSTRY_DEFS` vezérli
  - `enterprise_job_families` ✅ → munkacsalád (code, label, sort_order) — seedelve (B1): 6 alapból, max 6; `JOB_FAMILY_DEFS` vezérli
  - `enterprise_leadership_levels` ✅ → vezetői szint (code, label, sort_order) — seedelve (B2): 4 alapból (strategic/operational/technical/execution kötelező, 5. specialist opcionális); `LEADERSHIP_LEVEL_DEFS` vezérli
  - `enterprise_work_categories` ✅ → munkakategória (code, label, parent_id) — seedelve (B5): 5 fő-kategória + 2 al-kategória (frontend_dev/backend_dev); `WORK_CATEGORY_DEFS` vezérli
- **Note:** Minden katalógus saját szerkesztővel, add/edit/delete/archive UI-val rendelkezik
- **Seed config keys:** `job_families`, `leadership_levels`, `contract_types`, `industries`, `work_categories`

---

## 3. Naptár (Calendar tab) — `LeaveCalendar.tsx` (main subtab)

### 3.1 Naptár főnézet (LeaveCalendar)
- **Component:** `LeaveCalendar.tsx`
- **Entities Created:**
  - `leave_requests` → absence request (via LeaveRequestDialog)
    - `leave_requests.start_date`, `end_date`, `leave_type` (vacation, sick_leave, unpaid_leave, other)
    - `leave_requests.is_half_day`, `half_day_period` (morning/afternoon)
    - `leave_requests.is_private`, `comment`, `status`
    - `leave_requests.attachment_path` (file storage)
  - `leave_request_substitutes` → substitute/backup assignment (ordered list, pending → approved workflow)
- **Dialog:** LeaveRequestDialog
- **Note:** Conflict validation on submit; attachment upload to storage bucket `leave-attachments`

### 3.2 Idővonal (TimelineView) + Skill Capacity Report
- **Component:** `calendar/TimelineView.tsx` + `calendar/SkillCapacityReport.tsx`
- **Entities Created:** None (read-only visualization)

### 3.3 Kapacitástervező (CoveragePlannerView)
- **Component:** `calendar/CoveragePlannerView.tsx`
- **Entities Created:**
  - `enterprise_shift_assignments` ✅ → (workspace_id, membership_id, user_id, office_id, shift_date, business_role, skill_id, notes, is_tentative, created_by) — seedelve (Q)
- **Dialog:** Assign member to shift coverage
- **Note:** Smart batch scheduling via `SmartBatchScheduleDialog` bulk-inserts shift assignments

### 3.4 Éves nézet (AnnualLeaveGrid)
- **Component:** `AnnualLeaveGrid.tsx`
- **Entities Created:** None (display + admin override only)

---

## 4. Kérelmek (Requests tab) — Combined Requests + Approvals + Rules

### 4.1 Jóváhagyások (ApprovalInbox)
- **Component:** `ApprovalInbox.tsx`
- **Entities Created:**
  - `approval_decisions` → approval decision for leave request (approved/rejected with decision reason)
- **Note:** Admin-only action to approve/reject pending leave requests

### 4.2 Admin Kérelem más nevében (AdminLeaveOverride)
- **Component:** `AdminLeaveOverride.tsx`
- **Entities Created:**
  - `leave_requests` → force-create leave request for another user (admin power)
  - Bypasses normal validation, marked as admin-created

### 4.3 Helyettesítési felkérések (SubstituteInbox)
- **Component:** `SubstituteInbox.tsx`
- **Entities Created:** None (view + accept/reject workflow only)

### 4.4 Döntési memória (DecisionMemoryStaleInbox)
- **Component:** `DecisionMemoryStaleInbox.tsx`
- **Entities Created:**
  - `enterprise_decision_memory` → past approval decisions cached for pattern matching
- **Note:** Auto-archivable for stale entries

### 4.5 Szabályok (CollapsibleContent > Rules section)

#### 4.5.1 Jóváhagyási láncok (ApprovalChainManager)
- **Component:** `ApprovalChainManager.tsx`
- **Entities Created:**
  - `enterprise_approval_chains` → approval chain step (step_order, approver_role)
  - `enterprise_escalation_rules` → escalation policy (escalate_after_hours, escalate_to_role, notify_owner, is_active)
- **Buttons:** "+ Lépés" (add step), "Mentés" (save escalation)
- **Note:** One escalation rule per workspace; each chain step is independent

#### 4.5.2 Távollét típusok (LeaveTypeManager)
- **Component:** `LeaveTypeManager.tsx`
- **Entities Created:**
  - `enterprise_leave_types` → custom leave type (name, color, is_paid, requires_approval, icon, allowance_id)
- **Default Types:** Szabadság, Betegszabadság, Fizetés nélküli, Egyéb (hard-coded, cannot delete)
- **Button:** "+ Új típus"

#### 4.5.3 Ünnepnapok (HolidayManager)
- **Component:** `HolidayManager.tsx`
- **Entities Created:**
  - `enterprise_holidays` → holiday/public holiday (date, name, is_optional, is_active)
- **Button:** "+ Új ünnepnap"
- **Note:** Per-workspace holiday calendar

#### 4.5.4 Cég-szintű napok (CompanyLeaveDayManager)
- **Component:** `CompanyLeaveDayManager.tsx`
- **Entities Created:**
  - `enterprise_company_leave_days` → company-wide leave day (date, name, description, is_paid)
- **Button:** "+ Új nap"
- **Note:** Workspace-wide day off (distinct from holidays — may be paid or unpaid)

#### 4.5.5 Tiltott napok (BlockedDateManager)
- **Component:** `BlockedDateManager.tsx`
- **Entities Created:**
  - `enterprise_blocked_dates` → date range or single date where no leave requests allowed
  - Fields: date, end_date, reason, created_by
- **Button:** "+ Új blokkolt nap"
- **Note:** Prevents leave requests during blackout periods

#### 4.5.6 Napi szabályok (DailyRuleManager)
- **Component:** `DailyRuleManager.tsx`
- **Entities Created:**
  - `enterprise_daily_rules` → daily recurring rule (day_of_week, is_working_day, allow_half_days, etc.)
- **Button:** "+ Új szabály"
- **Note:** Configures which days are working days, half-day support, etc.

#### 4.5.7 Telephelyi lefedettségi szabályok (OfficeCoverageRuleManager)
- **Component:** `OfficeCoverageRuleManager.tsx`
- **Entities Created:**
  - `enterprise_office_coverage_rules` → rule requiring min coverage at an office (min_present, business_roles, days_of_week, is_active)
- **Button:** "+ Új szabály"
- **Note:** Enforces minimum staff at office during absences

#### 4.5.8 Szabálysablon-könyvtár (RuleTemplateLibrary)
- **Component:** `RuleTemplateLibrary.tsx`
- **Entities Created:**
  - `enterprise_rule_templates` → reusable rule template (name, description, payload JSON)
  - Two types: **Daily Rules** and **Coverage Rules**
- **Buttons:** "+ Napi sablon mentése", "+ Lefedettségi sablon mentése"
- **Note:** Allows saving complex rule configurations for reuse

#### 4.5.9 Kvótamenedzsment (QuotaManager)
- **Component:** `QuotaManager.tsx`
- **Entities Created:**
  - `enterprise_leave_quotas` → leave quota allocation per user × leave type (days_per_year, carry_over_allowed, max_accumulated, notes)
- **Button:** "+ Új kvóta"
- **Note:** Defines annual allowance per leave type; carry-over rules

---

## 5. Erőforrások (Resources tab) — `ResourcesTab.tsx`

### 5.1 Projektek (ProjectList / ProjectEditor)
- **Component:** `resources/ProjectEditor.tsx`
- **Entities Created:**
  - `enterprise_projects` → project (name, description, status, start_date, end_date, owner_id, budget, currency)
  - `enterprise_project_resource_requirements` → resource requirement per skill/role (project_id, skill_id, business_role, min_count, hours_required)
  - `enterprise_project_assignments` → member assignment to project (project_id, member_id, assigned_role, start_date, end_date, allocation_percent)
- **Dialogs:** New project, edit project, add requirements, assign members

### 5.2 Szükségletek (part of ProjectEditor)
- **Entities Created:** `enterprise_project_resource_requirements` (via project form)

### 5.3 Szakértelmek / Skills (SkillsManager)
- **Component:** `resources/SkillsManager.tsx`
- **Entities Created:**
  - `enterprise_skills` → skill definition (name, category, required, is_active)
  - `enterprise_member_skills` → member skill proficiency (member_id, skill_id, proficiency_level: 'beginner'|'intermediate'|'advanced', certified, verified_by, years_experience)
- **Buttons:** "+ Új szakterület", "+ Tagsági szakterület hozzáadása"

### 5.4 Forgatókönyvek / Scenarios (ScenarioPlanner)
- **Component:** `resources/ScenarioPlanner.tsx`
- **Entities Created:**
  - `enterprise_scenarios` → scenario/plan (name, description, is_baseline, is_active, created_by)
  - `enterprise_scenario_assignments` → what-if member assignments in scenario (scenario_id, member_id, project_id, allocation_percent, start_date, end_date)
- **Buttons:** "+ Új forgatókönyv", "+ Tagok hozzáadása"
- **Note:** What-if planning; does not modify actual project assignments

### 5.5 Pénzügyek (FinancialsPanel)
- **Component:** `resources/FinancialsPanel.tsx`
- **Entities Created:**
  - `enterprise_member_rates` → member billing rate (member_id, business_role, hourly_rate, daily_rate, currency, effective_from)
  - `enterprise_project_rates` → project-level rate override (project_id, business_role, bill_rate, currency)
- **Buttons:** "+ Új tag ár", "+ Projekt ár hozzáadása"

### 5.6 Kapacitás DNA (CapacityDnaPanel)
- **Component:** `CapacityDnaPanel.tsx`
- **Entities Created:** None (read-only capacity analysis)

---

## 6. Folyamatok (Workflows tab) — `WorkflowsModule.tsx`

### 6.1 Hozzáférés-menedzsment (AccessInbox / AccessSystems / AccessTemplates)

#### 6.1.1 Hozzáférési döntések (AccessInbox)
- **Component:** `workflows/AccessInbox.tsx`
- **Entities Created:**
  - `enterprise_access_decisions` ✅ → (request_id, action: granted|denied|revoked, actor_id, rationale, expected_outcome, observed_outcome) — seedelve (S)
- **Action:** Admin approves/denies access requests

#### 6.1.2 Hozzáférés-rendszerek (AccessSystems)
- **Component:** `workflows/AccessSystems.tsx`
- **Entities Created:**
  - `enterprise_access_systems` → access system/tool definition (name, kind: 'saas'|'internal'|'ssn', workspace_id)
  - RPC: `seed_default_access_systems()` → bulk seed common systems (GitHub, Jira, Slack, etc.)
- **Button:** "+ Új rendszer"
- **Note:** Defines what systems require access provisioning

#### 6.1.3 Hozzáférési sablonok (AccessTemplates)
- **Component:** `workflows/AccessTemplates.tsx`
- **Entities Created:**
  - `enterprise_access_templates` → access template/profile (name, description, workspace_id)
  - `enterprise_access_template_systems` → system assignment to template (template_id, system_id, mandatory)
- **Buttons:** "+ Új sablon", "+ Rendszer hozzáadása"
- **Note:** Templates group multiple systems (e.g., "Engineer Onboarding" = GitHub + Jira + Slack + Email)

### 6.2 Onboarding (OnboardingTemplates / OnboardingInbox)

#### 6.2.1 Onboarding sablonok (OnboardingTemplates)
- **Component:** `workflows/OnboardingTemplates.tsx`
- **Entities Created:**
  - `enterprise_onboarding_templates` → template definition (name, description, status, version, workspace_id)
  - `enterprise_onboarding_template_steps` → step in template (template_id, title, step_type, sort_order, mandatory, due_offset_days, escalate_after_days)
- **Buttons:** "+ Új sablon", "+ Lépés hozzáadása"
- **Step Types:** task, read, acknowledge, training, exam, approval, internal_permission, external_access

#### 6.2.2 Onboarding felkérések (OnboardingInbox)
- **Component:** `workflows/OnboardingInbox.tsx`
- **Entities Created:**
  - `enterprise_onboarding_instances` → onboarding instance for a user (member_id, template_id, initiated_by, start_date, expected_completion)
  - `enterprise_onboarding_step_completions` → step completion record (instance_id, step_id, completed_at, completed_by, notes)
- **Action:** Manager initiates onboarding workflow for new hire

---

## 7. Riportok és Audit (Reports and Audit tab) — `ReportsAndAuditTab()`

### 7.1 Riportok (ReportingDashboard / ReportLibrary / ReportBuilder)

#### 7.1.1 Riport szerkesztő (ReportBuilder)
- **Component:** `reports/ReportBuilder.tsx`
- **Entities Created:**
  - `enterprise_reports` → custom report (name, description, query_type, sql_query, filters, owner_id, is_pinned, is_scheduled, created_at)
  - Fields: nézet típus (leave_summary, team_coverage, skill_gap, capacity, financial), visual type (table, chart, heatmap)
- **Button:** "+ Új riport"
- **SQL Mode:** Direct SQL query support for advanced users

#### 7.1.2 Riport ütemezés (ReportSchedulesManager)
- **Component:** `reports/ReportSchedulesManager.tsx`
- **Entities Created:**
  - `enterprise_report_schedules` → scheduled report delivery (report_id, schedule_type: 'daily'|'weekly'|'monthly', recipients, format, is_active)
- **Button:** "+ Új ütemezés"
- **Note:** Email delivery of scheduled reports

#### 7.1.3 Kitűzött riportok (PinnedReportsWidget)
- **Component:** `reports/PinnedReportsWidget.tsx`
- **Entities Created:** None (display only; pinning flag in enterprise_reports)

#### 7.1.4 Erőforrás widget (ResourceWidgetCard)
- **Component:** `resources/ResourceWidgetCard.tsx`
- **Entities Created:**
  - `enterprise_reports` → quick report widget (same as above, used as dashboard card)
- **Action:** Save capacity/utilization view as report widget

### 7.2 Audit napló (AuditLog)
- **Component:** `AuditLog.tsx`
- **Entities Created:** None (read-only view)
- **Note:** `enterprise_audit_events` table populated via `logAuditEvent()` utility

### 7.3 Export (ExportCenter)
- **Component:** `ExportCenter.tsx`
- **Entities Created:**
  - `enterprise_audit_events` → audit entry for export operation (action: 'export.data', metadata: {format, filters})
  - Generates downloadable CSV/Excel files (storage, not database)

---

## 8. Beállítások (Settings tab) — `WorkspaceSettings` + Sub-tabs

### 8.1 Általános munkaterület beállítások (WorkspaceGeneralSettings)
- **Component:** `WorkspaceGeneralSettings.tsx`
- **Entities Created:** None (updates workspace record only)

### 8.2 Branding (BrandingManager)
- **Component:** `BrandingManager.tsx`
- **Entities Created:** None (settings stored in workspace.settings JSON)

### 8.3 Integrációk (IntegrationManager)
- **Component:** `IntegrationManager.tsx`
- **Entities Created:**
  - `enterprise_workspace_integrations` ✅ → (workspace_id, provider: jira|azure_devops, base_url, api_token, account_email, project_key, is_active, auto_create_on_approval, created_by) — seedelve (O1)
- **Upsert:** Integrations are upserted (one per provider per workspace)

### 8.4 iCal előfizetés (ICalSubscription)
- **Component:** `ICalSubscription.tsx`
- **Entities Created:**
  - `enterprise_ical_tokens` ✅ → (workspace_id, user_id, token auto-generated, scope: own|team|workspace) — seedelve (P)
- **Button:** "+ Új token"
- **Note:** Generate unique iCal URL for external calendar sync

### 8.5 Feljegyzések / Szövegek (AllowanceManager + EnterpriseNotifications + NotificationPreferences)

#### 8.5.1 Tűréshatárok (AllowanceManager)
- **Component:** `AllowanceManager.tsx`
- **Entities Created:**
  - `enterprise_allowances` → allowance type (name, unit: 'days'|'hours', ignore_limit, sort_order, workspace_id)
- **Button:** "+ Új tűréshatár"
- **Note:** Custom allowances (e.g., "Training Days", "Sabbatical")

#### 8.5.2 Értesítések (EnterpriseNotifications / NotificationPreferences)
- **Component:** `EnterpriseNotifications.tsx`, `NotificationPreferences.tsx`
- **Entities Created:**
  - `enterprise_notification_preferences` → per-user notification setting (upsert: user_id, feature_key, channel, enabled)
- **Upsert:** Notification preferences (email, in-app, SMS, etc.)

### 8.6 Lokalizáció (LocalizationSettings)
- **Component:** `settings/LocalizationSettings.tsx`
- **Entities Created:**
  - `enterprise_translation_overrides` ✅ → (workspace_id, locale, key, value, source: manual|import|ai, authored_by) — seedelve (N)
  - Upsert on workspace_id, locale, key
- **CSV Upload:** Bulk import translations

### 8.7 UI Szakaszállapot (UiSectionStateManager)
- **Component:** `UiSectionStateManager.tsx`
- **Entities Created:**
  - `enterprise_ui_section_states` → UI section collapse/expand state persistence (user_id, section_key, is_open)
- **Note:** Client-side preference storage (may be optional)

### 8.8 Helyreállítási mód (RecoveryModeSettings)
- **Component:** `settings/RecoveryModeSettings.tsx`
- **Entities Created:** None (flag in enterprise_workspaces.recovery_mode)

### 8.9 Egészségközpont (IntegrationHealthCenter)
- **Component:** `settings/IntegrationHealthCenter.tsx`
- **Entities Created:** None (monitoring/diagnostics view)

---

## 9. Munkatárhelyi membershipprojekt (MemberProfileSheet)

- **Component:** `MemberProfileSheet.tsx`
- **Entities Created:**
  - `enterprise_member_role_allocations` → bulk role allocation on member edit (replaces existing allocations)
  - Office/site updates
  - Manager assignment
  - Contract type / leadership level / org unit assignment
- **Note:** Accessible via "Profilom" button in header (edit own profile) or admin click on member

---

## 10. Munkatérület-szintű funkciók

### 10.1 Új munkaterület (Enterprise.tsx top level)
- **Component:** `CreateWorkspaceDialog.tsx`
- **Entities Created:**
  - `enterprise_workspaces` → workspace record (name, description, timezone, locale, created_by)
  - `enterprise_memberships` → owner membership auto-created
  - RPC: `create_workspace_with_owner()` → transactional workspace + membership creation
- **Button:** "+ Munkaterület"

### 10.2 Komnádközpont (CommandCenter)
- **Component:** `CommandCenter.tsx`
- **Entities Created:** None (quick-access nav; may trigger creation dialogs)

### 10.3 Tagok helyi prioritása (MemberSitePriorityEditor)
- **Component:** `MemberSitePriorityEditor.tsx`
- **Entities Created:**
  - `enterprise_member_site_priorities` → member's preferred office/site (member_id, office_id, priority_order)
- **Note:** Affects scheduling and coverage planning

---

## 11. Agile Module (Erőforrások → Agile panel)

- **Component:** `agile/AgilePanel.tsx`, `agile/JiraIssueEditor.tsx`
- **Entities Created:**
  - `enterprise_agile_issues` ✅ → (workspace_id, integration_id, provider, external_key, project_key, issue_type, summary, status, priority, sprint_name, story_points, assignee_name, capacity_risk, fit_score, suggested_role) — seedelve (O2)
  - `enterprise_agile_field_metadata` ✅ → (workspace_id, integration_id, provider, project_key, field_id, field_name, field_type, is_custom, schema) — seedelve (O3)
- **RPC:** Jira sync, field discovery
- **Note:** Requires `enterprise_workspace_integrations` létrehozva (O1) — az agile issues az integration_id-t referálja

---

## Summary by Entity Type

> ✅ = Demo workspace seedeléskor automatikusan létrejön | ⚠️ = nem seedelve (magyarázattal)

### Szabadság & Hiányzás
| Entitás | UI | Seed |
|---|---|---|
| `leave_requests` | LeaveRequestDialog, AdminLeaveOverride | ✅ C7 |
| `leave_request_substitutes` | LeaveRequestDialog | ✅ C9 |
| `enterprise_leave_types` | LeaveTypeManager | ✅ A6 |
| `enterprise_leave_quotas` | QuotaManager | ✅ C2 |
| `enterprise_holidays` | HolidayManager | ✅ A7 |
| `enterprise_blocked_dates` | BlockedDateManager | ✅ C4 |
| `enterprise_company_leave_days` | CompanyLeaveDayManager | ✅ C3 |
| `enterprise_daily_rules` | DailyRuleManager | ✅ C5 |
| `approval_decisions` | ApprovalInbox | ✅ C8 |

### Workspace & Tagság
| Entitás | UI | Seed |
|---|---|---|
| `enterprise_workspaces` | CreateWorkspaceDialog | ✅ A1 (RPC) |
| `enterprise_memberships` | InviteMemberDialog, join-event | ✅ A9 |
| `enterprise_invitations` | InviteMemberDialog | ⚠️ nem kell demo-ban |
| `enterprise_offices` | OfficeManager | ✅ A4 |
| `enterprise_ical_tokens` | ICalSubscription | ✅ P |
| `enterprise_member_site_priorities` | MemberSitePriorityEditor | ✅ R |

### Szervezet & Szerepkörök
| Entitás | UI | Seed |
|---|---|---|
| `enterprise_org_units` | OrgStructure | ✅ B6 |
| `enterprise_teams` | TeamManager | ✅ A5 |
| `enterprise_team_roles` | TeamManager | ✅ B7 |
| `enterprise_member_role_allocations` | BusinessRoleManager, InviteMemberDialog | ✅ A11 |
| `enterprise_member_templates` | InviteMemberDialog sablonok | ✅ M |
| `enterprise_role_definitions` | RolePermissionManager | ✅ L1 |
| `enterprise_role_permissions` | RolePermissionManager | ✅ L2 |

### Katalógusok (Szervezet → Katalógus)
| Entitás | UI | Seed |
|---|---|---|
| `enterprise_contract_types` | CatalogListEditor | ✅ B3 |
| `enterprise_industries` | CatalogListEditor | ✅ B4 |
| `enterprise_job_families` | CatalogListEditor | ✅ B1 |
| `enterprise_leadership_levels` | CatalogListEditor | ✅ B2 |
| `enterprise_work_categories` | CatalogListEditor | ✅ B5 |

### Folyamatok & Szabályok
| Entitás | UI | Seed |
|---|---|---|
| `enterprise_approval_chains` | ApprovalChainManager | ✅ F1 |
| `enterprise_escalation_rules` | ApprovalChainManager | ✅ F2 |
| `enterprise_office_coverage_rules` | OfficeCoverageRuleManager | ✅ C6 |
| `enterprise_rule_templates` | RuleTemplateLibrary | ✅ F3 |
| `enterprise_access_systems` | AccessSystems | ✅ H1 |
| `enterprise_access_templates` | AccessTemplates | ✅ H2 |
| `enterprise_access_template_systems` | AccessTemplates | ✅ H2 |
| `enterprise_access_requests` | AccessInbox (kérelmek) | ✅ H3 |
| `enterprise_access_decisions` | AccessInbox (döntések) | ✅ S |
| `enterprise_onboarding_templates` | OnboardingTemplates | ✅ H4 |
| `enterprise_onboarding_template_steps` | OnboardingTemplates | ✅ H5 |
| `enterprise_onboarding_instances` | OnboardingInbox | ✅ H6 |
| `enterprise_onboarding_step_completions` | OnboardingInbox | ✅ H7 |
| `enterprise_decision_memory` | DecisionMemoryEditor | ✅ I1 |

### Erőforrások & Kapacitás
| Entitás | UI | Seed |
|---|---|---|
| `enterprise_projects` | ProjectEditor | ✅ D1 |
| `enterprise_project_assignments` | ProjectEditor | ✅ D2 |
| `enterprise_project_resource_requirements` | ProjectEditor | ✅ D3 |
| `enterprise_project_skill_requirements` | ProjectEditor | ✅ D4 |
| `enterprise_scenarios` | ScenarioPlanner | ✅ E |
| `enterprise_scenario_assignments` | ScenarioPlanner | ✅ E |
| `enterprise_skills` | SkillsManager | ✅ A8 |
| `enterprise_member_skills` | SkillsManager | ✅ A10 |
| `enterprise_member_rates` | FinancialsPanel | ✅ D5 |
| `enterprise_project_rates` | FinancialsPanel | ✅ D6 |
| `enterprise_shift_assignments` | CoveragePlannerView | ✅ Q |
| `enterprise_capacity_snapshots` | CapacityDnaPanel | ✅ I2 |
| `enterprise_allowances` | AllowanceManager | ✅ C1 |

### Agile & Integráció
| Entitás | UI | Seed |
|---|---|---|
| `enterprise_workspace_integrations` | IntegrationManager | ✅ O1 |
| `enterprise_agile_issues` | AgilePanel (Jira sync) | ✅ O2 |
| `enterprise_agile_field_metadata` | AgilePanel (field discovery) | ✅ O3 |

### Riportok & Audit
| Entitás | UI | Seed |
|---|---|---|
| `enterprise_reports` | ReportBuilder, ResourceWidgetCard | ✅ G1 |
| `enterprise_report_schedules` | ReportSchedulesManager | ✅ G2 |
| `enterprise_audit_events` | ExportCenter, logAuditEvent | ✅ K |

### Beállítások & Konfiguráció
| Entitás | UI | Seed |
|---|---|---|
| `enterprise_translation_overrides` | LocalizationSettings | ✅ N |
| `enterprise_notification_preferences` | NotificationPreferences | ✅ J |
| `enterprise_member_templates` | InviteMemberDialog sablonok | ✅ M |
| `enterprise_ical_tokens` | ICalSubscription | ✅ P |
| `enterprise_ui_section_states` | UiSectionStateManager | ⚠️ kliensoldali preferencia, nem kell seedelni |

---

## Notes on Implementation Patterns

1. **Dialog Components**: Most creates are wrapped in Dialog or Collapsible containers (`Dialog`, `AlertDialog`, or inline forms)
2. **Async/Await Pattern**: All inserts are async; errors handled with toast notifications
3. **Audit Logging**: Critical operations (leave requests, approvals, invites) call `logAuditEvent()` to insert into `enterprise_audit_events`
4. **RPC Calls**: Workspace creation and bulk catalog seeding use PostgreSQL functions for transactional safety
5. **Validation**: LeaveRequestDialog includes conflict checking; approval chains enforce step ordering
6. **Permission Gating**: `useEnterprisePermissions()` hook gates visibility/editing of UI sections
7. **Soft-Delete Pattern**: Many entities use `archived_at` or `is_archived` flags rather than hard delete
8. **Upsert Usage**: Integrations, notification preferences, and localization use upsert for idempotency
9. **Multi-Step Forms**: ProjectEditor, MemberProfileSheet handle complex creates with related records
10. **Bulk Operations**: SmartBatchScheduleDialog, ScenarioPlanner, SkillsManager support bulk inserts

