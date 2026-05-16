# Turnover Risk Scoring Prompt — Predicting Employee Departure Risk from Behavioural Signals

> **When to use this file:** When identifying which employees or teams are at elevated departure risk before the departure occurs. Always read `prompts/forecasting_methodology.md` first. Always read the PII constraints in Section 2 before producing any output.

---

## 1. Purpose and Scope

Turnover risk scoring uses behavioural signals available in Effectime's data to estimate the relative probability of voluntary departure for individual employees or teams. The output is a risk classification (High / Medium / Low) with supporting signal evidence — not a probability percentage, not a prediction of who will resign, and not a management action recommendation without human review.

**This system does not predict involuntary turnover** (terminations, redundancies). It identifies voluntary departure signals only.

---

## 2. PII and Privacy Constraints (Non-Negotiable)

These constraints apply to every output from this prompt:

**Constraint 1 — Individual outputs require authorization.** Employee-level risk scores may only be produced for HR leadership or workspace admins in a context where individual data access is appropriate for the workspace's role scope. Confirm authorization before producing individual-level output.

**Constraint 2 — Minimum aggregation for team reports.** Team-level risk reports require a minimum team size of N ≥ 5. Teams smaller than 5 members must not have risk distributions reported — doing so effectively identifies individuals.

**Constraint 3 — No named employees in BI output.** Turnover risk BI outputs must not include employee names. Use role + tenure cohort + team identifiers only.

**Constraint 4 — Risk scores are not performance ratings.** A high departure risk score reflects behavioral disengagement signals, not poor performance. These are categorically different and must not be conflated in communications.

**Constraint 5 — Risk scores decay.** A risk score older than 4 weeks is stale and should not be used for management decisions without re-running the assessment.

---

## 3. Turnover Risk Signal Inventory

These signals are available in Effectime data and have documented relationships with voluntary departure in workforce management research. Each signal is weighted by its relative predictive strength for this domain.

| Signal | Data source | Weight | Direction |
|---|---|---|---|
| Wellbeing score decline: ≥ 1.5 points over 4 weeks | `wellbeing_survey_responses` | High | Declining = risk increases |
| Voluntary overtime acceptance rate: drops > 25% MoM | `clock_events` + `shift_marketplace_listings` | High | Declining = risk increases |
| Survey non-response: 2+ consecutive survey cycles missed | `wellbeing_survey_responses` | High | Missing = risk increases |
| Unplanned absence rate: above 15% for 3+ consecutive weeks | `attendance_records` | High | Above threshold = risk increases |
| Punch correction rate: elevated > 10% WoW for 2+ weeks | `clock_correction_events` | Medium | Elevated = risk increases (conflict proxy) |
| Shift cancellation rate (initiated by employee): > 2 per month | `shift_assignments` cancellations | Medium | Elevated = risk increases |
| Shift preference changes: significant pattern shift | `shift_assignments` time patterns | Medium | Change = potential risk signal |
| Feature engagement drop: app/session activity > 50% decline | `workspace_sessions` by member role | Low | Declining = risk increases |
| Tenure position: < 90 days or 9–13 months (departure risk peaks) | `members.start_date` | Medium | Tenure at risk windows |

### Signal data availability check

Before scoring, confirm which signals are available for the workspace:
- Wellbeing signals require the wellbeing module (Growth tier or above).
- Survey data requires surveys to have been conducted in the assessment window.
- Marketplace signals require shift marketplace feature.
- Session-level data requires sufficient platform logging.

Signals that are not available must be excluded from the score with a note that coverage is incomplete.

---

## 4. Risk Scoring Protocol

### Step 1 — Define the assessment cohort
State exactly who is being assessed:
- All members of a specific workspace or team.
- A tenure cohort (e.g., employees hired 6–12 months ago).
- A team subset (e.g., all part-time employees in Team B).

Do not apply blanket workspace-wide scoring in the initial output — start with the highest-risk cohorts identified by leading indicators.

### Step 2 — Collect signal data for the assessment window
Assessment window: 8 weeks ending today (or the most recent complete week).

For each member in the cohort, collect the available signal values and classify each as:
- **Signal present** (signal value crosses the threshold defined in Section 3).
- **Signal absent** (signal value is within normal range).
- **Signal unavailable** (data not present for this member in this window).

### Step 3 — Score each member or team

**Individual score:**

| High signals | Medium signals | Score |
|---|---|---|
| 2+ | Any | High risk |
| 1 | 2+ | High risk |
| 1 | 0–1 | Medium risk |
| 0 | 2+ | Medium risk |
| 0 | 0–1 | Low risk |

