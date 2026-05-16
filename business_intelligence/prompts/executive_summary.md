# Executive Summary Prompt — Board-Ready Narrative Generation and Executive Communication

> **When to use this file:** When producing an executive summary, board report, leadership briefing, or any BI narrative intended for a decision-maker audience who needs conclusions and decisions — not raw data and chart descriptions.

---

## 1. Executive Audience Model

Before writing any executive summary, define the audience precisely:

| Audience tier | What they need | What they do not need |
|---|---|---|
| Board / investor | Strategic direction, risk signals, growth trajectory | Operational detail, individual workspace data, implementation nuance |
| C-suite / founder | Business health, operational risks, resource decisions | Low-level metrics, debugging context, feature-level detail |
| HR leadership | Workforce health, compliance status, engagement trends | Platform internals, version history, integration status |
| Workspace manager | Team performance, shift coverage, compliance alerts | Platform-level aggregates, other workspaces' data |

Write for the stated audience. Do not write one summary and assume it works for all levels.

---

## 2. Executive Summary Structure

Every executive summary follows this structure. Do not rearrange sections. Do not combine sections.

### Section 1 — Situation (1–2 sentences)
State the reporting period, scope, and the single most important business context.
- What period does this cover?
- What is the most important thing happening in the business right now that gives context to all the data?

### Section 2 — Performance Highlights (3–5 bullet points)
The metrics that moved in a positive direction, with business interpretation.
- State the metric name, its value, and what it means for the business.
- Do not list every metric that improved — only those with strategic or operational significance.
- Lead with the most important highlight.

### Section 3 — Concerns and Risks (2–4 bullet points)
The metrics that are below target, trending negatively, or represent a risk.
- State the metric name, its value, the gap from target or prior period, and the business risk if unaddressed.
- Be specific about severity: is this a monitoring item, an investigation item, or an escalation item?
- Do not bury concerns in hedged language. If something is a risk, name it as a risk.

### Section 4 — Decisions Required (0–3 items)
The specific decisions the executive audience needs to make based on this data.
- Format: "Decision needed: [what decision] — context: [what data drives it] — deadline: [when this decision is needed by]."
- If no decisions are required this period, say so explicitly: "No decisions required this period — monitoring continues."

### Section 5 — Watch List (1–3 items)
Metrics or signals that are not yet actionable but require monitoring.
- These are early warnings, not confirmed risks.
- Format: "Watching: [metric] — current value: [value] — threshold for escalation: [value] — next review: [date]."

### Section 6 — Data Notes (if applicable)
Any caveats on data quality, scope limitations, or version-induced metric shifts that affect the reliability of this summary.
- If this section is empty, state: "No data quality caveats for this period."
- Do not omit this section — omitting it implies full data confidence, which is rarely justified.

---

## 3. Tone and Style Rules

**Write in the active voice.** "Compliance score improved by 8 points" not "An 8-point improvement was observed in the compliance score."

**Use numbers, not adjectives.** "Wellbeing score is 6.2 out of 10, down from 7.0 last month" not "Wellbeing score is concerning."

**State business implications, not data facts.** "Overtime rate of 23% exceeds the 15% target — this represents an unplanned labor cost increase of approximately 8% above budget" not "Overtime rate is 23%."

**Do not hedge risk.** If the data shows a risk, state it as a risk. "Turnover rate has increased four consecutive months and is approaching the threshold where replacement cost will exceed retention investment" is better than "Turnover rate shows some upward movement that may warrant attention."

**Do not pad.** An executive summary that requires a reader to work to find the conclusion is a failed summary. Lead with the conclusion. Put context second.

**Do not manufacture positivity.** If the period was difficult, say so. Framing a bad period as mixed or neutral destroys credibility.

---

## 4. Data Requirements Before Writing

An executive summary must not be produced without:
- Confirmed metric definitions (not assumed from labels).
- Confirmed time window and scope.
- CHANGELOG version context.
- Data quality assessment.
- At least one baseline for comparison (prior period or target).

If any of these are missing, state: "Executive summary deferred pending [specific missing element]. Resume after [what must be provided]."

---

## 5. Handling Bad News

When a period shows predominantly negative performance:
- Do not lead with a highlight to soften the message. Lead with the most significant concern.
- State magnitude: "This is the worst [metric] result in the past [N] periods" or "This represents the first consecutive [N]-month decline."
- State causation if known: "The decline is attributable to [confirmed cause]" or "The cause is not yet confirmed — three hypotheses are under investigation."
- State the plan: "The recommended response is [action]. Without action, the model projects [consequence] within [timeframe]."

---

## 6. Version Awareness in Executive Summaries

When a software version change could affect the metrics in the summary period:
- Add a note in Section 6 (Data Notes): "Version v[X.Y.Z] was deployed on [date]. The following metrics may reflect this change rather than a business shift: [metric list]. Investigation is [completed / ongoing]."
- Do not present version-affected metrics as confirmed business performance without this note.

---

## 7. Output Format

```
Executive Summary — [Period] — [Scope]
─────────────────────────────────────────────────────────
Produced against: CHANGELOG v[version] | [Date]
Scope: [workspace / tier / platform level]
Data quality: [complete / partial / uncertain — reason if partial]

1. Situation
[1–2 sentences]

2. Performance Highlights
- [Metric]: [value] — [business interpretation]
- [Metric]: [value] — [business interpretation]
- [Metric]: [value] — [business interpretation]

3. Concerns and Risks
- [Metric]: [value] — Gap: [vs target or prior] — Risk: [business consequence if unaddressed] — Severity: [monitoring / investigation / escalation]
- [Metric]: [value] — Gap: [vs target or prior] — Risk: [business consequence if unaddressed] — Severity: [monitoring / investigation / escalation]

4. Decisions Required
- Decision needed: [what] — Context: [data basis] — Deadline: [when]
[or: No decisions required this period — monitoring continues.]

5. Watch List
- Watching: [metric] — Current: [value] — Escalation threshold: [value] — Next review: [date]

6. Data Notes
[Caveats, version notes, scope limitations — or: No data quality caveats for this period.]
─────────────────────────────────────────────────────────
```
