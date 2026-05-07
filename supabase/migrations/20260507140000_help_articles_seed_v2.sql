-- Help articles seed v2 — fills the 7 mandatory topics missing from the v1 seed:
-- time-entry, onboarding-template, agile-kanban, agile-scrum, agile-gantt,
-- jira-integration, export-center.
-- Uses INSERT … ON CONFLICT DO NOTHING so re-running and regenerator upserts are safe.

INSERT INTO public.help_articles
  (topic_key, locale, title, summary, body_md, route, anchor_id, taxonomy,
   tags, synonyms, related_topics, is_system_generated, is_active,
   source_release_tag, last_generated_at)
VALUES

-- ══════════════════════════════════════════════════════════
-- TIME ENTRY  (general leave-request submission context)
-- ══════════════════════════════════════════════════════════
('time-entry', 'en', 'Submitting a Leave Request',
 'How to submit, edit, and cancel a time-off or absence request in Effectime.',
$$## Where to find it
**Workspace → Requests tab** (the tab labelled "Kérelmek" in Hungarian).

## What it does
The leave request form lets you record any planned absence — vacation, sick leave,
unpaid leave, or a custom type configured by your admin. Once submitted the request
enters the approval chain and appears in your manager's inbox.

## How to use it
1. Open your workspace and click the **Requests** tab.
2. Click **New request** (or the + button).
3. Select the **leave type** from the dropdown (types are defined by your admin).
4. Choose a **start date** and **end date** using the calendar pickers.
5. Optionally add a **note**, pick a **substitute**, and attach a file.
6. Click **Check** — the system runs the conflict engine and shows any blocking or
   warning issues (overlapping holidays, blocked dates, max-absent limits).
7. If there are no blocking conflicts, click **Submit**. The request status changes
   to **Pending**.

## Common actions
- **Check** — validates dates against workspace rules before submitting.
- **Submit** — sends the request into the approval chain.
- **Cancel request** — available on pending requests from the Requests list.
- **Private toggle** — hides the request note from approvers (details stay private).
- **Substitute picker** — assign a colleague to cover your responsibilities.

## Troubleshooting
- *"Blocked date"* error: the selected range overlaps a workspace-blocked date or public holiday.
- *"Max absent"* warning: too many team members are already on leave on those days.
- You can still submit a request with warnings; blocking errors must be resolved first.

## Related
- Approval Flow
- Leave Calendar
- Quota Manager
$$,
'/enterprise', 'leave-request', 'workflow',
ARRAY['leave','time-off','request','absence','vacation','sick'],
ARRAY['time entry','absence request','leave form'],
ARRAY['approval-flow','workspace-calendar','quota-manager'],
false, true, 'v3.2.2', now()),

('time-entry', 'hu', 'Távolléti kérelem beadása',
 'Hogyan küldhetsz be, szerkeszthetsz és vonhatsz vissza távolléti kérelmet az Effectime-ban.',
$$## Hol találod
**Munkaterület → Kérelmek fül.**

## Mit csinál
A távolléti kérelem űrlap lehetővé teszi bármely tervezett hiányzás rögzítését — szabadság,
betegszabadság, fizetés nélküli szabadság, vagy az admin által konfigurált egyéni típus.
Beküldés után a kérelem a jóváhagyási láncba kerül és megjelenik a vezető bejövőjében.

## Hogyan használd
1. Nyisd meg a munkaterületet és kattints a **Kérelmek** fülre.
2. Kattints az **Új kérelem** (vagy +) gombra.
3. Válaszd ki a **távolléttípust** a legördülőből (az admin konfigurálja a típusokat).
4. Válassz **kezdő** és **befejező dátumot** a naptárból.
5. Opcionálisan adj meg **megjegyzést**, válassz **helyettest** és csatolj fájlt.
6. Kattints az **Ellenőrzés** gombra — a rendszer lefuttatja az ütközésvizsgálatot
   és megmutatja a tiltó vagy figyelmeztető problémákat.
7. Tiltó ütközés hiányában kattints a **Beküldés** gombra. A kérelem státusza
   **Függőben** lesz.

## Gyakori műveletek
- **Ellenőrzés** — dátumok validálása a munkaterület szabályaival szemben.
- **Beküldés** — kérelem elküldése a jóváhagyási láncba.
- **Visszavonás** — elérhető függő kérelmeken a Kérelmek listából.
- **Privát kapcsoló** — elrejti a megjegyzést a jóváhagyók elől.
- **Helyettesítő választó** — kollégát jelölhetsz ki a hiányzásod idejére.

## Hibaelhárítás
- *"Tiltott nap"* hiba: a kiválasztott időszak tiltott napra vagy ünnepnapra esik.
- *"Maximális hiányzók"* figyelmeztetés: túl sok csapattag van szabadságon.
- Figyelmeztetéssel is beküldheted a kérelmet; tiltó hibákat előbb fel kell oldani.

## Kapcsolódó
- Jóváhagyási folyamat
- Naptár
- Kvóta Kezelő
$$,
'/enterprise', 'leave-request', 'workflow',
ARRAY['kérelem','szabadság','hiányzás','betegszabadság'],
ARRAY['távolléti kérelem','szabadságkérelem','kérelem beadása'],
ARRAY['approval-flow','workspace-calendar','quota-manager'],
false, true, 'v3.2.2', now()),

