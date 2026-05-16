# Financial Analytics Prompt — Labor Cost, Payroll Accuracy, and Financial KPI Interpretation

> **When to use this file:** When analyzing labor cost efficiency, payroll accuracy, shift marketplace economics, overtime budget variance, or any metric with a direct financial value that requires cost-aware interpretation.

---

## 1. Financial BI Principles for Effectime

Effectime's financial analytics domain centers on workforce cost — not revenue. The platform manages labor cost inputs (time, shifts, corrections, overtime) that feed into payroll. It does not directly manage revenue, pricing, or P&L.

**The financial BI question in Effectime is always**: "Is workforce cost being incurred as planned, and is the cost per unit of work efficient?"

Financial metrics must be interpreted against:
- Planned cost (budget or target, if defined in workspace configuration).
- Prior period cost (WoW, MoM, or period-over-period).
- Unit cost (cost per shift, cost per hour, cost per headcount unit).

Do not present gross cost figures without a comparison baseline. A £50,000 monthly labor cost is meaningless without knowing whether the budget is £45,000 or £60,000.

---

## 2. Effectime Financial Metric Catalog

### 2.1 Labor Cost Metrics

| Metric | Definition | Source | Polarity |
|---|---|---|---|
| Total scheduled labor cost | Sum of (scheduled hours × contracted hourly rate) for all shifts in period | `shift_assignments` × `member_contracts` | Neutral — compare to budget |
| Actual labor cost | Sum of (clocked hours × contracted hourly rate) for all completed shifts | `clock_events` × `member_contracts` | Neutral — compare to scheduled |
| Overtime cost | Sum of hours clocked above contracted threshold × overtime rate multiplier | `clock_events` × `overtime_rules` | Lower = better (when unplanned) |
| Absence cost | Scheduled hours not worked × contracted rate (direct cost of coverage gaps) | `shift_assignments` — `clock_events` | Lower = better |
| Labor cost variance | Actual labor cost − Scheduled labor cost | Computed | Closer to 0 = better |
| Labor cost per shift | Total actual labor cost ÷ number of completed shifts | Computed | Lower = better (efficiency) |
| Labor cost as % of budget | Actual labor cost ÷ budgeted labor cost × 100% | Requires budget configuration | Target: 95–105% |

### 2.2 Payroll Accuracy Metrics

| Metric | Definition | Source | Polarity |
|---|---|---|---|
| Payroll correction rate | Count of manual corrections ÷ total payroll line items × 100% | `clock_correction_events` ÷ `clock_events` | Lower = better |
| Correction volume | Total count of manual clock corrections in period | `clock_correction_events` | Lower = better |
| Correction rate by team | Payroll correction rate segmented by team | Segmented query | Lower = better |
| Rounding event rate | Count of rounding adjustments ÷ total clock events | `clock_events` where `rounding_applied = true` | Monitor — high rate may indicate policy issue |
| Late payroll submission rate | Count of workspace submissions past payroll deadline ÷ total workspaces | `payroll_submission_events` | Lower = better |

### 2.3 Shift Marketplace Economics

| Metric | Definition | Source | Polarity |
|---|---|---|---|
| Marketplace fill rate | Shifts filled via marketplace ÷ shifts posted to marketplace × 100% | `shift_marketplace_listings` | Higher = better |
| Average listing age at fill | Average hours from listing creation to acceptance | `shift_marketplace_listings` | Lower = better |
| Unfilled shift cost | Unfilled shift hours × estimated cost of last-minute cover or absence | Computed | Lower = better |
| Listing acceptance rate by worker | Per-worker acceptance ÷ listing views | `shift_marketplace_listings` × `member_actions` | Monitor for distribution |

---

## 3. Financial Analysis Protocol

### Step 1 — Establish the cost basis

Before analyzing any financial metric:
- Confirm whether actual cost, scheduled cost, or budgeted cost is being analyzed.
- Confirm the rate source: contracted hourly rate, overtime multiplier, and whether these are current or historic rates.
- Confirm the period and whether it is a complete period. An incomplete current month should not be compared to complete prior months without prorating.

### Step 2 — Compute cost variance

