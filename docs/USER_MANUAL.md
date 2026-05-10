# Effectime Enterprise – Felhasználói kézikönyv

<!-- METADATA -->
| Mező | Érték |
|---|---|
| Dokumentum | USER_MANUAL.md |
| Generálva | 2026-05-10T12:00:00Z |
| Repozitórium | HenrikFaul/effectime-app-enterprise-a95029a1 |
| Branch | claude/create-software-documentation-O7kj1 |
| Revision | 8919c402e74e41bbe83ccf1e6385c92d0fddeada |
| Megbízhatóság | Magas |
| Kapcsolódó dok. | BUSINESS_SYSTEM_REFERENCE.md, PROCESS_FLOWS.md, NAVIGATION_TREE.md |

---

## Tartalomjegyzék

1. [Bejelentkezés / Regisztráció](#1-bejelentkezés--regisztráció)
2. [Munkaterület kiválasztása és létrehozása](#2-munkaterület-kiválasztása-és-létrehozása)
3. [Tag meghívása](#3-tag-meghívása)
4. [Szabadságkérelem beküldése](#4-szabadságkérelem-beküldése)
5. [Jóváhagyási folyamat (admin)](#5-jóváhagyási-folyamat-admin)
6. [Naptár és idővonal használata](#6-naptár-és-idővonal-használata)
7. [Riport generálása és ütemezése](#7-riport-generálása-és-ütemezése)
8. [Agile tábla és kapacitás-elemzés](#8-agile-tábla-és-kapacitás-elemzés)
9. [Szervezeti struktúra karbantartása](#9-szervezeti-struktúra-karbantartása)
10. [Beállítások módosítása](#10-beállítások-módosítása)

---

## 1. Bejelentkezés / Regisztráció

### Hozzáférés
Az alkalmazás elérhető a webes felületen keresztül. A bejelentkezési oldal a `/#/auth` útvonalon érhető el.

### Regisztráció (új felhasználó)
1. Nyissa meg az alkalmazást böngészőben
2. Kattintson a **„Regisztráció"** gombra
3. Adja meg e-mail címét és jelszavát, majd kattintson a **„Regisztrálok"** gombra
4. Ellenőrizze e-mail postaládáját – megerősítő e-mailt kap
5. Kattintson az e-mailben lévő linkre a fiók aktiválásához

### Bejelentkezés meglévő fiókkal
**E-mail + jelszóval:**
1. Adja meg e-mail címét és jelszavát
2. Kattintson a **„Bejelentkezés"** gombra

**Google fiókkal (OAuth):**
1. Kattintson a **„Bejelentkezés Google-lal"** gombra
2. Válassza ki Google-fiókját
3. Engedélyezze az alkalmazás hozzáférését

**Magic Link (varázslink):**
1. Adja meg e-mail címét
2. Kattintson a **„Varázslink küldése"** gombra
3. Nyissa meg az e-mailt és kattintson a linkre – automatikusan bejelentkezik

### Elfelejtett jelszó
1. Kattintson az **„Elfelejtett jelszó?"** linkre
2. Adja meg e-mail címét
3. Kövesse az e-mailben kapott utasításokat (`/#/reset-password` oldalon)

### Kijelentkezés
A felső sarokban lévő profilmenüben válassza a **„Kijelentkezés"** lehetőséget.

---

## 2. Munkaterület kiválasztása és létrehozása

### Mit jelent a munkaterület?
Minden szervezet saját munkaterületen (workspace) dolgozik. Ha több szervezethez is tartozik, több munkaterület közül választhat.

### Meglévő munkaterület megnyitása
1. Bejelentkezés után a rendszer automatikusan az utoljára használt munkaterületre navigál
2. Más munkaterületre váltáshoz: kattintson a munkaterület-nevére a fejlécben
3. A lista megmutatja az összes elérhető munkaterületet
4. Kattintson a kívánt munkaterületre

### Új munkaterület létrehozása
1. A munkaterület-listában kattintson az **„Új munkaterület"** gombra
2. Adja meg a munkaterület nevét
3. Válassza ki az időzónát (timezone)
4. Válassza ki a nyelvet (locale: HU vagy EN)
5. Kattintson a **„Létrehozás"** gombra
6. A rendszer az új munkaterületre navigál – konfigurálhatja a beállításokat

### Munkaterületre csatlakozás meghívóval
1. Nyissa meg a kapott meghívó e-mailt
2. Kattintson a **„Csatlakozás"** linkre
3. Ha még nincs fiókja, regisztráljon – a rendszer automatikusan hozzáadja a munkaterülethez
4. Ha már van fiókja, bejelentkezés után automatikusan a munkaterületre kerül

---

## 3. Tag meghívása

> **Szükséges jogosultság:** owner vagy resourceAssistant szerepkör

### Meghívás folyamata
1. Nyissa meg a kívánt munkaterületet
2. Kattintson a **„Tagok"** fülre (felső navigáció)
3. Kattintson az **„Meghívás"** gombra
4. Adja meg a meghívandó személy e-mail címét
5. Válassza ki a szerepkört:
   - **Tag (member)**: korlátozott, csak saját kérelmeit kezeli
   - **Erőforrás asszisztens (resourceAssistant)**: admin szintű hozzáférés
   - **Tulajdonos (owner)**: teljes hozzáférés
6. Opcionálisan állítsa be a csapatot, helyszínt, munkakört
7. Kattintson a **„Meghívó küldése"** gombra

### Meghívott tag elfogadja a meghívást
- A meghívott e-mailt kap a csatlakozási linkkel
- A linkre kattintva regisztrálhat vagy bejelentkezhet
- Sikeres csatlakozás után megjelenik a Tagok listában

### Azonnali tag-létrehozás
Meghívó e-mail nélküli azonnali hozzáadás is lehetséges (admin funkció) – a rendszer a `create-instant-enterprise-member` edge function-t használja.

---

## 4. Szabadságkérelem beküldése

### Belépési pont
Munkaterület → **„Kérelmek"** fül

### Egyenleg megtekintése
A fül megnyitásakor a **QuotaBalanceCard** mutatja az éves szabadságegyenleget:
- Összes napok száma
- Felhasznált napok
- Maradék napok

### Kérelem beküldése
1. Kattintson az **„Új kérelem"** gombra
2. Válassza ki a **szabadságtípust** (éves szabadság, betegszabadság, stb.)
3. Válassza ki a **kezdő dátumot**
4. Válassza ki a **befejező dátumot**
5. Ha félnapos szabadságot szeretne:
   - Jelölje be a **„Félnapos"** opciót
   - Válassza ki: **„Délelőtt"** vagy **„Délután"**
6. Ha a kérelem privát (más tagok ne lássák a részleteket):
   - Jelölje be a **„Privát"** opciót
7. Adjon meg megjegyzést (opcionális)
8. Kattintson az **„Ellenőrzés"** gombra

### Ütközésellenőrzés (Conflict Check)
A rendszer automatikusan ellenőrzi:

**Blokkoló ütközések (nem folytatható):**
- Az időszak ünnepnapba esik
- Tiltott nap (blocked date) érintett
- Van már saját, függő kérelem ugyanarra az időszakra

**Figyelmeztetések (folytatható):**
- A csapatból/workspace-ből túl sokan lesznek egyidejűleg távol (max_absent limit)
- Egy kolléga hasonló időszakra nyújtott be kérelmet

9. Ha nincs blokkoló ütközés, kattintson a **„Beküldés"** gombra
10. A rendszer e-mailben értesíti a jóváhagyókat

### Kérelem visszavonása
1. A Kérelmek listában keresse meg a kérelmet
2. Kattintson a **„Visszavonás"** gombra
3. Adja meg a visszavonás okát (opcionális)
4. Erősítse meg

### Helyettesítési felkérés
- **SubstituteInbox**: ha valaki helyettesítési kéréssel fordult Önhöz, itt találja
- Elfogadás vagy visszautasítás lehetséges

---

## 5. Jóváhagyási folyamat (admin)

> **Szükséges jogosultság:** owner vagy resourceAssistant szerepkör

### Jóváhagyó inbox elérése
Munkaterület → **„Kérelmek"** fül → **„Jóváhagyások"** szekció (összecsukható)

### Kérelem jóváhagyása / elutasítása
1. A **ApprovalInbox**-ban megjelenik az összes várakozó kérelem
2. Kattintson egy kérelemre a részletek megtekintéséhez:
   - Kérelmező neve
   - Szabadság típusa és időszaka
   - Ütközési figyelmeztetések (ha vannak)
3. Kattintson a **„Jóváhagyás"** vagy **„Elutasítás"** gombra
4. Megadhat megjegyzést a döntéshez
5. Erősítse meg – a kérelmező e-mailben értesítést kap

### Tömeges jóváhagyás / elutasítás
1. Jelöljön be több kérelmet a listában
2. Kattintson a **„Tömeges jóváhagyás"** vagy **„Tömeges elutasítás"** gombra
3. Erősítse meg a műveletet

### Admin felülbírálat (Admin Override)
Ha szükséges, az admin felülbírálhatja a rendszer döntését:
- **AdminLeaveOverride** komponens
- Indoklás kötelező

### Eszkalált kérelmek
Ha egy jóváhagyó nem válaszolt a beállított időn belül, a kérelem automatikusan eszkalálódik. Ilyen esetben e-mail értesítést kap az adminisztrátor.

### Jóváhagyási lánc konfigurálása
Munkaterület → **„Kérelmek"** fül → **„Szabályok"** → **„Jóváhagyási láncok"**

1. Kattintson az **„Új lánc"** gombra
2. Adja meg a lánc nevét
3. Adjon hozzá lépéseket (jóváhagyó személyek vagy szerepkörök)
4. Állítsa be az eszkalációs időt (óra)
5. Mentse a láncot

---

## 6. Naptár és idővonal használata

### Belépési pont
Munkaterület → **„Naptár"** fül

### Nézetek közötti váltás
A naptár négy nézetben érhető el (sub-tab gombok):
- **Havi nézet** – klasszikus havi naptár
- **Idővonal** – minden tag egy sorban, időrendi megjelenítés
- **Kapacitástervező** – napi kapacitás és lefedettség
- **Éves nézet** – az egész év egy áttekintésben

### Havi nézet használata
1. Az aktuális hónapot a naptár automatikusan mutatja
2. A `<` és `>` nyilakkal lapozhat hónapok között
3. Különböző színek jelzik a szabadságtípusokat
4. Kattintson egy napra az azon belüli kérelmek részleteihez
5. A **BirthdayAnniversaryWidget** mutatja a közelgő születésnapokat/évfordulókat

### Idővonal nézet használata
1. Minden sor egy csapattagot képvisel
2. Vízszintesen az idő halad
3. Hónapváltás: a navigációs nyilakkal
4. Görgethető vertikálisan és horizontálisan
5. **SkillCapacityReport**: a nézet alatt a készség-kapacitás összesítő

### Kapacitástervező használata
1. A nézet mutatja a napi lefedettséget pozíciónként/készségenként
2. Piros szín: lefedettségi hiány
3. Zöld szín: elegendő fedettség
4. Kattintson egy napra a részletek megtekintéséhez

### Éves nézet használata
1. A rács soronként tagokat, oszloponként napokat mutat
2. Szín jelzi a szabadság típusát
3. Gyors áttekintés az egész csapat éves tervéhez

### Szűrők alkalmazása
A jobb felső sarokban lévő szűrő ikonra kattintva szűrhet:
- Csapat szerint
- Tag szerint
- Szabadság típus szerint

### iCal feliratkozás (naptár szinkronizáció)
1. Menjen a **„Beállítások"** → **„iCal"** szekcióba
2. Másolja ki a feed URL-t
3. Illessze be Google Calendar-ba, Outlook-ba vagy más naptár alkalmazásba

---

## 7. Riport generálása és ütemezése

> **Szükséges jogosultság:** `canView('reports')` jogosultság szükséges

### Belépési pont
Munkaterület → **„Riportok"** fül

### Riport futtatása
1. Válassza ki a kívánt riport típust a listából
2. Állítsa be a szűrési paramétereket:
   - Dátum tartomány
   - Csapatok
   - Tagok
   - Szabadság típusok
3. Kattintson a **„Futtatás"** gombra
4. A riport eredménye táblázatban jelenik meg

### Riport exportálása
1. A riport megtekintése után kattintson az **„Export"** gombra
2. Válassza ki a formátumot (CSV stb.)
3. A fájl automatikusan letöltődik

### Ütemezett riport beállítása
1. Futtassa le a kívánt riportot
2. Kattintson az **„Ütemezés"** gombra
3. Állítsa be:
   - Gyakoriság (napi, heti, havi)
   - Küldési időpont
   - Célcím e-mail
4. Mentse az ütemezést

### Audit napló megtekintése
Munkaterület → **„Riportok"** fül → **„Audit"** szekció (vagy Settings → Audit Log)

1. Válassza ki a dátum tartományt
2. Szűrhet felhasználó vagy esemény típus szerint
3. A napló mutatja: ki, mit, mikor tett

---

## 8. Agile tábla és kapacitás-elemzés

> **Szükséges jogosultság:** Erőforrások tab elérése + Jira/ADO integráció konfigurálva

### Belépési pont
Munkaterület → **„Erőforrások"** fül → **„Agile"** sub-tab

### Integráció beállítása (egyszer szükséges)
1. Menjen a **„Beállítások"** → **„Integrációk"** szekcióba
2. Válassza ki a Jira vagy Azure DevOps opciót
3. Adja meg a szükséges hitelesítési adatokat (Jira: OAuth; ADO: PAT token)
4. Kattintson a **„Csatlakozás"** gombra és tesztelje a kapcsolatot

### Agile tábla használata
**Kanban nézet:**
1. Az issue-k oszloponként jelennek meg (To Do, In Progress, Done stb.)
2. Húzza a kártyákat az oszlopok között az állapot módosításához
3. Kattintson egy kártyára a részletek megtekintéséhez (JiraIssueEditor)
4. A változás automatikusan visszaíródik a forrásrendszerbe

**Scrum nézet:**
1. Sprints alapú megjelenítés
2. Sprint váltás a legördülő menüből

**Gantt nézet:**
1. Időalapú projekt-tervező nézet
2. Feladatok sávjai mutatják az időbeli eloszlást

### Kapacitás-illeszkedés elemzése (CapacityFit)
1. Az Agile panelen nyissa meg a **„CapacityFit"** nézetet
2. A rendszer összehasonlítja:
   - Az issue-k becsült munkaóráit
   - A csapat rendelkezésre álló kapacitását (szabadságok figyelembevételével)
3. Zöld: elegendő kapacitás; Piros: kapacitás hiány

### Backlog böngésző
1. A **BacklogBrowser** mutatja az összes nem ütemezett issue-t
2. Szűrhet prioritás, label, assignee szerint
3. Húzással adhat hozzá issue-kat sprintekhez

---

## 9. Szervezeti struktúra karbantartása

> **Szükséges jogosultság:** owner vagy resourceAssistant szerepkör

### Belépési pont
Munkaterület → **„Szervezet"** fül

### Szervezeti egységek kezelése (structure)
1. Kattintson a **„Szervezet"** → **„Struktúra"** sub-tabra
2. Az egységek faszerkezetben jelennek meg
3. Új egység hozzáadása: **„+ Hozzáadás"** gomb
4. Egység szerkesztése: kattintson az egység nevére
5. Egységek között hierarchia beállítható (szülő-gyermek kapcsolat)

### Org Chart (szervezeti ábra)
1. Kattintson a **„Szervezet"** → **„Org Chart"** sub-tabra
2. Az ábra vizuálisan mutatja a hierarchiát
3. **Navigálás**: egér húzásával mozgatható (pan), görgővel zoomolható
4. **Teljes képernyős nézet**: kattintson a teljes képernyős gombra
5. Snapshots: az aktuális állapot elmentése jövőbeli összehasonlításhoz

### Állásfamiliák kezelése (job_families)
1. Kattintson a **„Szervezet"** → **„Állásfamilák"** sub-tabra
2. Új állásfamília: **„+ Hozzáadás"**
3. Szerkesztés: kattintson a névre
4. Állásfamilák az erőforrás-tervező számára is hasznosak

### Szerződéstípusok kezelése (contracts)
1. Kattintson a **„Szervezet"** → **„Szerződéstípusok"** sub-tabra
2. Határozza meg a szervezetben használt szerződéstípusokat
3. A tagokhoz rendelt szerződéstípus befolyásolja a szabadságszabályokat (inferred)

### Munkakategóriák kezelése (categories)
1. Kattintson a **„Szervezet"** → **„Munkakategóriák"** sub-tabra
2. Kategóriák segítenek csoportosítani a munkakörök típusait

---

## 10. Beállítások módosítása

> **Szükséges jogosultság:** `canView('settings')` – általában owner vagy resourceAssistant

### Belépési pont
Munkaterület → **„Beállítások"** fül

### Általános beállítások (General)
1. Kattintson a **„Általános"** szekcióra
2. Módosítható:
   - Munkaterület neve
   - Időzóna (timezone)
   - Alapértelmezett nyelv (locale: HU/EN)
3. Mentse a változásokat

### Szabadságtípusok beállítása (Leave Types)
1. Kattintson a **„Szabadságtípusok"** szekcióra
2. Látja az összes definiált típust (éves szabadság, betegszabadság stb.)
3. Új típus: **„+ Hozzáadás"**
4. Meglévő szerkesztése: kattintson a típusra
5. Beállítható: név, szín, maximális napok, jóváhagyás kötelező-e, stb.

### Ünnepnapok kezelése (Holidays)
1. Kattintson a **„Ünnepnapok"** szekcióra
2. Látja az aktuális évi ünnepnapokat
3. Manuális hozzáadás: **„+ Hozzáadás"**
4. Automatikus szinkronizáció: **„Szinkronizálás"** gomb (külső API-ból)

### Jogosultságok konfigurálása (Role Permissions)
1. Kattintson a **„Szerepkör jogosultságok"** szekcióra
2. A mátrix mutatja, melyik szerepkörnek milyen jogosultsága van
3. Admin/resourceAssistant szerkeszthetik a member szerepkör jogosultságait
4. Mentse a változásokat

### Integrációk beállítása (Integrations)
1. Kattintson az **„Integrációk"** szekcióra
2. Elérhető integrációk:
   - **Jira** (OAuth alapú): Agile panel szinkronizációhoz
   - **Azure DevOps** (PAT token): Agile panel szinkronizációhoz
   - **iCal**: naptár feed
   - **Email** (Resend/SMTP): értesítési e-mailek
3. Kattintson az integráció nevére a konfigurációhoz
4. Adja meg a szükséges hitelesítési adatokat
5. Tesztelje a kapcsolatot az **„Integration Health"** szekcióban

### Lokalizáció (Localization)
1. Kattintson a **„Lokalizáció"** szekcióra
2. Módosíthatja vagy felülírhatja az alkalmazás szövegeit (workspace-szintű overrides)
3. CSV-ből is importálható fordítás

### Branding (Arculat)
1. Kattintson a **„Branding"** szekcióra
2. Feltöltheti a céglogót
3. Beállíthatja a márka színeit

### CSV Import (Adatimport)
1. Kattintson a **„CSV Import"** szekcióra
2. Töltse le a sablon CSV fájlt
3. Töltse ki az adatokat a sablonban
4. Töltse fel a kész fájlt
5. Ellenőrizze az előnézetet, majd erősítse meg az importot

### Értesítések (Notifications)
1. Kattintson az **„Értesítések"** szekcióra
2. Engedélyezze/tiltsa az értesítési típusokat
3. **Notification Preferences**: egyéni beállítások felhasználónként

### Helyreállítási mód (Recovery Mode)
1. Kattintson a **„Helyreállítási mód"** szekcióra
2. Ha engedélyezi, a workspace olvasható de nem módosítható
3. Vészhelyzetben segíthet az adatok megvédésében
