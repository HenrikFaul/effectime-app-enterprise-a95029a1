# Entitás-létrehozási leltár (Workspace Dashboard)

Comprehensive inventory of all UI entry points where users can CREATE database entities (insert/upsert operations). Organized by Dashboard tab → Sub-tab → Section → Entity type.

---

## 1. Tagok (Members tab) — `MemberList.tsx`

### Új tag meghívása
- **Component:** `InviteMemberDialog.tsx`
- **Entities Created:**
  - `enterprise_invitations` → invitation record
  - `enterprise_memberships` → membership created on acceptance via `join-event` RPC
  - `enterprise_member_role_allocations` → role allocation (from role picker or template)
  - `enterprise_member_templates` → member template (save current member config as template)
- **Dialog Fields:** Email, name, role, office, city, location, business roles/allocations, org unit, contract type, leadership level, manager reference
- **Note:** Includes "Nyomtatott sablon mentése" to save invite template → `enterprise_member_templates`

---

## 2. Szervezet (Organization tab) — `OrganizationModule.tsx`

### 2.1 Szerkezet (OrgStructure)
- **Component:** `OrgStructure.tsx`
- **Entities Created:**
  - `enterprise_org_units` → organizational unit (division, department, section, etc.)
- **Parent Support:** Hierarchical tree structure
- **Button:** "Új egység"

### 2.2 Csapatok (TeamManager)
- **Component:** `TeamManager.tsx`
- **Entities Created:**
  - `enterprise_teams` → team (with name, description, approval mode, max absent)
  - `enterprise_team_roles` → team role assignment (link team to position/business role)
- **Sub-sections:** Team list with role management

### 2.3 Pozíciók / Munkakörök (BusinessRoleManager)
- **Component:** `BusinessRoleManager.tsx`
- **Entities Created:**
  - `enterprise_member_role_allocations` → role allocation to member (create or update)
- **Sub-dialog:** `PositionPickerDialog.tsx` → predefined position catalog selection (no insert, read-only reference)
- **Note:** Positions themselves managed via catalogs (CatalogListEditor)

### 2.4 Jogosultság-menedzsment (RolePermissionManager)
- **Component:** `RolePermissionManager.tsx`
- **Entities Created:**
  - `enterprise_role_definitions` → custom role definition (with role key, display name, description, sort order)
  - `enterprise_role_permissions` → role permission configuration (feature key × access level matrix)
- **Access Levels:** none, readonly, edit
- **Default Permissions:** Applied per feature key on role creation

### 2.5 Katalógus Szerkesztő (CatalogListEditor)
- **Component:** `organization/CatalogListEditor.tsx`
- **Entities Created:**
  - `enterprise_contract_types` → contract type (e.g., full-time, part-time, contractor)
  - `enterprise_industries` → industry classification
  - `enterprise_job_families` → job family grouping
  - `enterprise_leadership_levels` → leadership level hierarchy
  - `enterprise_work_categories` → work category/classification
  - RPC: `seed_*_catalog()` → bulk seed default values
- **Note:** Each catalog has its own editor with add/edit/delete/archive UI

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
  - `enterprise_shift_assignments` → shift/coverage assignment for a member on a date
    - Fields: member_id, date, shift_type, assigned_by, notes
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
  - `enterprise_access_decisions` → access approval decision (request_id, approved, decided_by, decision_date, notes)
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
  - `enterprise_workspace_integrations` → integration config (workspace_id, provider: 'jira'|'slack'|'github', config JSON, is_active, api_key_encrypted)
- **Upsert:** Integrations are upserted (one per provider per workspace)

### 8.4 iCal订阅 (ICalSubscription)
- **Component:** `ICalSubscription.tsx`
- **Entities Created:**
  - `enterprise_ical_tokens` → iCal feed token (user_id, token, workspace_id, is_active, created_at)
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
  - `enterprise_translation_overrides` → custom text override (workspace_id, locale, key, value, created_by)
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

## 11. Agile Module (Standalone - not in main dashboard tabs)

