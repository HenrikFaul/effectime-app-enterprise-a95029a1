# Wellbeing Trajectory Forecasting Prompt — Score Projection, Burnout Timeline, and Team Risk Classification

> **When to use this file:** When projecting where wellbeing scores are headed, estimating a burnout timeline for a team, classifying team-level risk, or determining whether current wellbeing trends will self-correct or require intervention. Always read `prompts/forecasting_methodology.md` first.

---

## 1. Wellbeing Forecasting Principles

Wellbeing is the most complex metric domain to forecast in Effectime because:

1. **Survey lag**: Wellbeing data is point-in-time from surveys. The period between surveys creates a data gap where the trajectory must be inferred from proxy signals, not from the metric itself.
2. **Response rate dependency**: A wellbeing score based on < 40% response rate is not reliable enough to build a forecast on. Always check response rate before forecasting.
3. **Composite structure**: Wellbeing scores are composites. A stable overall score can hide a deteriorating sub-dimension. Check whether sub-dimension breakdown is available before treating the composite as the full picture.
4. **Seasonal contamination**: Wellbeing scores have strong seasonal patterns (see `prompts/seasonal_pattern_library.md` Patterns EW-01 and EW-02). Always apply seasonal context before projecting.
5. **Feedback sensitivity**: A team that knows their wellbeing data is being acted on will score differently in the next survey cycle — upward bias if interventions are perceived as positive, downward bias if interventions are perceived as surveillance.

---

## 2. Data Sufficiency Check

Before producing any wellbeing trajectory forecast, run this check:

| Requirement | Threshold | Action if not met |
|---|---|---|
| Survey response rate (most recent survey) | ≥ 40% | Flag as insufficient — produce directional estimate only, not numeric projection |
| Minimum survey data points | 3 completed survey cycles | With fewer, produce signal-based estimate only (see Section 4) |
| Consistent survey methodology | Same questions / same scale across cycles | If methodology changed, truncate training window to post-change cycles |
| No response rate cliff | Response rate not declining > 20% cycle-over-cycle | If declining, response rate trend itself is a risk signal |

---

## 3. Wellbeing Trajectory Model

When data sufficiency requirements are met, project wellbeing trajectory using this model:

### Step 1 — Establish the score trend
Compute period-over-period score movement across available survey cycles. Apply the seasonal adjustment from Pattern EW-01 to remove expected seasonal variation before determining the underlying trend direction.

Formula: Seasonally adjusted score = Raw score ÷ Seasonal index for the survey period.

If the seasonally adjusted score is declining: the business is causing the decline, not the calendar. If the raw score is declining but the seasonally adjusted score is flat or rising: the decline is primarily seasonal.

### Step 2 — Compute trend velocity
Velocity = (Score[most recent] − Score[N cycles ago]) ÷ N cycles.

Classify:
- Velocity < -0.2 points/cycle: Slow decline — intervention within 2 cycles.
- Velocity -0.2 to -0.5 points/cycle: Moderate decline — intervention within 1 cycle.
- Velocity < -0.5 points/cycle: Rapid decline — immediate intervention.
- Velocity > 0: Improving — monitor and confirm.

### Step 3 — Project to threshold
Identify the intervention threshold score (typically 5.0 out of 10, or workspace-configured target floor).

If current trend continues: Time to threshold = (Current score − Threshold score) ÷ |Velocity|

State: "At current velocity of [V] points/cycle, the intervention threshold of [T] will be reached in approximately [N] survey cycles ([approximate calendar date]), if no corrective action is taken."

Apply uncertainty: ± 1–2 survey cycles for high-confidence trends, ± 2–4 for medium-confidence.

### Step 4 — Apply proxy signal adjustment
Between survey cycles, wellbeing trajectory can be inferred from proxy signals. These signals do not replace survey data but can shift the confidence level and direction:

| Proxy signal | Direction if trending negatively | Confidence modifier |
|---|---|---|
| Voluntary overtime acceptance rate declining | Wellbeing likely deteriorating | Adds medium-confidence support to declining trend |
| Unplanned absence rate rising | Wellbeing likely deteriorating | Adds medium-confidence support |
| Punch correction rate rising | Workplace friction signal | Adds low-confidence support to declining trend |
| Shift cancellation rate rising | Disengagement signal | Adds low-confidence support |

If 2+ proxy signals are trending negatively between survey cycles: project the wellbeing score as continuing its prior trend rather than assuming stabilization.

If 0–1 proxy signals are trending negatively: maintain prior trend direction but widen the uncertainty band to reflect the gap in direct measurement.

---

## 4. Signal-Based Estimate (When Survey Data is Insufficient)

When fewer than 3 survey cycles are available, or response rate is below 40%, produce a signal-based estimate rather than a trend projection:

1. Score the available proxy signals (Section 3 Step 4).
2. Compare to leading indicator thresholds from `prompts/predictive_signals.md` Patterns EW-02 and EW-03.
3. Classify: "Wellbeing trajectory signal: [positive / stable / cautionary / high-risk] — based on [N] proxy signals available for [period]."
4. Do not produce a numeric score projection from proxy signals alone. Produce a directional classification only.
5. State: "A numeric wellbeing trajectory projection requires [N additional survey cycles / response rate improvement to ≥ 40%]."

---

## 5. Burnout Timeline Estimation

Burnout timeline estimation combines the wellbeing trajectory with the burnout risk index (if available) and the proxy signal pattern.

### Burnout risk classification

| Risk tier | Criteria | Timeline implication |
|---|---|---|
| Critical | Wellbeing score < 4.5 AND voluntary overtime declining AND absence rate elevated | Burnout may already be present. Individual-level assessment required. |
| High | Wellbeing score 4.5–5.5 AND velocity < -0.3/cycle AND 2+ proxy signals negative | Burnout likely within 2–3 cycles without intervention |
| Elevated | Wellbeing score 5.5–6.5 AND velocity < -0.15/cycle | Burnout risk developing. Intervention window is open. |
| Monitoring | Wellbeing score > 6.5 OR velocity positive | No burnout risk currently. Continue standard monitoring. |

### Burnout reversal timeline
Once an intervention is made (scheduling change, workload reduction, recognition program), expected wellbeing score recovery time:
- Critical → High: 3–6 survey cycles (approximately 3–6 months if monthly surveys).
- High → Elevated: 2–4 cycles.
- Elevated → Monitoring: 1–2 cycles.

Recovery is slower than decline. Account for recovery lag in workforce planning when assessing when burnout-affected employees will return to full engagement.

---

## 6. Team Risk Classification

When assessing wellbeing trajectory across multiple teams:

| Team classification | Criteria |
|---|---|
| Stable | Score ≥ 6.5 AND velocity positive or flat AND response rate ≥ 50% |
| Watch | Score 5.5–6.5 OR velocity -0.1 to -0.2/cycle OR response rate 30–50% |
| At-risk | Score < 5.5 AND velocity < -0.2/cycle OR 2+ proxy signals negative |
| Critical | Score < 4.5 OR velocity < -0.5/cycle OR response rate < 30% consecutive cycles |

Produce a team risk matrix for workspaces with multiple teams. Rank teams from highest to lowest risk. Flag teams where classification changed from the prior assessment.

---

## 7. Output Format

```
Wellbeing Trajectory Forecast
─────────────────────────────────────────────────────────
[Forecast Master Block from forecasting_methodology.md]

Data Sufficiency Check
- Response rate (most recent survey): [%] — [sufficient / insufficient]
- Survey cycles available: [N] — [sufficient / signal-based estimate only]
- Methodology consistency: [consistent / changed in vX.Y.Z — window truncated]
- Response rate trend: [stable / declining — [rate/cycle]]

Seasonal Adjustment
- Season: [current calendar context]
- Pattern applied: [EW-01 index: [value] / EW-02 / not applied — reason]
- Seasonally adjusted scores: [list by cycle]

Score Trend Analysis
- Raw score trajectory: [list of values by cycle]
- Seasonally adjusted trajectory: [list of values]
- Trend velocity: [value] points/cycle — Classification: [slow / moderate / rapid / improving]
- Cause of decline: [seasonal (raw only) / operational (seasonally adjusted) / unknown]

Proxy Signal Status (inter-survey indicator)
- Voluntary overtime: [positive / declining — by %]
- Unplanned absence: [normal / elevated — by %]
- Punch corrections: [normal / elevated]
- Shift cancellations: [normal / elevated]
- Inter-survey signal direction: [positive / stable / cautionary / high-risk]

Trajectory Projection
- Projected score at next survey cycle: [value] ± [range]
- Time to intervention threshold ([threshold]): [N cycles / calendar date] — or "not applicable — trend positive"
- Confidence: [high / medium / low — basis]

Burnout Risk Assessment
- Risk tier: [Critical / High / Elevated / Monitoring]
- Basis: [criteria met]
- Recovery timeline if intervention now: [N cycles to [tier]]

Team Risk Matrix (if multiple teams)
| Team | Score | Velocity | Proxy signals | Classification | Change from prior |
|---|---|---|---|---|---|
| [Team A] | [score] | [v] | [N negative] | [class] | [same/worsened/improved] |

Recommended Actions
- [Critical teams]: [action + urgency]
- [At-risk teams]: [action + timeline]
- [Watch teams]: [monitoring cadence]

Confidence Assessment
- Overall: [high / medium / low]
- Key caveat: [response rate / data points / seasonal uncertainty]
- Forecast valid through: [next survey cycle date]
- Re-run triggers: Mid-cycle wellbeing event, response rate change, business disruption
─────────────────────────────────────────────────────────
```
