# Financial Forecasting Prompt — Labor Cost Projection, Overtime Budget, and Payroll Trend Analysis

> **When to use this file:** When projecting future labor costs, overtime budget requirements, payroll correction trends, or marketplace fill costs. Always read `prompts/forecasting_methodology.md` first. For current-period financial analysis (not forecasting), use `prompts/financial_analytics.md`.

---

## 1. Financial Forecasting Scope

Financial forecasting in Effectime is limited to **workforce cost inputs** — not revenue, not profit. The forecasting domain covers:

- Total labor cost projection (based on projected shift demand and contracted rates).
- Overtime cost trajectory and budget risk assessment.
- Payroll correction cost trend (admin burden and indirect financial impact).
- Marketplace fill cost projection (premium rates, average listing-to-fill cost).
- Budget variance trajectory (are we tracking toward end-of-period over- or under-spend?).

Financial forecasting requires cost rate data. If contracted hourly rates, overtime multipliers, or marketplace premium rates are not available in the workspace's Effectime configuration, the forecast must substitute assumptions and state them explicitly with sensitivity analysis.

---

## 2. Labor Cost Projection Protocol

### Step 1 — Establish the cost base
Identify the cost inputs for the projection:

| Input | Source | If unavailable |
|---|---|---|
| Contracted hourly rate per role | `member_contracts` | Assumption required — state average rate assumption |
| Overtime multiplier | `overtime_rules` | EU statutory minimum: 1.25× for most markets |
| Scheduled shift hours per period | `shift_assignments` projected using `prompts/workforce_demand_forecasting.md` | Demand forecast required first |
| Historical actual vs. scheduled variance | `clock_events` vs. `shift_assignments` | Compute from last 8 weeks of actuals |

### Step 2 — Project scheduled labor cost
Scheduled labor cost projection = Projected shift hours (from demand forecast) × Weighted average contracted rate

Apply the scheduled-to-actual variance rate from history:
Actual cost projection = Scheduled cost projection × (1 + historical variance rate)

Where variance rate = (Historical actual hours − scheduled hours) ÷ scheduled hours, averaged over training window.

### Step 3 — Project overtime cost
Overtime cost is the highest-variance component. Use this model:

Projected overtime hours = Total actual hours projection × Historical overtime rate (as % of total hours)

Apply Pattern FC-01 from `prompts/seasonal_pattern_library.md` for period-end effects.

Overtime cost = Projected overtime hours × (Base rate × Overtime multiplier − Base rate)

State the overtime rate assumption and its seasonal index explicitly.

### Step 4 — Project marketplace fill cost
If the workspace uses the shift marketplace:

Projected marketplace cost = (Projected unfilled shifts × Historical marketplace acceptance rate ÷ 100) × Average fill cost per shift

Average fill cost per shift = Base hourly rate × Average shift length × (1 + Marketplace premium rate)

Note: Marketplace costs accelerate in low-availability periods (summer, holidays) per Pattern FC-03.

### Step 5 — Budget variance trajectory
If a period budget exists:

Cumulative spend to date ÷ Total period budget × (Period days elapsed ÷ Total period days) = Budget burn rate index

- Index = 1.00: Spending exactly on pace.
- Index > 1.10: Trending to overspend by ≥ 10%. Alert.
- Index > 1.20: Trending to overspend by ≥ 20%. Escalation recommended.
- Index < 0.90: Trending to underspend — check for hidden deferred costs (corrections, marketplace) that appear later.

Project end-of-period spend: (Cumulative to date ÷ Days elapsed) × Total period days.

---

## 3. Overtime Budget Risk Assessment

Overtime is the primary source of financial variance in Effectime workspaces. Run this assessment whenever overtime rate exceeds 12%:

### Overtime driver classification

| Driver | Signal | Financial implication |
|---|---|---|
| Structural shortage | Consistent overtime over 4+ weeks, flat trend | Budget overrun will compound — headcount action needed |
| Seasonal spike | Overtime aligns with Pattern AT-02 or FC-01 | Budgetable — apply seasonal reserve |
| Absence-driven | Overtime spikes correlate with absence rate spikes | Addressable via absence management |
| Schedule inefficiency | Overtime concentrated at period-end, not week-end | Scheduling redesign will reduce without headcount change |
| Compliance-driven | Overtime required to meet minimum coverage rules | Structural — only resolvable by hiring or rule reconfiguration |