-- ══════════════════════════════════════════════════════════
-- ONBOARDING TEMPLATE
-- ══════════════════════════════════════════════════════════
('onboarding-template', 'en', 'Onboarding Templates',
 'Create structured onboarding playbooks with tasks, acknowledgements, training steps, and access requests.',
$$## Where to find it
**Workspace → Workflows tab → Onboarding Templates**.

## What it does
Onboarding Templates let admins define a repeatable, step-by-step onboarding plan for new team
members. Each template contains ordered steps of different types — tasks, reading assignments,
acknowledgements, training, exams, approvals, internal permission grants, and external access
requests. When an instance is started for a member, progress is tracked per step.

## How to use it
1. Go to **Workflows → Onboarding Templates**.
2. Click **New template** and enter a name and optional description.
3. Add steps using the **Add step** button. For each step choose:
   - **Type** (task / read / acknowledge / training / exam / approval / internal_permission / external_access)
   - **Title** and **description**
   - **Due offset** (days from start)
   - For `external_access` steps: select the target **access system**
4. Click **Publish** to make the template available for use.
5. To start onboarding for a member, go to **Onboarding Inbox** → **Start onboarding**.

## Common actions
- **Publish** — makes the template active for new instances.
- **Archive** — hides the template without deleting existing instances.
- **Add step** — appends a new step to the template.
- **Reorder steps** — drag handles reorder steps within the template.

## Troubleshooting
- A template must be **published** before it can be used to start onboarding instances.
- Archiving a template does not affect already-running instances.
- External access steps are linked to systems defined in **Settings → Access Systems**.

## Related
- Onboarding Inbox
- Access Request
- Approval Flow
$$,
'/enterprise', 'onboarding-template', 'feature',
ARRAY['onboarding','template','playbook','steps','workflow'],
ARRAY['onboarding playbook','new hire template','onboarding plan'],
ARRAY['access-request','approval-flow','workspace-workflows'],
false, true, 'v3.2.2', now()),

