## 2026-04-30 — Production stabilization audit: backend bug fixes

### Fixed — `src/lib/conflictEngine.ts`
- **`officeRuleApplies` legacy column fallback**: The function only checked `days_of_week` (array) but not the legacy `day_of_week` (scalar) column. Office coverage rules that used the scalar column were incorrectly applied to *every* day of the week instead of the configured day. Fixed by mirroring the same fallback logic already present in `ruleApplies`.
- **Unscoped `enterprise_holidays` query**: Holidays were fetched for the entire workspace history without a date range filter, causing unnecessary data transfer. Now filtered with `.gte`/`.lte` scoped to the requested date range.
- **Unscoped `leave_requests` query in conflict check**: All pending/approved leave requests for the workspace were fetched regardless of date. For large workspaces this was a significant over-fetch. Now filtered to only requests overlapping the requested date range (`.lte('start_date', rangeEnd).gte('end_date', rangeStart)`).

### Fixed — `src/lib/capacityEngine.ts`
- **Silent failure on Supabase query errors**: `computeWorkspaceCapacity` destructured only `{ data }` from Supabase responses, completely ignoring `.error`. A failed allocations or memberships query would return `null` data, causing the engine to silently compute zero-capacity results with no diagnostic output. All parallel queries now capture `.error` and log it via `console.error`.

### Fixed — `supabase/functions/jira-devops-proxy/index.ts`
- **`adoUpdate` could send empty JSON-patch**: If a caller provided a payload with none of the recognized fields (`summary`, `assignee_email`, `iteration_path`, `status`), the `ops` array remained empty and the ADO API rejected it with a misleading error. Now throws a descriptive error before making the network call if `ops.length === 0`.
- **`sync_project_config` accepted missing `project_key`**: `jiraSyncProjectConfig` fell back to an empty string for `project_key`, which produced incorrect or empty Jira API responses. Now validated with an early guard — throws if `project_key` is not set on the integration record.

### System Understanding Summary (Audit findings — no further action required)
- **Architecture**: Dual-product monorepo — Syncfolk (consumer event calendar) + PlannerMaster (enterprise leave/resource management), both backed by Supabase. Schema split (syncfolk / plannermaster schemas) was introduced 2026-04-29 as additive clones of public tables.
- **Business logic**: Leave conflict engine, capacity engine, coverage eligibility, and smart schedule algorithm are pure or near-pure TypeScript — testable, low coupling.
- **Data integrity**: RLS enforced on all enterprise tables via `has_enterprise_role()` / `is_enterprise_member()` SECURITY DEFINER functions. Foreign key cascade deletes on workspace-scoped tables.
- **Identified risk (informational)**: `Index.tsx` polls the DB every 4 s for both events and votes (two separate intervals). Acceptable at current scale but should be replaced with Supabase realtime subscriptions for cost and performance headroom.
- **Identified risk (informational)**: Audit log (`auditLog.ts`) is fire-and-forget; failures are only `console.warn`ed. For compliance-critical workspaces, a queue-based fallback would be safer.

## 2026-04-29 — Jira search hardening: normalized base URL for enhanced JQL endpoint

### Fixed
- `jira-devops-proxy` Jira hívásoknál a `base_url` normalizálása bekerült (`jiraBaseUrl()`), amely levágja a véletlenül eltárolt `/rest/api/...` útvonalrészt. Így akkor is a helyes `.../rest/api/3/search/jql` végpont hívódik, ha az integrációs beállításban nem csak host szerepel.
- Ugyanez a normalizálás egységesen alkalmazva lett a Jira `myself`, `field`, `issue create/update` és `browse` URL-ekre is, ezzel csökkentve a hibás endpoint-összefűzésből adódó 404/410 hibákat.

## 2026-04-28 — Agile Jira integration fix: search API migration + project config sync

