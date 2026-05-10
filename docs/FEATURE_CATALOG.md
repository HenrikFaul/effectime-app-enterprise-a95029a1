# Effectime Enterprise – Funkció katalógus

<!-- METADATA -->
| Mező | Érték |
|---|---|
| Dokumentum | FEATURE_CATALOG.md |
| Generálva | 2026-05-10T12:00:00Z |
| Repozitórium | HenrikFaul/effectime-app-enterprise-a95029a1 |
| Branch | claude/create-software-documentation-O7kj1 |
| Revision | 8919c402e74e41bbe83ccf1e6385c92d0fddeada |
| Megbízhatóság | Magas (verified: kódbázis audit + CHANGELOG) |
| Kapcsolódó dok. | ROLE_PERMISSION_MATRIX.md, NAVIGATION_TREE.md, BUSINESS_SYSTEM_REFERENCE.md |

---

**Státusz jelölések:**
- `verified` — közvetlenül a kódbázisból / CHANGELOG-ból igazolt
- `inferred` — architektúra és kontextus alapján következtetett

---

## Modul 1: Auth és felhasználói fiók

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| AUTH-001 | Regisztráció e-maillel | `/#/auth` | — | Auth | verified |
| AUTH-002 | Bejelentkezés e-mail+jelszóval | `/#/auth` | — | Auth | verified |
| AUTH-003 | Google OAuth bejelentkezés | `/#/auth` | — | Auth | verified |
| AUTH-004 | Magic link bejelentkezés | `/#/auth` | — | Auth | verified |
| AUTH-005 | Jelszó-visszaállítás | `/#/reset-password` | — | ResetPassword | verified |
| AUTH-006 | Profil szerkesztés | `/#/profile` | Mindenki | Profile | verified |
| AUTH-007 | Fiók törlés | `/#/profile` vagy edge function | Mindenki | delete-account EF | verified |
| AUTH-008 | Leiratkozás e-mailből | `/#/unsubscribe` | — | Unsubscribe | verified |
| AUTH-009 | Auth e-mail testreszabás | — | Platform admin | auth-email-hook EF | verified |

---

## Modul 2: Munkaterület (Workspace)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| WS-001 | Munkaterület létrehozása | `/#/app` | Mindenki | WorkspaceDashboard | verified |
| WS-002 | Munkaterület kiválasztása | `/#/app?ws=<id>` | Mindenki | WorkspaceDashboard | verified |
| WS-003 | Munkaterület archiválása | Settings | owner | WorkspaceGeneralSettings | verified |
| WS-004 | Munkaterület törlése | Settings | owner | WorkspaceGeneralSettings | inferred |
| WS-005 | Demo workspace seed | — | Platform admin | seed-demo-workspace EF | verified |
| WS-006 | Helyreállítási mód | Settings → Recovery Mode | owner | RecoveryModeSettings | verified |
| WS-007 | Általános beállítások (név, TZ, locale) | Settings → General | owner/resourceAssistant | WorkspaceGeneralSettings | verified |

---

## Modul 3: Tag-kezelés (Members)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| MEM-001 | Tagok listázása | `?tab=members` / `workspace.members` | owner/resourceAssistant | MembersTab | verified |
| MEM-002 | Tag meghívása e-maillel | `?tab=members` | owner/resourceAssistant | MembersTab | verified |
| MEM-003 | Meghívó elfogadása | join-event EF | — | join-event EF | verified |
| MEM-004 | Tag adatainak szerkesztése | `?tab=members` | owner/resourceAssistant | MemberEditor (inferred) | inferred |
| MEM-005 | Tag szerepkörének változtatása | `?tab=members` | owner | — | inferred |
| MEM-006 | Tag deaktiválása | `?tab=members` | owner/resourceAssistant | — | inferred |
| MEM-007 | Azonnali tag létrehozás | — | Platform admin | create-instant-enterprise-member EF | verified |
| MEM-008 | Irodák / telephelyek kezelése | Settings → Office Manager | owner/resourceAssistant | OfficeManager | verified |
| MEM-009 | Csapatok kezelése | Resources → Csapatok | owner/resourceAssistant | TeamManager | verified |

---

