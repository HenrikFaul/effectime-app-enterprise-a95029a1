# Metric Definition Template — Canonical Format for Effectime Metric Definitions

> **How to use this template:** Complete one of these for every new metric you define or every existing metric whose definition needs to be formally recorded. A metric without a definition is a liability — it will be computed differently by different people and versions of the system.

---

```
# Metric Definition: [Metric Name]

**Version defined**: [CHANGELOG version when this definition was confirmed]
**Date**: [YYYY-MM-DD]
**Domain**: [Workforce / Attendance & Time / Compliance / Engagement & Wellbeing / Financial / Platform / Agile]
**Tier requirement**: [All tiers / Growth and above / Enterprise only / Not tier-gated]
**Definition status**: [Verified against source code / Inferred from display layer / Pending verification]

---

## 1. Business Definition

[One to three sentences. What does this metric measure in business terms? Why does it matter? What decision does it inform?]

---

## 2. Technical Definition

**Numerator**: [Exact description of what is counted or summed. Reference the column name from the source table.]

**Denominator** (if rate or ratio): [Exact description of the population or total. What is included? What is excluded?]

**Computation**: [The formula in plain English. Example: "Count of `clock_events` where `event_type = 'clock_in'` and `timestamp` falls within the period, divided by count of `shift_assignments` where `status = 'scheduled'` and `scheduled_start` falls within the period."]

**Time window**: [How the time window applies — period total, point-in-time, rolling window (N days/weeks/months).]

**Granularity**: [The smallest meaningful time unit — daily / weekly / monthly.]

---

## 3. Scope

**Default scope**: [Workspace / Team / Platform]
**Supported scope overrides**: [Can be filtered by team / role / locale / tier — list which are supported]
**Multi-tenancy note**: [Does this metric aggregate across workspaces? Under what conditions? What authorization scope is required?]

---

## 4. Source

**Primary source table**: [`schema.table_name` — include schema prefix]
**Supporting tables** (if joins required): [list]
**Source component**: [`src/components/[path]/[ComponentName].tsx`]
**Edge function** (if aggregation is async): [`supabase/functions/[function-name]/`]
**Migration that introduced this metric**: [`supabase/migrations/[migration_filename].sql`]

---

## 5. Polarity and Targets

**Polarity**: [Higher is better / Lower is better / Context-dependent — explain]
**Target / benchmark** (if defined): [value or range — source of target]
**Warning threshold**: [value that triggers monitoring]
**Critical threshold**: [value that triggers escalation]
**No target defined**: [✓ if no target — note when one should be set]

---

## 6. Exclusions

[What is explicitly excluded from this metric's computation?]

- [ ] Soft-deleted records excluded
- [ ] Test workspaces excluded
- [ ] Incomplete periods excluded (current period not yet closed)
- [ ] Workspaces below minimum size threshold excluded (specify: N < [threshold])
- [ ] Other exclusions: [list]

---

## 7. Known Issues and Caveats

[Document any known issues, computation edge cases, or historical data problems for this metric.]

| Issue | Period affected | Status | Reference |
|---|---|---|---|
| [Issue description] | [Date range] | [Open / Resolved in vX.Y.Z] | [CHANGELOG entry or lesson ID] |

---

## 8. Version History

[Track changes to the metric's definition over time.]

| Version | Date | Change | Source |
|---|---|---|---|
| [vX.Y.Z] | [YYYY-MM-DD] | Initial definition | [Migration / CHANGELOG entry] |
| [vX.Y.Z] | [YYYY-MM-DD] | [Change description] | [CHANGELOG entry] |

---

## 9. Related Metrics

| Metric | Relationship |
|---|---|
| [Metric name] | [Leading indicator / lagging indicator / correlated / component of composite] |
| [Metric name] | [Leading indicator / lagging indicator / correlated / component of composite] |

---

## 10. Usage Guidance

**Use this metric when**: [the specific BI question or decision context where this metric is appropriate]

**Do not use this metric when**: [conditions under which this metric is misleading or inappropriate — e.g., "Do not use for workspaces with fewer than 5 employees — small-N instability makes the rate unreliable."]

**Combine with**: [other metrics that should appear alongside this one in a complete analysis]
```
