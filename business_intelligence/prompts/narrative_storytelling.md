# BI Narrative and Storytelling Prompt — Translating Data into Decisions Through Structured Narrative

> **When to use this file:** When the analysis is complete and the task is to turn findings into a narrative that moves people to understand, decide, or act. This is the craft layer of BI — not what the data says, but how to say it so the right person hears it.

---

## 1. The BI Narrative Mandate

Data does not speak for itself. A table of numbers produces no decisions. A trend line generates no action. The gap between analysis and decision is filled by narrative — the structured, audience-calibrated, evidence-backed story that connects data to meaning and meaning to action.

**BI storytelling is not spin.** It does not soften bad news, inflate good news, or selectively present evidence to support a predetermined conclusion. It is the discipline of choosing the right structure, the right level of detail, and the right framing so that accurate data produces the correct understanding in the intended audience.

---

## 2. The BI Story Arc

Every BI narrative, regardless of length, follows the same underlying structure:

### 1. Situation (what is true right now)
Establish the current state in one or two sentences. This is not context-setting — it is the anchor for everything that follows.

> "In the four weeks ending 15 May 2026, shift fill rate across the workspace averaged 81%, six points below the 87% threshold that prevents overtime escalation."

### 2. Complication (what has changed or what is at risk)
What has moved, what is threatened, or what is not working? This is the tension that gives the narrative forward momentum.

> "Fill rate has declined in three consecutive weeks, driven primarily by a 34% drop in marketplace listing acceptance among part-time workers. At the current trajectory, fill rate will fall below 75% by mid-June — the point at which single-day understaffing becomes a recurring event."

### 3. Question (what the audience needs to decide)
State explicitly what decision, action, or question the data is pressing. Never make the audience extract this themselves.

> "The question for leadership is: should we increase marketplace incentives, accelerate the next hiring cohort, or adjust shift templates to reduce coverage requirements temporarily?"

### 4. Answer (the recommended course of action)
Provide the recommendation. It must be specific, grounded in the data, and feasible.

> "The fastest-impact intervention is adjusting marketplace incentive rates for the three highest-demand shift slots. Historical data shows a 22% improvement in acceptance rate when incentive premiums exceed 15%. This costs approximately £800–£1,200 per week and avoids estimated overtime costs of £2,400–£3,100 per week."

### 5. Evidence (what the data says)
Place the detailed evidence after the recommendation, not before. Decision-makers need the answer first, not a data briefing.

> "Supporting data: shift_marketplace_listings shows 47 open listing slots per week in the target category. Acceptance rate dropped from 68% to 45% over 3 weeks. Overtime cost increased by £2,100 in the same period. Historical incentive experiments at similar workspaces showed 18–26% acceptance rate improvement at 15% premium."

---

## 3. Audience-Specific Narrative Adaptation

The same analysis produces different narratives for different audiences. Do not adapt tone — adapt depth, vocabulary, and emphasis.

### Board / investor narrative
- Lead with strategic implication, not operational detail.
- Express metrics as business outcomes and risks, not as KPI values.
- Omit sub-metric detail unless it directly changes the strategic conclusion.
- Maximum 3 key points. Decision recommendation must be explicit.
- Language: "At current fill rate trajectory, labor cost overrun in Q3 will be approximately 8% above plan."

### Executive / founder narrative
- Lead with the most important metric and its business implication.
- Include 2–3 levels of metric depth (the KPI, the driver, the leading indicator).
- State the decision and the expected impact of each option.
- Language: "Shift fill rate is declining. The driver is marketplace acceptance rate dropping. If we adjust incentives, historical data suggests a 20% recovery within two weeks."

### HR leadership narrative
- Operational detail is appropriate.
- Connect metrics to workforce experience, not just cost.
- Include team-level breakdowns for the most critical metrics.
- Language: "Three teams are below 80% fill rate. Team B has the most acute gap — 7 unfilled shifts last week, resulting in two days of mandatory overtime for the same five employees."

### Workspace manager narrative
- Hyper-specific to their team and their current week.
- Action-oriented: what do they need to do today?
- No platform-level context. No strategic framing. Just their situation.
- Language: "You have 4 unfilled shifts this week. Two are on Saturday evening. The best match for coverage is [employee name or role type]. Post the listings at least 72 hours in advance — acceptance rate drops by 40% for same-day listings."