## Modul 4: Szabadságkérelem (Leave Requests)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| LR-001 | Szabadságkérelem beküldése | `?tab=requests` / `leave-request` | member+ | LeaveRequestList | verified |
| LR-002 | Ütközésellenőrzés (Check fázis) | `?tab=requests` | member+ | Conflict Engine | verified |
| LR-003 | Félnapos kérelem | `?tab=requests` | member+ | LeaveRequestList | verified |
| LR-004 | Privát kérelem | `?tab=requests` | member+ | LeaveRequestList | verified |
| LR-005 | Kérelem visszavonása | `?tab=requests` | member+ | LeaveRequestList | verified |
| LR-006 | Saját kérelmek megtekintése | `?tab=requests` | member+ | LeaveRequestList | verified |
| LR-007 | Csapat kérelmeinek megtekintése | `?tab=requests` | owner/resourceAssistant | LeaveRequestList | verified |
| LR-008 | Egyenleg megtekintése (QuotaBalance) | `?tab=requests` | member+ | QuotaBalanceCard | verified |
| LR-009 | Kvóta kezelés admin | Settings → Quota Manager | owner/resourceAssistant | QuotaManager | verified |
| LR-010 | Helyettesítési felkérés | `?tab=requests` | member+ | SubstituteInbox | verified |
| LR-011 | Juttatások kezelése | Settings → Allowances | owner/resourceAssistant | AllowanceManager | verified |

---

## Modul 5: Jóváhagyási rendszer (Approvals)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| APR-001 | Jóváhagyó inbox | `?tab=requests` / `workspace.approvals` | owner/resourceAssistant | ApprovalInbox | verified |
| APR-002 | Egyenkénti jóváhagyás/elutasítás | `?tab=requests` | owner/resourceAssistant | ApprovalInbox | verified |
| APR-003 | Tömeges jóváhagyás | `?tab=requests` | owner/resourceAssistant | ApprovalInbox | verified |
| APR-004 | Admin felülbírálat | `?tab=requests` / `approval-flow` | owner/resourceAssistant | AdminLeaveOverride | verified |
| APR-005 | Döntésmemória figyelés | `?tab=requests` | owner/resourceAssistant | DecisionMemoryStaleInbox | verified |
| APR-006 | Jóváhagyási lánc konfiguráció | `?tab=requests` → Szabályok | owner/resourceAssistant | ApprovalChainManager | verified |
| APR-007 | Eszkaláció | Automatikus (cron/threshold) | — | Approval Chain Engine | verified |

---

## Modul 6: Naptár és ütemezés (Calendar)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| CAL-001 | Havi naptár nézet | `?tab=calendar&sub=calendar-main` / `workspace.calendar` | member+ | LeaveCalendar | verified |
| CAL-002 | Születésnapok / évfordulók widget | `?sub=calendar-main` | member+ | BirthdayAnniversaryWidget | verified |
| CAL-003 | Éves trend diagram | `?sub=calendar-main` | member+ | AnnualTrendChart | verified |
| CAL-004 | Idővonal nézet (virtualizált) | `?sub=calendar-timeline` | member+ | TimelineView | verified |
| CAL-005 | Készség-kapacitás riport (idővonalnál) | `?sub=calendar-timeline` | member+ | SkillCapacityReport | verified |
| CAL-006 | Kapacitástervező nézet | `?sub=calendar-coverage` / `coverage-planner` | owner/resourceAssistant | CoveragePlannerView | verified |
| CAL-007 | Éves nézet | `?sub=calendar-annual` | member+ | AnnualLeaveGrid | verified |
| CAL-008 | Naptár szűrők | Settings → Calendar Filters | member+ | CalendarFilterSettings | verified |
| CAL-009 | iCal feed | leave-ical EF | member+ | ICalSubscription | verified |

---

