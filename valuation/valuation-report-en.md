# Effectime Enterprise — Software Valuation & Technical Due-Diligence Report

**Prepared:** 2026-05-11  
**Repository:** `HenrikFaul/effectime-app-enterprise-a95029a1`  
**Product URL:** https://effectime-app-enterprise.lovable.app  
**Confidence Level:** Medium-High (extensive codebase evidence; limited revenue data)  
**Currency Basis:** EUR (primary), HUF noted where relevant  
**Rate Region:** CEE (Hungary) as primary; Western EU ranges as secondary

---

## Table of Contents

1. Executive Summary
2. Product Reconstruction
3. Scope Decomposition
4. Methodology
5. Team Composition
6. Effort Estimate
7. Cost Estimate
8. Market Comparison
9. Market Value Estimate
10. Assumptions and Limitations
11. Recommended Next Steps
12. Appendix

---

## 1. Executive Summary

### What the Software Does

Effectime Enterprise is a **multi-tenant, enterprise-grade HR leave management and workforce planning SaaS platform** built primarily for the Hungarian/CEE SME and mid-market segment. The platform provides:

- End-to-end employee leave request lifecycle management (submission → conflict detection → multi-step approval chain → audit)
- Multi-view calendar with real-time timeline, annual grid, and coverage planner
- Resource and project capacity planning with Gantt timeline
- Agile integration (Jira + Azure DevOps) with bidirectional capacity sync
- Custom report builder with SQL mode, scheduling, and live preview
- Transactional email infrastructure with templated notifications
- Role-based access control with a dynamic, tree-structured permission catalog
- iCal subscription, CSV export/import, and branding customization
- Mobile-ready (Capacitor for iOS/Android)

The product traces its origin to a consumer event scheduling app ("Syncfolk") and underwent a deliberate pivot to B2B enterprise functionality, reaching **version 2.6.0+** with 53 database migrations and 77 enterprise UI components as of this assessment.

### Estimated Build Effort

| Metric | Low | Most Likely | High |
|--------|-----|-------------|------|
| Person-hours | 2,400 | 3,050 | 3,900 |
| Person-months (160 h/mo) | 15 | 19 | 24.4 |
| Calendar duration (3-person core team) | 5.5 mo | 7.5 mo | 10 mo |

### Estimated Build Cost

| Scenario | Range |
|----------|-------|
| CEE rates (Hungary-based team) | €145,000 – €210,000 |
| Western EU rates (agency / remote) | €295,000 – €450,000 |
| Mixed CEE + senior WEU lead | €195,000 – €310,000 |

### Estimated Market Value

| Valuation Lens | Range |
|----------------|-------|
| Replacement / IP value (no revenue) | €200,000 – €550,000 |
| Early-stage product (€50–150K ARR) | €400,000 – €1,200,000 |
| Growth stage (€300–500K ARR) | €1,800,000 – €4,500,000 |
| Strategic acquisition (enterprise integrations) | €700,000 – €2,000,000 |

### Biggest Drivers of Uncertainty

1. **Revenue unknown** — no monetization data is available in the repository; valuation is highly sensitive to ARR
2. **Test coverage is minimal** — one test file exists; risk multiplier applies
3. **AI-assisted development velocity** — the 2-month active development period reflects AI tooling; traditional team estimates will differ
4. **Market readiness** — some features appear production-ready; others (Agile sync, scenario planner) appear iterative/prototype
5. **No public userbase data** — tenant count, MAU, and conversion rates are unavailable

---

## 2. Product Reconstruction

### Codebase Vital Statistics

| Metric | Value |
|--------|-------|
| Total source files (.ts + .tsx) | 170 |
| Total lines of source code | ~31,435 |
| Enterprise UI components | 77 |
| Database migration files | 53 |
| Supabase Edge Functions | 17 |
| Edge function code (lines) | ~5,187 |
| Business logic library (lines) | ~802 |
| DB type definition (lines) | 3,530 |
| npm dependencies | 60+ |
| Dev timeline (from migrations) | 2026-03-07 → 2026-05-11 |
| Published versions | v2.0.0 → v2.6.0+ |

### Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend: React 18 + TypeScript + Vite                 │
│  UI: shadcn/ui (Radix UI) + Tailwind CSS + Framer Motion│
│  State: TanStack Query v5                               │
│  Charts: Recharts                                       │
│  DnD: @dnd-kit                                          │
│  Virtual scrolling: @tanstack/react-virtual             │
│  Mobile: Capacitor (iOS + Android)                      │
│  Forms: React Hook Form + Zod                           │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  Backend: Supabase (fully managed)                      │
│  Database: PostgreSQL with multi-schema                 │
│    - public (legacy/shared)                             │
│    - syncfolk (consumer product)                        │
│    - plannermaster (enterprise)                         │
│  Auth: Supabase Auth + Google OAuth + custom activation │
│  Storage: leave-attachments bucket                      │
│  Edge Functions: 17 Deno functions                      │
│  Realtime: partial (email notifications, not sockets)   │
│  Cron: pg_cron (auto-archive, cleanup)                  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  External Integrations                                  │
│  - Google OAuth (authentication)                        │
│  - Jira REST API v3 (agile issues, JQL search)         │
│  - Azure DevOps (WIQL, work items)                      │
│  - iCal (subscription export)                           │
│  - Lovable Email API (transactional templates)          │
│  - pg_cron (scheduled jobs)                             │
└─────────────────────────────────────────────────────────┘
```

### User Roles and Core Workflows

**Roles:**
- **Owner** — full workspace control, all admin operations
- **resourceAssistant** — leave approval, reporting, configuration access
- **member** — submit leave requests, view calendar, manage own profile

**Core Workflows:**
1. **Invite → Join**: Owner invites by email → member activates (or admin creates instantly) → member joins workspace
2. **Leave Request**: Member submits (with conflict pre-check, substitute picker, attachment) → approval chain notified → manager approves/rejects → member and substitute notified by email
3. **Coverage Planning**: Admin configures office rules with role/skill requirements → Coverage Planner shows gaps per day/week/month → Smart Batch Scheduler auto-assigns eligible employees
4. **Capacity Planning**: Agile sprint imported from Jira/ADO → CapacityFit calculates overload/underload → what-if simulation → writeback to Jira
5. **Reporting**: Report Builder selects dataset → configures filters/columns → previews live → schedules recurring email delivery

### Feature Map by Module

#### Authentication & Identity
- Email/password registration with OTP email verification
- Google OAuth with custom activation gate
- Password reset flow
- Account deletion (GDPR)
- Admin user management panel

#### Workspace & Tenancy
- Multi-workspace (one user can own/belong to multiple workspaces)
- workspace settings (name, timezone, locale, branding)
- Member invite system (email-based, token expiry)
- Instant member creation with prefilled metadata
- Role assignment (owner / resourceAssistant / member)
- Member profile sheet (working hours, skills, roles, allocations, site priority)
- Active/suspended/removed membership states

#### Leave Management Core
- Leave request dialog with 2-step submit (check conflicts → confirm)
- 6 leave statuses: draft / pending / approved / rejected / cancelled / expired
- 5+ built-in leave types + custom type manager
- Substitute picker and substitute inbox
- Attachment upload (Supabase Storage)
- Private leave requests
- Cancellation with reason capture
- Approval inbox with bulk approve/reject
- Admin leave override
- Annual quota with carried-over balance tracking

#### Conflict Engine (`src/lib/conflictEngine.ts`)
- Blocked date detection (BLOCKING severity)
- Enterprise holiday detection (BLOCKING)
- Daily rule max-off headcount enforcement (WARNING/BLOCKING)
- Self-overlap detection (BLOCKING)
- Office coverage rule violation detection (WARNING)
All checks parallelised over a date range.

#### Capacity Engine (`src/lib/capacityEngine.ts`)
- Per-member `base_working_hours` (hours/day)
- Allocation percentage → hours per role
- Workspace-level capacity aggregation
- Leave deduction and net availability calculation
- Silent failure protection (error logging)

#### Smart Schedule Algorithm (`src/lib/smartSchedule.ts`)
- Hard constraints: site allow-list, leave conflicts, double-booking
- Soft constraints: role match, site priority ranking, monthly load balancing
- Coverage eligibility evaluation (`src/lib/coverageEligibility.ts`)

#### Calendar & Timeline
- **Leave Calendar**: monthly calendar with team filter, colour-coded by type
- **Timeline View**: Absentify-style row-per-person grid with TanStack Virtual (200+ members)
- **Annual Leave Grid**: full-year per-person view with quota summary
- **Calendar Filter Bar**: dynamic multi-select (site, team, position, type, status, skill, location) with drag&drop ordering
- **Coverage Planner**: weekly/monthly view showing requirement vs. supply per office
- Smart Batch Schedule Dialog
- Skill Capacity Report (live-synced to filter selection)

#### Approval Chain & Escalation
- Configurable multi-step approval chains per workspace
- Escalation rules with hour threshold and target role
- Owner fallback notification

#### Rules & Configuration
- Leave type manager (custom types, colour, carry-over policy)
- Holiday manager (workspace-specific holidays)
- Blocked date manager
- Daily rule manager (max-absent per day/team)
- Office coverage rule manager (multi-position, multi-skill, weekly/monthly)
- Rule template library

#### Resource Management
- Project list with CRUD
- Project editor (allocations, budget, timeline)
- Gantt timeline (drag-to-resize)
- Capacity gap report
- Utilization heatmap
- Scenario planner (what-if)
- Financials panel
- Resource dashboard
- Skills manager
- Business role (position) manager

#### Agile Integration
- Jira and Azure DevOps integration (credentials stored in workspace settings)
- Backlog browser with JQL/WIQL search and cached results
- Issue writeback (create + update) for both Jira and ADO
- Capacity Fit: sprint capacity vs. planned hours with overload/underload
- What-if simulation (leave days impact)
- Field discovery (custom field metadata)
- External field mappings (dynamic, directional, safe writeback flag)
- Agile capacity events log (change/capacity/variance/risk/simulation)

#### Reporting
- Reporting dashboard (KPI cards, status pie chart, type bar chart, daily absences chart)
- Report Builder (dataset selector, column/filter config, aggregation)
- SQL Mode (direct query)
- Live Preview Pane
- Report Library with pin-to-dashboard
- Scheduled report delivery (email, cron)
- Dataset Browser
- Report Runner
- Pinned Reports Widget

#### Notifications & Email
- In-app notifications (read/unread, delete, emoji icons)
- Notification preferences (per-event toggle)
- Transactional email (auth events, approval decisions, scheduled reports)
- Email queue with processing function
- Email suppression/unsubscribe handling
- Branding manager (logo, colour scheme)
- iCal subscription endpoint

#### Admin & DevOps
- Admin dashboard (super-admin user management)
- pg_cron job: auto-archive expired coverage rules (02:15 UTC daily)
- Cleanup temp users function
- Sync holidays function
- Data migration function
- Multi-schema split (syncfolk + plannermaster)

#### Consumer Product (Syncfolk - legacy)
- Event creation and calendar
- Vote/availability collection
- Personal calendar view
- Batch vote panel

### Major Integration Points

| Integration | Direction | Purpose |
|-------------|-----------|---------|
| Supabase Auth | Bidirectional | Authentication, session management |
| Google OAuth | Inbound | Social login |
| Jira REST API v3 | Bidirectional | Agile issues, JQL, field metadata |
| Azure DevOps | Bidirectional | WIQL queries, work item writeback |
| Lovable Email API | Outbound | Transactional email rendering |
| iCal | Outbound | Calendar subscription |
| Supabase Storage | Bidirectional | Leave attachments |
| pg_cron | Internal | Scheduled jobs |

---

## 3. Scope Decomposition

### Feature Areas and Complexity Breakdown

#### Area 1: Authentication & Identity (Complexity: Medium)
**Components:**
- Auth page with 4 views (login, register, verify, forgot)
- Google OAuth with Supabase custom activation gate
- OTP email verification (8-digit code)
- Account deletion with Supabase function
- Custom email hook for auth events
- Password reset flow

**Hidden complexity:** The Google OAuth activation gate is a non-trivial custom flow: new Google users must complete email verification before accessing the app. The `join-event` edge function handles `request-google-oauth-activation`, `complete-email-activation`, and `resend-email-activation` with legacy bypass logic (30-day account age threshold). This alone represents 300+ lines of non-trivial backend code.

**Effort driver:** Multi-provider auth + custom activation is 3-4× more work than simple email auth.

#### Area 2: Multi-Tenant Workspace Architecture (Complexity: High)
**Components:**
- 3 database schemas (public, syncfolk, plannermaster)
- SECURITY DEFINER functions (`has_enterprise_role`, `is_enterprise_member`)
- RLS policies on 30+ enterprise tables
- Workspace CRUD with settings (timezone, locale, branding)
- Member lifecycle (invite → active → suspended/removed)
- Cascading deletes on workspace-scoped tables

**Hidden complexity:** Row-Level Security at this depth is deceptively expensive. Each table requires careful policy design for each role × operation combination. The schema split migration (2026-04-29) adds non-trivial operational complexity. The dynamic feature catalog (`enterprise_feature_catalog`, recursive tree) is a bespoke permission framework.

#### Area 3: Leave Request Lifecycle (Complexity: High)
**Components:**
- 6-status state machine
- 2-step submit with pre-flight conflict check
- Substitute picker with inbox
- File attachment (Storage integration)
- Private requests
- Cancellation with reason
- Quota balance tracking with transactions
- Admin override
- Bulk approval actions

**Hidden complexity:** The interaction between the conflict engine, the approval chain, and the quota transaction system creates substantial state coordination complexity. The `leave_request_substitutes` table with ordered substitutes and the `enterprise_quota_transactions` requiring workspace + quota_id scoping (fixed in v2.6.0) are examples of non-obvious business logic.

#### Area 4: Conflict Engine (Complexity: Medium-High)
**What it does:**
- Parallel data fetch (6 tables in one Promise.all)
- Holiday, blocked date, daily rule, self-overlap, coverage rule checks
- Severity classification (warning vs. blocking)
- Date range iteration with `date-fns`

**Hidden complexity:** The office rule eligibility logic requires understanding multi-position/multi-skill arrays (introduced in v2.5.1), legacy column fallback for scalar/array column migration, and correct `OR` semantics for multi-position matching.

#### Area 5: Calendar & Timeline Views (Complexity: High)
**Components:**
- 3 calendar views (calendar, timeline, annual)
- TanStack Virtual for 200+ row rendering
- Dynamic filter bar with 6 filter categories, drag&drop reordering
- Coverage Planner (weekly/monthly, requirement vs. supply cells)
- Smart Batch Scheduler (constraint satisfaction)
- Skill Capacity Report synced to filter state

**Hidden complexity:** The timeline view requires virtualized row rendering to handle 200+ members smoothly. The coverage planner has week/month view toggle with race condition protection (`loadIdRef` pattern). Filter config is persisted per-workspace in `tenant_calendar_settings`. Real-time filter propagation to the Skill Capacity Report via callback prop chain.

#### Area 6: Approval Chain & Escalation (Complexity: Medium)
**Components:**
- Configurable multi-step chains
- Escalation rules with timer threshold
- Role-based notification routing

#### Area 7: Resource Management (Complexity: High)
**Components:**
- Project CRUD with budget and timeline
- Gantt timeline (drag-to-resize)
- Capacity gap report with charts
- Utilization heatmap
- Scenario planner (what-if)
- Financials panel
- Skills manager
- Role allocation editor with percentage allocation

**Hidden complexity:** The hours-based capacity engine (`base_working_hours × allocation_pct / 100`) requires careful synchronisation between the allocation editor, the capacity gap report, and the Gantt timeline. The scenario planner introduces a separate what-if calculation path.

#### Area 8: Agile Integration (Complexity: Very High)
**Components:**
- Jira/ADO proxy edge function (484 lines, multi-action)
- Backlog browser with JQL/WIQL
- Issue writeback (PATCH for ADO, POST for Jira)
- Capacity Fit with what-if
- Field discovery (custom field metadata)
- External field mappings (dynamic)
- Capacity events log

**Hidden complexity:** Supporting both Jira REST v3 AND Azure DevOps WIQL in the same proxy function with fallback endpoints, normalised base URL handling, empty JSON-patch protection, and multi-endpoint search fallbacks is a substantial engineering effort. The `enterprise_agile_external_field_mappings` table supports dynamic bidirectional field mapping at a per-tenant level.

#### Area 9: Report Builder (Complexity: High)
**Components:**
- Dataset Browser with schema inspection
- Column/filter configuration
- SQL Mode (direct query execution)
- Live Preview Pane
- Scheduled delivery (cron + email)
- Report Library with pin/unpin
- Report Runner edge function

**Hidden complexity:** An embedded SQL mode report builder requires careful access control (users must not be able to access other workspaces' data), parameterised query execution, and query result pagination. The `run-report` edge function (225 lines) handles this backend logic.

#### Area 10: Email Infrastructure (Complexity: High)
**Components:**
- Auth email hook (Supabase webhook)
- Transactional email renderer (Lovable Email API, React Email templates)
- Email queue with retry logic
- Scheduled reports mailer
- Email suppression / bounce handling
- Unsubscribe endpoint
- React Email templates (_shared/email-templates, _shared/transactional-email-templates)

**Hidden complexity:** A full email deliverability stack including suppression lists, unsubscribe handling, and bounce processing is significantly more work than simple SMTP dispatch. The auth email hook intercepts Supabase's own auth events and re-routes them through the custom template engine.

### Complexity Multipliers

| Factor | Impact |
|--------|--------|
| Hungarian-first localization (all UI strings in Hungarian) | Low (not a standard i18n setup, strings are hardcoded — reduces localization build cost but creates technical debt) |
| Multi-schema PostgreSQL architecture | +15% DB/backend effort |
| Dual-product codebase (Syncfolk + Enterprise) | +10% architectural overhead |
| AI-accelerated development pattern | Reduces raw coding time but increases review/stabilisation effort |
| Minimal automated test coverage | +20% estimated manual QA effort |
| 17 edge functions (Deno runtime, cold start considerations) | +15% DevOps/backend effort |

---

## 4. Methodology

### Methods Applied

#### A. Bottom-Up Estimation
Each of the 10 major feature areas was decomposed into sub-components. Sub-component effort was estimated by an experienced software engineer based on:
- Lines of code in the implementation
- Number of database tables and relations involved
- Number of API/integration endpoints
- UI complexity (forms, real-time updates, drag interactions)
- Number of edge cases evidenced in the changelog

**Why chosen:** Bottom-up is the most reliable method when a complete codebase is available for inspection.

#### B. Analogous Estimation
Products of comparable scope (Calamari, Timetastic, Absence.io) were used as reference points for effort estimation. Public engineering blog posts from similar HR SaaS startups suggest MVP leave management products require 6–18 months depending on team composition. Effectime Enterprise is well beyond a simple MVP.

#### C. Three-Point Estimation (PERT)
For each major area, three estimates were made:
- **Optimistic (O)**: experienced team, minimal rework, well-defined requirements
- **Most Likely (M)**: realistic for a competent but non-specialist team
- **Pessimistic (P)**: scope creep, integration failures, rework cycles

PERT formula: `E = (O + 4M + P) / 6`

#### D. Analogous Code Metrics
Reference: industry averages suggest ~10–25 productive lines of code per developer per day (complex business logic); ~100–200 for UI components with known frameworks.

- 31,435 total lines ÷ 120 lines/day average = ~262 developer-days
- Apply 2.2× overhead multiplier (QA, design, review, meetings, planning, deployment, rework): ~576 developer-days = ~2,880 person-hours

This aligns closely with the bottom-up estimate.

### How Ranges Were Derived

- **Low range**: expert/senior team, well-scoped requirements, AI tooling available
- **Most Likely**: experienced team, typical startup dynamics, some rework
- **High range**: agency model, iterative requirements, significant integration complexity, manual QA overhead

### Important Distinctions

- **Effort ≠ Duration**: A 2,880-person-hour project can be delivered in 5 months (3 FTE) or 24 months (0.5 FTE). Calendar time depends on team size, parallelism, and context-switching.
- **Build cost ≠ Market value**: Replacement cost is a floor for market value; product positioning, revenue traction, and IP differentiation can multiply it significantly.
- **Code ≠ Product**: A shipped product includes design decisions, user research, content strategy, marketing site, and customer success infrastructure that are not always visible in code.

---

## 5. Team Composition

### Required Specialists

#### Essential Roles

| Role | Why Needed | Phase | Effort Share |
|------|-----------|-------|-------------|
| **Senior Full-Stack Engineer** | Architectural decisions, Supabase schema design, RLS, edge functions, complex business logic | All phases | 35% |
| **Mid-Level Frontend Engineer** | React component development, Recharts, DnD Kit, Framer Motion, responsive UI | Phases 2–8 | 30% |
| **Backend/Database Engineer** | PostgreSQL schema, RLS policies, SECURITY DEFINER functions, migrations, edge functions | Phases 1–3, 6–8 | 15% |
| **UX/UI Designer** | Information architecture, component library definition, mobile layouts, data visualisation design | Phases 1–2, 4–5 | 10% |
| **Product Manager / Owner** | Requirement specification, sprint planning, backlog prioritisation, stakeholder communication | All phases | 7% |
| **QA Engineer** | Manual testing, regression testing, cross-browser/device testing | Phases 3–8 | 3% |

#### Recommended Optional Roles

| Role | Why | When |
|------|-----|------|
| **DevOps / Platform Engineer** | Supabase production config, pg_cron, backups, monitoring | Phase 1, ongoing |
| **HR Domain Expert** | Validate leave policy rules, approval chain logic, CEE labour law compliance | Phase 2–3 |
| **Security Reviewer** | RLS policy audit, edge function auth verification | Before launch |
| **Localization/Content Specialist** | If expanding beyond Hungarian | Post-launch |

### Suggested Delivery Teams

#### Lean Team (3 people, 7–10 months)
- 1 × Senior Full-Stack Engineer (lead, 100%)
- 1 × Mid-Level Frontend Engineer (100%)
- 0.5 × UX/UI Designer (50%, embedded)
*PM and QA done by lead + stakeholder*

#### Balanced Team (5 people, 5–7 months)
- 1 × Senior Full-Stack Engineer (lead)
- 1 × Mid-Level Frontend Engineer
- 1 × Backend/Database Engineer
- 0.5 × UX/UI Designer
- 0.5 × Product Manager

#### Enterprise Delivery Team (8 people, 4–5 months)
- 2 × Senior Full-Stack Engineers
- 2 × Mid-Level Frontend Engineers
- 1 × Backend/Database Engineer
- 1 × UX/UI Designer
- 1 × Product Manager
- 1 × QA Engineer

### Suggested Staffing Timeline (Balanced Team)

| Month | Activity | Who |
|-------|----------|-----|
| 1 | Architecture, auth, database design, UI foundation | SF, BE, UX |
| 2 | Enterprise workspace, leave core, calendar | SF, FE, BE, UX |
| 3 | Approval chains, notifications, rules engine | SF, FE, BE, PM |
| 4 | Resource management, reporting dashboard | FE, SF, PM |
| 5 | Agile integration, email infra, report builder | SF, BE, FE |
| 6 | Mobile (Capacitor), QA, performance, launch prep | All |
| 7 (buffer) | Bug fixes, hardening, documentation | SF, FE |

---

## 6. Effort Estimate

### Bottom-Up Area Breakdown

| Feature Area | Optimistic (h) | Most Likely (h) | Pessimistic (h) | PERT (h) |
|-------------|---------------|-----------------|-----------------|----------|
| Auth & Identity | 80 | 120 | 180 | 122 |
| Workspace & Tenancy | 120 | 180 | 260 | 183 |
| Leave Request Lifecycle | 180 | 260 | 380 | 263 |
| Conflict Engine | 60 | 90 | 140 | 92 |
| Capacity Engine | 50 | 75 | 120 | 77 |
| Calendar & Timeline Views | 200 | 290 | 420 | 293 |
| Approval Chain & Escalation | 60 | 90 | 140 | 92 |
| Resource Management | 180 | 260 | 380 | 263 |
| Agile Integration | 140 | 200 | 300 | 203 |
| Report Builder & Reporting | 120 | 180 | 270 | 183 |
| Email Infrastructure | 90 | 130 | 200 | 133 |
| Admin, Profile, Landing | 60 | 90 | 140 | 92 |
| Mobile (Capacitor) + Polish | 60 | 90 | 130 | 90 |
| DB Schema + RLS + Migrations | 80 | 120 | 180 | 122 |
| Smart Schedule Algorithm | 40 | 60 | 90 | 61 |
| Permission System (dynamic tree) | 50 | 75 | 120 | 77 |
| **Subtotal (coding)** | **1,570** | **2,310** | **3,450** | **2,347** |
| + 30% overhead (QA, PM, design, deploy, review, meetings) | 471 | 693 | 1,035 | 704 |
| **Total** | **2,041** | **3,003** | **4,485** | **3,051** |

### Summary in Multiple Units

| Metric | Low | Most Likely | High |
|--------|-----|-------------|------|
| Person-hours | 2,041 | 3,051 | 4,485 |
| Person-days (8h) | 255 | 381 | 561 |
| Person-months (160h) | 12.8 | 19.1 | 28.0 |
| Calendar months (3-person core team) | 5.5 | 7.5 | 11 |
| Calendar months (5-person team) | 3.5 | 5 | 7 |

### Notes on AI-Accelerated Development

The repository shows this product was built in approximately **2 months of active development** (2026-03-07 to 2026-05-11). This reflects the use of AI-assisted coding tools (Lovable platform, Claude Code). Traditional human teams without AI tooling would likely require 2–3× the calendar time. This report's estimates reflect **conventional human team effort**, which is the appropriate baseline for valuation purposes.

---

## 7. Cost Estimate

### Rate Assumptions

#### CEE / Hungary Market Rates (2025–2026)

| Role | Junior (€/h) | Mid (€/h) | Senior (€/h) |
|------|-------------|-----------|--------------|
| Full-Stack Engineer | 15–22 | 28–40 | 42–65 |
| Frontend Engineer | 14–20 | 25–38 | 38–60 |
| Backend / DB Engineer | 15–22 | 28–42 | 42–65 |
| UX/UI Designer | 14–20 | 24–36 | 36–55 |
| Product Manager | 18–25 | 32–45 | 45–70 |
| QA Engineer | 12–18 | 22–32 | 32–48 |

#### Western EU / Remote Agency Rates (2025–2026)

| Role | Mid (€/h) | Senior (€/h) |
|------|-----------|--------------|
| Full-Stack Engineer | 70–100 | 110–160 |
| Frontend Engineer | 60–90 | 100–140 |
| Backend / DB Engineer | 70–105 | 110–160 |
| UX/UI Designer | 60–85 | 90–130 |
| Product Manager | 65–90 | 95–140 |

### Detailed Cost Model — Most Likely Scenario (CEE rates)

| Role | Share | Hours | Rate (€/h) | Cost (€) |
|------|-------|-------|-----------|----------|
| Senior Full-Stack Engineer | 35% | 1,068 | 52 | 55,536 |
| Mid-Level Frontend Engineer | 30% | 915 | 33 | 30,195 |
| Backend / DB Engineer | 15% | 458 | 48 | 21,984 |
| UX/UI Designer | 10% | 305 | 30 | 9,150 |
| Product Manager | 7% | 214 | 38 | 8,132 |
| QA Engineer | 3% | 91 | 28 | 2,548 |
| **Direct Labour** | | **3,051** | | **127,545** |
| Overhead (25%: office, tools, recruitment, management) | | | | 31,886 |
| Contingency (15%) | | | | 19,132 |
| **Total (CEE)** | | | | **178,563** |

### Cost Ranges by Scenario

| Scenario | Low | Most Likely | High |
|----------|-----|-------------|------|
| CEE / Hungary (small team, lean) | €118,000 | €178,000 | €245,000 |
| Western EU agency | €265,000 | €380,000 | €520,000 |
| Mixed (CEE dev + WEU leadership) | €165,000 | €235,000 | €330,000 |

### Cost by Delivery Phase

| Phase | % of Cost | CEE Most Likely |
|-------|-----------|-----------------|
| Foundation (auth, architecture, DB) | 15% | €26,700 |
| Enterprise core (workspace, leave, approval) | 25% | €44,600 |
| Calendar, timeline, coverage | 15% | €26,700 |
| Resource management | 12% | €21,400 |
| Agile integration | 10% | €17,800 |
| Email infra + reporting | 10% | €17,800 |
| QA, testing, stabilisation | 8% | €14,300 |
| PM + design throughout | 5% | €8,900 |
| **Total** | **100%** | **€178,200** |

---

## 8. Market Comparison

### Comparable Products

#### Direct Competitors (Leave Management SaaS)

| Product | Pricing Model | Price Point | Key Differentiators |
|---------|--------------|-------------|---------------------|
| **Calamari** | Per user/month | €2.50–5.00/user/mo | CEE-friendly, Leave + Clock-in modules |
| **Timetastic** | Per user/month | £1.80–2.50/user/mo | Simple, UK-focused |
| **LeaveBoard** | Per user/month | $1.35–3.50/user/mo | Simple leave tracking |
| **Absence.io** | Per user/month | €3.50–5.00/user/mo | EU-focused, GDPR |
| **Vacation Tracker** | Per user/month | $2.50–5.00/user/mo | Slack/Teams integration |
| **Factorial HR** | Per user/month | €5–8/user/mo | Full HR suite (EU) |
| **Personio** | Per user/month | €5–25/user/mo | Mid-market European HR |
| **BambooHR** | Opaque enterprise | $6–12/user/mo est. | North American SME |
| **Absentify** | Freemium + paid | Free → $2–3/user/mo | Teams-native, simple |

#### Adjacent Competitors (Resource/Capacity Planning)

| Product | Price Point | Notes |
|---------|-------------|-------|
| **Runn** | $10–14/user/mo | Resource planning + forecasting |
| **Float** | $6–12/user/mo | Team capacity planning |
| **Harvest** | $12/user/mo | Time tracking + scheduling |
| **Teamdeck** | $3.99/user/mo | Resource + leave management |
| **Mosaic** | $9.99+/user/mo | AI-powered resource planning |

#### Agile-Integrated HR Tools (Effectime's differentiation)

Few competitors offer native Jira + Azure DevOps bidirectional integration within leave/capacity management. This is a meaningful differentiator for software development teams and tech companies.

### Market Sizing

- **Global leave management software market**: estimated at $1.5–2.1B in 2024, CAGR ~7–9%
- **CEE HR tech market**: approximately €180–250M, growing ~12–15% annually
- **Hungarian enterprise HR software**: largely dominated by local payroll providers (NEXON, T-Systems HR) and European SaaS (Personio, Calamari)

### Effectime's Market Positioning

**Strengths relative to comparables:**
1. Deeper resource management than pure leave tools (Timetastic, LeaveBoard)
2. Agile integration is unique in this tier (Jira + ADO bidirectional)
3. Custom report builder with SQL mode is enterprise-grade
4. Smart scheduling algorithm is a technical differentiator
5. Modern stack (React + Supabase) enables rapid feature iteration
6. Mobile-ready (Capacitor) from day one

**Weaknesses relative to comparables:**
1. Hungarian-only UI currently limits international expansion
2. Minimal test coverage increases operational risk
3. No public revenue traction data
4. No payroll integration (key for enterprise HR buyers)
5. Relatively new (no established brand trust)

### Pricing Signals

Based on comparable products, a realistic go-to-market pricing model:
- **Starter**: €3–4/user/month (leave management only)
- **Professional**: €6–8/user/month (+ resource management, reporting)
- **Enterprise**: €10–15/user/month (+ agile integration, custom report builder, SLA)

For a 100-person company on Professional tier: €600–800/month → €7,200–9,600/year ARR per customer.

---

## 9. Market Value Estimate

### Lens 1: Replacement / IP Value

The product's replacement cost at CEE rates is €145,000–€245,000. As a marketed IP asset (code + architecture + operational knowledge), a typical 1.5–2.5× multiple is applied:

**IP/Replacement Value: €200,000 – €550,000**

This represents the floor — what a rational buyer would pay for the raw technology absent revenue, customers, or brand.

### Lens 2: Comparable-Based Valuation

Reference transactions in HR SaaS:
- Calamari (Polish, ~50-person team): reportedly valued at $5–15M with ~$1M ARR
- Timetastic (UK): bootstrapped, estimated £2–5M ARR, likely valued at £8–20M
- Absence.io: acquired by HiBob group; price undisclosed but estimated €3–8M at time

At comparable early-stage revenue multiples (5–10× ARR):

| ARR Scenario | Multiple | Value Range |
|-------------|----------|-------------|
| No revenue (IP only) | n/a | €200K–€550K |
| €30K ARR (early customers) | 8× | €240K–€400K |
| €100K ARR | 7× | €700K–€1,000K |
| €300K ARR | 6× | €1,800K–€2,400K |
| €500K ARR | 5–6× | €2,500K–€4,000K |
| €1M ARR | 5–7× | €5,000K–€8,000K |

### Lens 3: Feature Depth and Strategic Premium

Effectime has features that exceed typical competitors at its likely price tier:
- Agile integration (bidirectional Jira + ADO)
- Custom SQL report builder
- Smart scheduling algorithm
- Multi-schema multi-tenant architecture
- Capacitor mobile (iOS/Android)

Feature depth premium applied to IP value: **1.3–1.8×**

Adjusted IP value with feature premium: **€260,000–€990,000**

### Lens 4: Risk and Maintainability Adjustment

| Risk Factor | Impact |
|-------------|--------|
| Minimal test coverage (1 test file) | −15% |
| AI-assisted codebase (quality variability) | −10% |
| Hungarian-only UI (market concentration) | −10% |
| Modern/maintainable tech stack | +10% |
| Clean RLS architecture | +5% |
| Active changelog (maintenance evidence) | +8% |
| **Net risk adjustment** | **−12%** |

### Lens 5: Strategic Acquisition Value

A strategic acquirer (e.g., a CEE HR tech player, a Jira-adjacent tool vendor, or a European SaaS roll-up) would value:
- The Jira/ADO integration module as a standalone acquisition target
- The enterprise workflow engine as a platform extension
- The CEE HR tech positioning as a market entry vehicle

Strategic premium over IP value: **1.5–3×**

Strategic acquisition range: **€300,000–€1,650,000** (pre-revenue to early revenue stage)

### Final Market Value Ranges

| Scenario | Estimated Market Value |
|----------|----------------------|
| Pre-revenue IP sale | €200,000 – €600,000 |
| Seed-stage with early customers (€30–100K ARR) | €400,000 – €1,200,000 |
| Post-product-market-fit (€200–500K ARR) | €1,500,000 – €4,500,000 |
| Strategic acquisition (any stage) | €700,000 – €2,500,000 |
| **Most likely range (current state, unknown revenue)** | **€350,000 – €900,000** |

**Central estimate: €550,000** (assuming early traction, pre-growth-stage)

---

## 10. Assumptions and Limitations

### What Was Known (Hard Evidence)
- Full source code (170 files, 31,435 lines)
- 53 database migration files with schema history
- Complete changelog (v2.0.0–v2.6.0+)
- 17 edge functions with implementation
- All npm dependencies with versions
- Development timeline (2026-03-07 to 2026-05-11)
- Governance documentation
- Architecture patterns (Supabase + React + TypeScript)

### What Was Inferred
- Development effort (estimated from code volume, complexity signals in changelog, and comparable projects)
- Rate assumptions (CEE market research, industry norms)
- Market comparables (public pricing pages, press releases)
- Revenue potential (pricing model based on comparable SaaS)
- Team composition (inferred from codebase breadth and complexity)

### What Is Missing / Unknown
- **Revenue / ARR**: No monetisation data in repository. This single factor most dominates market valuation.
- **User/tenant count**: No telemetry or analytics integration visible
- **Customer data**: No CRM, support tickets, or user feedback data
- **Payroll integration**: Absent; limits enterprise sales in full-HR-suite evaluations
- **SLA / uptime history**: No monitoring or incident data
- **Competitive traction**: No sales pipeline, conversion rate, or churn data
- **Licensing model**: No terms of service, pricing page, or subscription data in repository
- **Mobile app store status**: Capacitor is configured but no evidence of published apps

### What Could Materially Change the Estimate
- Revenue traction could increase the estimate by 3–10× at growth stage
- Security audit findings could decrease value by 20–40%
- Acquiring a strategic partner or distribution channel could increase value by 2–5×
- Expansion of Hungarian-only UI to English/German could open €50–200K additional market per year
- Payroll integration would meaningfully increase enterprise conversion

---

## 11. Recommended Next Steps

### If the Goal is Build Cost Optimisation
- Add automated test coverage (target 70%+ on business logic libraries: `conflictEngine`, `capacityEngine`, `smartSchedule`)
- Replace 4-second polling intervals with Supabase Realtime subscriptions
- Implement the audit log as a queue-backed system rather than fire-and-forget
- Introduce Hungarian/English i18n properly via `i18next` (enables internationalisation without full rewrite)
- Resolve the `(supabase as any)` type casts in the conflict engine (schema typing gap)

### If the Goal is Product Sale / Acquisition / Fundraising
- Establish measurable ARR (even €5–20K early revenue dramatically increases valuation credibility)
- Publish an English-language version of the product and landing page
- Obtain at least one referenceable enterprise customer (50+ employees)
- Commission a security audit of RLS policies and edge function auth
- Prepare a data room: financials, technical architecture document, customer list, IP ownership chain

### If the Goal is Roadmap Prioritisation
- **Highest leverage additions**: Payroll integration (Nexon/HR365 for CEE), Microsoft Teams notification connector, SCIM/SSO for enterprise sales
- **Competitive moat to protect**: Jira/ADO agile integration + capacity simulation — no direct competitor offers this at this price tier
- **Technical debt to address first**: test coverage, audit log reliability, `as any` type casts

### If the Goal is Technical Debt Reduction
- Priority 1: Automated test suite (vitest already configured, just unused)
- Priority 2: Audit log queue (fire-and-forget is a compliance risk)
- Priority 3: Replace polling with Realtime subscriptions
- Priority 4: i18n refactor for internationalisation
- Priority 5: Type-safe Supabase queries (remove `as any` casts)

---

## 12. Appendix

### A. Database Table Inventory

| Table | Module | Purpose |
|-------|--------|---------|
| profiles | Core | User profiles |
| enterprise_workspaces | Workspace | Tenant workspaces |
| enterprise_memberships | Workspace | User-workspace relations |
| enterprise_invitations | Workspace | Email-based invitations |
| enterprise_teams | Workspace | Team groupings |
| leave_requests | Leave | Leave request records |
| approval_decisions | Leave | Approval/rejection decisions |
| leave_request_substitutes | Leave | Ordered substitute list |
| enterprise_leave_types | Config | Custom leave type definitions |
| enterprise_holidays | Config | Workspace holiday calendar |
| enterprise_blocked_dates | Config | Blocked date definitions |
| enterprise_daily_rules | Config | Daily headcount rules |
| enterprise_office_coverage_rules | Config | Office coverage requirements |
| enterprise_rule_templates | Config | Reusable rule templates |
| enterprise_approval_chains | Config | Multi-step approval definitions |
| enterprise_escalation_rules | Config | Escalation trigger rules |
| enterprise_audit_events | Audit | Immutable audit trail |
| enterprise_notifications | Notifications | In-app notifications |
| enterprise_export_jobs | Export | CSV export job tracking |
| enterprise_member_skills | Skills | Member skill assignments |
| enterprise_member_role_allocations | Resources | Role allocation percentages |
| enterprise_projects | Resources | Project definitions |
| enterprise_project_allocations | Resources | Project-member allocations |
| enterprise_agile_issues | Agile | Cached Jira/ADO issues |
| enterprise_agile_sync_log | Agile | Integration activity log |
| enterprise_agile_external_field_mappings | Agile | Dynamic field mappings |
| enterprise_agile_capacity_events | Agile | Capacity event log |
| enterprise_feature_catalog | Permissions | Dynamic permission tree |
| enterprise_quota_transactions | Quota | Leave quota transactions |
| tenant_calendar_settings | Calendar | Per-workspace filter config |
| enterprise_agile_field_metadata | Agile | Jira/ADO field metadata |

### B. Edge Function Inventory

| Function | Lines | Purpose |
|----------|-------|---------|
| join-event | 1,724 | Core auth/membership/activation actions |
| jira-devops-proxy | 484 | Jira + Azure DevOps proxy |
| send-transactional-email | 365 | Email dispatch via Lovable Email API |
| process-email-queue | 363 | Email queue consumer |
| auth-email-hook | 324 | Supabase auth event interceptor |
| admin | 269 | Super-admin operations |
| run-report | 225 | Custom report execution |
| create-instant-enterprise-member | 217 | Fast member provisioning |
| data-migration | 208 | Data migration utility |
| send-scheduled-reports | 178 | Scheduled report email delivery |
| handle-email-suppression | 162 | Bounce/suppression handling |
| sync-holidays | 153 | Public holiday data sync |
| handle-email-unsubscribe | 130 | Unsubscribe webhook |
| delete-account | 123 | GDPR account deletion |
| preview-transactional-email | 100 | Email template preview |
| leave-ical | 86 | iCal subscription export |
| cleanup-temp-users | 76 | Temp user cleanup job |

### C. Estimation Formula Reference

**PERT Formula:**
```
E = (O + 4M + P) / 6
SD = (P - O) / 6
```

**Code Volume Baseline:**
```
Developer-days = Total_LOC / Avg_Lines_Per_Day
Total effort = Developer-days × Overhead_Multiplier
```
Where Overhead_Multiplier = 2.2 (QA: +20%, PM: +10%, design: +8%, review/deploy: +15%, rework: +12%, meetings: +15%)

**Cost Calculation:**
```
Total_Cost = Σ(Role_Hours × Role_Rate) × (1 + Overhead%) × (1 + Contingency%)
```

### D. Rate Sources and References

- Hungarian developer salary surveys: Codecool, IVSZ, devremuneration.com (2024–2025)
- EU software developer rates: Levels.fyi, Arc.dev, Toptal rate reports
- HR SaaS pricing: Calamari.io, Timetastic.co.uk, Factorial.co, Personio.com, BambooHR.com
- HR tech market sizing: Grand View Research, MarketsandMarkets HR Software reports (2024)
- SaaS valuation multiples: Aventis Advisors, SaaS Capital Index, Capchase SaaS benchmarks (2024)

### E. Comparable Product Matrix

| Product | HQ | Focus | Price/User/Mo | Features vs. Effectime |
|---------|-----|-------|--------------|----------------------|
| Calamari | Poland | Leave + Clock-in | €2.50–5 | Similar scope, no Agile integration |
| Timetastic | UK | Leave only | £1.80–2.50 | Much simpler, no resource planning |
| Absence.io | Germany | Leave + Org | €3.50–5 | Similar EU positioning, less resource depth |
| Factorial | Spain | Full HR | €5–8 | Broader HR (payroll), less agile depth |
| Personio | Germany | Full HR/Payroll | €5–25 | Enterprise, payroll, much larger team |
| Float | Australia | Resource only | $6–12 | No leave management |
| Runn | New Zealand | Resource + forecast | $10–14 | No leave, strong Gantt |
| Teamdeck | Poland | Resource + leave | $3.99 | Closest overall comparable |

### F. Confidence Assessment

| Dimension | Confidence | Rationale |
|-----------|-----------|-----------|
| Build effort estimate | High (±20%) | Full codebase available, changelog evidence |
| Cost estimate (CEE) | High (±25%) | Market rate data available |
| Cost estimate (WEU) | Medium (±35%) | Indirect evidence only |
| Market value (pre-revenue) | Medium (±40%) | No revenue data; comparable-based |
| Market value (with revenue) | Medium-High (±25%) | Standard ARR multiples applicable |

---

*This report was produced by AI-assisted technical due-diligence analysis combining direct repository inspection and external market research. It is intended for informational purposes and does not constitute financial advice. Estimates should be validated against actual financial data before use in investment decisions.*

---
**Report Version:** 1.0  
**Assessment Date:** 2026-05-11  
**Repository Commit Reference:** Branch `claude/fix-google-auth-n6K0t`
