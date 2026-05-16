# Forecasting Methodology Prompt — Core Framework for All Predictive Analytics in Effectime

> **When to use this file:** Before using any domain-specific forecasting prompt. This file establishes the rules, constraints, and responsibilities that govern all predictive work in this BI system. Read it first. Deviate from it never.

---

## 1. What Forecasting Is in This System

Forecasting in Effectime's BI system is **structured quantitative reasoning applied to historical patterns to estimate future values** — not machine learning, not predictive modelling with trained models, and not stochastic simulation.

The methods available here are:

| Method | When to use | Minimum data requirement |
|---|---|---|
| **Trend extrapolation** | A metric has a consistent direction over ≥ 8 periods | 8 data points, ≥ 70% directional consistency |
| **Seasonal index projection** | A metric follows a documented annual pattern | 2+ full annual cycles (reference: `prompts/seasonal_pattern_library.md`) |
| **Moving average extrapolation** | A metric is noisy but has a smoothed underlying trend | 12+ data points for a reliable moving average |
| **Leading indicator projection** | A confirmed leading indicator is at a threshold that historically precedes the outcome | Leading indicator relationship confirmed per `prompts/predictive_signals.md` protocol |
| **Driver-based projection** | The metric's future value depends on known future inputs (e.g., approved headcount plan, confirmed tier change) | Known future input values must be documented and sourced |
| **Scenario projection** | Multiple future states are plausible depending on a decision | Reference `prompts/scenario_modeling.md` |

**Methods that are NOT used here:**
- Statistical regression without verified driver relationships.
- Neural network or ML model outputs (no model inference available).
- Black-box confidence intervals without traceable computation.
- Forecasts based on fewer than 6 historical data points.

---

## 2. Forecasting Responsibility Rules

These are non-negotiable constraints on every forecast produced under this system.

### Rule 1 — Horizon discipline
Every forecasting method has a maximum reliable horizon:

| Method | Maximum horizon | Degradation past horizon |
|---|---|---|
| Trend extrapolation | 25% of the trend analysis window | Uncertainty grows quadratically — do not extend |
| Seasonal projection | One seasonal cycle forward | Structural changes make multi-cycle projections unreliable |
| Moving average | 3 periods forward | Smoothing effect loses predictive power beyond 3 periods |
| Leading indicator | Duration of documented lag | Signal has already been consumed by lag period |
| Driver-based | Duration of the known input | Cannot extend beyond the validity of the known input |

Produce no forecast that extends beyond its method's maximum horizon without stating that the extension is speculative and should not be used for decisions.

### Rule 2 — Confidence interval requirement
Every forecast must include an uncertainty range, not just a point estimate:

- **High confidence** (strong trend, sufficient data, no version breaks): ± 10–15% of the projected value.
- **Medium confidence** (moderate trend, borderline data, seasonal or version risk): ± 20–30%.
- **Low confidence** (weak trend, sparse data, confounded): State as directional only — "likely to increase / decrease" — do not produce a numeric estimate.

A point estimate without an uncertainty range is not a forecast. It is a guess presented as a forecast.

### Rule 3 — Training window version integrity
The historical data used to build a forecast (the "training window") must not span a version-induced metric shift. If the CHANGELOG shows a computation change, schema migration, or behavioral change affecting the metric during the training window, the window must be truncated to the post-change period.

Always state: "Training window: [start] → [end]. Version breaks in window: [none / version vX.Y.Z on date — window truncated to post-[date] data]."

### Rule 4 — Assumption transparency
Every driver-based and scenario-based forecast must list all assumptions explicitly. An assumption is any value or relationship that is asserted rather than computed from historical data.

Format: "Assumption: [description] — Source: [where this comes from] — Sensitivity: [how much the forecast changes if this assumption is wrong by X%]."

### Rule 5 — Forecast decay declaration
All forecasts have a decay date — the date after which the forecast should be re-run against more recent data. State it explicitly:

"Forecast valid through: [date]. Re-run if any of the following occur before that date: [list of trigger conditions — version release, anomaly in the metric, significant business event]."

### Rule 6 — No forecast without a purpose
Every forecast must be tied to a decision. State: "This forecast informs: [specific decision — what changes if the forecast shows X vs. Y]."