## Modul 7: Szabályok és konfigurációk (Rules)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| RULE-001 | Szabadságtípusok kezelése | `?tab=requests` → Szabályok / Settings | owner/resourceAssistant | LeaveTypeManager | verified |
| RULE-002 | Ünnepnapok kezelése | `?tab=requests` → Szabályok / Settings / `holiday-manager` | owner/resourceAssistant | HolidayManager | verified |
| RULE-003 | Cég-szintű napok | `?tab=requests` → Szabályok | owner/resourceAssistant | CompanyLeaveDayManager | verified |
| RULE-004 | Tiltott napok | `?tab=requests` → Szabályok | owner/resourceAssistant | BlockedDateManager | verified |
| RULE-005 | Napi szabályok (headcount) | `?tab=requests` → Szabályok / Settings / `holiday-manager` | owner/resourceAssistant | DailyRuleManager | verified |
| RULE-006 | Telephelyi lefedettségi szabályok | `?tab=requests` → Szabályok | owner/resourceAssistant | OfficeCoverageRuleManager | verified |
| RULE-007 | Szabálysablon könyvtár | `?tab=requests` → Szabályok / Settings | owner/resourceAssistant | RuleTemplateLibrary | verified |
| RULE-008 | Ünnepnap szinkronizáció | Settings → Holidays | owner/resourceAssistant | sync-holidays EF | verified |

---

## Modul 8: Szervezeti struktúra (Organization)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| ORG-001 | Szervezeti struktúra szerkesztés | `?tab=organization&sub=structure` | owner/resourceAssistant | OrgStructure | verified |
| ORG-002 | Vezetési szintek kezelése | `?sub=leadership` | owner/resourceAssistant | LeadershipLevels | verified |
| ORG-003 | Szerződéstípusok kezelése | `?sub=contracts` | owner/resourceAssistant | ContractTypes | verified |
| ORG-004 | Iparágak kezelése | `?sub=industry` | owner/resourceAssistant | Industries | verified |
| ORG-005 | Munkakategóriák kezelése | `?sub=categories` | owner/resourceAssistant | WorkCategories | verified |
| ORG-006 | Állásfamilák kezelése | `?sub=job_families` | owner/resourceAssistant | JobFamilies | verified |
| ORG-007 | Org chart megjelenítés | `?sub=chart` / `org-chart` | member+ (view) | OrgChart | verified |
| ORG-008 | Org chart pan/zoom | `?sub=chart` | member+ | OrgChartPremiumView | verified |
| ORG-009 | Org chart teljes képernyős nézet | `?sub=chart` | member+ | OrgChartPremiumView | verified |
| ORG-010 | Org chart snapshot mentés | `?sub=chart` | owner/resourceAssistant | enterprise_org_chart_snapshots | verified |

---

## Modul 9: Erőforrások és kapacitás (Resources)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| RES-001 | Erőforrás áttekintő dashboard | `?tab=resources&sub=dashboard` | member+ | ResourceDashboard | verified |
| RES-002 | Kihasználtság hőtérkép | `?sub=heatmap` | member+ | UtilizationHeatmap | verified |
| RES-003 | Projektek listája | `?sub=projects` | member+ | ProjectList | verified |
| RES-004 | Projekt szerkesztő | `?sub=projects` | owner/resourceAssistant | ProjectEditor | verified |
| RES-005 | Gantt idővonal | `?sub=projects` | member+ | GanttTimeline | verified |
| RES-006 | Készségek kezelése | `?sub=skills` | owner/resourceAssistant | SkillsManager | verified |
| RES-007 | Forgatókönyv tervező | `?sub=scenarios` | owner/resourceAssistant | ScenarioPlanner | verified |
| RES-008 | Pénzügyi panel | `?sub=financials` | owner/resourceAssistant | FinancialsPanel | verified |
| RES-009 | Kapacitás-hiány riport | `?sub=gaps` | member+ | CapacityGapReport | verified |
| RES-010 | Kapacitás DNA panel | `?tab=resources` (mindig) / `capacity-dna` | member+ | CapacityDnaPanel | verified |
| RES-011 | Munkakör kezelés | Resources (összecsukható) | owner/resourceAssistant | BusinessRoleManager | verified |
| RES-012 | Csapat kezelés | Resources (összecsukható) | owner/resourceAssistant | TeamManager | verified |

---

