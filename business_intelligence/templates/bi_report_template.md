# BI Report Template — Standard Report Structure for Effectime Business Intelligence Outputs

> **How to use this template:** Copy this structure. Fill each section based on the relevant specialist prompt output. Do not remove sections — mark them "Not applicable" if they do not apply to the current report scope. The completeness of this structure is a quality signal.

---

```
# [Report Title] — [Period or Scope]

**Report type**: [KPI Report / Trend Report / Anomaly Investigation / Executive Summary / Segment Analysis / Cohort Analysis / Funnel Analysis / Data Quality Assessment / BI Framework]
**Produced against**: CHANGELOG v[X.Y.Z] | [YYYY-MM-DD]
**Scope**: [workspace / team / tier / platform — be explicit]
**Time window**: [YYYY-MM-DD → YYYY-MM-DD, granularity: daily/weekly/monthly]
**Data quality**: [High / Medium / Low — reason if not High]
**Analyst**: [AI session / human]

---

## 1. Report Context

[2–3 sentences: What business question does this report address? Who is the intended audience? What decision or action will this report inform?]

---

## 2. Metric Inventory

List every metric used in this report with its source.

| Metric | Definition | Source table/component | Time window | Scope | Quality |
|---|---|---|---|---|---|
| [Metric name] | [Brief computation definition] | [Source] | [Window] | [Scope] | [H/M/L] |
| [Metric name] | [Brief computation definition] | [Source] | [Window] | [Scope] | [H/M/L] |

---

## 3. Key Findings

[Structured findings from the analysis. Use bullet points for scan-ability. Each finding states: metric, value, comparison baseline, direction, and business interpretation. Maximum 8 findings.]

### Positive findings
- [Metric]: [value] vs. [baseline] — [business interpretation]
- [Metric]: [value] vs. [baseline] — [business interpretation]

### Negative findings / concerns
- [Metric]: [value] vs. [baseline] — [business risk or interpretation]
- [Metric]: [value] vs. [baseline] — [business risk or interpretation]

### Neutral / monitoring items
- [Metric]: [value] — [what to watch and why]

---

## 4. Trend Analysis (if applicable)

[Reference output from trend_analysis.md. Include direction, confidence level, and any trend breaks detected. If not applicable: "Not applicable for this report type."]

---

## 5. Anomaly Notes (if applicable)

[Reference output from anomaly_detection.md. List any anomalies detected, their type classification, and their investigation status. If none: "No anomalies detected in this period."]

---

## 6. Root Cause Notes (if applicable)

[Reference output from root_cause_analysis.md for any metrics that moved significantly. List top-ranked hypotheses with evidence. If not applicable: "Not applicable for this report type."]

---

## 7. Segment / Cohort Breakdown (if applicable)

[Reference output from segment_cohort_analysis.md. Key segment or cohort differences with explanation. If not applicable: "Not applicable for this report type."]

---

## 8. Decisions and Actions

[What the report recommends. Use the decision format from executive_summary.md Section 2 Section 4.]

### Decisions required
- Decision: [what] — Context: [data basis] — Deadline: [when]
[or: No decisions required this period.]

### Recommended actions
- [Action] — Owner: [role] — Timeline: [when]
- [Action] — Owner: [role] — Timeline: [when]

### Watch list
- Watching: [metric] — Threshold: [value] — Next review: [date]

---

## 9. Data Quality Notes

[Reference output from data_quality.md. State any caveats, known gaps, or version-induced metric issues. If no issues: "No data quality caveats for this period."]

### Version notes
[Any CHANGELOG entries that affect the metrics in this report.]

### Known limitations
[What this report cannot tell us, and what would be needed to answer those questions.]

---

## 10. Appendix — Metric Definitions (if needed)

[For reports distributed to stakeholders unfamiliar with Effectime's metric definitions, include a brief definition of each metric used. Use entries from metric_definition_template.md or the formal metric catalog.]

---

**Report reviewed by**: [AI quality gates checklist completed / human reviewer]  
**Next scheduled report**: [date or "ad hoc"]  
**Archive location**: `versioning/[filename]` or `business_intelligence/` (if informal)
```
