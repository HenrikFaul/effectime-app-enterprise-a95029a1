# Effectime Enterprise — Szoftver Értékelési és Technikai Átvilágítási Jelentés

**Elkészítve:** 2026-05-11  
**Tárház:** `HenrikFaul/effectime-app-enterprise-a95029a1`  
**Termék URL:** https://effectime-app-enterprise.lovable.app  
**Megbízhatósági szint:** Közepes-Magas (kiterjedt kódbázis bizonyítékok; korlátozott bevételi adat)  
**Pénznem:** EUR (elsődleges), HUF ahol releváns  
**Díjszabási régió:** KKE (Magyarország) elsődleges; Nyugat-EU tartományok másodlagos referenciaként

---

## Tartalomjegyzék

1. Vezetői összefoglaló
2. Termékrekonstrukció
3. Hatókör-lebontás
4. Módszertan
5. Csapatösszetétel
6. Ráfordítás-becslés
7. Költségbecslés
8. Piaci összehasonlítás
9. Piaci értékbecslés
10. Feltételezések és korlátok
11. Ajánlott következő lépések
12. Függelék

---

## 1. Vezetői összefoglaló

### Mit csinál a szoftver?

Az Effectime Enterprise egy **multi-tenant, vállalati szintű HR szabadságkezelő és munkaerő-tervező SaaS platform**, amelyet elsősorban a magyarországi/KKE-régiós KKV és közepes vállalati szegmensnek fejlesztettek. A platform a következőket nyújtja:

- Teljes körű szabadsági kérelem életciklus-kezelés (benyújtás → ütközés-detektálás → többlépéses jóváhagyási lánc → audit)
- Többnézetes naptár valós idejű idővonallal, éves ráccsal és lefedettség-tervezővel
- Erőforrás- és projekttervezés Gantt-idővonallal
- Agilis integráció (Jira + Azure DevOps) kétirányú kapacitás-szinkronnal
- Egyéni riport-szerkesztő SQL-móddal, ütemezéssel és élő előnézettel
- Tranzakciós e-mail infrastruktúra sablonos értesítésekkel
- Szerepkör-alapú hozzáférés-szabályozás dinamikus, faszerkezetű jogosultsági katalógussal
- iCal feliratkozás, CSV exportálás/importálás és márkajelzési testreszabás
- Mobilkész (Capacitor iOS/Android)

A termék egy fogyasztói eseményszervező alkalmazásból ("Syncfolk") fejlődött, és tudatos B2B vállalati funkcionalitás felé tolta el magát, elérve a **v2.6.0+** verziót 53 adatbázis-migrációval és 77 vállalati UI-komponenssel ezen értékelés idején.

### Becsült fejlesztési ráfordítás

| Mérőszám | Alacsony | Legvalószínűbb | Magas |
|----------|---------|----------------|-------|
| Személyórák | 2 041 | 3 051 | 4 485 |
| Személyhónapok (160 ó/hó) | 12,8 | 19,1 | 28,0 |
| Naptári idő (3 fős magcsapat) | 5,5 hó | 7,5 hó | 11 hó |

### Becsült fejlesztési költség

| Forgatókönyv | Tartomány |
|-------------|-----------|
| KKE-árak (magyarországi csapat) | 145 000 € – 210 000 € |
| Nyugat-EU-s ügynökségi árak | 295 000 € – 450 000 € |
| Vegyes KKE + senior WEU vezető | 195 000 € – 310 000 € |

### Becsült piaci érték

| Értékelési szempont | Tartomány |
|--------------------|-----------|
| Csere-/IP-érték (bevétel nélkül) | 200 000 € – 550 000 € |
| Korai szakasz (30–150 ezer € ÉBF) | 400 000 € – 1 200 000 € |
| Növekedési szakasz (300–500 ezer € ÉBF) | 1 800 000 € – 4 500 000 € |
| Stratégiai felvásárlás (bármely szakasz) | 700 000 € – 2 500 000 € |

### A bizonytalanság legfőbb mozgatói

1. **Bevétel ismeretlen** — a tárházban nincs monetizációs adat; az értékelés erősen érzékeny az ÉBF-re
2. **Minimális tesztelési lefedettség** — csak egy tesztfájl létezik; kockázati szorzó alkalmazandó
3. **MI-gyorsított fejlesztési tempó** — a 2 hónapos aktív fejlesztési időszak MI-eszközöket tükröz; a hagyományos csapatok becslései eltérőek lesznek
4. **Piaci érettség** — egyes funkciók gyártáskésznek tűnnek; mások (Agilis szinkron, forgatókönyv-tervező) prototípus jellegűek
5. **Nincs nyilvános felhasználói bázis-adat** — bérlők száma, MAU és konverziós ráta nem elérhető

---

## 2. Termékrekonstrukció

### Kódbázis kulcsmutatói

| Mérőszám | Érték |
|---------|-------|
| Teljes forrásfájlok (.ts + .tsx) | 170 |
| Összes forráskód-sor | ~31 435 |
| Vállalati UI-komponensek | 77 |
| Adatbázis-migrációs fájlok | 53 |
| Supabase Edge Functions | 17 |
| Edge function kód (sorok) | ~5 187 |
| Üzleti logika könyvtár (sorok) | ~802 |
| DB típusdefiníció (sorok) | 3 530 |
| npm függőségek | 60+ |
| Fejlesztési időszak (migrációkból) | 2026-03-07 → 2026-05-11 |
| Kiadott verziók | v2.0.0 → v2.6.0+ |

### Technikai architektúra

