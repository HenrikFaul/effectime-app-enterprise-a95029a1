================================================================================
EFFECTIME ENTERPRISE — MASTER BUG-FIX & QUALITY ASSURANCE EXECUTION PROMPT
Version: 2026-05-17 | Branch: claude/analyze-repo-structure-dE8F4
Repo: HenrikFaul/effectime-app-enterprise-a95029a1
Supabase Project: oezlzzmzzvbvinuysxaz
================================================================================
Te egy elit principal software architect, senior full-stack engineer, staff-level
debugging specialist, production reliability engineer, backend integrity expert,
QA stratégista, release safety reviewer és technical documentation steward vagy
— egy ügynökben. A te feladatod az Effectime Enterprise alkalmazás összes ismert
és feltárt hibájának szisztematikus javítása.
================================================================================
KÖTELEZŐ OLVASÁSI SORREND — MINDEN SESSION ELEJÉN, KIHAGYÁS NÉLKÜL
================================================================================
MIELŐTT EGY SOR KÓDOT ÍRNÁL, olvasd el ebben a sorrendben:
1. /home/user/effectime-app-enterprise-a95029a1/AI_EXECUTION_PROMPTS.md
   → A teljes fejlesztési governance szabályrendszer. Az engineering workflow
     (REQUEST UNDERSTANDING → CURRENT-STATE COMPARISON → GAP ANALYSIS →
     IMPLEMENTATION PLAN → IMPLEMENTATION → VERIFICATION → DOCUMENTATION →
     PR → MERGE) kötelező. Soha ne ugorj a "IMPLEMENTATION" fázisba a
     korábbi fázisok elvégzése nélkül.
2. /home/user/effectime-app-enterprise-a95029a1/codingLessonsLearnt.md
   → Az összes dokumentált hibaminta [HIBA-001]–[HIBA-079+]. MINDEN egyes
     releváns leckét meg kell vizsgálni az aktuális feladathoz. Az itt leírt
     hibákat TILOS megismételni. Ha új hibát találsz, azonnal appendeld.
3. /home/user/effectime-app-enterprise-a95029a1/CHANGELOG.md
   → Az összes befejezett feature listája. Ezeket REGRESSZÁLNI TILOS.
     Mielőtt bármit implementálsz, ellenőrizd: nem rontja-e el a CHANGELOG-ban
     már kész feature-t? A legfelső bejegyzésből vedd a következő verziószámot.
4. /home/user/effectime-app-enterprise-a95029a1/.governance/controller.md
5. /home/user/effectime-app-enterprise-a95029a1/.governance/agent_execution_rules.md
6. /home/user/effectime-app-enterprise-a95029a1/.governance/ui_ux_rules.md
   (UI érintésekor kötelező)
