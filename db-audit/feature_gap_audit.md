# Feature Gap Audit — Top 20 Value-Rocket Strategy

**Audit date:** 2026-05-13
**Scope:** Comparison of the 20 ranked growth features (Effectime Top 20 Value-Rocket Strategy doc)
against the actual codebase + Supabase project `oezlzzmzzvbvinuysxaz`.
**Method:** DB introspection (`features`, `tier_features`, table existence) +
codebase grep for matching components + edge function inventory + i18n locale check.

## Audit signals per rank

For each rank, we checked **6 signals**:
1. **`features.feature_key`** — does a catalog entry exist?
2. **Tier mapping** — is the feature assigned to at least one tier?
3. **Sample table exists** — does the data backbone exist in `public.*`?
4. **UI files** — count of `src/**/*.{ts,tsx}` files matching the feature's components.
5. **Edge function** — does `supabase/functions/<expected>/index.ts` exist?
6. **Routing** — does `features.route_path` populate for this feature?

## Result matrix

| # | Feature | feature_keys | Tier-mapped | Sample table | UI files | Edge fn | **Status** |
|---:|---|---|---|---|---:|---|---|
| 1 | AI Scheduling Copilot | ✅ 3/3 | ✅ | ✅ | **0** | ❌ | **MISSING (UI+edgefn, has catalog)** |
| 2 | M365/Google Workspace Integration | ✅ 3/3 | ✅ | ✅ | 10 | ✅ | **DONE** |
| 3 | Predictive Analytics Dashboard | ✅ 5/5 | ✅ | ✅ | 8 | ❌ | **PARTIAL (UI present, dedicated edge fn missing)** |
| 4 | White-label / Reseller Architecture | ✅ 1/1 | ✅ | ✅ | 3 | ❌ | **PARTIAL (BrandingManager exists; reseller portal/Stripe Connect missing)** |
| 5 | Payroll Engine Integration | ✅ 2/2 | ✅ | ✅ | 6 | ✅ | **DONE** |
| 6 | SOC 2 / ISO 27001 | ✅ 2/2 | ✅ | ✅ | 13 | ✅ | **DONE** |
| 7 | Mobile-First PWA / Offline | ❌ 0 | ❌ | n/a | **0** | n/a | **MISSING (no PWA scaffold; needs vite-plugin-pwa, service worker, IndexedDB)** |
| 8 | Burnout / Wellbeing Detection | ✅ 2/2 | ✅ | ✅ | 4 | ❌ | **PARTIAL (UI + tables present; scheduled scoring engine missing)** |
| 9 | Open API Platform | ✅ 1/1 | ✅ | ✅ | 9 | ❌ | **PARTIAL (DeveloperPortal UI present; public-api gateway edge fn missing)** |
| 10 | GPS/NFC/QR Clock-In | ✅ 4/4 | ✅ | ✅ | **0** | ❌ | **MISSING (attendance backend exists; mobile clock-in UI + geofence/NFC/QR engine missing)** |
| 11 | Skills & Competency Matrix | ✅ 2/2 | ✅ | ✅ | 3 | n/a | **DONE (catalog + UI in PositionPicker, BusinessRoleManager)** |
| 12 | Shift Marketplace | ✅ 1/1 | ✅ | ✅ | 2 | n/a | **PARTIAL (SubstituteInbox exists; full peer-to-peer trade flow missing)** |
| 13 | GDPR / Labor Law Compliance | ✅ 2/2 | ✅ | ✅ | 2 (i18n only) | ❌ | **MISSING (data_retention_policies table exists; WTD pre-publish blocker + violations table missing)** |
| 14 | Gamification / Engagement | ❌ 0 | ❌ | ❌ | **0** | ❌ | **MISSING — completely green-field** |
| 15 | Custom Report Builder | ✅ 3/3 | ✅ | ✅ | 8 | ✅ | **DONE** |
| 16 | DACH/CEE i18n Expansion | ✅ 2/2 | ✅ | ✅ | en/hu/cs/sk/pl ✅ | n/a | **PARTIAL (5 of 8 target locales done; de, at, ro missing)** |
| 17 | Customer Success Platform | ❌ 0 | ❌ | ❌ | **0** | ❌ | **MISSING — completely green-field** |
| 18 | AI Document Generator | ❌ 0 | ❌ | ❌ | **0** | ❌ | **MISSING — completely green-field** |
| 19 | Plugin Marketplace / Plugin Architecture | ❌ 0 | ❌ | ❌ | **0** | ❌ | **MISSING — completely green-field** |
| 20 | Candidate Scheduling / ATS Integration | ❌ 0 | ❌ | ❌ | **0** | ❌ | **MISSING — completely green-field** |

## Final classification

### DONE (5 ranks)
- **Rank 2** M365/Google Workspace Integration
- **Rank 5** Payroll Engine Integration
- **Rank 6** SOC 2 / Audit / Security Center
- **Rank 11** Skills & Competency Matrix
- **Rank 15** Custom Report Builder

### PARTIAL (5 ranks — UI exists, completion needed)
- **Rank 3** Predictive Analytics — UI dashboards exist, dedicated `analytics-engine` edge fn for forecasting missing
- **Rank 4** White-label / Reseller — BrandingManager exists; reseller portal + Stripe Connect + custom domain support missing
- **Rank 8** Burnout / Wellbeing — UI + tables exist; scheduled `wellbeing-engine` edge fn for periodic scoring + alerts missing
- **Rank 9** Open API Platform — DeveloperPortal UI exists; `public-api` gateway edge fn + webhook dispatcher missing
- **Rank 12** Shift Marketplace — SubstituteInbox exists; peer-to-peer trade with eligibility engine + manager approval missing
- **Rank 16** DACH/CEE i18n — 5 of 8 target locales done (en, hu, cs, sk, pl); German (de), Austrian (at), Romanian (ro) missing