For every cost metric, compute:
- **Absolute variance**: Actual − Planned (or Actual − Prior Period).
- **Relative variance**: Variance ÷ Planned × 100%.
- **Direction**: Over budget / under budget / on track.
- **Driver isolation**: Is the variance driven by volume (more/fewer shifts), rate (higher/lower contracted rates), or efficiency (overtime, corrections)?

### Step 3 — Decompose variance by driver

A labor cost variance has three possible drivers:

| Driver | Question | Source |
|---|---|---|
| Volume variance | Were more or fewer hours/shifts worked than planned? | `shift_assignments` count vs. plan |
| Rate variance | Were hours paid at higher or lower rates than contracted? | `clock_events` rate vs. `member_contracts` rate |
| Efficiency variance | Was overtime, correction, or unplanned cost incurred? | `clock_correction_events`, overtime hours |

State which driver accounts for the largest portion of the variance before drawing conclusions.

### Step 4 — Payroll accuracy assessment

High payroll correction rates indicate systematic problems, not random errors. When correction rate exceeds 5% in a period:
- Segment by team: Is it concentrated or distributed?
- Segment by manager: Does correction rate correlate with a specific approver?
- Segment by shift type: Are corrections concentrated on specific shift patterns?
- Check CHANGELOG for any recent change to clock event logic, rounding rules, or correction workflows.

### Step 5 — Version check for financial metrics

Financial metrics are sensitive to schema changes. Check:
- Any migration affecting `clock_events`, `shift_assignments`, `clock_correction_events`, or overtime computation tables.
- Any edge function change to payroll aggregation or cost computation logic.
- Any CHANGELOG entry mentioning "payroll", "clock", "rounding", or "correction" in the analysis period.

---

## 4. Financial KPI Interpretation Rules

**Never interpret a cost figure without a unit denominator.** "£10,000 in overtime cost" is meaningless. "£10,000 in overtime cost representing 8.3% of total labor cost, vs. 4.1% last month" is actionable.

**Distinguish planned from unplanned overtime.** Some overtime is contractually expected (e.g., on-call shifts). Only unplanned overtime represents a cost control issue. If the overtime type breakdown is not available in the metric, caveat the interpretation accordingly.

**Payroll correction rate is a process health metric, not a financial metric.** Its primary implication is time cost (admin work to correct) and compliance risk (incorrect records). The direct financial impact is secondary.

**Marketplace fill rate has an inverse financial relationship.** High fill rates reduce unplanned cover costs. Low fill rates increase them. When marketplace fill rate drops, model the downstream cost impact on coverage.

---

## 5. Output Format

```
Financial Analytics Report
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- Financial metric(s): [names + definitions]
- Period: [start → end — complete / incomplete]
- Scope: [workspace / team / tier]
- Rate source: [current contracted rates / historical rates / not verified]
- Data quality: [complete / partial / uncertain]

Cost Summary
- Actual cost: [value + unit]
- Planned / prior period cost: [value + type of baseline]
- Absolute variance: [+/- value]
- Relative variance: [+/- %]
- Direction: [over / under / on track]

Variance Decomposition
- Volume driver: [+/- value — X% of variance]
- Rate driver: [+/- value — X% of variance]
- Efficiency driver (overtime + corrections): [+/- value — X% of variance]

Payroll Accuracy (if applicable)
- Correction rate: [%] vs. [prior period or target]
- Corrections by team: [top 3 teams by correction rate]
- Pattern identified: [concentrated / distributed / unknown]

Marketplace Economics (if applicable)
- Fill rate: [%]
- Average listing age at fill: [hours]
- Estimated unfilled shift cost: [value — or "not computable without rate data"]

Financial Risk Flags
- [Flag 1]: [metric + value + risk]
- [Flag 2]: [metric + value + risk]

Recommended Actions
- [Action 1]: [what + expected impact]
- [Action 2]: [what + expected impact]

Confidence Assessment
- Overall confidence: [high / medium / low]
- Rate source confidence: [verified / estimated / unavailable]
- Caveats: [incomplete period, missing rate data, version notes]
- Version notes: [relevant CHANGELOG entries]
─────────────────────────────────────────────────────────
```