**Note:** A tenure-window signal (< 90 days or 9–13 months) always elevates the score by one tier, regardless of other signals.

**Team score:** Aggregate individual scores to produce a team risk distribution. Report as: "High: N (X%), Medium: N (Y%), Low: N (Z%)." Flag teams where High + Medium > 40% of the team as team-level risk.

### Step 4 — Validate against prior turnover patterns
If the workspace has historical turnover data, validate the scoring method:
- Did departed employees in the prior 6 months score High or Medium risk 4–8 weeks before departure?
- What is the false positive rate (High-risk employees who did not depart)?

If no historical validation is possible, reduce confidence level and state: "Scoring not validated against historical turnover patterns for this workspace."

### Step 5 — Version check
Check CHANGELOG for any recent changes that could affect signal availability or computation:
- Wellbeing module changes that altered survey data capture.
- Clock event logic changes that altered correction rate computation.
- Session logging changes that altered engagement signal availability.

---

## 5. Risk Tier Action Recommendations

These are starting points — human HR judgment is required before acting on any individual risk classification.

### High risk
- Recommended response: Schedule 1:1 within 1 week (HR or direct manager).
- Investigation focus: Which high-weight signals are present? Can any be addressed operationally?
- Review cycle: Weekly until signals normalize or departure occurs.

### Medium risk
- Recommended response: Check in at next natural touchpoint. Include in next engagement survey analysis.
- Investigation focus: Trend direction — are signals worsening or stabilizing?
- Review cycle: Every 2 weeks.

### Low risk
- Recommended response: Normal management cadence.
- Review cycle: Next scheduled risk assessment (4 weeks).

### Team-level risk elevation (High + Medium > 40%)
- Recommended response: Manager review with HR. Review team-level wellbeing, workload, and scheduling patterns.
- Note: Team-level risk often reflects team management or structural causes, not individual issues.

---

## 6. Forecasting Turnover Volume (Not Individuals)

For workforce planning purposes, convert risk scores to a turnover volume projection:

**Projected departures in next 90 days** = (High-risk count × 0.35) + (Medium-risk count × 0.10) + (Low-risk count × 0.02)

These multipliers are industry-average base rates for voluntary departure from a high/medium/low engagement classification. They are not Effectime-validated rates — treat the output as a planning estimate with ± 50% uncertainty, not a precise headcount forecast.

State explicitly: "Turnover volume projection uses general industry multipliers. Workspace-specific multipliers will be available once 2+ full annual turnover cycles are available for calibration."

---

## 7. Output Format

```
Turnover Risk Assessment
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- Assessment cohort: [team / tenure cohort / workspace — definition]
- Assessment window: [start → end — 8 weeks preferred]
- Cohort size: N = [N] — Minimum team-report threshold: N ≥ 5 [met / not met]
- Authorization scope: [HR leadership / workspace admin / individual access confirmed]
- Data quality: [complete / partial — signals unavailable: list]

Signal Coverage
Available signals: [N of 9] — Unavailable: [list with reason]
Coverage adequacy: [full / partial — reduced confidence if < 6 signals available]

Risk Distribution (team/cohort level — no named individuals)
- High risk: [N] ([%]) — Primary signals: [most common high-weight signals]
- Medium risk: [N] ([%])
- Low risk: [N] ([%])
- Team risk flag: [yes — High + Medium > 40% / no]

Tenure Window Overlap
- Members in < 90-day window: [N]
- Members in 9–13 month window: [N]
- Tenure-elevated scores: [N total]

Historical Validation
- Prior turnover recall rate (if data available): [%] — or "Not available — confidence reduced"
- False positive rate: [%] — or "Not available"

Version Check
- CHANGELOG reviewed: [yes]
- Signal-affecting changes found: [none / [specific entry — signal impact]]

90-Day Turnover Volume Projection (for workforce planning only)
- Estimated departures: [N] — Range: [low N] to [high N] — Uncertainty: ± 50%
- Equivalent workforce capacity impact: [hours/FTE]

Recommended Actions (HR review required before acting)
- Immediate (High-risk cohort): [action]
- Near-term (Medium-risk cohort): [action]
- Team-level (if team flag): [action]

Confidence Assessment
- Overall: [high / medium / low]
- Reduced if: signal coverage < 6, no historical validation, wellbeing data < 40% response rate
- Score decay date: [date 4 weeks from assessment]
- Re-run triggers: Wellbeing survey completion, major scheduling change, turnover event
─────────────────────────────────────────────────────────
```
