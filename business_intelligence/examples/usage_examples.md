# BI Usage Examples — Copy-Paste Invocation Patterns for Common BI Tasks

> These are ready-to-use prompts for common BI tasks in the Effectime repository. Each example specifies which specialist file to read before invoking the prompt, and what the expected output structure is.

---

## How to use these examples

1. Read `business_intelligence/SYSTEM.md` first (always).
2. Find the example that matches your task.
3. Note which specialist prompt file to read.
4. Customize the bracketed parameters for your specific context.
5. Run the discovery protocol from SYSTEM.md Section 3 before generating output.

---

## Example 1 — Analyze a Single KPI

**Specialist file**: `prompts/kpi_analysis.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/prompts/kpi_analysis.md.

Then analyze the following KPI:

Metric: Clock-in rate
Workspace: [workspace ID or description]
Time window: [YYYY-MM-DD] to [YYYY-MM-DD], daily granularity
Baseline: Prior equivalent period ([YYYY-MM-DD] to [YYYY-MM-DD])
Current value: [value]%
Prior period value: [value]%

Complete the mandatory discovery protocol. Locate the metric definition in the repository. Check CHANGELOG for version-induced shifts. Produce the full KPI Analysis output using the format in kpi_analysis.md Section 4.
```

---

## Example 2 — Investigate a Metric Trend

**Specialist file**: `prompts/trend_analysis.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/prompts/trend_analysis.md.

Analyze the trend in the following metric:

Metric: Absence rate
Workspace: [workspace ID or description]
Time window: [YYYY-MM-DD] to [YYYY-MM-DD], weekly granularity
Weekly values: [list of values in order]

Determine whether the trend is real or noise. Check for trend breaks. Assess seasonality. Assign a direction confidence level. Produce the full Trend Analysis output using the format in trend_analysis.md Section 4.
```

---

## Example 3 — Investigate a Suspicious Data Point

**Specialist file**: `prompts/anomaly_detection.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/prompts/anomaly_detection.md.

A suspicious value has appeared in the following metric:

Metric: Compliance score
Workspace: [workspace ID or description]
Anomaly period: [YYYY-MM-DD]
Observed value: [value]
Expected range: [range and basis]

Classify the anomaly type. Run the version-induced anomaly check. Collect evidence from CHANGELOG and migrations. Assign severity. Produce the full Anomaly Detection Report using the format in anomaly_detection.md Section 4.
```

---

## Example 4 — Explain a Dashboard to a Stakeholder

**Specialist file**: `prompts/dashboard_interpretation.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/prompts/dashboard_interpretation.md.

Interpret the following dashboard view for a workspace manager audience:

Dashboard: Executive KPI overview
Workspace: [workspace ID or description]
Time window shown: [as displayed in dashboard]
Workspace tier: [tier]

Locate the source components in src/components/analytics/. Identify misinterpretation risks. Run the dashboard health checklist. Produce the full Dashboard Interpretation output using the format in dashboard_interpretation.md Section 6.
```

---

## Example 5 — Write an Executive Summary

**Specialist file**: `prompts/executive_summary.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/prompts/executive_summary.md.

Produce an executive summary for the following:

Audience: [Board / C-suite / HR leadership / Workspace manager]
Period: [YYYY-MM-DD] to [YYYY-MM-DD]
Scope: [workspace / platform / tier segment]

Key metrics for this period:
- [Metric 1]: [value] vs. [baseline]
- [Metric 2]: [value] vs. [baseline]
- [Metric 3]: [value] vs. [baseline]

Known concerns: [list or "none"]
Decisions required: [list or "none identified"]

Produce the Executive Summary using the 6-section structure in executive_summary.md Section 7.
```

---

## Example 6 — Assess Data Quality Before a Report

**Specialist file**: `prompts/data_quality.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/prompts/data_quality.md.

Assess the data quality for the following dataset before producing a report:

Dataset: [metric or table name]
Time window: [YYYY-MM-DD] to [YYYY-MM-DD]
Workspace scope: [workspace / all workspaces / tier segment]

Check all five quality dimensions. Check Effectime-specific patterns (RLS scope, migration effects, soft-delete handling, integration sync gaps). Assign an overall quality score. Produce the full Data Quality Assessment output using the format in data_quality.md Section 6.
```

---

## Example 7 — Find the Cause of a Metric Drop

**Specialist file**: `prompts/root_cause_analysis.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/prompts/root_cause_analysis.md.

The following metric has dropped unexpectedly:

Metric: [metric name]
Effect: [precise value, magnitude, direction, period, scope]
Prior stable range: [range]
Drop date: [YYYY-MM-DD]

Run the software cause check first. Then generate business cause hypotheses across all six cause categories. Rank by evidence strength. Define the confirmation test for the top-ranked hypothesis. Produce the full Root Cause Analysis output using the format in root_cause_analysis.md Section 5.
```

---

## Example 8 — Compare Workspaces by Tier

**Specialist file**: `prompts/segment_cohort_analysis.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/prompts/segment_cohort_analysis.md.

Perform a segment comparison:

Metric: Feature adoption rate (wellbeing module)
Dimension: Workspace tier (starter vs. growth vs. enterprise)
Time window: [YYYY-MM-DD] to [YYYY-MM-DD]
Segments:
- Starter tier: N=[count], value=[rate]
- Growth tier: N=[count], value=[rate]
- Enterprise tier: N=[count], value=[rate]

State confounding dimensions. Check sample sizes. Explain the differences. Produce the Segment Analysis output using the format in segment_cohort_analysis.md Section 5.
```

