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
│   ├── narrative_storytelling.md       Data storytelling, BI narrative craft, audience adaptation
│   ├── forecasting_methodology.md      Master forecasting framework — read before any predictive work
│   ├── seasonal_pattern_library.md     Documented seasonal patterns for all Effectime metrics
│   ├── workforce_demand_forecasting.md Shift demand projection, methods D-1 through D-4
│   ├── turnover_risk_scoring.md        Employee departure risk scoring from behavioural signals
│   ├── wellbeing_trajectory_forecasting.md  Score projection, burnout timeline, team risk tiers
│   ├── financial_forecasting.md        Labor cost projection, overtime budget, payroll trends
│   ├── scenario_modeling.md            What-if analysis, decision impact, scenario comparison
│   └── capacity_demand_gap_forecasting.md  Forward supply-demand gap with intervention windows
├── templates/
│   ├── bi_report_template.md           Standard BI report structure (10-section)
│   ├── metric_definition_template.md   Canonical metric definition format (10-section)
│   ├── board_report_template.md        Formal board-level report structure (9-section)
│   └── forecast_report_template.md     Standard forecast output structure (10-section)
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
| **Predictive analytics — read first** | `prompts/forecasting_methodology.md` |
| Look up seasonal patterns for any metric | `prompts/seasonal_pattern_library.md` |
| Forecast shift demand or staffing needs | `prompts/workforce_demand_forecasting.md` |
| Score employee or team departure risk | `prompts/turnover_risk_scoring.md` |
| Project wellbeing score or burnout timeline | `prompts/wellbeing_trajectory_forecasting.md` |
| Forecast labor cost or overtime budget | `prompts/financial_forecasting.md` |
| Model what-if scenarios / decision options | `prompts/scenario_modeling.md` |
| Forecast capacity-demand gap over N weeks | `prompts/capacity_demand_gap_forecasting.md` |
| Define a new metric formally | `templates/metric_definition_template.md` |
| Structure a standard BI report | `templates/bi_report_template.md` |
| Structure a board-level report | `templates/board_report_template.md` |
| Structure a forecast output | `templates/forecast_report_template.md` |
| Get copy-paste prompt examples | `examples/usage_examples.md` |
