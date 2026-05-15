# Segment and Cohort Analysis Prompt — Segmentation, Cohort Behavior, and Funnel Interpretation

> **When to use this file:** When comparing groups within the platform, tracking how a cohort of workspaces or employees behaves over time, or analyzing a multi-stage funnel (recruitment, onboarding, engagement, retention).

---

## 1. Segmentation Framework for Effectime

Effectime's data is naturally segmented across several dimensions. Always state the active segmentation before comparing groups.

### Primary Segmentation Dimensions

| Dimension | Values | BI relevance |
|---|---|---|
| Workspace tier | starter / growth / enterprise / custom | Feature availability and usage patterns differ entirely by tier |
| Workspace size (headcount) | small (<20) / medium (20–100) / large (>100) | Metric magnitude scales with size — rate-based metrics are more comparable across sizes |
| Industry / vertical | (workspace-configured) | Compliance patterns, shift structures, and wellbeing baselines differ by industry |
| Locale | en / hu / de / at / cs / sk / pl / ro | Behavioral patterns may reflect cultural or regulatory differences |
| Role | admin / manager / member / hr | Feature access and metric relevance differ by role |
| Team | (workspace-configured) | Operational metrics are most meaningful at team level |
| Tenure cohort | new (<90 days) / established (90–365 days) / veteran (>365 days) | Engagement, wellbeing, and compliance patterns differ with tenure |

### Segmentation Discipline

Never compare segments that differ on more than one primary dimension without controlling for the others. A comparison of "enterprise vs. starter workspaces" that does not control for size and industry may reflect size and industry differences, not tier differences.

When segments are compared, state:
- Which dimension is being compared.
- Which confounding dimensions are controlled (and how).
- Which confounding dimensions are not controlled (and what this means for confidence).

---

## 2. Cohort Analysis Protocol

A cohort is a group of entities (workspaces, employees, or users) defined by a shared characteristic at a specific point in time. Cohort analysis tracks how that group behaves over subsequent periods.

### Step 1 — Define the Cohort Entry Event

The cohort entry event must be specific and point-in-time:
- Workspace cohorts: "Workspaces that activated in Q1 2026."
- Employee cohorts: "Employees who completed onboarding in January 2026."
- Engagement cohorts: "Employees who scored below 5.0 on the February 2026 wellbeing survey."
- Tier cohorts: "Workspaces that upgraded from growth to enterprise tier in the trailing 6 months."

Do not define a cohort by a range characteristic ("workspaces with high feature adoption") — this creates a survivorship-biased cohort that does not enable causal inference.

### Step 2 — Define the Observation Window

How long will you track the cohort? The observation window must be:
- Long enough to observe the behavior you are interested in.
- Consistent across cohorts being compared (all cohorts observed for the same number of periods after entry).
- Available in the data (cohorts defined recently may not have sufficient post-entry observation periods).

### Step 3 — Select Cohort Metrics

Choose metrics that are:
- Meaningful for the cohort type and entry event.
- Available for the full observation window.
- Consistent in definition across the window (no schema migration or computation change during observation).

Common Effectime cohort metrics:

| Cohort type | Useful metrics | Observation window |
|---|---|---|
| New workspace cohort | Feature adoption rate, first integration setup, tier upgrade | 30/60/90 days |
| New employee cohort | Onboarding completion rate, first clock-in compliance, 90-day retention | 30/60/90 days |
| Engagement cohort | Wellbeing score trajectory, survey response rate, voluntary overtime | 4–12 weeks |
| Compliance cohort | Violation rate trend, audit score improvement | 4–12 weeks |

### Step 4 — Version-Aware Cohort Comparison

When comparing cohorts from different time periods, check:
- Did any software version change occur between cohort entry periods that could affect behavior? (A feature that did not exist for the earlier cohort cannot be compared to feature adoption in the later cohort.)
- Did any schema migration affect the metrics used to compare cohorts?
- Did tier definitions or feature gates change between cohort windows?

If yes, note the version discontinuity and restrict comparison to the post-change period.

---