## Modul 10: Agile integráció (Agile)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| AGL-001 | Agile panel | `?sub=agile` / `workspace.agile` | member+ | AgilePanel | verified |
| AGL-002 | Kanban tábla | `?sub=agile` / `agile-kanban` | member+ | AgileBoards (Kanban) | verified |
| AGL-003 | Scrum tábla | `?sub=agile` / `agile-scrum` | member+ | AgileBoards (Scrum) | verified |
| AGL-004 | Gantt nézet (Agile) | `?sub=agile` / `agile-gantt` | member+ | AgileBoards (Gantt) | verified |
| AGL-005 | Kapacitás-illeszkedés | `?sub=agile` | member+ | CapacityFit | verified |
| AGL-006 | Issue writeback | `?sub=agile` | owner/resourceAssistant | IssueWriteback | verified |
| AGL-007 | Backlog böngésző | `?sub=agile` | member+ | BacklogBrowser | verified |
| AGL-008 | Jira issue szerkesztő | `?sub=agile` | member+ | JiraIssueEditor | verified |
| AGL-009 | Jira integráció konfiguráció | Settings → Integrations / `jira-integration` | owner/resourceAssistant | IntegrationManager | verified |
| AGL-010 | Azure DevOps integráció konfiguráció | Settings → Integrations | owner/resourceAssistant | IntegrationManager | verified |

---

## Modul 11: Workflows (Onboarding/Access)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| WFL-001 | Onboarding sablon létrehozás | `?tab=workflows` / `onboarding-template` | owner/resourceAssistant | OnboardingTemplates | verified |
| WFL-002 | Onboarding inbox (feladatok) | `?tab=workflows` | member+ | OnboardingInbox | verified |
| WFL-003 | Hozzáférési rendszerek katalógusa | `?tab=workflows` | owner/resourceAssistant | AccessSystems | verified |
| WFL-004 | Hozzáférés-kérelem sablonok | `?tab=workflows` / `access-request` | owner/resourceAssistant | AccessTemplates | verified |
| WFL-005 | Hozzáférés inbox | `?tab=workflows` | member+ | AccessInbox | verified |

---

## Modul 12: Riportok és audit (Reports & Audit)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| RPT-001 | Riport futtatás | `?tab=reports-audit` / `workspace.reports` | owner/resourceAssistant | run-report EF | verified |
| RPT-002 | Riport export | `?tab=reports-audit` / `export-center` | owner/resourceAssistant | ExportCenter | verified |
| RPT-003 | Ütemezett riport | `?tab=reports-audit` | owner/resourceAssistant | send-scheduled-reports EF | verified |
| RPT-004 | Audit napló | `?tab=reports-audit` / `audit-log` | owner/resourceAssistant | AuditLog | verified |

---

## Modul 13: Beállítások (Settings)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| SET-001 | Általános workspace beállítások | `?tab=settings` | owner/resourceAssistant | WorkspaceGeneralSettings | verified |
| SET-002 | Szerepkör-jogosultságok | `?tab=settings` / `role-permissions` | owner | RolePermissionManager | verified |
| SET-003 | Lokalizáció / fordítás | `?tab=settings` / `localization-settings` | owner/resourceAssistant | LocalizationSettings | verified |
| SET-004 | Branding / arculat | `?tab=settings` | owner | BrandingManager | verified |
| SET-005 | CSV import | `?tab=settings` | owner/resourceAssistant | CsvImportPanel | verified |
| SET-006 | Értesítések | `?tab=settings` | owner/resourceAssistant | EnterpriseNotifications | verified |
| SET-007 | Értesítési preferenciák | `?tab=settings` | member+ | NotificationPreferences | verified |
| SET-008 | Integráció egészség | `?tab=settings` / `integration-health` | owner/resourceAssistant | IntegrationHealthCenter | verified |
| SET-009 | Help rendszer beállítások | `?tab=settings` | owner | HelpSystemSettings | verified |
| SET-010 | UI szekció állapot kezelés | `?tab=settings` | owner | UiSectionStateManager | verified |

---

## Modul 14: Help rendszer (Help System)

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| HLP-001 | Kontextuális súgó megjelenítése | Bármely oldal | member+ | HelpDrawer | verified |
| HLP-002 | Help tartalom anchor ID regisztráció | — (dev) | — | HelpRegistryProvider | verified |
| HLP-003 | Help cikkek újragenerálása | Settings → Help System | owner | help-regenerator EF | verified |

---

## Modul 15: Platform Admin

| Feature ID | Funkció neve (HU) | Route / Anchor | Szerepkörök | Komponens | Státusz |
|---|---|---|---|---|---|
| ADM-001 | Platform admin dashboard | `/#/admin` | Platform admin | Admin | verified |
| ADM-002 | Platform admin API | — | Platform admin | admin EF | verified |
| ADM-003 | E-mail előnézet (dev) | — | Platform admin | preview-transactional-email EF | verified |
