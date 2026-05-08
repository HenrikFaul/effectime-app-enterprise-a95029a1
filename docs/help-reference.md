# Effectime Help Reference — Feature Map v3.2.2

> This file is the canonical feature map consumed by the help-regenerator edge function.
> It lists every user-facing feature, its anchor ID, navigation path, and key business rules.
> Use this as the authoritative source when generating help articles.

---

## Workspace selector (`home.overview`)
- Route: `/enterprise`
- Shows: list of all workspaces the signed-in user belongs to.
- Actions: create workspace, open workspace, switch language, sign out.
- Roles: any authenticated user.

## Members tab (`workspace.members`)
- Route: `/enterprise` → Members tab
- Shows: active member list with search, filters (team/office/position), and per-member profile sheets.
- Actions: invite member, edit role, open profile, set quota, manage skills.
- Roles: all members see the list; only Owner/ResourceAssistant can invite or change roles.

## Organization tab (`workspace.organization`)
- Route: `/enterprise` → Organization tab
- Shows: seven sub-tabs — Structure, Leadership Levels, Contract Types, Industry, Work Categories, Job Families, Org Chart.
- Key: all hierarchy and workforce metadata lives here (source of truth for org chart).
- Org chart: auto-generated from `manager_id` relationships; snapshot stored in `enterprise_org_chart_snapshots`.

## Calendar tab (`workspace.calendar`)
- Route: `/enterprise` → Calendar tab
- Sub-views: Calendar (month), Annual Grid (full year per person), Timeline (row-per-member Absentify-style), Coverage Planner.
- Timeline uses `@tanstack/react-virtual` for >200 member performance.
- Filters: team, office, position, skills, location, leave type, status.

## Requests tab (`workspace.requests`, shows as `workspace.approvals` in drawer)
- Route: `/enterprise` → Requests tab
- Shows: own leave requests with status; substitute picker; attachment; private toggle.
- Conflict check: two-step submit — Check (conflict engine) → Submit.

## Approvals tab (`workspace.approvals`)
- Route: `/enterprise` → Approvals tab
- Shows: approval inbox (Owner/ResourceAssistant only); bulk approve/reject; escalation rules.
- Decision Memory stale inbox also rendered here (admin only).

## Workflows tab (`workspace.workflows`)
- Route: `/enterprise` → Workflows tab
- Sub-tabs: Onboarding Templates, Onboarding Inbox, Access Systems, Access Templates, Access Inbox.
- Step types: task, read, acknowledge, training, exam, approval, internal_permission, external_access.

## Resources tab (`workspace.resources`)
- Route: `/enterprise` → Resources tab
- Sub-tabs: Overview, Heatmap, Projects, Agile, Skills, Scenarios, Financials, Capacity Gap.
- Also contains: Capacity DNA panel, Position Management (collapsed), Team Management (collapsed).

## Agile panel (`workspace.agile`)
- Inside: Resources → Agile sub-tab.
- Views: Kanban (by status), Scrum (by sprint+status), Gantt (by start_date/due_date).
- Data source: `enterprise_agile_issues` local cache; synced from Jira or Azure DevOps via `jira-devops-proxy`.
- Capacity Fit: sprint headcount vs leave overlap; what-if simulation.
- Issue Writeback: create/update issues in Jira or ADO directly.

## Reports tab (`workspace.reports`)
- Route: `/enterprise` → Reports tab
- Sub-tabs: Dashboard (KPIs, charts), Audit (immutable log), Export (CSV), Scheduled.
- Audit log: immutable, 100 events shown, filterable, exportable.
- Export: UTF-8 BOM CSV, scoped by date range and status.

## Settings tab (`workspace.settings`)
- Route: `/enterprise` → Settings tab
- Sections: General, Leave Types, Holidays, Daily Coverage Rules, Rule Templates, Approval Chains, Calendar Filters, Role Permissions, Integrations, iCal, Localization, Recovery Mode, Integration Health.
- Recovery Mode: visual warning state; requires Owner role + written reason.
- Localization: export/import bilingual CSV; changes persisted to `enterprise_translation_overrides`.

---

## Key anchor IDs and their feature mapping

| anchor_id | Feature |
|---|---|
| `home.overview` | Workspace selector |
| `workspace.members` | Members tab |
| `workspace.organization` | Organization module |
| `workspace.calendar` | Calendar + sub-views |
| `workspace.requests` | Leave request submission |
| `workspace.approvals` | Approval inbox |
| `workspace.workflows` | Onboarding + access |
| `workspace.resources` | Resources tab |
| `workspace.agile` | Jira/ADO agile boards |
| `workspace.reports` | Reports + audit |
| `workspace.settings` | Settings panel |
| `leave-request` | Submit leave request (workflow) |
| `approval-flow` | Approval chain logic |
| `onboarding-template` | Onboarding template editor |
| `access-request` | Access request flow |
| `capacity-dna` | Capacity DNA snapshots |
| `org-chart` | Auto-generated org chart |
| `coverage-planner` | Site coverage rule enforcement |
| `localization-settings` | i18n CSV import/export |
| `audit-log` | Immutable audit trail |
| `integration-health` | Integration status dashboard |
| `command-center` | Workspace health counters widget |
| `quota-manager` | Annual leave quota management |
| `holiday-manager` | Public holidays + blocked dates |
| `role-permissions` | Feature-level RBAC tree |
| `decision-memory` | Rationale + outcome annotations |
| `agile-kanban` | Kanban board view |
| `agile-scrum` | Scrum board view |
| `agile-gantt` | Gantt timeline view |
| `jira-integration` | Jira / Azure DevOps connection |
| `export-center` | CSV data export |

---

## Business rules summary

### Conflict engine (leave requests)
- Blocking: holiday overlap, blocked date, own pending overlap.
- Warning: max_absent (team / workspace level), pending leave from another user.
- Two-step submit: Check → Submit.

### Approval chain
- Multi-step ordered chain.
- Each step notified only after previous step approves.
- Escalation: configurable threshold in hours → auto-escalate to next step or Owner.
- Bulk actions: approve/reject multiple requests at once.

### Capacity engine
- `hours = base_working_hours * (allocation_pct / 100)` per member.
- Shortage score: how many FTE short of full coverage.
- Overload score: how many FTE over 100% committed.

### Coverage rules
- Minimum headcount per position/skill/site/day.
- Supports multi-position and multi-skill OR logic.
- Auto-archived when expired (pg_cron job at 02:15 UTC).

### RLS model
- All enterprise tables are workspace-scoped via `is_enterprise_member()` and `has_enterprise_role()` SECURITY DEFINER functions.
- Public read on `help_articles`; service-role write only.

---

## Version

```
version: 3.2.2
locale: en
last_updated: 2026-05-07
generated_by: curated-v1
```