---

## Example 9 — Track a New Workspace Cohort

**Specialist file**: `prompts/segment_cohort_analysis.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/prompts/segment_cohort_analysis.md.

Perform a cohort analysis:

Cohort entry event: Workspaces activated in [month/year]
Cohort size: N=[count]
Observation window: 90 days post-activation
Metrics:
- 30-day feature adoption rate: [value]
- 60-day feature adoption rate: [value]
- 90-day feature adoption rate: [value]
- 90-day retention (workspace still active): [value]%

Check for version discontinuities during the observation window. Produce the Cohort Analysis output using the format in segment_cohort_analysis.md Section 5.
```

---

## Example 10 — Analyze the Recruitment Funnel

**Specialist file**: `prompts/segment_cohort_analysis.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/prompts/segment_cohort_analysis.md.

Analyze the recruitment funnel:

Workspace: [workspace ID or description]
Period: [YYYY-MM-DD] to [YYYY-MM-DD]
Funnel data:
- Candidates created: [N]
- First interview scheduled: [N]
- Interview completed: [N]
- Offer made: [N]
- Offer accepted: [N]
- Onboarding started: [N]

Identify the highest drop-off stage. Investigate whether it reflects a process problem, a data capture problem, or a version-induced issue. Produce the Funnel Analysis output using the format in segment_cohort_analysis.md Section 5.
```

---

## Example 11 — Define a New Metric Formally

**Template**: `templates/metric_definition_template.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/templates/metric_definition_template.md.

Define the following metric formally:

Metric name: [metric name]
Business question it answers: [question]
Suspected source table: [table name or "unknown — investigate"]
Suspected computation: [description or "unknown — investigate"]

Locate the source in supabase/migrations/ and src/components/analytics/. Verify the computation. Complete the full metric definition using the template in metric_definition_template.md. Flag any sections where the definition cannot be confirmed from repository evidence.
```

---

## Example 12 — Produce a BI Report for a Period

**Specialist files**: Multiple (route based on content needed)

```
Read business_intelligence/SYSTEM.md and business_intelligence/templates/bi_report_template.md.

Then read:
- business_intelligence/prompts/kpi_analysis.md (for metric assessments)
- business_intelligence/prompts/trend_analysis.md (for trend sections)
- business_intelligence/prompts/executive_summary.md (for decisions and actions)

Produce a BI report:

Report type: [KPI Report / Trend Report / Executive Summary]
Period: [YYYY-MM-DD] to [YYYY-MM-DD]
Scope: [workspace / tier / platform]
Audience: [Board / HR leadership / Workspace manager]
Key metrics: [list with values]
Known concerns: [list or "none"]

Complete the discovery protocol. Use the bi_report_template.md structure. Do not omit sections — mark inapplicable sections explicitly.
```

---

## Example 13 — Document a BI Finding as a Versioned Artifact

**Specialist file**: `prompts/bi_documentation.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/prompts/bi_documentation.md.

Document the following analytical finding as a versioned artifact:

Finding: [brief description]
Analysis type: [KPI / trend / anomaly / RCA / cohort]
CHANGELOG version: [version]
Analysis summary: [completed analysis output or key findings]
Decision informed: [what decision this supports]
Data quality: [High / Medium / Low]

Determine the document type. Generate the filename using the DDMMYYNNN_vX.Y.Z_bi-[slug].md convention. Produce the full document using the structure in bi_documentation.md Section 5. Include all repository evidence citations.
```

---

## Example 14 — BI Strategy Session for a New Domain

**Specialist file**: `prompts/bi_strategy.md`

```
Read business_intelligence/SYSTEM.md and business_intelligence/prompts/bi_strategy.md.

Design a BI measurement framework for the following domain:

Domain: [Compliance / Wellbeing / Workforce / Agile / Platform / Financial]
Audience: [who will use this framework]
Key decisions this framework must support: [list 3–5 decisions]
Available data sources: [list tables or "investigate"]
Tier context: [which tiers will use this framework]

Apply the 7-step measurement framework design protocol. Identify leading and lagging indicators. Flag data gaps. Define alert thresholds. Produce the BI Strategy Output using the format in bi_strategy.md Section 7.
```

---

## Example 15 — Cross-Metric Correlation Investigation

**Specialist files**: `prompts/trend_analysis.md` + `prompts/root_cause_analysis.md`

```
Read business_intelligence/SYSTEM.md, business_intelligence/prompts/trend_analysis.md, and business_intelligence/prompts/root_cause_analysis.md.

Investigate whether the following two metrics are meaningfully correlated:

Metric A: [metric name]
Metric B: [metric name]
Time window: [YYYY-MM-DD] to [YYYY-MM-DD], weekly granularity
Metric A values: [list]
Metric B values: [list]
Hypothesis: [proposed relationship between A and B]

Analyze the trend in each metric separately. Apply the correlation vs. causation protocol from root_cause_analysis.md Section 4. Check temporal order, plausible mechanism, and confound candidates. State whether the proposed relationship is supported, weakly supported, or unsupported by the evidence.
```
