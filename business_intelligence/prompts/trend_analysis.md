# Trend Analysis Prompt — Time-Series Patterns, Direction Confidence, and Trend Break Detection

> **When to use this file:** When analyzing whether a metric is moving in a meaningful direction, determining if a trend is real or noise, detecting trend breaks, or projecting direction forward.

---

## 1. Trend Analysis Protocol

### Step 1 — Define the Time Window Precisely

A trend analysis without an explicit, justified time window is not analysis — it is speculation.

Determine:
- **Start date**: Why this start date? (Beginning of fiscal period, post-migration date, cohort entry date.)
- **End date**: Is this the most recent complete period? (Incomplete current-period data creates a false downtrend at the end.)
- **Granularity**: Match to the decision cadence. Daily for operational metrics, weekly for performance metrics, monthly for strategic metrics.
- **Comparison period**: A parallel window of the same length for like-for-like comparison.

Reject any request for trend analysis that provides only a vague time reference like "recently" or "lately." Ask for a specific range.

### Step 2 — Establish the Baseline Trend Direction

Compute or retrieve the following:
- **Point values** for each period in the window.
- **Period-over-period change** (value[n] − value[n−1]).
- **Direction consistency**: What percentage of periods move in the same direction?
- **Trend slope**: Is the change accelerating, decelerating, or flat?

### Step 3 — Separate Signal from Noise

Before declaring a trend:

| Signal test | Method |
|---|---|
| Minimum data points | Require ≥ 6 data points for a trend claim. Fewer = insufficient |
| Consistency threshold | ≥ 70% of periods moving in same direction = directional trend |
| Magnitude check | Change must exceed normal volatility band (use std dev or range if available) |
| Outlier contamination | If one or two outlier periods drive the apparent trend, it is not a trend |

A trend claim based on fewer than 6 data points must include a caveat. A trend claim based on 3 or fewer data points is not permitted.

### Step 4 — Check for Trend Breaks

A trend break is a point where the metric changes direction or rate significantly. Trend breaks have two categories:

**Business-driven breaks**: The underlying business reality changed (new manager, policy rollout, headcount event, seasonal shift).

**Version-driven breaks**: A software change altered what is being measured or how it is calculated. This is always the first hypothesis to check for Effectime.

For every apparent trend break:
1. Find the date of the break.
2. Check `CHANGELOG.md` for any version delivery in the 7-day window around that date.
3. Check `supabase/migrations/` for schema changes to the metric's source table in the same window.
4. If a software change is found, treat version causation as the primary hypothesis until business evidence rules it out.

### Step 5 — Seasonality Assessment

Certain Effectime metrics have known seasonality patterns that must be factored out before declaring a trend:

| Metric | Known seasonality pattern |
|---|---|
| Absence rate | Spikes Q4 (holiday period), Q1 (winter illness) |
| Overtime rate | Spikes at period-end and around public holidays |
| Survey response rate | Drops during holiday periods and high-workload cycles |
| Shift fill rate | Drops during summer and holiday periods |
| Feature adoption | Spikes after new feature launches, then normalizes |

If a trend coincides with a known seasonality window, discount the trend's significance and note the seasonal context.

### Step 6 — Assign Direction Confidence

| Confidence level | Criteria |
|---|---|
| High | ≥ 8 data points, ≥ 75% directional consistency, no version break, not in seasonal window |
| Medium | 6–7 data points, 60–75% consistency, or trend break explained by non-version cause |
| Low | < 6 data points, < 60% consistency, version break unresolved, or strong seasonality contamination |

---

## 2. Projection Guidance

Projecting a trend forward is only permitted when:
- Confidence level is high.
- The projection horizon is ≤ 25% of the analysis window length. (6-month analysis → maximum 6-week projection.)
- The projection is labeled explicitly as a directional estimate, not a forecast.

Never project a low-confidence trend. State instead: "Insufficient trend stability for projection. Extend the analysis window to [recommended duration] before projecting."

---

## 3. Multi-Metric Trend Correlation

When analyzing correlated trends (e.g., "wellbeing score is declining as overtime rate rises"):

1. Confirm both metrics share the same scope and time window before comparing.
2. Check whether both metrics source from the same workspace population.
3. Compute the lag between the leading indicator movement and the lagging indicator movement.
4. Do not claim causation. State: "Metric A shows [direction] trend with an approximately [N]-period lead over Metric B. This correlation is consistent with [business hypothesis] but causation is not confirmed."

---

## 4. Output Format

```
Trend Analysis
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- Metric: [name + definition]
- Time window: [start → end, granularity, N data points]
- Scope: [workspace / team / tier / locale]
- Data source: [table / component]
- Data quality: [complete / partial / uncertain]

Trend Summary
- Direction: [upward / downward / flat / mixed]
- Slope: [accelerating / decelerating / stable]
- Period-over-period consistency: [X% of periods moving in stated direction]
- Volatility: [high / moderate / low — definition of "normal" range]

Trend Breaks Detected
- [Date]: [description of break] — Cause hypothesis: [version change / business event / seasonal / unknown]
  - CHANGELOG evidence: [relevant entry or "none found"]

Seasonality Assessment
- Seasonal context: [in seasonal window / not in seasonal window]
- Seasonal adjustment applied: [yes / no / not applicable]

Direction Confidence
- Confidence level: [high / medium / low]
- Basis: [data points, consistency %, break status, seasonality]

Projection (only if confidence = high)
- Short-term direction: [direction over next N periods — clearly labeled as estimate]
- Projection caveat: [explicit uncertainty statement]

Business Interpretation
[2–4 sentences on what this trend means operationally or strategically]

Recommended Next Step
[What to investigate or act on based on this trend]

Confidence Assessment
- Overall confidence: [high / medium / low]
- Caveats: [list]
- Version notes: [relevant CHANGELOG entries]
- Next analytical step: [what increases confidence]
─────────────────────────────────────────────────────────
```
