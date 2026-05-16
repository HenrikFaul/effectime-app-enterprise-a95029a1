# Data Quality Prompt — Trust Assessment, Completeness Checks, and Confidence Scoring

> **When to use this file:** When assessing whether a dataset or metric can be trusted for analysis, when data looks suspicious, when preparing a quality gate before a report is published, or when a stakeholder asks how reliable the data is.

---

## 1. The Data Quality Mandate

A BI output is only as trustworthy as the data it is based on. Presenting analysis from incomplete, stale, or inconsistent data without disclosure is worse than producing no analysis — it creates false confidence that leads to bad decisions.

**Rule**: Every BI output must include an explicit data quality assessment. There is no such thing as "assume data is fine." The assessment is fast when data is clean; it is essential when data is not.

---

## 2. Data Quality Dimensions

Assess every dataset across five dimensions before producing BI outputs.

### Dimension 1 — Completeness
Is all expected data present?

| Check | What to verify |
|---|---|
| Row completeness | Are there gaps in the time series? (Missing days, weeks, months.) |
| Column completeness | Are required fields populated? (Null rates in critical columns.) |
| Coverage completeness | Do all workspaces / teams / roles in scope have data? |
| Volume plausibility | Is the record count plausible for the period? (Too few or too many records.) |

### Dimension 2 — Consistency
Does the data agree with itself across sources and time?

| Check | What to verify |
|---|---|
| Cross-table consistency | Do related tables agree? (Headcount in `members` vs. shift assignments.) |
| Time consistency | Does data from the same period look the same across reporting runs? |
| Version consistency | Did a schema migration create a before/after inconsistency in values? |
| Aggregation consistency | Do row-level records sum to the reported aggregate? |

### Dimension 3 — Currency
Is the data fresh enough for the analysis?

| Check | What to verify |
|---|---|
| Last sync time | When was the data last updated? Is this within the expected refresh cadence? |
| Integration lag | For Jira/Azure DevOps data, is there a known sync lag that affects the latest period? |
| Edge function recency | When did the most recent scheduled aggregation run? |
| Stale cache detection | Are cached values in `enterprise_agile_issues` or similar tables current? |

### Dimension 4 — Validity
Do values fall within expected ranges and conform to the metric definition?

| Check | What to verify |
|---|---|
| Range validity | Are rates between 0% and 100%? Are counts non-negative? |
| Business logic validity | Are values plausible given business context? (See dashboard_interpretation.md misinterpretations.) |
| Type validity | Are numeric fields storing numeric values? Are date fields correctly typed? |
| Referential validity | Do foreign keys resolve to existing records? (No orphaned assignments, no dangling workspace IDs.) |

### Dimension 5 — Provenance
Do we know where the data came from?

| Check | What to verify |
|---|---|
| Source traceability | Can every metric value be traced to a specific table and computation? |
| Transformation traceability | If a value is computed (ratio, average, composite), is the formula documented? |
| Version traceability | Is there a CHANGELOG entry for each major computation change? |
| Audit trail | For compliance-critical metrics, is there an immutable audit trail? |

---

## 3. Data Quality Scoring

After assessing all five dimensions, assign an overall quality score:

| Score | Criteria | BI usage |
|---|---|---|
| High | All 5 dimensions pass. No known issues. | Full analysis permitted. Minimal caveats. |
| Medium | 1–2 dimensions have minor issues. Known gaps are bounded and documented. | Analysis permitted with explicit caveats. Flag affected metrics. |
| Low | 3+ dimensions have issues, or 1 dimension has a critical failure. | Limited analysis only. State what can and cannot be concluded. |
| Insufficient | Critical completeness or validity failure. Core data is missing or unreliable. | Do not produce analysis. State what is missing and how to resolve it. |

**Do not upgrade a quality score to make an output look more confident.** A medium score with honest caveats is more valuable than a high score with hidden problems.

---

## 4. Effectime-Specific Data Quality Patterns

These are known data quality patterns in Effectime that affect BI reliability.

### 4.1 RLS Policy Scope
Effectime uses Row Level Security. Metrics computed from a session with limited role scope will undercount data for restricted tables. Confirm that the query scope matches the intended analysis scope. Reference `codingLessonsLearnt.md` for documented RLS issues.

### 4.2 Multi-Tenancy Isolation
Cross-workspace aggregations require explicit authorization. A "platform average" computed without proper cross-workspace access scope will silently undercount. Never aggregate across workspaces without confirming the query scope.

### 4.3 Schema Migration Effects
Schema migrations in `supabase/migrations/` can create before/after inconsistencies. A migration that adds a column with `DEFAULT '{}'` means all historical rows have the default value, not null — which can inflate coverage metrics retroactively. Check migration logic before using historical data for a newly added column.

### 4.4 Soft-Delete Records
Effectime uses soft delete patterns on several tables (members, shifts, integrations). Ensure queries exclude soft-deleted records from counts unless historical archival analysis is the intent.

### 4.5 Integration-Dependent Data Gaps
Jira and Azure DevOps data is only as current as the last successful sync. Check `integration_sync_logs` for sync gaps before analyzing agile or delivery metrics.

### 4.6 Wellbeing Survey Non-Response Bias
Wellbeing scores based on response rates below 40% of the workspace population should be flagged as potentially non-representative. Low-response scores typically skew toward the most engaged or most disengaged — not the median.

### 4.7 Feature Tier Gate Gaps
A workspace that upgrades tiers mid-period will have partial-period feature data. For feature adoption metrics, check when the workspace gained access to the feature before computing adoption rates.

---

## 5. When to Refuse Analysis

Analysis must be refused (not just caveated) when:
- Completeness score is "Insufficient" for the primary metric.
- The time window contains a schema migration that materially altered the metric's computation and the before/after data cannot be reconciled.
- Row-level data contains a known integrity bug not yet resolved (check `codingLessonsLearnt.md` for open issues).
- The dataset is a test or seed dataset, not production data.

State the refusal explicitly: "Analysis of [metric] for [period] cannot be produced reliably due to [specific reason]. This analysis can resume when [specific condition is met]."

---

## 6. Output Format

```
Data Quality Assessment
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- Dataset / metric under assessment: [name]
- Time window: [start → end]
- Scope: [workspace / tier / table]
- Assessment date: [date]

Dimension Assessments
- Completeness: [pass / partial / fail] — [finding]
- Consistency: [pass / partial / fail] — [finding]
- Currency: [pass / partial / fail] — [finding]
- Validity: [pass / partial / fail] — [finding]
- Provenance: [pass / partial / fail] — [finding]

Known Effectime-Specific Issues Checked
- RLS scope: [confirmed / not verified]
- Multi-tenancy isolation: [confirmed / not verified]
- Schema migration effect: [none in period / [migration name] found — [impact]]
- Soft-delete handling: [confirmed / not verified]
- Integration sync gaps: [none / [gap dates]]
- Survey response rate (if applicable): [rate — representative / non-representative]
- Tier gate timing (if applicable): [not applicable / [upgrade date]]

Overall Quality Score: [High / Medium / Low / Insufficient]

Permitted Analysis
[What analysis CAN be produced from this dataset, given the quality score]

Restricted Analysis
[What analysis CANNOT be produced reliably and why]

Caveats for Any Output Using This Data
- [Caveat 1]
- [Caveat 2]

Remediation Steps
[What needs to happen before quality improves to the next level]
─────────────────────────────────────────────────────────
```