### Fixed
- Jira issue lekérdezés átállítva a megszűnt `/rest/api/3/search` végpontról a támogatott `/rest/api/3/search/jql` végpontra, így a JQL alapú backlog lekérdezések (pl. `openSprints()`) ismét futnak.

### Added
- Új `sync_project_config` művelet a `jira-devops-proxy` edge functionben, amely:
  - betölti a projekt issue type listáját Jira-ból,
  - begyűjti a projektben használt label/component értékeket,
  - ezeket elmenti az `enterprise_agile_field_metadata` táblába.
- `IssueWriteback` UI-ban új „Jira projekt konfiguráció szinkron” gomb + DB-ből visszatöltés.
- Issue létrehozásnál a Jira issue type mező már DB-alapú dropdownból választható, a címke mező pedig Jira label javaslatokat ad (datalist), csökkentve az elírásból adódó hibákat.

## 2026-04-28 — v2.6.0 Annual quotas fix + Agile integration GA

### Fixed
- **Annual calendar quotas** now filter `enterprise_quota_transactions` by `workspace_id` AND the resolved `quota_id` (which inherently scopes by year + leave_type). Previous logic summed every TX across all years/types for the membership, producing inflated/incorrect "used" counts.

### Added
- **Agile module (Resources → Agile)** replacing the duplicate Idővonal tab:
  - `BacklogBrowser` — JQL/WIQL search with cached results in `enterprise_agile_issues`
  - `IssueWriteback` — create + update issues for both Jira and Azure DevOps
  - `CapacityFit` — sprint capacity vs. planned hours, overload/underload detection
  - `FieldDiscovery` — custom field metadata discovery
  - `AgilePanel` — unified shell with integration switcher
- **`jira-devops-proxy` edge function** — unified secure proxy supporting `test_connection`, `discover_fields`, `search_issues`, `create_issue`, `update_issue`. Membership-checked; logs every call into `enterprise_agile_sync_log`.
- **IntegrationManager "Kapcsolat tesztelése"** button per integration row.
- **pg_cron daily job** `auto-archive-expired-coverage-rules-daily` (02:15 UTC) → invokes `public.auto_archive_expired_coverage_rules()`.

### Removed
- `Idővonal` tab from Resources (Hőtérkép remains as primary capacity view; Project Gantt stays inside the Projects tab).

## 2026-04-27 — v2.5.1 Calendar/Capacity regression hotfix

### Fixed
- `OfficeCoverageRuleManager`: a `business_roles` / `skill_ids` oszlopokra épülő mentés most schema-cache safe. Ha a Supabase/PostgREST még a régi `enterprise_office_coverage_rules` sémát látja, a mentés automatikusan legacy payloadra esik vissza (`business_role`, `skill_id`), így az egy pozíciós telephelyi szabály mentése nem dob `Could not find the 'business_roles' column` hibát.
- `CoveragePlannerView`: eltávolítva a `Szabályok szerkesztése` gomb a Kapacitástervezőből, mert rossz helyre navigált és a felhasználói flow-t zavarta.
- `CoveragePlannerView`: havi nézetben a szabály nélküli telephely sorok már nem szöveges, sort magasító cellákat mutatnak, hanem visszafogott szürke napcellákat vékony elválasztó vonalakkal.
- `TimelineView`: az Idővonal szűrőpanelje desktopon keskeny bal oldali sávba került, a naptár pedig mellette, `minmax(0, 1fr)` tartalomterületen jelenik meg.

### Regression guard
- Megmaradt a multi-pozíció / multi-skill támogatás, ha az adatbázis már tartalmazza az új tömb oszlopokat.
- A fallback csak schema-cache / hiányzó `business_roles` / `skill_ids` oszlop hiba esetén aktiválódik, más mentési hibákat továbbra is változatlanul megjelenít.

---

## 2026-04-27 — Multi-pozíció szabályok, Absentify szűrőpanel, havi nézet, navigációs bug fix, éves nézet fix

