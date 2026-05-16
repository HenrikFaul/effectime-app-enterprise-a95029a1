# Capacity-Demand Gap Forecasting Prompt — Forward-Looking Supply vs. Demand Projection

> **When to use this file:** When projecting whether the workforce will have sufficient capacity to meet future demand — not just today, but in N weeks. Combines the demand-side projection from `prompts/workforce_demand_forecasting.md` with the supply-side trajectory from `prompts/workforce_planning.md`. Always read `prompts/forecasting_methodology.md` first.

---

## 1. Why Gap Forecasting Is a Distinct Discipline

Current-state capacity analysis (`prompts/workforce_planning.md`) answers: "Is there a gap right now?"

Demand forecasting (`prompts/workforce_demand_forecasting.md`) answers: "What will demand look like in N weeks?"

Capacity-demand gap forecasting answers: **"Will capacity be sufficient to meet demand at each future point in the horizon? And if not, when does the gap open, how large does it get, and what actions close it before it becomes critical?"**

This is the highest-value predictive output for workforce operations because it converts reactive understaffing management into proactive planning.

---

## 2. Inputs Required

Gap forecasting requires three inputs. If any are missing, the forecast quality degrades and must be disclosed:

| Input | Source | Quality impact if missing |
|---|---|---|
| Demand projection (N weeks forward) | `prompts/workforce_demand_forecasting.md` output | Cannot produce gap forecast without this — required |
| Current supply capacity | `prompts/workforce_planning.md` effective capacity computation | Can use headcount as proxy but uncertainty widens to ± 30% |
| Supply trajectory (known changes) | Confirmed hires, departures, leave schedule | Without this, forecast assumes static supply — may significantly misstate gap |

---

## 3. Gap Forecasting Protocol

### Step 1 — Establish the supply trajectory

Supply is not static over a forecast horizon. Model supply as a time series, not a point estimate:

**Supply at time T** = Current effective capacity + Incoming additions (hired, returning from leave) − Outgoing reductions (confirmed departures, planned leave, predicted absence)

For each week in the horizon:
- **Confirmed hires**: Add to supply on their contracted start date. Apply onboarding ramp (50% effective weeks 1–4, 75% weeks 5–8, 100% from week 9).
- **Confirmed departures**: Remove from supply on their last working day.
- **Planned leave**: Remove the leave hours from supply for the leave period.
- **Predicted absence**: Apply historical absence rate (and seasonal index from `prompts/seasonal_pattern_library.md` Pattern AT-01) to the remaining workforce.

If confirmed future hires or departures are not available in Effectime data: assume static supply and widen uncertainty to ± 25%. State: "Supply trajectory assumes no headcount changes. Model should be updated when confirmed hiring or departure data is available."

### Step 2 — Establish the demand trajectory

Use the output from `prompts/workforce_demand_forecasting.md`. Ensure the demand forecast uses the same time horizon and granularity as the supply trajectory.

If the demand forecast was produced under a different CHANGELOG version than the current one: rerun before using in a gap model.

### Step 3 — Compute the gap at each forecast point

For each period in the horizon:

**Gap** = Supply[T] − Demand[T]

Where:
- Gap > 0: Surplus capacity. Risk: over-rostering cost, potential idle capacity. Monitor for scheduling efficiency.
- Gap = 0 to −10%: At-risk. One absence or departure creates a coverage deficit.
- Gap −10% to −20%: Operational gap. Overtime or marketplace required to fill.
- Gap < −20%: Critical. Service delivery or compliance at risk. Immediate escalation.

### Step 4 — Identify the gap inflection point

The inflection point is the first period where gap crosses from positive to negative, or from negative to critical.

State: "The at-risk threshold is projected to be crossed in week T+[N] ([approximate date]). The critical threshold is projected to be crossed in week T+[M] ([approximate date]) if no action is taken."

The inflection point is the decision trigger — it defines the deadline by which an intervention must be initiated (accounting for lead times: hiring takes N weeks, marketplace incentive changes take 1–2 weeks, schedule restructuring takes 1–4 weeks).

### Step 5 — Compute the intervention lead time window

For each gap-closing intervention option, compute whether there is sufficient lead time:

| Intervention | Typical lead time | Closes gap by |
|---|---|---|
| Marketplace incentive increase | 1–2 weeks | Small gaps (< 10%) |
| Schedule restructure | 2–4 weeks | Efficiency-driven gaps |
| Temporary agency / cover | 1–3 weeks | Medium gaps (10–20%) |
| Hire (new permanent FTE) | 6–12 weeks from decision to productive | Structural gaps (> 20%) |
| Compliance rule adjustment (reduce minimum coverage) | 2–4 weeks (config + acknowledgement) | Compliance-driven gaps |

If the inflection point is closer than the lead time of the appropriate intervention: escalate immediately. The window to prevent the gap has passed or is closing.

