# Compliance Analytics Prompt — Rule Coverage, Violation Patterns, Audit Readiness, and Regulatory Risk

> **When to use this file:** When analyzing compliance score composition, investigating violation patterns, assessing audit readiness, quantifying regulatory risk, or explaining why compliance metrics moved.

---

## 1. Compliance BI Principles

Compliance analytics in Effectime has a higher consequence threshold than operational analytics. A miscounted or misinterpreted compliance metric can lead to incorrect regulatory risk assessments, false assurance before an audit, or undetected violations that carry legal and financial penalties.

**Rule 1**: Always confirm what rules are configured before interpreting a compliance score. A 100% score on an incomplete rule set is not compliant — it is unmeasured.

**Rule 2**: Compliance metrics are workspace-scoped. Cross-workspace compliance averaging is only valid if all workspaces operate under the same regulatory framework (jurisdiction, industry, collective agreement).

**Rule 3**: Compliance data must be audit-trail-linked. Every compliance evaluation must have a corresponding `audit_events` record. If it does not, the evaluation cannot be verified.

---

## 2. Compliance Metric Catalog

| Metric | Definition | Source | Polarity |
|---|---|---|---|
| Compliance score | Percentage of compliance rule evaluations that passed in the period | `compliance_rule_evaluations` where `result = 'pass'` ÷ total evaluations | Higher = better |
| Rule coverage rate | Count of configured rules ÷ applicable rules for workspace's regulatory context | `compliance_rules` vs. regulatory framework | Higher = better |
| Violation count | Count of evaluations where `result = 'violation'` in period | `compliance_violations` | Lower = better |
| Violation rate | Violations ÷ total evaluations × 100% | Computed | Lower = better |
| Unacknowledged rule rate | Rules not acknowledged by assigned employees ÷ total rules requiring acknowledgement | `compliance_rule_acknowledgements` | Lower = better |
| Audit trail completeness | Audit events logged ÷ required audit events for period | `audit_events` vs. expected event set | Higher = better |
| Policy breach severity distribution | Count of violations by severity tier (minor / major / critical) | `compliance_violations.severity` | Monitor distribution |
| Time-to-acknowledge | Average hours from rule assignment to employee acknowledgement | `compliance_rule_acknowledgements` | Lower = better |
| Working-time directive breach rate | Shifts exceeding maximum working hours per WTD rules ÷ total shifts | `shift_assignments` vs. `compliance_rules` (WTD type) | Lower = better — legal consequence |
| Repeat violation rate | Employees or teams with more than one violation of the same rule in period | `compliance_violations` grouped by rule + employee | Lower = better |

---

## 3. Compliance Score Decomposition Protocol

A single compliance score number hides more than it reveals. Always decompose before interpreting.

### Step 1 — Rule coverage check
How many rules are configured vs. how many *should* be configured for this workspace?

If rule coverage is below 100%, the compliance score is measuring compliance to an incomplete rule set. Report rule coverage alongside the compliance score at all times. A workspace with 100% compliance score and 60% rule coverage is materially non-compliant — the unconfigured 40% of rules are untested.

### Step 2 — Violation type breakdown
Segment violations by:
- **Rule type**: Working-time directive / health and safety / attendance policy / document compliance / acknowledgement compliance.
- **Severity**: Minor / major / critical.
- **Team**: Which teams have the highest violation rates?
- **Repeat vs. first-time**: Are violations concentrated in repeat offenders or distributed across new cases?
- **Time pattern**: Are violations concentrated in specific time windows (end of shift, overnight, public holidays)?

### Step 3 — Audit trail completeness check
A compliance score without audit trail completeness is unverifiable in a regulatory review. Confirm:
- Are all compliance evaluations backed by `audit_events` records?
- Is the audit trail complete for the full analysis period?
- Are there any gaps in the audit log that would prevent a regulator from reconstructing compliance history?

If audit trail completeness is below 100%, flag this explicitly. It is a regulatory risk regardless of the compliance score value.

### Step 4 — Working-time directive specific analysis
WTD breaches are the highest-consequence compliance violations in most Effectime operating jurisdictions (EU markets: Hungary, Germany, Austria, Czech Republic, Slovakia, Poland, Romania). Analyze WTD compliance separately from general compliance:
- WTD maximum shift length breaches
- WTD minimum rest period breaches (between shifts)
- WTD weekly hour cap breaches

Each WTD breach is potentially a legal exposure. Report WTD breach count and rate separately from the aggregate compliance score.

