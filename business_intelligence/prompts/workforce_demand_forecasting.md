# Workforce Demand Forecasting Prompt — Shift Demand, Coverage Requirements, and Staffing Projections

> **When to use this file:** When projecting how many shifts, hours, or employees will be needed in a future period. Always read `prompts/forecasting_methodology.md` before using this file — it governs the method selection, horizon limits, and output requirements that apply here.

---

## 1. Demand Forecasting Scope

Workforce demand forecasting in Effectime answers: **"How much workforce capacity will be needed in period T+N, and will current staffing be sufficient to meet it?"**

This is distinct from workforce planning (current-state analysis) and capacity gap forecasting (supply-side). Demand forecasting looks at the *volume* and *pattern* of work requirements driven by business activity, not at how many employees are available.

---

## 2. Demand Signal Identification

Before projecting demand, identify which signals drive it for the workspace. Demand drivers are workspace-specific — do not apply a generic demand driver model without confirming which drivers are active.

### Primary demand drivers (check which apply)

| Demand driver | Signal in Effectime | Typical pattern |
|---|---|---|
| Historical shift schedule volume | `shift_assignments` count per period | Most reliable baseline for stable workspaces |
| Headcount growth trajectory | `members` growth rate | Scales demand if workspace is growing |
| Seasonal business cycle | `shift_assignments` volume by month vs. prior year | Retail, hospitality, logistics workspaces |
| Customer contract obligations | Minimum coverage rules in `compliance_rules` | Fixed floor — demand cannot drop below this |
| Marketplace fill demand | `shift_marketplace_listings` volume | Reflects unmet internal demand spilled to marketplace |
| Operational event calendar | Known events (seasonal peaks, audits, expansions) | Must be supplied externally — not in Effectime data |

### Confirming which drivers are active

Drivers are active only if the relevant Effectime features are in use:
- Shift schedule volume is available if the workspace uses shift scheduling.
- Marketplace demand is available if the workspace uses the shift marketplace (requires Growth tier or above).
- Compliance-driven minimums require compliance rules to be configured.

Check the workspace's tier and feature configuration before including a driver in the model.

---

## 3. Demand Forecasting Methods by Workspace Maturity

Apply the method that matches the available data volume and workspace stability.

### Method D-1 — Historical average with seasonal adjustment
**Use when:** Workspace has 6+ months of shift schedule data, business activity is relatively stable.

Steps:
1. Compute average weekly shift count over the training window.
2. Apply the seasonal index from `prompts/seasonal_pattern_library.md` for the target period.
3. Apply headcount growth adjustment if the workspace grew > 15% during the training window.
4. Produce a point projection with ± 15% uncertainty band (high confidence) or ± 25% (medium confidence).

**Training window requirement:** 12 weeks minimum. 26 weeks preferred for seasonal accuracy.

### Method D-2 — Trend-adjusted projection
**Use when:** Workspace has a clear growth or contraction trend in shift volume over 8+ weeks.

Steps:
1. Compute the weekly shift count trend (slope in shifts/week).
2. Project the trend forward for N weeks.
3. Apply seasonal adjustment from `prompts/seasonal_pattern_library.md`.
4. Apply version-integrity check (trend must not span a version break).
5. Produce point projection with uncertainty band that widens by ±5% per additional week of horizon.

**Maximum horizon:** 6 weeks beyond the trend analysis window length ÷ 4. (8-week trend → 2-week max horizon.)

### Method D-3 — Compliance-floor anchored
**Use when:** The workspace has strict minimum coverage rules configured, making demand partially deterministic.

Steps:
1. Extract minimum coverage requirements from `compliance_rules`.
2. Use the compliance floor as the demand floor (demand cannot be lower than this).
3. Add historical above-floor demand as a variable component using Method D-1.
4. Project total demand = compliance floor + variable component.

This method produces narrower uncertainty bands on the floor component (deterministic) and standard uncertainty on the variable component.

### Method D-4 — Event-adjusted projection
**Use when:** A known future event will materially change demand (expansion, peak season, new contract, regulatory audit period).

