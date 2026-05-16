# Workforce Planning Prompt — Capacity Analysis, Headcount Planning, and Scheduling Intelligence

> **When to use this file:** When analyzing whether the workforce has enough capacity to cover demand, planning headcount changes, evaluating scheduling efficiency, modeling the impact of absence or turnover, or identifying structural coverage gaps.

---

## 1. Workforce Planning BI Principles

Workforce planning BI answers two questions simultaneously:

**Supply question**: How many hours of workforce capacity are available in this period, by team, role, and skill?

**Demand question**: How many hours of work need to be covered in this period, by shift type, location, and urgency?

The gap between supply and demand is the workforce planning problem. BI's job is to make that gap visible, explain its drivers, and quantify its cost if left unaddressed.

---

## 2. Capacity Analysis Protocol

### Step 1 — Establish supply capacity

Supply is not equal to headcount. Effective capacity must account for:
- Contracted hours per employee per period.
- Planned absences (annual leave, approved leave).
- Unplanned absences (historical absence rate applied to forward periods).
- Availability constraints (not all employees are available for all shift types or locations).

**Effective capacity formula**: (Total contracted hours) − (Planned absence hours) − (Historical unplanned absence hours at current rate) = Available capacity

### Step 2 — Establish demand coverage requirement

Demand is determined by the number of shifts scheduled or required:
- Open shifts (not yet assigned).
- Assigned shifts (covered).
- Minimum coverage requirements (by regulation, client contract, or business rule).

### Step 3 — Compute coverage ratio

Coverage ratio = Assigned hours ÷ Required coverage hours × 100%.

Interpret:
- ≥ 100%: Fully covered (may indicate over-rostering if significantly above 100%).
- 90–99%: At-risk coverage — one or two absences cause gaps.
- 80–89%: Structural gap — requires immediate action (overtime, marketplace, temporary cover).
- < 80%: Critical gap — service delivery at risk.

### Step 4 — Identify coverage gap drivers

| Gap driver | Evidence source | Indicator |
|---|---|---|
| Headcount shortfall | `members` table headcount vs. planned headcount | Too few contracted employees for demand volume |
| Absence spike | `attendance_records` above historical rate | Seasonal illness, disengagement event |
| Shift marketplace failure | `shift_marketplace_listings` fill rate | Open shifts not being accepted |
| Scheduling error | `shift_assignments` created late in period | Last-minute scheduling leaving coverage windows |
| Availability mismatch | Employee availability vs. shift timing patterns | Employees contracted but unavailable for required shift times |

---

## 3. Headcount Planning Analytics

### Headcount sufficiency model

When a workspace shows persistent coverage gaps, apply this model to determine required headcount:

1. **Calculate weekly demand hours**: Total shift hours required per week (average over prior 8 weeks, seasonally adjusted).
2. **Calculate effective hours per FTE**: Average contracted hours per employee per week × (1 − historical absence rate).
3. **Required FTE** = Weekly demand hours ÷ Effective hours per FTE.
4. **Headcount gap** = Required FTE − Current headcount.

State all assumptions explicitly. If contracted hours or historical absence rate are not available in Effectime tables, state that the model is incomplete and what data is needed.

### Turnover impact modeling

When a workspace has elevated turnover, model the forward capacity impact:

- At current turnover rate, how many departures are expected in the next quarter?
- What is the minimum time-to-fill for an open position (sourced from historical recruitment funnel data)?
- What is the capacity gap in the period between departure and replacement?
- What is the cost of that gap (overtime, marketplace fills, service degradation)?

This model surfaces the hidden cost of turnover that gross turnover rate metrics do not show.

### Seasonal capacity planning

For workspaces with seasonal demand patterns, identify:
- Peak demand periods (highest shift hours required).
- Trough periods (lowest demand).
- Historical coverage performance in peak periods (did coverage hold above 90%?).
- Lead time needed to build capacity before peak (hiring time + onboarding time).

---

## 4. Scheduling Efficiency Analytics

Scheduling efficiency measures whether the workforce is being deployed optimally — not just whether shifts are covered.

### Key scheduling efficiency metrics

| Metric | Definition | Benchmark |
|---|---|---|
| Schedule adherence rate | Shifts started within ±15 min of scheduled time ÷ total shifts | ≥ 90% |
| Last-minute shift assignment rate | Shifts assigned within 24 hours of start ÷ total shifts | ≤ 15% |
| Overtime as % of total hours | Overtime hours ÷ total hours worked | ≤ 10% (without WTD risk) |
| Shift cancellation rate | Shifts cancelled after assignment ÷ total shifts assigned | ≤ 5% |
| Split-shift rate | Employees working two or more shifts with gaps in a single day | Monitor — high rate signals scheduling pressure |

### Scheduling pattern analysis

When scheduling efficiency is low:
1. Check whether the schedule is being built with sufficient lead time (last-minute assignments are a leading indicator of planning failure, not just execution failure).
2. Check whether shift templates are being used. High variability in shift start/end times suggests manual ad-hoc scheduling rather than structured patterns.
3. Check whether the marketplace is being used proactively (listings posted 72+ hours before shift start) or reactively (listings posted < 24 hours before start).

---

## 5. Workforce Composition Analysis

Beyond headcount volume, analyze workforce composition for risk:

| Composition risk | How to detect | Effectime source |
|---|---|---|
| Key person dependency | Single employee covering > 30% of a team's specialist shifts | `shift_assignments` by employee + role |
| Tenure cliff | > 30% of workforce in first 90 days (high fragility) | `members.start_date` distribution |
| Role coverage gap | One role category has < 2 employees available for any given shift | `shift_assignments` + role mapping |
| Manager-to-member ratio imbalance | > 1:15 manager-to-member ratio (reduced oversight) | `members` by role type |
| Single-location concentration | > 80% of workforce at one location (business continuity risk) | `members` + `shift_assignments` by location |

---

## 6. Output Format

```
Workforce Planning Analysis
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- Analysis type: [capacity / headcount planning / scheduling efficiency / composition]
- Period: [current period] + [forward planning horizon if applicable]
- Scope: [workspace / team / role]
- Data quality: [complete / partial / uncertain]

Capacity Assessment
- Contracted capacity: [total hours]
- Effective capacity (after absence adjustment): [hours]
- Absence rate applied: [%] — basis: [historical average / current period]
- Required coverage: [hours]
- Coverage ratio: [%] — Status: [≥100% / at-risk / gap / critical]
- Coverage gap (hours): [if applicable]

Headcount Analysis
- Current headcount: [N]
- Required headcount (model): [N — state assumptions]
- Headcount gap: [N]
- Turnover impact: [expected departures in next quarter: N, capacity impact: X hours]

Scheduling Efficiency
- Schedule adherence: [%]
- Last-minute assignment rate: [%]
- Overtime rate: [%]
- Cancellation rate: [%]
- Primary scheduling inefficiency: [finding]

Coverage Gap Drivers (ranked)
1. [Driver] — Evidence: [source] — Contribution to gap: [%]
2. [Driver] — Evidence: [source] — Contribution to gap: [%]

Composition Risk Flags
- [Risk 1]: [finding + implication]
- [Risk 2]: [finding + implication]

Recommended Actions
- Immediate (this period): [action]
- Short-term (next 4 weeks): [action]
- Planning (next quarter): [action]

Confidence Assessment
- Overall confidence: [high / medium / low]
- Model assumptions: [list]
- Caveats: [missing data, version notes]
─────────────────────────────────────────────────────────
```