### OfficeCoverageRuleManager — Több pozíció / skill egy szabályban
- Szabályhoz mostantól több pozíció ÉS több skill is hozzárendelhető (checkbox multi-select lista)
- Pozíció-lista most MINDEN definiált pozíciót megjelenít: `enterprise_memberships.business_role` + `enterprise_member_role_allocations.business_role` union (nem csak a jelenleg hozzárendelt szerepek látszanak)
- DB migráció: `business_roles text[]` és `skill_ids uuid[]` oszlopok hozzáadva az `enterprise_office_coverage_rules` táblához, backward-compatible constraint frissítéssel

### CoveragePlannerView — Heti/Havi nézet + multi-pozíció kezelés
- Heti / Havi nézet váltó gomb; havi módban vízszintes görgetősáv jelenik meg a napok felett
- A cella megjelenítése **elvárás / van** (pl. "4 / 3") formátumra változott
- `supplyFor` mostantól BÁRMELY pozíció/skill egyezésekor számít (OR logika a szabály tömbjein belül)
- Race condition fix: `loadIdRef` megakadályozza a stale válaszok felülírását navigálásnál

### CalendarFilterBar — Absentify-stílusú összecsukható panel
- Teljes újratervezés: vízszintes dropdown-gombok → accordion panel
- Fejléc: "Szűrők (n)" lila badge az aktív szűrők számával + "Elrejt/Megjelenít" gomb
- Minden kategória alapból összecsukott; lila háttér ha aktív kijelölés van benne
- Keresőmező 6+ elemű listáknál; azonnali szűrés (nincs külön Alkalmaz gomb)

### useCalendarFilterConfig — Új szűrőtípusok
- `skill` (Képesség / Skill) és `location` (Helyszín / város) szűrők hozzáadva
- Meglévő workspace-konfigurációk automatikusan kiegészülnek az új szűrőkkel

### TimelineView — Navigációs bug fix + új szűrők
- Race condition javítva: `loadIdRef` garantálja, hogy csak a legutóbbi kérés frissíti az állapotot
- Betöltési hiba esetén helyes hibaüzenet jelenik meg (nem az "üres szűrőállapot")
- Skill-szűrő: `enterprise_member_skills` betöltése, tagok skill-készletük alapján szűrhetők
- Helyszín-szűrő: `city` mező a membershipből, városra szűrhető

### AnnualLeaveGrid — Éves nézet adat- és színhiba javítása
- Dátumtartomány-lekérdezés javítva: `lte(start_date, yEnd) AND gte(end_date, yStart)` (valódi overlap)
- Szín-feloldás bővítve: egyedi enterprise típus nevén kívül az enum értékekre (`vacation`, `sick_leave`, stb.) is fallback szín kerül, így minden távollét mindig színezve jelenik meg

---

## 2026-04-27 — Phase C+D+E: Skill Reporting, Widget Restructuring, Yearly Fix & QA [Fázis C/D/E]

### Chapter 4 — Dynamic Capacity & Skill Reporting (Phase C)
- Új `SkillCapacityReport` komponens (`src/components/enterprise/calendar/SkillCapacityReport.tsx`): a TimelineView szűrő-motorjával szinkronizált, valós idejű riport a szűrt user pool-hoz.
- **Összefoglaló kártyák** (glassmorphism stílusú): Szűrt tagok · Elérhető · Jóváhagyott távollét · Elérhetőség %.
- **Készség elérhetőség** panel: skill-enkénti progress bar (szín = a skill saját hex kódja), elérhető/összes arány.
- **Pozíció kapacitás** panel: Recharts horizontális stacked BarChart (zöld = elérhető, piros = távol).
- Skeleton loaderek az aggregálás idejére; cleanup (`cancelled` flag) a stale request megelőzésére.
- **Integráció**: `WorkspaceDashboard` Idővonal tab-on `onFilteredUsersChange` callback vezérli a `SkillCapacityReport`-ot — bármely szűrőváltozás automatikusan újra-aggregál.