---

## 4. Evidence Selection Rules

Not all evidence belongs in a narrative. Select evidence by this hierarchy:

| Evidence priority | Description |
|---|---|
| 1 — Definitive | Data that directly proves or disproves the claim. Always include. |
| 2 — Supporting | Data that makes the claim more credible without proving it alone. Include if space permits. |
| 3 — Contextual | Data that helps the audience understand the situation but does not change the conclusion. Include only if the audience needs it to trust the primary evidence. |
| 4 — Tangential | Data that is interesting but does not connect to the decision. Do not include — it dilutes the narrative. |

A narrative overloaded with evidence is a data dump, not a story. If all the evidence is in the narrative, the analysis was not synthesized — it was transcribed.

---

## 5. Handling Uncertainty in Narrative

Uncertainty is not a narrative weakness — it is a credibility signal when disclosed correctly.

**Disclose uncertainty precisely.** Do not say "the data is somewhat uncertain." Say "the wellbeing score for Team C is based on a 38% response rate, which means approximately 62% of team members' views are not captured in this number."

**State what uncertainty means for the decision.** "Because of the low response rate, we recommend delaying any management intervention for Team C until the next survey cycle produces a more representative result — or until an alternative signal (voluntary overtime rate, absence spike) confirms the concern."

**Never present a low-confidence finding as a decision basis.** If the data quality is insufficient to support a decision, say so and state what data is needed to reach decision quality.

---

## 6. The Anti-Patterns of BI Narrative

These patterns produce narratives that look analytical but produce no decisions.

**The data dump**: Listing every metric in the analysis period without a unifying narrative. Produces: reader overwhelm, no action.

**The chart tour**: Describing what each chart shows without interpreting what it means. "The line went up in March and then came down in April." Produces: nothing. The reader already sees the chart.

**The balanced both-sides**: Presenting positives and negatives with equal weight, leaving the reader to draw their own conclusion. Produces: no decision, no accountability for the recommendation.

**The hedge sentence**: "While results are mixed, there are some areas of concern that may warrant further review." Produces: the impression of analysis with none of its value.

**The buried lead**: Starting with 4 paragraphs of context before stating the key finding. Produces: decision-makers who stop reading before reaching the point.

**The passive voice shield**: "Overtime was observed to have increased in the period under review." Produces: diffusion of responsibility. Use active voice. "Overtime increased 23% in May."

---

## 7. Narrative Length Standards

| Output type | Target length | Structure |
|---|---|---|
| Board metric update | 3–5 sentences | Situation → Risk → Decision |
| Executive KPI commentary | 1 paragraph per metric | Situation → Complication → Answer |
| Monthly operational report narrative | 400–600 words | Full story arc |
| Root cause explanation | 200–300 words | Complication → Evidence → Cause → Recommendation |
| Anomaly alert | 3–4 sentences | What happened → Why it may matter → What to do |
| Full executive summary | 600–900 words | 6-section structure from executive_summary.md |

Longer is not more thorough. Longer is harder to act on.

---

## 8. Output Format

```
BI Narrative
─────────────────────────────────────────────────────────
Narrative type: [Board update / Executive summary / Operational report / Alert / Root cause]
Audience: [Board / C-suite / HR leadership / Workspace manager]
Key metric(s): [list]
CHANGELOG version: [version]
Data quality: [high / medium / low]

Narrative

[Situation]
[1–2 sentences establishing current state]

[Complication]
[1–3 sentences on what has changed, what is at risk, or what the tension is]

[Question]
[1 sentence: the decision or action this narrative is building toward]

[Answer]
[1–3 sentences: specific recommendation with evidence basis]

[Evidence]
[Bullet points: the 3–5 most important data points supporting the answer]

Audience calibration check
- Vocabulary level: [appropriate for stated audience]
- Detail depth: [appropriate for stated audience]
- Decision clarity: [explicit / implicit — explicit required for board and executive]
- Uncertainty disclosed: [yes / no — required if confidence < high]

Anti-pattern check
- Data dump: [absent]
- Chart tour: [absent]
- Hedge sentences: [absent]
- Buried lead: [absent]
─────────────────────────────────────────────────────────
```