('onboarding-template', 'hu', 'Onboarding Sablonok',
 'Hozz létre strukturált onboarding playbookokat feladatokkal, hozzáférés-kérelmekkel és képzési lépésekkel.',
$$## Hol találod
**Munkaterület → Folyamatok fül → Onboarding Sablonok**.

## Mit csinál
Az Onboarding Sablonok lehetővé teszik az adminoknak, hogy ismételhető, lépésről-lépésre haladó
onboarding tervet hozzanak létre új csapattagok számára. Minden sablon különböző típusú lépéseket
tartalmaz — feladatok, olvasnivalók, elismerések, képzések, vizsgák, jóváhagyások, belső
jogosultság-kiosztások és külső hozzáférés-kérelmek. Amikor egy instanszot elindítanak egy
tagra, a haladás lépésenkénti nyomon követéssel zajlik.

## Hogyan használd
1. Nyisd meg a **Folyamatok → Onboarding Sablonok** részt.
2. Kattints az **Új sablon** gombra és adj meg nevet és opcionális leírást.
3. Adj hozzá lépéseket az **Lépés hozzáadása** gombbal. Minden lépésnél válaszd ki:
   - **Típust** (feladat / olvasás / elismerés / képzés / vizsga / jóváhagyás / belső_jogosultság / külső_hozzáférés)
   - **Titulus** és **leírás**
   - **Határidő** (napokban a kezdéstől)
   - `külső_hozzáférés` lépéseknél: cél **hozzáférési rendszer** kiválasztása
4. Kattints a **Publikálás** gombra a sablon elérhetővé tételéhez.
5. Onboarding indításához menj az **Onboarding Bejövő → Onboarding indítása** részhez.

## Gyakori műveletek
- **Publikálás** — aktívvá teszi a sablont új instanszokhoz.
- **Archiválás** — elrejti a sablont a meglévő instanszok érintése nélkül.
- **Lépés hozzáadása** — új lépés fűzése a sablonhoz.
- **Lépések átrendezése** — fogd és húzd kezelők a sorrend módosításához.

## Hibaelhárítás
- A sablon csak **publikált** állapotban használható instanszok indításához.
- Archiválás nem érinti a már futó instanszokat.
- Külső hozzáférés lépések a **Beállítások → Hozzáférési Rendszerek** részben definiált rendszerekhez kötődnek.

## Kapcsolódó
- Onboarding Bejövő
- Hozzáférés-kérelmek
- Jóváhagyási folyamat
$$,
'/enterprise', 'onboarding-template', 'feature',
ARRAY['onboarding','sablon','folyamat','lépések'],
ARRAY['onboarding playbook','felvételi sablon','belépési terv'],
ARRAY['access-request','approval-flow','workspace-workflows'],
false, true, 'v3.2.2', now()),

-- ══════════════════════════════════════════════════════════
-- AGILE — KANBAN
-- ══════════════════════════════════════════════════════════
('agile-kanban', 'en', 'Agile Kanban Board',
 'Visualise your Jira or Azure DevOps backlog as a Kanban board, grouped by issue status.',
$$## Where to find it
**Workspace → Resources → Agile tab → Kanban view**.

## What it does
The Kanban view loads issues from the connected Jira or Azure DevOps project and groups them
into columns by their current status. Each card shows the issue key, type chip (Bug, Story,
Task, Epic), assignee, story points, and priority. The board reads from the locally-cached
`enterprise_agile_issues` table so it stays available even when the external system is slow.

## How to use it
1. Open **Resources → Agile** and make sure a Jira or ADO integration is active.
2. Use the integration switcher to pick the connected project.
3. Click **Kanban** in the view selector.
4. Cards are arranged left-to-right from open → in-progress → done.
5. Click any card to see full issue details or open it in the source system.
6. Click **Sync** (Szinkron) to pull the latest issues from the external system.

## Common actions
- **Sync** — refreshes the issue cache from Jira or ADO.
- **Card click** — opens issue details (key, summary, assignee, labels, SP).
- **Integration switcher** — toggle between Jira and Azure DevOps if both are configured.

## Troubleshooting
- If the board is empty, run a manual sync or check the integration health badge in Settings.
- Status column names reflect the workflow stages defined in your Jira project.
- Issues without a status fallback to the leftmost column.

## Related
- Agile Scrum Board
- Agile Gantt Timeline
- Jira Integration
- Integration Health Center
$$,
'/enterprise', 'workspace.agile', 'feature',
ARRAY['kanban','board','agile','jira','issues','status'],
ARRAY['kanban board','issue board','status columns'],
ARRAY['agile-scrum','agile-gantt','jira-integration','workspace-agile'],
false, true, 'v3.2.2', now()),