- **Component:** `agile/AgilePanel.tsx`, `agile/JiraIssueEditor.tsx`
- **Entities Created:**
  - `enterprise_agile_issues` → issue created/synced from Jira (workspace_id, external_id, title, description, status, assignee)
  - `enterprise_agile_field_metadata` → custom field configuration (issue_key, field_name, field_type, allowed_values)
- **RPC:** Jira sync, field discovery
- **Note:** May be integrated into Resources/Reports or standalone

---

## Summary by Entity Type

### Leave & Absence (leave_requests)
- **leave_requests** → LeaveRequestDialog, AdminLeaveOverride
- **leave_request_substitutes** → LeaveRequestDialog (substitute assignment)
- **enterprise_leave_types** → LeaveTypeManager
- **enterprise_leave_quotas** → QuotaManager
- **enterprise_holidays** → HolidayManager
- **enterprise_blocked_dates** → BlockedDateManager
- **enterprise_company_leave_days** → CompanyLeaveDayManager
- **enterprise_daily_rules** → DailyRuleManager
- **approval_decisions** → ApprovalInbox

### Workspace Setup & Access
- **enterprise_workspaces** → CreateWorkspaceDialog
- **enterprise_memberships** → InviteMemberDialog, join-event RPC
- **enterprise_invitations** → InviteMemberDialog
- **enterprise_offices** → OfficeManager
- **enterprise_ical_tokens** → ICalSubscription

### Organization & Roles
- **enterprise_org_units** → OrgStructure
- **enterprise_teams** → TeamManager
- **enterprise_team_roles** → TeamManager
- **enterprise_member_role_allocations** → BusinessRoleManager, InviteMemberDialog, MemberProfileSheet
- **enterprise_member_templates** → InviteMemberDialog
- **enterprise_role_definitions** → RolePermissionManager
- **enterprise_role_permissions** → RolePermissionManager

### Workflows & Processes
- **enterprise_approval_chains** → ApprovalChainManager
- **enterprise_escalation_rules** → ApprovalChainManager
- **enterprise_office_coverage_rules** → OfficeCoverageRuleManager
- **enterprise_rule_templates** → RuleTemplateLibrary
- **enterprise_access_systems** → AccessSystems
- **enterprise_access_templates** → AccessTemplates
- **enterprise_access_decisions** → AccessInbox
- **enterprise_onboarding_templates** → OnboardingTemplates
- **enterprise_onboarding_template_steps** → OnboardingTemplates
- **enterprise_onboarding_instances** → OnboardingInbox (implicit)
- **enterprise_onboarding_step_completions** → OnboardingInbox (implicit)
- **enterprise_decision_memory** → DecisionMemoryEditor

### Resources & Capacity
- **enterprise_projects** → ProjectEditor
- **enterprise_project_assignments** → ProjectEditor
- **enterprise_project_resource_requirements** → ProjectEditor
- **enterprise_scenarios** → ScenarioPlanner
- **enterprise_scenario_assignments** → ScenarioPlanner
- **enterprise_skills** → SkillsManager
- **enterprise_member_skills** → SkillsManager
- **enterprise_member_rates** → FinancialsPanel
- **enterprise_project_rates** → FinancialsPanel
- **enterprise_shift_assignments** → CoveragePlannerView, SmartBatchScheduleDialog
- **enterprise_member_site_priorities** → MemberSitePriorityEditor

### Reports & Analytics
- **enterprise_reports** → ReportBuilder, ResourceWidgetCard
- **enterprise_report_schedules** → ReportSchedulesManager
- **enterprise_audit_events** → ExportCenter, logAuditEvent utility

### Settings & Configuration
- **enterprise_workspace_integrations** → IntegrationManager
- **enterprise_allowances** → AllowanceManager
- **enterprise_translation_overrides** → LocalizationSettings
- **enterprise_notification_preferences** → NotificationPreferences
- **enterprise_ui_section_states** → UiSectionStateManager

### Catalog & Metadata
- **enterprise_contract_types** → CatalogListEditor
- **enterprise_industries** → CatalogListEditor
- **enterprise_job_families** → CatalogListEditor
- **enterprise_leadership_levels** → CatalogListEditor
- **enterprise_work_categories** → CatalogListEditor

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

