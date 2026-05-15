# BI Documentation Prompt — Generating BI Documents from Repository Evidence

> **When to use this file:** When producing formal documentation for a metric, an analysis, a BI decision, a measurement framework, or an analytical finding that needs to be preserved as a versioned artifact.

---

## 1. When BI Documentation Is Required

BI documentation is required when:
- A new metric is defined or an existing metric's definition changes.
- An analytical finding is used to support a business decision.
- A BI framework is designed for a new workspace domain or product area.
- An anomaly is investigated and its root cause is confirmed or dismissed.
- A data quality issue is identified and resolved (or accepted with documented caveats).
- A cohort, funnel, or segment structure is established as a recurring analysis.

BI documentation is optional (but encouraged) for:
- Ad-hoc analyses that may be repeated in the future.
- BI output that informs a marketing claim (document the data basis).
- Trend analyses that establish a baseline for future comparison.

---

## 2. BI Document Types

### Type 1 — Metric Definition Document
Documents the formal definition of a metric, its source, computation, scope, polarity, and governance.

Use `templates/metric_definition_template.md` for this type.

### Type 2 — Analytical Finding Document
Documents a completed analysis: the question asked, the data used, the method applied, the findings, and the decision it informed or recommended.

Stored in `versioning/` with naming convention: `DDMMYYNNN_vX.Y.Z_bi-[slug].md`

### Type 3 — BI Framework Document
Documents a complete measurement framework for a domain, workspace type, or product area.

Stored in `versioning/` with naming convention: `DDMMYYNNN_vX.Y.Z_bi-framework-[slug].md`

### Type 4 — Data Quality Record
Documents a data quality investigation: what was found, what was ruled in/out, what the remediation was, and the ongoing caveats.

Stored in `versioning/` with naming convention: `DDMMYYNNN_vX.Y.Z_bi-dq-[slug].md`

### Type 5 — Anomaly Record
Documents a detected anomaly: characterization, type classification, investigation, root cause finding, and resolution.

Stored in `versioning/` with naming convention: `DDMMYYNNN_vX.Y.Z_bi-anomaly-[slug].md`

---

## 3. Repository Evidence Requirements

Every BI document must cite its repository evidence. Do not produce a BI document that references metrics, schema, or behavior without naming the source file.

Required evidence citations:

| Document type | Required citations |
|---|---|
| Metric definition | Source table from `supabase/migrations/`, display component from `src/components/`, any computation in `supabase/functions/` |
| Analytical finding | All metrics used (with source), CHANGELOG version at analysis time, any versioning file covering relevant changes |
| BI framework | Domain components reviewed, tables in scope, tier applicability from `src/lib/tiering/` |
| Data quality record | Tables assessed, migration files reviewed, known issues from `codingLessonsLearnt.md` |
| Anomaly record | CHANGELOG entries reviewed, migrations reviewed, integration logs reviewed |

---

## 4. Versioning and Naming Conventions

BI documents that are significant deliverables follow the repository versioning convention:

**File name format**: `DDMMYYNNN_vX.Y.Z_bi-[slug].md`

Where:
- `DDMMYY` = date in DDMMYY format (e.g., 150526 for 2026-05-15)
- `NNN` = two-digit sequence number for same-day files (01, 02, 03...)
- `vX.Y.Z` = the CHANGELOG version at time of document creation
- `bi-[slug]` = 2–5 word kebab-case descriptor (e.g., `bi-turnover-root-cause`, `bi-compliance-framework`, `bi-wellbeing-anomaly-q1`)

**Location**: `versioning/` folder (same as engineering delivery records).

BI documents that are informal or exploratory (ad-hoc analysis, working notes) do not require versioning file format. They may be stored in `business_intelligence/` or referenced in a versioning file summary.

---

## 5. Analytical Finding Document Structure

When documenting a completed analysis as a versioned artifact:

```
# BI Analytical Finding — [Topic]
Date: [YYYY-MM-DD]
Version: [CHANGELOG version at time of analysis]
Analyst: [AI session / human analyst]

## Question
[The exact business question this analysis addressed]

## Data Used
- Metric(s): [names + definitions]
- Time window: [start → end, granularity]
- Scope: [workspace / tier / team]
- Source tables: [list]
- Source components: [list]
- Data quality: [High / Medium / Low — reason if not High]

## Method
[How the analysis was performed — which prompt files were used, what checks were run]

## Findings
[Structured findings — use the output format from the relevant specialist prompt]

## Decision Informed
[What decision this analysis supports or recommends]

## Caveats
[All data quality issues, version notes, and confidence limitations]

## Next Steps
[Follow-up analyses recommended, monitoring actions, or decisions pending]
```

---

## 6. Metric Definition Document Structure

Use `templates/metric_definition_template.md` for the canonical format. This section provides the authoring guidance.

When writing a metric definition:
- Use the exact column name from the source table, not the display label.
- State the computation formula explicitly (not in pseudocode — in plain English that can be verified against the SQL).
- State what is excluded from the computation (soft-deleted records, test workspaces, incomplete periods).
- State the polarity: higher is better / lower is better / context-dependent.
- State the target or threshold if one is defined.
- State when this definition was last verified against the source code.

A metric definition that cannot be verified against the source code must be labeled as "unverified — display-layer inference only" until confirmed.

---

## 7. Integration with Marketing System

When a BI finding supports a marketing claim:
- Reference the analytical finding document in the `marketing_values/` file for the related feature.
- Do not make marketing claims based on BI outputs with medium or low data quality scores.
- Do not use aggregate BI outputs as if they represent all workspaces unless the aggregation scope explicitly covers all workspaces.

When the growth strategy or valuation toolkit requires BI inputs:
- Ensure the BI inputs are sourced from High quality data assessments only.
- Document the BI basis for each number used in `growth_strategy/data/` or `valuation/data/`.

---

## 8. Output Format

```
BI Document Generation
─────────────────────────────────────────────────────────
Document type: [Metric Definition / Analytical Finding / BI Framework / Data Quality Record / Anomaly Record]
Document file: [proposed versioning filename]
Version: [CHANGELOG version]
Date: [YYYY-MM-DD]

[Document content following the appropriate structure from Section 5 or templates/]

Repository evidence cited:
- [Source 1]: [file path]
- [Source 2]: [file path]

Governance checklist:
- [ ] All metrics defined with source citations
- [ ] Time window explicitly stated
- [ ] Scope explicitly stated
- [ ] Data quality assessed
- [ ] Confidence level assigned
- [ ] Version context stated
- [ ] Caveats disclosed
- [ ] Next steps defined
─────────────────────────────────────────────────────────
```
