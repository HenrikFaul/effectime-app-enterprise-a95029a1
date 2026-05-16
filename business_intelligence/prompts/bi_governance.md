# BI Governance Prompt — Metric Consistency, Definition Auditing, and BI Quality Control

> **When to use this file:** When auditing existing BI outputs for consistency, reviewing whether a metric definition has drifted from its source, enforcing metric standards across reports, managing metric lifecycle (deprecation, versioning, replacement), or ensuring BI outputs meet the quality bar required for executive or regulatory use.

---

## 1. Why BI Governance Exists

BI outputs compound over time. A metric defined one way in January and a different way in March produces a trend line that looks like business movement but is actually measurement drift. A KPI used in a board report with one definition and in a compliance audit with a different definition creates discrepancy that undermines trust in both.

BI governance prevents this by treating metric definitions as versioned artifacts subject to the same change control discipline as application code.

**Governance principle**: A metric is not "defined" until it has a formal definition document (see `templates/metric_definition_template.md`), a source citation in the repository, and a CHANGELOG entry for each definition change.

---

## 2. Metric Definition Consistency Audit

When auditing metric consistency across BI outputs, apply this checklist per metric:

### Audit checklist

- [ ] **Source verified**: The metric's computation can be traced to a specific table/column/function in the repository. Not inferred from a label.
- [ ] **Definition documented**: A completed `metric_definition_template.md` exists for this metric.
- [ ] **Polarity consistent**: All BI outputs using this metric agree on which direction is "better."
- [ ] **Scope consistent**: All BI outputs using this metric apply the same workspace/team/tier scope.
- [ ] **Time window consistent**: All BI outputs using this metric use compatible time windows (not mixing daily and monthly without disclosure).
- [ ] **Exclusions consistent**: All BI outputs apply the same exclusions (soft-deleted records, test workspaces, incomplete periods).
- [ ] **Version-stamped**: Each BI output that cites this metric states the CHANGELOG version it was produced against.
- [ ] **No unverified baseline**: No BI output presents the metric against a benchmark that has no documented source.

A metric that fails 2 or more checklist items is a governance risk. A metric that fails the "source verified" item is a critical governance failure — it should not appear in executive or regulatory outputs until resolved.

### When to trigger a consistency audit

- A stakeholder finds conflicting metric values across two reports.
- A metric definition is being updated (verify all existing outputs still hold).
- A new BI output is being produced that cites a metric not previously formally defined.
- A schema migration changes the source table for a metric.
- A CHANGELOG entry describes a computation fix for a metric.

---

## 3. Metric Lifecycle Management

### Metric states

| State | Description | Action |
|---|---|---|
| Draft | Metric proposed but not yet formally defined or verified | Do not use in production BI outputs |
| Active | Metric formally defined, source verified, in active use | Normal BI use permitted |
| Deprecated | Metric replaced by a better-defined metric | No new BI outputs. Existing outputs should note the deprecation date |
| Retired | Metric no longer tracked or source table no longer exists | Historical outputs must note the metric is no longer computable |
| Contested | Metric definition under review due to inconsistency or source dispute | Flag all BI outputs that use this metric pending resolution |

### Metric deprecation protocol

When deprecating a metric:
1. Update the metric's `metric_definition_template.md` to state "Deprecated as of vX.Y.Z — replaced by [new metric]."
2. Add a CHANGELOG entry documenting the deprecation and the replacement.
3. Add a `codingLessonsLearnt.md` entry if the deprecation is caused by a discovered error or misuse.
4. Update any BI documentation that references the deprecated metric.
5. Notify stakeholders who have used the metric in executive or regulatory contexts.

### Definition change protocol

When a metric's definition changes (source, computation, scope, or exclusions):
1. Update `metric_definition_template.md` — add to the version history section.
2. Add a CHANGELOG entry explicitly describing the definition change.
3. Add a data discontinuity note: "Values before [date] are not comparable to values after [date] due to definition change."
4. Review all trend analyses that span the definition change date — they are potentially invalid.
5. Rebaseline the metric from the definition change date forward.

---

## 4. BI Output Quality Review

When reviewing a BI output before it is distributed to executives or used in regulatory submissions, apply the quality gate:

### Tier 1 — Factual accuracy gate (must pass before distribution)