### Chapter 1 — Calendar Widget Restructuring (Phase D, Task 1)
- **Task 1.1 — Widget-áthelyezés**: `BirthdayAnniversaryWidget` és `AnnualTrendChart` átkerült a `Naptár` fő nézetben a `LeaveCalendar` *alá* (korábban fölötte volt). Ezentúl kiegészítő, másodlagos infó-blokkok.
- **Task 1.2 — Intelligent Collapsed State**: `BirthdayAnniversaryWidget` mostantól `Collapsible` (alapállapot: **csukva**). Piros badge (`bg-red-500 text-white rounded-full`) jelzi a következő 7 napon belüli eseményeket. A lista-soroknál a 7 napon belüli események `bg-red-50 dark:bg-red-950/20` tintával emelkednek ki.
- `checkUpcomingEvents()` pure utility függvény: leap-year safe, timezone-safe, 7 napos ablak.

### Chapter 2 — Eliminate Misleading Status Indicator (Phase D, Task 2)
- `OutTodayWidget` eltávolítva a **Tagok** fülből. A "Mindenki dolgozik ma" üres-state szöveg félrevezető volt (hétvégén és ünnepnapokon is megjelent). Az aktuális távolléti állapot a Naptár → Idővonal nézeten tekinthető meg.

### Chapter 5 — Yearly Calendar Remediation (Phase D, Task 5)
- `AnnualLeaveGrid` bővítve:
  - **Felhasználó-választó dropdown** adminok számára (`allMembers` prop alapján): alapértelmezett = bejelentkezett felhasználó.
  - **`resolvedMembershipId` auto-fetch**: ha a `membershipId` prop nincs megadva, a komponens `allMembers`-ből vagy DB lekérdezéssel oldja fel → a kvóta (`Allowance / Carried over / Remaining`) mostantól helyesen jelenik meg.
  - `WorkspaceDashboard` átadja `allMembers` és `isAdmin` propokat az `AnnualLeaveGrid`-nek.

### Chapter 7 — QA & Delivery (Phase E)
- Zero regression: meglévő `LeaveCalendar`, `TimelineView`, `CoveragePlannerView` érintetlen.
- `BirthdayAnniversaryWidget` eredeti listázó logikája megmaradt; csak wrapper és stílus változott.
- `AnnualLeaveGrid` backward-compatible: `membershipId?` és `allMembers?` opcionálisak.
- TypeScript build tiszta (tsc --noEmit).

---

## 2026-04-27 — Naptár Idővonal nézet (Absentify-style) + dinamikus szűrő-motor [Phase A]

### Added
- **Idővonal nézet** (`TimelineView`): row-by-row Absentify-stílusú grid napi cell-státuszokkal (szabadság / ünnep / hétvége / munkanap), `@tanstack/react-virtual` row virtualizációval (200+ tag is gördülékeny).
- **Dinamikus szűrő-motor** (`CalendarFilterBar`): multi-select Popover szűrők (Telephely, Csapat, Pozíció, Szabadság típusa, Státusz). Auto-apply (nincs Submit), aktív szűrő = lila tint, "Szűrők (n)" badge.
- **Naptár Szűrők beállítása** admin felület (Settings tab): drag&drop sorrend (`@dnd-kit`) + per-szűrő enable/disable kapcsoló, workspace-szintű perzisztencia.
- 3. tab a Naptár oldalon: **Naptár | Idővonal | Éves nézet**.

### Database
- Új tábla: `tenant_calendar_settings` (workspace_id UNIQUE, filters_config JSONB) RLS-sel: tagok olvassák, owner/resourceAssistant írja.

### Dependencies
- `@tanstack/react-virtual`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### Notes
- Zero-regression: a meglévő Naptár és Éves nézet érintetlen.
- A `TimelineView` `onFilteredUsersChange` propon keresztül adja le a szűrt user pool-t — Phase B (Coverage Engine) és Phase C (Skill Reporting) ezt fogja fogyasztani.