---

## 4. Gap Forecast Under Uncertainty

Produce three gap trajectories:

**Pessimistic scenario**: Demand runs at the upper end of uncertainty, supply at the lower end (higher absence rate, slower onboarding ramp).

**Central scenario**: Demand and supply at central projection values.

**Optimistic scenario**: Demand at lower end of uncertainty, supply at upper end (lower absence rate, faster onboarding ramp).

Report: "Under pessimistic assumptions, the critical threshold is reached by [date]. Under central assumptions, by [date]. Under optimistic assumptions, [no critical gap / by [date]]."

This range tells decision-makers the urgency: if the pessimistic date is in 2 weeks and the optimistic date is in 8 weeks, the intervention window under pessimistic assumptions has already closed.

---

## 5. Cascade Effects: When Gap Triggers Secondary Risks

A capacity-demand gap does not produce only a coverage problem. Model the cascade:

| Primary gap effect | Secondary risk | Tertiary risk |
|---|---|---|
| Coverage deficit | Overtime spike | WTD breach risk (if overtime crosses limits) |
| Overtime spike | Labor cost overrun | Financial escalation |
| Overtime sustained > 4 weeks | Wellbeing score decline (from `prompts/predictive_signals.md`) | Turnover risk increase |
| Understaffing visible to employees | Voluntary overtime acceptance decline | Gap worsens further |
| Marketplace fill failure | Service delivery gap | Compliance breach (if coverage minimums not met) |

State the cascade chain explicitly when a critical gap is projected: "A gap of > 20% sustained for 4 weeks carries the following cascade risks: [chain]."

---

## 6. Minimum Viable Coverage Analysis

For workspaces with compliance-defined coverage minimums, compute the minimum viable supply level:

**Minimum viable FTE** = (Compliance-mandated minimum shift hours per period) ÷ (Effective hours per FTE per period)

Compare to projected supply trajectory to identify when — if ever — projected supply drops below the compliance floor. A supply drop below the compliance floor is not just an operational gap — it is a regulatory event.

---

## 7. Output Format

```
Capacity-Demand Gap Forecast
─────────────────────────────────────────────────────────
[Forecast Master Block from forecasting_methodology.md]

Inputs
- Demand source: [workforce_demand_forecasting.md — method and version]
- Supply base: [current effective capacity — hours/week]
- Supply trajectory inputs: [confirmed hires: N, confirmed departures: N, planned leave: N hours — or "static supply assumed"]
- Absence rate applied: [%] — Pattern: [AT-01 seasonal adjustment / unadjusted]

Gap Projection by Period

| Period | Supply (hours) | Demand (hours) | Gap (hours) | Gap % | Status |
|---|---|---|---|---|---|
| Week T+1 | [S] | [D] | [G] | [%] | [Surplus/At-risk/Gap/Critical] |
| Week T+2 | [S] | [D] | [G] | [%] | [status] |
| Week T+4 | [S] | [D] | [G] | [%] | [status] |
| Week T+8 | [S] | [D] | [G] | [%] | [status] |

Gap Inflection Points
- At-risk threshold crossed: [week T+N / date] — or "not reached in horizon"
- Critical threshold crossed: [week T+N / date] — or "not reached in horizon"

Uncertainty Scenarios
| Scenario | At-risk date | Critical date |
|---|---|---|
| Pessimistic | [date] | [date] |
| Central | [date] | [date] |
| Optimistic | [date or "not reached"] | [date or "not reached"] |

Intervention Lead Time Analysis
- Gap type: [structural / seasonal / absence-driven / compliance-driven]
- Recommended intervention: [marketplace / schedule / temporary cover / hire]
- Required decision by: [date — inflection date minus lead time]
- Lead time available: [N weeks — sufficient / insufficient]

Compliance Floor Check
- Minimum viable supply: [FTE] — [hours/week]
- Supply below compliance floor: [never / week T+N — regulatory event]

Cascade Risk Assessment
- Primary: [coverage deficit level]
- Secondary: [overtime / cost / wellbeing risks]
- Tertiary: [WTD breach / turnover / marketplace spiral — if applicable]

Recommended Actions (by urgency)
- Immediate (if gap already critical): [action]
- This week (if inflection < 2 weeks): [action]
- Within 4 weeks (if inflection 2–6 weeks out): [action]
- Monitor (if inflection > 6 weeks): [monitoring cadence]

Confidence Assessment
- Supply trajectory: [high — confirmed changes / medium — partial / low — static assumption]
- Demand forecast: [confidence from demand forecast]
- Overall: [combined — worst of the two]
- Forecast valid through: [N weeks or inflection date, whichever is sooner]
- Re-run triggers: Confirmed hire or departure change, overtime spike, version release, demand inflection
─────────────────────────────────────────────────────────
```