('agile-kanban', 'hu', 'Agile Kanban Tábla',
 'Vizualizáld a Jira vagy Azure DevOps backlogot Kanban táblaként, issue-státusz szerinti oszlopokba rendezve.',
$$## Hol találod
**Munkaterület → Erőforrások → Agile fül → Kanban nézet**.

## Mit csinál
A Kanban nézet betölti a csatlakoztatott Jira vagy Azure DevOps projekt issue-jait és
jelenlegi státuszuk szerint oszlopokba rendezi őket. Minden kártya mutatja az issue kulcsát,
típusát (Hiba, Story, Feladat, Epic), felelősét, story pointjait és prioritását.
A tábla a helyi gyorsítótárból (`enterprise_agile_issues`) tölt, így külső rendszer lassúsága
esetén is elérhető marad.

## Hogyan használd
1. Nyisd meg az **Erőforrások → Agile** részt és győződj meg róla, hogy aktív integráció van beállítva.
2. Az integráció-váltóval válaszd ki a csatlakoztatott projektet.
3. Kattints a nézet-váltóban a **Kanban** opcióra.
4. A kártyák balról jobbra, nyitott → folyamatban → kész sorrendben jelennek meg.
5. Kattints bármelyik kártyára az issue részleteihez vagy a forrás rendszerben való megnyitáshoz.
6. Kattints a **Szinkron** gombra a legfrissebb issue-k lekéréséhez.

## Gyakori műveletek
- **Szinkron** — frissíti az issue gyorsítótárat Jirából vagy ADO-ból.
- **Kártya kattintás** — issue részletek megnyitása (kulcs, összefoglaló, felelős, labelek, SP).
- **Integráció-váltó** — Jira és Azure DevOps közötti váltás, ha mindkettő konfigurálva van.

## Hibaelhárítás
- Ha a tábla üres, futtass manuális szinkront vagy ellenőrizd az integráció állapotát a Beállításokban.
- Az oszlopnevek a Jira projektedben definiált workflow-lépéseket tükrözik.
- Státusz nélküli issue-k a bal szélső oszlopba kerülnek.

## Kapcsolódó
- Agile Scrum Tábla
- Agile Gantt Idővonal
- Jira Integráció
- Integrációs Állapotközpont
$$,
'/enterprise', 'workspace.agile', 'feature',
ARRAY['kanban','tábla','agile','jira','issue','státusz'],
ARRAY['kanban tábla','issue tábla','státusz oszlopok'],
ARRAY['agile-scrum','agile-gantt','jira-integration','workspace-agile'],
false, true, 'v3.2.2', now()),

-- ══════════════════════════════════════════════════════════
-- AGILE — SCRUM
-- ══════════════════════════════════════════════════════════
('agile-scrum', 'en', 'Agile Scrum Board',
 'View your sprint backlog grouped by sprint and status, with per-sprint story point totals.',
$$## Where to find it
**Workspace → Resources → Agile tab → Scrum view**.

## What it does
The Scrum view organises issues in a two-level hierarchy: first by sprint name, then by status
within each sprint. Each sprint header shows a count of tickets and the total story points.
This lets you see at a glance how loaded each sprint is and what stage the work is in.

## How to use it
1. Open **Resources → Agile** and select your connected project.
2. Click **Scrum** in the view selector.
3. Expand or collapse individual sprints using the sprint header.
4. Review per-status columns inside each sprint to see issue distribution.
5. Click **Sync** to refresh from Jira or ADO.

## Common actions
- **Sync** — pulls the latest sprint data from the external system.
- **Sprint header** — shows sprint name, ticket count, and total story points.
- **Status grouping** — issues within a sprint are colour-coded by status.

## Troubleshooting
- Issues without a sprint assigned appear in an "Unassigned sprint" group.
- Sprint names are pulled directly from the Jira `sprint_name` field; custom sprint
  naming in Jira is respected automatically.

## Related
- Agile Kanban Board
- Agile Gantt Timeline
- Capacity Fit (sprint vs. leave overlap)
$$,
'/enterprise', 'workspace.agile', 'feature',
ARRAY['scrum','sprint','board','agile','story points'],
ARRAY['scrum board','sprint board','sprint view'],
ARRAY['agile-kanban','agile-gantt','workspace-agile'],
false, true, 'v3.2.2', now()),