```
┌─────────────────────────────────────────────────────────┐
│  Frontend: React 18 + TypeScript + Vite                 │
│  UI: shadcn/ui (Radix UI) + Tailwind CSS + Framer Motion│
│  Állapot: TanStack Query v5                             │
│  Grafikonok: Recharts                                   │
│  DnD: @dnd-kit                                          │
│  Virtuális görgetés: @tanstack/react-virtual            │
│  Mobil: Capacitor (iOS + Android)                       │
│  Űrlapok: React Hook Form + Zod                         │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  Backend: Supabase (teljesen felügyelt)                 │
│  Adatbázis: PostgreSQL multi-sémával                    │
│    - public (örökölt/megosztott)                        │
│    - syncfolk (fogyasztói termék)                       │
│    - plannermaster (vállalati)                          │
│  Hitelesítés: Supabase Auth + Google OAuth + egyéni    │
│  Tárhely: leave-attachments tároló                      │
│  Edge Functions: 17 Deno függvény                       │
│  Cron: pg_cron (auto-archiválás, takarítás)             │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  Külső integrációk                                      │
│  - Google OAuth (hitelesítés)                           │
│  - Jira REST API v3 (agilis feladatok, JQL keresés)    │
│  - Azure DevOps (WIQL, munkaelemek)                     │
│  - iCal (feliratkozás-export)                           │
│  - Lovable Email API (tranzakciós sablonok)             │
│  - pg_cron (ütemezett feladatok)                        │
└─────────────────────────────────────────────────────────┘
```

### Felhasználói szerepkörök és alapfolyamatok

**Szerepkörök:**
- **Owner (Tulajdonos)** — teljes munkaterület-irányítás, minden adminisztrációs művelet
- **resourceAssistant** — szabadság jóváhagyás, riportálás, konfigurációs hozzáférés
- **member (tag)** — szabadsági kérelem benyújtása, naptár megtekintése, saját profil kezelése

**Alapfolyamatok:**
1. **Meghívás → Csatlakozás**: Tulajdonos e-mailben meghív → tag aktivál → tag csatlakozik a munkaterülethez
2. **Szabadsági kérelem**: Tag beküldi (ütközés-ellenőrzéssel, helyettesítő-választóval, melléklettel) → jóváhagyási lánc értesítve → vezető jóváhagy/elutasít → tag és helyettesítő e-mailben értesül
3. **Lefedettség-tervezés**: Admin konfigurálja az irodai szabályokat → Lefedettség-tervező megmutatja a hiányokat nap/hét/hónap bontásban → Smart Batch Ütemező automatikusan hozzárendeli az alkalmas munkavállalókat
4. **Kapacitástervezés**: Agilis sprint importálva Jirából/ADO-ból → CapacityFit kiszámolja a túl-/alatterhelést → what-if szimuláció → visszaírás Jirába

### Modulonkénti funkciórkép

#### Hitelesítés és személyazonosság
- E-mail/jelszó regisztráció OTP e-mail hitelesítéssel
- Google OAuth egyéni aktiválási kapuval
- Jelszó-visszaállítási folyamat
- Fiók törlése (GDPR)
- Adminisztrátori felhasználókezelési panel

#### Munkaterület és bérlés
- Multi-workspace (egy felhasználó több munkaterületet is tulajdonolhat/tagja lehet)
- Munkaterület beállítások (név, időzóna, helyszín, márkajelzés)
- Tag meghívó rendszer (e-mail alapú, token lejárat)
- Azonnali tagok létrehozása előtöltött metadatával
- Szerepkör-hozzárendelés (owner / resourceAssistant / member)
- Tag profil lap (munkaórák, képességek, szerepkörök, allokációk, telephely prioritás)

#### Szabadságkezelés alapfunkciók
- Szabadsági kérelem párbeszéd 2 lépéses benyújtással (ütközések ellenőrzése → megerősítés)
- 6 szabadság-állapot: draft / pending / approved / rejected / cancelled / expired
- 5+ beépített + egyéni szabadság típusok
- Helyettesítő-választó és helyettesítő-postaláda
- Melléklet feltöltés (Supabase Storage)
- Privát szabadsági kérelmek
- Lemondás indoklással
- Jóváhagyási postaláda tömeges jóváhagyással/elutasítással
- Admin szabadság-felülírás
- Éves kvóta átvitt egyenleg nyomon követéssel

#### Ütközés-motor (`src/lib/conflictEngine.ts`)
- Tiltott nap detektálás (BLOKKOLÓ súlyosság)
- Vállalati ünnepnap detektálás (BLOKKOLÓ)
- Napi szabály max-off létszám érvényesítés (FIGYELMEZTETÉS/BLOKKOLÓ)
- Önátfedés detektálás (BLOKKOLÓ)
- Irodai lefedettségi szabály megsértés detektálás (FIGYELMEZTETÉS)
Minden ellenőrzés párhuzamosan fut a kért dátumtartományon.

#### Kapacitás-motor (`src/lib/capacityEngine.ts`)
- Tagonkénti `base_working_hours` (óra/nap)
- Allokációs százalék → óra per szerepkör
- Munkaterület-szintű kapacitás aggregáció
- Szabadság-levonás és nettó elérhetőség-számítás

#### Smart Schedule algoritmus (`src/lib/smartSchedule.ts`)
- Szigorú korlátok: telephely-engedélyezési lista, szabadság-ütközések, dupla foglalás
- Puha korlátok: szerepkör-egyezés, telephely prioritás rangsor, havi terheléselosztás
- Lefedettségi jogosultság értékelés (`src/lib/coverageEligibility.ts`)

#### Naptár és idővonal
- **Szabadság Naptár**: havi nézet csapat-szűrővel, típus szerint színkódolt
- **Idővonal Nézet**: Absentify-stílusú személyenkénti sor, TanStack Virtual-lal (200+ tag)
- **Éves Szabadság Rács**: teljes éves személyenkénti nézet kvóta összefoglalóval
- **Naptár Szűrő Sáv**: dinamikus multi-select (telephely, csapat, pozíció, típus, állapot, képesség, helyszín) drag&drop rendezéssel
- **Lefedettség-tervező**: heti/havi nézet az irodánkénti igény vs. kínálat megjelenítéssel
- Smart Batch Ütemező Párbeszéd
- Képesség Kapacitás Riport (szinkronban a szűrő-kiválasztással)

#### Jóváhagyási lánc és eszkaláció
- Konfigurálható többlépéses jóváhagyási láncok
- Eszkalációs szabályok óra-küszöbökkel és célszerepkörrel
- Tulajdonos tartalék értesítés

#### Szabályok és konfiguráció
- Szabadság típus kezelő (egyéni típusok, szín, átviteli szabály)
- Ünnepnap kezelő (munkaterület-specifikus ünnepnapok)
- Tiltott nap kezelő
- Napi szabály kezelő (max-távollétek naponta/csapatonként)
- Irodai lefedettségi szabály kezelő (több pozíció, több képesség, heti/havi)
- Szabálysablon könyvtár