Steps:
1. Build the baseline projection using Method D-1 or D-2.
2. Apply an event adjustment factor supplied by the workspace or inferred from prior-year event patterns.
3. Document the event adjustment as an assumption: "Assumption: [event] will increase/decrease shift demand by [N%] in [period] — Source: [workspace-supplied / prior-year comparison] — Sensitivity: ± [range] if event is larger/smaller than expected."

---

## 4. Demand-to-Headcount Conversion

Once shift demand is projected, convert to a headcount requirement for planning purposes:

**Required FTE = Projected weekly shift hours ÷ Effective hours per FTE per week**

Where:
- Projected weekly shift hours = Projected shift count × Average hours per shift.
- Effective hours per FTE = (Contracted weekly hours) × (1 − Historical absence rate).

**Important**: This conversion produces the *demand-implied* headcount, not a hiring recommendation. Compare against current headcount (from `prompts/workforce_planning.md`) to identify the gap.

---

## 5. Short-Term vs. Medium-Term Demand Forecasting

### Short-term (1–4 weeks)
- Method: D-1 or D-2 with recent data weighting (last 4 weeks weighted 2× vs. earlier weeks).
- Uncertainty: ± 10–20%.
- Primary use: Week-by-week scheduling decisions, marketplace listing volume planning.
- Version sensitivity: High — check for any release in the 2 weeks prior to the forecast start.

### Medium-term (5–12 weeks)
- Method: D-2 or D-4 with seasonal adjustment.
- Uncertainty: ± 20–35%.
- Primary use: Hiring pipeline timing, capacity investment decisions.
- Version sensitivity: Medium — check for major releases during the forecast horizon.

### Long-term (13+ weeks)
- Method: Seasonal projection only, anchored to the workspace's annual demand cycle.
- Uncertainty: ± 35–50%.
- Primary use: Strategic headcount planning, budget planning only.
- Caution: Do not use long-term demand forecasts for operational decisions. They are directional inputs, not operational plans.

---

## 6. Forecast Validation Protocol

Before distributing a demand forecast, validate it against the most recent actuals:

1. **Backtesting check**: Apply the same method to a prior period where actuals are known. What was the forecast error? If error > 25%, revisit the method or training window.
2. **Sanity check**: Does the projected demand make business sense given what is known about the workspace? A 40% demand spike projection requires a business explanation.
3. **Driver confirmation**: Are all demand drivers still active? (Has the workspace changed tier, removed scheduling, or changed compliance rule configuration?)
4. **Version confirmation**: Has the CHANGELOG introduced anything in the training window or forecast horizon that could alter shift volume metrics?

---

## 7. Output Format

```
Workforce Demand Forecast
─────────────────────────────────────────────────────────
[Forecast Master Block from forecasting_methodology.md]

Demand Driver Analysis
Active drivers: [list — confirm each is available for this workspace's tier/config]
Primary driver: [the one with most explanatory power]
Driver stability: [stable / changing — reason]

Forecast Method: [D-1 / D-2 / D-3 / D-4]
Training window: [start → end — N data points — version breaks: none / [entry]]
Seasonal adjustment: [pattern applied from seasonal_pattern_library.md — or "none applied — no documented pattern"]

Demand Projections
- Week T+1: [shift count] — [hours] — Uncertainty: ± [%]
- Week T+2: [shift count] — [hours] — Uncertainty: ± [%]
- Week T+4: [shift count] — [hours] — Uncertainty: ± [%]
- [Extend to horizon limit]

Headcount Conversion (if applicable)
- Projected demand FTE required: [N]
- Current headcount: [N]
- Projected gap: [N FTE surplus / deficit]

Backtesting Result
- Method applied to prior period: [period]
- Forecast error: [%] — Acceptable (< 25%) / Elevated (≥ 25%)
- Action if elevated: [method adjustment or extended training window]

Assumptions
- [Assumption 1] — Source: [X] — Sensitivity: [Y]

Forecast valid through: [date]
Re-run triggers: [new hire batch, tier change, version release affecting shift data, business event]
─────────────────────────────────────────────────────────
```
