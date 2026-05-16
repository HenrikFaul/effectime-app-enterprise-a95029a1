# Forecast Report Template — Standard Structure for All Effectime Predictive BI Outputs

> **How to use this template:** Every forecast produced under this BI system must embed the Forecast Master Block (Section 1) and complete the sections that apply to the forecast type. Do not omit sections — mark inapplicable ones explicitly. The presence of all sections is a quality signal: a forecast without an uncertainty range or a decay date is incomplete, not concise.

---

```
# [Metric / Domain] Forecast — [Period] — [Scope]

**Forecast type**: [Demand / Labor cost / Wellbeing trajectory / Turnover risk / Capacity-demand gap / Scenario model]
**Produced against**: CHANGELOG v[X.Y.Z] | [YYYY-MM-DD]
**Scope**: [workspace / team / tier — be explicit]
**Prepared by**: [AI session / analyst]

---

## 1. Forecast Master Block

Metric: [name + computation definition]
Forecast horizon: [N weeks — daily/weekly/monthly granularity]
Method: [trend extrapolation / seasonal projection / moving average / leading indicator / driver-based / scenario]
Training window: [YYYY-MM-DD → YYYY-MM-DD]
Data points in training: [N]
Version breaks in training window: [none — CHANGELOG reviewed / vX.Y.Z on [date] — window truncated to post-[date] data]

Point projection: [value or direction] at [end-of-horizon date]
Uncertainty range: [± X% / directional only — basis: high/medium/low confidence]
Confidence level: [high / medium / low]
  Basis for confidence: [data points, trend consistency, version integrity, seasonal clarity]

Decision informed: [the specific decision or action this forecast enables]
Forecast valid through: [date — typically horizon end or decay date]
Re-run triggers: [list — at minimum: version release affecting metric, anomaly in source metric, known business event]

---

## 2. Current State Baseline

[What is the metric's current value and trend direction? This is the "from here" anchor for the forecast.]

Current value: [value + unit]
Trend (past [N] periods): [direction + velocity]
Seasonal context: [current period vs. seasonal pattern — index applied or "no documented pattern"]
Data quality: [High / Medium / Low — reason if not High]

---

## 3. Projection Results

[The main forecast output. Tabulate or list the projected values for each period in the horizon.]

| Period | Projected value | Lower bound | Upper bound | Confidence |
|---|---|---|---|---|
| [T+1] | [value] | [value] | [value] | [H/M/L] |
| [T+2] | [value] | [value] | [value] | [H/M/L] |
| [T+4] | [value] | [value] | [value] | [H/M/L] |
| [T+8 — if in horizon] | [value] | [value] | [value] | [H/M/L] |

Confidence degrades as horizon extends. If uncertainty exceeds ± 40%, report as directional only beyond that point.

---

## 4. Key Threshold Analysis (if applicable)

[Identify the critical thresholds the metric may cross during the horizon — intervention points, compliance floors, risk tiers.]

| Threshold | Value | Projected crossing date | Confidence | Action triggered |
|---|---|---|---|---|
| Intervention threshold | [value] | [date or "not reached"] | [H/M/L] | [action] |
| Critical threshold | [value] | [date or "not reached"] | [H/M/L] | [action] |
| Compliance floor | [value] | [date or "not reached"] | [H/M/L] | [action — escalation] |

---

## 5. Assumptions Registry

[Every assumption must be documented here. An assumption is any value asserted rather than computed from historical data.]

| # | Assumption | Source | Sensitivity |
|---|---|---|---|
| 1 | [description] | [source — workspace-supplied / prior year / industry average / documented approximation] | ± [X%] change in forecast if wrong by [Y%] |
| 2 | [description] | [source] | [sensitivity] |

If no assumptions were required (pure trend extrapolation): state "No assumptions — pure trend extrapolation on verified training data."

---

## 6. Scenario Comparison (if scenario model)

[Complete this section only for scenario-based forecasts. For single-path forecasts, mark "Not applicable."]

[Reference `prompts/scenario_modeling.md` Section 4 for the comparison table structure.]

| Metric | Baseline | [Scenario 1 name] | [Scenario 2 name] |
|---|---|---|---|
| [Metric A] | [value] | [value ± %] | [value ± %] |
| [Cost implication] | [£] | [£ ± range] | [£ ± range] |

Recommended scenario: [name] — Basis: [metric outcome + risk-adjusted reasoning]
Conditions that change the recommendation: [key assumption thresholds]

---

## 7. Validation Evidence

[Has this forecast method been backtested? If yes, what was the error rate?]

Backtest period: [period where actuals are known]
Backtest forecast error: [%] — [acceptable < 25% / elevated ≥ 25%]
Action taken on elevated error: [method adjustment / extended training window / confidence downgraded]

If no backtest available: state "Method not backtested for this workspace. Confidence level set to medium maximum until first backtest is completed."

---

## 8. Cascade and Secondary Effects (if applicable)

[For gap forecasts, wellbeing trajectories, and scenarios with cascade risks. Mark "Not applicable" for simple single-metric forecasts.]

[Reference the cascade analysis from the relevant domain prompt.]

Primary projection outcome: [finding]
Secondary risk if primary continues: [risk + timeframe]
Tertiary risk if secondary triggers: [risk + timeframe]

---

## 9. Decision and Action Recommendations

Urgency tier: [Immediate / This week / Within 4 weeks / Monitor]

Recommended action: [specific, actionable — not "monitor" or "review"]
Owner: [role]
Deadline: [the date by which action must be initiated to prevent the projected outcome]
Fallback if action is delayed: [what to do if the recommended action cannot be taken by the deadline]

---

## 10. Forecast Governance Notes

CHANGELOG reviewed: [yes — no metric-affecting changes / yes — changes found — window truncated]
Data quality: [High / Medium / Low]
PII compliance: [if turnover risk — individual-level output authorization confirmed / team-level only]
Forecast decay date: [date — after which this forecast must not be used for decisions without re-running]
Archive location: [versioning/[filename].md if formally documented / in-session only if informal]
```