('agile-scrum', 'hu', 'Agile Scrum Tábla',
 'Sprint backlog megtekintése sprint és státusz szerint csoportosítva, sprint szintű story point összesítőkkel.',
$$## Hol találod
**Munkaterület → Erőforrások → Agile fül → Scrum nézet**.

## Mit csinál
A Scrum nézet kétszintű hierarchiában rendezi az issue-kat: először sprint neve szerint,
majd az egyes sprinteken belül státusz szerint. Minden sprint fejléce mutatja a jegyek
számát és a story pointok összegét. Így gyorsan láthatod, mennyire terhelt az egyes sprint
és milyen fázisban van a munka.

## Hogyan használd
1. Nyisd meg az **Erőforrások → Agile** részt és válaszd ki a csatlakoztatott projektet.
2. Kattints a nézet-váltóban a **Scrum** opcióra.
3. Nyisd ki vagy csukd be az egyes sprinteket a sprint fejléc segítségével.
4. Tekintsd meg a státusz-csoportosítást az egyes sprinteken belül.
5. Kattints a **Szinkron** gombra a frissítéshez.

## Gyakori műveletek
- **Szinkron** — legfrissebb sprint adatok lekérése a külső rendszerből.
- **Sprint fejléc** — sprint neve, jegyek száma és story point összeg.
- **Státusz csoportosítás** — a sprinten belüli issue-k státusz szerint színkódolva.

## Hibaelhárítás
- Sprint nélküli issue-k egy "Hozzá nem rendelt sprint" csoportban jelennek meg.
- A sprint nevek közvetlenül a Jira `sprint_name` mezőjéből érkeznek.

## Kapcsolódó
- Agile Kanban Tábla
- Agile Gantt Idővonal
- Kapacitás Illesztés (sprint vs. távolléti átfedés)
$$,
'/enterprise', 'workspace.agile', 'feature',
ARRAY['scrum','sprint','tábla','agile','story point'],
ARRAY['scrum tábla','sprint tábla','sprint nézet'],
ARRAY['agile-kanban','agile-gantt','workspace-agile'],
false, true, 'v3.2.2', now()),

-- ══════════════════════════════════════════════════════════
-- AGILE — GANTT
-- ══════════════════════════════════════════════════════════
('agile-gantt', 'en', 'Agile Gantt Timeline',
 'See issue timelines as horizontal bars on a monthly grid, coloured by issue type.',
$$## Where to find it
**Workspace → Resources → Agile tab → Gantt view**.

## What it does
The Gantt view renders each issue as a horizontal bar on a month-by-month timeline driven
by the issue's `start_date` and `due_date`. Bars are colour-coded by type: Bug (red),
Epic (purple), Story (emerald), Task/other (sky blue). This helps you spot scheduling
conflicts, upcoming deadlines, and how work overlaps with planned team leave.

## How to use it
1. Open **Resources → Agile** and select your connected project.
2. Click **Gantt** in the view selector.
3. Scroll horizontally through the timeline to navigate months.
4. Hover over a bar to see the issue key, summary, type, and exact dates.
5. Cross-reference with the **Capacity Heatmap** to see leave overlap.

## Common actions
- **Horizontal scroll** — navigate forward or backward through months.
- **Type colour legend** — Bug=red, Epic=purple, Story=emerald, Task=sky.
- **Sync** — refresh issue dates from Jira or ADO.

## Troubleshooting
- Issues without `start_date` or `due_date` set in Jira will not appear on the Gantt.
  Set dates in Jira and run a sync.
- Very long epics may span many months; scroll right to see their end dates.

## Related
- Agile Kanban Board
- Agile Scrum Board
- Projects (internal project Gantt)
$$,
'/enterprise', 'workspace.agile', 'feature',
ARRAY['gantt','timeline','agile','dates','schedule'],
ARRAY['gantt chart','timeline view','project timeline'],
ARRAY['agile-kanban','agile-scrum','workspace-agile'],
false, true, 'v3.2.2', now()),

