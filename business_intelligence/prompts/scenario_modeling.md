# Scenario Modeling Prompt — What-If Analysis, Decision Impact Modeling, and Scenario Comparison

> **When to use this file:** When a decision must be evaluated before it is made, when multiple future paths are plausible and the BI question is "what happens under each?", or when quantifying the cost and benefit of a proposed operational change. Always read `prompts/forecasting_methodology.md` first — scenario modeling is a form of driver-based projection and inherits all its constraints.

---

## 1. What Scenario Modeling Is in This System

Scenario modeling is **structured what-if analysis**: define alternative futures (scenarios), project Effectime metrics under each, compare the outcomes, and provide a decision basis for choosing between them.

It is not simulation. It is not Monte Carlo analysis. It is not machine learning. It is disciplined application of known relationships between decisions and metrics, with explicit assumptions and bounded uncertainty.

**When to use scenarios vs. single-path forecasting:**
- Use single-path forecasting when the future is primarily determined by current trend continuation.
- Use scenario modeling when a decision (inside or outside the platform) will materially change the trajectory.
- A scenario model without a real decision being considered is analysis theater — do not produce it without a clearly stated decision.

---

## 2. Scenario Definition Protocol

### Step 1 — Define the decision
State the specific decision being modeled. Not "what if things change" but:
- "Should we increase marketplace incentive rates by 15% or 25%?"
- "What is the impact of adding 3 FTE vs. 5 FTE in the next hire batch?"
- "What happens to compliance score if we defer rule configuration to next quarter?"
- "What is the cost difference between filling peak shifts via overtime vs. marketplace?"

### Step 2 — Define the baseline scenario
The baseline is not the "do nothing" scenario — it is the "continue current trajectory" scenario. Compute the baseline using the appropriate single-path forecasting method from `prompts/forecasting_methodology.md`.

The baseline must use the same training window, seasonal adjustment, and version integrity rules as any other forecast.

### Step 3 — Define the alternative scenarios
Limit to 2–3 alternative scenarios per model. More than 3 produces decision paralysis, not decision support.

For each scenario, state:
- **Scenario name**: Brief, descriptive. Not "Scenario A/B/C" — use descriptive names like "Incentive boost", "Minimum hire", "Aggressive hire."
- **Decision input**: What changes compared to baseline? (What is the intervention?)
- **Timing**: When does the intervention take effect? When do effects begin to appear?
- **Mechanism**: How does the intervention change the metric? (What is the causal chain?)
- **Key assumption**: The single most important assumption in this scenario. If it is wrong, how does the output change?

### Step 4 — Define the comparison metrics
Choose 2–5 metrics that the decision will materially affect. Do not model everything — model what matters for the decision.

For each metric: state the direction in which each scenario moves it, the magnitude of the expected change, and the confidence level.

---

## 3. Scenario Impact Modeling by Decision Type

### Decision type: Staffing level change (hire N more / reduce N)
Primary metrics affected: Coverage ratio, overtime rate, labor cost, shift fill rate.

**Impact modeling chain:**
1. Compute the additional effective hours added (or removed) per week: N new FTE × (Contracted hours × (1 − Historical absence rate)).
2. Apply the additional capacity to the coverage ratio: New coverage ratio = (Current capacity + Additional capacity) ÷ Demand.
3. Model the overtime rate reduction: As coverage improves, demand for overtime drops. Rule of thumb: each 5% coverage improvement reduces overtime rate by approximately 2–4%. State this as an assumption.
4. Model the net labor cost change: (Additional FTE labor cost) − (Overtime reduction savings) = Net cost change.

**Time lag:** New hires are not productive on day 1. Apply an onboarding ramp: 30–50% effective capacity in weeks 1–4, 75% in weeks 5–8, 100% from week 9. Reflect this in the phased coverage improvement.

### Decision type: Marketplace incentive rate change
Primary metrics affected: Marketplace fill rate, marketplace fill cost, overtime rate, coverage ratio.

**Impact modeling chain:**
1. Historical acceptance rate vs. incentive premium relationship: Reference workspace-specific history or use the documented approximation from `prompts/financial_analytics.md` Section 4 — "+22% acceptance rate per 15% premium increase."
2. Compute projected fill rate at new incentive level.
3. Apply fill rate improvement to coverage ratio.
4. Compute overtime reduction from improved fill rate (same logic as staffing change above).
5. Net cost: (Incentive cost increase per filled shift) − (Overtime reduction savings) = Net cost change.

### Decision type: Compliance rule configuration change
Primary metrics affected: Compliance score, violation rate, audit trail completeness, WTD breach rate.

**Impact modeling chain:**
1. Identify the new rules being added or existing rules being changed.
2. Apply to the workspace's current violation pattern: will the new rules capture violations currently undetected? Will existing violations decrease due to rule clarification?
3. Model compliance score change: Current score × (New passing evaluations ÷ Total evaluations after change).
4. Model WTD-specific impact if the rule change affects working time.

