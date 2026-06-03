# Competitor Feature Prompts — Gap-Closing Backlog

**Created:** 2026-06-03 (v3.49.6)
**Owner:** Product + Growth
**Purpose:** Each file in this folder is a **drop-in prompt for an AI build agent** describing a high-value feature that one or more direct competitors ship today but Effectime does **not** yet have. The prompts are ranked by competitive damage avoided × conversion lift × build cost.

> ⚠️ These prompts are **specifications only**. They are NOT to be auto-implemented. A human PM must triage, prioritise and convert them into PR-scoped tickets following the standard `versioning/` + `marketing/marketing_values/` workflow.

## Competitor benchmark snapshot

| Competitor | Strongest differentiators we lack |
|---|---|
| **Absentify** (absentify.com) | Microsoft Teams native bot (request leave inside Teams chat), Outlook calendar 2-way sync, public holidays auto-import per country, beautiful onboarding wizard, free tier up to 7 users |
| **Vacation Tracker** | Slack + Teams + Google Workspace bots, leave balance auto-accrual rules engine, multi-level approval chains, mobile app, GDPR data-residency selector |
| **Resource Guru** | Drag-and-drop visual scheduler with conflict detection, utilisation reports, project booking forecasts, client/project hierarchy, public booking link |
| **Humanforce** | Award/compliance engine (labour law rule pack), shift-bidding marketplace, biometric clock-in, payroll exports (10+ providers) |
| **When I Work** | Free shift swap marketplace between employees, in-app team chat, GPS clock-in, auto-scheduling AI |
| **Deputy** | AI demand forecasting → auto-generated optimal shifts, POS sales-data integration, training & certification expiry tracking |
| **Nexum / Humanity** | 24/7 SLA support, ISO 27001 cert, SSO/SAML, SCIM provisioning |

## Prompt index

| # | File | Feature | Source competitor | Effort | Strategic value |
|---|---|---|---|---|---|
| 01 | `01_teams_native_leave_bot.md` | Request leave inside MS Teams chat | Absentify, Vacation Tracker | M | High (Teams is HU enterprise default) |
| 02 | `02_outlook_2way_calendar_sync.md` | Bi-directional Outlook calendar sync | Absentify | M | High |
| 03 | `03_public_holidays_auto_import.md` | Per-country statutory holidays auto-import | Absentify, Vacation Tracker | S | Medium-High |
| 04 | `04_leave_accrual_rules_engine.md` | Auto-accrual rules (proportional, anniversary, carry-over) | Vacation Tracker, Humanforce | L | High |
| 05 | `05_multi_level_approval_chains.md` | Configurable N-level approval workflows | Vacation Tracker, Deputy | M | Medium-High |
| 06 | `06_drag_drop_scheduler_conflicts.md` | Drag-drop scheduler with live conflict detection | Resource Guru, When I Work | L | Critical (parity gap) |
| 07 | `07_utilisation_capacity_reports.md` | Utilisation + billable-hour dashboards | Resource Guru | M | High |
| 08 | `08_shift_swap_marketplace.md` | Employee-to-employee shift swap marketplace | When I Work, Deputy | M | High |
| 09 | `09_ai_demand_forecasting.md` | AI auto-generated shift plans from demand signals | Deputy | L | Strategic moat |
| 10 | `10_mobile_native_app.md` | Native iOS + Android app (Capacitor wrapper exists, productise it) | All major | M | Critical (mobile-first HU workforce) |
| 11 | `11_payroll_export_pack.md` | Magyar bérprogram exportok (Nexon, Nexum, SAP, KultúrSoft, Kulcs-Soft) | Humanforce | M | HU-specific moat |
| 12 | `12_labour_law_compliance_engine.md` | Mt. 2012/I rule-pack (pihenőidő, túlóra plafon, éjszakai pótlék) | Humanforce | L | Compliance-led sale |
| 13 | `13_sso_saml_scim_pack.md` | Enterprise auth: SSO, SAML 2.0, SCIM provisioning | Nexum, Humanity | M | Required for >250 fő deals |
| 14 | `14_in_app_team_chat.md` | Lightweight in-app team chat tied to shifts | When I Work | M | Medium |
| 15 | `15_geo_gps_clock_in.md` | GPS-validated clock-in for field teams | When I Work, Deputy | M | Vendéglátás + építőipar |
| 16 | `16_training_certification_expiry.md` | Skill / certification expiry tracking & alerts | Deputy | S | Egészségügy + ipar |
| 17 | `17_onboarding_wizard_redesign.md` | Sub-3-minute onboarding wizard | Absentify | S | Activation lift |
| 18 | `18_public_booking_share_link.md` | Public booking / availability share-link | Resource Guru | S | Freelance + agency |

## How to use a prompt

1. PM reviews the prompt and confirms business priority.
2. Convert prompt to a versioning entry under `versioning/`.
3. Hand the prompt to the build agent as the task input — the prompt is self-contained (problem, user story, acceptance criteria, anti-regression, telemetry, locale keys).
4. After delivery, write the matching `marketing/marketing_values/` file referencing the competitor parity claim that is now true.

## Ranking methodology

Each prompt is scored on:
- **Competitive damage avoided** (1–5): how often does this come up as a lost-deal reason
- **Conversion lift** (1–5): expected uplift on landing → trial → paid
- **Build cost** (S/M/L): rough engineering investment
- **Strategic value** = `(damage_avoided × conversion_lift) / build_cost_weight`

Top 5 by strategic value: **#06 (scheduler), #10 (mobile), #01 (Teams bot), #12 (labour law engine), #11 (payroll exports)**.