('agile-gantt', 'hu', 'Agile Gantt Idővonal',
 'Issue idővonalak megjelenítése vízszintes sávokként havi rácson, issue típus szerinti színkódolással.',
$$## Hol találod
**Munkaterület → Erőforrások → Agile fül → Gantt nézet**.

## Mit csinál
A Gantt nézet minden issue-t vízszintes sávként jelenít meg egy havi rácson, az issue
`start_date` és `due_date` mezői alapján. A sávok típus szerint színkódolva jelennek meg:
Hiba (piros), Epic (lila), Story (smaragd), Feladat/egyéb (ég kék). Ez segít az ütemezési
ütközések, közelgő határidők és a távolléti átfedések felismerésében.

## Hogyan használd
1. Nyisd meg az **Erőforrások → Agile** részt és válaszd ki a csatlakoztatott projektet.
2. Kattints a nézet-váltóban a **Gantt** opcióra.
3. Görgess vízszintesen az idővonalon a hónapok közötti navigáláshoz.
4. Vidd az egeret egy sáv fölé az issue kulcsának, összefoglalójának, típusának és pontos dátumainak megtekintéséhez.
5. Vesd össze a **Kapacitás Hőtérképpel** a távolléti átfedések érdekében.

## Gyakori műveletek
- **Vízszintes görgetés** — hónapok közötti navigálás előre vagy hátra.
- **Típus szín jelölés** — Hiba=piros, Epic=lila, Story=smaragd, Feladat=kék.
- **Szinkron** — issue dátumok frissítése Jirából vagy ADO-ból.

## Hibaelhárítás
- Jirában `start_date` vagy `due_date` nélküli issue-k nem jelennek meg a Gantt-on. Állítsd be a dátumokat Jirában, majd futtass szinkront.
- Nagyon hosszú epicek sok hónapon átnyúlhatnak; görgess jobbra a befejezési dátumhoz.

## Kapcsolódó
- Agile Kanban Tábla
- Agile Scrum Tábla
- Projektek (belső projekt Gantt)
$$,
'/enterprise', 'workspace.agile', 'feature',
ARRAY['gantt','idővonal','agile','dátumok','ütemezés'],
ARRAY['gantt diagram','idővonal nézet','projekt idővonal'],
ARRAY['agile-kanban','agile-scrum','workspace-agile'],
false, true, 'v3.2.2', now()),

-- ══════════════════════════════════════════════════════════
-- JIRA INTEGRATION
-- ══════════════════════════════════════════════════════════
('jira-integration', 'en', 'Jira & Azure DevOps Integration',
 'Connect Effectime to your Jira Cloud or Azure DevOps project for backlog syncing, issue creation, and capacity fit analysis.',
$$## Where to find it
**Workspace → Settings → Integrations** (admin only).

## What it does
The integration connector links your Effectime workspace to a Jira Cloud or Azure DevOps
project. Once connected, Effectime can:
- Search and cache issues (backlog browser)
- Create or update issues directly from the UI
- Sync sprint, status, assignee, story point, and label fields
- Compute capacity fit (sprint headcount vs. leave overlap)
- Display issues in Kanban, Scrum, and Gantt views

All calls are proxied through the `jira-devops-proxy` edge function to keep credentials
server-side and every call is logged in `enterprise_agile_sync_log`.

## How to use it
1. Go to **Settings → Integrations → New integration**.
2. Select **Jira** or **Azure DevOps**.
3. Enter the **base URL** (e.g. `https://yourcompany.atlassian.net`), **project key**,
   and **API token** (Personal Access Token for Jira / PAT for ADO).
4. Click **Test connection** — a green badge confirms a live connection.
5. Click **Sync project config** to import issue types, labels, and field metadata.
6. The integration is now ready. Go to **Resources → Agile** to browse issues.

## Common actions
- **Test connection** — verifies credentials and reachability.
- **Sync project config** — imports issue types and label suggestions.
- **Sync issues** — pulls the backlog into the local cache.
- **Archive integration** — disconnects without losing sync history.

## Troubleshooting
- *"Could not connect"*: double-check the base URL (no trailing path like `/rest/api/3`),
  project key, and token permissions. The token needs `read:jira-work` and
  `write:jira-work` scopes.
- Search returning empty results: click **Sync project config** first to populate
  the field metadata cache.
- ADO requires a Personal Access Token with `Work Items (Read & Write)` scope.

## Related
- Agile Kanban Board
- Agile Scrum Board
- Agile Gantt Timeline
- Integration Health Center
$$,
'/enterprise', null, 'setting',
ARRAY['jira','azure devops','ado','integration','connect','sync'],
ARRAY['jira connection','devops integration','project sync'],
ARRAY['agile-kanban','agile-scrum','integration-health','workspace-settings'],
false, true, 'v3.2.2', now()),