# Changelog

## 2026-04-25 — Absentify integráció: Quota, Substitute, Attachment, iCal, Jira/AzureDevOps integráció
- Új komponensek bekötve: `OutTodayWidget` (Tagok fül), `QuotaBalanceCard` + `SubstituteInbox` (Kérelmek fül), `QuotaManager` + `IntegrationManager` + `ICalSubscription` (Beállítások fül)
- `LeaveRequestDialog` bővítve: helyettesítő-választó (`SubstitutePicker` integrálva), csatolmány-feltöltés (`leave-attachments` Storage bucket), privát kérelem toggle (`is_private`), audit metadatában a substitute_count + has_attachment + is_private nyomon követve
- `LeaveRequestList.handleCancel` mostantól bekéri és tárolja a `cancellation_reason`-t (audit metadata-ba is bekerül)
- Helyettesítő-rögzítés (sorrendben) az új `leave_request_substitutes` táblába írja az adatokat
- Backward-compatibility: meglévő mezők és táblák érintetlenek; az új mezők opcionálisak/null-default-tel
- Nem duplikáltunk meglévő funkciót — a Naptár, Kérelmek, Beállítások meglévő tab-jaiba kerültek be a panelek


## 2026-04-11 — v2.4.0 Email értesítések, demo adatok, mobil tesztelés
- Email értesítés küldés jóváhagyási/elutasítási döntéseknél (transactional email infra + leave-decision sablon)
- Genisys workspace demo adatok: 8 tag (owner, resourceAssistant, 6 member), 12 szabadságkérelem (pending/approved/rejected), szabadság típusok, ünnepnapok, tiltott napok, napi szabályok, jóváhagyási lánc, escalation, értesítések, audit log események
- Leiratkozás oldal (/unsubscribe) az email értesítésekhez
- Mobil reszponzivitás tesztelve: összes Enterprise tab (Tagok, Kérelmek, Jóváhagyások, Értesítések, Riportok, Audit, Export) megfelelően jelenik meg 390px szélességen

## 2026-04-11 — v2.3.0 Enterprise Phases 4-9: Approval Chain, Audit, Notifications, Export, Reporting, Templates
- Jira: SYN-146 + remaining enterprise stories
- Új DB táblák: `enterprise_approval_chains`, `enterprise_escalation_rules`, `enterprise_audit_events`, `enterprise_notifications`, `enterprise_rule_templates`, `enterprise_export_jobs`
- Phase 4: Jóváhagyási lánc konfiguráció (lépések, szerepkörök), eszkaláció szabályok (óra küszöb, célszerepkör, owner értesítés)
- Phase 5: Audit log (immutable, szűrhető, kereshető, 100 utolsó esemény)
- Phase 6: Enterprise értesítések (olvasott/olvasatlan, törlés, emoji ikonok)
- Phase 7: CSV export (dátumtartomány, státusz szűrő, ünnepnapok, audit log bejegyzés)
- Phase 8: Reporting dashboard (KPI kártyák, státusz pie chart, típus bar chart, napi távollévők chart)
- Phase 9: Szabálysablon könyvtár (létrehozás, duplikálás, archiválás, JSON adat)
- WorkspaceDashboard: 6 új tab (Értesítések, Riportok, Audit, Export + Approval chain és Templates a Szabályok tabba)