### MISSING — UI + edge fn (4 ranks, catalog/tier mapping exists)
- **Rank 1** AI Scheduling Copilot — feature_keys + tiers exist, but no `ai-copilot` edge fn nor `CopilotPanel` UI
- **Rank 10** GPS/NFC/QR Clock-In — attendance backend exists, but no mobile clock-in UI + no geofence/NFC/QR validation engine
- **Rank 13** GDPR / Labor Law Compliance — `data_retention_policies` table exists, but no `compliance-engine` edge fn + no pre-publish WTD blocker + no violations table

### MISSING — completely green-field (5 ranks)
- **Rank 7** Mobile-First PWA / Offline — no service worker, no `vite-plugin-pwa`, no IndexedDB sync queue, no FCM push
- **Rank 14** Gamification & Engagement — no `achievements` table, no badge wall, no streak engine
- **Rank 17** Customer Success Platform — no health-score engine, no in-app onboarding checklist, no NPS automation
- **Rank 18** AI Document Generator — no document templates table, no Claude generation edge fn, no DocumentPreview UI
- **Rank 19** Extension Marketplace — no plugin manifest schema, no sandbox runtime, no marketplace UI
- **Rank 20** Candidate Scheduling — no candidates table, no ATS adapters, no public self-booking page

## Counted gaps

- **Truly green-field**: 6 ranks (7, 14, 17, 18, 19, 20)
- **UI/edge-fn gap (catalog ready)**: 3 ranks (1, 10, 13)
- **Partial completion**: 6 ranks (3, 4, 8, 9, 12, 16)
- **Done**: 5 ranks (2, 5, 6, 11, 15)

## Implementation strategy

**Cannot be done in a single session.** A realistic delivery cadence:

| Sprint | Ranks shipped | Rationale |
|---|---|---|
| **v3.18.x (this session)** | Rank 14 Gamification | Smallest scope, additive, demonstrates the full delivery template (DB + edge fn + UI + 5-locale i18n + route + tier mapping + governance) |
| v3.19.x | Rank 17 Customer Success Platform | Pure additive, single-tenant scope per row, ~4 tables |
| v3.20.x | Rank 13 GDPR/WTD Compliance Engine | High enterprise-sales unlock; closes a known PARTIAL |
| v3.21.x | Rank 12 Shift Marketplace (peer-to-peer trade flow) | Closes existing SubstituteInbox into full trade |
| v3.22.x | Rank 10 GPS/NFC/QR Clock-In | Mobile-first, cleanly-bounded |
| v3.23.x | Rank 8 Wellbeing Engine completion (scoring + alerts) | Promotes PARTIAL → DONE |
| v3.24.x | Rank 9 Public API Gateway + Webhook Dispatcher | Promotes PARTIAL → DONE |
| v3.25.x | Rank 4 Reseller Portal | Largest commercial impact among PARTIALs |
| v3.26.x | Rank 18 AI Document Generator | Self-contained; small Claude integration |
| v3.27.x | Rank 1 AI Scheduling Copilot | Largest impact, highest implementation cost; needs Anthropic API setup, tool-use loop, streaming |
| v3.28.x | Rank 16 DACH/CEE — add de, at, ro locales | i18n controller already in place; just translation pass |
| v3.29.x | Rank 3 Analytics — predictive forecasting engine | Builds on existing dashboards |
| v3.30.x | Rank 19 Plugin Marketplace skeleton | Architectural dependency on Rank 9 (API platform) being fully done |
| v3.31.x | Rank 20 Candidate Scheduling + ATS | Adjacent market expansion |
| **v3.32.x (final)** | Rank 7 Mobile PWA + Offline | Largest scope; touches build pipeline (vite-plugin-pwa), Capacitor plugins, FCM, IndexedDB sync — best done after the rest stabilize |

**This session's scope:** Rank 14 (Gamification) end-to-end as v3.18.0.

## Per-feature delivery template

To make subsequent sprints predictable, every new feature MUST include:

1. **DB migration** in `supabase/migrations/` (applied via MCP `apply_migration`)
2. **`features.feature_key`** entries in the catalog
3. **`features.route_path` + `features.menu_path`** populated
4. **`tier_features`** rows mapping the feature to applicable tiers
5. **`features.dependencies`** array if the feature requires another feature_key
6. **Edge function** in `supabase/functions/<name>/index.ts` (deployed via MCP `deploy_edge_function`) with the same auth pattern as `superadmin-hub`
7. **UI components** under `src/components/<domain>/` and a top-level page if needed under `src/pages/`
8. **`<Route>` entry** in `src/App.tsx` if a new top-level page is added (using `/w/:workspaceId/<rest>` per v3.16.0 governance)
9. **i18n keys** in ALL 5 locale files: `en.ts, hu.ts, cs.ts, sk.ts, pl.ts` per `localization_controller.md`
10. **Tier badge visibility** (per v3.17.0 governance) — if the feature is gated, show a "Locked / available in X tier" notice
11. **Tests** — unit test in `src/test/` if logic is non-trivial
12. **Verification** — `npx tsc --noEmit` and `npx vitest run` green
13. **CHANGELOG entry**, **versioning/<date>_vX.Y.Z_<slug>.md**, **marketing/marketing_values/<date>_vX.Y.Z_<slug>_marketing_value.md**
14. **Governance update** (`.governance/ui_ux_rules.md` and CLAUDE.md) if the feature introduces a new principle

## Reference

This audit was triggered by the user's request based on the document:
*"Effectime Enterprise — Top 20 Value-Rocket Growth Strategy"*, May 2026.