('jira-integration', 'hu', 'Jira és Azure DevOps Integráció',
 'Kapcsold össze az Effectime-ot a Jira Cloud vagy Azure DevOps projekteddel backlog szinkronizáláshoz, issue létrehozáshoz és kapacitás-illesztés elemzéshez.',
$$## Hol találod
**Munkaterület → Beállítások → Integrációk** (csak adminoknak).

## Mit csinál
Az integrációs összekötő összekapcsolja a munkaterületet egy Jira Cloud vagy Azure DevOps
projekttel. A csatlakoztatást követően az Effectime képes:
- Issue-k keresésére és gyorsítótárazására (backlog böngésző)
- Issue-k közvetlen létrehozására és frissítésére a felületről
- Sprint, státusz, felelős, story point és label mezők szinkronizálására
- Kapacitás-illesztés számítására (sprint létszám vs. távolléti átfedés)
- Issue-k Kanban, Scrum és Gantt nézetben való megjelenítésére

Minden hívás a `jira-devops-proxy` edge funkcióján keresztül zajlik a hitelesítő adatok
szerveroldali tárolásához, és minden hívás bekerül az `enterprise_agile_sync_log` táblába.

## Hogyan használd
1. Nyisd meg a **Beállítások → Integrációk → Új integráció** részt.
2. Válaszd a **Jira** vagy **Azure DevOps** opciót.
3. Add meg az **alap URL-t** (pl. `https://ceged.atlassian.net`), a **projekt kulcsot**
   és az **API tokent** (Jira személyes hozzáférési token / ADO PAT).
4. Kattints a **Kapcsolat tesztelése** gombra — zöld jelvény jelzi az élő kapcsolatot.
5. Kattints a **Projekt konfiguráció szinkron** gombra az issue típusok és label metadata importálásához.
6. Az integráció készen áll. Nyisd meg az **Erőforrások → Agile** részt az issue-k böngészéséhez.

## Gyakori műveletek
- **Kapcsolat tesztelése** — hitelesítő adatok és elérhetőség ellenőrzése.
- **Projekt konfiguráció szinkron** — issue típusok és label javaslatok importálása.
- **Issue-k szinkronizálása** — backlog lekérése a helyi gyorsítótárba.
- **Integráció archiválása** — lecsatlakozás a szinkronizálási előzmények megtartásával.

## Hibaelhárítás
- *"Nem sikerült csatlakozni"*: ellenőrizd az alap URL-t (ne legyen benne `/rest/api/3`), a projekt kulcsot és a token jogosultságait.
- Üres keresési eredmények: először futtass **Projekt konfiguráció szinkront** a mezőmetadata cache feltöltéséhez.
- ADO esetén `Work Items (Read & Write)` jogosultságú PAT szükséges.

## Kapcsolódó
- Agile Kanban Tábla
- Agile Scrum Tábla
- Agile Gantt Idővonal
- Integrációs Állapotközpont
$$,
'/enterprise', null, 'setting',
ARRAY['jira','azure devops','integráció','csatlakozás','szinkron'],
ARRAY['jira kapcsolat','devops integráció','projekt szinkron'],
ARRAY['agile-kanban','agile-scrum','integration-health','workspace-settings'],
false, true, 'v3.2.2', now()),

