## 2026-05-10 — v3.5.1 Import/Export Center: teljes implementáció

### Implemented — Skálázható, entity-alapú Import/Export Center

A v3.5.0 spec teljes körű implementációja egy lépésben. A korábbi `CsvImportPanel` (Inbox ikon, "CSV import (tagok + szabadságok)" szekció) helyett egy új `ImportExportCenter` jelenik meg "Adatkezelés — Import / Export" címmel.

**Új komponensek (`src/components/enterprise/import-export/`):**

- **`ImportExportCenter.tsx`** — fő belépési pont; action selector (Export / Import) + entity grid + Dialog wizard
- **`EntitySelector.tsx`** — kártya-alapú entity választó (Tagok, Szabadságok, Telephelyek, Munkakategóriák, Munkakörök, Pozíciók, Készségek)
- **`ExportWizard.tsx`** — mezőkijelölő + formátum + import-kompatibilis sablon opció + audit
- **`ImportWizard.tsx`** — 7-lépéses wizard: Útmutató → Feltöltés → Oszlopleképezés → Validáció Preview → Mód → Megerősítés → Eredmény
- **`config/entity-registry.ts`** — config-driven entity definíciók (61 mező 7 entitásra)
- **`utils/file-parser.ts`** — RFC 4180 CSV parser, Excel XML parser, generátorok
- **`utils/data-fetcher.ts`** — entity-specific Supabase fetchers
- **`utils/validator.ts`** — type-aware row validátor + auto column mapping + guidance row detection

**Új Edge Function (`supabase/functions/import-entity-data/index.ts`):**

- 7 entity importere egy függvényben
- Owner / resourceAssistant role check `has_enterprise_role` RPC-vel
- Members import: meglévő invitation flow-t használ új felhasználóknak; közvetlen membership update meglévőknek (upsert)
- Reference resolution: office_name → office_id, manager_email → user_id, category_name → category_id
- Audit logging: `import.started` + `import.completed` (vagy `import.completed_with_errors`)
- Workspace scoping: minden insert/update kötelezően `workspace_id`-vel
- Row-level error reporting: `{ row_index, field, value, code, message }`
- `verify_jwt = true` regisztrálva `supabase/config.toml`-ban

**Spec ↔ Implementáció megfeleltetés:**

| Spec szakasz | Implementáció |
|--------------|--------------|
| Entity Registry | `config/entity-registry.ts` — 7 entitás, 61 mező, importAlias, computed/protected flagek |
| Round-trip kompatibilis sablonok | XLSX styled header (yellow=required) + guidance row + auto-detect skip |
| 7-lépéses wizard | `ImportWizard.tsx` — step indicator + back/next nav |
| Auto column mapping | `validator.autoMapColumns` — exact key → alias → label fallback |
| Validation preview | Row-level red/yellow/green status + tooltip + first 100 sor megjelenítés |
| Hibalista letöltés | `downloadErrorReport` — failed rows mint CSV |
| Partial success | Validáció után csak a `valid` sorok mennek a Edge Function-be |
| Upsert mód | Opt-in toggle; `enterprise_offices`, `members`, `work_categories`, `job_roles`, `skills` támogatja |

**Integrációs változások:**

- `WorkspaceDashboard.tsx`: `CsvImportPanel` import törölve, `ImportExportCenter` import + render hozzáadva
- A jelenlegi `ExportCenter` (Reports tab — naptár-rács szabadság-export) érintetlen marad: az új ImportExportCenter Settings-ben él, az ExportCenter Reports-ban — két különböző UX flow

**Megőrzött funkcionalitás (ZERO REGRESSION):**

- Tagok meghívása CSV-ből — a Members entity import az új wizardon keresztül továbbra is létrehoz invitation-t új email címekhez
- Szabadságok bulk import — a Leave entity importon keresztül továbbra is működik
- Reports tab → ExportCenter (naptár-grid, dátumtartomány) — érintetlen

### Files added
- `src/components/enterprise/import-export/ImportExportCenter.tsx` *(new)*
- `src/components/enterprise/import-export/EntitySelector.tsx` *(new)*
- `src/components/enterprise/import-export/ExportWizard.tsx` *(new)*
- `src/components/enterprise/import-export/ImportWizard.tsx` *(new)*
- `src/components/enterprise/import-export/config/entity-registry.ts` *(new)*
- `src/components/enterprise/import-export/utils/file-parser.ts` *(new)*
- `src/components/enterprise/import-export/utils/data-fetcher.ts` *(new)*
- `src/components/enterprise/import-export/utils/validator.ts` *(new)*
- `supabase/functions/import-entity-data/index.ts` *(new — Edge Function)*
- `versioning/100526004_v3.5.1_import-export-center-impl.md` *(new)*

### Files changed
- `src/components/enterprise/WorkspaceDashboard.tsx` — CsvImportPanel kicserélve ImportExportCenter-re
- `supabase/config.toml` — import-entity-data edge function regisztrálva (verify_jwt = true)

### Acceptance criteria
- ✅ Settings → "Adatkezelés — Import / Export" szekció admin-only láthatósággal
- ✅ Action toggle (Export / Import) + entity selector kártyarács
- ✅ Export: mezőkijelölő grouped checklist, kötelező mezők zárolva, XLSX + CSV
- ✅ Import-kompatibilis sablon (asterisk + guidance row + auto-skip)
- ✅ 7-lépéses import wizard step indicator-ral
- ✅ Auto column mapping + manuális override Select dropdown-nal
- ✅ Validation preview: row-level status, hibás cellák tooltip, hibalista letöltés
- ✅ Create-only / upsert mód kapcsoló (entity függő)
- ✅ Edge function: 7 entity import, role check, audit log, workspace scoping
- ✅ Reference resolution (office_name, manager_email, category_name)
- ✅ Zero regression a v3.4.x sticky nav fix-ekre + v3.4.0 OrgChart deeplink-ekre

### Deploy steps
1. Apply database changes — N/A (nincs új migráció)
2. Deploy edge function: `supabase functions deploy import-entity-data`
3. Frontend deploy: standard Vite build

---

## 2026-05-10 — v3.5.0 Import/Export Center specifikáció (implementációs blueprint)

### Spec — Bulk Data Management Center tervezési specifikáció

A Settings → "CSV import (tagok + szabadságok)" és "Export" szekciók helyett egy teljes, entity-alapú, wizard-vezérelt **Import/Export Center** tervezési specifikációja. A spec implementációs blueprint — a kód következő sprintben készül.

**Jelenlegi állapot (pre-spec):**
- `ExportCenter`: csak leave/vacation export, fix mezők, nem re-importálható
- `CsvImportPanel`: 2 hardcoded tab (tagok meghívása, szabadságok), nincs preview, nincs template, gyenge hibakezelés

**Specifikált rendszer (`docs/IMPORT_EXPORT_CENTER_SPEC.md`):**
- **Entity-selector**: kártya-alapú, skálázható entitás-választó (Tagok, Szabadságok, Telephelyek, Munkakategóriák, Munkakörök, Pozíciók, Készségek)
- **Export wizard**: mezőkijelölés (kötelező mezők zárolva), import-kompatibilis sablon letöltés, XLSX/CSV
- **Import wizard** (7 lépés): Instrukciók → Feltöltés → Oszlopleképezés → Validáció + Preview → Opciók → Megerősítés → Eredmény
- **Config-driven entity registry**: új entitás hozzáadása = 1 config sor, UI módosítás nélkül
- **Round-trip kompatibilitás**: export → szerkesztés → import működik újraformázás nélkül
- **Partial success**: érvényes sorok bekerülnek, hibások kihagyva + letölthető hibalista
- **Audit logging**: minden import/export rögzítve `enterprise_audit_events`-ben

**Főbb döntések:**
- XLSX elsődleges (styled header, dropdown validáció, oszlopvédelem), CSV másodlagos
- Machine key fejlécek + `__schema_version` + importAlias a template stabilitásért
- Részleges siker (nem teljes rollback) — enterprise bulk usecase igénye
- Upsert opt-in; alapértelmezés: csak új sorok
- Kötelező mezők: zár ikon + csillag minden kontextusban

**Phase roadmap:**
- Phase 1: Tagok + Szabadságok entitások, 7-lépéses wizard, Edge Function alapok
- Phase 2: Összes entitás, inline javítás, upsert, hibalista letöltés
- Phase 3: Multi-entity export, background job >500 sornál, import előzmény

### Files added
- `docs/IMPORT_EXPORT_CENTER_SPEC.md` *(new — 20 fejezetes implementációs spec)*
- `versioning/100526003_v3.5.0_import-export-center-spec.md` *(new)*

---

## 2026-05-10 — v3.4.2 Sticky nav opacity javítás (átszűrődés megszüntetése)