For each driver, quantify: "If this driver were removed, overtime rate would decrease by approximately [N%], saving approximately [£X] per period."

### Overtime trajectory projection

Apply Method D-2 (trend-adjusted) from `prompts/workforce_demand_forecasting.md` to the overtime rate time series. State maximum horizon (typically 6 weeks for a medium-term overtime trend). Apply Period FC-01 seasonal adjustment.

---

## 4. Payroll Correction Cost Trend

Payroll correction rate trending upward signals increasing administrative burden and payroll risk. Quantify the financial impact:

**Correction admin cost** = Correction count × Average admin time per correction × HR cost per hour

**Payroll error financial exposure** = Correction count × Average correction value × Probability that uncorrected errors are not caught in approval cycle

This second component is an assumption-heavy estimate. State it as a risk exposure estimate, not a confirmed cost.

**Correction trend projection**: Apply Method D-1 (historical average) with trailing 4-week weighting. If correction rate is declining, project forward to confirm whether it will return to baseline within the current period.

---

## 5. Forecast Horizon and Uncertainty by Component

| Component | Maximum horizon | Typical uncertainty |
|---|---|---|
| Scheduled labor cost | 8 weeks (demand forecast dependent) | ± 15–25% |
| Overtime cost | 6 weeks | ± 20–35% |
| Marketplace fill cost | 4 weeks | ± 25–40% |
| Payroll correction admin cost | 4 weeks | ± 30–50% |
| Budget variance trajectory | End of current period | ± 10–20% of projected variance |

Financial forecasts beyond these horizons must be labeled "strategic estimate — not for budget commitments" and widened to ± 50% or more.

---

## 6. Version Check for Financial Forecasting

Schema changes that affect financial forecasting reliability:
- Changes to `clock_events` computation (affects actual hours base).
- Changes to `overtime_rules` logic (affects overtime rate computation).
- Changes to `shift_assignments` or `shift_marketplace_listings` (affects projected demand).
- Changes to `member_contracts` structure (affects rate data availability).

Check CHANGELOG for any of these in the training window. A computation change to `clock_events` invalidates the historical variance rate and requires recalibration from post-change data.

---

## 7. Output Format

```
Financial Forecast
─────────────────────────────────────────────────────────
[Forecast Master Block from forecasting_methodology.md]

Cost Base
- Rate source: [member_contracts / assumed average — state value]
- Overtime multiplier: [rate — source: overtime_rules / assumed EU statutory minimum]
- Demand projection source: [workforce_demand_forecasting.md run / historical average]
- Historical actual/scheduled variance: [%] over training window

Labor Cost Projection
- Period: [forecast period]
- Projected scheduled cost: [£/currency value] ± [%]
- Projected actual cost: [£/currency value] ± [%]
- vs. Prior period: [+/- %]
- vs. Budget (if available): [+/- %]

Overtime Cost Projection
- Projected overtime rate: [%] of total hours
- Seasonal adjustment applied: [Pattern FC-01 — index [value] / not applied]
- Projected overtime cost: [£] ± [%]
- Overtime driver: [structural / seasonal / absence-driven / scheduling / compliance]
- Driver intervention saving: [£] if driver is addressed

Marketplace Fill Cost Projection (if applicable)
- Projected unfilled shifts: [N]
- Projected marketplace cost: [£] ± [%]
- Seasonal adjustment: [Pattern FC-03 — index [value] / not applied]

Budget Variance Trajectory (if budget known)
- Current burn rate index: [value] — Status: [on-pace / overspending / underspending]
- Projected end-of-period spend: [£]
- Projected variance: [+/- £] ([+/- %] of budget)
- Escalation required: [yes — [threshold crossed] / no]

Payroll Correction Trend (if applicable)
- Current correction rate: [%] — Trend: [stable / rising / declining]
- Projected correction rate in [N weeks]: [%]
- Estimated admin cost: [£/period] — Confidence: [low — assumption-heavy]

Assumptions
- [Assumption 1] — Source: [X] — Sensitivity: [Y]
- [Assumption 2] — Source: [X] — Sensitivity: [Y]

Forecast valid through: [date]
Re-run triggers: Overtime spike, marketplace fill rate change, version release affecting cost computation, budget revision
─────────────────────────────────────────────────────────
```
