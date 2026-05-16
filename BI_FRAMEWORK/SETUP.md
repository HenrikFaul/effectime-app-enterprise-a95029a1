# SETUP.md — Configure This Framework for Your Project

Complete this setup before using any prompt file. It dramatically improves AI accuracy — the AI will produce evidence-grounded, project-specific analysis instead of generic outputs.

**Fastest path: run the automated analyzer (Step 1), then review what it found (Step 2). Total time: under 5 minutes.**

---

## Step 1 — Run the automated setup analyzer

The `setup_analyzer.py` script deep-scans your repository and auto-fills `SYSTEM.md` Section 1. It reads:

| Source | What it extracts |
|---|---|
| `CHANGELOG.md` | Current version, version history location, domain signals |
| `versioning/` | Feature history, delivery types, business areas |
| `supabase/migrations/` | Database tables and views (your metric data sources) |
| `src/` or `app/` | Tech stack, dashboard components, framework |
| `docs/` | Architecture, data flow, entity descriptions |
| `growth_strategy/` | Business model, target market, positioning |
| `valuation/` | Key metrics tracked, business model signals |
| `package.json` / `README.md` | Project name, dependencies, tech stack |

```bash
# Run from inside the BI_FRAMEWORK folder:
python setup_analyzer.py

# Or from anywhere in the repo:
python BI_FRAMEWORK/setup_analyzer.py --repo-root /path/to/your/repo

# Preview without writing files:
python setup_analyzer.py --dry-run
```

**Output files:**
- `SYSTEM.md` — Section 1 pre-filled with detected values
- `setup_report.md` — full scan log: what was found, confidence levels, detected metrics, database tables, and what still needs manual review

**After running:** open `setup_report.md` to see what was detected and what needs correction.

---

## Step 2 — Review and correct SYSTEM.md Section 1

Open `SYSTEM.md` and verify every field the analyzer filled in. Fields marked `[not detected]` need manual completion. Fields with `medium` or `low` confidence in `setup_report.md` need verification.

The analyzer uses keyword signals — it is accurate for common patterns but cannot know everything about your business. Treat it as a first pass, not a final answer.

---

## Step 3 — Complete any fields not auto-detected

If the analyzer could not detect a field, fill it in manually in `SYSTEM.md` Section 1:

```
Project name: [your product or system name]
Domain: [SaaS / ecommerce / HR / fintech / logistics / healthcare / other]
Business model: [B2B / B2C / marketplace / subscription / transactional]
Primary BI audiences: [founders / executives / product managers / HR leaders / operations / investors]
Regulatory context: [GDPR / HIPAA / SOX / FCA / none / describe your compliance obligations]
```

---

## Step 4 — Supplement data source map

The analyzer detects your primary data source and key database tables automatically. Verify the detected values and supplement with sources it cannot see:

| Data category | Your source (table / API / file / tool) |
|---|---|
| Primary metrics database | [auto-detected or: PostgreSQL / BigQuery / Snowflake / Redshift] |
| Version/changelog history | [auto-detected or: CHANGELOG.md / Git tags / release notes / Jira] |
| Schema definitions | [auto-detected or: migrations/ folder / DBT models / ERD] |
| Dashboard/reporting layer | [auto-detected or: Metabase / Looker / Grafana / custom path] |
| Event tracking | [not auto-detected — Mixpanel / Segment / Amplitude / custom table] |
| Financial data | [not auto-detected — accounting system / billing table / data warehouse] |

---

## Step 5 — Build your metric catalog

The analyzer lists detected metrics in `setup_report.md`. Use that list as the starting point for `templates/metric_definition_template.md`. You do not need all metrics on day 1 — start with your top 10 decision-driving metrics.

A metric without a formal definition cannot be reliably analyzed by this system. The AI will flag undefined metrics rather than guessing.

Priority order for cataloguing:
1. Metrics that appear in board reports or investor updates.
2. Metrics that trigger operational decisions (thresholds, alerts).
3. Metrics that appear on dashboards used daily.
4. Metrics used in any compliance or regulatory reporting.

---

## Step 6 — Document your seasonal patterns

Open `prompts/seasonal_pattern_library.md` and add your domain's known seasonal patterns.

Every business has at least 3–5 recurring patterns. Examples by domain:

| Domain | Common patterns |
|---|---|
| SaaS / software | End-of-quarter pipeline spikes, January churn risk, summer low engagement |
| Ecommerce | Holiday season demand, post-holiday return spikes, Black Friday/Cyber Monday |
| HR / workforce | Holiday absence peaks, January hire surge, summer recruitment slowdown |
| Financial services | Month-end/quarter-end transaction spikes, tax season activity |
| Healthcare | Flu season patient volume, holiday staffing pressure |

If you have 12+ months of metric history, you can derive your own seasonal indices from data rather than using intuition.

---

## Step 7 — Set metric polarity and thresholds

For each metric in your catalog, define:
- **Polarity**: Is higher better, or lower better? (Some metrics are neutral — context-dependent.)
- **Target or benchmark**: What is the expected/goal value?
- **Warning threshold**: When should someone start paying attention?
- **Critical threshold**: When should someone escalate or act immediately?

Without these, the AI can describe metric values but cannot assess whether they are good, bad, or require action.

---

## Step 8 — Define your reporting audiences

In `SYSTEM.md` Section 7, define who receives BI outputs from this system:

```
Audience 1: [title] — Level: [board / executive / management / operational] — Cadence: [weekly / monthly / quarterly]
Audience 2: [title] — Level: [...]
```

This enables `prompts/executive_summary.md` and `prompts/narrative_storytelling.md` to calibrate depth and vocabulary for the stated audience.

---

## Step 9 — PII and privacy rules

State your privacy constraints explicitly. The framework applies conservative defaults, but your specific rules override them:

```
Minimum aggregation level: [individual / team (N ≥ X) / department / company]
Data access scope: [who can see individual-level data vs. aggregates only]
PII fields excluded from BI outputs: [list]
Regulatory framework: [GDPR / HIPAA / other — key constraint for BI outputs]
```

---

## Minimum viable setup (fastest path)

1. Run `python setup_analyzer.py` — under 30 seconds.
2. Review `setup_report.md` and correct any wrong inferences in `SYSTEM.md`.
3. Add 3–5 core metrics to `templates/metric_definition_template.md`.

Everything else can be completed iteratively as you use the system.

---

## When setup is complete

Give the AI this instruction at the start of every BI session:

> "Read BI_FRAMEWORK/SYSTEM.md first. Then read the relevant specialist prompt file. Apply the discovery protocol before producing any output."

Or with a shorter session opener once Section 1 is configured:

> "Read BI_FRAMEWORK/SYSTEM.md and route to [specialist file]. Apply to [metric / question / dataset]."
