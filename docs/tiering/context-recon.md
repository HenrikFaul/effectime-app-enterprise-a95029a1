# Phase 1 — Context Reconstruction

## Termék — egy mondatban

Effectime (a/k/a Syncfolk Enterprise) egy enterprise HR / kapacitás / time-attendance / agile-platform, egyetlen multi-tenant React + Supabase (Postgres + RLS) deploymentben, magyar első nyelvvel és 5 lokalizációval (en/hu/cs/sk/pl).

## Célzott personák (megerősített)

| Persona | Forrás | Use case |
|---------|--------|----------|
| HR manager | `marketing/SYSTEM.md`, `members_*` modulok | Tagok, kontraktusok, szabadság, kvóták |
| Ops / Resource manager | `resource_dashboard`, `capacity_gap`, `coverage_planner` | Lefedettség, projekt-erőforrás, skill-mátrix |
| Owner / Admin | `enterprise_role = owner`, `SecurityCenter` | Tier kezelés, auditok, SSO |
| Team lead | `team` membership, `approval_inbox` | Approve/reject napi flow |
| End user / Member | `leave_submit`, `my_calendar` | Saját szabadság, idősáv, profil |
| Platform operator / Superadmin | `has_role(uid, 'admin')`, `SuperadminControlPlane` | Tier mapping, audit log, tenant config |

## Stratégiai kategória

- **Primary:** all-in-one Workforce Management for European mid-market (50–500 fő).
- **Secondary:** HRIS / PSA hibrid — vékony bérszámfejtési integrációs réteggel, de nem teljes payroll-rendszer.

## Megerősített modulok (kódból + DB-ből)

| Modul | Bizonyíték |
|-------|------------|
| Auth / Profile | `auth_email_*`, `profile_edit` (DB), `useAuth` (kód) |
| Workspaces / Tenancy | `enterprise_workspaces`, `tenants`, `tenant_workspaces` |
| Members | `enterprise_memberships`, 135 feature között 14 db `members_*` és `member_*` |
| Leave | `leave_*` 16 feature, `enterprise_leave_*` táblák |
| Calendar | `calendar_monthly`, `annual_view`, `ical_feed`, `ms365_calendar_sync` |
| Approvals | `approval_*` 6 feature, `approval_chains` |
| Org structure | `org_chart*`, `org_units`, `job_families`, `leadership_levels` |
| Resources | `resource_dashboard`, `utilization_heatmap`, `capacity_*` |
| Projects | `projects`, `project_editor`, `gantt_timeline` |
| Skills | `skills_mgmt`, `capacity_dna`, `capacity_fit` |
| Agile | `agile_panel`, `kanban`, `scrum`, `jira_integration`, `azure_devops` |
| Time attendance | `attendance_*` 6 feature, `payroll_export`, `payroll_engine` |
| Workflows | `access_systems`, `access_templates`, `onboarding_*` |
| Reports | `run_report`, `export_center`, `scheduled_reports`, `audit_log`, `executive_dashboard`, `burnout_engine` |
| Settings | `ws_general`, `role_permissions`, `localization`, `branding` |
| Platform | Superadmin Control Plane (v3.13.0), `platform_feature_flags`, `platform_audit_events` (v3.15.0) |

## Inferált / nem megerősített modulok

| Modul | Miért inferált |
|-------|----------------|
| Mobile native app | Csak responsive web; nincs `react-native` / `expo` a `package.json`-ban |
| SSO / SCIM | `soc2_iso` feature létezik (Enterprise tier), de a SSO IdP integráció (SAML/OIDC config UI) nem található az `src/`-ben |
| HRIS bidirectional sync | `payroll_export` egyirányú (DATEV/Personio/BambooHR/SAP/Workday/ADP); HRIS write-back nincs |
| AI chat assist | `ai_chat_assist` feature létezik, de production-grade LLM integráció nincs a kódbázisban (`OPENAI_API_KEY` env-keresés nem jött vissza) |

## Explicit constraints (CLAUDE.md / AI_EXECUTION_PROMPTS.md)

1. **Non-regression mandate** — minden meglévő publikus feature-t változatlanul kell hagyni.
2. **Nincs duplikáció** — új komponens csak akkor, ha a meglévő nem alakítható át.
3. **Localization-first** — minden user-facing string i18n key-ben, 5 nyelvben.
4. **Browser back button** — tab/view nav `pushState` (nem replace).
5. **Versioning + marketing** — minden feature delivery → `versioning/*.md` + `marketing/marketing_values/*.md` ugyanazon commitban.
6. **Rebase before code** — minden session indul `git fetch origin main && git rebase origin/main`.

## Known assumptions (need confirmation)

| Assumption | Confirmation needed from |
|------------|--------------------------|
| Tier names (Freemium/Pro/Enterprise) végleges, nem szezonálisan változó marketingnév | Product |
| Pricing: per-seat vs per-tenant — v3.15.x még per-tenant subscription, nincs seat-counter | Product / Finance |
| Payroll integrációk EU + US-ban használhatók (DATEV/Personio EU, ADP/Workday US) | Legal |
| Audit log megőrzési idő (SOC 2 minimum 1 év, GDPR-érzékeny payload szabályok) | Legal / Ops |
| pgbouncer transaction mode használata — RLS `current_setting` nem tartja meg connection-szinten | Ops / Engineering |

## Repository szerkezet (megerősített)

```
/src              React + TS frontend (Vite)
/supabase
  /migrations     SQL migrációk (timestamp prefix)
  /functions      Deno edge functions
/docs/tiering     Phase 1-14 deliverable-ek (ez a mappa)
/versioning       Engineering changelog per release
/marketing        Marketing prompt library + marketing_values logok
/scripts          CSV builder, lokalizációs eszközök
```

## Git baseline

- Branch: `claude/review-project-requirements-lR0Wp` (PR #73)
- Last applied tier-relevant version: **v3.15.0** (Feature Tiering — End-to-end activation, 2026-05-13).
- Tier seed: `supabase/migrations/2026051221*.sql` (5 fájl, 135 feature INSERT).
- Tier/addon binding: `supabase/migrations/20260512222247_*.sql`.
- Korrekciós seed-fix: `supabase/migrations/20260513120100_fix_feature_dependencies.sql`.