A forecast that is produced with no decision context is instrumentation noise. It will be looked at, forgotten, and not acted on.

---

## 3. Pre-Forecast Checklist

Run this before beginning any forecast:

- [ ] What is the exact metric being forecast? (Definition confirmed from repository source.)
- [ ] What is the forecast horizon? (Does it stay within method's maximum reliable horizon?)
- [ ] What is the training window? (Does it contain version breaks? Truncated if yes.)
- [ ] What method applies? (Minimum data requirement met?)
- [ ] Are all assumptions documented with sources?
- [ ] Is an uncertainty range computable or stated as directional?
- [ ] What decision does this forecast inform?
- [ ] What are the trigger conditions for re-running this forecast?
- [ ] What is the decay date?

If any item cannot be answered, the forecast is not ready to produce.

---

## 4. Domain Routing for Forecasting Tasks

| Forecasting question | Primary file | Supporting file |
|---|---|---|
| Forecast shift demand / coverage requirements | `prompts/workforce_demand_forecasting.md` | `prompts/seasonal_pattern_library.md` |
| Predict which employees are at departure risk | `prompts/turnover_risk_scoring.md` | `prompts/predictive_signals.md` |
| Project wellbeing score / burnout timeline | `prompts/wellbeing_trajectory_forecasting.md` | `prompts/predictive_signals.md` |
| Model what-if scenarios and decision impact | `prompts/scenario_modeling.md` | `prompts/financial_forecasting.md` |
| Forecast labor cost / overtime budget | `prompts/financial_forecasting.md` | `prompts/seasonal_pattern_library.md` |
| Project capacity vs. demand gap forward | `prompts/capacity_demand_gap_forecasting.md` | `prompts/workforce_demand_forecasting.md` |
| Apply seasonal patterns to any metric | `prompts/seasonal_pattern_library.md` | — |
| Forecast compliance score trajectory | `prompts/compliance_analytics.md` Section 5 | `prompts/predictive_signals.md` |

---

## 5. Version-Aware Forecasting Protocol

Before using any historical metric data for forecasting:

1. Open `CHANGELOG.md` and identify every version delivery during the proposed training window.
2. For each delivery, check whether it affected the metric's source table, computation, scope, or tier availability.
3. If a version change is found that altered the metric:
   - Truncate the training window to start from the day after the version change.
   - If the truncated window is too short for the minimum data requirement: state that the forecast cannot be produced reliably and recommend waiting until sufficient post-change data accumulates.
   - Document the version break and truncation in the forecast output.
4. If no version changes are found: confirm this explicitly in the forecast output ("CHANGELOG reviewed — no metric-affecting changes in training window").

---

## 6. Communicating Forecasts to Decision-Makers

### What to say
- The forecast value or direction.
- The uncertainty range or confidence level.
- The horizon (how far forward the forecast applies).
- The method used.
- The top assumption (the one that, if wrong, most changes the forecast).
- The decision this forecast informs.
- The trigger conditions for revisiting.

### What not to say
- "We predict X will happen." → Say "The current trajectory projects X, with a range of Y to Z."
- "Our model shows..." → Say "Based on [N] weeks of trend data using [method]..."
- "This is our forecast for the quarter." → Say "This projection is reliable through [date]. Re-run if [condition] occurs."
- A number without uncertainty. → Always include a range.

---

## 7. Output Format (Master Forecast Block)

Every domain-specific forecast prompt will produce output that includes this block:

```
Forecast Master Block
─────────────────────────────────────────────────────────
Metric: [name + definition]
Forecast horizon: [N periods — daily/weekly/monthly]
Method: [trend extrapolation / seasonal / moving average / leading indicator / driver-based / scenario]
Training window: [start → end] — Version breaks: [none / vX.Y.Z on date — truncated]
Data points in training: [N]

Point projection: [value or direction] at [end of horizon date]
Uncertainty range: [± X% or directional only — basis stated]
Confidence level: [high / medium / low — criteria]

Assumptions (driver-based and scenario only):
- [Assumption 1] — Source: [X] — Sensitivity: [Y]
- [Assumption 2] — Source: [X] — Sensitivity: [Y]

Decision informed: [specific decision this forecast supports]
Forecast valid through: [date]
Re-run triggers: [list of conditions]
─────────────────────────────────────────────────────────
```