Note: Compliance rule changes have a knowledge lag — employees take 2–4 weeks to acknowledge new rules and adjust behavior. Model compliance score improvement starting from week 3 post-configuration, not week 1.

### Decision type: Shift schedule restructure
Primary metrics affected: Shift adherence, overtime rate, absence rate, wellbeing score.

**Impact modeling chain:**
1. Model the coverage impact of the new schedule structure (same as staffing change).
2. Assess whether the new structure reduces or increases scheduling pressure (split shifts, unsociable hours, reduced flexibility).
3. Apply leading indicator logic from `prompts/predictive_signals.md`: if new structure increases scheduling pressure, project wellbeing score impact with 2–4 week lag.
4. Model the WTD compliance impact if the restructure changes shift lengths or rest periods.

### Decision type: Tier upgrade (Growth → Enterprise)
Primary metrics affected: Feature adoption rate, integration health, agile metric availability.

**Impact modeling chain:**
1. Identify the features unlocked by the tier upgrade.
2. Apply Pattern PA-01 from `prompts/seasonal_pattern_library.md` for post-release adoption spike and normalization.
3. Model the integration health improvement if the enterprise tier provides better sync options.
4. Do not model financial impact from tier cost change — that is outside Effectime's data scope.

---

## 4. Scenario Comparison Framework

Produce a scenario comparison table for every scenario model:

| Metric | Baseline | Scenario 1: [name] | Scenario 2: [name] | Scenario 3: [name] |
|---|---|---|---|---|
| [Metric A] | [value] | [value ± uncertainty] | [value ± uncertainty] | [value ± uncertainty] |
| [Metric B] | [value] | [value ± uncertainty] | [value ± uncertainty] | [value ± uncertainty] |
| [Cost implication] | [£] | [£ ± range] | [£ ± range] | [£ ± range] |
| [Timeline to effect] | — | [N weeks] | [N weeks] | [N weeks] |
| [Key risk] | — | [risk] | [risk] | [risk] |

### Uncertainty stacking warning
When a scenario involves multiple sequential assumptions (e.g., "hire 3 people → improve coverage → reduce overtime → reduce wellbeing risk"), uncertainty compounds at each step. A high-confidence step 1 and a medium-confidence step 2 produces a medium-to-low confidence outcome. State the compound confidence explicitly.

---

## 5. Decision Recommendation Framework

After producing the scenario comparison, apply this framework to produce a recommendation:

1. **Identify the dominant scenario**: Which scenario produces the best outcome on the 2–3 metrics that matter most for the decision?

2. **Identify the risk-adjusted scenario**: Which scenario has the best outcome under the most likely assumption failure? (If the key assumption in Scenario 1 is wrong by 20%, does it still beat Scenario 2?)

3. **Identify the minimum viable scenario**: What is the least expensive / lowest-risk intervention that still achieves the threshold requirement for the key metrics?

4. **State the recommendation**: "Based on this model, [scenario] is recommended because [reason tied to metric outcomes]. This recommendation holds unless [key assumption] differs from the modeled value by more than [threshold]. In that case, [alternative scenario] should be reconsidered."

---

## 6. Output Format

```
Scenario Model
─────────────────────────────────────────────────────────
Decision being modeled: [exact decision statement]
CHANGELOG version: [version]
Scope: [workspace / team / tier]
Model date: [YYYY-MM-DD]
Forecast horizon: [N weeks from decision implementation]

Baseline Scenario
- Method: [forecasting method used]
- Training window: [start → end — version breaks: none / [entry]]
- Baseline trajectory: [metric values over horizon]

Scenario Definitions
Scenario 1 — [Name]:
- Intervention: [what changes]
- Timing: [when effect begins]
- Mechanism: [causal chain]
- Key assumption: [most important assumption] — Sensitivity: [impact if wrong by X%]

Scenario 2 — [Name]: [same structure]
Scenario 3 — [Name]: [same structure — if applicable]

Scenario Comparison Table
[Table per Section 4]

Compound Uncertainty Assessment
- Confidence: Baseline [H/M/L] | S1 [H/M/L] | S2 [H/M/L]
- Uncertainty stacking: [any multi-step assumptions noted]

Recommendation
- Recommended scenario: [name]
- Basis: [metric outcomes + risk-adjusted reasoning]
- Conditions that change the recommendation: [key assumption thresholds]
- Minimum viable alternative: [name + conditions]

Assumptions Registry
- [Assumption 1] — Scenario: [which] — Source: [X] — Sensitivity: [Y]
- [Assumption 2] — Scenario: [which] — Source: [X] — Sensitivity: [Y]

Forecast valid through: [date]
Re-run triggers: Decision not implemented on assumed timeline, key assumption revised, version release affecting modeled metrics
─────────────────────────────────────────────────────────
```