7. A legújabb versioning/*.md fájlok:
   - versioning/17052606_v3.41.2_bugfix-open-shift-409-office-dialog-assigned-badge.md
   - versioning/17052605_v3.41.1_bugfix-office-click-avail-batch.md
   - versioning/17052604_v3.41.0_unified-employee-calendar.md
   (Ezek összefoglalják mi változott a legutóbbi releaseekben)
8. /home/user/effectime-app-enterprise-a95029a1/AI_PROMPTING_FOLDERSTRUCTURE/SYSTEM.md
   és a releváns alkönyvtárak (frontend/, backend/, qa/, localization_controller.md)
================================================================================
GIT ÁLLAPOT ELLENŐRZÉS — MINDEN SESSION ELSŐ LÉPÉSE
================================================================================
KÖTELEZŐ LÉPÉSEK session indításakor:
```bash
git fetch origin main
git rebase origin/main   # ha sikertelen: git stash → rebase → stash pop
git status               # győződj meg: working tree clean
git log --oneline -5     # ellenőrizd a legutóbbi commitokat
Ha uncommitted changes vannak:

Értsd meg mi változott és miért
Ne fedd el a problémát git stash -u-val ha nem szükséges
Mindig commit előtt: npx tsc --noEmit → 0 hiba kell
Jelenleg aktív fejlesztési branch: claude/analyze-repo-structure-dE8F4
Push mindig erre a branchre: git push -u origin claude/analyze-repo-structure-dE8F4

================================================================================
ISMERT BUGOK ÉS JAVÍTÁSI CHECKLIST (2026-05-17 állapot)
Az alábbi lista az összes ismert hibát tartalmazza. Minden tételt ellenőrizz,
és ha nincs javítva, javítsd. Ha javítva van (KÉSZ), regredzsziótesztet végezz.

────────────────────────────────────────────────────────────────────────────────
BUG-001: create_open_shift_request → HTTP 409 Conflict
────────────────────────────────────────────────────────────────────────────────
Státusz: JAVÍTVA (v3.41.2) — DE ELLENŐRIZD!

Leírás: Két overload élt a DB-ben, mindkettő all-default paraméterekkel →
PostgREST "ambiguous function call" → HTTP 409.

Ellenőrzés SQL:

SELECT p.proname, pg_get_function_arguments(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'create_open_shift_request';
Elvárt eredmény: CSAK EGY sor, a 10-paraméteres verzió.
Ha két sor van: alkalmazd a migrációt.

Migration fájl: supabase/migrations/20260517220000_v3_41_2_drop_old_create_open_shift_overload.sql
Supabase apply: mcp__755b29e0__apply_migration vagy Supabase MCP tool

Frontend hiba kezelés (src/components/enterprise/calendar/OpenShiftManager.tsx):

A catch blokk jelenleg generikus t('open_shifts.post_error') üzenetet mutat
Javítani kell: ha az error üzenet tartalmaz specifikus kódot (already_exists,
not_authorized, stb.), mutasson megfelelő lokalizált üzenetet
Ellenőrizd a useCreateOpenShift hook-ot is (src/hooks/useOpenShifts.ts)
────────────────────────────────────────────────────────────────────────────────
BUG-002: OfficeEditorDialog — dialog méret, responsive megjelenítés
────────────────────────────────────────────────────────────────────────────────
Státusz: JAVÍTVA (v3.41.2) — max-w-3xl w-full

Ellenőrizd:

src/components/enterprise/OfficeEditorDialog.tsx: DialogContent className
tartalmaz-e "max-w-3xl w-full"-t?
Mobile nézetben (375px széles viewport): a form mezők látszanak-e?
Tablet nézetben (768px): az opening hours grid rendesen jelenik-e meg?
Ha a dialog még mindig szűk: növeld max-w-4xl-re és adj padding-ot
Responsive checklist OfficeEditorDialog-ban:
□ Name/City/Address grid: col-span-3 sm:col-span-1 → OK?
□ Email/Phone/Manager/Deputy grid: grid-cols-2 gap-3 → OK mobilon?
□ Opening hours: grid-cols-[80px_1fr_1fr_auto] → OK kis képernyőn?
Ha nem: grid-cols-1 sm:grid-cols-[80px_1fr_1fr_auto]
□ Equipment add form: grid-cols-2 gap-2 → OK?
□ Min staffing add form: grid-cols-2 gap-2 → OK?
□ ScrollArea max-h-[70vh] → elég magas a dialog mobilon?

────────────────────────────────────────────────────────────────────────────────
BUG-003: EmployeeMonthView — "Beosztva" badge nem látható
────────────────────────────────────────────────────────────────────────────────
Státusz: JAVÍTVA (v3.41.2) — orange badge hozzáadva

Ellenőrizd:

src/components/enterprise/time-attendance/EmployeeMonthView.tsx
A siteForDay változó létezik-e a naptár cella renderelés blokkjában?
Az orange badge megjelenik-e enterprise_shift_assignments bejegyzés esetén?
A badge szövege: t('attendance.assigned_badge') → "Beosztva" (hu)
A badge kiemelkedik-e vizuálisan az availability jelzőktől?
Esetleges továbbfejlesztés (ha az alap badge kész):
□ A badge kattintható legyen → nyissa meg a DayEditorDialog readonly módban
□ Tooltip: "Beosztva: [office neve] — [shift típusa]"
□ Legenda sor alján: "Beosztva (narancssárga) = vezető beosztott erre a napra"

────────────────────────────────────────────────────────────────────────────────
BUG-004: BatchFillDialog — üres SelectItem crash (Radix UI)
────────────────────────────────────────────────────────────────────────────────
Státusz: JAVÍTVA (v3.41.1) — none sentinel

Ellenőrizd:

src/components/enterprise/time-attendance/BatchFillDialog.tsx
NINCS <SelectItem value=""> sehol a fájlban
Az office selector value="__none__" sentinelt használ
A batch kitöltés dialog megnyílik napok húzással-kijelöléssel (drag-select)?
A "Telephely" select működik → megjelenik az irodák listája?
A batch kitöltés után az irodanevek megjelennek a naptár cellákon?
Teljes drag-select flow teszt:

Saját idő tab → szerkesztési mód (ceruza ikon)
Több nap húzással kijelölése
BatchFillDialog megnyílik → NEM crash
Telephely kiválasztás → irodák listája megjelenik
Kitöltés → szegmensek + telephely hozzárendelés
────────────────────────────────────────────────────────────────────────────────
BUG-005: WorkspaceDashboard → WorkspaceSettings — highlightOfficeId scope hiba
────────────────────────────────────────────────────────────────────────────────
Státusz: JAVÍTVA (v3.41.2 / OfficeEditorDialog refactor)

A highlightOfficeId state eltávolításra került, helyette plannerOfficeId +
plannerOfficeDialogOpen state vezérli az OfficeEditorDialog megnyitását.

Ellenőrizd:

WorkspaceDashboard.tsx: nincs highlightOfficeId referencia WorkspaceSettings-ben
WorkspaceSettings function signature: nincs highlightOfficeId prop
CoveragePlannerView-ban office névre kattintva: OfficeEditorDialog nyílik fel
(NEM a settings tab-ra navigál)
OfficeEditorDialog megnyílik a megfelelő iroda adataival betöltve
Az OfficeManager a beállítások tab-ban továbbra is működik (önállóan)
────────────────────────────────────────────────────────────────────────────────
BUG-006: EmployeeMonthView — availability toggle nem működött munkanapokon
────────────────────────────────────────────────────────────────────────────────
Státusz: JAVÍTVA (v3.41.1)

canToggleAvail volt: !canEdit && !daySegs.length && !hasOncall && !!userId && !!membershipId
Most: !canEdit && !!userId && !!membershipId

Ellenőrizd:

Saját idő tab → NEM szerkesztési módban: minden napra kattintva ciklus
null → available → preferred → unavailable → null
Munkanapokon (8.0h + 09:00-17:00 van bejegyezve) is működik-e a kattintás?
A kattintás NEM nyitja meg a DayEditorDialog-ot (csak admin módban nyílik)
A supabase enterprise_staff_availability tábla frissül?
────────────────────────────────────────────────────────────────────────────────
BUG-007: claim_open_shift — generikus "Nem sikerült" hiba
────────────────────────────────────────────────────────────────────────────────
Státusz: JAVÍTVA (v3.41.0)

Frontend: src/components/shift-marketplace/OpenShiftPanel.tsx
A handleClaim catch blokk most specifikus üzeneteket mutat:

already_assigned: "Ezen a napon már van beosztásod"
request_not_open: "Ez a műszak már be van töltve"
not_member: "Nem vagy aktív tagja ennek a munkaterületnek"
not_authenticated: "Lejárt a munkamenet, kérjük jelentkezz be újra"
request_not_found: "Ez a műszak már nem létezik"
Ellenőrizd: a fenti összes eset le van kezelve, NEM generikus hibaüzenettel.

DB: supabase/migrations/20260517210000_v3_41_0_fix_claim_open_shift.sql
A claim_open_shift RPC: van-e already_assigned guard?

SELECT * FROM pg_proc WHERE proname = 'claim_open_shift';
────────────────────────────────────────────────────────────────────────────────
BUG-008: AvailabilityCalendar — duplikálás megszűnt
────────────────────────────────────────────────────────────────────────────────
Státusz: JAVÍTVA (v3.41.0)

Az EmployeeDashboard-ból eltávolítva az AvailabilityCalendar import és JSX.
Az EmployeeMonthView most kezeli az availability-t is.

Ellenőrizd:

src/components/enterprise/self-service/EmployeeDashboard.tsx: nincs
AvailabilityCalendar import és nincs <AvailabilityCalendar ... /> JSX
Az "Elérhetőség" (availability) csak a "Saját idő" naptárban jelenik meg
Az "Upcoming schedule" kártya megjelenik (legközelebbi 14 nap beosztásai)
================================================================================
SZISZTEMATIKUS ELLENŐRZÉSI WORKFLOW — FUTTASD EBBEN A SORRENDBEN
FÁZIS 1: ADATBÁZIS ÁLLAPOT ELLENŐRZÉS
─────────────────────────────────────

Használd a Supabase MCP toolokat (project_id: oezlzzmzzvbvinuysxaz):

1.1 Function overload check:

SELECT p.proname, pg_get_function_arguments(p.oid) AS args, p.prosecdef
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND p.proname IN (
    'create_open_shift_request', 'claim_open_shift',
    'attendance_upsert_site_assignment', 'attendance_remove_site_assignment',
    'cancel_open_shift_request', 'join_open_shift_waitlist'
  )
ORDER BY p.proname, p.oid;
Elvárt: minden function pontosan 1 overloaddal rendelkezik.
Ha 2+ overload: DROP a régebbi(ke)t.

1.2 Critical table constraints:

SELECT table_name, constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name IN (
    'enterprise_shift_assignments',
    'enterprise_staff_availability',
    'enterprise_open_shift_requests',
    'enterprise_open_shift_claims'
  )
ORDER BY table_name, constraint_type;
1.3 Migrations alkalmazva:

SELECT name, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY inserted_at DESC
LIMIT 20;
Elvárt migrations (legújabb 5):

20260517220000_v3_41_2_drop_old_create_open_shift_overload
20260517210000_v3_41_0_fix_claim_open_shift
20260517200000_v3_40_0_structured_open_shifts
20260517100000_v3_39_2_cancel_open_shift_rpc
20260516152607_v3_39_0_smart_staffing_workflow
1.4 RPC permissions:

SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND grantee = 'authenticated'
  AND routine_name IN (
    'create_open_shift_request', 'claim_open_shift',
    'attendance_upsert_site_assignment'
  );
FÁZIS 2: TYPESCRIPT FORDÍTÁS ELLENŐRZÉS
────────────────────────────────────────

cd /home/user/effectime-app-enterprise-a95029a1
npx tsc --noEmit 2>&1
Elvárt: üres output (0 error, 0 warning).
Ha hiba van: azonnal javítsd, MIELŐTT bármit commitsz.

Leggyakoribb TypeScript hibák ebben a projektben:

"Property X does not exist on type Y" → komponens props frissítés szükséges
"Cannot find name X" → import hiányzik vagy scope probléma (lásd HIBA-078)
"Type string is not assignable to type X" → i18n key typo
FÁZIS 3: I18N TELJESSÉGI ELLENŐRZÉS
─────────────────────────────────────

Minden új user-facing string KÖTELEZŐEN az összes 8 locale fájlban szerepel:

src/i18n/resources/en.ts
src/i18n/resources/hu.ts
src/i18n/resources/de.ts
src/i18n/resources/at.ts
src/i18n/resources/cs.ts
src/i18n/resources/sk.ts
src/i18n/resources/pl.ts
src/i18n/resources/ro.ts
Ellenőrző script (minden kulcsra):

for key in "attendance.assigned_badge" "batch_fill.office" "batch_fill.office_none"; do
  echo "=== $key ==="
  for f in src/i18n/resources/*.ts; do
    grep -l "$key" "$f" || echo "HIÁNYZIK: $f"
  done
done
Ellenőrizd az alábbi nemrég hozzáadott kulcsokat:

attendance.assigned_badge → "Beosztva" (hu) — v3.41.2
attendance.show_availability → "Elérhetőség" (hu) — v3.41.0
batch_fill.office, batch_fill.office_none — v3.41.1
open_shifts.already_assigned, open_shifts.not_authenticated — v3.41.0
self_service.schedule_title, self_service.schedule_empty, self_service.schedule_nav — v3.41.0
FÁZIS 4: KOMPONENS INTEGRITÁS ELLENŐRZÉS
──────────────────────────────────────────

4.1 OfficeEditorDialog (src/components/enterprise/OfficeEditorDialog.tsx):
□ Props: { workspaceId, officeId, open, onOpenChange, onSaved? }
□ officeId === null → new office mode
□ officeId !== null → fetch office by ID on open
□ DialogContent className: "max-w-3xl w-full"
□ ScrollArea: max-h-[70vh]
□ Összes Select: NINCS value="" (csak none vagy valós ID)
□ Összes input: placeholder szöveg i18n kulcsból

4.2 EmployeeMonthView (src/components/enterprise/time-attendance/EmployeeMonthView.tsx):
□ canToggleAvail: !canEdit && !!userId && !!membershipId (nincs !daySegs.length)
□ handleToggleAvailability: e.stopPropagation() van
□ availByDate Map: availability_date alapján indexelt
□ siteForDay: orange "Beosztva" badge mindig megjelenik
□ officeName: kék szöveg, displayConfig.site esetén jelenik meg
□ BatchFillDialog: workspaceId, membershipId, userId, offices propok átadva
□ Drag-select: handlePointerDown returns early ha !canEdit ✓

4.3 BatchFillDialog (src/components/enterprise/time-attendance/BatchFillDialog.tsx):
□ Props: open, onOpenChange, periodId, year, month, initialStart, initialEnd,
selectedDays, segments, onSaved, workspaceId, membershipId, userId, offices
□ selectedOfficeId initial state: 'none' (NEM '')
□ useEffect reset: setSelectedOfficeId('none')
□ apply(): if (selectedOfficeId !== 'none' && ...)
□ SelectItem values: 'none' vagy valós office.id (NINCS '')
□ upsertSiteAssignment hívás: minden workDay-re ha office ki van választva

4.4 WorkspaceDashboard (src/components/enterprise/WorkspaceDashboard.tsx):
□ highlightOfficeId STATE: NINCS (eltávolítva)
□ plannerOfficeId + plannerOfficeDialogOpen: VAN
□ handleNavigateToOffice: setPlannerOfficeId + setPlannerOfficeDialogOpen(true)
□ OfficeEditorDialog import: import { OfficeEditorDialog } from './OfficeEditorDialog'
□ OfficeEditorDialog JSX: workspaceId, officeId=plannerOfficeId, open=plannerOfficeDialogOpen
□ WorkspaceSettings call site: NEM kap highlightOfficeId propot
□ WorkspaceSettings function signature: NEM tartalmaz highlightOfficeId propot
□ CoveragePlannerView: onNavigateToOffice={handleNavigateToOffice} ✓

4.5 OfficeManager (src/components/enterprise/OfficeManager.tsx):
□ Összes inline dialog state ELTÁVOLÍTVA (form, hours, equipment, stb.)
□ OfficeEditorDialog import és használat
□ dialogOfficeId + dialogOpen state
□ openNew: setDialogOfficeId(null); setDialogOpen(true)
□ openEdit(office): setDialogOfficeId(office.id); setDialogOpen(true)
□ onSaved={fetchOffices} → lista frissül mentés után

FÁZIS 5: FUNKCIONÁLIS TESZT CHECKLIST
────────────────────────────────────────

5.1 KAPACITÁSTERVEZŐ — Office kattintás teszt:

Naptár tab → Kapacitástervező sub-tab
Bármely telephely nevére kattintás
ELVÁRT: OfficeEditorDialog felugrik az iroda adataival
TILOS: fehér képernyő / crash
TILOS: átnavigálás a Beállítások tab-ra
A szerkesztett adatok menthetők?
Mentés után az iroda listában frissülnek az adatok?
5.2 NYITOTT MŰSZAK MEGHIRDETÉSE:

Naptár tab → Kapacitástervező → bármely cella jobb oldala
"Nyitott műszak meghirdetése" gomb
Pozíció, készség, válaszidő kitöltése
ELVÁRT: Sikeres meghirdetés toast ("Műszak meghirdetve")
TILOS: 409 Conflict hiba
A meghirdetett műszak megjelenik az OpenShiftPanel-ben (dolgozói nézet)
Egy dolgozó jelentkezhet rá (claim_open_shift) → Beosztva megjelenik
5.3 SAJÁT IDŐ NAPTÁR — Elérhetőség toggle:

Saját idő tab (EmployeeMonthView)
NEM szerkesztési mód (nincs pencil icon aktív)
Bármely napra kattintás (akár munkanapon 8.0h-val)
ELVÁRT: Ciklus: null → Elérhető (zöld) → Preferált (kék) → Nem elérhető (piros) → null
Újra kattintás: következő állapot
A DB enterprise_staff_availability tábla frissül?
Más session-ből (reload) is megmarad az állapot?
5.4 BATCH KITÖLTÉS — Telephely hozzárendelés:

Saját idő tab → szerkesztési mód
Több nap drag-with-pointer kijelölése
BatchFillDialog megnyílik
Telephely selector megjelenik → irodák listája látható
Iroda kiválasztása
Kitöltés gomb → napok kitöltve + telephely hozzárendelve
Naptárban: "Beosztva" badge + iroda neve megjelenik
5.5 BEOSZTVA BADGE MEGJELENÉS:

Adminként: kapacitástervező → dolgozó hozzárendelése naphoz (office assignment)
Saját idő tab (employee view) → az a nap
ELVÁRT: Narancssárga "Beosztva" felirat a naptár cellán
Ha displayConfig.site ON: kék telephely név is megjelenik alatta
Ha displayConfig.site OFF: csak "Beosztva" látszik (telephely nélkül)
================================================================================
DOKUMENTÁCIÓS KÖTELEZETTSÉGEK — MINDEN BUGFIX UTÁN
MINDEN egyes javítás után kötelező:

CHANGELOG.md frissítés:
Legfelső bejegyzés a CHANGELOG-ban a legújabb verzió
Format: ## YYYY-MM-DD — vX.Y.Z Rövid leírás
Tartalom: mi változott, mi a root cause, milyen fájlok érintettek
I18n változások: "X új kulcs hozzáadva az összes 8 locale fájlhoz"
DB migration: migration fájlnév + alkalmazva: oezlzzmzzvbvinuysxaz
versioning/*.md fájl (kötelező minden PR-hoz):
Fájlnév: DDMMYYNNN_vX.Y.Z_feature-slug.md
Tartalom: Summary, Root cause, Files changed, DB migration, Test notes
marketing/marketing_values/*.md fájl (kötelező minden delivery-hez):
Fájlnév: YYYYMMDD_vX.Y.Z_feature-slug_marketing_value.md
Tartalom: Problem solved (user language), Personas, Marketing claims,
Content angles, Marketing library files to update
Lásd: marketing/marketing_values/README.md a pontos formátumhoz
codingLessonsLearnt.md frissítés (ha új hibát találtál):
Azonnal appendeld a [HIBA-NNN] bejegyzést
Kötelező mezők: Dátum, Fájl, Hibaüzenet, Gyökérok, Javítás, Megelőzés
SOHA ne töröld a meglévő bejegyzéseket
================================================================================
COMMIT ÉS PUSH SZABÁLYOK
Commit előtt KÖTELEZŐ:
□ npx tsc --noEmit → 0 error
□ Összes érintett i18n kulcs mind a 8 locale-ban megvan
□ Nincs value="" SelectItem a Radix UI Select komponensekben
□ Nincs highlightOfficeId referencia WorkspaceSettings-ben
□ CHANGELOG.md frissítve
□ versioning/.md létrehozva
□ marketing/marketing_values/.md létrehozva (kivéve pure bugfix-nél nem kötelező,
de ajánlott)
□ codingLessonsLearnt.md frissítve ha új hiba

Commit message format:

type(vX.Y.Z): rövid leírás
- bullet: mit változtattam
- bullet: root cause ha bug fix
- bullet: i18n: X új kulcs, 8 locale
https://claude.ai/code/session_012smNer5BCuaxxBuQfLKMyh
Push:

git push -u origin claude/analyze-repo-structure-dE8F4
NE push-olj main-re direkt. NE force-push-olj. NE skip-eld a hook-okat.

================================================================================
KRITIKUS ANTI-REGRESSZIÓ LISTA — EZEKET NE TÖRD EL
A CHANGELOG alapján ezek az implementált és működő feature-ök.
Minden változtatás után ellenőrizd, hogy ezek MIND MŰKÖDNEK:

v3.41.0 (Unified Calendar):
□ claim_open_shift RPC: explicit already_assigned guard
□ EmployeeMonthView: availability toggle + color coding
□ EmployeeDashboard: Upcoming schedule kártya (14 nap)
□ AvailabilityCalendar: ELTÁVOLÍTVA az EmployeeDashboard-ból (ne add vissza!)

v3.41.1 (Bug fixes):
□ WorkspaceSettings: highlightOfficeId NEM referenciált (eltávolítva)
□ canToggleAvail: !canEdit && !!userId && !!membershipId (NINCS !daySegs.length)
□ BatchFillDialog: none sentinel (NINCS value="")

v3.41.2 (Bug fixes):
□ create_open_shift_request: csak 1 overload a DB-ben
□ OfficeEditorDialog: max-w-3xl w-full
□ "Beosztva" badge: megjelenik enterprise_shift_assignments esetén

v3.40.0 (Structured Open Shifts):
□ OpenShiftManager: position picker, multi-skill, top-3 candidates
□ Waitlist: join_open_shift_waitlist RPC
□ Escalation: respond_by_at, timeout_hours
□ Notifications: csak role/skill-matching membereknek megy értesítés

v3.39.x (Smart Staffing):
□ enterprise_staff_availability tábla és RPC-k
□ OpenShiftPanel: claim-elhető műszakok listája
□ cancel_open_shift_request RPC

================================================================================
ISMERT TÖRÉKENYSÉGEK ÉS FIGYELÉSI PONTOK
RADIX UI SELECT — ÜRES STRING TILALMA (HIBA-077):
SOHA ne adj value="" egy SelectItem-nek
Mindig használj none sentinelt a "nincs kiválasztva" állapothoz
Ellenőrző script:
grep -rn 'SelectItem value=""' src/
Elvárt: üres output (0 találat)
FUNCTION OVERLOAD AMBIGUITY (HIBA-079):
Ha egy DB függvény signatúráját módosítod: DROP a régit UGYANABBAN a migrációban
Ellenőrző script a session elején:
SELECT proname, count(*) as overload_count
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
GROUP BY proname HAVING count(*) > 1
ORDER BY proname;
Elvárt: csak olyan függvények jelennek meg, amelyeknek SZÁNDÉKOSAN van több overloadja.
TOP-LEVEL COMPONENT SCOPE (HIBA-078):
Ha egy funkcióból/state-ből top-level (nem closure) komponenst csinálsz:
az összes szükséges state propként kell átadni
Ellenőrizd: van-e propként átadva minden amit a child komponens használ?
SECURITY DEFINER RPC-K:
claim_open_shift: SECURITY DEFINER ✓
attendance_upsert_site_assignment: SECURITY DEFINER ✓
attendance_remove_site_assignment: SECURITY DEFINER ✓
create_open_shift_request: SECURITY DEFINER ✓
Ha bármelyik elveszíti SECURITY DEFINER státuszát → RLS blokkolni fogja
WORKSPACE SCOPING:
Minden DB query tartalmaz WHERE workspace_id = ? feltételt
Soha ne adj vissza más workspace adatait
RLS policy-k ellenőrzése: minden tábla ENABLE ROW LEVEL SECURITY?
================================================================================
SPECIFIKUS KÓDMINTÁK — KÖTELEZŐ SABLONOK
A. Új i18n kulcs hozzáadásakor (MINDEN 8 locale-ba):

en.ts:  kulcs: 'English text',
hu.ts:  kulcs: 'Magyar szöveg',
de.ts:  kulcs: 'Deutscher Text',
at.ts:  kulcs: 'Österreichischer Text',
cs.ts:  kulcs: 'Český text',
sk.ts:  kulcs: 'Slovenský text',
pl.ts:  kulcs: 'Polski tekst',
ro.ts:  kulcs: 'Text românesc',
B. Supabase SELECT komponens (Radix UI):

// HELYES:
const [val, setVal] = useState<string>('__none__');

<Select value={val} onValueChange={setVal}>
  <SelectTrigger><SelectValue placeholder={t('...')} /></SelectTrigger>
  <SelectContent>
    <SelectItem value="__none__">{t('..._none')}</SelectItem>
    {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
  </SelectContent>
</Select>

// TILOS:
const [val, setVal] = useState<string>(''); // ← TILOS
<SelectItem value="">...</SelectItem>        // ← TILOS
C. DB migration új function vagy módosított function esetén:

-- KÖTELEZŐ: régi overload törlése ha signatúra változott
DROP FUNCTION IF EXISTS public.function_name(old_param_types);

-- Majd az új function:
CREATE OR REPLACE FUNCTION public.function_name(...)
...

-- Grant:
GRANT EXECUTE ON FUNCTION public.function_name(...) TO authenticated;
D. Top-level component state prop átadás:

// HELYES:
function WorkspaceDashboard(...) {
  const [myState, setMyState] = useState<string | null>(null);
  
  return (
    <ChildComponent myState={myState} />  // ← propként átadva
  );
}

function ChildComponent({ myState }: { myState: string | null }) {
  // myState itt elérhető
}

// TILOS:
function ChildComponent() {
  // myState itt NEM érhető el, még ha WorkspaceDashboard-ban van is definálva
  return <div className={myState ? '...' : ''}></div>; // ← ReferenceError!
}
================================================================================
VERSIONING POLICY
Jelenlegi verzió: v3.41.2 (2026-05-17)
Következő verzió: v3.41.3 (bugfix) VAGY v3.42.0 (feature)

Verzió számozás szabályai:

MAJOR (X.0.0): architektúrális változás, breaking change
MINOR (X.Y.0): új feature, új UX funkció
PATCH (X.Y.Z): bugfix, teljesítmény, i18n kiegészítés
Minden commit:

Meghatározza a verziót (ne duplikáld a meglévőt!)
Létrehoz versioning/DDMMYYNNN_vX.Y.Z_slug.md fájlt
Frissíti CHANGELOG.md-t (legfelülre)
MIELŐTT verziót adsz: olvasd el a CHANGELOG.md tetejét!

head -5 /home/user/effectime-app-enterprise-a95029a1/CHANGELOG.md
================================================================================
SUPABASE MCP TOOL HASZNÁLAT
A Supabase MCP tools elérhetők, project_id: oezlzzmzzvbvinuysxaz

Ellenőrzésre (read-only, biztonságos):

execute_sql: SELECT lekérdezések a DB állapothoz
list_migrations: alkalmazott migrációk listája
get_logs: Supabase funkciók logjai (Edge Functions, PostgREST)
Módosításra (óvatosan!):

apply_migration: DDL operációk (CREATE, ALTER, DROP TABLE/FUNCTION)
→ CSAK új migration SQL fájl alapján
→ A migration fájl is legyen commitolva a repóba
NE használd execute_sql-t DDL-re (CREATE TABLE, ALTER, DROP) — mindig
apply_migration-t használj és commit a migration fájlt a repóba.

================================================================================
ZÁRÓ ELLENŐRZÉSI LISTA — DELIVERY ELŐTT
□ npx tsc --noEmit → 0 error
□ Összes BUG-001..008 státusz: ELLENŐRIZVE / KÉSZ
□ Nem regredzsált semmit a CHANGELOG anti-regression listából
□ CHANGELOG.md: legfelső entry = legújabb verzió
□ versioning/.md létrehozva az összes változáshoz
□ marketing/marketing_values/.md létrehozva (ha feature)
□ codingLessonsLearnt.md: minden új hiba dokumentálva
□ Összes i18n kulcs mind a 8 locale-ban jelen van
□ Nincs SelectItem value="" sehol
□ Nincs highlightOfficeId a WorkspaceSettings-ben
□ DB: csak 1 create_open_shift_request overload
□ DB: minden migration alkalmazva (list_migrations ellenőrzés)
□ Git: commit + push a claude/analyze-repo-structure-dE8F4 branch-re
□ Git: working tree clean (git status)

================================================================================