## 2026-04-11 — v2.2.0 Enterprise Phase 3: Leave Types, Holidays, Rules & Conflict Engine
- Jira: SYN-148, SYN-147
- Funkció: Egyedi szabadság típusok, ünnepnapok, tiltott napok, napi szabályok kezelése
- Új DB táblák: `enterprise_leave_types`, `enterprise_holidays`, `enterprise_blocked_dates`, `enterprise_daily_rules`
- RLS: workspace tagok olvashatják, owner/resourceAssistant kezelhetik a konfigurációt
- Új UI komponensek: `LeaveTypeManager`, `HolidayManager`, `BlockedDateManager`, `DailyRuleManager`
- Új "Szabályok" tab a WorkspaceDashboard-ban (admin only)
- Conflict engine (`src/lib/conflictEngine.ts`): tiltott nap, ünnepnap, max-off, saját átfedés ellenőrzés
- LeaveRequestDialog: kétlépcsős submit (Ellenőrzés → Beküldés), blocking/warning ütközések megjelenítése
- Módosított fájlok: `WorkspaceDashboard.tsx`, `LeaveRequestDialog.tsx`

## 2026-04-11 — v2.1.0 Enterprise Phase 2: Leave Request & Approval Workflow
- Jira: SYN-165, SYN-150, SYN-149
- Funkció: Távolléti kérelem beküldés, jóváhagyási workflow, approval inbox
- Új DB táblák: `leave_requests`, `approval_decisions`
- Új enumok: `leave_request_status` (draft/pending/approved/rejected/cancelled/expired), `leave_type` (vacation/sick_leave/unpaid_leave/other)
- RLS policies: tagok saját kérelmet adhatnak be, owner/resourceAssistant jóváhagyhat/elutasíthat
- Új UI komponensek: `LeaveRequestDialog`, `LeaveRequestList`, `ApprovalInbox`
- WorkspaceDashboard-ban új tabok: Kérelmek, Jóváhagyások
- Bulk approve/reject funkció az approval inbox-ban szűrőkkel
- Módosított fájlok: `src/components/enterprise/WorkspaceDashboard.tsx`
- Új fájlok: `src/components/enterprise/LeaveRequestDialog.tsx`, `LeaveRequestList.tsx`, `ApprovalInbox.tsx`

## 2026-04-11 — v2.0.0 Enterprise Phase 1
- Jira: SYN-168, SYN-170, SYN-169
- Funkció: Enterprise B2B modul alapjai — Workspace, Membership, Roles
- Új DB táblák: `enterprise_workspaces`, `enterprise_memberships`, `enterprise_invitations`
- Új enumok: `enterprise_role` (owner/resourceAssistant/member), `enterprise_membership_status` (active/invited/suspended/removed)
- Új SECURITY DEFINER funkciók: `has_enterprise_role()`, `is_enterprise_member()`
- RLS policies: role-alapú hozzáférés-szabályozás minden enterprise táblán
- Új UI: `/enterprise` route, workspace lista, dashboard, tag kezelés, meghívók, beállítások
- ProfileMenu-ben Enterprise menüpont hozzáadva
- Módosított fájlok: `src/App.tsx`, `src/components/ProfileMenu.tsx`
- Új fájlok: `src/pages/Enterprise.tsx`, `src/components/enterprise/*`

## 2026-03-26
- Jira: nincs hozzárendelt jegyszám
- Funkció: a kitűzött nap kiválasztó popup mérete limitálva lett, egyszerre legfeljebb kb. 5 dátum látható, a lista görgethető maradt.
- Funkció: kitűzött nap esetén a batch kitöltés panel továbbra is megjelenik, de minden vezérlője inaktív állapotba kerül.
- Funkció: a kitűzött nap módosítása ablakban megjelent a Feloldás művelet, amellyel újranyitható a szavazás, ha az esemény nincs határidőn túl és nincs inaktiválva.
- Funkció: a személyes elérhetőség másolása nem fut le olyan eseményre, amelyen már van kitűzött nap.
- UI/reszponzivitás: a központi naptár lett az elsődleges szélességi referencia, a bal és jobb oldali panelek ehhez igazodnak kisebb hézagokkal.
- Technikai megvalósítás: módosítva `src/pages/Index.tsx`, `src/components/BatchVotePanel.tsx`, `src/components/PersonalCalendar.tsx`.