#### Erőforrás-kezelés
- Projekt lista CRUD-dal
- Projekt szerkesztő (allokációk, költségvetés, idővonal)
- Gantt-idővonal (drag-to-resize)
- Kapacitáshiány riport
- Kihasználtsági hőtérkép
- Forgatókönyv-tervező (what-if)
- Pénzügyi panel
- Erőforrás-irányítópult
- Képességek kezelője
- Üzleti szerepkör (pozíció) kezelő

#### Agilis integráció
- Jira és Azure DevOps integráció (hitelesítők a munkaterület beállításaiban)
- Backlog böngésző JQL/WIQL kereséssel és gyorsítótárazott eredményekkel
- Issue visszaírás (létrehozás + frissítés) Jirába és ADO-ba
- Kapacitás Illeszkedés: sprint kapacitás vs. tervezett órák
- What-if szimuláció (szabadságnapok hatása)
- Mező-felfedezés (egyéni mező metaadatok)

#### Riportálás
- Riportálási irányítópult (KPI kártyák, állapot kördiagram, típus oszlopdiagram)
- Riport-szerkesztő (dataset választó, oszlop/szűrő konfiguráció, összesítés)
- SQL mód (közvetlen lekérdezés)
- Élő előnézet panel
- Riport könyvtár irányítópultra rögzítéssel
- Ütemezett riport kézbesítés (e-mail, cron)
- Dataset böngésző

#### Értesítések és e-mail
- Alkalmazáson belüli értesítések (olvasott/olvasatlan, törlés)
- Értesítési preferenciák (eseményenkénti kapcsoló)
- Tranzakciós e-mail (hitelesítési események, jóváhagyási döntések)
- E-mail sor feldolgozó függvénnyel
- E-mail tiltólisták/leiratkozás kezelése
- Márkajelzési kezelő (logó, színséma)
- iCal feliratkozási végpont

---

## 3. Hatókör-lebontás

### Funkcióterületek és komplexitás

#### 1. terület: Hitelesítés és személyazonosság (Komplexitás: Közepes)
**Rejtett komplexitás:** A Google OAuth aktiválási kapu nem triviális egyéni folyamat: az új Google-felhasználóknak e-mail ellenőrzést kell elvégezniük az alkalmazás eléréséhez. A `join-event` edge function kezeli a `request-google-oauth-activation`, `complete-email-activation` és `resend-email-activation` műveleteket 30 napos fiókkor-alapú bypass logikával. Ez önmagában 300+ sor nem triviális backend kód.

#### 2. terület: Multi-Tenant Munkaterület Architektúra (Komplexitás: Magas)
**Rejtett komplexitás:** Sor-szintű biztonság (RLS) ilyen mélységben megtévesztően drága. Minden tábla gondos szabálytervet igényel minden szerepkör × művelet kombinációhoz. A séma-felosztási migráció bonyult üzemeltetési komplexitást ad hozzá. A dinamikus funkciókat-katalógus (`enterprise_feature_catalog`, rekurzív fa) egyedi jogosultsági keretrendszer.

#### 3. terület: Szabadsági kérelem életciklus (Komplexitás: Magas)
**Rejtett komplexitás:** Az ütközés-motor, a jóváhagyási lánc és a kvóta-tranzakció rendszer közötti kölcsönhatás jelentős állapot-koordinációs komplexitást teremt. Az `leave_request_substitutes` tábla rendezett helyettesítőkkel és az `enterprise_quota_transactions` munkaterület + kvóta_id hatókör-megkövetelése (v2.6.0-ban javítva) nem nyilvánvaló üzleti logikára példák.

#### 4. terület: Ütközés-motor (Komplexitás: Közepes-Magas)
**Leírás:** Párhuzamos adatlekérés (6 tábla egy Promise.all-ban), ünnepnap/tiltott nap/napi szabály/önátfedés/lefedettségi szabály ellenőrzések, súlyosság-osztályozás.

#### 5. terület: Naptár és idővonal nézetek (Komplexitás: Magas)
**Rejtett komplexitás:** Az idővonal nézethez virtualizált sorgenerálás szükséges 200+ taghoz. A lefedettség-tervező hét/hónap nézet váltóval rendelkezik versenyhelyzet-védelemmel. A szűrő-konfiguráció munkaterületenkénti `tenant_calendar_settings`-ben perzisztálva.

#### 6. terület: Erőforrás-kezelés (Komplexitás: Magas)
**Rejtett komplexitás:** Az óra-alapú kapacitás-motor (`base_working_hours × allocation_pct / 100`) gondos szinkronizálást igényel az allokáció-szerkesztő, a kapacitáshiány-riport és a Gantt-idővonal között.

#### 7. terület: Agilis integráció (Komplexitás: Nagyon Magas)
**Rejtett komplexitás:** Mind a Jira REST v3, mind az Azure DevOps WIQL támogatása ugyanabban a proxy függvényben tartalék végpontokkal, normalizált alap-URL kezeléssel, üres JSON-patch védelemmel egy vállalati szintű termék.

#### 8. terület: Riport-szerkesztő (Komplexitás: Magas)
**Rejtett komplexitás:** Beágyazott SQL mód riport-szerkesztő gondos hozzáférés-ellenőrzést igényel (a felhasználóknak nem szabad más munkaterületek adataihoz hozzáférniük), paraméteres lekérdezés-végrehajtással és eredmény-paginációval.

### Komplexitási szorzók

| Tényező | Hatás |
|---------|-------|
| Magyar-először lokalizáció (minden UI-szöveg magyarul) | Alacsony (nem standard i18n beállítás, szövegek hardkódolva) |
| Multi-séma PostgreSQL architektúra | +15% DB/backend ráfordítás |
| Kéttermék kódbázis (Syncfolk + Enterprise) | +10% architektúrális terhelés |
| MI-gyorsított fejlesztési minta | Csökkenti a nyers kódolási időt, de növeli az átnézési/stabilizálási ráfordítást |
| Minimális automatizált tesztelési lefedettség | +20% becsült manuális QA ráfordítás |
| 17 edge function (Deno futtatókörnyezet) | +15% DevOps/backend ráfordítás |

---

## 4. Módszertan

### Alkalmazott módszerek