| Check | Pass condition |
|---|---|
| Source citations present | Every metric value cites its data source |
| Version stamp present | CHANGELOG version stated |
| Time window explicit | Start date, end date, granularity all stated |
| Scope explicit | Workspace, tier, team scope all stated |
| Baseline cited | Every variance has a documented baseline |
| Data quality disclosed | Quality level stated; "insufficient" outputs not distributed |
| Confidence level stated | High / medium / low with basis |

### Tier 2 — Analytical rigor gate (required for executive and regulatory use)

| Check | Pass condition |
|---|---|
| Version history checked | CHANGELOG reviewed for metric-affecting changes in analysis period |
| Anomaly classification complete | Any suspicious values have been classified and investigated |
| Root cause not assumed | No unexplained attribution of cause without evidence |
| Statistical significance assessed | Sample-size caveats present where N < 30 |
| Leading indicators identified | For any concerning lagging metric, leading indicators are cited |
| No hallucinated values | Zero metric values stated without verifiable source |

### Tier 3 — Governance compliance gate (required for board and regulatory submissions)

| Check | Pass condition |
|---|---|
| All metrics in Active state | No Draft, Deprecated, Contested, or Retired metrics cited |
| Definition consistency verified | All metrics pass the consistency audit checklist |
| PII compliance confirmed | No employee-level data in aggregate outputs |
| Cross-workspace authorization confirmed | Superadmin scope confirmed for platform aggregates |
| Audit trail cited for compliance metrics | All compliance metrics backed by audit_events records |

---

## 5. BI Standards Registry

The following standards apply to all Effectime BI outputs produced under this system:

| Standard | Rule |
|---|---|
| Metric naming | Use the exact metric name from the `metric_definition_template.md` — do not invent display names |
| Version stamp format | "Produced against CHANGELOG vX.Y.Z \| YYYY-MM-DD" |
| Confidence label | Always one of: high / medium / low — no qualitative substitutes |
| Scope declaration | Must include at minimum: workspace scope and time window |
| Baseline requirement | No performance assessment without a documented baseline |
| Caveat placement | Always in the Confidence Assessment block, never buried in body text |
| PII rule | Minimum aggregation level: team (N ≥ 5). Employee-level data prohibited in BI outputs |
| Cross-workspace default | Single-workspace scope unless explicitly declared cross-workspace with authorization noted |

---

## 6. Metric Conflict Resolution Protocol

When two BI outputs show different values for the same metric, period, and scope:

1. **Identify the computation source** for each output (which component, which function, which migration).
2. **Check for time window differences**: Even a 1-day difference in period end date can produce different values for rate metrics.
3. **Check for scope differences**: Different RLS policies in effect for different queries can produce different counts.
4. **Check for version differences**: Were the two outputs produced against different CHANGELOG versions?
5. **Check for soft-delete handling**: One output may include soft-deleted records that the other excludes.
6. **Declare a winner**: The output with the more complete audit trail and the more recently verified source wins. Document the conflict and resolution in a `bi_documentation.md` Type 4 (Data Quality Record).

---

## 7. Output Format

```
BI Governance Review
─────────────────────────────────────────────────────────
Review type: [Consistency audit / Metric lifecycle / Output quality / Conflict resolution]
CHANGELOG version: [version]
Date: [YYYY-MM-DD]
Metric(s) under review: [list]

Consistency Audit Results (per metric)
[Checklist table with pass/fail per item]
Governance risk level: [low / medium / high / critical]

Metric State Review
[Current state for each metric reviewed: Draft / Active / Deprecated / Retired / Contested]
State changes required: [list or "none"]

Quality Gate Results
- Tier 1 (factual accuracy): [pass / fail — failing items listed]
- Tier 2 (analytical rigor): [pass / fail — failing items listed]
- Tier 3 (governance compliance): [pass / fail — failing items listed]
Overall: [approved for distribution / requires remediation — blocked items listed]

Conflicts Identified
- [Metric]: [conflict description + resolution]

Required Actions
- [Action 1]: [what + owner + deadline]
- [Action 2]: [what + owner + deadline]

Governance Artifacts to Update
- [ ] metric_definition_template.md for [metric]
- [ ] CHANGELOG entry for [definition change]
- [ ] codingLessonsLearnt.md for [lesson]
- [ ] BI documentation for [affected outputs]
─────────────────────────────────────────────────────────
```
