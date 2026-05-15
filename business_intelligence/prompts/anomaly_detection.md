# Anomaly Detection Prompt — Outlier Identification, Triage, and Root Classification

> **When to use this file:** When a metric value or pattern looks unexpected, when a data point falls outside normal range, when a sudden shift appears in a dashboard, or when something looks "wrong" in the data.

---

## 1. Anomaly Taxonomy

Not all anomalies have the same cause or the same urgency. Classify the anomaly before investigating.

### Type A — Statistical Outlier
A single value or short sequence that deviates significantly from the surrounding distribution.
- Detection method: value exceeds mean ± 2σ, or exceeds 1.5 × IQR above Q3 / below Q1.
- Urgency: investigate only if it persists beyond one period or if the metric has a compliance or safety implication.
- Common cause in Effectime: bulk import, end-of-period batch operation, test data, or a single large workspace event.

### Type B — Business-Logic Anomaly
A value that is mathematically normal but violates a business expectation.
- Examples: Clock-in rate of 100% on a day with known public holidays. Compliance score of 100% immediately after a new compliance rule was added. Survey response rate above 95% in a workspace with historically low engagement.
- Detection method: Domain knowledge check — is this value possible? Is it plausible?
- Urgency: high. Business-logic anomalies often indicate data quality problems or feature behavior bugs.

### Type C — Version-Induced Anomaly
A sudden shift coinciding with a software deployment.
- Detection method: Compare anomaly date against `CHANGELOG.md` and `supabase/migrations/` dates.
- Urgency: medium to high depending on whether the shift affects historical data (schema migration) or only forward data.
- This is the first hypothesis to check for any anomaly in Effectime.

### Type D — Seasonal / Calendar Anomaly
A deviation that is expected given the calendar context.
- Examples: Attendance drop on public holidays, overtime spike at month-end, wellbeing score dip after a survey cycle.
- Urgency: low. Document and annotate. Do not generate alerts on expected seasonal patterns.

### Type E — Integration-Induced Anomaly
A value affected by an integration failure, delayed sync, or external system change.
- Examples: Jira sync rate drops to 0% when Azure DevOps token expires. Agile backlog issue count spikes after a bulk import from Jira. Agile field coverage drops after a workspace reconfigures its board fields.
- Detection method: Check `integration_sync_logs` and `CHANGELOG.md` for integration-related entries.
- Urgency: medium. Affects data reliability, not business reality.

---

## 2. Anomaly Detection Protocol

### Step 1 — Characterize the Anomaly

Establish:
- Which metric is anomalous?
- What is the observed value vs. the expected range?
- When did the anomaly appear? (Exact period, not just "recently.")
- Is it a single point or a sustained shift?
- Which workspace(s) and scope does it affect?

### Step 2 — Type Classification

Work through the taxonomy above in this order:
1. Type C (version-induced) — check CHANGELOG first, always.
2. Type E (integration-induced) — check integration logs.
3. Type B (business-logic) — apply domain knowledge.
4. Type D (seasonal) — check calendar context.
5. Type A (statistical outlier) — apply statistical check last.

The correct order matters. Version-induced and integration-induced anomalies are the most common in an actively developed SaaS, and they are the most dangerous to misclassify as business events.

### Step 3 — Collect Evidence

For each candidate type, gather evidence from:

| Evidence source | What to check |
|---|---|
| `CHANGELOG.md` | Deliveries within ±7 days of anomaly date |
| `versioning/*.md` | Technical details of relevant deliveries |
| `supabase/migrations/` | Schema changes within ±7 days of anomaly date |
| `supabase/functions/` | Edge function changes in same window |
| `src/components/analytics/` | Display logic changes that could cause visual anomaly |
| Integration logs | Sync errors, token expiry, rate limit events |
| Calendar | Public holidays, known events in the period |

### Step 4 — Assign Severity

| Severity | Criteria | Recommended action |
|---|---|---|
| Critical | Compliance or safety metric anomaly, sustained ≥ 3 periods | Escalate immediately, halt reporting until validated |
| High | Business-logic anomaly or version-induced anomaly affecting historical data | Investigate before next reporting cycle |
| Medium | Statistical outlier in a non-compliance metric, or integration-induced anomaly | Monitor for recurrence, document |
| Low | Type D (seasonal / calendar) | Annotate and continue |

### Step 5 — Validate or Dismiss

An anomaly is validated when:
- The root cause is identified with supporting evidence.
- The affected data scope is defined (which workspaces, which periods).
- The downstream impact on other metrics is assessed.

An anomaly is dismissed when:
- It is confirmed as Type D (seasonal) with a documented seasonal pattern.
- It is a one-off test event with no business significance.
- The "anomaly" is a display artifact with no data source impact.

Do not dismiss an anomaly before completing Step 3. "It looks like a one-off" is not evidence.

---

## 3. Version-Induced Anomaly Checklist

When any anomaly cannot be immediately explained by business data, run this checklist:

- [ ] Open `CHANGELOG.md`. Find all entries within ±7 days of the anomaly date.
- [ ] Read the relevant `versioning/*.md` file for technical detail.
- [ ] Check `supabase/migrations/` for schema changes to the affected metric's source table.
- [ ] Check `supabase/functions/` for logic changes to aggregation or computation.
- [ ] Check whether the anomaly date matches any delivery or hotfix in the branch history.
- [ ] Determine whether the software change could explain the metric shift in the observed direction.
- [ ] If yes: classify as Type C, document, and recommend validating pre-change historical data.
- [ ] If no: proceed to other anomaly types.

---

## 4. Output Format

```
Anomaly Detection Report
─────────────────────────────────────────────────────────
BI Context
- CHANGELOG version: [version]
- Metric: [name + definition]
- Anomaly date/period: [exact date or range]
- Scope: [workspace / team / tier]
- Data source: [table / component]
- Data quality: [complete / partial / uncertain]

Anomaly Characterization
- Observed value: [value]
- Expected range: [range and basis for expectation]
- Deviation magnitude: [absolute and relative]
- Duration: [single point / sustained (N periods)]
- Type classification: [A / B / C / D / E — with brief justification]

Evidence Summary
- CHANGELOG evidence: [relevant entries or "none found in ±7-day window"]
- Migration evidence: [relevant migrations or "none found"]
- Integration evidence: [relevant sync events or "not applicable"]
- Calendar context: [holiday / event / seasonal pattern or "not applicable"]

Severity: [Critical / High / Medium / Low]

Root Cause Hypothesis (ranked)
1. [Hypothesis] — Evidence: [source] — Confidence: [high/medium/low]
2. [Hypothesis] — Evidence: [source] — Confidence: [high/medium/low]

Recommended Action
- Immediate: [what to do right now]
- Investigation: [what to verify before next report]
- Downstream impact: [which other metrics may be affected]

Confidence Assessment
- Overall confidence: [high / medium / low]
- Caveats: [list]
- Version notes: [relevant CHANGELOG entries]
- Next analytical step: [what increases confidence]
─────────────────────────────────────────────────────────
```
