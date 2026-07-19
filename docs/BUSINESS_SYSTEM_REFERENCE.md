# Effectime Enterprise – Üzleti rendszer-referencia

<!-- METADATA -->
| Mező | Érték |
|---|---|
| Dokumentum | BUSINESS_SYSTEM_REFERENCE.md |
| Generálva | 2026-05-10T12:00:00Z |
| Repozitórium | HenrikFaul/effectime-app-enterprise-a95029a1 |
| Branch | claude/create-software-documentation-O7kj1 |
| Revision | 8919c402e74e41bbe83ccf1e6385c92d0fddeada |
| Megbízhatóság | Magas |
| Kapcsolódó dok. | USER_MANUAL.md, PROCESS_FLOWS.md, ROLE_PERMISSION_MATRIX.md, DATA_FLOW_AND_ENTITY_REFERENCE.md |

---

## Tartalomjegyzék

1. [Munkaterület-kezelés](#1-munkaterület-kezelés)
2. [Tag-kezelés](#2-tag-kezelés)
3. [Szabadságkérelem életciklusa](#3-szabadságkérelem-életciklusa)
4. [Jóváhagyási workflow](#4-jóváhagyási-workflow)
5. [Naptár és ütemezés](#5-naptár-és-ütemezés)
6. [Szervezeti struktúra](#6-szervezeti-struktúra)
7. [Erőforrások és kapacitás](#7-erőforrások-és-kapacitás)
8. [Agile integráció](#8-agile-integráció)
9. [Workflows (Onboarding/Access)](#9-workflows-onboardingaccess)
10. [Riportok és audit](#10-riportok-és-audit)
11. [Beállítások és konfiguráció](#11-beállítások-és-konfiguráció)

---

## 1. Munkaterület-kezelés

### Üzleti cél
Egy munkaterület (workspace) egy szervezeti egységet képvisel az Effectime Enterprise-ban. Minden adat – tagok, szabadságok, kérelmek, szabályok – workspace-szintű. Több workspace is létrehozható (pl. különböző telephelyek vagy vállalatok számára).

### Szerepkörök
- **Tulajdonos (owner)**: létrehozza, konfigurálta és törölheti a workspace-t
- **Erőforrás asszisztens (resourceAssistant)**: adminisztrátori szintű hozzáférés, nem törölhet workspace-t
- **Tag (member)**: korlátozott, olvasási szintű hozzáférés

### Belépési pontok
- Regisztráció után a felhasználó új workspace-t hozhat létre
- Meghívólinken csatlakozhat egy meglévő workspace-hez
- `/?ws=<workspace_id>` URL-paraméterrel közvetlenül megnyitható egy workspace

### Workflow
1. Felhasználó regisztrál vagy bejelentkezik
2. Workspace létrehozása vagy meglévőhöz csatlakozás meghívóval
3. A workspace konfiguráló lépések (timezone, locale, szabadság-típusok) elvégzése
4. Tagok meghívása

### Kulcs szabályok
- Workspace-t csak a `owner` törölheti
- `recovery_mode` állapotban a workspace olvasható, de módosítások tiltottak
- `is_archived`: archivált workspace nem jelenik meg a listában, de adatai megmaradnak
- Demo workspace: `seed-demo-workspace` edge function hozza létre 22 personával és 38+ kérelemmel

### Technikai leképezés
- Tábla: `enterprise_workspaces` (id, name, timezone, locale, created_by, is_archived, recovery_mode)
- Route: `/#/app?ws=<id>`
- Komponens: `WorkspaceDashboard`

---

## 2. Tag-kezelés

### Üzleti cél
A tagok (members) a workspace felhasználói. Minden tagnak van szerepköre, csapata, helyszíne, munkakategóriája és munkaidő-beállítása. A tagkezelés lehetővé teszi a szervezeti hierarchia tükrözését az alkalmazásban.

### Szerepkörök
- **owner / resourceAssistant**: meghívhat, szerkeszthet, deaktiválhat tagokat
- **member**: csak a saját profilját szerkesztheti

### Belépési pont
- Munkaterület → **Tagok** tab (`?tab=members`)
- Profil szerkesztés: `/#/profile`

### Workflow
1. Admin meghív egy tagot e-mail cím alapján (`invite` mechanizmus, `join-event` edge function)
2. Tag e-mailben kap linket, elfogadja a meghívást
3. Tag profil és szerepkör beállítása
4. Azonnali tag-létrehozás is lehetséges: `create-instant-enterprise-member` edge function

### Kulcs mezők (enterprise_memberships)
| Mező | Leírás |
|---|---|
| user_id | Supabase auth user ID |
| workspace_id | Munkaterület azonosítója |
| role | owner / resourceAssistant / member |
| status | active / invited / inactive |
| team | Csapat neve (szabad szöveg) |
| location | Helyszín / telephely |
| business_role | Munkakör azonosítója |
| city | Város |
| office_id | FK → enterprise_offices |
| base_working_hours | Alapmunkaidő (óra/nap) |

### Értesítések
- Meghívó e-mail: `send-transactional-email` edge function + `auth-email-hook`
- Csatlakozás megerősítése utáni értesítés az adminnak (inferred)

### Technikai leképezés
- Tábla: `enterprise_memberships`, `profiles`
- Komponens: MembersTab, MemberEditor (inferred)
- Permission: `canView('members')`, `canEdit('invitations')`

---

## 3. Szabadságkérelem életciklusa

### Üzleti cél
A szabadságkérelem folyamat lehetővé teszi a tagok számára, hogy különböző típusú távollétet (éves szabadság, betegszabadság, stb.) kérjenek, az adminisztrátorok pedig jóváhagyják vagy visszautasítsák azokat. A rendszer egyenleget vezet és ütközésellenőrzést végez.

### Szerepkörök
- **member**: saját kérelmet nyújthat be és visszavonhatja
- **owner / resourceAssistant**: jóváhagy, visszautasít, felülbírál (admin override)

### Belépési pontok
- Munkaterület → **Kérelmek** tab (`?tab=requests`)
- QuotaBalanceCard: egyenleg megtekintése
- Naptárból is indítható kérelem (inferred)

### Kérelem állapotok

```
pending → approved
pending → rejected
pending → cancelled (by submitter)
approved → cancelled (by submitter, if allowed)
```

### Kétlépéses beküldési folyamat (Conflict Engine)
1. **Check fázis**: ütközésellenőrzés
   - **Blokkoló**: ünnepnap átfedés, tiltott nap, saját függő kérelem átfedése
   - **Figyelmeztetés**: max_absent (csapat/workspace limit), másik felhasználó függő kérelme
2. **Submit fázis**: tényleges beküldés (csak ha nincs blokkoló)

### Kérelem mezők (leave_requests)
| Mező | Leírás |
|---|---|
| workspace_id | Munkaterület |
| user_id | Kérelmező |
| type_id | FK → enterprise_leave_types |
| start_date | Kezdő dátum |
| end_date | Befejező dátum |
| status | pending / approved / rejected / cancelled |
| is_half_day | Félnapos-e |
| half_day_period | morning / afternoon |
| is_private | Privát kérelem (más tagok nem látják a részleteket) |
| cancellation_reason | Visszavonás oka |

### Kvóta-kezelés
- Tábla: `enterprise_quota_transactions`
- Minden jóváhagyott kérelem csökkenti az éves egyenleget
- `QuotaBalanceCard` komponens mutatja a felhasználó egyenlegét
- `QuotaManager` admin felületen kezelhető

### Értesítések
- Kérelem beküldésekor: jóváhagyó(k) értesítése → `send-transactional-email`
- Jóváhagyáskor/elutasításkor: kérelmező értesítése

### Technikai leképezés
- Tábla: `leave_requests`, `enterprise_quota_transactions`, `enterprise_leave_types`
- Komponens: LeaveRequestList, QuotaBalanceCard
- Permission: `canEdit('leave_requests_submit')`, `canView('requests_own')`, `canView('requests_team')`

---

## 4. Jóváhagyási workflow

### Üzleti cél
A többlépéses jóváhagyási lánc biztosítja, hogy a szabadságkérelmek a megfelelő döntéshozókon mennek keresztül, sorban. Az eszkalációs mechanizmus megakadályozza az elakadó kérelmeket.

### Szerepkörök
- **owner / resourceAssistant**: jóváhagyási lánc konfigurálása, jóváhagyás/elutasítás, tömeges műveletek
- **member**: saját kérelmei státuszát látja

### Belépési pontok
- Munkaterület → Kérelmek → **Jóváhagyások** (admin, összecsukható)
- ApprovalInbox komponens
- AdminLeaveOverride: felülbírálati lehetőség

### Jóváhagyási lánc működése
1. Minden workspace-hez egy vagy több jóváhagyási lánc konfigurálható (`enterprise_approval_chains`)
2. Minden lánc több lépésből áll (steps), sorrendbe rendezve
3. Az 1. lépés jóváhagyója kap értesítést
4. Az 1. lépés jóváhagyása után a 2. lépés jóváhagyója kap értesítést
5. Eszkaláció: konfigurálható óra-küszöb után automatikusan a következő lépésre vagy az Owner-re eszkalálódik

### Döntésmemória (DecisionMemoryStaleInbox)
- A rendszer tárolja a korábbi döntési mintákat
- Ha a minta elavult (pl. tag szerepköre változott), figyelmeztetés jelenik meg
- `DecisionMemoryStaleInbox` komponens

### Tömeges műveletek
- Bulk approve / bulk reject az ApprovalInbox-ban
- `approval_decisions` tábla rögzíti az egyedi döntéseket

### Értesítések
- Lépésenkénti értesítés a jóváhagyónak
- Végeredmény értesítése a kérelmezőnek

### Technikai leképezés
- Tábla: `enterprise_approval_chains`, `approval_decisions`
- Komponens: ApprovalInbox, ApprovalChainManager, AdminLeaveOverride, DecisionMemoryStaleInbox
- Permission: `canView('approvals')`, `canEdit('admin_override')`

---

## 5. Naptár és ütemezés

### Üzleti cél
A naptár modul a csapat szabadságainak vizuális megjelenítését, kapacitástervezést és éves áttekintést biztosít. Négy különböző nézetben jeleníti meg az adatokat.

### Sub-nézetek

#### 5.1 Havi naptár (calendar-main)
- **LeaveCalendar**: havi nézet, jóváhagyott és függő szabadságokkal
- **BirthdayAnniversaryWidget**: közelgő születésnapok és évfordulók
- **AnnualTrendChart**: éves trendek megjelenítése

#### 5.2 Idővonal (calendar-timeline)
- **TimelineView**: sor-per-tag idővonal, virtualizált (`@tanstack/react-virtual`)
- **SkillCapacityReport**: készség-kapacitás riport
- Debounce hónapváltáskor (v3.3.2 óta), Promise.allSettled adatbetöltéshez
- Stabil `useCallback` + `useRef` (v3.3.3 óta, re-render loop javítás)

#### 5.3 Kapacitástervező (calendar-coverage)
- **CoveragePlannerView**: napi lefedettség tervezése pozíció/készség/telephely szerint
- Minimális fejszám szabályok ellenőrzése

#### 5.4 Éves nézet (calendar-annual)
- **AnnualLeaveGrid**: az egész éves szabadságok egy nézetben

### iCal integráció
- `leave-ical` edge function: iCal feed jóváhagyott szabadságokhoz
- Outlook/Google Calendar kompatibilis
- `ICalSubscription` a Settings-ben; `settings=none` profilnál ugyanaz a kártya
  a mindig elérhető Saját portálon jelenik meg, a workspace-beállítások
  jogosultságának kiszélesítése nélkül

### Szűrők
- `CalendarFilterSettings`: csapat, tag, szabadságtípus szűrők

### Technikai leképezés
- Route/tab: `?tab=calendar&sub=calendar-main|calendar-timeline|calendar-coverage|calendar-annual`
- Permission: `canView('calendar')`, `canView('calendar_leave_days')`, `canView('calendar_coverage')`

---

## 6. Szervezeti struktúra

### Üzleti cél
A szervezeti struktúra modul lehetővé teszi a vállalat hierarchiájának, vezető szintjeinek, szerződéstípusainak, iparágainak és munkakategóriáinak karbantartását. Az org chart vizuálisan jeleníti meg a szervezeti fa struktúrát.

### Sub-tabok

| Sub-tab | Komponens | Leírás |
|---|---|---|
| structure | OrgStructure | Szervezeti egységek hierarchiája |
| leadership | LeadershipLevels | Vezetési szintek definíciói |
| contracts | ContractTypes | Szerződéstípusok katalógusa |
| industry | Industries | Iparágak katalógusa |
| categories | WorkCategories | Munkakategóriák |
| job_families | JobFamilies | Állásfamilák |
| chart | OrgChart + OrgChartPremiumView | Interaktív org chart |

### Org Chart (chart sub-tab)
- Pan/zoom navigáció (v3.3.1 óta)
- Teljes képernyős modális nézet
- Snapshots: `enterprise_org_chart_snapshots` tábla rögzíti az állapotokat
- Premium nézet: `OrgChartPremiumView`

### Technikai leképezés
- Route/tab: `?tab=organization&sub=structure|leadership|contracts|industry|categories|job_families|chart`
- Permission: `canView('members')` (tab-szintű)

---

## 7. Erőforrások és kapacitás

### Üzleti cél
Az erőforrás modul a projektek, kapacitás, hőtérkép és pénzügyi elemzések kezelésére szolgál. Lehetővé teszi a hiányosságok azonosítását és forgatókönyv-alapú tervezést.

### Sub-tabok

| Sub-tab | Komponens | Leírás |
|---|---|---|
| dashboard | ResourceDashboard | Összefoglaló áttekintés |
| heatmap | UtilizationHeatmap | Kihasználtság hőtérkép |
| projects | ProjectList + ProjectEditor + GanttTimeline | Projektkezelés Gantt-tal |
| agile | AgilePanel | Agile tábla (lásd §8) |
| skills | SkillsManager | Készségek kezelése |
| scenarios | ScenarioPlanner | Forgatókönyv tervező |
| financials | FinancialsPanel | Pénzügyi elemzések |
| gaps | CapacityGapReport | Kapacitás-hiány riport |

### Kapacitás számítás
```
hours = base_working_hours × (allocation_pct / 100)
shortage_score = FTE_required - FTE_available
```

### CapacityDnaPanel
- A Resources tab alatt mindig megjelenik
- Átfogó kapacitás-profil az egész workspace-re

### Lefedettségi szabályok (Coverage Rules)
- Minimális fejszám pozíció/készség/telephely/nap szerint
- Multi-pozíció, multi-készség OR logika
- Automatikus archiválás: pg_cron 02:15 UTC

### Technikai leképezés
- Route/tab: `?tab=resources&sub=dashboard|heatmap|projects|agile|skills|scenarios|financials|gaps`
- Permission: mindig látható (resources tab), részletek permissziók alapján

---

## 8. Agile integráció

### Üzleti cél
Az Agile panel lehetővé teszi a Jira és Azure DevOps issue-k szinkronizálását és vizualizálását Kanban, Scrum vagy Gantt nézetben, a kapacitás-illeszkedés elemzésével.

### Sub-komponensek (AgilePanel → AgileBoards)
- **Kanban tábla**: oszlop-alapú kártyanézet
- **Scrum board**: sprint-alapú nézet
- **Gantt nézet**: időalapú projekttervező
- **CapacityFit**: issue-kapacitás illeszkedés elemzése
- **IssueWriteback**: változások visszaírása Jirába/ADO-ba
- **BacklogBrowser**: backlog böngésző
- **JiraIssueEditor**: Jira issue szerkesztő

### Integrációk
- **Jira** (OAuth): issue szinkronizáció, writeback, kapacitás-fit elemzés
- **Azure DevOps** (PAT token): issue szinkronizáció, writeback
- Proxy: `jira-devops-proxy` edge function

### Szinkronizáció folyamat
1. Admin konfigurálja az integrációt a Settings → Integrations alatt
2. Issue-k szinkronizálódnak a `enterprise_agile_issues` táblába
3. AgilePanel megjeleníti és szerkeszthetővé teszi
4. Writeback: módosítások visszakerülnek a forrásrendszerbe

### Technikai leképezés
- Tábla: `enterprise_agile_issues`
- Edge function: `jira-devops-proxy`
- Sub-tab: `?tab=resources&sub=agile`

---

## 9. Workflows (Onboarding/Access)

### Üzleti cél
A workflows modul strukturált onboarding és hozzáférés-kérelem folyamatokat biztosít. Az onboarding template-ek meghatározzák, milyen lépéseket kell elvégezni az új tagoknak.

### Sub-tabok (WorkflowsModule)

| Sub-tab | Komponens | Leírás |
|---|---|---|
| Onboarding Templates | OnboardingTemplates | Onboarding sablon szerkesztő |
| Onboarding Inbox | OnboardingInbox | Aktív onboarding feladatok |
| Access Systems | AccessSystems | Hozzáférési rendszerek katalógusa |
| Access Templates | AccessTemplates | Hozzáférés-kérelem sablonok |
| Access Inbox | AccessInbox | Aktív hozzáférés-kérelmek |

### Lépés típusok
| Típus | Leírás |
|---|---|
| task | Elvégzendő feladat |
| read | Olvasandó dokumentum |
| acknowledge | Visszaigazolás szükséges |
| training | Képzés elvégzése |
| exam | Vizsga |
| approval | Jóváhagyás szükséges |
| internal_permission | Belső jogosultság-kérelem |
| external_access | Külső rendszer hozzáférése |

### Workflow folyamat
1. Admin sablon létrehozása (OnboardingTemplates / AccessTemplates)
2. Sablon hozzárendelése taghoz (pl. belépéskor)
3. Tag a Workflows → Onboarding Inbox-ban látja a feladatait
4. Lépések elvégzése, visszaigazolás
5. Jóváhagyási lépések értesítik az adminokat

### Technikai leképezés
- Route/tab: `?tab=workflows`
- Permission: `canView('members')` (tab-szintű)

---

## 10. Riportok és audit

### Üzleti cél
A riport modul lehetővé teszi az adatok elemzését, exportálását és ütemezett küldését. Az audit log rögzíti az összes kritikus műveletet.

### Komponensek

| Komponens | Leírás |
|---|---|
| Reports (általános) | Mentett és egyéni lekérdezések |
| AuditLog | Teljes audit napló szűrési lehetőséggel |
| ExportCenter | Adatexport különböző formátumokban |

### Riport futtatás
- `run-report` edge function: mentett riport lekérdezések végrehajtása
- `send-scheduled-reports` edge function: cron-alapú automatikus riport küldés

### Audit log
- `AuditLog` komponens
- Rögzíti: ki, mit, mikor módosított
- Szűrhető: dátum, felhasználó, esemény típus szerint

### Export
- `ExportCenter` komponens
- Formátumok: CSV és egyéb (inferred)

### Technikai leképezés
- Route/tab: `?tab=reports-audit`
- Edge functions: `run-report`, `send-scheduled-reports`
- Permission: `canView('reports')`, `canView('audit')`, `canView('export')`

---

## 11. Beállítások és konfiguráció

### Üzleti cél
A beállítások modul az összes workspace-szintű konfiguráció kezelésére szolgál, beleértve az általános beállításokat, integrációkat, értesítéseket, lokalizációt és branding-et.

### Beállítás szekciók

| Szekció | Komponens | Leírás |
|---|---|---|
| General | WorkspaceGeneralSettings | Munkaterület neve, timezone, locale |
| Leave Types | LeaveTypeManager | Szabadságtípusok konfigurációja |
| Holidays | HolidayManager | Ünnepnapok kezelése |
| Daily Coverage Rules | DailyRuleManager | Napi lefedettségi szabályok |
| Rule Templates | RuleTemplateLibrary | Szabálysablon könyvtár |
| Approval Chains | ApprovalChainManager | Jóváhagyási láncok konfigurációja |
| Calendar Filters | CalendarFilterSettings | Naptár szűrő beállítások |
| Role Permissions | RolePermissionManager | Szerepkör-jogosultságok konfigurálása |
| Integrations | IntegrationManager | Jira, ADO, iCal integrációk |
| iCal | ICalSubscription | iCal feed beállítások |
| Localization | LocalizationSettings | Nyelv és fordítási beállítások |
| Recovery Mode | RecoveryModeSettings | Helyreállítási mód kapcsoló |
| Integration Health | IntegrationHealthCenter | Integráció egészségi állapot |
| Help System | HelpSystemSettings | Súgórendszer kezelése |
| Branding | BrandingManager | Márka arculat beállítása |
| CSV Import | CsvImportPanel | Adatimport CSV-ből |
| Audit Log | AuditLog | Audit napló megtekintése |
| UI Section State | UiSectionStateManager | UI szekció állapotok kezelése |
| Export | ExportCenter | Adatexport |
| Allowances | AllowanceManager | Juttatások kezelése |
| Quota Manager | QuotaManager | Kvóta kezelés |
| Office Manager | OfficeManager | Irodák / telephelyek kezelése |
| Notifications | EnterpriseNotifications | Értesítési beállítások |
| Notification Preferences | NotificationPreferences | Egyéni értesítési preferenciák |

### Lokalizáció
- `I18nProvider`: HU/EN locale-ok
- Workspace-szintű CSV override-ok: `enterprise_translation_overrides` tábla
- `LocalizationSettings` UI a fordítások szerkesztéséhez

### Holiday szinkronizáció
- `sync-holidays` edge function: külső API-ból szinkronizálja az ünnepnapokat

### Technikai leképezés
- Route/tab: `?tab=settings`
- Permission: `canView('settings')`, `canEdit('permission_config')`, `canEdit('layout_setting')`