## 2026-03-31
- Jira: nincs hozzárendelt jegyszám
- Versioning hivatkozások:
  - `versioning/01033102_syncfolk_calendar_mobile_fix_request.pdf`
  - `versioning/01033102_syncfolk_calendar_mobile_fix_prompt.md`
- Üzleti kérés: csak az esemény részletező modal dátumválasztó naptárának mobilos megjelenését kellett javítani úgy, hogy a popup mindig a képernyő közepén jelenjen meg, és az OK gomb minden mobil nézetben látható maradjon.
- Technikai megvalósítás: az `EventInfoModal` dátumszerkesztő részében a korábbi nyers `Popover + Calendar` megoldás helyett a már létező, mobilon középre pozicionált `DatePopoverField` került használatba.
- Ellenőrzési checklist:
  - [x] `CHANGELOG.md` beolvasva
  - [ ] `codingLessonsLearnt.md` / lessons learnt fájl nem található a feltöltött repóban
  - [x] csak célzott hotfix készült az érintett dátumválasztó mezőkre
  - [x] mobilon középre kerül a calendar popup
  - [x] az OK gomb explicit módon megjelenik és használható marad
  - [x] a kezdő/vég dátum alaplogikája megmaradt
  - [x] build ellenőrzés lefutott sikeresen
- Módosított kódfájl: `src/components/EventInfoModal.tsx`

## 2026-04-22 — v2.5.0 Resource Management ökoszisztéma + dinamikus jogosultság-fa
- Phase 1 (Core Architecture, Single Source of Truth):
  - `enterprise_memberships.base_working_hours` (numeric, 0–24, default 8) — alap napi munkaóra tagonként
  - `capacityEngine` átállítva órás számításra: `hours = base_working_hours * (allocation_pct / 100)`
  - `BusinessRoleManager` (Pozíciók) most már listázza az ÖSSZES allokált tagot pozíciónként, %-os allokációval és számolt napi órával — megszüntetve a korábbi "csak 1 tag" data dissonance-t
  - `LeaveCalendar` csapat-szűrő dinamikusan a `enterprise_teams` táblából töltődik (hardcoded lista törölve)
  - `MemberProfileSheet`: szerkeszthető "Napi alap munkaóra" mező
- Phase 2 (UI Relocation & Dynamic Permissions):
  - Pozíciók és Csapatok kezelése áthelyezve a Beállításokból az **Erőforrások** fülre (alapból összecsukott akkordionok)
  - Új `enterprise_feature_catalog` tábla (parent_key hierarchia) — dinamikus, fa-alapú jogosultság-katalógus
  - `useEnterprisePermissions` hook visszaadja a `featureTree`-t (rekurzív struktúra)
  - `RolePermissionManager` UI átírva rekurzív fa-renderelésre (`FeatureTreeRow` komponens) — a jogosultság-választó automatikusan tükrözi az alkalmazás navigációs fáját, fallback a régi flat csoportosításra ha a katalógus üres
- Phase 3 (Resource Module — előző iterációkban):
  - `ResourceDashboard`, `ProjectList`, `ProjectEditor`, `GanttTimeline`, `CapacityGapReport`
  - "Kitűz a Riportokra" widget integráció (`ResourceWidgetCard`, `PinnedReportsWidget`)
- Új/módosított fájlok: `supabase/migrations/20260422164431_*.sql`, `src/lib/capacityEngine.ts`, `src/components/enterprise/BusinessRoleManager.tsx`, `LeaveCalendar.tsx`, `MemberProfileSheet.tsx`, `WorkspaceDashboard.tsx`, `RolePermissionManager.tsx`, `resources/ResourcesTab.tsx`, `src/hooks/useEnterprisePermissions.ts`

