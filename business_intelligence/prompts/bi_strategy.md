# BI Strategy Prompt — Analytics Philosophy and Measurement Framework

> **When to use this file:** When designing what to measure, deciding which metrics matter, prioritizing BI investment, or building a measurement framework from scratch for a workspace or product domain.

---

## 1. The Strategic BI Question

Before selecting a metric or building a dashboard, answer the following:

1. What decision does this measurement enable?
2. Who makes that decision, and on what cadence?
3. What action changes if the metric moves in each direction?
4. What is the cost of not measuring this?
5. What is the cost of measuring it incorrectly?

If questions 1, 3, and 4 cannot be answered clearly, the metric is not ready to track. A metric that changes no behavior is instrumentation noise.

---

## 2. Effectime's Strategic BI Priorities

Effectime is a workforce management platform. Its BI value is concentrated in three strategic outcomes:

**Operational clarity** — Are people-managing businesses running their workforce efficiently? Metrics: shift adherence, absence rates, labor cost per shift, payroll accuracy.

**Compliance confidence** — Are compliance obligations being met without manual overhead? Metrics: compliance score, audit trail completeness, violation rate by rule type.

**Workforce sustainability** — Are employees at risk of disengagement or burnout before it becomes a retention problem? Metrics: wellbeing score, burnout risk index, voluntary overtime rate.

Secondary strategic value comes from:
- Platform stickiness: feature adoption, integration health, active workspace volume.
- Revenue intelligence: tier upgrade rate, trial-to-paid conversion, reseller pipeline.

---

## 3. BI Priority Framework

Apply this framework when deciding which metrics to analyze first or which to include in a report.

### Tier 1 — Operational health indicators
These metrics signal whether the workforce is running as expected right now. Answer: "Is anything broken today?"
- Clock-in rate vs. scheduled
- Shift fill rate
- Compliance breach count (current period)
- Wellbeing score trend (past 14 days)

### Tier 2 — Performance trend indicators
These metrics show direction over time. Answer: "Are we improving or declining?"
- Absence rate (rolling 4 weeks vs. prior 4 weeks)
- Overtime rate trend
- Payroll accuracy rate
- Feature adoption rate (new workspaces)

### Tier 3 — Strategic health indicators
These metrics require longer time horizons and cross-segment analysis. Answer: "Where are we vs. where we need to be?"
- Turnover rate (rolling 12 months)
- Burnout risk cohort size
- Tier upgrade rate
- Workspace growth rate

---

## 4. Leading vs. Lagging Indicator Discipline

| Lagging indicator | Likely leading indicator |
|---|---|
| Employee turnover | Wellbeing score decline + voluntary overtime spike |
| Compliance violation | Audit trail incompleteness + unacknowledged rule alerts |
| Payroll error | High punch correction rate + overtime rounding events |
| Shift understaffing | Declining shift marketplace acceptance rate |
| Feature abandonment | Session frequency drop + support ticket spike |

When analyzing a lagging metric, always ask: "Which leading indicators could have predicted this? Are they tracked?"

---

## 5. Measurement Framework Design Protocol

When designing a BI framework for a workspace, product domain, or executive view:

**Step 1 — Identify decisions.** List the 5–8 key decisions the workspace manager or HR lead makes weekly. Each needs at least one metric.

**Step 2 — Map to Effectime data.** For each decision, identify which Effectime tables and components produce relevant data. Reference `supabase/migrations/` for available columns and `src/components/analytics/` for existing KPI surfaces.

**Step 3 — Define each metric formally.** Use `templates/metric_definition_template.md` for every metric. Do not proceed to analysis without a formal definition.

**Step 4 — Identify data gaps.** If a decision-critical metric has no data source, flag it explicitly. Document it as a product gap in the BI documentation.

**Step 5 — Define the reporting cadence.** Daily metrics need different display than monthly metrics. Match the cadence to the decision frequency.

**Step 6 — Set baselines.** Identify the earliest available data point for each metric. Set a baseline before setting targets.

**Step 7 — Define alert thresholds.** For each Tier 1 metric, define a threshold that triggers investigation (not just a report). Document thresholds in `templates/metric_definition_template.md`.

---

## 6. BI Anti-patterns for Effectime Specifically

- **Workspace-blind aggregation.** Averaging metrics across workspaces with different tiers, sizes, or industries without segmenting produces misleading platform-level averages.
- **Version-naive trending.** Plotting a metric over time without checking whether a schema migration or computation change occurred during the period.
- **Denominator blindness.** Measuring "violations per employee" without accounting for workspaces that changed headcount mid-period.
- **Survey response bias.** Wellbeing and engagement scores from workspaces with <40% survey response rate should not be treated as representative.
- **Integration health as proxy for engagement.** A Jira sync success rate of 100% does not mean the team is using the agile features effectively.
- **Tier-contaminated cohorts.** Comparing feature adoption across workspaces on different tiers without controlling for availability.

---

## 7. Output Format for BI Strategy Work

When producing BI strategy outputs, structure the response as:

```
BI Strategy Output
─────────────────────────────────────────────────────────
Scope: [workspace / domain / platform level]
Version: [CHANGELOG version this was produced against]

Decision inventory: [list of decisions this framework serves]

Metric priority tiers:
  Tier 1 (operational health): [metrics]
  Tier 2 (performance trend): [metrics]
  Tier 3 (strategic health): [metrics]

Leading indicators mapped: [leading → lagging pairs]

Data gaps identified: [metrics needed but not currently available]

Recommended measurement cadence: [daily / weekly / monthly per tier]

Gaps and open questions: [what must be resolved before this framework is reliable]
─────────────────────────────────────────────────────────
```
