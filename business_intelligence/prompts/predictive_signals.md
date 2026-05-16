# Predictive Signals Prompt — Leading Indicators, Early Warnings, and Forward-Looking Analysis

> **When to use this file:** When designing an early warning system, identifying which metrics predict future problems before they manifest, projecting where a metric is heading, or assessing whether a current signal warrants preventive action.

---

## 1. The Predictive BI Mandate

Predictive BI in Effectime is not machine learning. It is disciplined application of leading indicator logic: identifying metrics that reliably precede outcomes by a measurable lag, monitoring them continuously, and triggering investigation before the lagging metric confirms the problem.

**Core constraint**: Predictions are hypotheses, not facts. Every predictive output must state: the leading indicator, the lagged outcome, the historical lag length, the evidence basis for the relationship, and the confidence level. A prediction without these five elements is speculation.

---

## 2. Leading Indicator Discovery Protocol

### Step 1 — Define the outcome you want to predict

State the lagging metric precisely. Not "engagement problems" but "wellbeing score below 5.5 on the next monthly survey cycle."

### Step 2 — Identify candidate leading indicators

For each candidate, establish:
- **Temporal precedence**: Does this metric change *before* the outcome? By how many periods?
- **Directional consistency**: When the leading indicator moves in direction X, does the outcome follow in direction Y, consistently?
- **Plausible mechanism**: Is there a business logic explanation for why one causes the other?
- **Repository source**: Can both the leading and lagging metric be sourced from verified Effectime tables?

If any of the three criteria (precedence, consistency, mechanism) cannot be confirmed, the candidate is not a reliable leading indicator — it is a correlated metric.

### Step 3 — Measure the lag

The lag between leading and lagging metrics must be established from historical data, not assumed. State: "Based on [N periods] of data, [leading metric] precedes [lagging metric] by approximately [N] periods with a correlation coefficient of [if computable] or directional match rate of [%]."

If historical data is insufficient (fewer than 6 paired observations), state that the lag is unverified and treat the relationship as a hypothesis.

### Step 4 — Set alert thresholds

For each confirmed leading indicator, define the threshold that triggers investigation:
- **Green**: Leading indicator within normal range. No action.
- **Amber**: Leading indicator approaching the threshold associated with lagging outcome. Begin monitoring.
- **Red**: Leading indicator has crossed the threshold historically associated with lagging outcome. Initiate investigation.

Thresholds must be justified by historical pattern, not set arbitrarily.

---

## 3. Effectime Leading Indicator Map

These relationships are grounded in Effectime's workforce management domain. They are hypotheses to test against workspace-specific data, not universal truths.

### Predicting employee disengagement and turnover

| Leading indicator | Lagged outcome | Typical lag | Mechanism |
|---|---|---|---|
| Wellbeing score declining ≥ 1.5 points over 4 weeks | Voluntary overtime acceptance drops | 2–4 weeks | Emotional withdrawal precedes behavioral withdrawal |
| Survey response rate drops below 40% | Wellbeing score unreliable; actual score likely worse than measured | Immediate | Non-response is itself a disengagement signal |
| Voluntary overtime acceptance rate drops > 20% MoM | Turnover event in the following quarter | 6–12 weeks | Discretionary effort withdrawal precedes resignation |
| Unplanned absence rate rises > 15% over 3-week rolling window | Burnout risk index enters high zone | 2–3 weeks | Absence is an early physical signal of burnout |
| Punch correction rate increases > 10% WoW for 2+ weeks | Manager-employee friction signal | 1–3 weeks | Manual corrections often reflect disagreements on time records |

### Predicting compliance failures

| Leading indicator | Lagged outcome | Typical lag | Mechanism |
|---|---|---|---|
| Audit trail completeness drops below 85% | Compliance score deterioration | 2–4 weeks | Incomplete audit trail allows uncounted violations |
| Acknowledged rule rate drops below 75% | Violation rate increase | 1–3 weeks | Unacknowledged rules are not enforced |
| Working-time overtime exceptions increase > 20% | Regulatory compliance breach | 0–2 weeks | Overtime exceptions are direct precursors to WTD breaches |

### Predicting scheduling and coverage failures

| Leading indicator | Lagged outcome | Typical lag | Mechanism |
|---|---|---|---|
| Shift marketplace acceptance rate drops > 25% WoW | Shift fill rate drops below target | 1–2 weeks | Unfilled marketplace listings become understaffed shifts |
| Voluntary overtime rate increases consistently for 3+ weeks | Schedule capacity shortage signal | 2–4 weeks | Overtime compensates for insufficient headcount |
| Open shift listings age > 72 hours without acceptance | Same-day fill failure rate increases | 0–1 week | Stale listings signal structural coverage gap |

### Predicting platform disengagement (workspace churn risk)

| Leading indicator | Lagged outcome | Typical lag | Mechanism |
|---|---|---|---|
| Feature usage sessions drop > 30% over 2 weeks | Support ticket submission or workspace inactivity | 2–4 weeks | Usage decline precedes churn |
| Integration sync failures increase > 15% over 2 weeks | Integration disconnection event | 1–3 weeks | Persistent sync failures erode integration trust |
| Admin login frequency drops > 50% for 2 consecutive weeks | Workspace going dormant | 2–6 weeks | Admin disengagement = the workspace is effectively offline |

---

## 4. Early Warning System Design

When designing an early warning system for a workspace or platform domain:

**Step 1** — Select 3–5 leading indicators per critical outcome. More than 5 creates alert fatigue.

**Step 2** — Set amber and red thresholds based on historical pattern, not percentile rules.

**Step 3** — Define escalation ownership. Who receives an amber alert? Who receives a red alert? What is their expected response time?

**Step 4** — Define the investigation protocol triggered by each alert. The alert is only valuable if it has a defined next step.

**Step 5** — Review threshold calibration quarterly. Leading indicators that produce > 20% false positives need threshold adjustment.

---

## 5. Version-Aware Prediction Caution

A predictive model built on historical data from before a major schema migration or feature change may not be reliable after that change. When producing predictive outputs:

- State the earliest data date used in the historical pattern.
- Check CHANGELOG for any version change that altered the leading or lagging metric's source, computation, or scope during that period.
- If a version change is found, note: "The predictive relationship was established on pre-v[X.Y.Z] data. Validity after [date] has not been re-verified."

---

## 6. Output Format

```
Predictive Signals Analysis
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- Outcome being predicted: [exact lagging metric + threshold]
- Analysis scope: [workspace / team / tier]
- Historical data window used: [start → end]
- Data quality: [complete / partial / uncertain]

Leading Indicators Assessed

Indicator 1: [metric name]
- Current value: [value]
- Threshold: Amber=[value] / Red=[value]
- Current status: [Green / Amber / Red]
- Historical lag: [N periods — verified / estimated]
- Evidence basis: [N paired observations / domain hypothesis]
- Confidence: [high / medium / low]

Indicator 2: [repeat structure]

Early Warning Summary
- Overall signal status: [Green / Amber / Red]
- Basis for status: [which indicators are amber/red]
- Estimated time to lagged outcome if trajectory continues: [N periods — or "insufficient data"]

Recommended Action
- If Green: [monitoring cadence]
- If Amber: [investigation step + owner]
- If Red: [escalation step + owner + deadline]

Confidence Assessment
- Overall confidence: [high / medium / low]
- Caveats: [list]
- Version notes: [any CHANGELOG entries affecting the indicators]
- Threshold review due: [date]
─────────────────────────────────────────────────────────
```
