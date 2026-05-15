# Root Cause Analysis Prompt — Driver Identification, Hypothesis Testing, and Evidence Weighting

> **When to use this file:** When a metric has moved and the cause is unknown, when a stakeholder asks "why did X happen?", or when a trend, anomaly, or KPI variance requires a causal explanation.

---

## 1. The RCA Mandate

Root cause analysis in BI is not the same as debugging code. It operates under different constraints:
- You rarely have access to a controlled experiment.
- Multiple causes can act simultaneously.
- Correlation is common; causation is rare and must be argued, not assumed.
- The CHANGELOG and version history are primary evidence sources for software-driven causes.

**The output of RCA is a ranked set of hypotheses with supporting evidence — not a single confirmed cause.** Name the most supported hypothesis and the evidence that would confirm or refute it.

---

## 2. RCA Protocol

### Step 1 — Define the Effect Precisely

Before generating hypotheses, define exactly what needs to be explained:
- Which metric moved?
- By how much? (Absolute and relative.)
- In which direction?
- Over what time period?
- In which scope? (Workspace / team / tier.)
- When did it start? (Exact period, not approximate.)

Vague effects produce vague hypotheses. "Attendance seems off" is not an effect definition. "Clock-in rate for Team A dropped from 94% to 76% in the week of 2026-05-05, after being stable at 90–95% for the prior 8 weeks" is.

### Step 2 — Software Cause Check (Always First)

For every RCA in Effectime, the first hypothesis to check is software causation — not business causation.

Run the version-induced anomaly check from `prompts/anomaly_detection.md` Section 3 before proceeding.

If a software cause is found, it must be presented as the primary hypothesis. Do not bury it in a ranked list as hypothesis 3 or 4.

### Step 3 — Generate Business Cause Hypotheses

After confirming or ruling out software causes, generate business cause hypotheses using the six cause categories:

| Cause category | Question to ask |
|---|---|
| People | Did headcount, management, or role composition change in this scope? |
| Process | Did a policy, rule, schedule template, or approval workflow change? |
| External event | Was there a holiday, external event, or workforce disruption? |
| Data / measurement | Did the metric's measurement change without a software change? (Manual data entry error, bulk import, correction event.) |
| System / integration | Did an external system (Jira, payroll, HR import) behave differently? |
| Structural / scope | Did the population of the metric change? (New team added, workspace tier upgraded, workspace split or merged.) |

For each category, generate the most plausible specific hypothesis given the metric, time window, and scope.

### Step 4 — Gather Evidence

For each hypothesis, collect supporting or refuting evidence:

| Evidence source | Useful for |
|---|---|
| `CHANGELOG.md` | Software changes, feature rollouts, hotfixes |
| `versioning/*.md` | Technical detail on software deliveries |
| `supabase/migrations/` | Schema changes, default values, column additions |
|`supabase/functions/` | Aggregation logic changes |
| `codingLessonsLearnt.md` | Known bugs, previous failure patterns |
| Application event logs | User actions, role changes, workspace events |
| Calendar / external context | Holidays, known events |
| Integration sync logs | External system behavior |

### Step 5 — Weight the Evidence

For each hypothesis, assign:
- **Evidence strength**: strong (direct evidence from a reliable source), moderate (circumstantial evidence), weak (plausible but unverified).
- **Confidence level**: high (evidence directly confirms the hypothesis), medium (evidence is consistent with the hypothesis but not exclusive), low (hypothesis is plausible but no supporting evidence found).

Do not present equal confidence for all hypotheses. Rank them.

### Step 6 — Identify the Confirmation Test

For the top-ranked hypothesis, define exactly what would confirm or refute it:
- "To confirm software causation: compare daily metric values before and after [deployment date] using the same computation formula."
- "To confirm people cause: check `members` table for headcount changes in Team A in the relevant period."
- "To confirm process cause: check `compliance_rules` for any rule configuration changes in the week of [date]."

If no confirmation test exists, the hypothesis cannot be elevated to confirmed cause status.

---

## 3. Cause-vs-Symptom Discipline

RCA commonly mistakes symptoms for causes. Apply this test to each candidate cause:

> "If I fix [candidate cause], will the metric return to normal?"

If the answer is "yes, and only this cause would do it," the candidate is a root cause.

If the answer is "no, other things would also need to change," the candidate is either a contributing factor or a symptom of a deeper cause. Go one level deeper.

**Example**: "Shift fill rate dropped because fewer workers accepted marketplace listings." This is a symptom, not a cause. The cause is: why did fewer workers accept listings? (Pay rate, listing timing, worker availability, notification system failure, marketplace feature not accessible on current tier.)

---

## 4. Correlation vs. Causation Protocol

When two metrics move together, apply the following before claiming a causal relationship:

1. **Temporal order**: Does cause precede effect? If the proposed cause happened after the effect, it cannot be the cause.
2. **Plausible mechanism**: Is there a logical, specific mechanism by which the proposed cause produces the effect?
3. **Alternative explanation**: Could a third factor (confound) explain both movements simultaneously?
4. **Scope match**: Did the proposed cause affect exactly the same population as the observed effect? If the cause is workspace-wide but the effect is team-specific, the link is weak.

If temporal order, mechanism, and scope match all hold, and no strong confound is identified: the causal claim is plausible and can be stated as a supported hypothesis.

If any of the three tests fail: state "correlation observed, causal link not established" and name which test failed.

---

## 5. Output Format

```
Root Cause Analysis
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- Metric: [name + definition]
- Effect: [precise description — value, magnitude, direction, period, scope]
- Data source: [table / component]
- Data quality: [complete / partial / uncertain]

Software Cause Check
- CHANGELOG reviewed: [yes — entries found / yes — no relevant entries]
- Migrations reviewed: [yes — relevant migrations found / yes — none in period]
- Software cause verdict: [ruled out / possible — [specific entry] / confirmed — [specific entry]]

Business Cause Hypotheses (ranked by evidence strength)

Rank 1 — [Hypothesis name]
- Category: [People / Process / External / Data / System / Structural]
- Evidence: [source and finding]
- Evidence strength: [strong / moderate / weak]
- Confidence: [high / medium / low]
- Confirmation test: [what would confirm or refute this]

Rank 2 — [Hypothesis name]
[same structure]

Rank 3 — [Hypothesis name]
[same structure]

Correlation vs. Causation Assessment (if correlated metrics cited)
- Temporal order: [pass / fail]
- Plausible mechanism: [yes / no — explanation]
- Alternative explanation (confound): [identified / not found]
- Conclusion: [causal link supported / correlation only / link refuted]

Primary Recommendation
[The single most supported cause + the action that follows from it]

Open Questions
[What must be verified before the cause can be confirmed]

Confidence Assessment
- Overall confidence: [high / medium / low]
- Caveats: [list]
- Version notes: [relevant CHANGELOG entries]
- Next analytical step: [what to do next]
─────────────────────────────────────────────────────────
```
