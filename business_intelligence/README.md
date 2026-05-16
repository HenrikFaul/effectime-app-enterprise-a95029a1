# Business Intelligence — Entry Point

> **Start here.** Read `SYSTEM.md` before opening any other file in this folder.

---

## What this folder is

This is the Business Intelligence prompt architecture for Effectime. It is a structured, repository-aware BI reasoning system — not a collection of generic analytics prompts.

It covers the full BI lifecycle: from identifying the right question through locating evidence in the repository, interpreting metrics with correct business semantics, explaining variance, detecting anomalies, generating executive-ready narratives, and documenting BI decisions.

---

## Folder structure

```
business_intelligence/
├── SYSTEM.md                           Master controller — read first, always
├── README.md                           This file
├── prompts/
│   ├── bi_strategy.md                  BI philosophy, measurement priorities, framework design
│   ├── kpi_analysis.md                 KPI definition, performance assessment, variance analysis
│   ├── trend_analysis.md               Time-series patterns, direction confidence, trend breaks
│   ├── anomaly_detection.md            Outlier detection, triage, version-induced vs. business shifts
│   ├── dashboard_interpretation.md     Dashboard reading, chart critique, misinterpretation checks
│   ├── executive_summary.md            Board-ready narratives, executive communication structure
│   ├── data_quality.md                 Trust assessment, completeness checks, confidence scoring
│   ├── root_cause_analysis.md          Driver identification, hypothesis testing, evidence weighting
│   ├── segment_cohort_analysis.md      Segmentation, cohort behavior, funnel interpretation
│   ├── bi_documentation.md             BI document generation from repository evidence
│   ├── predictive_signals.md           Leading indicators, early warning systems, forward analysis
│   ├── financial_analytics.md          Labor cost, payroll accuracy, overtime economics
│   ├── compliance_analytics.md         Compliance score, violations, audit readiness, WTD risk
│   ├── workforce_planning.md           Capacity analysis, headcount planning, scheduling efficiency
│   ├── platform_health.md              SaaS adoption, workspace churn signals, integration health
│   ├── bi_governance.md                Metric consistency, definition auditing, BI quality control
│   └── narrative_storytelling.md       Data storytelling, BI narrative craft, audience adaptation
├── templates/
│   ├── bi_report_template.md           Standard BI report structure (10-section)
│   ├── metric_definition_template.md   Canonical metric definition format (10-section)
│   └── board_report_template.md        Formal board-level report structure (9-section)
└── examples/
    └── usage_examples.md               Copy-paste invocation patterns for common BI tasks
```

---

## Quick routing

| Task | Go to |
|---|---|
| Understand the BI system | `SYSTEM.md` |
| Analyze a KPI | `prompts/kpi_analysis.md` |
| Investigate a trend | `prompts/trend_analysis.md` |
| Investigate an anomaly | `prompts/anomaly_detection.md` |
| Read a dashboard | `prompts/dashboard_interpretation.md` |
| Write an executive summary | `prompts/executive_summary.md` |
| Assess data quality | `prompts/data_quality.md` |
| Find what caused a metric change | `prompts/root_cause_analysis.md` |
| Compare segments, cohorts, or funnels | `prompts/segment_cohort_analysis.md` |
| Document a metric or BI decision | `prompts/bi_documentation.md` |
| Identify leading indicators / early warnings | `prompts/predictive_signals.md` |
| Analyze labor cost or payroll accuracy | `prompts/financial_analytics.md` |
| Analyze compliance score or audit readiness | `prompts/compliance_analytics.md` |
| Analyze workforce capacity or scheduling | `prompts/workforce_planning.md` |
| Analyze platform adoption or churn risk | `prompts/platform_health.md` |
| Audit BI output quality or metric consistency | `prompts/bi_governance.md` |
| Turn data into a narrative or data story | `prompts/narrative_storytelling.md` |
| Define a new metric formally | `templates/metric_definition_template.md` |
| Structure a standard BI report | `templates/bi_report_template.md` |
| Structure a board-level report | `templates/board_report_template.md` |
| Get copy-paste prompt examples | `examples/usage_examples.md` |