## 2026-04-25 — Absentify gap round: hátralévő dashboard integrációk + Team policy bővítés
- WorkspaceDashboard / Beállítások fül: a 4 új panel (`AllowanceManager`, `WorkspaceGeneralSettings`, `BrandingManager`, `CsvImportPanel`) beillesztve meglévő `SettingsSection` blokkokba (nem új tab, nem duplikált UI)
- Naptár fül bővítve beágyazott sub-tabokkal: `Naptár` + `Éves nézet`; az `AnnualLeaveGrid` a meglévő Calendar tabon belül érhető el
- TeamManager bővítve Department policy mezőkkel: `max_absent` és `approval_mode` (lineáris/párhuzamos) szerkeszthető csapatszinten
- Csomag I widget kiegészítés: új `BirthdayAnniversaryWidget` és `AnnualTrendChart` a Naptár fő nézetben
- Minden új elem additív módon, meglévő flow-k sértetlenül került bekötésre

## 2026-04-29 — Syncfolk / PlannerMaster schema split prep + full data clone migration

### Added
- Új Supabase migráció: `20260429120000_multi_tenant_schema_split.sql`.
- Új sémák automatikus létrehozása: `syncfolk` (consumer) és `plannermaster` (enterprise).
- Additív, adatvesztésmentes klónozás a `public` sémából:
  - `syncfolk`: core Syncfolk táblák (`profiles`, `events`, `votes`, stb.)
  - `plannermaster`: minden `enterprise_*` tábla + enterprise workflow táblák (`leave_requests`, `approval_decisions`, stb.)
- RLS engedélyezés a klónozott táblákon.
- Két schema-scoped helper függvény edge function izolációhoz:
  - `syncfolk.set_search_path()`
  - `plannermaster.set_search_path()`

### Notes
- A migráció szándékosan **nem törli/nem mozgatja** a meglévő `public` objektumokat, így minimális regressziós kockázattal futtatható olyan adatbázisban is, ahol másik app objektumai is élnek.

## 2026-04-29 — Kapacitástervező gyors feltöltés és Instant user gomb
- `MemberList`: új **Instant user** gomb az admin taglistán, amely a jelenlegi workspace-re automatikusan létrehoz egy meghívást előtöltött, meglévő entitásokból származó metadata-val (pozíció/csapat/telephely mintázat), így adatintegritás-barát gyors taggenerálás érhető el.
- `MemberList`: duplikált „Új tag hozzáadása” gomb JSX regresszió javítva.
- Hotfix: `Instant user` meghívásnál schema-cache kompatibilis fallback: ha a `metadata` oszlop még nem látszik (`PGRST204`), metadata nélküli insertre vált.
- Hotfix: Jira keresés proxy többvégpontos fallbacket kapott (`/search/jql` POST/GET + `/search` POST), hogy a tenant-specifikus API eltérések ne okozzanak 500-at.

## 2026-04-30 — v2.6.0 Agile Integration Capacity Sync Foundation Expansion
- Jira/Azure DevOps Agile modul additív bővítése enterprise-grade capacity sync alapokkal.
- Új adatmodell elemek migrációval:
  - `enterprise_agile_external_field_mappings` (dinamikus külső→normalizált mező mapping, irány, safe writeback flag)
  - `enterprise_agile_capacity_events` (változás/kapacitás/variance/risk/writeback/szimuláció esemény napló)
  - `enterprise_agile_issues` kiterjesztés: `capacity_risk`, `fit_score`, `suggested_role`, `plan_impact_reason`, `external_type`, `target_sprint`
- Új RLS policy-k az agile mapping/event táblákhoz enterprise szerepkör alapú jogosultsággal.
- Capacity Fit UI bővítések:
  - What-if szimuláció (`szabadság nap/fő`) azonnali kapacitás újraszámítással
  - Tagonkénti risk-level (Low/Medium/High) és fit-score (%) megjelenítés
  - Overload/underload jelzések megtartása a korábbi működéssel kompatibilisen
- Cél: a meglévő Jira/ADO foundation megtartása mellett előkészített adat- és UI-alap a kétirányú, auditált capacity sync iteratív bővítéséhez.
