# Effectime Enterprise – Navigációs fa

<!-- METADATA -->
| Mező | Érték |
|---|---|
| Dokumentum | NAVIGATION_TREE.md |
| Generálva | 2026-05-10T12:00:00Z |
| Repozitórium | HenrikFaul/effectime-app-enterprise-a95029a1 |
| Branch | claude/create-software-documentation-O7kj1 |
| Revision | 8919c402e74e41bbe83ccf1e6385c92d0fddeada |
| Megbízhatóság | Magas (verified kódból) |
| Kapcsolódó dok. | TECHNICAL_ARCHITECTURE.md, ROLE_PERMISSION_MATRIX.md, FEATURE_CATALOG.md |

---

## Tartalomjegyzék

1. [Top-level útvonalak (HashRouter)](#1-top-level-útvonalak-hashrouter)
2. [Workspace top navigációs tabok](#2-workspace-top-navigációs-tabok)
3. [Tagok tab](#3-tagok-tab-members)
4. [Szervezet tab sub-tabok](#4-szervezet-tab-sub-tabok-organization)
5. [Naptár tab sub-nézetek](#5-naptár-tab-sub-nézetek-calendar)
6. [Kérelmek tab szekciók](#6-kérelmek-tab-szekciók-requests)
7. [Folyamatok tab sub-tabok](#7-folyamatok-tab-sub-tabok-workflows)
8. [Erőforrások tab sub-tabok](#8-erőforrások-tab-sub-tabok-resources)
9. [Riportok tab](#9-riportok-tab-reports-audit)
10. [Beállítások tab szekciók](#10-beállítások-tab-szekciók-settings)
11. [URL paraméterek összefoglalója](#11-url-paraméterek-összefoglalója)

---

## 1. Top-level útvonalak (HashRouter)

Az alkalmazás `HashRouter`-t használ, ami azt jelenti, hogy az összes útvonal `/#/` előtaggal rendelkezik.

| Hash útvonal | Komponens | Auth | Leírás |
|---|---|---|---|
| `/#/` | Landing | Publikus | Nyitólap |
| `/#/app` | Enterprise (WorkspaceDashboard) | Védett | Fő alkalmazás |
| `/#/enterprise` | Redirect → `/#/app` | Védett | Régi útvonal átirányítás |
| `/#/auth` | Auth | Publikus (átirányít, ha be van jelentkezve) | Bejelentkezés/regisztráció |
| `/#/profile` | Profile | Védett | Felhasználói profil |
| `/#/reset-password` | ResetPassword | Publikus | Jelszó-visszaállítás |
| `/#/admin` | Admin | Védett | Platform admin |
| `/#/unsubscribe` | Unsubscribe | Publikus | Leiratkozás kezelő |

### Routing megjegyzések
- `ProtectedRoute` és `PublicRoute` wrapper komponensek védenek
- `HashRouteBridge` + `SpaRedirectHandler`: Vercel SPA deployment kompatibilitás
- Ha bejelentkezett felhasználó `/#/auth`-ra navigál, átirányítódik `/#/app`-ra

---

## 2. Workspace top navigációs tabok

URL pattern: `/#/app?ws=<workspace_id>&tab=<tab_value>`

| Tab value | Label (HU) | Ikon | Láthatóság feltétele |
|---|---|---|---|
| `members` | Tagok | Users | `canView('members')` |
| `organization` | Szervezet | Building2 | `canView('members')` |
| `calendar` | Naptár | CalendarDays | `canView('calendar')` |
| `requests` | Kérelmek | FileText | `canView('requests_own')` VAGY `canView('requests_team')` VAGY `canEdit('leave_requests_submit')` |
| `workflows` | Folyamatok | GitMerge | `canView('members')` |
| `resources` | Erőforrások | Briefcase | Mindig látható |
| `reports-audit` | Riportok | BarChart3 | `canView('reports')` VAGY `canView('audit')` VAGY `canView('export')` |
| `settings` | Beállítások | Settings | `canView('settings')` |

---

## 3. Tagok tab (members)

URL: `/#/app?tab=members`

```
Tagok tab
├── Tagok lista (MembersTab)
│   ├── Tag szerkesztése (MemberEditor)
│   ├── Meghívó küldése
│   └── Tag deaktiválása
└── [Nincs sub-tab]
```

---

## 4. Szervezet tab sub-tabok (organization)

URL: `/#/app?tab=organization&sub=<sub>`

```
Szervezet tab (Organization)
├── structure    → Szervezeti struktúra (OrgStructure)
├── leadership   → Vezetési szintek (LeadershipLevels)
├── contracts    → Szerződéstípusok (ContractTypes)
├── industry     → Iparágak (Industries)
├── categories   → Munkakategóriák (WorkCategories)
├── job_families → Állásfamilák (JobFamilies)
└── chart        → Org chart (OrgChart + OrgChartPremiumView)
                   ├── Pan/zoom navigáció
                   ├── Teljes képernyős modál
                   └── Snapshot mentés
```

---

## 5. Naptár tab sub-nézetek (calendar)

URL: `/#/app?tab=calendar&sub=<sub>`

```
Naptár tab (Calendar)
├── calendar-main      → Havi nézet
│   ├── LeaveCalendar (havi naptárrács)
│   ├── BirthdayAnniversaryWidget
│   └── AnnualTrendChart
├── calendar-timeline  → Idővonal
│   ├── TimelineView (sor-per-tag, virtualizált)
│   └── SkillCapacityReport
├── calendar-coverage  → Kapacitástervező
│   └── CoveragePlannerView
└── calendar-annual    → Éves nézet
    └── AnnualLeaveGrid
```

---

## 6. Kérelmek tab szekciók (requests)

URL: `/#/app?tab=requests`

```
Kérelmek tab (Requests)
├── QuotaBalanceCard (saját egyenleg, mindig látható)
├── SubstituteInbox (helyettesítési felkérések)
├── Jóváhagyások (ADMIN, összecsukható)
│   ├── ApprovalInbox
│   │   ├── Egyenkénti jóváhagyás/elutasítás
│   │   └── Tömeges jóváhagyás/elutasítás
│   ├── AdminLeaveOverride
│   └── DecisionMemoryStaleInbox
├── Kérelmek (összecsukható)
│   └── LeaveRequestList
│       ├── Új kérelem
│       ├── Kérelem részletek
│       └── Visszavonás
└── Szabályok (ADMIN, összecsukható)
    ├── Jóváhagyási láncok (ApprovalChainManager)
    ├── Távollét típusok (LeaveTypeManager)
    ├── Ünnepnapok (HolidayManager)
    ├── Cég-szintű napok (CompanyLeaveDayManager)
    ├── Tiltott napok (BlockedDateManager)
    ├── Napi szabályok (DailyRuleManager)
    ├── Telephelyi lefedettségi szabályok (OfficeCoverageRuleManager)
    └── Szabálysablon könyvtár (RuleTemplateLibrary)
```

---

## 7. Folyamatok tab sub-tabok (workflows)

URL: `/#/app?tab=workflows`

```
Folyamatok tab (Workflows - WorkflowsModule)
├── Onboarding Templates (OnboardingTemplates)
│   ├── Sablon létrehozása
│   ├── Sablon szerkesztése
│   └── Lépés típusok:
│       task | read | acknowledge | training | exam | approval | internal_permission | external_access
├── Onboarding Inbox (OnboardingInbox)
│   └── Aktív onboarding feladatok listája
├── Access Systems (AccessSystems)
│   └── Hozzáférési rendszerek katalógusa
├── Access Templates (AccessTemplates)
│   └── Hozzáférés-kérelem sablonok
└── Access Inbox (AccessInbox)
    └── Aktív hozzáférés-kérelmek
```

---

## 8. Erőforrások tab sub-tabok (resources)

URL: `/#/app?tab=resources&sub=<sub>`

```
Erőforrások tab (Resources - ResourcesTab)
├── dashboard   → Áttekintés (ResourceDashboard)
├── heatmap     → Hőtérkép (UtilizationHeatmap)
├── projects    → Projektek
│   ├── ProjectList
│   ├── ProjectEditor
│   └── GanttTimeline
├── agile       → Agile (AgilePanel)
│   └── AgileBoards
│       ├── Kanban nézet
│       ├── Scrum nézet
│       ├── Gantt nézet
│       ├── CapacityFit
│       ├── IssueWriteback
│       ├── BacklogBrowser
│       └── JiraIssueEditor
├── skills      → Készségek (SkillsManager)
├── scenarios   → Forgatókönyvek (ScenarioPlanner)
├── financials  → Pénzügy (FinancialsPanel)
└── gaps        → Kapacitás-hiány (CapacityGapReport)

Összecsukható extra szekciók:
├── Pozíciók kezelése (BusinessRoleManager via PositionPickerDialog)
└── Csapatok kezelése (TeamManager)

Mindig megjelenik a tab alatt:
└── CapacityDnaPanel
```

---

## 9. Riportok tab (reports-audit)

URL: `/#/app?tab=reports-audit`

```
Riportok tab (Reports & Audit)
├── Riportok szekció
│   ├── Mentett riportok listája
│   ├── Riport futtatás (run-report edge function)
│   ├── Exportálás (ExportCenter)
│   └── Ütemezett riportok (send-scheduled-reports)
└── Audit napló szekció
    └── AuditLog
        ├── Dátum szűrő
        ├── Felhasználó szűrő
        └── Esemény típus szűrő
```

---

## 10. Beállítások tab szekciók (settings)

URL: `/#/app?tab=settings`

```
Beállítások tab (Settings)
├── General                → WorkspaceGeneralSettings
├── Leave Types            → LeaveTypeManager
├── Holidays               → HolidayManager
├── Daily Coverage Rules   → DailyRuleManager
├── Rule Templates         → RuleTemplateLibrary
├── Approval Chains        → ApprovalChainManager
├── Calendar Filters       → CalendarFilterSettings
├── Role Permissions       → RolePermissionManager
├── Integrations           → IntegrationManager
├── iCal                   → ICalSubscription
├── Localization           → LocalizationSettings
├── Recovery Mode          → RecoveryModeSettings
├── Integration Health     → IntegrationHealthCenter
├── Help System            → HelpSystemSettings
├── Branding               → BrandingManager
├── CSV Import             → CsvImportPanel
├── Audit Log              → AuditLog
├── UI Section State       → UiSectionStateManager
├── Export                 → ExportCenter
├── Allowances             → AllowanceManager
├── Quota Manager          → QuotaManager
├── Office Manager         → OfficeManager
├── Notifications          → EnterpriseNotifications
└── Notification Preferences → NotificationPreferences
```

---

## 11. URL paraméterek összefoglalója

| Paraméter | Alkalmazás | Leírás | Példa |
|---|---|---|---|
| `?ws=` | `/#/app` | Workspace azonosítója | `?ws=abc-123` |
| `?tab=` | `/#/app` | Aktív top-level tab | `?tab=calendar` |
| `?sub=` | `/#/app` | Aktív sub-tab (tab-függő) | `?sub=calendar-timeline` |
| `?invite=` | `/#/app` | Meghívó token | `?invite=xyz` |
| `?token=` | `/#/reset-password` | Jelszó-visszaállítási token | `?token=abc` |

### Navigáció a help anchorok alapján

A help rendszer anchor ID-ket használ a kontextuális súgóhoz:

| Anchor ID | Kapcsolódó funkció |
|---|---|
| `home.overview` | Kezdőlap / workspace dashboard |
| `workspace.members` | Tagok tab |
| `workspace.organization` | Szervezet tab |
| `workspace.calendar` | Naptár tab |
| `workspace.requests` | Kérelmek tab |
| `workspace.approvals` | Jóváhagyások szekció |
| `workspace.workflows` | Folyamatok tab |
| `workspace.resources` | Erőforrások tab |
| `workspace.agile` | Agile sub-tab |
| `workspace.reports` | Riportok tab |
| `workspace.settings` | Beállítások tab |
| `leave-request` | Szabadságkérelem |
| `approval-flow` | Jóváhagyási folyamat |
| `onboarding-template` | Onboarding sablon |
| `access-request` | Hozzáférési kérelem |
| `capacity-dna` | CapacityDna panel |
| `org-chart` | Org chart |
| `coverage-planner` | Kapacitástervező |
| `localization-settings` | Lokalizáció |
| `audit-log` | Audit napló |
| `integration-health` | Integráció egészség |
| `command-center` | Parancsközpont |
| `quota-manager` | Kvóta kezelő |
| `holiday-manager` | Ünnepnapok |
| `role-permissions` | Szerepkör jogosultságok |
| `decision-memory` | Döntésmemória |
| `agile-kanban` | Agile Kanban |
| `agile-scrum` | Agile Scrum |
| `agile-gantt` | Agile Gantt |
| `jira-integration` | Jira integráció |
| `export-center` | Export center |
