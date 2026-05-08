# Effectime Help Documentation — English Index

> This directory contains the complete EN help documentation for Effectime v3.2.x.
> Articles are structured for consumption by the in-app help system and the AI help regenerator.

## Articles in this directory

| File | Topic | Anchor IDs covered |
|---|---|---|
| 01-getting-started.md | Getting Started | `home.overview` |
| 02-leave-requests-and-approvals.md | Leave Requests and Approval Flow | `leave-request`, `approval-flow`, `workspace.requests`, `workspace.approvals` |
| 03-members-and-organization.md | Members and Organization | `workspace.members`, `workspace.organization`, `org-chart` |
| 04-calendar-and-capacity.md | Calendar and Capacity Planning | `workspace.calendar`, `capacity-dna`, `coverage-planner` |
| 05-workflows-onboarding-access.md | Workflows, Onboarding, Access Requests | `workspace.workflows`, `onboarding-template`, `access-request` |
| 06-resources-agile-capacity.md | Resources, Agile, Capacity | `workspace.resources`, `workspace.agile`, `agile-kanban`, `agile-scrum`, `agile-gantt`, `jira-integration` |
| 07-reports-audit-export.md | Reports, Audit Log, Export | `workspace.reports`, `audit-log`, `export-center` |
| 08-settings-admin.md | Settings and Administration | `workspace.settings`, `localization-settings`, `integration-health`, `role-permissions`, `command-center`, `decision-memory`, `quota-manager`, `holiday-manager` |

## Key business concepts

- **Workspace**: isolated organisation with its own members, rules, and approval chains.
- **Approval chain**: ordered list of approvers; each step must be decided before the next is notified.
- **Conflict engine**: validates leave requests against holidays, blocked dates, and max-absent rules.
- **Capacity DNA**: daily snapshot comparing baseline, effective, committed, and available FTE.
- **Coverage rule**: minimum headcount per role/skill per site per day; enforced by Coverage Planner.
- **Decision Memory**: annotation layer for any approval or policy decision; tracks rationale and observed outcome.

## Version

```
version: 3.2.2
locale: en
generated_by: curated-v1
```
