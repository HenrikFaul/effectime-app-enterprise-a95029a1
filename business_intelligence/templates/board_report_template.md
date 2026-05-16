# Board Report Template — Formal Board-Level BI Report Structure

> **How to use this template:** Use for quarterly or annual board reports, investor briefings, or any BI output where the audience is governance-level (board members, investors, advisors) and the output will be formally recorded. This template is more structured and governance-focused than the executive_summary.md prompt — it includes formal risk register, governance notes, and forward guidance sections.

---

```
# [Company Name] Workforce Intelligence Board Report
## [Quarter / Period] — Produced [YYYY-MM-DD]

**Produced against**: CHANGELOG v[X.Y.Z]
**Reporting period**: [YYYY-MM-DD] → [YYYY-MM-DD]
**Platform scope**: [workspace count, tier distribution]
**Data quality**: [High / Medium — reason if not High]
**Prepared by**: [AI session / person]
**Reviewed by**: [if applicable]

---

## 1. Period Summary

[3–4 sentences. The single most important finding of the period, stated directly. Not a teaser — the actual conclusion. Board members read summaries; make the summary carry full weight.]

---

## 2. Strategic KPI Scorecard

[Table showing the 5–8 metrics that the board tracks. Do not include operational detail here — that belongs in Section 5.]

| KPI | Current | Prior Period | Target | Status |
|---|---|---|---|---|
| [Workforce coverage rate] | [value] | [value] | [target] | [On Track / At Risk / Off Track] |
| [Compliance score] | [value] | [value] | [target] | [On Track / At Risk / Off Track] |
| [Wellbeing score] | [value] | [value] | [target] | [On Track / At Risk / Off Track] |
| [Labor cost vs. budget] | [value] | [value] | [target] | [On Track / At Risk / Off Track] |
| [Platform active workspace rate] | [value] | [value] | [target] | [On Track / At Risk / Off Track] |

**Scorecard note**: [Any caveats on the data underlying the scorecard — version changes, incomplete periods, scope limitations.]

---

## 3. Business Performance Highlights

[Bullet points only. Maximum 5. Lead with the most significant positive result. Each bullet: metric name, value, direction, business meaning.]

- **[Metric]**: [value] — [1-sentence business interpretation]
- **[Metric]**: [value] — [1-sentence business interpretation]
- **[Metric]**: [value] — [1-sentence business interpretation]

---

## 4. Risk Register

[All metrics that are below target, trending negatively, or represent a material risk. Ranked by severity.]

### Risk 1 — [Severity: Critical / High / Medium]
**Metric**: [name]
**Current value**: [value] — **Target**: [target] — **Gap**: [magnitude]
**Trend**: [deteriorating / stable below target / first-period miss]
**Business risk**: [What happens if this is not resolved and over what timeframe?]
**Recommended response**: [Specific action with owner and timeline]
**Status**: [New / Under investigation / Remediation in progress / Monitoring]

### Risk 2 — [repeat structure]

### Risk 3 — [repeat structure]

---

## 5. Operational Performance Detail

[Structured summary of the key operational domains. This is where operational metrics go — one paragraph per domain. Board members who want detail read this section; those who only need the headline read Sections 2–4.]

### Workforce and Attendance
[3–5 sentences on headcount, coverage, attendance, and absence metrics. State the most important movement.]

### Compliance
[3–5 sentences on compliance score, rule coverage, violation trends, and audit readiness.]

### Engagement and Wellbeing
[3–5 sentences on wellbeing score, burnout risk index, survey response rate, and the business risk of any declining trends.]

### Financial
[3–5 sentences on labor cost vs. budget, overtime rate, payroll accuracy, and any budget variance that requires board awareness.]

### Platform Health (if applicable)
[3–5 sentences on workspace growth, feature adoption, integration health, and any churn signals.]

---

## 6. Forward Guidance

[What the data suggests about the next period. This is directional, not a forecast. State explicitly that it is based on current trajectory, not a commitment.]

### Leading indicators signal
[List 3–5 leading indicators and their current status relative to thresholds. Summarize the overall forward signal: positive / neutral / cautionary.]

### Expected outcomes if trajectory continues
[1–2 sentences per critical metric: "If [metric] continues at current trajectory, we expect [outcome] by [timeframe]."]

### Recommended board-level decisions
[Decisions that require board-level authority, awareness, or resource allocation. Format: "Decision: [what] — Context: [data] — Recommendation: [action] — Timeline: [when]."]

---

## 7. Governance and Data Integrity Notes

[Formal disclosure of anything that affects the reliability, completeness, or comparability of the data in this report.]

### Version changes in period
[Any CHANGELOG versions deployed during the reporting period that affected metric computation, source data, or scope. State the specific impact on which metrics.]

### Data quality limitations
[Any metrics in this report where data quality is Medium rather than High. State what is missing and whether the limitation affects the conclusion.]

### Metric definition changes
[Any formal metric definition changes since the prior board report. State: which metric changed, what changed, and whether prior-period comparisons are affected.]

### Scope limitations
[Any workspaces, teams, or populations excluded from this report and why.]

---

## 8. Appendix A — Metric Definitions

[Include formal definitions for all metrics in the Strategic KPI Scorecard (Section 2). Use the canonical definition from metric_definition_template.md. For a first-ever board report on a metric, include the full 10-section definition. For subsequent reports, a brief definition with source citation is sufficient.]

| Metric | Definition | Source | Polarity |
|---|---|---|---|
| [Metric name] | [Computation in plain English] | [Table/component] | [Higher/Lower = better] |

---

## 9. Appendix B — Period Data Archive

[Reference to where full supporting data can be found. Not the data itself — the pointer to it.]

- Full metric dataset: [location or system]
- Versioning record: `versioning/[filename].md`
- Prior board report: [reference]
- BI documentation record: [if formal analytical finding was documented]
```