### Fixed — Sticky menüsávok teljes átlátszatlansága
- A v3.4.1 sticky pozícionálás után a felhasználó észrevette, hogy görgetéskor a tartalom átszűrődik a sticky menüsávok mögött (a kapacitás kártyák `2200% / 355% / 42% / 1803%` és „Backend Developer" sor szövege látszott a menüsorok mögött).
- **Gyökérok**: A főmenü TabsList `bg-background/98` osztálya (98% opacity) nem volt elég átlátszatlan, így a görgetett tartalom látszott rajta keresztül. Az almenü sávoknál `bg-background` volt, de a shadcn `TabsList` default `bg-muted` osztálya `cn()` merge után potenciálisan ütközhetett.
- **Javítás** (`WorkspaceDashboard.tsx`, `ResourcesTab.tsx`):
  - Főmenü TabsList: `bg-background/98` → `!bg-background` (`!` important modifier garantálja a default `bg-muted` felülírását)
  - Almenü TabsListok (Calendar + Resources): `bg-background` → `!bg-background`
  - Mindhárom sticky sávra `shadow-sm` hozzáadva — vizuális elválasztás a görgő tartalomtól
- A görgetett tartalom ezután NEM látszik a sticky menüsávok mögött; a menüsávok teljesen átlátszatlanok.

### Files changed
- `src/components/enterprise/WorkspaceDashboard.tsx`
- `src/components/enterprise/resources/ResourcesTab.tsx`

### Acceptance criteria
- ✅ Görgetéskor a felfelé csúszó tartalom NEM látszik a sticky főmenü-sáv mögött.
- ✅ Görgetéskor a felfelé csúszó tartalom NEM látszik a sticky almenü-sávok mögött.
- ✅ A sticky menüsávok bal alsó oldalán shadow-sm jelzi az átmenetet a tartalom felé.

---

## 2026-05-10 — v3.4.1 Sticky navigációs sávok (főmenü + almenü regresszió-javítás)

### Fixed — Görgetéskor eltűnő navigációs sávok
- **Főmenü TabsList** (`WorkspaceDashboard.tsx`): tabs layout mode-ban a vízszintes főmenü sáv mostantól `sticky top-[var(--ws-header-h)] z-20` — görgetéskor a workspace header alatt rögzítve marad.
- **Naptár almenü TabsList** (`WorkspaceDashboard.tsx`): a Naptár szekció belső tab sávja (Naptár / Idővonal / Kapacitástervező / Éves nézet) mostantól `sticky top-[calc(var(--ws-header-h)_+_var(--ws-main-tabs-h))]` — mindkét layout mode-ban rögzítve marad.
- **Erőforrások almenü TabsList** (`ResourcesTab.tsx`): az Erőforrások szekció belső tab sávja (Áttekintés / Hőtérkép / Projektek / Agile / Készségek / …) mostantól sticky — görgetéskor látható marad.
- **CSS custom property megközelítés**: az offset értékeket `--ws-header-h` (53px) és `--ws-main-tabs-h` (65px tabs módban, 0px sidebar módban) CSS változók tárolják a közös ancestor div `style` propján. Az almenük öröklik a DOM-on át, nincs szükség új propra.
- **Sidebar mode helyes kezelése**: sidebar layout-ban a főmenü TabsList `sr-only` marad (nem görget el, fizikai tere nincs), az almenük ezért csak a header magasságát veszik figyelembe.
- **Vizuális konzisztencia**: sticky almenü sávok `bg-background border-b rounded-none` osztályokat kapnak — a tartalom aluluk gurul, fedési problémák nélkül.

### Files changed
- `src/components/enterprise/WorkspaceDashboard.tsx`
- `src/components/enterprise/resources/ResourcesTab.tsx`

### Acceptance criteria
- ✅ Tabs layout: görgetéskor a főmenü sáv a header alatt rögzített, nem tűnik el.
- ✅ Tabs + sidebar layout: a Naptár és Erőforrások almenü sávok görgetéskor rögzítve maradnak.
- ✅ Sidebar layout: főmenü TabsList sr-only marad, az almenük csak a header offsetet használják.
- ✅ Nincs regresszió a v3.4.0 funkciókon (OrgChart, MemberProfileSheet, stb.).

---

## 2026-05-10 — v3.4.0 Org chart navigable drawer + Member Bővebb adatok view

### Added — Org chart adatlap kattintható manager + beosztott badge-ekkel
- **OrgChartPremiumView** (`src/components/enterprise/organization/OrgChartPremiumView.tsx`): a jobb oldali drawerben a `Vezető` mező és a `Közvetlen beosztottak` mini-listája mostantól interaktív gombok. Egy kattintás a vezetőre / beosztottra azonnal átváltja az aktív kiválasztott személyt és újratölti a drawer adatait — a drawer nem zár be, így folyamatos hierarchia-böngészés lehetséges. A click swallow logika (`onMouseDown stopPropagation`) megakadályozza, hogy a pán-zoom drag elnyelje a kattintást.
- **„Adatlap megnyitása" gomb**: a drawer fejléce alatt egy `IdCard` ikonos gomb megnyitja a teljes `MemberProfileSheet`-et — ugyanazt, ami a Tagok menüben kattintáskor jelenik meg, így a szervezeti diagramról közvetlenül elérhető a részletes profil.

### Added — MemberProfileSheet „Alapadatok" / „Bővebb adatok" toggle
- **MemberProfileSheet** (`src/components/enterprise/MemberProfileSheet.tsx`): a fejléc alatti új toggle-vel két nézet között váltható az adatlap.
  - `Alapadatok` (alapértelmezett): változatlan tartalom — munkakör, csapat, iroda, KPI kártyák, közelgő/függő/korábbi szabadságok, értesítési beállítások.
  - `Bővebb adatok` (új): hat szekció — készségek, onboarding, hozzáférések, célok/eredmények, hozzá rendelt Jira jegyek, és teljesítmény-diagram.
- **MemberExtendedDetails** (`src/components/enterprise/MemberExtendedDetails.tsx` — új): minden szekció dedikált „menübe ugrás" gombbal jeleníti meg a tartalmat.
  - **Készségek**: `enterprise_member_skills` + `enterprise_skills` join, csillag-szintezéssel; deeplink a Resources tabra.
  - **Onboarding**: `enterprise_onboarding_instances` + `enterprise_onboarding_step_completions` (lépés progress bar + státusz badge); deeplink a Workflows tabra.
  - **Hozzáférések**: `enterprise_access_requests` + `enterprise_access_systems` (státusz ikon, dátum); deeplink a Workflows tabra.
  - **Meghatározott célok**: új `enterprise_member_goals` tábla, admin admin-only inline form (cím + leírás + határidő); státusz életciklus: open → in_progress → achieved/dropped. **Null-safe**: ha a migráció még nincs lefuttatva (Postgres 42P01), inline figyelmeztetést mutat „A célok modul még nincs telepítve" üzenettel — nem dobja össze az UI-t.
  - **Jira jegyek**: `enterprise_agile_issues` az `assignee_name = display_name` alapján szűrve, story-points + státusz + külső hivatkozás; deeplink a Resources/Agile tabra.
  - **Teljesítmény diagram**: utolsó 12 hónap havi bontásban — lezárt jegyek `story_points` összege oszlop-diagramon (recharts), Done jegyek `external_updated_at` (vagy fallback `due_date`) alapján.

### Added — `enterprise_member_goals` tábla
- **Migráció** (`supabase/migrations/20260510120000_member_goals.sql`): új tábla `workspace_id`, `member_id`, `title`, `description`, `status` (open/in_progress/achieved/dropped), `target_date`, `achieved_at`, `created_by`, `created_at`, `updated_at` mezőkkel. CASCADE törlés workspace és membership esetén.
- **RLS**: a workspace tagjai olvashatják, csak owner + resourceAssistant írhat / módosíthat / törölhet (`is_enterprise_member` + `has_enterprise_role`). `update_updated_at_column` triggerrel.
- **Indexek**: `(workspace_id)` és `(member_id)`.

### Enhanced — Demo seed
- **Member goals seed** (`MEMBER_GOAL_DEFS` in `supabase/functions/seed-demo-workspace/seed-data.ts`): 12 demo cél 12 különböző personához rendelve, vegyes státuszú (open / in_progress / achieved) — pl. „React 19 migráció vezetése", „Senior Backend előléptetés", „Cypress E2E coverage 60% felett". A seed `try`-mentes, csendes `console.warn`-ra esik vissza, ha a migráció nincs alkalmazva.
- **Done agile jegyek backdating** (`supabase/functions/seed-demo-workspace/index.ts`): a `Done` státuszú jegyekre `external_updated_at` mezőt számolunk, az utolsó ~180 napra szétterítve (deterministic offset = `(doneCounter * 37) % 175`). Ennek köszönhetően a Bővebb adatok → Teljesítmény diagram realisztikus havi story-point eloszlást mutat újra-seedeléskor is.

### Wiring
- **OrgChart** (`src/components/enterprise/organization/OrgChart.tsx`): `MemberProfileSheet` integrálva, `office_id` mostantól része a member fetch-nek (a profile sheetnek kell). `onNavigateTab` és `userId` propot fogad.
- **OrganizationModule** (`src/components/enterprise/organization/OrganizationModule.tsx`): továbbítja `onNavigateTab` / `userId` propokat az OrgChart-nak.
- **WorkspaceDashboard** (`src/components/enterprise/WorkspaceDashboard.tsx`): `onNavigateTab={setActiveTab}` mostantól mind a `MemberList`-nek, mind az `OrganizationModule`-nak átadva.
- **MemberList** (`src/components/enterprise/MemberList.tsx`): `onNavigateTab` prop fogadása + továbbadás a `MemberProfileSheet`-nek (deeplink-zárja a sheetet, majd vált tabot).

### Files changed
- `src/components/enterprise/organization/OrgChartPremiumView.tsx`
- `src/components/enterprise/organization/OrgChart.tsx`
- `src/components/enterprise/organization/OrganizationModule.tsx`
- `src/components/enterprise/MemberProfileSheet.tsx`
- `src/components/enterprise/MemberExtendedDetails.tsx` *(new)*
- `src/components/enterprise/MemberList.tsx`
- `src/components/enterprise/WorkspaceDashboard.tsx`
- `supabase/migrations/20260510120000_member_goals.sql` *(new)*
- `supabase/functions/seed-demo-workspace/seed-data.ts`
- `supabase/functions/seed-demo-workspace/index.ts`
- `versioning/100526001_v3.4.0_org-chart-navigation-and-member-extended-view.md` *(new)*

### Acceptance criteria
- ✅ Org chart drawer manager + minden beosztott badge kattintható; egy kattintás váltja a drawer kontextusát (a drawer nem zár be).
- ✅ Drawer fejlécén „Adatlap megnyitása" gomb megnyitja a teljes MemberProfileSheet-et.
- ✅ MemberProfileSheet tetején Alapadatok / Bővebb adatok toggle; az Alapadatok tartalom változatlan.
- ✅ Bővebb adatokon mind a 6 szekció létezik (skills, onboarding, access, goals, jira, performance), mindegyik deeplink-gombbal a megfelelő menübe.
- ✅ Demo seed létrehozza a célokat 12 personához, és visszadátumozza a Done jegyek `external_updated_at` mezőjét, így a teljesítmény diagram nem üres.
- ✅ Migráció lefuttatva → célok írhatók/szerkeszthetők; ha még nincs lefuttatva, inline figyelmeztetés (nem dobja össze az UI-t).

---

## 2026-05-10 — v3.3.6 Demo workspace seed schema-drift hotfix

### Fixed — Demo workspace létrehozás 500 hibával megállt
- **Gyökérok 1**: a `seed-demo-workspace` funkció több `leave_requests` rekordot még a régi séma szerint írt, ezért az új, kötelező `is_half_day` mező hiányában a backend 500-zal elhasalt.
- **Gyökérok 2**: a demo seed egyes részei (`enterprise_daily_rules`, `enterprise_job_families`) már nem létező oszlopokra (`is_active`, `sort_order`) támaszkodtak, ami további schema-drift kockázatot okozott.
- **Fix 1 — leave normalization**: a `supabase/functions/seed-demo-workspace/index.ts` mostantól minden seedelt szabadságkérelemre explicit kitölti a jelenlegi séma szerinti mezőket (`is_half_day`, `half_day_period`, `is_private`, `cancellation_reason`).
- **Fix 2 — seed drift cleanup**: a daily rule és job family seed immár csak olyan mezőket küld a backendnek, amelyek ténylegesen léteznek az aktuális adatbázissémában.
- **Fix 3 — build stabilizálás**: ismét eltávolítva a tévesen visszakerült `src/integrations/supabase/auth-middleware.ts`, amely nem létező TanStack importokkal törte a buildet.
- **Validáció**: a javított edge function újra deployolva lett, és a `deno check supabase/functions/seed-demo-workspace/index.ts` sikeresen lefut.

---

## 2026-05-10 — v3.3.5 Demo workspace leave-entities completion fix

### Fixed — Demo workspace szabadság-entitások részben hiányoztak
- **Gyökérok 1**: a `seed-demo-workspace` függvény a `leave_requests` seedet ugyan építette, de a friss demo workspace-ekben továbbra is előállhatott 0 rekordos állapot, miközben más leave táblák (kvóták, ünnepnapok, céges szabadnapok) létrejöttek.
- **Gyökérok 2**: az `enterprise_daily_rules` seed nem adta át a kötelező `created_by` mezőt, ezért ez a rész üres maradt.
- **Gyökérok 3**: az éves nézethez szükséges `enterprise_quota_transactions` seed egyáltalán nem jött létre, ezért a „Vacation used” / maradék napok demó adatoknál hiányosak maradtak.
- **Fix 1 — seed hardening**: a `supabase/functions/seed-demo-workspace/index.ts` mostantól normalizálja és szűri a seedelt szabadságkérelmeket, majd csak ezeket írja a `leave_requests` táblába.
- **Fix 2 — daily rules**: a demo seed már `created_by` mezővel írja az `enterprise_daily_rules` rekordokat is.
- **Fix 3 — quota tx seed**: a jóváhagyott demo szabadságokhoz automatikusan létrejönnek a kapcsolódó `enterprise_quota_transactions` rekordok, így az éves nézet és kvótaegyenlegek valós demo felhasználást mutatnak.
- **Build**: újra eltávolítva a véletlenül visszakerült `src/integrations/supabase/auth-middleware.ts`, amely ismét `@tanstack/react-start` import hibával törte a buildet.

---

## 2026-05-10 — v3.3.4 Demo workspace leave seed fail-fast fix

### Fixed — Demo workspace szabadságok nem jelentek meg a naptárban
- **Gyökérok**: a `seed-demo-workspace` edge function létrehozta a demo workspace többi részét, de a `leave_requests` beszúrás hibáját nem kezelte. Emiatt a demo workspace elkészülhetett 0 szabadságkérelemmel is, miközben a frontend helyesen a `leave_requests` táblából olvas — így a Naptár, Idővonal és Kérelmek üres maradt.
- **Fix 1 — fail-fast seed**: a `supabase/functions/seed-demo-workspace/index.ts` mostantól explicit kezeli a `leave_requests` insert hibáját, naplózza, majd megszakítja a seedelést érthető hibával ahelyett, hogy csendben hibás demo workspace-et hozna létre.
- **Fix 2 — seed guard**: a szabadságkérelmek seedelése már nem egyetlen, félrevezető `annualLeaveTypeId` feltételhez kötött, hanem ahhoz, hogy a workspace szabadságtípus-katalógusa valóban létrejött-e.
- **Eredmény**: új demo workspace létrehozásakor a seed vagy teljesen, szabadságadatokkal együtt készül el, vagy azonnal hibaüzenettel megáll; többé nem jön létre „látszólag kész”, de naptáradat nélküli demo workspace.

---

## 2026-05-09 — v3.3.3 Timeline infinite re-render loop fix

### Fixed — Végtelen újrarenderelés → skeleton freeze (`WorkspaceDashboard` + `TimelineView`)
- **Gyökérok**: `WorkspaceDashboard` inline arrow functiont adott át `onFilteredUsersChange` propként. Minden szülő-render új fn-referenciát generált → `TimelineView` `useEffect`-je (amely a propot dep-ként figyelte) újrafutott → `setTimelineReport` → szülő újrarendel → új referencia → végtelen loop. ~50 iteráció után React dobta a "Maximum update depth exceeded" hibát; a komponens megfagyott utolsó skeleton állapotában, a `setLoading(false)` sohasem hívódott meg.
- **Fix 1 — `WorkspaceDashboard.tsx`**: `useCallback(() => setTimelineReport(...), [])` stabil referenciát biztosít — `setTimelineReport` maga is stabil (useState setter), ezért az üres dep-tömb helyes.
- **Fix 2 — `TimelineView.tsx`**: `useRef`-alapú callback indirection — `onFilteredUsersChangeRef` ref frissítő mellékhatás (deps nélkül), a notify-effect `ref.current?.()`-t hív és **nem** sorolja fel a prop-ot dep-ként; guard `if (loading || members.length === 0) return` megakadályozza a korai tüzelést mount után.

---

## 2026-05-09 — v3.3.2 Timeline fetch fix + expanded leave seed

### Fixed — `TimelineView` hónapváltás hiba (`src/components/enterprise/calendar/TimelineView.tsx`)
- **Root cause**: A hét párhuzamos Supabase query-t `Promise.all`-ba csomagoltuk; gyors hónapváltásnál egyszerre futó kérések terhelték a kapcsolatot → "TypeError: Failed to fetch".
- **Fix 1 — Debounce (250 ms)**: A `useEffect` mostantól 250 ms késéssel hívja `load()`-ot; rapid kattintásoknál csak az utolsó ütközik le, az előzőek törlődnek.
- **Fix 2 — `Promise.allSettled`**: Ha egy nem kritikus query (pl. leaves, holidays, skills) hálózati hibán esik el, a többi adat még betöltődik; csak a taglistás (`enterprise_memberships`) hiba dobja vissza a hibát.

### Enhanced — Demo seed: szabadság lefedettség (`supabase/functions/seed-demo-workspace/index.ts`)
- Kibővítve 7 → **38 leave request**-re, amely lefedi: 3 hónapot visszamenőleg, az aktuális hónapot és 3 hónapot előre.
- Minden típus képviselt: `vacation`, `sick_leave`, `unpaid_leave`, `other`.
- Minden státusz képviselt: `approved`, `pending`, `rejected`, `cancelled`.
- Mind a 22 demo persona kapott legalább egy szabadságot; a visszamenőlegesek mind `approved` státuszú, a jövőbeliek vegyesen `approved`/`pending`/`rejected`.

---

## 2026-05-09 — v3.3.1 Org Chart — Pan, Zoom & Popup Modal

### Enhanced — `OrgChartPremiumView` + `OrgChart`

**Pan & Zoom (Google Maps style):**
- Mouse drag to pan the diagram (click vs drag distinguished by a 6 px threshold — cards still open on genuine clicks).
- Mouse wheel to zoom in/out while panning.
- Bottom-center zoom control bar: **−** / **%** / **+** buttons + a reset `RotateCcw` button, styled like Google Maps controls.
- Zoom clamped between 20 % and 250 %; percentage readout updates live.
- `transform-origin: 50% 0` ensures zoom anchors to the top-centre of the diagram.
- CSS transition `0.18 s ease` active on zoom button clicks; disabled during active drag for instant response.

**Fullscreen Popup Modal:**
- "Teljes nézet" (`Maximize2`) button appears in the Org Chart toolbar only when the Premium view is active.
- Opens a `95 vw × 90 vh` Radix UI Dialog containing `OrgChartPremiumView` with `containerHeight="calc(90vh - 80px)"`.
- Pan/zoom and drawer work identically inside the popup.
- Closing the dialog (× or backdrop click) resets to the inline view.

**Files changed:**
- `src/components/enterprise/organization/OrgChartPremiumView.tsx` — pan/zoom state + handlers + zoom controls
- `src/components/enterprise/organization/OrgChart.tsx` — Dialog import, `fullscreenOpen` state, Maximize button, Dialog render

---

## 2026-05-09 — v3.3.0 GiGanttIc — Flagship Branded Planning Board

### Added — `GiGanttIcBoard` (`src/components/enterprise/agile/GiGanttIcBoard.tsx`)
Effectime's flagship planning board, replacing the generic "Gantt" tab inside **Agile → Boards**.

**Brand & UX:**
- Branded as **GiGanttIc** — premium flagship name with teal accent styling ("Gi" + "Gantt" + italic "Ic").
- Tab trigger in `AgileBoards.tsx` redesigned with `Sparkles` icon + gradient-accented text label; `data-[state=active]` teal highlight distinguishes it from standard tabs.
- Obsidian/charcoal dark surface (`#0d0f14` base) with layered depth, teal/cyan accents used surgically.
- Status bar legend, "BOARD" badge, and per-row status dots for instant visual scanning.

**Core Board Features:**
- **Split-pane layout**: sticky left task grid (292 px) + horizontally scrollable timeline chart — single `overflow: auto` scroll container using `position: sticky` for both axes, no JS scroll-sync needed.
- **Zoom modes**: `week` (12 px/day, weekly columns), `month` (4.5 px/day, monthly/quarterly columns), `quarter` (2 px/day, full-year span). Toolbar lets users switch instantly.
- **Sticky timeline header**: two-row header (primary = quarters/years, secondary = months/weeks) with `isCurrent` teal tint for the present period.
- **Today marker**: teal dashed vertical SVG line + "TODAY" label spanning all rows; "Jump to Today" toolbar button centers the viewport.

**Hierarchy & Scheduling:**
- Parent-child tree built from `parent_key`; Epics auto-expanded on mount.
- Expand/collapse per row (chevron toggle) + "Expand All / None" toolbar shortcuts.
- Depth-indented left grid rows (18 px per level).
- Bar colors by type: Epic = violet, Story = teal, Task = sky, Bug = red, Sub-task = amber, Milestone = gold diamond, Done = emerald, Overdue = red.
- Progress fill overlay on bars derived from `completed_hours / original_estimate_hours` (falls back to status-based estimate).
- Milestone diamond shape (`rotate(45deg)` div) distinct from task bars.
- Overdue indicator: `AlertTriangle` in left grid + red bar color.

**Dependencies (SVG):**
- Smooth Bézier S-curve connectors drawn on an SVG overlay positioned over the chart area for all visible parent→child relationships where both issues have dates.
- Arrow marker (`gg-arrow`) at curve end, teal 28% opacity — visible but non-distracting.

**Details Inspector Panel:**
- Right-side drawer opens on row click (or tapping selected row closes it).
- Shows: type badge, status, overdue indicator, progress bar, schedule (start/end/duration), effort (estimate/logged/remaining), assignee avatar + reporter, hierarchy (parent + up to 5 children), labels, capacity risk alert.
- "Open in Jira" and direct URL links when applicable.
- Closes with × button or re-clicking the row.

**Toolbar:**
- Zoom switcher, Today jump, Expand All / Collapse All, Search (summary / key / assignee), Type filter dropdown, issue count readout, Fullscreen toggle.

**Critical Path / Risk Signal:**
- Issues with `due_date < today && status ≠ Done/Closed` rendered in red (overdue).
- `capacity_risk = 'high'` shows red alert badge in inspector panel.
- Architecture ready for full CPM via `enterprise_ganttIc_dependencies` table.

**Empty / Loading states:**
- `GiGanttEmptyState` — obsidian card with Sparkles icon and branded name.
- `GiGanttLoadingState` — exported for parent use, animated shimmer bar.

### Added — `supabase/migrations/20260509030000_giganttIc_scheduling_fields.sql`
**Schema extensions (all additive, `IF NOT EXISTS`, backward-compatible):**
- `enterprise_agile_issues`: `is_milestone`, `progress_pct` (0–100, check constraint), `dependency_keys text[]`, `critical_path boolean`, `gantt_color`, `gantt_row_order`.
- **New table** `enterprise_ganttIc_dependencies`: explicit FS/SS/FF/SF dependency edges with `lag_days`, `is_auto` flag, and `UNIQUE(integration_id, predecessor, successor)`.
- RLS: `gg_deps_select` (all members), `gg_deps_modify` (owner + resourceAssistant).
- `ganttIc_has_dependency_cycle(workspace, integration, predecessor, successor)` PL/pgSQL function using a recursive CTE BFS — returns `true` if adding the edge would create a cycle. Call this guard before any INSERT.
- `set_gg_deps_updated_at` trigger (reuses existing `set_updated_at()` function).
- `SET search_path = public, pg_temp` on the new SECURITY DEFINER function (consistent with v3.2.7 hardening pattern).

### Changed — `AgileBoards.tsx`
- Removed: `GanttChart` icon import, old `GanttView` function (~65 lines of basic bar renderer).
- Added: `GiGanttIcBoard` import, `GiGanttIssueRow` type re-export, `Sparkles` icon.
- `TabsTrigger` for "gantt" value: redesigned with `Sparkles` icon + branded typography; `data-[state=active]` teal styling.
- `TabsContent value="gantt"`: now renders `<GiGanttIcBoard issues={issues as GiGanttIssueRow[]} onOpen={...} />`.

### Non-Regression
- Kanban and Scrum tabs in `AgileBoards` unchanged.
- `AgilePanel`, `ResourcesTab`, `WorkspaceDashboard` nav unchanged.
- All existing `enterprise_agile_issues` queries unaffected (additive columns only, no NOT NULL without defaults).
- `GanttTimeline.tsx` (project-level timeline in Resources tab) unchanged.
- No existing RLS policies touched.

---

## 2026-05-09 — v3.2.8 Demo UX + CommandCenter header button

### Added — `CommandCenterButton` in workspace header
- New `CommandCenterButton.tsx` component: same data fetching as `CommandCenter`, wrapped in a Popover (same pattern as `OrgPulseButton`).
- Notification badge shows total count of pending items (approvals + onboarding + access + incomplete org).
- Button placed in workspace header for admins; inline `CommandCenter` card removed from the main content area — frees up vertical space in every tab.

### Added — `src/config/demo-seed-limits.ts` (new file)
- Single user-editable TypeScript file exporting `DEMO_SEED_MAX_LIMITS` — the canonical source for all maximum element counts in the demo seed config dialog.
- `DemoSeedConfigDialog.tsx` now imports from this file via a `lim(key)` helper; hardcoded `max` values removed from the dialog tree.
- Edit only this one file to change any slider maximum — change takes effect on next page load.

### Changed — `create-instant-enterprise-member`: realistic Hungarian names
- Added `INSTANT_PERSONA_POOL` — 25 realistic Hungarian personas distinct from `DEMO_PERSONAS` (no name collisions).
- Name selection prefers unused names in the workspace first; falls back to full pool when all are taken.
- `business_role` uses a role already present in the workspace catalog first, falls back to the pool persona's own position.
- Result: instant users now get names like "Balázs Fekete" instead of "Instant User ###".

### Changed — `seed-data.ts`: AGILE_ISSUE_DEFS expanded from 4 → 33 tickets
- **3 Epics**: Customer Portal 2.0, Backend API Refactor, QA & DevOps — spanning Sprint 10–13 with 6–9 week Gantt ranges.
- **12 Stories**: children of Epics via `parent_key`; cover Sprint 11/12/13 with varied statuses (Done/In Progress/In Review/To Do).
- **8 Bugs**: mixed priorities and sprint assignments, several with `parent_key` to Epics.
- **6 Tasks**: standalone team tasks across Frontend/Backend/Ops/QA.
- **4 Sub-tasks**: children of Stories (DEMO-4, DEMO-8, DEMO-9).
- All tickets carry: `story_points`, `assignee_name`, `reporter_email`, `original_estimate_hours`, `remaining_hours`, `completed_hours`, `capacity_risk`, `fit_score`, `suggested_role`.
- Date offsets via `startOff`/`dueOff` (integer day offsets from today) — computed to actual dates at seed time in `index.ts` via `addDays(today, offset)`.

### Changed — `seed-data.ts`: 5-level org hierarchy
- `PERSONA_ORG_ASSIGNMENTS` restructured from 3-level flat to 5-level deep tree:
  - L1 (strategic): Viktor Mátyás — VP Engineering, no manager
  - L2 (operational): Ferenc Horváth, Csilla Nagy, Judit Molnár, Zsuzsanna Hegedűs
  - L3 (technical): Anna Kovács, Sándor Veres, Olivér Lengyel, Gizella Varga, Richárd Kővári
  - L4 (execution): Petra Szász, Tímea Bodnár, István Papp, Kristóf Balogh, Eszter Kiss, Nikolett Farkas
  - L5 (specialist): Henrietta Fekete, Mária Tóth, Dávid Szabó, Bence Tóth, László Szőke, Uzonka Pálfi
- `LEADERSHIP_LEVEL_DEFS` extended to 5 levels (added `specialist` as L5).
- Seeder leadership guard raised to `Math.max(5, seedQty.leadership_levels)`.
- `agile_issues` default and max both set to 33.

### Non-Regression
- All previously seeded entity types unaffected.
- `DemoSeedConfigDialog` behavior identical — only the source of `max` values changed (now from `demo-seed-limits.ts`).

---

## 2026-05-09 — v3.2.7 Database-wide RLS Coverage Hardening + Governance "fetch main first" rule

### Security — RLS audit & migration `rls_coverage_hardening_2026_05_09`
Audited every RLS-enabled table in the `oezlzzmzzvbvinuysxaz` (Effectime) project. All `public` tables already had at least a SELECT policy; the migration closed the genuine gaps and resolved every advisor lint that wasn't intentional design.

- **`enterprise_invitations`** — added missing `UPDATE` policy for owners + resourceAssistants. Admins can now revoke / extend / re-role pending invitations from the UI without going through service-role hops.
- **`enterprise_org_pulse_membership` view** — converted from SECURITY DEFINER to `security_invoker = true`. The view now respects the caller's RLS on `enterprise_memberships` rather than aggregating across all workspaces. (Resolved advisor `security_definer_view` ERROR.)
- **`SET search_path = public, pg_temp`** pinned on 5 SECURITY DEFINER / trigger functions — prevents search_path injection:
  - `seed_default_access_systems(uuid)`
  - `seed_default_contract_types(uuid)`
  - `seed_default_leadership_levels(uuid)`
  - `enterprise_memberships_check_manager_cycle()`
  - `set_updated_at()`
- **Legacy schema cleanup** — 53 tables in `plannermaster` and 10 in `syncfolk` (0-row leftovers from a prior external-DB migration target) now have a `legacy_deny_all` policy. No application code touches these schemas; the policy silences the linter without changing behaviour.

### Governance — `fetch + rebase main first` rule (LESSON-GIT-REBASE-MAIN-FIRST-001)
Documented and enforced via three governance files after a CHANGELOG conflict on this PR (the branch had `v3.2.5`, but `main` already had a different `v3.2.5` and `v3.2.6` that landed via PRs #28 and the seeder PRs):
- `CLAUDE.md` — added explicit "ALWAYS fetch + rebase on `origin/main` BEFORE writing code or editing CHANGELOG.md" rule + "verify next free version on main" rule
- `.governance/controller.md` — same rule promoted to a numbered Core rule (#3)
- `AI_EXECUTION_PROMPTS.md` — expanded "Branch and commit discipline" section with the failure modes (CHANGELOG conflicts, version-number reuse, stale baseline)
- `codingLessonsLearnt.md` — `[LESSON-GIT-REBASE-MAIN-FIRST-001]` entry with the concrete failure case and prevention checklist

### Architecture notes
- Append-only tables (`enterprise_audit_events`, `*_sync_log`, `*_quota_transactions`, `approval_decisions`, `enterprise_access_decisions`) intentionally retain SELECT+INSERT only — the immutability is by design.
- Junction tables (`enterprise_team_roles`, `event_participants`) have no UPDATE-able columns; the DELETE+INSERT pattern is the canonical mutation.
- `enterprise_export_jobs` and `enterprise_access_requests` keep DELETE off — they're historical records.
- `anon/authenticated_security_definer_function_executable` advisor WARNs on `is_enterprise_member`, `has_enterprise_role`, `can_access_event` etc. are **intentional** — these functions are invoked from RLS USING/WITH CHECK clauses and must remain callable by `authenticated`.
- Legacy `plannermaster` + `syncfolk` schemas are kept (not dropped) since dropping requires explicit user approval; they hold no live data and the deny-all policy makes them safe.

---

## 2026-05-09 — v3.2.6 Premium Org Chart: card-based view with employee detail drawer (PR #28)

### Added — `OrgChartPremiumView` component (`src/components/enterprise/organization/OrgChartPremiumView.tsx`)
- **Card-based org chart** with gradient accent cards, hover lift effects, and recursive branch rendering with collapsible nodes.
- **Employee detail drawer** — side panel that opens on card click, showing: org unit name, team, role, manager name, direct reports list (up to 8 with overflow indicator), location/city, skill count, and join date. Org unit names and skill counts fetched from Supabase on demand and cached in component state.
- **Three view styles** in the `OrgChart` component:
  - **Premium** (new default) — card-based with side drawer
  - **Diagram** — existing tree view (renamed from "Tree")
  - **List** — existing flat list
  - View preference persisted to `localStorage` (`orgchart_view_preference`).
- **Enhanced membership query**: added `location`, `city`, `team`, and `joined_at` fields; search filtering now includes `role` and `team`.
- **Flattened node tree**: pre-built `flatNodes: Map<string, OrgNode>` before rendering enables O(1) manager/child lookups — avoids recursive traversal on every card render.
- **Loading skeleton** during initial data fetch.
- **i18n**: `Premium`, `Diagram`, `List` labels + drawer section labels added to EN and HU bundles.
- **Accessibility**: `tabIndex`, `onKeyDown` (Enter/Space to open drawer), ARIA labels, semantic HTML.

### Non-Regression
- Existing tree and list views unchanged; premium is opt-in via the style switcher.
- No schema or edge-function changes.

---

## 2026-05-09 — v3.2.5 Demo workspace seeder v8: data-driven catalogs + full org-structure for all 22 members

### Fixed — Demo workspace seeder: org-structure assignment was missing for 15/22 members
- **Root cause (v7)**: The B8 seeding block used hardcoded if-else persona-name checks and only covered 7 of 22 demo members. SQL verification confirmed `has_org_unit: 7/23`, `has_manager: 2/23` — 15 members had no org unit, leadership level, contract type, or manager set.
- **Fix (v8)**: Introduced `PERSONA_ORG_ASSIGNMENTS` — a typed `Record<string, PersonaOrgAssignment>` lookup in `seed-data.ts` mapping all 22 persona `display_name`s to their `{orgUnit, llCode, contractCode, leadershipCategory, seniority, managerName?}`. B8 now iterates every `demoUserId`, resolves the name via `userIdByPersonaName`, looks up the assignment record, and performs a targeted UPDATE per member.
- **Result**: All 22 demo members receive full org structure. Viktor Mátyás (top-level lead) has no manager; all 21 others have a correctly resolved `manager_id`.

### Added — Data-driven catalog B1–B5 seeding with configurable quantities

All five catalog entity types are now seeded from typed `DEFS` arrays in `seed-data.ts` and respect the `enterprise_seed_config` quantity settings:

| Block | Entity            | DEFS array                    | Min enforced | Seed config key     |
|-------|-------------------|-------------------------------|--------------|---------------------|
| B1    | Job families      | `JOB_FAMILY_DEFS` (6 items)   | 1            | `job_families`      |
| B2    | Leadership levels | `LEADERSHIP_LEVEL_DEFS` (5)   | 4            | `leadership_levels` |
| B3    | Contract types    | `CONTRACT_TYPE_DEFS` (5)      | 2            | `contract_types`    |
| B4    | Industries        | `INDUSTRY_DEFS` (5)           | 1            | `industries`        |
| B5    | Work categories   | `WORK_CATEGORY_DEFS` (5)      | 1            | `work_categories`   |

- Min values guard downstream FK dependencies in B8 (e.g., leadership levels min=4 because B8 resolves strategic/operational/technical/execution codes; contract types min=2 for employee + contractor).
- Pattern: `DEFS.slice(0, Math.max(MIN, seedQty.key))` — honors user-configured quantity while guaranteeing required minimums.

### Added — `DemoSeedConfigDialog` — 6 new configurable catalog entities
- New **"Katalógusok"** sub-group under the Org tree: job families, leadership levels, contract types, industries, work categories — each configurable 1–6.
- New **`org_units`** leaf added to the Org group.
- `DEFAULT_SEED_QUANTITIES` updated with all 6 new keys and sensible defaults.

### Architecture
- All catalog `DEFS` arrays and `PERSONA_ORG_ASSIGNMENTS` are defined once in `seed-data.ts` (single source of truth) and imported by `index.ts`.
- `.governance/entity-creation-inventory.md` updated with ✅ markers for all newly seeded entity types (sections 2.1–2.5).
- Edge function deployed as **version 8 (ACTIVE)** to production Supabase project.

---

## 2026-05-09 — Demo workspace seeder build chronicle: v1 → v8 (PRs #20–27)

The seeder evolved through 8 versions on 2026-05-08/09. This section captures each iteration's root cause, fix, and architectural decision for future reference.

### v1 — Comprehensive seeder (PR #20, 2026-05-08)
First fully comprehensive implementation: 22 personas, `corsHeaders` inlined (fixes Supabase MCP bundler resolution failure), covering all major modules: offices, teams, leave types, holidays, skills, memberships, allocations, leave requests, quotas, daily rules, office coverage rules, audit event.

### v2/v3 — Bug fixes: SelectItem crash, org pulse, Jira editor dark screen (PR #21, 2026-05-09)
- **`SelectItem` empty-value crash**: Radix UI `SelectItem` throws a runtime error when `value=""` (empty string). Any dropdown using an empty string as the "unselected" sentinel crashed silently. Fixed by replacing all `value=""` instances with non-empty placeholder values.
- **Org Pulse view** not displaying membership data — query scope fix.
- **Translation overrides table** not rendering correctly — component state fix.
- **Jira editor dark screen** on modal open — z-index/stacking context fix.

### v4 — Supabase SDK upgrade + admin client health check (PR #23, 2026-05-09)
- **Root cause**: Supabase JS `v2.45.0` admin client silently failed **all** insert operations in the Deno edge function runtime — no error thrown, no rows inserted, no log.
- **Fix**: upgraded to `v2.98.0` (matching `create-instant-enterprise-member`, which worked correctly). Added explicit auth options: `autoRefreshToken: false, persistSession: false, detectSessionInUrl: false`.
- Added `SERVICE_KEY` null guard (returns clear HTTP 500 instead of silent failure).
- Added admin client smoke test at startup (fails fast with a descriptive error if service role auth is broken).
- Added explicit error logging for offices / teams / leave_types / holidays / skills insert blocks.

### v5 — All entity types seeded; seed-data.ts as single source of truth (PR #24, 2026-05-09)
Previously missing entity types added (blocks L–S):

| Block | Table | App module |
|-------|-------|------------|
| L | `enterprise_role_definitions` + `enterprise_role_permissions` | Jogosultság-menedzsment |
| M | `enterprise_member_templates` | Meghívó sablonok |
| N | `enterprise_translation_overrides` | Lokalizáció |
| O | `enterprise_workspace_integrations` + `enterprise_agile_issues` + `enterprise_agile_field_metadata` | Jira integráció |
| P | `enterprise_ical_tokens` | iCal előfizetés |
| Q | `enterprise_shift_assignments` | Kapacitástervező |
| R | `enterprise_member_site_priorities` | Telephely prioritás |
| S | `enterprise_access_decisions` | Hozzáférés döntések |

**Architecture**: `seed-data.ts` declared as machine-readable single source of truth for all demo seed data; `.governance/entity-creation-inventory.md` as the human-readable governance counterpart. Rule: both files must be updated together whenever a new entity type is added.

### v6 — 22 personas, Auth Admin REST fix, DemoSeedConfigDialog (PR #25, 2026-05-09)
- **Auth Admin API fix**: replaced `supabase.auth.admin.createUser()` (silently dropped all user creations due to SDK session-layer routing issues) with direct `fetch` to `/auth/v1/admin/users` with explicit `Authorization: Bearer <service_role_key>` header.
- **`slugify()`** helper for Hungarian diacritic normalization in email generation (e.g., `"Mátyás"` → `"matyas@demo.test"`).
- Email domain changed from `.local` to `.test` (universally valid for testing).
- 3-attempt retry with exponential backoff; per-user errors surfaced individually in the response body.
- `DEMO_PERSONAS` expanded from 7 to **22** (full enterprise team simulation).
- New DEF arrays in `seed-data.ts`: `DAILY_RULE_DEFS` (7), `OFFICE_COVERAGE_RULE_DEFS` (10), `RULE_TEMPLATE_DEFS` (5), `APPROVAL_CHAIN_DEFS` (2). `DEFAULT_SEED_QUANTITIES` introduced.
- **`enterprise_seed_config`** table (new migration): per-owner configurable seed quantities, RLS owner-only read/write.
- **`DemoSeedConfigDialog`** (`src/components/enterprise/DemoSeedConfigDialog.tsx`): collapsible tree UI showing every entity type with its app-location path and a quantity input. Persisted to `enterprise_seed_config`.
- **"Demo konfig"** button added to `Enterprise.tsx` header.

### v7 — Silent membership error captured (PR #26, 2026-05-09)
- The membership bulk-insert never destructured `error` from the Supabase response — silent failures showed 0 members seeded with no log output.
- Added explicit `{ data, error }` destructuring, `console.error` on failure, empty-array guard to skip insert when `demoUserIds` is empty, and separate progress log entries for auth-user count vs. membership-insert count.

### v8 — Full org-structure for all 22 members + data-driven B1–B5 catalogs (PR #27)
Documented in the v3.2.5 entry above.

---

## 2026-05-09 — Infrastructure & UX fixes: catalog RLS, workspace selector, deletion (PR #22)

### Fixed — Position catalog returns 0 rows for every user
- `enterprise_catalog_*` tables (categories, roles, skills, role_skills) had RLS **enabled but no policies**, so every authenticated query returned 0 rows regardless of the user's role.
- **Fix**: added `SELECT` policy for the `authenticated` role on all four global catalog tables. The `PositionPickerDialog` (and 550+ seeded skills) now load correctly for all workspace members.

### Added — Workspace selector always shown first
- Landing page "Munkaterület" button navigates to `/app?select=1`.
- `Enterprise.tsx` detects `?select=1` and suppresses the auto-select-last-workspace shortcut — user always sees the picker grid.

### Added — Workspace deletion by owner
- Owner-only delete button per workspace card with `AlertDialog` confirmation.
- `DELETE` on `enterprise_workspaces`; all ~70 workspace-scoped tables already carry `ON DELETE CASCADE` → atomic cleanup of members, rules, projects, leave requests, integrations, quotas, audit log, etc.
- Clears `localStorage` key `active_workspace_id` if the deleted workspace was the previously cached one.

---

## 2026-05-08 — v3.2.4 Auth UX, Compact Org Pulse & Demo Workspace Seeder

### Fixed
- **`Landing`**: the "Bejelentkezés" CTA in the hero and the secondary CTA card no longer render while a user is signed in. Authenticated visitors now see "Munkaterületre" leading straight to `/app`.
- **Build**: removed stale TanStack-flavored `src/integrations/supabase/auth-middleware.ts` (the project uses `react-router-dom`, not TanStack Start) — eliminated the `Cannot find module '@tanstack/react-start'` build break.

### Changed
- **Org Pulse → header popover (`OrgPulseButton`)**: replaced the persistent full-width `OrgPulseWidget` with a compact header button (`Activity` icon + "Org Pulse" label). A red badge with the count of active operational alerts (missing org-unit, missing manager, missing contract, missing leadership, approvals open >48h) is shown when `> 0`. Clicking opens a 360px `Popover` with the same privacy-safe (k≥5) cells, with alert cells highlighted. Wired into `WorkspaceDashboard` for admins; the previous `OrgPulseWidget` block is removed from the body.

### Added
- **`Demo munkaterület létrehozása` button** in `CreateWorkspaceDialog` — invokes new edge function `seed-demo-workspace`.
- **Edge function `seed-demo-workspace`** (`verify_jwt = true`): calls `create_workspace_with_owner` as the user, then with the service role seeds:
  - 3 demo auth users + profiles + memberships (assistant + 2 members), with team / city / business_role / capacity defaults
  - 3 offices (Budapest, Debrecen, Szeged), members linked to their city's office
  - 4 teams (Engineering, Product, Design, Operations)
  - 4 leave types (Éves, Beteg, Otthoni, Fizetés nélküli) with colors and rules
  - 3 sample Hungarian holidays
  - 7 skills + 3 skill assignments per member with proficiency
  - Annual leave quotas per membership (25 + 5 carryover)
  - 18 leave requests across all members spanning past + future, mixing approved / rejected / pending statuses and three leave types
- All seeded rows use `workspace_id = <new ws>`. Existing FK `ON DELETE CASCADE` on every workspace-scoped table guarantees full cleanup when the workspace is deleted — no orphaned records.

### Architecture notes
- Seeder is implemented as a single edge function so it can be extended module-by-module without touching UI code.
- Uses the user's JWT to create the workspace (so it ends up owned by them and respects existing RPC), and the service role only for downstream child rows that need to bypass RLS for demo identities.

## 2026-05-07 — v3.2.3 Help System — Admin Controls & Multi-Tab Fix

### Fixed
- **`useHelpArticleByAnchor` + `useHelpSearch`**: added `.order('last_generated_at', { ascending: false }).limit(1)` before every `.maybeSingle()` call — Supabase `.maybeSingle()` throws when multiple rows match (e.g. five articles shared `anchor_id = 'workspace.settings'`). This was the root cause of the "only Members tab shows help content" bug: the thrown error was silently caught and `article` was set to `null`.
- **`HelpDrawer` i18n fallback (`resolveAnchorCopy`)**: rewrote to import raw bundle objects directly (`import en from '@/i18n/resources/en'`) and use literal key access (`anchors[id]`) instead of calling `t()`. The `lookup()` function splits on `.` which broke all dotted anchor IDs like `workspace.calendar` — the traversal tried `anchors['workspace']['calendar']` instead of `anchors['workspace.calendar']`.

### Added
- **`HelpSystemSettings` component** (`src/components/enterprise/settings/HelpSystemSettings.tsx`): new admin-only settings card with:
  - `Switch` toggle to enable/disable AI help content regeneration (persisted to `enterprise_workspaces.help_ai_enabled`)
  - "Regenerate now" button that immediately invokes the `help-regenerator` Supabase Edge Function
  - Last-regenerated timestamp display
  - Result badge (success/error) after manual regeneration
- **Schema migration `20260507150000`**: two new additive columns on `enterprise_workspaces`:
  - `help_ai_enabled boolean NOT NULL DEFAULT true`
  - `help_last_regenerated_at timestamptz`
- **`WorkspaceDashboard` Settings tab**: `HelpSystemSettings` wired in as an admin-only `SettingsSection` (after Integration Health Center)
- **i18n keys** `help_settings.*` added to both EN and HU bundles (9 keys each)

### Non-Regression Contract
- Zero changes to existing RLS policies, approval engine, capacity engine, or any component outside of the help system.
- Schema migration is purely additive — `ADD COLUMN IF NOT EXISTS` with safe defaults.
- All existing i18n keys preserved; only new keys added.

## 2026-05-07 — v3.2.2 Help System — Full Documentation Suite & Gap Closure

### Fixed
- **`useHelpArticleByAnchor`**: added `.eq('is_active', true)` filter — archived articles were surfacing in the drawer when a topic had been regenerated and the old version archived.
- **`useHelpSearch`**: added `.eq('is_active', true)` filter — same root cause; search results could return stale archived articles.
- **HelpDrawer release badge**: label changed from `help.section_label` ("Section") to `help.generated_label` ("Generated") — the badge now correctly reads "Generated · v3.2.0" instead of "Section · v3.2.0".

### Added — `data-help-region` completeness
- **`ResourcesTab`**: `<TabsContent value="agile">` now carries `data-help-region="workspace.agile"` — the drag-target ? icon can now target the Agile board section for context-specific help.

### Added — i18n fallback anchors
- **EN + HU bundles**: 13 new fallback anchor entries covering all gaps between the drawer and seed data:
  `workspace.requests`, `capacity-dna`, `command-center`, `decision-memory`, `coverage-planner`, `org-chart`, `audit-log`, `quota-manager`, `holiday-manager`, `localization-settings`, `integration-health`, `role-permissions`, `access-request`.
- `workspace.approvals` enhanced with `commonTasks` list (both locales).
- New i18n key `help.generated_label` added in both EN (`'Generated'`) and HU (`'Generálva'`).

### Added — Seed migration `20260507140000`
- **14 new curated help articles** (7 topics × 2 locales) filling the mandatory anchor gaps:
  - `time-entry` (EN + HU) — step-by-step leave request submission with conflict engine flow diagram
  - `onboarding-template` (EN + HU) — template creation, step types, publish/archive lifecycle
  - `agile-kanban` (EN + HU) — Kanban board view, card anatomy, sync workflow
  - `agile-scrum` (EN + HU) — Scrum board with per-sprint totals and story point headers
  - `agile-gantt` (EN + HU) — Gantt timeline, type colour coding, date requirements
  - `jira-integration` (EN + HU) — connection setup, test connection, project config sync, troubleshooting
  - `export-center` (EN + HU) — CSV export workflow, field list, encoding note
- All rows use `ON CONFLICT DO NOTHING` — safe to re-run and regenerator-upserts are never overwritten.

### Added — `docs/help/` documentation suite
- **8 structured EN help articles** under `docs/help/en/` with Mermaid flowcharts, step-by-step guides, common actions tables, and troubleshooting sections:
  - `00-index.md` — feature map with anchor-to-article cross-reference
  - `01-getting-started.md` — sign-in, workspace selector, first steps
  - `02-leave-requests-and-approvals.md` — full leave request and approval chain flows
  - `03-members-and-organization.md` — invite flow, org module, position catalog, org chart
  - `04-calendar-and-capacity.md` — four calendar views, coverage planner, Capacity DNA
  - `05-workflows-onboarding-access.md` — onboarding templates, access systems and templates, access inbox
  - `06-resources-agile-capacity.md` — capacity heatmap, projects, all three agile board views, Capacity Fit
  - `07-reports-audit-export.md` — KPI dashboard, immutable audit log, CSV export
  - `08-settings-admin.md` — all settings sections, approval chains, Recovery Mode, Decision Memory, Command Center
- **`docs/help-reference.md`** — top-level canonical feature map consumed by the AI regenerator: all anchor IDs, navigation paths, and business rule summaries.

### Added — `help-regenerator` improvements
- Now scans **three** source directories instead of two: `versioning/`, `docs/` (root), and `docs/help/en/` (up to 8 articles).
- The EN help articles serve as style and content reference for Gemini — generated articles will mirror the established structure and tone.
- `changed_files.count` in `help_releases` now correctly reflects all three source sets.

### Non-Regression Contract
- Zero changes to existing RLS policies, approval engine, capacity engine, or any component outside of the help system.
- The `is_active` filter is purely additive — it uses the index `help_articles_active_idx` added in v3.2.1.
- All existing `data-help-region` attributes preserved; only one new attribute added.
- All existing i18n keys preserved; only new keys added.
- Seed migration uses `ON CONFLICT DO NOTHING` — cannot overwrite existing content.

## 2026-05-07 — v3.2.1 Help System Diagnosis & Hardening

### Fixed
- **`help-regenerator` edge function**: corrected fallback repo from `lovable-app/genisys` to `henrikfaul/effectime-app-enterprise-a95029a1` — the regenerator was silently reading the wrong repository on manual triggers with no `repo` payload.
- **`WorkspaceDashboard` tab-to-anchor mapping**: `resources`, `reports-audit`, and `settings` tabs now correctly map to `workspace.resources`, `workspace.reports`, and `workspace.settings` anchors (previously all three fell back to `workspace.members`).
- **Missing `data-help-region` attributes**: added to `resources`, `reports-audit`, `settings`, and `requests` `TabsContent` blocks so the drag-target ? icon can target those sections.

### Added
- **Schema migration `20260507120000`**: `is_active boolean` and `archived_at timestamptz` columns on `help_articles`; index `help_articles_active_idx (is_active, anchor_id, locale)`. The regenerator now archives stale articles (sets `is_active = false, archived_at = now()`) before upserting fresh ones — preserving full version history.
- **`help-regenerator` improvements**: reads `docs/` directory in addition to `versioning/`; expanded mandatory anchor list from 8 → 30 topics; per-article `archiveStaleArticles` call before upsert; updated system prompt with full article structure requirement.
- **`HelpDrawer` back-navigation**: arrow-left button appears when the user has navigated to a linked article, allowing them to return to the previous topic. History is cleared on drawer close.
- **i18n fallback anchors** added for `workspace.resources`, `workspace.reports`, `workspace.settings`, and `workspace.agile` in both EN and HU bundles — these power the drawer when no DB article exists yet.
- **Seed migration `20260507130000`**: 40 curated EN+HU help articles covering all major Effectime pages and features: Workspaces, Members, Organization, Calendar, Leave Request, Approval Flow, Workflows, Resources, Reports & Audit, Settings, Agile Boards, Capacity DNA, Org Chart, Coverage Planner, Localization Settings, Audit Log, Integration Health, Command Center, Quota Manager, Holiday Manager, Role Permissions, Decision Memory, Access Request. Uses `ON CONFLICT DO NOTHING` so regenerator-promoted articles are never overwritten.

### Non-Regression Contract
- Zero changes to existing RLS policies, approval engine, capacity engine, or any component outside of the help system.
- `help_articles` schema changes are purely additive (new nullable columns + new index).
- All existing help drawer functionality (drag-target, search, fallback i18n copy, ReactMarkdown rendering) preserved.

## 2026-05-07 — v3.2.0 Self-Updating Help System

### Added
- **DB**: `help_articles` (topic_key, locale, title, summary, body_md, route, anchor_id, taxonomy, tags, synonyms, related_topics, search_tokens tsvector) + `help_releases` for release-driven regeneration tracking. RLS: public read, service-role write only.
- **DB schema**:
  - `help_articles` — per-(topic_key, locale) article storage with: title, summary, body_md, route, anchor_id, taxonomy, tags[], synonyms[], related_topics[], release_id FK, content_hash SHA-256, is_system_generated, search_tokens tsvector, last_generated_at. Trigger `help_articles_search_trigger` rebuilds tsvector on insert/update with weighted A (title), B (summary+tags+synonyms), C (body). GIN indexes on tags and search_tokens. `is_active` + `archived_at` columns for soft-delete (added v3.2.1).
  - `help_releases` — one row per regeneration run: version_tag UNIQUE, commit_sha, status enum, summary, error, triggered_by, started_at, completed_at.
  - RLS: public SELECT only (no INSERT/UPDATE/DELETE policy — service role only writes).
- **Edge function `help-regenerator`**:
  - **HMAC-SHA256 verification** of `x-hub-signature-256` against `GITHUB_RELEASE_WEBHOOK_SECRET`. If secret env var is unset, verification is **skipped** (allows manual testing without a secret). Does NOT fail — this is intentional to allow local curl invocations.
  - Fetches `CHANGELOG.md` + last 10 `versioning/*.md` via `raw.githubusercontent.com`.
  - Calls **Google Gemini 2.0 Flash** (`generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`) with `responseMimeType: "application/json"`, `temperature: 0.3`, structured JSON array output.
  - Upserts each EN+HU variant on conflict `(topic_key, locale)`; computes SHA-256 content hash.
  - Archives previous article versions by setting `archived_at` before upsert; new version gets `is_active = true`.
- **Frontend Help Drawer redesign** (`HelpDrawer.tsx`): search bar with debounced autocomplete (200 ms), locale-aware results with EN fallback, markdown body rendering (`react-markdown`), release tag badge, dark glass surface.
- **Drag-target ? icon** (`HelpButton.tsx`): `pointerdown` → tracks pointer movement. If movement exceeds **6px threshold**, switches to drag mode. While dragging, `document.elementFromPoint()` finds the nearest `[data-help-region]` and toggles `.help-target-hover` (primary-tinted ring + brightness boost). On `pointerup` over an anchor, opens drawer with that anchor's article. Pure click (< 6px movement) opens the page-level help as before.
- **`useHelpArticleByAnchor` / `useHelpSearch` hooks** in `src/lib/help/useHelpArticles.ts`: anchor lookup with EN fallback, ilike full-text search.

### Webhook configuration
`POST https://oezlzzmzzvbvinuysxaz.supabase.co/functions/v1/help-regenerator`  
GitHub repo Settings → Webhooks → Content type: `application/json`, Secret: `GITHUB_RELEASE_WEBHOOK_SECRET`, Events: "Releases" only.  
Manual trigger: `curl -X POST <url> -H 'content-type: application/json' -d '{"repo":"OWNER/REPO","ref":"main","version_tag":"v3.x.x"}'`

## 2026-05-08 — v3.1.1 Demo workspace, position catalog wiring, Jira sync fix, in-app Jira issue editor

### Added — Demo workspace creation (full flow)
- **`supabase/functions/seed-demo-workspace/index.ts`**: new edge function that creates a fully populated workspace in one call. Strategy: create real `auth.users` for 7 demo personas (`Anna Kovács`, `Bence Tóth`, `Csilla Nagy`, `Dávid Szabó`, `Eszter Kiss`, `Ferenc Horváth`, `Gizella Varga`) tagged with `app_metadata.is_demo_persona`, so all profile lookups, leave_requests, allocations, and skills work without schema changes. The function then seeds:
  - 3 offices (Budapest HQ / Debrecen / Szeged) with real city addresses,
  - 4 teams (Frontend / Backend / Operations / QA),
  - 4 leave types (Éves szabadság / Betegszabadság / Fizetés nélküli / Otthoni munka),
  - 8 HU public holidays for the current year,
  - 9 skills (React, TypeScript, Node.js, PostgreSQL, Docker, AWS, Tailwind CSS, Cypress, Jest) with categories and colors,
  - 7 memberships (1 owner + 6 demo personas) with city/office/role/team/working hours,
  - 14–21 member-skill assignments (random level 1–5),
  - 6 role allocations (1 per persona at 100%),
  - 6 leave requests covering every status: approved past, approved upcoming, currently on leave, pending, rejected, sick leave,
  - 25-day vacation allowance per member,
  - 1 daily rule (max 2 off on Mondays),
  - 1 office coverage rule (Budapest needs 1 dev present weekdays),
  - 1 audit event recording the demo seed.
- **`supabase/functions/cleanup-demo-workspace/index.ts`**: companion edge function that deletes the workspace AND removes the orphan demo `auth.users`. Owner-only authorization. Reads `enterprise_workspaces.settings.demo_user_ids` (stamped by the seeder) so cleanup can find the exact users to remove.
- **`CreateWorkspaceDialog`**: new "Demo munkaterület" panel below the description field with a `Demo munkaterület létrehozása` button. Calls `seed-demo-workspace` and reports the seeded counts in the toast.
- The demo flag is stored on `enterprise_workspaces.settings.is_demo` plus `demo_user_ids` and `demo_seed_tag` so the workspace is identifiable and safely cleanable.

### Fixed — Position catalog now actually shows in Resources tab
- **`BusinessRoleManager`** (Resources → Pozíciók): added `Katalógus megnyitása` button that opens `PositionPickerDialog`, alongside the existing free-text input. Picking a position from the catalog appends it as a new role group ready for member allocation.
- **`PositionPickerDialog`** now falls back to the **global catalog** (`enterprise_catalog_categories` / `enterprise_catalog_roles` / `enterprise_catalog_role_skills` / `enterprise_catalog_skills`) when the workspace-scoped customization layer is empty — which is the case for every fresh workspace. The 558+ rows already seeded in `enterprise_catalog_skills` are now reachable from the UI. A small banner indicates when the global catalog is being read.

### Fixed — Jira `sync_project_config` 500 error
- **`jira-devops-proxy/jiraSyncProjectConfig`**: previous code passed `project_key` (e.g., `SYN`) into the `projectId` query parameter of `/rest/api/3/issuetype/project`, which expects a numeric ID and 500'd. Replaced with `GET /rest/api/3/project/{key}` (returns issueTypes inline) and a `/rest/api/3/issue/createmeta` fallback. Label/component discovery is now best-effort (warns instead of failing the whole sync).

### Added — In-app Jira issue editor (open & edit Jira tickets without leaving Effectime)
- **`JiraIssueEditor`** (`src/components/enterprise/agile/JiraIssueEditor.tsx`): new dialog that loads a Jira ticket with all primary fields (summary, description, priority, labels, due date, story points, assignee, status with available transitions, sprint, parent, components, reporter, timestamps) and lets users edit them in place. Save sends a single `update_issue` call to `jira-devops-proxy` and refreshes the local cache; status changes go through the Jira `/transitions` endpoint. Free-text where appropriate (summary, description, labels), select-from-list for priority/status/assignee.
- **`jira-devops-proxy`** extended with three new actions:
  - `get_issue` — fetches a single issue with `*all` fields + status transitions in parallel,
  - `get_transitions` — lists allowed status transitions for a given key,
  - `search_assignable_users` — type-ahead user search scoped to the issue.
- **`update_issue`** now supports description, priority, due date, story points (customfield_10016), assignee account ID, and `status_transition_id`. After save, the proxy re-reads the issue and upserts the fresh row into `enterprise_agile_issues` so the cache stays current.
- **`BacklogBrowser`** rows: clicking the summary or the new pencil icon opens `JiraIssueEditor`. The external link icon to the actual Jira site is preserved.
- **`AgileBoards`** (Kanban / Scrum / Gantt): cards and Gantt rows are now keyboard- and click-actionable; opening a card launches the editor. The external Jira link on each card stops propagation so it still navigates externally.

### Non-Regression Contract
- `seed-demo-workspace` uses the existing `create_workspace_with_owner` RPC for the workspace itself (preserves owner-membership invariants), then service role for additive seeding only.
- `cleanup-demo-workspace` only deletes workspaces where `created_by = auth.uid()`. RLS-protected.
- `PositionPickerDialog` still tries the workspace-scoped tables first; the global catalog is a fallback, not a replacement.
- All Jira proxy changes are additive (new actions). Existing `search_issues`, `create_issue`, `update_issue` behavior preserved; `update_issue` now accepts more optional fields but ignores those it doesn't recognize.
- `JiraIssueEditor` is a brand-new component; no existing component was rewritten.
- The previous BacklogBrowser external-link behavior is preserved alongside the new edit affordance.

### Validation
- `npx vitest run` → 83 tests, 0 failures (unchanged from v3.1.0).
- `npx tsc --noEmit -p tsconfig.app.json` → 0 errors (cleaned up from the prior 18 baseline now that node_modules is installed).

---

## 2026-05-07 — v3.1.0 Phases 9, 10, 11: QA Safety Net, Versioning & Rollout, Implementation Roadmap

### Added — Phase 9 (QA, testing, and release safety)

**Unit test suite — 77 new tests across 6 test files** (total: 83 tests, all passing):

- `src/test/passwordValidation.test.ts` (9 tests): full coverage of `validatePassword` per-check flags and `isPasswordValid` composite gate; regression-guards the auth strength requirements.
- `src/test/capacityEngine.test.ts` (11 tests): `sortCandidatesForRequirement` (full-time ≥90% vs partial-fit strategy, immutability, empty input); `summarizeRequirements` (gap math, multi-role, zero-assignment, over-assignment edge cases).
- `src/test/coverageEligibility.test.ts` (20 tests): pure `evaluateEligibility` and `rankCandidates` — all blocking and warning codes verified (ON_LEAVE, BLOCKED, PENDING_LEAVE, HOLIDAY, WRONG_ROLE, MISSING_SKILL, SKILL_LEVEL_LOW, DOUBLE_BOOKED, OVER_CAPACITY); multi-role/multi-skill resolution; leave range boundary; cross-user leave isolation.
- `src/test/smartSchedule.test.ts` (8 tests): `generateSmartSchedule` — site-allowlist enforcement, leave exclusion, multi-day range, multi-slot headcount, role preference, no-double-booking invariant.
- `src/test/csv.test.ts` (20 tests): `flatten` (nesting, deep keys, type coercion, null/undefined); `parseCsv` (simple, quoted commas, escaped quotes, CRLF); `buildI18nCsv` (header, 3-column invariant, sorted keys); `parseI18nCsv` (key-column guard, empty input, added/updated/skipped counts, override maps); `bundleStats`.
- `src/test/i18n.localization.test.ts` (9 tests): EN/HU key parity (minimum 100 keys, ≤5% gap tolerance in each direction), empty-value regression, `bundleStats` tolerance, explicit critical-key assertions for `common.save`, `header.help`, `header.language`, and `organization.*` keys.

**Validation**: `npx vitest run` → 83 tests, 0 failures.

### Added — Phase 10 (Changelog, versioning, and rollout governance)

- **Versioning file** `versioning/07052601_v3.1.0_phases_9_10_11.md`: canonical delivery artifact covering the full Phase 9–11 scope, regression protection matrix, feature flag status table, rollout guards, pre-existing known issues, and deployment sequence (zero-migration release).
- Feature flag inventory and rollback procedure documented.
- 5-step CI gate checklist (`vitest run`, `tsc --noEmit`, smoke test, mobile test, RLS check) codified as the merge-gate for all future waves.

### Added — Phase 11 (Final implementation roadmap)

- **6-wave delivery plan** defined in the versioning file:
  - Wave 0: Foundation hardening (already delivered — localization, help system, organization module, onboarding, strategic capabilities).
  - Wave 1: Approval orchestration hardening (delegation, escalation UI, simulation, mobile UX).
  - Wave 2: Capacity engine v2 (precomputed snapshots, shortage/overload forecast, scenario compare, financial impact layer).
  - Wave 3: Organization and onboarding production-readiness (org chart zoom/pan, deadline enforcement, member completion wizard).
  - Wave 4: Integration health and external access (retry queue, webhook/polling hybrid, access approval routing, SCIM).
  - Wave 5: Reporting, export, and compliance (field masking, retention policy, PDF renderer, new report datasets).
  - Wave 6: Localization expansion (remaining help anchors, manual chapters, third-language scaffold, admin translation editor).
- Dependency order and parallelization opportunities documented.
- Open questions and risks (7 items) catalogued with owner and priority.

### Non-Regression Contract
- Zero schema changes — this is a test-and-documentation-only release.
- Zero edge function changes.
- Zero new npm runtime dependencies.
- TypeScript error count unchanged at 18 (all pre-existing missing-peer-dep issues).
- All existing UI tabs, routes, buttons, filters, exports, and workflows untouched.

---

## 2026-05-06 — Jira integration repair + Boards (Kanban / Scrum / Gantt)

### Fixed — Jira search 410 / empty result regression
- **Root cause**: `jiraSearch()` was calling a single fixed endpoint and requesting only a hardcoded subset of fields. After Atlassian migrated tenants to the new search API (`/rest/api/3/search/jql`), the old endpoint returned 410 Gone or zero results.
- **Fix** (`supabase/functions/jira-devops-proxy/index.ts`):
  1. Request `fields: ['*all']` so Jira returns every navigable + custom field.
  2. Cascade three endpoints: `POST /rest/api/3/search/jql` → `GET /rest/api/3/search/jql` → `GET /rest/api/3/search` (legacy). First 2xx wins.
  3. Map description from **Atlassian Document Format (ADF)** JSON to plain text via a recursive `adfToText()` walker that handles `text`, `paragraph`, `heading`, `bulletList`, `listItem`, `codeBlock`, and `inlineCard` node types.
  4. Resolve `sprint`, `team`, `start_date`, `story_points` across the most common Jira customfield IDs: `customfield_10020 / 10007 / 10010` (sprint), `customfield_10001` (team), `customfield_10015` (start date), `customfield_10016 / 10026` (story points).
- Removed leftover `auth-middleware.ts` / `client.server.ts` TanStack stubs that broke the Vite SPA build (`Cannot find module '@tanstack/react-start'`).

### Added — Extended Jira field ingest
The proxy now imports and caches the following fields per issue (Jira Cloud):

| Field | Source |
|-------|--------|
| assignee | `fields.assignee.displayName` |
| reporter | `fields.reporter.displayName` |
| status | `fields.status.name` |
| issue_type | `fields.issuetype.name` |
| summary | `fields.summary` |
| description | `adfToText(fields.description)` |
| key | `issue.key` |
| parent_key | `fields.parent.key` |
| sprint_name | `customfield_10020 / 10007 / 10010` |
| labels | `fields.labels` (full array) |
| due_date | `fields.duedate` |
| team_name | `customfield_10001 / fields.team` |
| start_date | `customfield_10015 / fields.startdate` |
| priority | `fields.priority.name` |
| story_points | `customfield_10016 / 10026` |

Schema migration: two new columns on `enterprise_agile_issues` — `description text`, `team_name text`.

### Added — Boards tab (Kanban / Scrum / Gantt)
New `AgileBoards` component, mounted as a dedicated tab in `AgilePanel`:
- **Kanban** — columns grouped by `status`, cards show key, type chip, assignee, SP, priority, labels.
- **Scrum** — first level grouped by `sprint_name`, second level by `status`; per-sprint header counts tickets and total Story Points.
- **Gantt** — horizontal month-grid timeline driven by `start_date → due_date` with type-coloured bars (Bug=red, Epic=purple, Story=emerald, Task/other=sky).
All three views read from the cached `enterprise_agile_issues` so they remain available offline; a `Szinkron` button forces a fresh pull.

---

## 2026-05-06 — Navigation restructure: NotificationBell + Rules consolidation (PR #12)

### Changed — `WorkspaceDashboard` top-level tab bar
- **Removed** the standalone `Értesítések` (Notifications) tab.
- **Removed** the standalone `Szabályok` (Rules) tab.
- Tab bar simplified from 8 → 6 primary tabs.

### Added — `NotificationBell` in workspace header
- Bell icon next to the `Profilom` button; displays **unread count badge** (capped at `99+`).
- Badge count refreshes every 60 s and on popover close.
- Clicking opens a `Popover` containing the existing `EnterpriseNotifications` component unchanged.
- `canView('notifications')` permission still gates visibility.

### Changed — All rule managers moved into `Kérelmek` tab
- New **Szabályok** collapsible section inside `Kérelmek` containing all rule managers: Approval chains, Leave types, Holidays, Company days, Blocked dates, Daily rules, Office coverage rules, Rule template library.
- All top-level sections in `Kérelmek` (Jóváhagyások, Kérelmek, Szabályok) start **collapsed by default**; each sub-section is independently collapsible.
- `canView('rules')` permission still gates the entire section.
- All rule managers render functionally unchanged inside their new collapsible wrappers.

---

## 2026-05-05 — v3.0.0 Phase 8 implementation: persistent translation overrides, predictive forecaster v1, Org Pulse, Integration Health Center, Decision Memory observed-outcome capture

### Added — Persistent translation overrides
- Migration `supabase/migrations/20260505140000_phase8_overrides_pulse.sql` adds `enterprise_translation_overrides` (workspace_id, locale, key, value, source, authored_by) with `(workspace_id, locale, key)` UNIQUE, full RLS (member read, admin write).
- `I18nProvider` extended with `loadWorkspaceOverrides(workspaceId)` and `activeWorkspaceId`. Resolution order is now: workspace override (active locale) → bundle (active locale) → workspace override (default locale) → bundle (default locale) → key. `WorkspaceDashboard` invokes `loadWorkspaceOverrides(workspace.id)` on mount and clears on unmount.
- `Settings → Localization`: admins now have a true persistence path. Importing a CSV upserts each row into `enterprise_translation_overrides` and immediately reloads the active overrides — translations live without code changes.

### Added — Capacity DNA / Predictive forecaster v1 (rule-based, client-side)
- `CapacityDnaPanel` rendered inside the Resources tab with a *Generate snapshot for today* admin action.
- Computes baseline (active members), effective (baseline minus approved leave overlapping today), committed (sum of `enterprise_member_role_allocations.percentage / 100`), available, shortage_score, overload_score.
- Upserts to `enterprise_capacity_snapshots (workspace_id, snapshot_date)` UNIQUE; the last 30 days are surfaced as a compact table with shortage/overload trend icons.

### Added — Org Pulse widget
- `OrgPulseWidget` rendered above the workspace tabs (admins only). Pulls from a new SQL view `enterprise_org_pulse_membership` plus two on-the-fly counters (approvals open > 48h; approved leave in the last 7 days).
- Privacy-safe: every cell is suppressed when its denominator (`active_members`) is below `k = 5`, or when the value itself is between 1 and 4 (k-anonymity floor).

### Added — Integration Health Center
- New Settings section (admin only) — `IntegrationHealthCenter` lists each `enterprise_integrations` row with a per-integration health badge (`healthy / degraded / failed / unknown`) computed from the last 5 entries of `enterprise_agile_sync_log`.
- Surfaces last sync action, status, and the three most recent error excerpts inline.

### Added — Decision Memory observed-outcome capture
- Migration adds `enterprise_decision_memory.observation_due_at` plus a `BEFORE INSERT` trigger that defaults it to `authored_at + 14 days`.
- `DecisionMemoryStaleInbox` rendered inside the Approvals collapsible (admin only). Lists every memory whose observation window has elapsed and has no observed outcome yet; admins capture the outcome inline. Closes the learning loop on every recorded decision.

### i18n
- Added EN + HU keys for `pulse`, `capacity`, `integration_health`, `decision.stale_inbox_*`, `settings.localization.persisted`. Both bundles in lockstep — the import-CSV pipeline can now patch any gap without code deploys.

### Wiring
- `WorkspaceDashboard` imports the four new components, passes `isAdmin` + `userId` to `LocalizationSettings`, renders `CapacityDnaPanel` in Resources, `OrgPulseWidget` above tabs, `IntegrationHealthCenter` and `DecisionMemoryStaleInbox` in their respective Settings/Approvals sections.
- `loadWorkspaceOverrides` lifecycle anchored to the active workspace.

### Non-Regression Contract
- Migration is purely additive (one new table, one new view, one new column, one new trigger). No RLS weakening; new policies match the established `is_enterprise_member` / `has_enterprise_role` pattern.
- Phase 8 components are admin-only where they involve writes; read-only members see suppressed pulse cells and snapshot tables but cannot trigger writes.
- Forecaster v1 is rule-based and runs client-side — no edge-function or pg_cron dependency.

### Validation
- `npx tsc --noEmit -p tsconfig.app.json`: total error count unchanged at 18 (all pre-existing missing-peer-dep issues in the sandbox). Zero errors in any Phase 8 file (`CapacityDnaPanel`, `OrgPulseWidget`, `IntegrationHealthCenter`, `DecisionMemoryStaleInbox`, `csv` util, `I18nProvider` extensions, `LocalizationSettings` upsert path, both bundles).

## 2026-05-05 — v3.0.0 Phases 5–7 implementation: Onboarding, External Access matrix, Strategic capabilities, Localization expansion

### Added — Phase 5 (Onboarding & External Access)
- **Migration** `supabase/migrations/20260505130000_onboarding_access_strategic.sql` (idempotent additive):
  - `enterprise_onboarding_templates`, `enterprise_onboarding_template_steps` (8 step types: `task | read | acknowledge | training | exam | approval | internal_permission | external_access`),
  - `enterprise_onboarding_instances`, `enterprise_onboarding_step_completions`,
  - `enterprise_access_systems`, `enterprise_access_templates`, `enterprise_access_template_systems`, `enterprise_access_requests`, `enterprise_access_decisions`,
  - cross-table FK from onboarding step `access_system_id` to access systems,
  - full RLS (members read, admins write; child-table policies gate via parent's workspace),
  - `seed_default_access_systems` SECURITY DEFINER seeder (Jira / Confluence / Outlook / Dynatrace / ERP / Billing / Entry Control).
- **Workflows module** (`src/components/enterprise/workflows/`):
  - `WorkflowsModule` shell with 5 sub-tabs.
  - `OnboardingTemplates` — create + publish + archive templates, per-template collapsible step editor, 8 step types localized.
  - `OnboardingInbox` — start onboarding for a member, per-instance progress (completed steps / total steps), confirm/cancel actions.
  - `AccessSystems` — manage external + internal systems, **Seed defaults** RPC button, archive.
  - `AccessTemplates` — pivot-style position-bundle editor, system checkbox toggles per template, collapsible per template.
  - `AccessInbox` — submit on behalf of member, decide (approve/reject/mark granted/revoke), every decision writes to `enterprise_access_decisions`.
- **New `Folyamatok` (Workflows) tab** added to the workspace tab bar between Naptár and Erőforrások (gated by `members` view permission).

### Added — Phase 6 (Strategic capabilities)
- **Migration extends `enterprise_workspaces`**: `recovery_mode`, `recovery_mode_reason`, `recovery_mode_activated_at`, `recovery_mode_activated_by`.
- **`enterprise_capacity_snapshots`** table for per-day baseline / effective / committed / available FTE + shortage/overload scores + payload jsonb (foundation for predictive forecaster v2).
- **`enterprise_decision_memory`** table — `(workspace_id, subject_type, subject_id)` UNIQUE annotation with rationale / expected outcome / observed outcome.
- **`CommandCenter` widget** (`src/components/enterprise/CommandCenter.tsx`) — rendered at the top of the workspace dashboard, surfaces four counters (pending leave approvals, in-progress onboarding instances, pending access requests, members with incomplete org metadata). Click-through navigates to the relevant tab. Visually shifts to destructive-tinted card when Recovery Mode is active. Refreshes every 90s.
- **`RecoveryModeSettings`** — Settings → Recovery üzemmód section with activate/deactivate, reason, activated-at timestamp.
- **`DecisionMemoryEditor`** — generic memo component (`subject_type`, `subject_id`) for attaching rationale + expected/observed outcomes to any decision; uses upsert pattern. Drop-in for approvals, scenarios, access decisions.
- **WorkspaceDashboard** loads `recovery_mode` flag at mount and refreshes every 90s; CommandCenter receives the flag for visual emphasis.

### Added — Phase 7 (Localization expansion + admin manageability)
- **Hungarian localization completed** for all new keys: workflows, onboarding (template / instance / step types), access (systems / templates / inbox + 7 statuses + 5 actions), command center, decision memory, settings (recovery + localization import/export). EN baseline mirrored.
- **i18n CSV utilities** (`src/lib/i18n/csv.ts`):
  - `flatten(bundle)` — recursive dotted-key map of resource bundle.
  - `buildI18nCsv()` — RFC4180 CSV with BOM, columns `key,en,hu`, sorted by key.
  - `parseCsv(text)` and `parseI18nCsv(text)` — quoted-field aware parser, computes `{ added, updated, skipped, total, overrides }` summary; per-locale override Maps.
  - `bundleStats()` — total keys + missing-key counters per locale.
- **Settings → Localization** now exports / imports bilingual translation CSVs:
  - **Export CSV** downloads `effectime-i18n-YYYY-MM-DD.csv`.
  - **Import CSV** parses uploads, validates header, reports a session summary (`{{added}} new · {{updated}} updated · {{skipped}} skipped`). Persistent admin overrides land in a follow-up release; this surface is the canonical translator exchange unit.
  - Header now also shows live counters: total keys / missing in HU / missing in EN.

### Wiring
- `WorkspaceDashboard` imports `WorkflowsModule`, `CommandCenter`, `RecoveryModeSettings`; renders CommandCenter once at the top of `<main>`; new `workflows` TabsContent; new Settings section for Recovery Mode (admin only); refresh-on-interval recovery flag.
- New help anchor `workspace.workflows` registered in EN + HU bundles.

### Non-Regression Contract enforcement
- All Phase 5–6 tables additive; all RLS workspace-scoped via `is_enterprise_member()` / `has_enterprise_role()`.
- No existing tab, button, route, or workflow removed. Workflows is a brand-new tab, not a replacement.
- Command Center is purely additive (extra widget at top of `<main>`); existing dashboard layout below remains untouched.
- Decision Memory does not modify any existing approval/leave/scenario row — it stores a side-table annotation.
- i18n CSV import is session-only in this release; persistent overrides require a follow-up RPC and are explicitly noted in the import help text.

### Validation
- `npx tsc --noEmit -p tsconfig.app.json`: zero errors in any new file (workflows/*, CommandCenter, RecoveryModeSettings, DecisionMemoryEditor, csv util, both bundles, NotificationBell). Total error count unchanged at 18 — all pre-existing missing-peer-dep complaints in the sandbox.

## 2026-05-05 — v3.0.0 Phases 1–4 implementation: localization, help system, Organization module, position catalog, org chart, manual

### Added — Phase 1 (Localization + Help system)
- **i18n core** (`src/i18n/`): homegrown React-Context provider, EN + HU resource bundles (`src/i18n/resources/{en,hu}.ts`), `useT`/`useI18n` hooks, browser+localStorage+`profiles.preferred_locale` detection chain with English fallback. No new npm dependency.
- **Language selector** (`src/components/i18n/LanguageSelector.tsx`) — circular flag dropdown in the right header cluster; persists immediately to `localStorage.effectime.locale` and best-effort to `profiles.preferred_locale`.
- **Help system** (`src/lib/help/registry.tsx`, `src/components/help/HelpButton.tsx`, `src/components/help/HelpDrawer.tsx`) — question-mark button on the **left side** of every header, right-side drawer with section title, summary, common-tasks list, and breadcrumb chips. Page regions marked with `data-help-region="<anchor>"` receive a soft pulse ring (respects `prefers-reduced-motion`). Shipped anchors: `home.overview`, `workspace.members`, `workspace.organization`, `workspace.calendar`, `workspace.approvals`, `settings.localization`.
- **Help highlight CSS** (`src/index.css`): `.help-highlight-ring` + keyframes + reduced-motion guard.
- **Header restructure** (`src/pages/Enterprise.tsx`, `src/components/enterprise/WorkspaceDashboard.tsx`): Help (?) on left, Language selector in right cluster, all existing buttons preserved (Profilom, Meghívás, Kilépés, Új munkaterület). Workspace header now drives the help anchor from the active tab.
- **Settings → Localization** (`src/components/enterprise/settings/LocalizationSettings.tsx`): read-only v1 — lists EN + HU with active-language indicator, missing-key counter, workspace-default note.
- **Side fix**: missing `Building2` import in `Enterprise.tsx` (latent bug — would crash the empty-workspace state) added.

### Added — Phase 2 (Organization module)
- **Migration** `supabase/migrations/20260505120000_preferred_locale_and_organization.sql`: idempotent additive migration adding
  - `profiles.preferred_locale` + check constraint,
  - `enterprise_workspaces.default_locale` + check constraint,
  - tables: `enterprise_org_units`, `enterprise_leadership_levels`, `enterprise_contract_types`, `enterprise_industries`, `enterprise_work_categories`, `enterprise_job_families`, `enterprise_org_chart_snapshots`,
  - additive columns on `enterprise_memberships`: `org_unit_id`, `manager_id`, `leadership_level_id`, `contract_type_id`, `leadership_category` (with check constraint), `employer_rights`, `position_catalog_id`, `seniority`,
  - manager-cycle prevention trigger,
  - RLS policies (members view, admins manage) for all new tables,
  - `seed_default_contract_types` and `seed_default_leadership_levels` SECURITY DEFINER seeders.
- **People → Organization** tab (`src/components/enterprise/organization/`): full sub-module with seven tabs:
  - `OrgStructure` — hierarchical tree with parent picker, archive action.
  - `LeadershipLevels`, `ContractTypes`, `Industries`, `WorkCategories`, `JobFamilies` — backed by a shared `CatalogListEditor` (label + auto-slugged code, archive, optional **Seed defaults** for leadership and contracts).
  - `OrgChart` — auto-generated tree from `manager_id`, search filter, snapshot timestamp, **Regenerate snapshot** writes to `enterprise_org_chart_snapshots`.
- **InviteMemberDialog** enhanced (`src/components/enterprise/InviteMemberDialog.tsx`):
  - New optional Organization metadata section: org unit, direct manager, contract type, leadership level, leadership category, employer-rights checkbox.
  - Predefined Position Picker integration (Phase 3).
  - All new fields stored in the workspace `invitation_prefills` payload alongside existing fields.
  - Audit-log metadata extended with the new fields.
  - Existing free-text + RoleAllocationEditor + template paths fully preserved.
- **MemberProfileSheet** completion banner (`src/components/enterprise/MemberProfileSheet.tsx`): non-blocking amber banner at the top of the profile when any of `org_unit_id`, `manager_id`, `contract_type_id`, `leadership_level_id` is missing. Existing data preserved.

### Added — Phase 3 (Position catalog)
- **PositionPickerDialog** (`src/components/enterprise/positions/PositionPickerDialog.tsx`): three-step drill-down (category → role → review skills), reads from existing workspace catalog tables (`enterprise_workspace_role_categories`, `enterprise_workspace_roles`, `enterprise_workspace_role_skills`). Recommended `required` skills pre-checked; per-skill opt-in/opt-out; seniority selector (junior/medior/senior/lead/principal). Returns `{ positionRoleId, positionLabel, seniority, skillIds }` to the caller. Free-text path remains the default.

### Added — Phase 4 (Org chart + manual)
- **Org chart snapshot table** in the same migration; snapshot persistence wired through OrgChart's *Regenerate snapshot* action.
- **Bilingual user manual** (`docs/manual/{en,hu}/`):
  - `README.md`, `getting-started.md`, `workspaces.md`, `help.md`, `settings/localization.md`,
  - `people/members.md`, `people/organization.md`, `people/positions.md`,
  - parallel EN + HU editions covering all Phase 1–3 surface.

### Wiring
- `src/App.tsx`: wraps the app in `<I18nProvider>` and `<HelpRegistryProvider>`, renders `<HelpDrawer />` once at the top level.
- `WorkspaceDashboard` adds the `Szervezet` tab between Tagok and Naptár (gated by `members` view permission, identical to Tagok).
- `WorkspaceSettings` adds the Localization section after iCal.

### Non-Regression Contract enforcement
- Conflict engine, capacity engine, approval chain semantics, RLS helpers, email registry, office coverage rule fallback, calendar filter system, auth flows — **untouched**.
- All new fields on `enterprise_memberships` are nullable; the application reads via `.from('table').select('*')` patterns and degrades gracefully if columns are missing in dev.
- All new tables are workspace-scoped with `is_enterprise_member()` SELECT and `has_enterprise_role()` write policies.

### Validation
- `npx tsc --noEmit -p tsconfig.app.json`: 0 errors in any new or modified file. Total error count went from 19 → 18 (the missing `Building2` import in `Enterprise.tsx` is now fixed). Remaining 18 errors are all pre-existing missing-peer-dep complaints in the sandbox (`framer-motion`, `@dnd-kit/*`, `@tanstack/react-router`, `@tanstack/react-virtual`, `@lovable.dev/cloud-auth-js`, `@tanstack/react-start`) plus one pre-existing `CreateWorkspaceDialog` `userId` prop mismatch.
- Production `vite build` failure in the sandbox is pre-existing (peer-dep resolution against the lovable npm cache returned 403); identical on `HEAD` without these changes.

## 2026-05-05 — v3.0.0 Effectime Enterprise Master Framework (specification + Phase-1 prompts)

### Added — Versioning artifacts (no runtime changes in this commit)
- `versioning/05052601_v3.0.0_enterprise_master_spec.md` — canonical 25-section product, UX, frontend, backend, QA, localization, documentation, and rollout specification for the Effectime platform. Establishes the structural framework the existing modules must align to.
- `versioning/05052601_v3.0.0_ai_dev_prompts.md` — Phase-1 implementation prompts (header restructure, i18n scaffold, `profiles.preferred_locale`, help registry shell, Settings → Localization v1) with binding regression constraints and validation checklist.

### Scope established by this directive
- **First-class Organization module** (hierarchy, leadership levels, contractual relationships, industry, work categories, job families, automatic org chart) as a People sub-section — not a parallel hierarchy.
- **Mandatory member metadata** at creation: direct manager, organizational unit, position, leadership level, contract type, workspace, employer-rights flag, leadership category. Soft-required during transition with completion banner; cut-over date per workspace.
- **Predefined position catalog** with category drill-down and recommended skill expectation inheritance (junior/medior/senior). Free-text path preserved alongside catalog path. Builds on the role/category/skill catalog migration `20260505110000_enterprise_role_skill_catalog.sql`.
- **Onboarding playbook** as a first-class module: templates, instances, steps, ownership, deadlines, escalation, completion. Reuses the existing approval engine; does not duplicate it.
- **External Access Request matrix** tied to position and onboarding (Jira, Confluence, Outlook, Dynatrace, ERP, Billing, custom). Position × system pivot; routed through existing approval chains.
- **Help system** with question-mark icon on the **left side of the header**, contextual highlighting of the current page region, bilingual content, focus-trapped drawer.
- **Localization architecture** (English + Hungarian first), language selector with circular flag in the right header cluster. `profiles.preferred_locale` persistence; workspace default; missing-key fallback to English.
- **Full user manual** structure under `docs/manual/<locale>/<module>/<page>.md`, in-app `/manual` route, EN+HU parallel publishing.
- **Strategic capability framing** (capacity engine, predictive forecasting, workforce command center, approval orchestration, multi-workspace operating model, integration health, skill staffing, financials, scenarios, compliance, capacity DNA, recovery mode, org pulse, decision memory) layered on existing modules — not new top-level destinations.
- **Information architecture** consolidated to seven primary destinations: Home, Calendar, People, Workflows, Resources, Reports, Settings.

### Non-Regression Contract (binding)
- Auth flows, leave/approval lifecycle, quota math, conflict engine, capacity engine, RLS policies, email registry, office coverage rule fallback, and calendar filter system are classified **preserve exactly**.
- No removal of any existing tab, page, route, button, filter, export, or notification without an explicit `risky-change` artifact and changelog `Removed` entry.
- No silent semantics drift on approval, leave conflict, capacity, or coverage logic. No RLS weakening.
- No localization of database identifiers, enum codes, or stored permission keys.

### Non-Duplication Rules (binding)
- Organization module is canonical for hierarchy and contracts; existing People surfaces read from and write to it.
- Single skill taxonomy shared between SkillsManager and position catalog.
- Single approval engine for leave, onboarding, and access decisions.
- Onboarding and access KPIs ship as datasets/views in the existing report builder.
- All new flows route through `EnterpriseNotifications` and the transactional email registry.

### Rollout
- Phased delivery (Phase 1 foundations → Phase 7 localization completion) gated by per-workspace feature flags: `feat.help_system`, `feat.org_module`, `feat.position_catalog`, `feat.onboarding`, `feat.access_matrix`, `feat.localization_hu`, `feat.command_center`, `feat.recovery_mode`. Default off in production; rollback by flag.

### Notes
- This commit is **specification-only**. No `src/`, no migrations, no edge function changes. Runtime behavior is unchanged.
- Implementation begins under `versioning/05052601_v3.0.0_ai_dev_prompts.md` Phase 1.

---

## 2026-05-05 — Enterprise role/category/skill catalog schema foundation (PR #9)

### Added — Global catalog + workspace override layer
- **Migration** `supabase/migrations/20260505110000_enterprise_role_skill_catalog.sql`:
  - **Global inventory**: `enterprise_catalog_categories`, `enterprise_catalog_roles`, `enterprise_catalog_skills`, `enterprise_catalog_role_skills` (role→skill mapping with `min_experience_level`).
  - **Workspace override layer**: `enterprise_workspace_role_categories`, `enterprise_workspace_roles`, `enterprise_workspace_skills`, `enterprise_workspace_role_skills` (workspace-local copies with `approved`/`required` flags).
  - **`enterprise_experience_level`** enum: `junior` / `medior` / `senior` / `lead` / `principal`.
  - **`enterprise_memberships.business_role_id`** FK to `enterprise_workspace_roles.id` (additive; legacy `business_role` text column preserved for backward compat).
  - Indexes for workspace lookups, `updated_at` triggers on mutable tables, RLS policies (member read, admin write) on workspace-scoped tables.
- Seeded with 23 categories, 366+ roles, 550+ skills.
- Foundation consumed by `PositionPickerDialog` (Phase 3 of v3.0.0) for the 3-step drill-down (category → role → skill review).

---

## 2026-05-04 — URL canonicalization, branding, theme system, positions integrity (PRs #3–7)

### Changed — URL structure: `/enterprise` → `/app`; workspace UUID removed from URL (PR #3)
- `Enterprise.tsx` resolves the active workspace from: (1) legacy `?ws=` param once for backward compat → (2) `localStorage.active_workspace_id` → (3) first available workspace, then strips `?ws=` via `history.replaceState`.
- `/enterprise` preserved as a redirect alias → `/app`. Deep-link `?tab=` preserved.
- Invite acceptance sets workspace in state/storage without re-injecting `?ws=`.
- Files: `App.tsx`, `Enterprise.tsx`, `Auth.tsx`, `Landing.tsx`, `useAuth.tsx`, `InviteMemberDialog.tsx`, `Admin.tsx`, `Profile.tsx`, `ProfileMenu.tsx`.

### Added — `EffectimeLogo` component + sticky workspace tab navigation (PR #4)
- **`EffectimeLogo`** (`src/components/EffectimeLogo.tsx`): SVG gradient, dual-meaning `M` glyph (reads as "effectiMe" full-M and "effectiVe" inner-V). Two variants: `mark` (icon only) and `full` (with wordmark). Deployed to `SiteNav`, `Enterprise.tsx` header, landing page header + footer, `SiteFooter`.
- **Sticky workspace tabs**: `TabsList` moved outside scrollable content into a `sticky top-[57px]` container with `backdrop-blur`, `bg-background/95`, `z-20`, `border-b`. Tabs remain visible while users scroll tab content.
- `canViewPermissionConfig` prop added to `WorkspaceSettings`; `RolePermissionManager` conditionally rendered.

### Added — 6-template theme system with role-gated Layout Setting (PR #5)
- `ThemeStyle` enum extended: `enterprise`, `nebula`, `aurora`, `graphite`, `sunrise`, `mono`. Root-class toggle on `<html>` + `localStorage` persistence in `useTheme.tsx`.
- Tokenized CSS definitions in `src/styles/themes.css` — components continue using the same CSS variable tokens; only values change per template. Fixed-dark templates (`nebula`, `graphite`) bypass light/dark toggle.
- `layout_setting` permission key added to the feature catalog; owners retain access via owner check.
- "Layout Setting" section in Workspace Settings lets authorized users pick a template from the 6 options.

### Fixed — Positions data integrity in `TeamManager` and `InviteMemberDialog` (PR #6)
- Both components built `availableRoles` exclusively from `enterprise_memberships.business_role` (legacy text column). Positions that existed only in `enterprise_member_role_allocations` (the canonical junction table) were silently absent from every dropdown.
- **Fix**: both components now query `enterprise_member_role_allocations` in parallel and merge the two sets, so every created position is always selectable.

### Fixed — Triple-layer SPA routing (PR #7)
- `public/404.html`: captures full path + query + hash in `sessionStorage`, redirects to `/?r=...` for the SPA shell.
- `src/App.tsx`: `SpaRedirectHandler` reads `sessionStorage`/`?r=` and navigates client-side.
- `src/pages/Auth.tsx`: full split-screen redesign (left trust panel with 6 badges + calendar mockup, right scrollable auth card); all auth logic — `signIn`, `signUp`, `OTP`, `Google OAuth`, `reset` — preserved verbatim.

---

## 2026-05-04 — Google OAuth callback fix: URL fragment session restoration (PRs #1, #2)

### Fixed — Session not restored from URL fragment after Google OAuth (PR #1)
- Google OAuth returns `access_token` + `refresh_token` in `window.location.hash` (`#access_token=...`). The app didn't parse the fragment, leaving the session unhydrated and stalling on `/auth`.
- **Fix**: added explicit hash-token handling in `Auth.tsx` activated when `?oauth=google` and user is not yet hydrated. Reads `access_token`/`refresh_token` from `window.location.hash`, calls `setSessionFromTokens(...)` from auth context, clears hash via `history.replaceState`.

### Fixed — OAuth `redirectTo` causing hard-404 on SPA (PR #2)
- `redirectTo: '/auth'` caused the OAuth provider to redirect to `/auth`, which returned HTTP 404 from origin (SPA shell not served for direct navigation).
- **Fix**: changed `redirectTo` to `/` (root, always served by static hosts). Post-login navigation handled on the landing page: once `session` + `?oauth=google` is present, navigates to the `redirect` target (default `/app`).
- Fragment-based session restoration centralized in `AuthProvider` (`useAuth.tsx`): processes `#access_token` at app bootstrap and clears the URL fragment immediately.

---

## 2026-05-04 — SPA routing hardening + Auth page world-class redesign

### Fixed — SPA 404 at /auth (P0 production incident)
- **Root cause**: Cloudflare proxying to origin without Pages-level SPA fallback. Direct navigation to `/auth` returned HTTP 404 plain-text from origin.
- `public/_redirects`: normalised to single-space format (`/*  /index.html  200`) for maximum Cloudflare Pages / Netlify compatibility.
- `public/_headers`: added security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) and correct cache directives (`no-cache` for `index.html`, `immutable` for hashed assets).
- `public/404.html`: existing SPA redirect script confirmed correct — captures full path + query + hash into `sessionStorage` and redirects to `/?r=...`; `SpaRedirectHandler` in `App.tsx` restores the route.

### Enhanced — `src/pages/Auth.tsx` — Auth page architectural redesign
- **Trust badge row** (6 badges): GDPR-kompatibilis, ISO 27001 elvek, Enterprise Ready, 99.9% Uptime SLA, RLS adatelérés, Top SaaS 2026. Colour-coded icon cards with `whileInView` entrance animations.
- **Comparison matrix** ("Hagyományos eszközök vs. Effectime"): 6-row table with `X`/`Check` icons comparing setup time, approval flow, capacity view, leave balance, audit trail, mobile access. Zero Lorem Ipsum — all copy grounded in actual changelog capabilities.
- **FAQ expanded**: 3 → 6 professional Q&A items covering daily utility, enterprise structure, smart scheduling wizard, approval customisation, mobile access, and data security.
- **Calendar mockup legend**: colour legend row added (Elérhető / Szabadság / Betegszabadság).
- **Workflow step arrows**: `ArrowRight` connector between cards on desktop.
- **Feature callout pills**: three labelled pills below calendar section copy (Csapatnaptár, Éves nézet, Valós idejű).
- **Footer**: Terms, Privacy, Support links added.
- **Micro-interactions**: button hover lift (`hover:-translate-y-0.5`) and shadow-glow on primary CTA; Google button lift on hover; input `focus-visible:ring-primary`.
- All authentication logic preserved without modification (sign-in, sign-up, OTP verify, forgot-password, Google OAuth, email-activation callback).

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

## 2026-05-05 — Enterprise role/category/skill catalog foundation (inventory + workspace overrides)
- Új adatmodell bevezetve a munkakategória → munkakör → skill kapcsolatokhoz, külön ID-alapú entitásokkal és deduplikált skill-kezeléssel.
- Új globális inventory táblák: `enterprise_catalog_categories`, `enterprise_catalog_roles`, `enterprise_catalog_skills`, `enterprise_catalog_role_skills`.
- Új cégszintű testreszabható réteg: `enterprise_workspace_role_categories`, `enterprise_workspace_roles`, `enterprise_workspace_skills`, `enterprise_workspace_role_skills`.
- `enterprise_memberships` bővítve `business_role_id` mezővel (FK a workspace role táblára), így a meglévő szöveges `business_role` mellett ID-alapú kötés is elérhető.
- Experience/szenioritás bevezetve `enterprise_experience_level` enumon keresztül, szerep-skill elvárásokon használható (`min_experience_level`).
- RLS policy-k, indexek és `updated_at` triggerek hozzáadva a karbantartható, multi-tenant működéshez.