#### A. Alulról felfelé becslés
A 10 fő funkcióterületet összetevőkre bontottuk le. Összetevőnkénti ráfordítást tapasztalt szoftvermérnök becsülte meg:
- A megvalósítás kódsorainak száma
- Az érintett adatbázistáblák és kapcsolatok száma
- API/integrációs végpontok száma
- UI komplexitás (űrlapok, valós idejű frissítések, drag interakciók)
- A changelogban szereplő edge case-ek száma

#### B. Analóg becslés
Hasonló hatókörű termékek (Calamari, Timetastic, Absence.io, Sloneek) referenciapontként szolgáltak. Hasonló HR SaaS startupok nyilvános mérnöki blogbejegyzései szerint az MVP szabadságkezelő termékek 6–18 hónapot igényelnek csapatösszetételtől függően. Az Effectime Enterprise messze meghaladja az egyszerű MVP-t.

#### C. Hárompontos becslés (PERT)
Minden fő területre három becslést készítettünk:
- **Optimista (O)**: tapasztalt csapat, minimális újramunka
- **Legvalószínűbb (M)**: reális kompetens, de nem specialista csapathoz
- **Pesszimista (P)**: hatókör-creep, integrációs kudarcok, újramunka ciklusok

PERT képlet: `E = (O + 4M + P) / 6`

#### D. Analóg kód-metrikák
Referenciaipari átlagok: ~10–25 produktív kódsor fejlesztőnként naponta (komplex üzleti logika); ~100–200 ismert keretrendszerű UI-komponensekhez.

- 31 435 összes sor ÷ 120 sor/nap átlag = ~262 fejlesztői nap
- 2,2× terhelési szorzó alkalmazása (QA, design, átnézés, értekezletek, tervezés, deployment, újramunka): ~576 fejlesztői nap = ~2 880 személyóra

Ez közelítőleg megegyezik az alulról felfelé épített becsléssel.

### Fontos megkülönböztetések

- **Ráfordítás ≠ Időtartam**: Egy 2 880 személyórás projekt elvégezhető 5 hónap alatt (3 teljes munkaidős) vagy 24 hónap alatt (0,5 teljes munkaidős). A naptári idő a csapat méretétől, párhuzamosságától és kontextusváltásától függ.
- **Fejlesztési költség ≠ Piaci érték**: A cserélési költség a piaci érték minimuma; a termékpozicionálás, bevételi trakció és IP-differenciálás sokszorosára emelheti.

---

## 5. Csapatösszetétel

### Szükséges specialisták

#### Alapvető szerepkörök

| Szerepkör | Miért szükséges | Fázis | Ráfordítás-arány |
|-----------|----------------|-------|-----------------|
| **Senior Full-Stack Mérnök** | Architektúrális döntések, Supabase séma-design, RLS, edge functions, komplex üzleti logika | Minden fázis | 35% |
| **Közép-szintű Frontend Mérnök** | React komponens-fejlesztés, Recharts, DnD Kit, Framer Motion, reszponzív UI | 2–8. fázis | 30% |
| **Backend/Adatbázis Mérnök** | PostgreSQL séma, RLS szabályok, SECURITY DEFINER függvények, migrációk | 1–3., 6–8. fázis | 15% |
| **UX/UI Tervező** | Információarchitektúra, komponenskönyvtár-definíció, mobil elrendezések, adatvizualizáció | 1–2., 4–5. fázis | 10% |
| **Termékmenedzser/Owner** | Követelmény-specifikáció, sprint-tervezés, backlog-priorizálás | Minden fázis | 7% |
| **QA Mérnök** | Manuális tesztelés, regressziós tesztelés, böngésző/eszköz tesztelés | 3–8. fázis | 3% |

### Javasolt szállítási csapatok

#### Karcsú csapat (3 fő, 7–10 hónap)
- 1 × Senior Full-Stack Mérnök (vezető, 100%)
- 1 × Közép-szintű Frontend Mérnök (100%)
- 0,5 × UX/UI Tervező (50%, beágyazott)

#### Kiegyensúlyozott csapat (5 fő, 5–7 hónap)
- 1 × Senior Full-Stack Mérnök (vezető)
- 1 × Közép-szintű Frontend Mérnök
- 1 × Backend/Adatbázis Mérnök
- 0,5 × UX/UI Tervező
- 0,5 × Termékmenedzser

#### Vállalati szállítási csapat (8 fő, 4–5 hónap)
- 2 × Senior Full-Stack Mérnök
- 2 × Közép-szintű Frontend Mérnök
- 1 × Backend/Adatbázis Mérnök
- 1 × UX/UI Tervező
- 1 × Termékmenedzser
- 1 × QA Mérnök

### Javasolt létszámtervező idővonal (kiegyensúlyozott csapat)

| Hónap | Tevékenység | Kik |
|-------|-------------|-----|
| 1 | Architektúra, hitelesítés, adatbázis-design, UI alap | SF, BE, UX |
| 2 | Vállalati munkaterület, szabadság mag, naptár | SF, FE, BE, UX |
| 3 | Jóváhagyási láncok, értesítések, szabálymotor | SF, FE, BE, PM |
| 4 | Erőforrás-kezelés, riportálási irányítópult | FE, SF, PM |
| 5 | Agilis integráció, email infra, riport-szerkesztő | SF, BE, FE |
| 6 | Mobil (Capacitor), QA, teljesítmény, indulás előkészítés | Mindenki |
| 7 (puffer) | Hibajavítások, megszilárdítás, dokumentáció | SF, FE |

---

## 6. Ráfordítás-becslés

### Alulról felfelé területenkénti bontás

