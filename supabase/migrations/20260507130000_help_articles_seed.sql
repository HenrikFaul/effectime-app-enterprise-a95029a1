-- Comprehensive seed for help_articles.
-- Covers all major pages, tabs, features, and workflows in Effectime.
-- All rows are marked is_active = true, is_system_generated = false
-- (curated baseline — not overwritten by regenerator unless body changes).
-- The regenerator upserts ON CONFLICT (topic_key, locale) so these serve
-- as a stable fallback until the AI-generated version is promoted.

-- Helper: insert or skip if already present
-- We use INSERT ... ON CONFLICT DO NOTHING so re-running is safe.

INSERT INTO public.help_articles
  (topic_key, locale, title, summary, body_md, route, anchor_id, taxonomy,
   tags, synonyms, related_topics, is_system_generated, is_active,
   source_release_tag, last_generated_at)
VALUES

-- ══════════════════════════════════════════════════════════
-- HOME / WORKSPACES
-- ══════════════════════════════════════════════════════════
('home-overview', 'en', 'Workspaces',
 'Your starting point: choose or create a workspace to access your team.',
$$## Where to find it
Navigate to the main **Effectime** screen after signing in.

## What it does
Each workspace is an isolated organisation with its own members, leave policies, approval chains, and reports. You can belong to multiple workspaces.

## How to use it
1. Sign in with your email or Google account.
2. You will see a list of workspaces you belong to.
3. Click a workspace card to enter it, or click **New workspace** to create one.

## Common actions
- **Create workspace** — opens the creation dialog; enter a name and optional description.
- **Open workspace** — click any card to enter the workspace dashboard.
- **Language selector** — flag button in the top-right; switches the UI language immediately.
- **Sign out** — your name menu in the top-right corner.

## Troubleshooting
- If you were invited but don't see the workspace, check the email address you used to sign in.
- Workspaces you own appear first; others you are a member of appear below.
$$,
'/enterprise', 'home.overview', 'page',
ARRAY['workspace','home','overview','start'],
ARRAY['dashboard','home screen','landing'],
ARRAY['workspace-members','workspace-settings'],
false, true, 'v3.2.0', now()),