-- ══════════════════════════════════════════════════════════
-- EXPORT CENTER
-- ══════════════════════════════════════════════════════════
('export-center', 'en', 'Export Center',
 'Download leave data, audit logs, and reports as CSV files for payroll, compliance, or external reporting.',
$$## Where to find it
**Workspace → Reports → Export tab** (inside the Reports & Audit section).

## What it does
The Export Center lets you download raw data from the workspace as structured CSV files.
You can filter by date range and status before exporting. Typical uses include payroll
preparation, compliance audits, and importing data into HR or BI tools.

## How to use it
1. Open the **Reports & Audit** tab.
2. Click the **Export** sub-tab.
3. Select a **date range** (from / to).
4. Optionally filter by **leave status** (pending, approved, rejected, all).
5. Click **Export CSV** — the file downloads immediately.
6. Each export job is logged in the audit trail.

## Common actions
- **Export leave CSV** — all leave requests in the selected range and status.
- **Export audit log CSV** — full audit event log for the selected period.
- **Date range picker** — narrow the export to a specific month or quarter.
- **Status filter** — include only approved leaves (e.g. for payroll).

## Troubleshooting
- Very large date ranges may produce large files; narrow the range if the download is slow.
- Exports include only data you have permission to view. Members can only export their own records.
- The exported file uses UTF-8 BOM encoding for Excel compatibility.

## Related
- Reports & Audit
- Audit Log
- Quota Manager
$$,
'/enterprise', 'workspace.reports', 'report',
ARRAY['export','csv','download','payroll','compliance','report'],
ARRAY['data export','leave export','CSV download'],
ARRAY['workspace-reports','audit-log','quota-manager'],
false, true, 'v3.2.2', now()),

('export-center', 'hu', 'Export Központ',
 'Távolléti adatok, audit naplók és riportok CSV letöltése bérszámfejtéshez, megfelelőséghez vagy külső riportoláshoz.',
$$## Hol találod
**Munkaterület → Riportok → Export alfül** (a Riportok és Audit részen belül).

## Mit csinál
Az Export Központ lehetővé teszi a munkaterület adatainak strukturált CSV fájlként való
letöltését. Exportálás előtt szűrhetsz dátumtartomány és státusz szerint. Jellemző
felhasználási területek: bérszámfejtés előkészítése, megfelelőségi auditok, adatok
importálása HR vagy BI eszközökbe.

## Hogyan használd
1. Nyisd meg a **Riportok és Audit** fület.
2. Kattints az **Export** alfülre.
3. Válaszd ki a **dátumtartományt** (kezdet / vég).
4. Opcionálisan szűrj **távolléti státuszra** (függőben, jóváhagyott, elutasított, összes).
5. Kattints a **CSV exportálása** gombra — a fájl azonnal letöltődik.
6. Minden exportálási feladat bekerül az audit naplóba.

## Gyakori műveletek
- **Távolléti CSV exportálása** — minden kérelem a kiválasztott tartományban és státuszban.
- **Audit napló CSV exportálása** — teljes audit eseménynapló a kiválasztott időszakra.
- **Dátumtartomány-választó** — exportálás szűkítése egy adott hónapra vagy negyedévre.
- **Státusz szűrő** — csak jóváhagyott távollétek (pl. bérszámfejtéshez).

## Hibaelhárítás
- Nagyon hosszú dátumtartomány nagy fájlt eredményezhet; szűkítsd a tartományt lassú letöltés esetén.
- Az export csak a megtekintési jogosultságoddal összhangban lévő adatokat tartalmazza.
- A fájl UTF-8 BOM kódolással készül az Excel kompatibilitás érdekében.

## Kapcsolódó
- Riportok és Audit
- Audit Napló
- Kvóta Kezelő
$$,
'/enterprise', 'workspace.reports', 'report',
ARRAY['export','csv','letöltés','bérszámfejtés','megfelelőség'],
ARRAY['adatexport','távolléti export','CSV letöltés'],
ARRAY['workspace-reports','audit-log','quota-manager'],
false, true, 'v3.2.2', now())

ON CONFLICT (topic_key, locale) DO NOTHING;
