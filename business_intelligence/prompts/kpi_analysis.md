# KPI Analysis Prompt — Metric Interpretation, Performance Assessment, Variance Explanation

> **When to use this file:** When interpreting what a KPI value means, assessing whether it is healthy, explaining why it changed, or computing variance against a target or prior period.

---

## 1. KPI Analysis Protocol

Execute these steps in order. Do not skip to interpretation before completing definition validation.

### Step 1 — Establish the Metric Definition

Before evaluating any KPI value, locate its definition:
- Find the source component in `src/components/analytics/` to understand how it is displayed.
- Find the underlying data in `supabase/migrations/` to understand what is actually computed.
- Confirm whether the metric is a raw count, a rate, a ratio, a moving average, or a composite score.
- Confirm the time window the metric applies to (point-in-time, period total, rolling window).
- Confirm the scope (single workspace, team, role, or cross-workspace aggregate).

**If the definition cannot be confirmed from repository evidence, do not produce a performance assessment. State that the definition is unverified and stop.**

### Step 2 — Establish the Performance Baseline

A metric value has no meaning without a baseline. Determine which applies:

| Baseline type | What it requires |
|---|---|
| Target / budget | An explicit target must exist in documentation or workspace config |
| Prior period | Same metric, same scope, prior comparable period (WoW, MoM, YoY) |
| Peer segment | Same metric, same tier/industry/size cohort |
| Internal threshold | A documented floor or ceiling defined in governance or product logic |

Do not invent a baseline. If none of the above can be established from repository evidence, state that no performance baseline is available and present the value as a neutral data point only.

### Step 3 — Compute Variance

When a baseline exists, compute variance as:
- Absolute change: current − baseline.
- Relative change: (current − baseline) / baseline × 100%.
- Direction: improvement or deterioration (must be defined per metric — a lower absence rate is an improvement; a lower compliance score is a deterioration).

State the direction explicitly. Never assume which direction is positive without confirming the metric's polarity.

### Step 4 — Assess Statistical Significance

Before assigning business meaning to a variance:
- Is the sample size sufficient? (For rates: N < 30 requires a strong caveat. N < 10 should not produce a performance conclusion.)
- Is the variance within normal volatility range? (One anomalous day does not constitute a trend.)
- Does the period cover a representative time span? (A Monday-only sample is not representative of a week.)

### Step 5 — Check Version History for Explanation

Before attributing variance to business causes:
- Check `CHANGELOG.md` for any version change in the analysis period.
- Check `versioning/*.md` for technical details of any relevant delivery.
- If a schema migration, computation fix, or feature gate change occurred, name it as a candidate explanation before considering business causes.

### Step 6 — Produce the KPI Analysis Output

Use the output format in Section 4.

---

## 2. Effectime KPI Reference Catalog

Use this catalog to confirm correct metric polarity, typical scope, and data source location.

### Workforce
| KPI | Polarity | Typical scope | Source |
|---|---|---|---|
| Headcount | Neutral (depends on context) | Workspace / team | `members` table |
| Turnover rate | Lower = better | Workspace, rolling 12M | `member_offboarding` events |
| Absence rate | Lower = better | Workspace / team, monthly | `attendance_records` |
| Shift fill rate | Higher = better | Workspace, weekly | `shift_assignments` |

### Attendance & Time
| KPI | Polarity | Typical scope | Source |
|---|---|---|---|
| Clock-in rate | Higher = better | Workspace / team, daily | `clock_events` |
| Shift adherence rate | Higher = better | Workspace / team, weekly | `shift_assignments` + `clock_events` |
| Overtime rate | Lower = better (unless context is voluntary) | Workspace, weekly | `clock_events` |
| Punch correction rate | Lower = better | Workspace, weekly | `clock_correction_events` |

### Compliance
| KPI | Polarity | Typical scope | Source |
|---|---|---|---|
| Compliance score | Higher = better | Workspace, period | `compliance_rule_evaluations` |
| Audit trail completeness | Higher = better | Workspace, period | `audit_events` |
| Violation rate | Lower = better | Workspace / rule type, period | `compliance_violations` |

### Engagement & Wellbeing
| KPI | Polarity | Typical scope | Source |
|---|---|---|---|
| Wellbeing score | Higher = better | Workspace / team, rolling | `wellbeing_survey_responses` |
| Burnout risk index | Lower = better | Workspace / team | Computed composite |
| Survey response rate | Higher = better | Workspace, per survey cycle | `wellbeing_survey_responses` |

### Platform
| KPI | Polarity | Typical scope | Source |
|---|---|---|---|
| Feature adoption rate | Higher = better | Tier / workspace cohort | `feature_usage_events` |
| Active workspace rate | Higher = better | Platform, weekly | `workspace_sessions` |
| Integration sync rate | Higher = better | Per integration, daily | `integration_sync_logs` |

---

## 3. Variance Explanation Framework

When a KPI shows variance from baseline, work through these candidate causes in order:

1. **Version change** — Did a software change coincide with the metric shift? Check CHANGELOG first.
2. **Scope change** — Did the denominator population change? (New team members, workspace tier upgrade, new shift types added.)
3. **Seasonality** — Is this a known cyclical pattern? (Absence rate typically spikes in Q4 holiday periods; overtime spikes at month-end.)
4. **External event** — Is there a business event that explains the shift? (New location opened, manager changed, compliance audit triggered.)
5. **Data quality** — Is the shift in the data or in the reality? Check for missing records, delayed syncs, or bulk imports.
6. **Measurement artifact** — Is the metric being calculated differently than before? Check for formula changes in component code.

Do not present a single cause as confirmed. Present the ranked candidate list with supporting evidence and confidence level for each.

---

## 4. Output Format

```
KPI Analysis
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- KPI: [name + exact definition]
- Time window: [start → end, granularity]
- Scope: [workspace / team / tier / locale]
- Data source: [table / component]
- Data quality: [complete / partial / uncertain]

Performance Assessment
- Current value: [value + unit]
- Baseline: [value + type: target / prior period / peer segment]
- Absolute variance: [+/- value]
- Relative variance: [+/- %]
- Direction: [improvement / deterioration / neutral]
- Statistical validity: [sufficient / weak — N = X]

Variance Explanation (ranked by evidence strength)
1. [Candidate cause] — Evidence: [source] — Confidence: [high/medium/low]
2. [Candidate cause] — Evidence: [source] — Confidence: [high/medium/low]
3. [Candidate cause] — Evidence: [source] — Confidence: [high/medium/low]

Business Interpretation
[2–4 sentences connecting the metric movement to a business outcome or risk]

Recommended Action
[What should change or be investigated based on this analysis]

Confidence Assessment
- Overall confidence: [high / medium / low]
- Caveats: [list]
- Version notes: [relevant CHANGELOG entries]
- Next analytical step: [what to do next]
─────────────────────────────────────────────────────────
```