## 3. Funnel Analysis Protocol

A funnel analysis measures drop-off between sequential stages of a defined process. Effectime has three primary funnels.

### Funnel 1 — Recruitment Funnel
Stage 1: Candidate created → Stage 2: First interview scheduled → Stage 3: Interview completed → Stage 4: Offer made → Stage 5: Offer accepted → Stage 6: Onboarding started

Key metrics: stage-to-stage conversion rate, time-in-stage, drop-off rate by stage.

Source: `src/components/candidates/` and the relevant `candidates` and `recruitment_stages` tables.

### Funnel 2 — Workspace Onboarding Funnel
Stage 1: Workspace created → Stage 2: First admin login → Stage 3: First employee added → Stage 4: First schedule published → Stage 5: First clock-in recorded → Stage 6: First compliance rule configured → Stage 7: First integration connected

Key metrics: stage completion rate, time-to-complete per stage, abandonment point.

### Funnel 3 — Engagement Activation Funnel
Stage 1: Survey sent → Stage 2: Survey opened → Stage 3: Survey completed → Stage 4: Score computed → Stage 5: Manager briefed → Stage 6: Action item created

Key metrics: response rate, completion-to-briefing rate, briefing-to-action rate.

### Funnel Analysis Rules

- Always show absolute volumes alongside conversion rates. A 50% conversion rate on 4 entries is not comparable to a 50% conversion rate on 400 entries.
- Do not average funnel conversion rates across workspaces with different stage definitions.
- When a stage shows an anomalous drop-off, investigate whether: (a) the stage is functioning correctly in the UI, (b) the data capture for that stage is complete, (c) a version change recently affected that stage's component.

---

## 4. Segment Comparison Methodology

When comparing two or more segments on the same metric:

1. **Confirm the metric definition is identical across segments.** If segment A uses a different computation context (different RLS scope, different tier features), the comparison is invalid.
2. **Check sample size.** Small-N segments require wide confidence intervals and explicit caveats.
3. **State direction explicitly.** Which segment is performing better? By how much?
4. **Test for practical significance.** A statistically significant 0.3% difference may not be actionable. A 12% difference always is.
5. **Identify the explanation.** What structural, behavioral, or version-based factor explains the segment difference?

---

## 5. Output Format

```
Segment / Cohort / Funnel Analysis
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- Analysis type: [segmentation / cohort / funnel]
- Metric(s): [names + definitions]
- Time window / observation period: [start → end]
- Scope: [workspace / tier / team / locale]
- Data source: [tables / components]
- Data quality: [complete / partial / uncertain]

Segmentation Definition
- Dimension compared: [dimension]
- Segments: [list with N per segment]
- Confounds controlled: [list]
- Confounds not controlled: [list — impact on confidence]

[FOR COHORT ANALYSIS:]
Cohort Definition
- Entry event: [specific event + date range]
- Cohort size: [N entities]
- Observation window: [N periods]
- Version discontinuity check: [none / [version change found — impact]]

[FOR FUNNEL ANALYSIS:]
Funnel Definition
- Process: [recruitment / onboarding / engagement]
- Stages: [list all stages]
- Total entering funnel: [N]

Results

[Segment comparison table or cohort progression table or funnel stage table with values, rates, and change vs. baseline]

Key Findings
- [Finding 1]: [metric] — [segment or stage] — [value] — [significance]
- [Finding 2]: [metric] — [segment or stage] — [value] — [significance]

Explanations (ranked by evidence)
1. [Explanation] — Evidence: [source] — Confidence: [high/medium/low]
2. [Explanation] — Evidence: [source] — Confidence: [high/medium/low]

Recommended Actions
- [Action 1]: [what + which segment/cohort/stage it targets]
- [Action 2]: [what + which segment/cohort/stage it targets]

Confidence Assessment
- Overall confidence: [high / medium / low]
- Sample size notes: [segments with N < 30 flagged]
- Caveats: [list]
- Version notes: [relevant CHANGELOG entries]
- Next analytical step: [what to do next]
─────────────────────────────────────────────────────────
```
