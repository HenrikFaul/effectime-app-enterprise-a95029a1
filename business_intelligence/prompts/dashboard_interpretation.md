# Dashboard Interpretation Prompt — Reading, Critiquing, and Navigating Effectime Analytics Views

> **When to use this file:** When explaining what a dashboard shows, critiquing a dashboard's design or data representation, identifying misinterpretations, or guiding a user through an analytics view.

---

## 1. Dashboard Reading Protocol

Before interpreting any dashboard or metric card, complete the following:

### Step 1 — Identify the Dashboard Context
- Which Effectime dashboard view is this? (Executive summary, compliance, wellbeing, workforce, agile, superadmin.)
- What workspace scope is active? (Single workspace, multi-workspace aggregate, or platform level.)
- What time window is the dashboard filtering on?
- What tier does the workspace have? (Feature availability differs by tier — a missing card may be a tier gate, not a data issue.)

### Step 2 — Locate Source Components
Before explaining what a chart means, find its source in `src/components/analytics/`. If the chart is in a domain-specific section, check the relevant component directory:
- Executive / KPI overview: `src/components/analytics/`
- Compliance metrics: `src/components/compliance/`
- Wellbeing / engagement: `src/components/wellbeing/` and `src/components/engagement/`
- Workforce overview: `src/components/enterprise/`
- Agile metrics: `src/components/enterprise/agile/`

Understanding the rendering component tells you what the chart actually displays — not just what its label says.

### Step 3 — Confirm the Metric Definition
Every chart on a dashboard is a visual representation of a computed value. Before interpreting direction or magnitude, confirm the exact computation from `supabase/migrations/` or `supabase/functions/`. Labels can be misleading; computation definitions cannot.

---

## 2. Common Effectime Dashboard Misinterpretations

These are the most frequent misreadings of Effectime's analytics views. Check for these before interpreting any dashboard.

### Misinterpretation 1 — "100% compliance score means no risk"
A 100% compliance score means all currently configured rules are being evaluated and passing. It does not mean all applicable regulations are covered. If a workspace has not configured all relevant compliance rules, the score measures compliance to an incomplete rule set. Check rule coverage separately.

### Misinterpretation 2 — "Low wellbeing score = employee dissatisfaction"
Wellbeing score is a composite of survey responses. A low score with a low response rate reflects incomplete data, not confirmed low wellbeing. Always check response rate before interpreting the score.

### Misinterpretation 3 — "Shift fill rate drop = scheduling failure"
A fill rate drop may reflect: (a) shifts being added without workers being assigned, (b) a batch import of unassigned shifts, or (c) a marketplace listing that has not yet been claimed. Check whether the denominator changed before concluding scheduling failure.

### Misinterpretation 4 — "Overtime spike = understaffing"
An overtime spike can equally indicate: voluntary overtime accepted by the worker, a data correction that reclassified regular hours, or a punch rounding policy change. Check clock event correction logs.

### Misinterpretation 5 — "Zero integration sync failures = healthy integration"
Zero failures may mean the integration has not attempted any syncs, not that all syncs succeeded. Confirm sync attempt volume alongside failure rate.

### Misinterpretation 6 — "Feature adoption rate is low = users don't like the feature"
Low adoption may mean: (a) the feature is on a tier the workspace does not have, (b) the feature was released recently and adoption curves have not peaked, or (c) the feature requires onboarding that has not happened. Check tier gate and release date before concluding adoption failure.

---

## 3. Dashboard Critique Framework

When critiquing a dashboard (design or data quality), assess each dimension:

### Data accuracy
- Does the displayed value match what the source table would produce for the stated time window and scope?
- Are there any known computation bugs in the CHANGELOG that affect this view?

### Metric completeness
- Does the dashboard display all metrics the user needs to make the intended decision?
- Are there data gaps (missing metrics, empty states, "no data" placeholders) that should be explained?

### Visual clarity
- Does the chart type match the metric type? (Rates → line or bar. Counts → bar or number. Compositions → stacked bar or pie only if ≤ 5 segments. Trends → always line.)
- Are axes labeled with units? Are time axes showing correct granularity?
- Are color conventions consistent? (Red = bad, green = good must be applied consistently and correctly to polarity.)

### Scope transparency
- Is the time window displayed explicitly?
- Is the workspace scope displayed?
- Is the data currency (last refresh time) displayed?

### Actionability
- Does each KPI card lead the user toward a decision or action?
- Are threshold violations highlighted?
- Is there a path from the metric to the detail view that explains it?

---

## 4. Chart Type Interpretation Guide

| Chart type | What it shows | Common mistake |
|---|---|---|
| KPI card (single number) | Point-in-time or period total | Interpreting as a trend when no comparison is shown |
| Line chart | Trend over time | Ignoring axis scale — a flat line may hide meaningful absolute change |
| Bar chart | Comparison across categories | Comparing bars with different denominators as if they are equivalent |
| Stacked bar | Composition change over time | Reading the top segment as the total |
| Gauge / donut | Performance vs. target | Ignoring what the target is and how it was set |
| Heatmap | Density across two dimensions | Ignoring that color intensity depends on the data range shown |
| Funnel | Drop-off between sequential stages | Ignoring absolute volumes (a 50% conversion on 10 users vs. 1000 users) |

---

## 5. Dashboard Health Checklist

Run this checklist before presenting a dashboard view as reliable:

- [ ] Time window is explicitly displayed and correct for the intended analysis.
- [ ] Workspace scope is displayed and matches the intended audience.
- [ ] All KPI values have a visible baseline or comparison period.
- [ ] Metric polarity (red/green) is applied correctly for each KPI.
- [ ] No "stale data" indicators or last-refresh timestamps older than the expected refresh cadence.
- [ ] Feature-gated sections are either hidden or explicitly labeled for workspaces without access.
- [ ] Integration-dependent metrics are annotated with their sync status.
- [ ] No metrics show impossible values (e.g., rates > 100%, negative headcount).

---

## 6. Output Format

```
Dashboard Interpretation
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- Dashboard: [name and view path]
- Time window: [as shown in dashboard]
- Scope: [workspace / tier / locale as shown]
- Data source: [component path]
- Data quality: [complete / partial / uncertain]

Dashboard Reading
[Structured explanation of what each section or chart shows, in business terms]

Misinterpretation Risks Identified
- [Risk 1]: [what a reader might wrongly conclude and why]
- [Risk 2]: [what a reader might wrongly conclude and why]

Data Quality Issues
- [Issue 1]: [what is missing, stale, or potentially incorrect]

Critique (if requested)
- Data accuracy: [assessment]
- Completeness: [assessment]
- Visual clarity: [assessment]
- Scope transparency: [assessment]
- Actionability: [assessment]

Health Checklist Result
- [pass / fail per checklist item]

Recommended Changes (if critique requested)
- [Change 1]
- [Change 2]

Confidence Assessment
- Overall confidence: [high / medium / low]
- Caveats: [list]
- Version notes: [relevant CHANGELOG entries]
- Next analytical step: [what to verify]
─────────────────────────────────────────────────────────
```