('home-overview', 'hu', 'Munkaterületek',
 'A kiindulópontod: válassz vagy hozz létre munkaterületet a csapathoz való hozzáféréshez.',
$$## Hol találod
Bejelentkezés után az **Effectime** főképernyőjén.

## Mit csinál
Minden munkaterület egy izolált szervezet, saját tagokkal, távolléti szabályokkal, jóváhagyási láncokkal és riportokkal. Egyszerre több munkaterületnek is tagja lehetsz.

## Hogyan használd
1. Jelentkezz be emailcímedmel vagy Google-fiókkal.
2. Megjelenik az összes munkaterületed listája.
3. Kattints egy munkaterület kártyára a belépéshez, vagy az **Új munkaterület** gombra egy új létrehozásához.

## Gyakori műveletek
- **Munkaterület létrehozása** — megnyitja a létrehozási ablakot; add meg a nevet és az opcionális leírást.
- **Munkaterület megnyitása** — kattints bármelyik kártyára a belépéshez.
- **Nyelv-választó** — zászló gomb a jobb felső sarokban; azonnal vált a felhasználói felület nyelvén.
- **Kilépés** — a neved menüje a jobb felső sarokban.

## Hibaelhárítás
- Ha meghívtak, de nem látod a munkaterületet, ellenőrizd a bejelentkezési emailcímet.
- A saját munkaterületeid az első helyen jelennek meg.
$$,
'/enterprise', 'home.overview', 'page',
ARRAY['munkaterület','kezdőképernyő','áttekintés'],
ARRAY['dashboard','főképernyő'],
ARRAY['workspace-members','workspace-settings'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- MEMBERS TAB
-- ══════════════════════════════════════════════════════════
('workspace-members', 'en', 'Members',
 'Manage who belongs to your workspace, their roles, positions, and leave allowances.',
$$## Where to find it
Inside any workspace → **Members** tab (first tab in the navigation bar).

## What it does
The Members tab is your people directory. From here you can invite new members, view and edit their roles, manage skill and position assignments, and open detailed profile sheets.

## How to use it
1. Open a workspace and click the **Members** tab.
2. Browse the member list; use the search and filter controls to narrow results.
3. Click any member row to open their **Profile Sheet**.
4. To add someone new, click **Invite member**.

## Common actions
- **Invite member** — sends an invitation email; you can prefill role, position, manager, and org unit.
- **Profile Sheet** — shows full details including leave balance, skills, allocations, and org metadata.
- **Edit role** — change a member's role (Owner / Resource Assistant / Member) from the profile sheet.
- **Filter by team / office / position** — use the filter bar above the list.
- **Instant user** (admin) — quickly creates a test member with auto-populated metadata.

## Troubleshooting
- Invited members appear with "Invited" status until they accept.
- Only Owners and Resource Assistants can invite or edit members.
- An amber completion banner on the profile sheet indicates missing org metadata.

## Related
- Organisation tab for hierarchy setup.
- Workflows tab for onboarding new members.
$$,
'/enterprise', 'workspace.members', 'page',
ARRAY['members','team','people','invite','profile'],
ARRAY['staff','users','employees','workforce'],
ARRAY['workspace-organization','workspace-workflows','leave-request'],
false, true, 'v3.2.0', now()),

('workspace-members', 'hu', 'Tagok',
 'Kezeld, ki tartozik a munkaterülethez: szerepkörök, pozíciók és távolléti egyenlegek.',
$$## Hol találod
Bármely munkaterületen → **Tagok** fül (a navigációs sáv első füle).

## Mit csinál
A Tagok fül a csapatod könyvtára. Innen meghívhatsz új tagokat, megtekintheted és szerkesztheted szerepköreiket, kezelheteted a skill- és pozíció-hozzárendeléseket, és megnyithatod a részletes profilokat.

## Hogyan használd
1. Nyiss meg egy munkaterületet és kattints a **Tagok** fülre.
2. Böngészd a taglistát; a kereső és szűrő vezérlőkkel szűkítheted az eredményeket.
3. Kattints bármelyik tag sorára a **Profil** megnyitásához.
4. Új személy hozzáadásához kattints a **Tag meghívása** gombra.

## Gyakori műveletek
- **Tag meghívása** — meghívó emailt küld; előre kitölthető a szerepkör, pozíció, vezető és szervezeti egység.
- **Profillap** — teljes részleteket mutat: távolléti egyenleg, skillek, allokációk, szervezeti metaadat.
- **Szerepkör szerkesztése** — módosítsd a tag szerepkörét (Tulajdonos / Erőforrás-asszisztens / Tag) a profillapról.
- **Szűrés csapat / iroda / pozíció szerint** — a lista feletti szűrősávot használd.
- **Instant user** (admin) — gyorsan létrehoz egy teszttagot auto-kitöltött metaadatokkal.

## Hibaelhárítás
- A meghívott tagok "Meghívott" státusszal jelennek meg, amíg el nem fogadják.
- Csak tulajdonosok és erőforrás-asszisztensek hívhatnak meg vagy szerkeszthetnek tagokat.
- A profilapon megjelenő borostyán színű banner hiányzó szervezeti metaadatot jelez.
$$,
'/enterprise', 'workspace.members', 'page',
ARRAY['tagok','csapat','emberek','meghívás','profil'],
ARRAY['alkalmazottak','munkaerő','felhasználók'],
ARRAY['workspace-organization','workspace-workflows','leave-request'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- ORGANISATION TAB
-- ══════════════════════════════════════════════════════════
('workspace-organization', 'en', 'Organization',
 'The canonical source of truth for your company hierarchy, leadership levels, contracts, and org chart.',
$$## Where to find it
Workspace → **Organization** tab (between Members and Calendar).

## What it does
The Organization module defines the structural skeleton of your company inside this workspace. It drives the auto-generated org chart and enriches member profiles with mandatory metadata (org unit, manager, contract type, leadership level).

## How to use it
1. Go to **Organization** tab.
2. Start with **Structure** to create org units (division → department → team).
3. Move to **Leadership** and **Contracts** to seed the dropdown options used at member creation.
4. Check **Org chart** to verify the hierarchy looks correct.

## Common actions
- **Add org unit** — name + optional parent unit + optional description.
- **Seed defaults** — one-click seeds standard contract types and leadership levels.
- **Org chart** — live tree rendered from manager relationships; click **Regenerate snapshot** to persist it.
- **Job families / Work categories / Industry** — controlled vocabularies for position classification.

## Troubleshooting
- The org chart only shows members who have a **manager** set on their profile.
- You must create org units before you can assign members to them via Invite or Profile.

## Related
- Members tab → Profile Sheet for assigning org metadata per member.
- Position catalog → for role and skill mapping.
$$,
'/enterprise', 'workspace.organization', 'page',
ARRAY['organization','hierarchy','org chart','structure','contract','leadership'],
ARRAY['company structure','org tree','reporting line'],
ARRAY['workspace-members','org-chart','role-permissions'],
false, true, 'v3.2.0', now()),

('workspace-organization', 'hu', 'Szervezet',
 'A vállalati hierarchia, vezetői szintek, szerződések és szervezeti diagram hivatalos forrása.',
$$## Hol találod
Munkaterület → **Szervezet** fül (Tagok és Naptár között).

## Mit csinál
A Szervezet modul meghatározza a vállalat strukturális vázát a munkaterületen belül. Ez generálja az automatikus szervezeti diagramot, és kötelező metaadatokkal gazdagítja a tagprofilokat (szervezeti egység, vezető, szerződéstípus, vezetői szint).

## Hogyan használd
1. Lépj a **Szervezet** fülre.
2. Kezd a **Felépítéssel** és hozz létre szervezeti egységeket (divízió → részleg → csapat).
3. Folytasd a **Vezetéssel** és **Szerződésekkel** az alapértelmezett legördülők feltöltéséhez.
4. Ellenőrizd a **Szervezeti diagram** fülön, hogy a hierarchia helyes-e.

## Gyakori műveletek
- **Szervezeti egység hozzáadása** — név + opcionális szülő egység + leírás.
- **Alapértelmezések feltöltése** — egy kattintással tölti fel a szerződéstípusokat és vezetői szinteket.
- **Szervezeti diagram** — élő fa a vezető-beosztott kapcsolatokból; a **Pillanatkép generálása** gombbal menthető.
- **Munkacsaládok / Munkakategóriák / Iparág** — kontrollált szótárak pozíció-besoroláshoz.

## Hibaelhárítás
- A szervezeti diagram csak azokat a tagokat jeleníti meg, akiknél be van állítva a **vezető**.
- Szervezeti egységeket az allokálás előtt létre kell hozni.
$$,
'/enterprise', 'workspace.organization', 'page',
ARRAY['szervezet','hierarchia','szervezeti diagram','felépítés','szerződés','vezetés'],
ARRAY['vállalati struktúra','org fa','alárendeltségi viszony'],
ARRAY['workspace-members','org-chart','role-permissions'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- CALENDAR TAB
-- ══════════════════════════════════════════════════════════
('workspace-calendar', 'en', 'Calendar',
 'View and submit leave, track team availability, and plan coverage — all in one place.',
$$## Where to find it
Workspace → **Calendar** tab. It has four sub-views: **Calendar**, **Timeline**, **Coverage planner**, and **Annual view**.

## What it does
The Calendar gives a full picture of team availability. Managers can spot gaps; members can submit leave requests; admins can plan coverage rules.

## Sub-views
- **Calendar (Naptár)** — colour-coded monthly leave calendar with birthday and anniversary widgets below.
- **Timeline (Idővonal)** — Absentify-style horizontal grid per member; supports 200+ members with row virtualisation.
- **Coverage planner (Kapacitástervező)** — shows daily supply vs. rule-defined demand per office/team.
- **Annual view (Éves nézet)** — full-year strip per member; admin can switch to any member's view.

## How to use it
1. Open the **Calendar** tab.
2. Choose the sub-view that matches your task (submit = Calendar; plan = Timeline; check coverage = Coverage planner).
3. To submit leave, click a day on the calendar and select **Submit leave request** (or click the button directly).

## Common actions
- **Submit leave request** — opens the leave request dialog; pick type, dates, substitute, and attachments.
- **Apply filters** — filter by team, office, position, skill, or leave type.
- **Switch view** — use the sub-tab buttons above the calendar grid.
- **Export iCal** — in Settings → iCal subscription.

## Troubleshooting
- Weekends and holidays are automatically excluded from leave day counts.
- If a date is blocked, you will see a conflict warning before submitting.

## Related
- Approvals tab for pending decisions.
- Coverage planner for daily coverage rules.
$$,
'/enterprise', 'workspace.calendar', 'page',
ARRAY['calendar','leave','timeline','coverage','annual','schedule'],
ARRAY['naptár','szabadság','idővonal','absentify'],
ARRAY['leave-request','approval-flow','coverage-planner','workspace-approvals'],
false, true, 'v3.2.0', now()),

('workspace-calendar', 'hu', 'Naptár',
 'Tekintsd meg és add be a szabadságokat, kövesd a csapat elérhetőségét, tervezd a lefedettséget.',
$$## Hol találod
Munkaterület → **Naptár** fül. Négy alnézet érhető el: **Naptár**, **Idővonal**, **Kapacitástervező** és **Éves nézet**.

## Mit csinál
A Naptár teljes képet ad a csapat elérhetőségéről. A vezetők hiányokat azonosíthatnak; a tagok kérelmeket adhatnak be; az adminok lefedettségi szabályokat tervezhetnek.

## Alnézetek
- **Naptár** — színkódolt havi távolléti naptár születésnap és évfordulós widgetekkel.
- **Idővonal** — Absentify-stílusú vízszintes rács tagonként; 200+ tagig is gördülékeny.
- **Kapacitástervező** — napi kínálat vs. szabály által meghatározott kereslet irodánként/csapatonként.
- **Éves nézet** — teljes éves csíkos nézet tagonként; admin más tag nézetére is válthat.

## Hogyan használd
1. Nyisd meg a **Naptár** fület.
2. Válaszd a feladatodnak megfelelő alnézetet (beküldés = Naptár; tervezés = Idővonal; lefedettség = Kapacitástervező).
3. Kérelem beadásához kattints egy napra és válaszd a **Kérelem beadása** lehetőséget.

## Gyakori műveletek
- **Kérelem beadása** — megnyitja a távolléti kérelem párbeszédet; add meg a típust, dátumokat, helyettest és mellékleteket.
- **Szűrők alkalmazása** — szűrj csapat, iroda, pozíció, skill vagy távolléttípus szerint.
- **Nézetváltás** — az alnézet-gombok használata a naptár felett.
- **iCal exportálás** — Beállítások → iCal előfizetés.

## Hibaelhárítás
- A hétvégék és ünnepnapok automatikusan ki vannak zárva a napszámolásból.
- Ha egy nap tiltott, ütközési figyelmeztetés jelenik meg beküldés előtt.
$$,
'/enterprise', 'workspace.calendar', 'page',
ARRAY['naptár','szabadság','idővonal','lefedettség','éves','menetrend'],
ARRAY['calendar','leave','timeline','coverage','annual'],
ARRAY['leave-request','approval-flow','coverage-planner','workspace-approvals'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- LEAVE REQUEST
-- ══════════════════════════════════════════════════════════
('leave-request', 'en', 'Leave Request',
 'Submit a request for any leave type — vacation, sick leave, unpaid leave, or custom types.',
$$## Where to find it
Workspace → **Calendar** → click any day → **Submit leave request**, or from the **Requests** tab → Submit button.

## What it does
A leave request records your absence for approval. It goes through the workspace approval chain (manager → escalation → owner) and, when approved, appears on the calendar for the whole team.

## How to use it
1. Open the Calendar tab and click a date, or click **Submit leave request** on the Requests tab.
2. Choose the **leave type** (vacation, sick leave, unpaid, or a custom workspace type).
3. Set the **start** and **end date**.
4. Optionally select a **substitute** (the person who covers your work).
5. Optionally attach a document (medical certificate, etc.).
6. Click **Check for conflicts** — the system validates against holidays, blocked dates, and coverage rules.
7. If no blocking conflicts, click **Submit**.

## Common actions
- **Private toggle** — hides the request details from other members (only approvers see the reason).
- **Cancel request** — available for pending requests; you will be asked for a cancellation reason.
- **Substitute picker** — choose a workspace member who will handle your responsibilities.

## Troubleshooting
- If you see a **blocking conflict**, the request cannot be submitted until the conflict is resolved (e.g., a blocked date).
- **Warning conflicts** are informational — you can still submit.
- Your leave balance (allowance / remaining / carried over) is visible on your Profile Sheet.

## Related
- Approval flow → what happens after you submit.
- Calendar → where approved leave appears.
$$,
'/enterprise', 'leave.request', 'workflow',
ARRAY['leave','request','vacation','sick','absence','time-off'],
ARRAY['holiday','szabadság','kérelem','absence request'],
ARRAY['approval-flow','workspace-calendar','workspace-approvals'],
false, true, 'v3.2.0', now()),

('leave-request', 'hu', 'Távolléti kérelem',
 'Adj be kérelmet bármilyen távolléttípusra — szabadság, betegszabadság, fizetés nélküli szabadság vagy egyéni típusok.',
$$## Hol találod
Munkaterület → **Naptár** → kattints bármely napra → **Kérelem beadása**, vagy a **Kérelmek** fülről a beküldési gombbal.

## Mit csinál
A távolléti kérelem rögzíti a távollétet jóváhagyásra. Az munkaterület jóváhagyási láncán halad végig (vezető → eszkaláció → tulajdonos), és jóváhagyás után megjelenik a naptárban az egész csapat számára.

## Hogyan használd
1. Nyisd meg a Naptár fület és kattints egy dátumra, vagy kattints a **Kérelem beadása** gombra a Kérelmek fülön.
2. Válaszd ki a **távolléttípust** (szabadság, betegszabadság, fizetés nélküli vagy egyéni munkaterületi típus).
3. Add meg a **kezdő** és **záró dátumot**.
4. Opcionálisan válassz **helyettest** (az a személy, aki átveszi a feladataidat).
5. Opcionálisan csatolj dokumentumot (orvosi igazolás stb.).
6. Kattints az **Ütközések ellenőrzése** gombra — a rendszer ellenőrzi az ünnepnapokhoz, tiltott napokhoz és lefedettségi szabályokhoz képest.
7. Ha nincs blokkoló ütközés, kattints a **Beküldés** gombra.

## Hibaelhárítás
- **Blokkoló ütközés** esetén a kérelem nem küldhető be az ütközés feloldásáig (pl. tiltott nap).
- A **figyelmeztető ütközések** tájékoztató jellegűek — a beküldés lehetséges.
- Az egyenleged (engedélyezett / maradék / átvitt) a Profilapon látható.
$$,
'/enterprise', 'leave.request', 'workflow',
ARRAY['kérelem','távolléttípus','szabadság','betegszabadság','távolléti kérelem'],
ARRAY['leave request','holiday request','absence'],
ARRAY['approval-flow','workspace-calendar','workspace-approvals'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- APPROVAL FLOW
-- ══════════════════════════════════════════════════════════
('approval-flow', 'en', 'Approval Flow',
 'Understand how leave and access requests travel through the approval chain.',
$$## Where to find it
Workspace → **Requests** tab (your submitted requests) or **Approvals** section (decisions you must make).

## What it does
Every leave request follows the workspace approval chain: each step is a role (e.g., Manager → Senior Manager → Owner). Approvers receive in-app and email notifications. If no decision is made within the escalation window, the request automatically escalates to the next step.

## Flow diagram
```
User submits request
      ↓
Step 1: Manager notified → Approve / Reject / No action
      ↓ (escalation timeout)
Step 2: Senior Manager notified
      ↓ (escalation timeout)
Step N: Owner / final approver
      ↓
Decision logged in audit trail → Requester notified by email
```

## Common actions
- **Approve** — accept the request; requester and team calendar updated.
- **Reject** — deny the request with an optional reason.
- **Bulk approve/reject** — select multiple requests in the Approvals inbox for batch decisions.
- **Admin override** — owners can override any decision.

## Troubleshooting
- If you don't see a request in your inbox, you may not be assigned the approver role for that step.
- Check approval chain configuration in Settings → Approval chain.

## Related
- Leave request → how to submit.
- Audit log → immutable record of every decision.
$$,
'/enterprise', 'workspace.approvals', 'workflow',
ARRAY['approval','workflow','leave','chain','escalation','decision'],
ARRAY['jóváhagyás','approve','reject','decision chain'],
ARRAY['leave-request','audit-log','workspace-approvals'],
false, true, 'v3.2.0', now()),

('approval-flow', 'hu', 'Jóváhagyási folyamat',
 'Értsd meg, hogyan halad a távolléti és hozzáférési kérelem a jóváhagyási láncon.',
$$## Hol találod
Munkaterület → **Kérelmek** fül (a saját beküldött kérelmeid) vagy **Jóváhagyások** szakasz (a te döntéseidre váró kérelmek).

## Mit csinál
Minden távolléti kérelem az munkaterület jóváhagyási láncán halad: minden lépés egy szerepkör (pl. Vezető → Szenior vezető → Tulajdonos). A jóváhagyók alkalmazáson belüli és email értesítést kapnak. Ha az eszkalációs időn belül nem születik döntés, a kérelem automatikusan a következő lépésre kerül.

## Folyamat diagram
```
Felhasználó beküldi a kérelmet
      ↓
1. lépés: Vezető értesítve → Jóváhagyás / Elutasítás / Nincs döntés
      ↓ (eszkaláció időtúllépés)
2. lépés: Szenior vezető értesítve
      ↓ (eszkaláció időtúllépés)
N. lépés: Tulajdonos / végső jóváhagyó
      ↓
Döntés rögzítve az audit naplóban → Kérelmező email értesítést kap
```

## Hibaelhárítás
- Ha nem látod a kérelmet az inboxban, előfordulhat, hogy nincs hozzád rendelve az adott lépés jóváhagyói szerepköre.
- Ellenőrizd a jóváhagyási lánc konfigurációját a Beállítások → Jóváhagyási lánc menüpontban.
$$,
'/enterprise', 'workspace.approvals', 'workflow',
ARRAY['jóváhagyás','folyamat','távolléti','lánc','eszkaláció','döntés'],
ARRAY['approval','approve','reject','döntési lánc'],
ARRAY['leave-request','audit-log','workspace-approvals'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- WORKFLOWS TAB
-- ══════════════════════════════════════════════════════════
('workspace-workflows', 'en', 'Workflows',
 'Run structured onboarding and manage external system access for new and existing members.',
$$## Where to find it
Workspace → **Workflows** tab (between Calendar and Resources).

## What it does
Workflows contains two main areas:
1. **Onboarding** — structured templates with ordered steps (tasks, acknowledgements, training, exams, approvals, access requests). Admins create templates; members complete steps.
2. **Access requests** — request access to external systems (Jira, Confluence, Outlook, ERP, etc.) through a structured approval process.

## How to use it
### Start onboarding
1. Go to **Workflows → Onboarding Inbox**.
2. Click **Start onboarding for member**, pick the member and template.
3. The member sees their steps in the inbox; mark each complete as they go.

### Request system access
1. Go to **Workflows → Access Inbox**.
2. Click **Submit request**, choose the member and system bundle.
3. The request routes through the approval chain.

## Common actions
- **Create onboarding template** — define steps, assign step types, set deadlines.
- **Publish template** — locks the template and makes it selectable for instances.
- **Seed default access systems** — adds Jira, Confluence, Outlook, Dynatrace, ERP, Billing, and Entry Control in one click.
- **Approve / Grant / Revoke access** — in the Access Inbox.

## Troubleshooting
- Templates must be **published** before they can be used for onboarding instances.
- Access requests route through the same approval chain as leave requests.

## Related
- Members tab → invite with org metadata prefilled.
- Approvals tab → pending decisions.
$$,
'/enterprise', 'workspace.workflows', 'page',
ARRAY['onboarding','workflows','access','template','steps','process'],
ARRAY['onboarding playbook','access management','folyamatok'],
ARRAY['workspace-members','workspace-approvals','access-request'],
false, true, 'v3.2.0', now()),

('workspace-workflows', 'hu', 'Folyamatok',
 'Futtass strukturált onboardingot és kezeld a külső rendszerekhez való hozzáférést.',
$$## Hol találod
Munkaterület → **Folyamatok** fül (Naptár és Erőforrások között).

## Mit csinál
A Folyamatok két fő területet tartalmaz:
1. **Onboarding** — strukturált sablonok rendezett lépésekkel (feladatok, elismerések, képzések, vizsgák, jóváhagyások, hozzáférési kérelmek). Az adminok sablonokat hoznak létre; a tagok lépéseket teljesítenek.
2. **Hozzáférés-kérelmek** — hozzáférés igénylése külső rendszerekhez (Jira, Confluence, Outlook, ERP stb.) strukturált jóváhagyási folyamaton keresztül.

## Hogyan használd
### Onboarding indítása
1. Lépj a **Folyamatok → Onboarding Inbox** menüpontba.
2. Kattints a **Onboarding indítása tagnak** gombra, válaszd ki a tagot és a sablont.
3. A tag a saját inboxában látja a lépéseket; teljesítéskor jelöld be azokat.

### Rendszer-hozzáférés kérése
1. Lépj a **Folyamatok → Hozzáférés Inbox** menüpontba.
2. Kattints a **Kérelem beküldése** gombra, válaszd ki a tagot és a rendszercsomagot.
3. A kérelem a jóváhagyási láncon halad végig.

## Hibaelhárítás
- A sablonokat **publikálni** kell, mielőtt onboarding instanszokhoz használhatók lennének.
- A hozzáférési kérelmek ugyanazon a jóváhagyási láncon futnak, mint a távolléti kérelmek.
$$,
'/enterprise', 'workspace.workflows', 'page',
ARRAY['onboarding','folyamatok','hozzáférés','sablon','lépések','folyamat'],
ARRAY['workflows','onboarding playbook','access management'],
ARRAY['workspace-members','workspace-approvals','access-request'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- RESOURCES TAB
-- ══════════════════════════════════════════════════════════
('workspace-resources', 'en', 'Resources',
 'Plan capacity, track projects, run agile integrations, and monitor skill availability.',
$$## Where to find it
Workspace → **Resources** tab.

## What it does
The Resources tab is your workforce planning hub. It combines:
- **Capacity heatmap** — visual per-member daily availability.
- **Project Gantt** — timeline view of active projects and milestones.
- **Agile integration** — Jira/Azure DevOps backlog, sprint fit, issue creation.
- **Capacity DNA** — snapshot of baseline, effective, committed, and available FTE with shortage/overload scoring.
- **Skill reporting** — live skill availability filtered to the current timeline view.

## How to use it
1. Open the **Resources** tab.
2. Use the sub-tabs (Capacity / Projects / Agile / Skills) to navigate.
3. To generate a capacity snapshot, click **Generate snapshot for today** in the Capacity DNA panel.

## Common actions
- **Heatmap** — colour-coded cells show availability; hover for details.
- **Add project** — name, start/end dates, and team assignment.
- **Connect Jira** — Settings → Integrations, then use the Resources → Agile tab.
- **Generate snapshot** — saves today's capacity state to history.
- **What-if simulation** — in Agile → Capacity Fit; enter leave days to see projected impact.

## Troubleshooting
- Capacity numbers depend on members having **base working hours** set (default 8h).
- The Agile tab requires an active Jira or Azure DevOps integration (Settings → Integrations).

## Related
- Agile boards for sprint planning.
- Capacity DNA for predictive forecasting.
$$,
'/enterprise', 'workspace.resources', 'page',
ARRAY['resources','capacity','projects','agile','skills','heatmap'],
ARRAY['erőforrások','kapacitás','projektek','ütemterv'],
ARRAY['workspace-agile','capacity-dna','agile-kanban'],
false, true, 'v3.2.0', now()),

('workspace-resources', 'hu', 'Erőforrások',
 'Tervezd a kapacitást, kövesd a projekteket, futtasd az agile integrációkat és figyeld a skill elérhetőséget.',
$$## Hol találod
Munkaterület → **Erőforrások** fül.

## Mit csinál
Az Erőforrások fül a munkaerő-tervezési központ. Ötvözi a következőket:
- **Kapacitás hőtérkép** — vizuális tagonkénti napi elérhetőség.
- **Projekt Gantt** — aktív projektek és mérföldkövek idővonala.
- **Agile integráció** — Jira/Azure DevOps backlog, sprint illeszkedés, issue létrehozás.
- **Kapacitás DNA** — pillanatkép alap-, effektív, vállalt és szabad FTE-ről hiány/túlterhelés pontszámmal.
- **Skill riport** — élő skill elérhetőség az idővonal-nézet szűrőihez igazítva.

## Hogyan használd
1. Nyisd meg az **Erőforrások** fület.
2. Használd az alfüleket (Kapacitás / Projektek / Agile / Skillek) a navigációhoz.
3. Kapacitás pillanatkép generálásához kattints a **Mai pillanatkép generálása** gombra a Kapacitás DNA panelen.

## Hibaelhárítás
- A kapacitásszámok attól függnek, hogy a tagoknál be van-e állítva az **alap munkaóra** (alapértelmezett 8 óra).
- Az Agile fül aktív Jira vagy Azure DevOps integrációt igényel (Beállítások → Integrációk).
$$,
'/enterprise', 'workspace.resources', 'page',
ARRAY['erőforrások','kapacitás','projektek','agile','skillek','hőtérkép'],
ARRAY['resources','capacity','projects','heatmap'],
ARRAY['workspace-agile','capacity-dna','agile-kanban'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- REPORTS & AUDIT
-- ══════════════════════════════════════════════════════════
('workspace-reports', 'en', 'Reports & Audit',
 'KPI dashboards, leave trends, exportable data, and an immutable audit trail.',
$$## Where to find it
Workspace → **Reports & Audit** tab (requires reports or audit view permission).

## What it does
The Reports tab has three sections:
1. **Reporting dashboard** — KPI cards (total members, pending leaves, quota usage), status pie chart, type bar chart, daily absentee line chart.
2. **Export center** — download leave data as CSV filtered by date range and status.
3. **Audit log** — immutable record of every action in the workspace (invitations, decisions, overrides, config changes).

## How to use it
1. Open **Reports & Audit** tab.
2. Check the KPI cards for quick health status.
3. Use chart filters to drill into specific leave types or time periods.
4. For compliance or payroll, use **Export center** → pick date range → **Download CSV**.
5. To investigate an action, open **Audit log** and filter by actor or event type.

## Common actions
- **Export CSV** — filtered leave records for payroll or HR reporting.
- **Audit log filter** — by actor, event type, or date range.
- **Pin report widget** — save a report view to the workspace dashboard.
- **Schedule report delivery** — set up recurring email delivery of a report.

## Troubleshooting
- Only members with the **reports** or **audit** view permission see this tab.
- Audit entries are immutable — they cannot be edited or deleted.

## Related
- Export center for CSV downloads.
- Audit log for compliance investigation.
$$,
'/enterprise', 'workspace.reports', 'page',
ARRAY['reports','audit','KPI','export','charts','compliance'],
ARRAY['riportok','audit napló','export','megfelelés'],
ARRAY['export-center','audit-log','workspace-settings'],
false, true, 'v3.2.0', now()),

('workspace-reports', 'hu', 'Riportok és Audit',
 'KPI dashboardok, távolléti trendek, exportálható adatok és megváltoztathatatlan audit napló.',
$$## Hol találod
Munkaterület → **Riportok és Audit** fül (riportok vagy audit megtekintési jogosultság szükséges).

## Mit csinál
A Riportok fül három szakaszból áll:
1. **Riport dashboard** — KPI kártyák (összes tag, függő távollétek, kvótahasználat), státusz kördiagram, típusonkénti sávdiagram, napi távolléti vonal diagram.
2. **Export központ** — távolléti adatok letöltése CSV-ként dátumtartomány és státusz szerinti szűréssel.
3. **Audit napló** — a munkaterület minden tevékenységének megváltoztathatatlan nyilvánoskönyve (meghívások, döntések, felülbírálatok, konfigurációs változtatások).

## Hogyan használd
1. Nyisd meg a **Riportok és Audit** fület.
2. Ellenőrizd a KPI kártyákat a gyors áttekintéshez.
3. Diagram szűrőkkel mélyülj el a távolléttípusokban vagy időszakokban.
4. Megfelelési vagy bérszámfejtési célra az **Export központot** használd → dátumtartomány megadása → **CSV letöltése**.
5. Tevékenység vizsgálatához az **Audit naplót** nyisd meg és szűrj szereplő vagy eseménytípus szerint.

## Hibaelhárítás
- Csak a **riportok** vagy **audit** megtekintési jogosultsággal rendelkező tagok látják ezt a fület.
- Az audit bejegyzések megváltoztathatatlanok — nem szerkeszthetők és nem törölhetők.
$$,
'/enterprise', 'workspace.reports', 'page',
ARRAY['riportok','audit','KPI','export','diagramok','megfelelés'],
ARRAY['reports','audit log','export','compliance'],
ARRAY['export-center','audit-log','workspace-settings'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- SETTINGS TAB
-- ══════════════════════════════════════════════════════════
('workspace-settings', 'en', 'Settings',
 'Configure your workspace: branding, leave rules, integrations, permissions, and localization.',
$$## Where to find it
Workspace → **Settings** tab (requires settings view permission — typically Owner or Resource Assistant).

## What it does
Settings is the admin control panel for the workspace. It covers:
- **General** — workspace name, description, branding colors and logo.
- **Leave types** — create custom absence categories beyond the built-in ones.
- **Holidays** — define public holidays so they are excluded from leave day counts.
- **Blocked dates** — prevent leave submission on specific dates (e.g., year-end freeze).
- **Daily rules** — set minimum staffing levels per office or team.
- **Approval chain** — configure multi-step approval with escalation timeouts.
- **Rule templates** — reusable rule configurations.
- **Integrations** — connect Jira, Azure DevOps, or other external tools.
- **iCal subscription** — allow members to subscribe to their leave calendar.
- **Permissions** — assign fine-grained view and edit rights by role.
- **Localization** — manage language settings and translation overrides.
- **Recovery mode** — activate a workspace-wide emergency flag.

## How to use it
1. Open the **Settings** tab.
2. Each section is collapsible; expand the one you need.
3. Make changes and click **Save** in the relevant section.

## Common actions
- **Add leave type** — create a custom leave category with its own colour and icon.
- **Add holiday** — enter a date and name; it becomes a workspace holiday.
- **Configure approval chain** — add steps, assign roles, set escalation hours.
- **Test integration connection** — in Integrations, click **Test connection** per integration.
- **Export translations** — Localization → Export CSV for translator review.

## Troubleshooting
- Settings changes take effect immediately for new requests; existing requests are not re-evaluated.
- Integration connection failures are visible in Resources → Integration Health Center.

## Related
- Localization settings for language management.
- Integration Health Center for connection monitoring.
$$,
'/enterprise', 'workspace.settings', 'page',
ARRAY['settings','configuration','branding','rules','permissions','integration','localization'],
ARRAY['beállítások','konfiguráció','szabályok','jogosultságok'],
ARRAY['localization-settings','integration-health','role-permissions'],
false, true, 'v3.2.0', now()),

('workspace-settings', 'hu', 'Beállítások',
 'Konfiguráld a munkaterületed: megjelenés, távolléti szabályok, integrációk, jogosultságok és lokalizáció.',
$$## Hol találod
Munkaterület → **Beállítások** fül (beállítások megtekintési jogosultság szükséges — általában tulajdonos vagy erőforrás-asszisztens).

## Mit csinál
A Beállítások az admin vezérlőpult. A következőket tartalmazza:
- **Általános** — munkaterület neve, leírása, arculat színek és logo.
- **Távolléttípusok** — egyéni hiányzási kategóriák létrehozása a beépítetteken túl.
- **Ünnepnapok** — munkaterületi ünnepnapok meghatározása a napszámolásból való kizáráshoz.
- **Tiltott napok** — kérelmek beküldésének megakadályozása meghatározott dátumokon.
- **Napi szabályok** — minimális létszám meghatározása irodánként vagy csapatonként.
- **Jóváhagyási lánc** — többlépéses jóváhagyás konfigurálása eszkalációs időtúllépéssel.
- **Szabálysablonok** — újrafelhasználható szabálykonfigurációk.
- **Integrációk** — Jira, Azure DevOps vagy más külső eszközök csatlakoztatása.
- **iCal előfizetés** — engedélyezi a tagoknak a saját távolléti naptárra való feliratkozást.
- **Jogosultságok** — részletes megtekintési és szerkesztési jogok kiosztása szerepkörönként.
- **Lokalizáció** — nyelvi beállítások és fordítási felülbírálatok kezelése.
- **Helyreállítási üzemmód** — munkaterületi szintű vészhelyzeti jelző aktiválása.

## Hibaelhárítás
- A beállítások módosítása azonnal érvényes az új kérelmekre; a meglévő kérelmek nem kerülnek újraértékelésre.
- Az integrációs kapcsolódási hibák az Erőforrások → Integráció egészségi állapot panelen láthatók.
$$,
'/enterprise', 'workspace.settings', 'page',
ARRAY['beállítások','konfiguráció','arculat','szabályok','jogosultságok','integráció','lokalizáció'],
ARRAY['settings','configuration','rules','permissions'],
ARRAY['localization-settings','integration-health','role-permissions'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- AGILE / BOARDS
-- ══════════════════════════════════════════════════════════
('workspace-agile', 'en', 'Agile Boards',
 'Browse your Jira or Azure DevOps backlog, check sprint capacity, and view Kanban/Scrum/Gantt boards.',
$$## Where to find it
Workspace → **Resources** tab → **Agile** sub-tab (requires an active Jira or Azure DevOps integration).

## What it does
The Agile panel bridges your project management tool with Effectime workforce data. It lets you:
- Search issues using native JQL (Jira) or WIQL (Azure DevOps).
- Check whether sprint capacity holds up given current leave approvals.
- Create or update issues directly from within Effectime.
- Visualise work in three board styles: **Kanban**, **Scrum**, and **Gantt**.

## Board types
- **Kanban** — columns by status; cards show key, type, assignee, story points, priority.
- **Scrum** — grouped by sprint, then by status; per-sprint totals for tickets and story points.
- **Gantt** — horizontal month grid from start_date → due_date; colour-coded by issue type.

## How to use it
1. Ensure a Jira or ADO integration is configured in **Settings → Integrations**.
2. Open **Resources → Agile**.
3. Use the integration switcher to pick Jira or ADO.
4. Search issues using JQL/WIQL in the Backlog Browser.
5. Click **Boards** to switch to Kanban, Scrum, or Gantt view.
6. Click **Sync** to refresh the cached issue data.

## Common actions
- **Search issues** — enter JQL (e.g. `project = MY AND sprint in openSprints()`) or WIQL.
- **Create issue** — fills in project, type, summary, assignee from cached field metadata.
- **Capacity Fit** — select a sprint; see available hours vs. planned hours with overload warnings.
- **What-if simulation** — enter N leave days to see projected capacity impact.

## Troubleshooting
- If the board is empty, click **Sync** to force a fresh pull from Jira/ADO.
- JQL syntax errors return a helpful error message; check field names against your Jira project config.
- Custom field discovery runs from Settings → Integrations → Field discovery.

## Related
- Integration Health Center for connection status.
- Capacity DNA for FTE-level forecasting.
$$,
'/enterprise', 'workspace.agile', 'page',
ARRAY['agile','jira','azure devops','kanban','scrum','gantt','backlog','sprint'],
ARRAY['project management','issue tracker','boards','ADO'],
ARRAY['workspace-resources','integration-health','agile-kanban'],
false, true, 'v3.2.0', now()),

('workspace-agile', 'hu', 'Agile Táblák',
 'Böngészd a Jira vagy Azure DevOps backlogot, ellenőrizd a sprint kapacitást és tekintsd meg a Kanban/Scrum/Gantt táblákat.',
$$## Hol találod
Munkaterület → **Erőforrások** fül → **Agile** alfül (aktív Jira vagy Azure DevOps integráció szükséges).

## Mit csinál
Az Agile panel összeköti a projektmenedzsment eszközt az Effectime munkaerő-adataival. Lehetővé teszi:
- Issue-k keresése natív JQL (Jira) vagy WIQL (Azure DevOps) segítségével.
- Sprint kapacitás ellenőrzése az aktuális jóváhagyott távollétek tükrében.
- Issue-k létrehozása vagy frissítése közvetlenül az Effectime-ból.
- Munka vizualizálása három táblatípusban: **Kanban**, **Scrum** és **Gantt**.

## Táblatípusok
- **Kanban** — státusz szerinti oszlopok; kártyákon kulcs, típus, felelős, story pontok, prioritás.
- **Scrum** — sprint szerint csoportosítva, majd státusz szerint; sprintenként összesített jegy- és story pont számok.
- **Gantt** — vízszintes hónaprács start_date → due_date alapján; issue típus szerint színkódolt.

## Hibaelhárítás
- Ha a tábla üres, kattints a **Szinkron** gombra a Jira/ADO friss adatok lekérdezéséhez.
- JQL szintaxishibák esetén ellenőrizd a mezőneveket a Jira projekt konfigurációjában.
$$,
'/enterprise', 'workspace.agile', 'page',
ARRAY['agile','jira','azure devops','kanban','scrum','gantt','backlog','sprint'],
ARRAY['projektmenedzsment','issue tracker','táblák','ADO'],
ARRAY['workspace-resources','integration-health','agile-kanban'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- CAPACITY DNA
-- ══════════════════════════════════════════════════════════
('capacity-dna', 'en', 'Capacity DNA',
 'A daily snapshot of your workforce capacity: baseline, effective, committed, and available FTE with shortage and overload scores.',
$$## Where to find it
Workspace → **Resources** tab → **Capacity DNA** panel (admin only).

## What it does
Capacity DNA computes a snapshot of your workforce for any given day:
- **Baseline** — total active members.
- **Effective** — baseline minus members on approved leave today.
- **Committed** — sum of all role allocation percentages (FTE).
- **Available** — effective minus committed.
- **Shortage score** — how far below committed the effective capacity falls.
- **Overload score** — how much committed exceeds effective capacity.

The last 30 days of snapshots are displayed as a trend table.

## How to use it
1. Go to **Resources** tab.
2. Scroll to the **Capacity DNA** panel.
3. Click **Generate snapshot for today** to record the current state.
4. Review the trend table to spot shortage or overload patterns.

## Common actions
- **Generate snapshot** — saves today's baseline / effective / committed / available to history.
- **Trend table** — last 30 days with shortage/overload trend icons (↑ improving, ↓ worsening).

## Troubleshooting
- Snapshots require at least one active member with a role allocation.
- A shortage_score > 0 means there are fewer effective staff than roles require.

## Related
- Resources tab for full capacity overview.
- Timeline view for day-by-day member availability.
$$,
'/enterprise', 'capacity.dna', 'widget',
ARRAY['capacity','DNA','FTE','snapshot','forecast','shortage','overload'],
ARRAY['workforce capacity','kapacitás DNA','resource planning'],
ARRAY['workspace-resources','workspace-members'],
false, true, 'v3.2.0', now()),

('capacity-dna', 'hu', 'Kapacitás DNA',
 'Napi pillanatkép a munkaerő-kapacitásról: alap, effektív, vállalt és szabad FTE hiány- és túlterhelési pontszámmal.',
$$## Hol találod
Munkaterület → **Erőforrások** fül → **Kapacitás DNA** panel (csak adminok).

## Mit csinál
A Kapacitás DNA kiszámítja a munkaerő-kapacitást egy adott napra:
- **Alap** — összes aktív tag.
- **Effektív** — alap mínusz a mai napon jóváhagyott szabadságon lévők.
- **Vállalt** — az összes szerepkör-allokáció százalékának összege (FTE).
- **Szabad** — effektív mínusz vállalt.
- **Hiány pontszám** — mennyivel marad el az effektív kapacitás a vállalttól.
- **Túlterhelési pontszám** — mennyivel haladja meg a vállalt az effektív kapacitást.

Az utolsó 30 nap pillanatképei trend táblázatként jelennek meg.

## Hibaelhárítás
- A pillanatképekhez legalább egy aktív, szerepkör-allokációval rendelkező tag szükséges.
- A hiány_pontszám > 0 azt jelenti, hogy kevesebb effektív munkatárs van, mint amennyit a szerepkörök igényelnek.
$$,
'/enterprise', 'capacity.dna', 'widget',
ARRAY['kapacitás','DNA','FTE','pillanatkép','előrejelzés','hiány','túlterhelés'],
ARRAY['capacity DNA','munkaerő kapacitás','resource planning'],
ARRAY['workspace-resources','workspace-members'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- ORG CHART
-- ══════════════════════════════════════════════════════════
('org-chart', 'en', 'Org Chart',
 'An automatically generated visual of your reporting hierarchy based on manager relationships.',
$$## Where to find it
Workspace → **Organization** tab → **Org chart** sub-tab.

## What it does
The org chart renders the reporting lines derived from the `manager` field on each member''s profile. It updates live as manager assignments change.

## How to use it
1. Go to **Organization → Org chart**.
2. The tree shows every member who has a manager set.
3. Use the **search filter** to find a specific person.
4. Click **Regenerate snapshot** to persist the current tree state to history.

## Common actions
- **Regenerate snapshot** — saves the current chart to `enterprise_org_chart_snapshots`.
- **Search** — filter nodes by member name.
- **Snapshot timestamp** — shows when the last snapshot was taken.

## Troubleshooting
- Members without a manager set do not appear in the chart.
- Set managers via the **Profile Sheet** or the **Invite member** dialog.

## Related
- Organization tab → Structure for org unit hierarchy.
- Members tab → Profile Sheet for setting managers.
$$,
'/enterprise', 'workspace.organization', 'feature',
ARRAY['org chart','hierarchy','reporting','manager','tree'],
ARRAY['szervezeti diagram','reporting line','org tree'],
ARRAY['workspace-organization','workspace-members'],
false, true, 'v3.2.0', now()),

('org-chart', 'hu', 'Szervezeti diagram',
 'Automatikusan generált vizuális ábrázolása a vezető-beosztott hierarchiának.',
$$## Hol találod
Munkaterület → **Szervezet** fül → **Szervezeti diagram** alfül.

## Mit csinál
A szervezeti diagram megjeleníti a beosztási vonalakat a tagok profiljából érkező vezető-mező alapján. Azonnal frissül, ahogy változnak a vezető-hozzárendelések.

## Hibaelhárítás
- A vezető nélküli tagok nem jelennek meg a diagramon.
- Vezető beállítása a **Profilapon** vagy a **Tag meghívása** párbeszéden keresztül lehetséges.
$$,
'/enterprise', 'workspace.organization', 'feature',
ARRAY['szervezeti diagram','hierarchia','vezető','fa'],
ARRAY['org chart','reporting line','org tree'],
ARRAY['workspace-organization','workspace-members'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- COVERAGE PLANNER
-- ══════════════════════════════════════════════════════════
('coverage-planner', 'en', 'Coverage Planner',
 'Visualise daily coverage supply vs. demand by office or team, based on your configured rules.',
$$## Where to find it
Workspace → **Calendar** tab → **Coverage planner** sub-tab.

## What it does
The Coverage Planner shows, for each day and each office/team, whether the minimum staffing rule is met. It compares:
- **Demand** — the required number of people defined in the daily rule.
- **Supply** — the number of people who are actually working (not on leave, not on holiday).

Cells show `demand / supply` (e.g. `4 / 3` means 4 required, 3 available — a gap).

## How to use it
1. Open **Calendar → Coverage planner**.
2. Switch between **weekly** and **monthly** view using the toggle button.
3. Red cells indicate coverage gaps; green cells are fully covered.

## Common actions
- **Weekly / Monthly toggle** — switch between granularity levels.
- **Horizontal scroll** — monthly view scrolls to show all days.
- **Daily rules editor** — in Settings → Daily rules; define minimum staffing per office or team.

## Troubleshooting
- If cells are empty, there are no daily rules configured for this workspace.
- Coverage rules only apply to the days of the week specified in the rule.

## Related
- Calendar tab for leave overview.
- Settings → Daily rules for coverage rule configuration.
$$,
'/enterprise', 'workspace.calendar', 'feature',
ARRAY['coverage','planner','staffing','rules','supply','demand'],
ARRAY['kapacitástervező','lefedettség','staffing'],
ARRAY['workspace-calendar','workspace-settings'],
false, true, 'v3.2.0', now()),

('coverage-planner', 'hu', 'Kapacitástervező',
 'Napi lefedettségi kínálat vs. kereslet vizualizálása iroda vagy csapat szerint, a konfigurált szabályok alapján.',
$$## Hol találod
Munkaterület → **Naptár** fül → **Kapacitástervező** alfül.

## Mit csinál
A Kapacitástervező megmutatja minden napra és irodára/csapatra, hogy teljesül-e a minimális létszámszabály. Összehasonlítja:
- **Kereslet** — a napi szabályban meghatározott szükséges létszám.
- **Kínálat** — a ténylegesen dolgozó emberek száma (nem szabadságon, nem ünnepnapon).

A cellák `kereslet / kínálat` formában jelennek meg (pl. `4 / 3` = 4 szükséges, 3 elérhető — hiány).

## Hibaelhárítás
- Ha a cellák üresek, nincs napi szabály konfigurálva ehhez a munkaterülethez.
- A lefedettségi szabályok csak a szabályban meghatározott heti napokra vonatkoznak.
$$,
'/enterprise', 'workspace.calendar', 'feature',
ARRAY['kapacitástervező','lefedettség','létszám','szabályok','kínálat','kereslet'],
ARRAY['coverage planner','staffing','coverage rules'],
ARRAY['workspace-calendar','workspace-settings'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- LOCALIZATION SETTINGS
-- ══════════════════════════════════════════════════════════
('localization-settings', 'en', 'Localization Settings',
 'Manage workspace language, translation overrides, and export/import translation files.',
$$## Where to find it
Workspace → **Settings** tab → **Localization** section.

## What it does
Effectime ships with English (EN) and Hungarian (HU) translations. The Localization section lets admins:
- See the active language and missing-key counts per locale.
- Export a bilingual CSV for translator review.
- Import a corrected CSV to apply workspace-level translation overrides (these override the built-in strings without a code deployment).

## How to use it
1. Open **Settings → Localization**.
2. Review the missing-key counters.
3. Click **Export CSV** to download `effectime-i18n-YYYY-MM-DD.csv` with all translation keys.
4. Fill in missing or corrected translations in the CSV.
5. Click **Import CSV** and upload the file. A summary shows how many keys were added, updated, or skipped.

## Common actions
- **Export CSV** — downloads a 3-column file: `key, en, hu`.
- **Import CSV** — applies workspace-level overrides immediately; no restart needed.
- **Language selector** — header flag button changes the active language for the current session.

## Troubleshooting
- Imported overrides are workspace-specific — they do not affect other workspaces.
- If a key is missing in the imported CSV it is skipped (not reset).

## Related
- Members → Profile for per-user language preference.
- Settings → General for workspace default language.
$$,
'/enterprise', 'settings.localization', 'setting',
ARRAY['localization','language','translation','CSV','i18n','EN','HU'],
ARRAY['lokalizáció','fordítás','nyelv','language settings'],
ARRAY['workspace-settings','workspace-members'],
false, true, 'v3.2.0', now()),

('localization-settings', 'hu', 'Nyelvi beállítások',
 'Munkaterületi nyelv, fordítási felülbírálatok és fordítási fájlok exportálása/importálása.',
$$## Hol találod
Munkaterület → **Beállítások** fül → **Lokalizáció** szakasz.

## Mit csinál
Az Effectime angol (EN) és magyar (HU) fordításokat tartalmaz. A Lokalizáció szakasz lehetővé teszi az adminoknak:
- Az aktív nyelv és a hiányzó kulcsszámok megtekintését locale-onként.
- Kétnyelvű CSV exportálását fordítói felülvizsgálathoz.
- Korrigált CSV importálását munkaterületi szintű fordítási felülbírálatok alkalmazásához (ezek felülírják a beépített szövegeket kódtelepítés nélkül).

## Hogyan használd
1. Nyisd meg a **Beállítások → Lokalizáció** menüpontot.
2. Tekintsd meg a hiányzó kulcsszámokat.
3. Kattints a **CSV exportálása** gombra az `effectime-i18n-YYYY-MM-DD.csv` letöltéséhez.
4. Töltsd ki a hiányzó vagy javított fordításokat a CSV-ben.
5. Kattints a **CSV importálása** gombra és töltsd fel a fájlt. Az összefoglaló megmutatja, hány kulcs lett hozzáadva, frissítve vagy kihagyva.

## Hibaelhárítás
- Az importált felülbírálatok munkaterület-specifikusak — nem érintik a többi munkaterületet.
- Ha egy kulcs hiányzik az importált CSV-ből, ki lesz hagyva (nem áll vissza alapértelmezettre).
$$,
'/enterprise', 'settings.localization', 'setting',
ARRAY['lokalizáció','nyelv','fordítás','CSV','i18n','EN','HU'],
ARRAY['localization','translation','language settings'],
ARRAY['workspace-settings','workspace-members'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- AUDIT LOG
-- ══════════════════════════════════════════════════════════
('audit-log', 'en', 'Audit Log',
 'An immutable, searchable record of every action taken in the workspace.',
$$## Where to find it
Workspace → **Reports & Audit** tab → **Audit log** section.

## What it does
Every significant action — invitation sent, leave approved, rule changed, member removed — is written as an immutable audit event. The log shows who did what, when, and with what data.

## How to use it
1. Open **Reports & Audit → Audit log**.
2. Use the filters (actor, event type, date range) to narrow the list.
3. Expand an event row to see full metadata.

## Common actions
- **Filter by actor** — enter a member name to see only their actions.
- **Filter by event type** — e.g. `leave_approved`, `member_invited`, `rule_changed`.
- **Date range** — restricts results to a specific period.

## Troubleshooting
- Audit entries cannot be edited or deleted — they are immutable by design.
- Only members with the **audit** view permission can see this section.

## Related
- Approval flow → decisions appear here automatically.
- Export center → for downloadable audit data.
$$,
'/enterprise', 'workspace.reports', 'feature',
ARRAY['audit','log','compliance','history','immutable','events'],
ARRAY['audit napló','activity log','compliance log'],
ARRAY['workspace-reports','approval-flow'],
false, true, 'v3.2.0', now()),

('audit-log', 'hu', 'Audit napló',
 'Megváltoztathatatlan, kereshető nyilvántartás a munkaterületen elvégzett minden műveletről.',
$$## Hol találod
Munkaterület → **Riportok és Audit** fül → **Audit napló** szakasz.

## Mit csinál
Minden jelentős tevékenység — meghívás küldése, szabadság jóváhagyása, szabály módosítása, tag eltávolítása — megváltoztathatatlan audit eseményként kerül rögzítésre. A napló megmutatja, ki mit tett, mikor és milyen adatokkal.

## Hibaelhárítás
- Az audit bejegyzések nem szerkeszthetők és nem törölhetők — tervezetten megváltoztathatatlanok.
- Csak az **audit** megtekintési jogosultsággal rendelkező tagok látják ezt a szakaszt.
$$,
'/enterprise', 'workspace.reports', 'feature',
ARRAY['audit','napló','megfelelés','előzmény','megváltoztathatatlan','események'],
ARRAY['audit log','activity log','compliance log'],
ARRAY['workspace-reports','approval-flow'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- INTEGRATION HEALTH
-- ══════════════════════════════════════════════════════════
('integration-health', 'en', 'Integration Health Center',
 'Monitor the health of your Jira and Azure DevOps integrations and diagnose connection failures.',
$$## Where to find it
Workspace → **Settings** tab → **Integration Health Center** section (admin only).

## What it does
The Integration Health Center lists each configured integration with a health badge:
- **Healthy** — last 5 sync operations all succeeded.
- **Degraded** — some failures in the last 5 operations.
- **Failed** — all recent operations failed.
- **Unknown** — no sync history yet.

It also surfaces the last sync action, status, and the three most recent error excerpts inline.

## How to use it
1. Open **Settings → Integration Health Center**.
2. Review the health badge for each integration.
3. Expand an integration row to see recent error excerpts.
4. Click **Test connection** to run a fresh check.

## Common actions
- **Test connection** — runs a live connection test and updates the health badge.
- **Error excerpts** — shows the last 3 error messages from the sync log.
- **Re-configure** — edit the integration record to fix credentials or URLs.

## Troubleshooting
- "Degraded" often means an expired API token or a changed Jira base URL.
- "Failed" requires checking the error excerpts and re-entering credentials.

## Related
- Settings → Integrations for adding or editing integrations.
- Resources → Agile for using the integration in boards.
$$,
'/enterprise', 'workspace.settings', 'feature',
ARRAY['integration','health','jira','azure','devops','connection','monitoring'],
ARRAY['integráció egészség','connection status','sync health'],
ARRAY['workspace-settings','workspace-agile'],
false, true, 'v3.2.0', now()),

('integration-health', 'hu', 'Integráció egészségi állapot',
 'Figyeld a Jira és Azure DevOps integrációk állapotát és diagnosztizáld a kapcsolódási hibákat.',
$$## Hol találod
Munkaterület → **Beállítások** fül → **Integráció egészségi állapot** szakasz (csak adminok).

## Mit csinál
Az Integráció egészségi állapot panel minden konfigurált integrációt felsorol egy állapot badge-dzsel:
- **Egészséges** — az utolsó 5 szinkronizáció mind sikeres volt.
- **Degradált** — egyes műveletek sikertelenek voltak az utolsó 5-ből.
- **Sikertelen** — az összes közelmúltbeli művelet sikertelen.
- **Ismeretlen** — még nincs szinkronizálási előzmény.

## Hibaelhárítás
- A "Degradált" állapot általában lejárt API tokent vagy megváltozott Jira alap URL-t jelent.
- A "Sikertelen" állapot esetén ellenőrizd a hibaüzeneteket és add meg újra a hitelesítési adatokat.
$$,
'/enterprise', 'workspace.settings', 'feature',
ARRAY['integráció','egészség','jira','azure','devops','kapcsolat','monitorozás'],
ARRAY['integration health','connection status','sync health'],
ARRAY['workspace-settings','workspace-agile'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- COMMAND CENTER
-- ══════════════════════════════════════════════════════════
('command-center', 'en', 'Command Center',
 'A live summary of urgent workspace actions: pending approvals, in-progress onboarding, and incomplete member profiles.',
$$## Where to find it
At the very top of the workspace dashboard (above all tabs), visible to admins only.

## What it does
The Command Center shows four real-time counters:
1. **Pending leave approvals** — requests awaiting your decision.
2. **In-progress onboarding instances** — active onboarding processes.
3. **Pending access requests** — access requests awaiting a decision.
4. **Members with incomplete org metadata** — members missing org unit, manager, contract type, or leadership level.

Each counter is a clickable shortcut to the relevant tab. The widget refreshes every 90 seconds.

If **Recovery Mode** is active, the Command Center shifts to a red-tinted warning card to signal the emergency state.

## Common actions
- **Click a counter** — navigates directly to the relevant tab.
- **Refresh** — the widget refreshes automatically every 90s; no manual refresh needed.

## Related
- Approvals tab for pending leave decisions.
- Workflows tab for onboarding instances.
- Members tab for profile completion.
$$,
'/enterprise', 'home.overview', 'widget',
ARRAY['command center','dashboard','counters','approvals','onboarding','alerts'],
ARRAY['control center','admin overview','workspace summary'],
ARRAY['workspace-members','workspace-approvals','workspace-workflows'],
false, true, 'v3.2.0', now()),

('command-center', 'hu', 'Parancsközpont',
 'Sürgős munkaterületi teendők élő összefoglalója: függő jóváhagyások, folyamatban lévő onboardingok és hiányos profilok.',
$$## Hol találod
A munkaterületi dashboard legtetején (az összes fül felett), csak adminok számára látható.

## Mit csinál
A Parancsközpont négy valós idejű számlálót mutat:
1. **Függő jóváhagyások** — a döntésedre váró kérelmek.
2. **Folyamatban lévő onboarding instanszok** — aktív onboarding folyamatok.
3. **Függő hozzáférési kérelmek** — döntésre váró hozzáférési kérelmek.
4. **Hiányos szervezeti metaadattal rendelkező tagok** — szervezeti egység, vezető, szerződéstípus vagy vezetői szint nélküli tagok.

Minden számláló egy kattintható parancsikon a megfelelő fülhöz. A widget 90 másodpercenként frissül.

## Kapcsolódó
- Kérelmek fül függő döntésekhez.
- Folyamatok fül onboarding instanszokhoz.
- Tagok fül profil kiegészítéséhez.
$$,
'/enterprise', 'home.overview', 'widget',
ARRAY['parancsközpont','dashboard','számlálók','jóváhagyások','onboarding','figyelmeztetések'],
ARRAY['command center','admin overview','workspace summary'],
ARRAY['workspace-members','workspace-approvals','workspace-workflows'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- QUOTA MANAGER
-- ══════════════════════════════════════════════════════════
('quota-manager', 'en', 'Quota Manager',
 'Define annual leave allowances per member and leave type, and manage quota transactions.',
$$## Where to find it
Workspace → **Settings** tab → **Leave quotas** section.

## What it does
The Quota Manager defines how many days of each leave type each member is entitled to per year. It stores allowances, carried-over balances, and individual adjustments (quota transactions).

## How to use it
1. Go to **Settings → Leave quotas**.
2. Select a member and leave type.
3. Enter the annual allowance (e.g. 25 days vacation).
4. Optionally add a manual adjustment (bonus days or deduction).

## Common actions
- **Set allowance** — annual entitlement in days.
- **Add transaction** — manual adjustment (positive = bonus, negative = deduction).
- **View balance** — allowance + carried over - used = remaining.

## Troubleshooting
- Quota balances are visible to members on their Profile Sheet.
- Transactions are date-stamped; only transactions for the current year affect the current balance.

## Related
- Leave request → deducts from quota when approved.
- Profile Sheet → shows leave balance per type.
$$,
'/enterprise', 'workspace.settings', 'setting',
ARRAY['quota','allowance','leave balance','days','annual','entitlement'],
ARRAY['kvóta','éves keret','leave allowance','túlóra'],
ARRAY['leave-request','workspace-settings','workspace-members'],
false, true, 'v3.2.0', now()),

('quota-manager', 'hu', 'Kvóta kezelő',
 'Éves távolléti keretek meghatározása tagonként és távolléttípusonként, kvóta tranzakciók kezelése.',
$$## Hol találod
Munkaterület → **Beállítások** fül → **Távolléti kvóták** szakasz.

## Mit csinál
A Kvóta kezelő meghatározza, hogy minden tag hány napra jogosult az egyes távolléttípusoknál évente. Tárolja a kereteket, átvitt egyenlegeket és egyéni korrekciókat (kvóta tranzakciók).

## Hibaelhárítás
- A kvóta egyenlegek láthatók a tagok számára a Profilapon.
- A tranzakciók dátummal vannak ellátva; csak az aktuális évi tranzakciók befolyásolják az aktuális egyenleget.
$$,
'/enterprise', 'workspace.settings', 'setting',
ARRAY['kvóta','keret','távolléti egyenleg','napok','éves','jogosultság'],
ARRAY['quota','allowance','leave balance','entitlement'],
ARRAY['leave-request','workspace-settings','workspace-members'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- HOLIDAY MANAGER
-- ══════════════════════════════════════════════════════════
('holiday-manager', 'en', 'Holiday Manager',
 'Define public holidays for your workspace so they are automatically excluded from leave day counts.',
$$## Where to find it
Workspace → **Settings** tab → **Holidays** section.

## What it does
Public holidays are excluded from leave day calculations. If you request 5 consecutive days but one is a configured holiday, only 4 days are deducted from your quota.

## How to use it
1. Go to **Settings → Holidays**.
2. Click **Add holiday**.
3. Enter the date and a name (e.g. "National Day").
4. Save. The holiday is now active for all leave requests in this workspace.

## Common actions
- **Add holiday** — single date + name.
- **Delete holiday** — removes the exclusion; future requests recalculate.
- **Import** — bulk-upload holidays from a CSV or national holiday feed (if configured).

## Troubleshooting
- Holidays only affect new leave requests; approved requests are not recalculated.
- If a requested date falls on a configured holiday, it is shown in the conflict check step.

## Related
- Settings → Blocked dates for non-holiday restricted dates.
- Leave request → conflict check step.
$$,
'/enterprise', 'workspace.settings', 'setting',
ARRAY['holiday','public holiday','bank holiday','exclusion','days'],
ARRAY['ünnepnap','munkaszüneti nap','national holiday'],
ARRAY['workspace-settings','leave-request'],
false, true, 'v3.2.0', now()),

('holiday-manager', 'hu', 'Ünnepnap kezelő',
 'Munkaterületi ünnepnapok meghatározása, hogy automatikusan ki legyenek zárva a távolléti napszámításból.',
$$## Hol találod
Munkaterület → **Beállítások** fül → **Ünnepnapok** szakasz.

## Mit csinál
Az ünnepnapok ki vannak zárva a távolléti napszámításból. Ha 5 egymást követő napra kérelmezel, de egy ünnepnap, csak 4 nap kerül levonásra a kvótádból.

## Hogyan használd
1. Lépj a **Beállítások → Ünnepnapok** menüpontba.
2. Kattints az **Ünnepnap hozzáadása** gombra.
3. Add meg a dátumot és a nevet (pl. "Nemzeti ünnep").
4. Mentés. Az ünnepnap most aktív erre a munkaterületre.

## Hibaelhárítás
- Az ünnepnapok csak az új kérelmekre vonatkoznak; a jóváhagyott kérelmek nem kerülnek újraszámításra.
$$,
'/enterprise', 'workspace.settings', 'setting',
ARRAY['ünnepnap','munkaszüneti nap','kizárás','napok'],
ARRAY['holiday','public holiday','bank holiday'],
ARRAY['workspace-settings','leave-request'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- ROLE PERMISSIONS
-- ══════════════════════════════════════════════════════════
('role-permissions', 'en', 'Role Permissions',
 'Control which actions each role can perform using the tree-based permission catalog.',
$$## Where to find it
Workspace → **Settings** tab → **Permissions** section (Owner only).

## What it does
The permission system maps workspace roles (Owner, Resource Assistant, Member) to a tree of feature-level capabilities. Each node in the tree represents a **view** or **edit** permission for a specific feature (e.g. `calendar.view`, `approvals.edit`).

## How to use it
1. Open **Settings → Permissions**.
2. The permission tree mirrors the application navigation.
3. Check or uncheck permissions per role.
4. Changes take effect immediately for new sessions.

## Common actions
- **View permission** — allows reading the feature/section.
- **Edit permission** — allows modifying data in that section.
- **Role selector** — switch between Member and Resource Assistant columns.

## Troubleshooting
- Owners always have full access; their permissions cannot be reduced.
- Permission changes do not log out existing sessions; members must refresh to see the new restrictions.

## Related
- Settings tab → full settings reference.
- Members tab → for assigning roles.
$$,
'/enterprise', 'workspace.settings', 'setting',
ARRAY['permissions','roles','access control','feature flags','authorization'],
ARRAY['jogosultságok','szerepkörök','hozzáférés-szabályozás'],
ARRAY['workspace-settings','workspace-members'],
false, true, 'v3.2.0', now()),

('role-permissions', 'hu', 'Szerepkör jogosultságok',
 'Szabályozd, mely műveleteket hajthat végre az egyes szerepkör a fa alapú jogosultsági katalógus segítségével.',
$$## Hol találod
Munkaterület → **Beállítások** fül → **Jogosultságok** szakasz (csak tulajdonos).

## Mit csinál
A jogosultsági rendszer a munkaterületi szerepköröket (Tulajdonos, Erőforrás-asszisztens, Tag) egy fa-alapú képesség-katalógushoz rendeli hozzá. A fa minden csomópontja egy adott funkció **megtekintési** vagy **szerkesztési** jogosultságát képviseli.

## Hogyan használd
1. Nyisd meg a **Beállítások → Jogosultságok** menüpontot.
2. A jogosultsági fa tükrözi az alkalmazás navigációját.
3. Pipáld be vagy vedd ki a jogosultságokat szerepköröként.
4. A változtatások azonnal érvényesek az új munkamenetekben.

## Hibaelhárítás
- A tulajdonosoknak mindig teljes hozzáférésük van; az ő jogosultságaik nem csökkenthetők.
- A jogosultság-változtatások nem lépnek ki meglévő munkamenetekből; a tagoknak frissíteniük kell az oldalt.
$$,
'/enterprise', 'workspace.settings', 'setting',
ARRAY['jogosultságok','szerepkörök','hozzáférés-szabályozás'],
ARRAY['permissions','roles','access control','authorization'],
ARRAY['workspace-settings','workspace-members'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- DECISION MEMORY
-- ══════════════════════════════════════════════════════════
('decision-memory', 'en', 'Decision Memory',
 'Record the rationale and expected outcomes for important decisions, then capture observed results to close the learning loop.',
$$## Where to find it
- Decision Memory editor: embedded in approvals and access decisions.
- Decision Memory Stale Inbox: Workspace → **Requests** tab → **Decision Memory** section (admin only).

## What it does
Decision Memory lets managers annotate significant decisions with:
- **Rationale** — why this decision was made.
- **Expected outcome** — what we expected to happen.
- **Observed outcome** — what actually happened (captured later).

The Stale Inbox surfaces decisions whose observation window (14 days after the decision) has elapsed without an observed outcome, prompting admins to close the loop.

## How to use it
1. After approving or rejecting a request, click **Add decision note**.
2. Enter the rationale and expected outcome.
3. Two weeks later, open the **Decision Memory Stale Inbox**.
4. For each stale item, enter the observed outcome.

## Troubleshooting
- Only admins see the Stale Inbox.
- Observation window defaults to 14 days; this is set by a database trigger.

## Related
- Approvals tab → where decisions are made.
- Audit log → immutable record of decisions.
$$,
'/enterprise', 'workspace.approvals', 'feature',
ARRAY['decision memory','rationale','outcome','learning','feedback loop'],
ARRAY['döntési emlékezet','rationale','outcome capture'],
ARRAY['workspace-approvals','audit-log'],
false, true, 'v3.2.0', now()),

('decision-memory', 'hu', 'Döntési emlékezet',
 'Rögzítsd a fontos döntések indoklását és várható eredményét, majd rögzítsd a tényleges eredményeket a tanulási kör lezárásához.',
$$## Hol találod
- Döntési emlékezet szerkesztő: beágyazva a jóváhagyásokba és hozzáférési döntésekbe.
- Elavult bejövő: Munkaterület → **Kérelmek** fül → **Döntési emlékezet** szakasz (csak adminok).

## Mit csinál
A Döntési emlékezet lehetővé teszi, hogy a vezetők annotálják a fontos döntéseket:
- **Indoklás** — miért született ez a döntés.
- **Várható eredmény** — mit vártunk.
- **Megfigyelt eredmény** — mi történt valójában (később rögzítve).

Az Elavult bejövő listázza azokat a döntéseket, amelyek megfigyelési ablaka (14 nap a döntés után) megfigyelt eredmény nélkül telt el.

## Hibaelhárítás
- Csak az adminok látják az Elavult bejövőt.
- A megfigyelési ablak alapértelmezetten 14 nap; ezt egy adatbázis trigger állítja be.
$$,
'/enterprise', 'workspace.approvals', 'feature',
ARRAY['döntési emlékezet','indoklás','eredmény','tanulás','visszajelzési kör'],
ARRAY['decision memory','rationale','outcome capture'],
ARRAY['workspace-approvals','audit-log'],
false, true, 'v3.2.0', now()),

-- ══════════════════════════════════════════════════════════
-- ACCESS REQUEST
-- ══════════════════════════════════════════════════════════
('access-request', 'en', 'Access Request',
 'Request access to external systems (Jira, Confluence, ERP, etc.) for a team member through a structured approval process.',
$$## Where to find it
Workspace → **Workflows** tab → **Access Inbox** section.

## What it does
Access requests allow admins to formally request, approve, grant, and revoke external system access for members. Each request routes through the workspace approval chain and is logged in the audit trail.

Supported systems (configurable): Jira, Confluence, Outlook, Dynatrace, ERP, Billing, Entry Control, and any custom system.

## How to use it
1. Go to **Workflows → Access Inbox**.
2. Click **Submit request on behalf of member**.
3. Choose the member and the system bundle (access template).
4. The request routes to the approver(s).
5. Once approved, click **Mark as granted** when access has been provisioned.

## Common actions
- **Approve** — accepts the request; moves to granted state.
- **Reject** — denies access with a reason.
- **Mark as granted** — records that access has been physically provisioned.
- **Revoke** — removes access and records the revocation.

## Related
- Workflows tab → onboarding for new member setup.
- Settings → Access systems for configuring available systems.
$$,
'/enterprise', 'workspace.workflows', 'workflow',
ARRAY['access request','permissions','systems','jira','confluence','ERP','provisioning'],
ARRAY['hozzáférés-kérelem','rendszer-hozzáférés','access management'],
ARRAY['workspace-workflows','workspace-approvals'],
false, true, 'v3.2.0', now()),

('access-request', 'hu', 'Hozzáférési kérelem',
 'Kérj hozzáférést külső rendszerekhez (Jira, Confluence, ERP stb.) csapattagnak strukturált jóváhagyási folyamaton keresztül.',
$$## Hol találod
Munkaterület → **Folyamatok** fül → **Hozzáférés Inbox** szakasz.

## Mit csinál
A hozzáférési kérelmek lehetővé teszik az adminok számára, hogy formálisan kérjenek, jóváhagyjanak, megadjanak és visszavonjanak külső rendszer-hozzáférést tagoknak. Minden kérelem a munkaterület jóváhagyási láncán fut és rögzül az audit naplóban.

Támogatott rendszerek (konfigurálható): Jira, Confluence, Outlook, Dynatrace, ERP, Számlázás, Beléptető, és bármely egyéni rendszer.

## Hibaelhárítás
- A hozzáférési kérelmek ugyanazon a jóváhagyási láncon futnak, mint a távolléti kérelmek.
- A "Megadva" állapot nem automatikus — az adminnak manuálisan kell jelölnie, miután a hozzáférést kiépítette.
$$,
'/enterprise', 'workspace.workflows', 'workflow',
ARRAY['hozzáférési kérelem','jogosultságok','rendszerek','jira','confluence','ERP'],
ARRAY['access request','rendszer-hozzáférés','access management'],
ARRAY['workspace-workflows','workspace-approvals'],
false, true, 'v3.2.0', now())

ON CONFLICT (topic_key, locale) DO NOTHING;