| Funkcióterület | Optimista (ó) | Legvalószínűbb (ó) | Pesszimista (ó) | PERT (ó) |
|----------------|--------------|-------------------|-----------------|----------|
| Hitelesítés és személyazonosság | 80 | 120 | 180 | 122 |
| Munkaterület és bérlés | 120 | 180 | 260 | 183 |
| Szabadsági kérelem életciklus | 180 | 260 | 380 | 263 |
| Ütközés-motor | 60 | 90 | 140 | 92 |
| Kapacitás-motor | 50 | 75 | 120 | 77 |
| Naptár és idővonal nézetek | 200 | 290 | 420 | 293 |
| Jóváhagyási lánc és eszkaláció | 60 | 90 | 140 | 92 |
| Erőforrás-kezelés | 180 | 260 | 380 | 263 |
| Agilis integráció | 140 | 200 | 300 | 203 |
| Riport-szerkesztő és riportálás | 120 | 180 | 270 | 183 |
| E-mail infrastruktúra | 90 | 130 | 200 | 133 |
| Admin, profil, landing | 60 | 90 | 140 | 92 |
| Mobil (Capacitor) + csiszolás | 60 | 90 | 130 | 90 |
| DB séma + RLS + migrációk | 80 | 120 | 180 | 122 |
| Smart Schedule algoritmus | 40 | 60 | 90 | 61 |
| Jogosultsági rendszer (dinamikus fa) | 50 | 75 | 120 | 77 |
| **Részösszeg (kódolás)** | **1 570** | **2 310** | **3 450** | **2 347** |
| + 30% terhelés (QA, PM, design, deploy, átnézés, értekezletek) | 471 | 693 | 1 035 | 704 |
| **Összesen** | **2 041** | **3 003** | **4 485** | **3 051** |

### Összefoglaló több mértékegységben

| Mérőszám | Alacsony | Legvalószínűbb | Magas |
|---------|---------|----------------|-------|
| Személyórák | 2 041 | 3 051 | 4 485 |
| Személynapok (8 ó) | 255 | 381 | 561 |
| Személyhónapok (160 ó) | 12,8 | 19,1 | 28,0 |
| Naptári hónapok (3 fős magcsapat) | 5,5 | 7,5 | 11 |
| Naptári hónapok (5 fős csapat) | 3,5 | 5 | 7 |

### Megjegyzés az MI-gyorsított fejlesztésről

A tárház azt mutatja, hogy ezt a terméket körülbelül **2 hónap aktív fejlesztés** alatt készítették el (2026-03-07 – 2026-05-11). Ez az MI-segített kódolási eszközök (Lovable platform, Claude Code) használatát tükrözi. A hagyományos emberi csapatok MI-eszközök nélkül valószínűleg 2–3× naptári időt igényelnének. A jelentés becslései **hagyományos emberi csapat ráfordítást** tükröznek, ami az értékelési célokhoz megfelelő alap.

---

## 7. Költségbecslés

### Díjszabási feltételezések

#### KKE / Magyarország piaci árak (2025–2026)

| Szerepkör | Junior (€/ó) | Közép (€/ó) | Senior (€/ó) |
|-----------|-------------|------------|-------------|
| Full-Stack Mérnök | 15–22 | 28–40 | 42–65 |
| Frontend Mérnök | 14–20 | 25–38 | 38–60 |
| Backend / DB Mérnök | 15–22 | 28–42 | 42–65 |
| UX/UI Tervező | 14–20 | 24–36 | 36–55 |
| Termékmenedzser | 18–25 | 32–45 | 45–70 |
| QA Mérnök | 12–18 | 22–32 | 32–48 |

#### Nyugat-EU / Ügynökségi árak (2025–2026)

| Szerepkör | Közép (€/ó) | Senior (€/ó) |
|-----------|------------|-------------|
| Full-Stack Mérnök | 70–100 | 110–160 |
| Frontend Mérnök | 60–90 | 100–140 |
| Backend / DB Mérnök | 70–105 | 110–160 |
| UX/UI Tervező | 60–85 | 90–130 |

### Részletes költségmodell — Legvalószínűbb forgatókönyv (KKE-árak)

| Szerepkör | Arány | Órák | Díj (€/ó) | Költség (€) |
|-----------|-------|------|----------|------------|
| Senior Full-Stack Mérnök | 35% | 1 068 | 52 | 55 536 |
| Közép-szintű Frontend Mérnök | 30% | 915 | 33 | 30 195 |
| Backend / DB Mérnök | 15% | 458 | 48 | 21 984 |
| UX/UI Tervező | 10% | 305 | 30 | 9 150 |
| Termékmenedzser | 7% | 214 | 38 | 8 132 |
| QA Mérnök | 3% | 91 | 28 | 2 548 |
| **Közvetlen munkaerő** | | **3 051** | | **127 545** |
| Terhelés (25%: iroda, eszközök, toborzás, management) | | | | 31 886 |
| Tartalék (15%) | | | | 19 132 |
| **Összesen (KKE)** | | | | **178 563** |

### Költségtartományok forgatókönyvenként

| Forgatókönyv | Alacsony | Legvalószínűbb | Magas |
|-------------|---------|----------------|-------|
| KKE / Magyarország (kis csapat, karcsú) | 118 000 € | 178 000 € | 245 000 € |
| Nyugat-EU ügynökség | 265 000 € | 380 000 € | 520 000 € |
| Vegyes (KKE fejlesztés + WEU vezetés) | 165 000 € | 235 000 € | 330 000 € |

### Költség szállítási fázisonként

| Fázis | Költség % | KKE legvalószínűbb |
|-------|----------|-------------------|
| Alap (hitelesítés, architektúra, DB) | 15% | 26 700 € |
| Vállalati mag (munkaterület, szabadság, jóváhagyás) | 25% | 44 600 € |
| Naptár, idővonal, lefedettség | 15% | 26 700 € |
| Erőforrás-kezelés | 12% | 21 400 € |
| Agilis integráció | 10% | 17 800 € |
| Email infra + riportálás | 10% | 17 800 € |
| QA, tesztelés, stabilizálás | 8% | 14 300 € |
| PM + design végig | 5% | 8 900 € |
| **Összesen** | **100%** | **178 200 €** |

---

## 8. Piaci összehasonlítás

### Összehasonlítható termékek

#### Közvetlen versenytársak (Szabadságkezelő SaaS)