---

## 4. Audit Readiness Assessment

When assessing whether a workspace is audit-ready:

| Dimension | Required condition | Check source |
|---|---|---|
| Rule completeness | All applicable rules configured | `compliance_rules` vs. regulatory template |
| Score threshold | Compliance score ≥ required level (typically ≥ 95%) | `compliance_rule_evaluations` |
| Audit trail completeness | 100% for all evaluation periods | `audit_events` |
| Violation resolution | All critical violations have documented resolution | `compliance_violations.resolution_status` |
| Acknowledgement completion | All employees have acknowledged current rules | `compliance_rule_acknowledgements` |
| WTD breach clearance | Zero unresolved WTD breaches in period | `compliance_violations` where `rule_type = 'wtd'` |
| Document currency | All compliance documents are current (no expired documents) | `compliance_documents` |

A workspace is audit-ready only when all seven dimensions are met. A score of 6/7 is not audit-ready — it is "one exposure from non-compliance."

---

## 5. Violation Pattern Analysis

Violations are more valuable as patterns than as individual events. When violation count increases:

1. **Concentration test**: Are violations concentrated in one team, one rule type, or one time window? Concentrated violations have structural causes (policy unclear, manager behavior, schedule design). Distributed violations suggest a systemic measurement or configuration issue.

2. **Repeat offender test**: Are the same employees or teams appearing in multiple violations? Repeat violations suggest an unresolved root cause (inadequate training, deliberate non-compliance, role mismatch).

3. **New rule sensitivity**: Did a new compliance rule recently go live? First-period violation rates for new rules are always elevated as employees adapt. Check CHANGELOG for recent compliance feature or rule configuration changes.

4. **Version check**: A spike in violation count that coincides with a software release may reflect a change in how violations are evaluated or counted, not a real change in compliance behavior.

---

## 6. Regulatory Calendar Awareness

Compliance risk is not uniform across the calendar year. Flag these elevated-risk periods in compliance analytics:

| Period | Elevated risk | Reason |
|---|---|---|
| December–January | WTD breach risk (EU) | Holiday overtime + skeleton staffing |
| End of quarter | Payroll compliance risk | Rushed corrections and late submissions |
| New law effective dates | Rule coverage gap risk | Rules may not have been updated to reflect new legislation |
| Post-merger / expansion | Rule coverage gap risk | New workforce not yet covered by workspace compliance rules |
| Annual leave peaks | Shift coverage compliance risk | Unfilled shifts cause WTD-relevant scheduling pressure |

When compliance metrics are analyzed during these windows, note the elevated-risk context explicitly.

---

## 7. Output Format

```
Compliance Analytics Report
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- Compliance metric(s): [names]
- Period: [start → end]
- Jurisdiction / regulatory framework: [EU / country-specific / workspace-configured]
- Workspace tier: [tier — compliance features require Growth or Enterprise]
- Data quality: [complete / partial / uncertain]

Compliance Score Decomposition
- Overall compliance score: [%] vs. [prior period or target]
- Rule coverage rate: [%] (configured ÷ applicable rules)
- Effective compliance (score × coverage): [%] — [interpretation]

Violation Analysis
- Total violations: [count] vs. [prior period]
- By severity: Critical=[N], Major=[N], Minor=[N]
- By rule type: [breakdown]
- By team: [top 3 teams by violation rate]
- Repeat violations: [count and rate]
- Pattern: [concentrated / distributed / new-rule sensitivity / version-induced]

WTD Analysis
- WTD breach count: [N] — Rate: [%]
- Breach types: [shift length / rest period / weekly cap]
- Unresolved WTD breaches: [N] — [regulatory exposure: low/medium/high]

Audit Trail
- Completeness: [%]
- Gaps: [dates or "none detected"]
- Audit-readiness verdict: [ready / not ready — failing dimension(s)]

Audit Readiness Scorecard
[7-dimension table with pass/fail per dimension]

Regulatory Risk Flags
- [Flag 1]: [rule type + violation + jurisdiction exposure]
- [Flag 2]: [rule type + violation + jurisdiction exposure]

Recommended Actions (ranked by risk)
- [Action 1 — Critical]: [what + deadline]
- [Action 2 — Major]: [what + owner]

Confidence Assessment
- Overall confidence: [high / medium / low]
- Caveats: [incomplete rules, audit trail gaps, version notes]
- Version notes: [relevant CHANGELOG entries]
─────────────────────────────────────────────────────────
```
