# Organization

The Organization module is the canonical source of truth for hierarchy, leadership, contracts, industry classification, work categories, and job families. It is reachable from the **Organization** tab inside a workspace.

## Sub-tabs

| Tab | Purpose |
|---|---|
| Structure | Tree of organizational units (divisions, departments, teams). |
| Leadership | Leadership-level catalog (Strategic, Operational, Technical, Execution). |
| Contracts | Contractual relationship types (employee, contractor, etc.). |
| Industry | Workspace industry / activity area classification. |
| Work categories | Controlled vocabulary used elsewhere in the platform. |
| Job families | Grouping of related positions for analytics. |
| Org chart | Auto-generated chart from manager relationships. |

## Seed defaults

Both **Leadership** and **Contracts** offer a *Seed defaults* button that creates the standard catalog. Custom entries can be added or archived afterwards.

## Org chart

The chart is generated from `enterprise_memberships.manager_id`. Use the search to filter; click **Regenerate snapshot** to persist the current state into `enterprise_org_chart_snapshots` for fast loading later. Cycles in the hierarchy are prevented at the database level.