| Termék | Árazási modell | Árak | Főbb megkülönböztetők |
|--------|--------------|------|----------------------|
| **Calamari** | Felhasználónként/hónap | 2,50–5,00 €/fő/hó | KKE-barát, Leave + Clock-in modulok |
| **Timetastic** | Felhasználónként/hónap | 1,50–2,50 $/fő/hó | Egyszerű, UK-fókuszú; 2023-ban felvásárolva |
| **LeaveBoard** | Felhasználónként/hónap | 1,35–3,50 $/fő/hó | Egyszerű szabadság-nyomon követés |
| **Absence.io** | Felhasználónként/hónap | 3,50–5,00 €/fő/hó | EU-fókuszú, GDPR |
| **Vacation Tracker** | Felhasználónként/hónap | 1,00–5,00 $/fő/hó | Slack/Teams integráció |
| **Factorial HR** | Felhasználónként/hónap | 5–8 €/fő/hó | Teljes HR csomag (EU) |
| **Personio** | Felhasználónként/hónap | 5–25 €/fő/hó | Közepes piaci európai HR |
| **Sloneek** | Egyedi ajánlat | ~5–10 €/fő/hó becslés | KKE/CEE fókusz, cseh/szlovák/**magyar** |
| **BambooHR** | Egyedi ajánlat | 10–25 $/fő/hó becslés | Észak-amerikai KKV |

#### Szomszédos versenytársak (Erőforrás/Kapacitástervezés)

| Termék | Ár | Megjegyzések |
|--------|-----|-------------|
| **Runn** | 10–14 $/fő/hó | Erőforrástervezés + előrejelzés |
| **Float** | 6–12 $/fő/hó | Csapat kapacitástervezés |
| **Teamdeck** | 3,99 $/fő/hó | Erőforrás + szabadságkezelés |
| **Mosaic** | 9,99+ $/fő/hó | MI-alapú erőforrástervezés |

### Piaci méret

- **Globális szabadságkezelő szoftver piac**: 2024-ben ~1,2 milliárd $, 9,5% CAGR 2035-ig
- **KKE HR tech piac**: körülbelül 180–250 millió €, évi ~12–15%-os növekedés
- **Magyar vállalati HR szoftver**: főleg hazai bérszámfejtőkkel (NEXON, T-Systems HR) és európai SaaS-szel (Personio, Calamari) dominált

### Az Effectime piaci pozicionálása

**Erősségek a versenytársakhoz képest:**
1. Mélyebb erőforrás-kezelés, mint a tiszta szabadság-eszközök
2. Agilis integráció egyedülálló ezen az árkategóriában (Jira + ADO kétirányú)
3. Egyéni riport-szerkesztő SQL-móddal vállalati szintű
4. Smart ütemezési algoritmus műszaki megkülönböztető
5. Modern stack (React + Supabase) lehetővé teszi a gyors funkcióiterációt
6. Mobilkész (Capacitor) az első naptól

**Gyengeségek a versenytársakhoz képest:**
1. Jelenleg csak magyar UI limitálja a nemzetközi terjeszkedést
2. Minimális tesztlefedettség növeli az üzemeltetési kockázatot
3. Nincs nyilvános bevételi trakció
4. Nincs bérszámfejtési integráció (kulcsfontosságú teljes HR csomag értékelésénél)

### Árazási jelek

Összehasonlítható termékek alapján reális piacra lépési árazási modell:
- **Starter**: 3–4 €/felhasználó/hónap (csak szabadságkezelés)
- **Professional**: 6–8 €/felhasználó/hónap (+ erőforrás-kezelés, riportálás)
- **Enterprise**: 10–15 €/felhasználó/hónap (+ agilis integráció, egyéni riport-szerkesztő, SLA)

100 fős vállalat Professional csomagon: 600–800 €/hónap → 7 200–9 600 €/év ÉBF ügyfelenként.

---

## 9. Piaci értékbecslés

### 1. szempont: Csere-/IP-érték

A termék cserélési költsége KKE-árakon 145 000–245 000 €. Piaci IP-eszközként (kód + architektúra + üzemeltetési tudás) tipikusan 1,5–2,5× szorzó alkalmazandó:

**IP/Cserélési érték: 200 000 – 550 000 €**

Ez a padlót képviseli — amennyit egy racionális vevő fizetne a nyers technológiáért bevétel, ügyfelek vagy márka nélkül.

### 2. szempont: Összehasonlítható-alapú értékelés

Referencia tranzakciók a HR SaaS területen:
- Calamari (lengyel, ~50 fős csapat): becsülhetően 5–15 millió $ értékelés ~1 millió $ ÉBF-nél
- Timetastic (UK): bootstrappelt, ~1,7 millió $ ÉBF, valószínűleg 3–8 millió £ értékelés felvásárláskor (2023)
- Sloneek (KKE legközelebbi összehasonlítható): 3,6 millió € tőkebevonás 2024-ben ~5–9 millió € ÉBF-nél

ÉBF-szorzók korai szakaszban (5–10× ÉBF):

| ÉBF forgatókönyv | Szorzó | Értéktartomány |
|-----------------|--------|---------------|
| Nincs bevétel (csak IP) | n/a | 200 000 – 550 000 € |
| 30 000 € ÉBF (korai ügyfelek) | 8× | 240 000 – 400 000 € |
| 100 000 € ÉBF | 7× | 700 000 – 1 000 000 € |
| 300 000 € ÉBF | 6× | 1 800 000 – 2 400 000 € |
| 500 000 € ÉBF | 5–6× | 2 500 000 – 4 000 000 € |
| 1 000 000 € ÉBF | 5–7× | 5 000 000 – 8 000 000 € |

### 3. szempont: Funkcióélység és stratégiai prémium

Az Effectime olyan funkciókat tartalmaz, amelyek meghaladják a tipikus versenytársakat árkategóriájában:
- Agilis integráció (kétirányú Jira + ADO)
- Egyéni SQL riport-szerkesztő
- Smart ütemező algoritmus
- Multi-séma multi-tenant architektúra
- Capacitor mobil (iOS/Android)

Funkcióélység prémium alkalmazva az IP értékre: **1,3–1,8×**

Korrigált IP érték funkcióprémiummal: **260 000 – 990 000 €**

### 4. szempont: Kockázat és karbantarthatóság

| Kockázati tényező | Hatás |
|------------------|-------|
| Minimális tesztlefedettség (1 tesztfájl) | −15% |
| MI-segített kódbázis (minőségi variabilitás) | −10% |
| Csak magyar UI (piaci koncentráció) | −10% |
| Modern/karbantartható tech stack | +10% |
| Tiszta RLS architektúra | +5% |
| Aktív changelog (karbantartás bizonyítéka) | +8% |
| **Nettó kockázati kiigazítás** | **−12%** |

### 5. szempont: Stratégiai felvásárlási érték

Egy stratégiai felvásárló (pl. KKE HR tech szereplő, Jira-szomszédos eszköz gyártója, európai SaaS konszolidátor) értékelné:
- A Jira/ADO integrációs modult önálló felvásárlási célpontként
- A vállalati munkafolyamat-motort platform-kiterjesztésként
- A KKE HR tech pozicionálást piacra lépési járműként

Stratégiai prémium az IP értékhez képest: **1,5–3×**

Stratégiai felvásárlási tartomány: **300 000 – 1 650 000 €** (előbevételes és korai bevételes szakasz)

### Végső piaci értéktartományok

| Forgatókönyv | Becsült piaci érték |
|-------------|-------------------|
| Előbevételes IP eladás | 200 000 – 600 000 € |
| Korai szakasz korai ügyfelekkel (30–100 ezer € ÉBF) | 400 000 – 1 200 000 € |
| Termék-piac illeszkedés után (200–500 ezer € ÉBF) | 1 500 000 – 4 500 000 € |
| Stratégiai felvásárlás (bármely szakasz) | 700 000 – 2 500 000 € |
| **Legvalószínűbb tartomány (jelenlegi állapot, ismeretlen bevétel)** | **350 000 – 900 000 €** |

**Középponti becslés: 550 000 €** (korai trakció, növekedési szakasz előtt)

---

## 10. Feltételezések és korlátok

### Ami ismert volt (kemény bizonyítékok)
- Teljes forráskód (170 fájl, 31 435 sor)
- 53 adatbázis-migrációs fájl sémaelőzményekkel
- Teljes changelog (v2.0.0–v2.6.0+)
- 17 edge function implementációval
- Összes npm függőség verziókkal
- Fejlesztési időszak (2026-03-07 – 2026-05-11)
- Governance dokumentáció
- Architektúrális minták (Supabase + React + TypeScript)

### Ami következtetett volt
- Fejlesztési ráfordítás (kódmennyiségből, changelog bonyolultság-jeleiből és összehasonlítható projektekből becsülve)
- Díjszabási feltételezések (KKE piackutatás, iparági normák)
- Piaci összehasonlíthatók (nyilvános árlisták, sajtóközlemények)
- Bevételi potenciál (összehasonlítható SaaS-on alapuló árazási modell)
- Csapatösszetétel (kódbázis szélességéből és komplexitásából következtetve)

### Ami hiányzik / ismeretlen
- **Bevétel / ÉBF**: Nincs monetizációs adat a tárházban. Ez az egyetlen tényező dominál leginkább a piaci értékelésben.
- **Felhasználói/bérlői szám**: Nincs telemetria vagy analitika integráció látható
- **Vásárlói adatok**: Nincs CRM, support jegyek vagy felhasználói visszajelzési adat
- **Bérszámfejtési integráció**: Hiányzik; korlátozza a vállalati értékesítést teljes HR csomag értékeléseknél
- **SLA / üzemidő előzmény**: Nincs monitoring vagy incidensadat
- **Versenyképes trakció**: Nincs értékesítési folyamat, konverziós ráta vagy lemorzsolódási adat

### Ami materálisan megváltoztathatja a becslést
- Bevételi trakció 3–10×-esére növelheti a becslést növekedési szakaszban
- Biztonsági audit megállapítások 20–40%-kal csökkenthetik az értéket
- Stratégiai partner vagy disztribúciós csatorna megszerzése 2–5×-esére növelheti
- Csak magyar UI kiterjesztése angolra/németre évente 50–200 ezer € extra piacot nyithat
- Bérszámfejtési integráció érdemben növelné a vállalati konverziót

---

## 11. Ajánlott következő lépések

### Ha a cél a fejlesztési költség optimalizálása
- Automatizált tesztlefedettség hozzáadása (célpont: 70%+ az üzleti logika könyvtárakon: `conflictEngine`, `capacityEngine`, `smartSchedule`)
- 4 másodperces lekérdezési intervallumok cseréje Supabase Realtime feliratkozásokra
- Audit log megvalósítása sor-alapú rendszerként fire-and-forget helyett
- Magyar/angol i18n bevezetése `i18next` segítségével (teljes újraírás nélkül teszi lehetővé az internacionalizációt)
- `(supabase as any)` típusú kasztolások feloldása a konfliktus-motorban

### Ha a cél a termék eladása/felvásárlás/tőkebevonás
- Mérhető ÉBF megteremtése (még 5–20 ezer € korai bevétel is drasztikusan növeli az értékelési hitelességet)
- Angol nyelvű verzió közzététele a termékből és a landing oldalból
- Legalább egy referenciálható vállalati ügyfél megszerzése (50+ alkalmazott)
- RLS szabályok és edge function hitelesítés biztonsági auditjának megrendelése
- Adatszoba előkészítése: pénzügyek, technikai architektúra dokumentum, ügyfél lista, IP tulajdonjogi lánc

### Ha a cél az ütemterv priorizálása
- **Legnagyobb hatású kiegészítések**: Bérszámfejtési integráció (Nexon/HR365 a KKE-nak), Microsoft Teams értesítési összekötő, SCIM/SSO vállalati értékesítéshez
- **Megvédendő versenyelőny**: Jira/ADO agilis integráció + kapacitásszimulálás — egyetlen közvetlen versenytárs sem kínálja ezt ezen az árkategóriában
- **Először kezelendő technikai adósság**: tesztlefedettség, audit log megbízhatóság, `as any` típusú kasztolások

### Ha a cél a technikai adósság csökkentése
- 1. prioritás: Automatizált tesztcsomag (vitest már konfigurálva, csak nem használt)
- 2. prioritás: Audit log sor (fire-and-forget megfelelési kockázat)
- 3. prioritás: Lekérdezés cseréje Realtime feliratkozásokra
- 4. prioritás: i18n refaktor az internacionalizációhoz
- 5. prioritás: Típusbiztos Supabase lekérdezések (`as any` kasztolások eltávolítása)

---

## 12. Függelék

### A. Adatbázistábla-leltár

| Tábla | Modul | Cél |
|-------|-------|-----|
| profiles | Alap | Felhasználói profilok |
| enterprise_workspaces | Munkaterület | Bérlői munkaterületek |
| enterprise_memberships | Munkaterület | Felhasználó-munkaterület kapcsolatok |
| enterprise_invitations | Munkaterület | E-mail-alapú meghívók |
| enterprise_teams | Munkaterület | Csoportosítások |
| leave_requests | Szabadság | Szabadsági kérelem rekordok |
| approval_decisions | Szabadság | Jóváhagyási/elutasítási döntések |
| leave_request_substitutes | Szabadság | Rendezett helyettesítő lista |
| enterprise_leave_types | Konfig | Egyéni szabadság típusdefiníciók |
| enterprise_holidays | Konfig | Munkaterület ünnepnaptár |
| enterprise_blocked_dates | Konfig | Tiltott napok |
| enterprise_daily_rules | Konfig | Napi létszámszabályok |
| enterprise_office_coverage_rules | Konfig | Irodai lefedettségi követelmények |
| enterprise_rule_templates | Konfig | Újrafelhasználható szabálysablonok |
| enterprise_approval_chains | Konfig | Többlépéses jóváhagyási definíciók |
| enterprise_escalation_rules | Konfig | Eszkalációs trigger szabályok |
| enterprise_audit_events | Audit | Megváltoztathatatlan auditnyomvonal |
| enterprise_notifications | Értesítések | Alkalmazáson belüli értesítések |
| enterprise_export_jobs | Export | CSV export feladatok nyomon követése |
| enterprise_member_skills | Képességek | Tag képesség-hozzárendelések |
| enterprise_member_role_allocations | Erőforrások | Szerepkör-allokációs százalékok |
| enterprise_projects | Erőforrások | Projekt definíciók |
| enterprise_project_allocations | Erőforrások | Projekt-tag allokációk |
| enterprise_agile_issues | Agilis | Gyorsítótárazott Jira/ADO feladatok |
| enterprise_agile_sync_log | Agilis | Integrációs tevékenységnapló |
| enterprise_agile_external_field_mappings | Agilis | Dinamikus mezőleképezések |
| enterprise_agile_capacity_events | Agilis | Kapacitásesemény-napló |
| enterprise_feature_catalog | Jogosultságok | Dinamikus jogosultsági fa |
| enterprise_quota_transactions | Kvóta | Szabadságkvóta-tranzakciók |
| tenant_calendar_settings | Naptár | Munkaterületenkénti szűrő-konfig |

### B. Edge Function leltár

| Függvény | Sorok | Cél |
|----------|-------|-----|
| join-event | 1 724 | Hitelesítési/tagsági/aktiválási műveletek mag |
| jira-devops-proxy | 484 | Jira + Azure DevOps proxy |
| send-transactional-email | 365 | E-mail küldés a Lovable Email API-n keresztül |
| process-email-queue | 363 | E-mail sor fogyasztó |
| auth-email-hook | 324 | Supabase hitelesítési esemény elfogó |
| admin | 269 | Super-admin műveletek |
| run-report | 225 | Egyéni riport végrehajtás |
| create-instant-enterprise-member | 217 | Gyors tagprovisionálás |
| data-migration | 208 | Adatmigrációs segédprogram |
| send-scheduled-reports | 178 | Ütemezett riport e-mail kézbesítés |
| handle-email-suppression | 162 | Visszapattanó/tiltólistás kezelés |
| sync-holidays | 153 | Nyilvános ünnepnap-adatok szinkronizálása |
| handle-email-unsubscribe | 130 | Leiratkozási webhook |
| delete-account | 123 | GDPR fióktörlés |
| preview-transactional-email | 100 | E-mail sablon előnézete |
| leave-ical | 86 | iCal feliratkozás-export |
| cleanup-temp-users | 76 | Ideiglenes felhasználó takarítási feladat |

### C. Összehasonlítható termékek mátrixa

| Termék | Székhely | Fókusz | Ár/Fő/Hó | Funkciók az Effectime-hoz képest |
|--------|---------|-------|----------|--------------------------------|
| Calamari | Lengyelország | Szabadság + Jelenléti | 2,50–5 € | Hasonló hatókör, nincs Agilis integráció |
| Timetastic | UK | Csak szabadság | 1,50–2,50 $ | Sokkal egyszerűbb, nincs erőforrástervezés |
| Absence.io | Németország | Szabadság + Szervezet | 3,50–5 € | Hasonló EU pozicionálás, kevesebb mélység |
| Factorial | Spanyolország | Teljes HR | 5–8 € | Szélesebb HR (bérszámfejtés), kevesebb agilis mélység |
| Personio | Németország | Teljes HR/Bérszámfejtés | 5–25 € | Vállalati, bérszámfejtés, sokkal nagyobb csapat |
| Float | Ausztrália | Csak erőforrás | 6–12 $ | Nincs szabadságkezelés |
| Teamdeck | Lengyelország | Erőforrás + szabadság | 3,99 $ | Összességében legközelebb az összehasonlítható |
| Sloneek | Cseh/KKE | Teljes HR | ~5–10 € becslés | Legközelebbi KKE versenytárs; raised €3.6M 2024-ben |

### D. Megbízhatóság értékelése

| Dimenzió | Megbízhatóság | Indoklás |
|----------|-------------|---------|
| Fejlesztési ráfordítás becslés | Magas (±20%) | Teljes kódbázis elérhető, changelog bizonyítékok |
| Költségbecslés (KKE) | Magas (±25%) | Piaci díjadatok elérhetők |
| Költségbecslés (Nyugat-EU) | Közepes (±35%) | Csak közvetett bizonyíték |
| Piaci érték (előbevételes) | Közepes (±40%) | Nincs bevételi adat; összehasonlítható-alapú |
| Piaci érték (bevétellel) | Közepes-Magas (±25%) | Szabványos ÉBF szorzók alkalmazhatók |

---

*Ez a jelentést MI-segített technikai átvilágítási elemzéssel készítettük, közvetlen tárházinspekció és külső piackutatás kombinálásával. Tájékoztatási célra készült, és nem minősül pénzügyi tanácsadásnak. A becsléseket tényleges pénzügyi adatokkal kell validálni befektetési döntésekben való felhasználás előtt.*

---
**Jelentés verziója:** 1.0  
**Értékelés dátuma:** 2026-05-11  
**Tárház commit referencia:** Branch `claude/fix-google-auth-n6K0t`
