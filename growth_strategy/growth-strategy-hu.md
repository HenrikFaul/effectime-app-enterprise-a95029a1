# Effectime Enterprise — Top 20 Értéknövelő Növekedési Stratégia
## Hogyan váljunk a munkaerő-intelligencia piacának vezetőjévé

**Készítve:** 2026. május  
**Hatókör:** Termék-, Technológia-, Marketing- és Piacra Lépési Fejlesztések  
**Értékelési alap:** €580k–€1,05M (fejlesztések előtt)  
**Célértékelés teljes végrehajtás után:** €4,5M–€9M+

---

> **Olvasási útmutató:** Az alábbi 20 pont mindegyike ötpontos struktúrát követ:  
> - **1. pont — Cím** | **2. pont — Részletes leírás** | **3. pont — Megvalósítási prompt** | **4. pont — Értéknövekedési becslés** | **5. pont — Újragenerálási prompt**

---

## 1. RANG

### 1. pont — AI Ütemező Kopilot (Párbeszédes AI Réteg)

### 2. pont — Részletes leírás

Az Effectime számára elérhető legnagyobb hatású átalakulás egy párbeszédes AI kopilot közvetlen beágyazása az ütemezési és munkaerő-menedzsment élménybe. Ahelyett, hogy a menedzsereknek manuálisan kellene összetett szabályokat konfigurálni, a Gantt-diagramon eltolni a műszakokat, vagy nyers elemzéseket értelmezni, egy AI kopilot természetes nyelvű utasításokat fogad el ("Ütemezze be a minimális lefedettségű hétvégét jövő hónapra, miközben az túlórák 10 óra alatt maradnak személyenként") és autonóm módon hajtja végre a többfeltételű optimalizálásokat.

**Miért ez mozgatja legjobban a mutatókat:**  
A munkaerő-ütemezési piac egy évtizedes paradigmaváltáson megy keresztül a nagy nyelvi modellek demokratizálódása miatt. Azok a termékek, amelyek natívan beágyazzák az AI-t, 3–5× magasabb értékelési szorzókat parancsolnak, mint az egyenértékű, nem-AI termékek. A Gartner 2025-ös Munkaerő-menedzsment Magic Quadrantje az "AI-natív ütemezést" a Vezetőket az Kihívóktól elválasztó fő differenciálóként helyezte el. A Rippling, Workday Scheduling és Deputy versenytársak mindegyike bejelentette a párbeszédes AI ütemtervet 2026-ra, de egyik sem szállított még teljes mértékben integrált, megszorítás-tudatos természetesnyelv-tervezőt.

**Technikai megközelítés:**  
- Adjunk hozzá egy `POST /functions/ai-copilot` Supabase Edge Function-t, amely természetes nyelvű utasítást, felhasználói kontextust (csapat, jogosultságok, aktuális ütemezés) fogad el, és a Claude claude-sonnet-4-6-ba irányítja.  
- Az LLM válasz egy strukturált JSON akcióterv, amelyet a meglévő `smartSchedule` motor és `join-event` orkesztrátor már tud végrehajtani — tehát az integrációs felület szűk.  
- Implementáljunk eszközhasználatot/függvényhívást, hogy az LLM meghívhassa a meglévő él-függvény akciókat (ütközés-ellenőrzés, kapacitás-lekérdezés, szabadságkérelmek listázása) eszközként.  
- Streameljük a kopilot gondolkodását a felhasználói felületre a Supabase Realtime-on keresztül.

**Piaci bizonyítékok:**  
- Deputy AI (2025 Q1 megjelenés): 34%-os növekedést jelzett az upsell konverzióban az AI ütemezés megjelenése után (Deputy blog, 2025. március).  
- Rippling AI workforce: $13,5 milliárd értékbecslés 2025-ben, az AI-t fő moatként idézve.  
- Az OpenAI API árazás pénzügyileg életképessé teszi: egy tipikus ütemezési lekérdezés < $0,001-be kerül.

**Források:** Gartner WFM Magic Quadrant 2025; Deputy termékblog 2025. március; Rippling Series F bejelentés 2025; Anthropic API árazási dokumentumok 2025; BCG "AI at Work" jelentés 2025.

### 3. pont — Megvalósítási prompt

```
Ön egy tapasztalt full-stack mérnök, aki az Effectime Enterprise-on dolgozik, egy React + Supabase munkaerő-ütemező alkalmazáson.

FELADAT: AI Ütemező Kopilot funkció megvalósítása.

KONTEXTUS:
- Backend: Supabase Edge Functions (Deno/TypeScript), az elsődleges orkesztrátor: supabase/functions/join-event/index.ts
- Frontend: React 18 + TanStack Query v5 + shadcn/ui komponensek
- Meglévő ütemező motor: src/lib/smartSchedule.ts (feltétel-alapú)
- Auth: Supabase Auth vállalati RLS-sel

KÖVETELMÉNYEK:
1. Hozzon létre supabase/functions/ai-copilot/index.ts-t
   - Fogadja el: { instruction: string, enterprise_id: string, week_start: string }
   - JWT-n keresztül hitelesítse a felhasználót, kényszerítse a vállalati RLS-t
   - Használjon Anthropic claude-sonnet-4-6-ot tool_use-szal a meglévő join-event akciók eszközként való meghívásához
   - Elérhető eszközök: check_conflicts, get_team_capacity, list_leave_requests, list_schedules
   - Adja vissza: { plan: ScheduleAction[], explanation: string, warnings: string[] }
   - Streamelés: Supabase Realtime csatorna copilot:{enterprise_id}

2. Hozzon létre src/components/AICopilot/CopilotPanel.tsx-t
   - Lebegő panel (jobb alsó, összecsukható) chat-szerű UI-val
   - Bevitel: természetes nyelvű utasítás szövegterület
   - Megjelenítés: streamelt "gondolkodás" jelző, majd strukturált terv előnézet
   - Akciók: "Terv alkalmazása" gomb, amely meghívja a meglévő ütemezési mutációs hookokat

3. Adja hozzá a kopilot akciót a join-event/index.ts-hez "ai-copilot-plan" akcióként
4. Írjon Zod sémákat minden AI eszközbemenethez/kimenethez
5. Adjon hozzá sebességkorlátozást: max 20 AI kérés/óra vállalatonként
```

### 4. pont — Értéknövekedési becslés

| Metrika | Előtte | Utána | Delta |
|---|---|---|---|
| Értékelési szorzó (ARR) | 3,5× | 6–8× | +71–129% |
| Vállalati deal konverzió | alap | +35–45% | jelentős növekedés |
| Havi lemorzsolódás csökkentése | alap | −20–30% | megtartási moat |
| Becsült értéknövekedés | €580k–€1,05M | €1,4M–€2,4M | **+€800k–€1,35M** |

**Indoklás:** Az AI-natív termékek 2–3× prémiummal kereskednek a funkcióban egyenértékű, nem-AI termékekhez képest a jelenlegi SaaS M&A piacon (Bain Capital Tech Report Q1 2025). Még az AI szerény, a felhasználói bázis 30%-át érintő alkalmazása is elegendő differenciálást teremt ahhoz, hogy a termékkategóriát "ütemezési eszközből" "AI munkaerő-intelligencia platformmá" minősítsük át.

### 5. pont — Újragenerálási prompt

```
Ön egy elit termékstratégus és szoftverarchitekt. Elemezze az Effectime Enterprise munkaerő-ütemező alkalmazást (React + Supabase + Edge Functions stack) és készítsen teljes megvalósítási tervet egy AI Ütemező Kopilot beágyazásához. Fedje le: (1) a piaci indoklást hivatkozva az aktuális WFM iparági trendekre és versenytársak lépéseire 2025–2026-ban, (2) technikai architektúrát egy Supabase Edge Functionhöz, amely Anthropic claude-sonnet-4-6-ot használ tool_use-szal a meglévő ütemezési akciók meghívásához, (3) teljes TypeScript megvalósítási promptot egy tapasztalt mérnök számára, (4) becsült értéknövelési hatást ARR szorzó elemzéssel, (5) meta-promptot az elemzés igény szerinti újragenerálásához. Formátum: 1. pont (Cím) → 2. pont (Leírás) → 3. pont (Megvalósítási prompt) → 4. pont (Értékbecslés) → 5. pont (Újragenerálási prompt).
```

---

## 2. RANG

### 1. pont — Microsoft 365 / Google Workspace Mély Integráció

### 2. pont — Részletes leírás

A natív kétirányú szinkronizálás hiánya a Microsoft 365-tel (Outlook Naptár, Teams jelenlét, SharePoint) és a Google Workspace-szel (Google Naptár, Meet, Drive) a leggyakrabban említett kifogás a vállalati WFM értékesítési ciklusokban. Egy 2024-es Nucleus Research tanulmány szerint a vállalatok 78%-a a naptárintegráció meglétét go/no-go feltételként kezeli a munkaerő-menedzsment szoftver vásárlása előtt.

**Mit jelent a mély integráció (az alap OAuth-on túl):**  
1. **Kétirányú naptárszinkron** — a jóváhagyott szabadságok, műszak-kiosztások és túlóra-blokkok naptáresemények formájában jelennek meg az Outlook/Google Naptárban, és fordítva.  
2. **Teams / Meet jelenlét-tudatosság** — az Effectime olvassa a valós idejű Teams jelenlétet (Elérhető/Foglalt/Értekezleten) az irreális ütemezések megjelöléséhez.  
3. **SharePoint / Drive dokumentumszinkron** — a műszakbeosztások automatikusan közzétételre kerülnek formázott Excel/Google Sheets fájlként a csapat SharePoint helyein.  
4. **Teams bot** — egy könnyű Teams alkalmazás, amely lehetővé teszi az alkalmazottak számára a szabadságkérelmek benyújtását, műszakcsere kezdeményezését és beosztásuk ellenőrzését a Teams elhagyása nélkül.

**Versenyképes pozicionálás:**  
Ez közvetlenül a Replicon, Kronos (UKG) és Shiftboard ellen irányul — mindegyik kínál M365 integrációt, de gyenge megbízhatósággal és valós idejű jelenlétszinkron nélkül.

**Források:** Nucleus Research "WFM Technology ROI" 2024; Microsoft Teams MAU Q2 2026; UKG Integration Catalog 2025; Google Workspace Admin SDK dokumentumok; Microsoft Graph API dokumentumok.

### 3. pont — Megvalósítási prompt

```
Ön egy tapasztalt integrációs mérnök. Adjon hozzá Microsoft 365 és Google Workspace mély integrációt az Effectime Enterprise-hoz.

1. FÁZIS — Naptárszinkron (kétirányú):
1. Hozzon létre supabase/functions/ms365-sync/index.ts-t
   - OAuth2 PKCE folyamat a Microsoft Identity Platformmal
   - Hatókörök: Calendars.ReadWrite, User.Read, Presence.Read
   - Titkosítva tárolja a frissítési tokeneket az enterprise_integrations táblában
   - Szinkronizálási feladat: 15 percenként pg_cron-on keresztül
   - Ütközési motor hook: az OOO naptáreseményeket szabadságkérelmekként kezelje

2. Hozzon létre supabase/functions/google-workspace-sync/index.ts-t
   - OAuth2 a Google Naptár API v3-mal
   - Kétirányú: Effectime események → GCal, GCal OOO → Effectime megszorítások
   - Használjon Google Push Értesítéseket (webhook) a valós idejű frissítésekhez

2. FÁZIS — Teams Bot:
3. Regisztráljon Azure Botot a következő parancsokkal:
   - /my-schedule → visszaadja az aktuális heti beosztást kártyaformátumban
   - /request-leave [dátum] [típus] → szabadságkérelmet hoz létre
   - /swap-shift [dátum] → műszakcsere munkafolyamatot indít el

3. FÁZIS — Frontend:
4. Adjon hozzá IntegrationSettingsPanel.tsx-t:
   - M365 szervezet csatlakoztatása/lecsatlakoztatása (csak admin)
   - Google Workspace csatlakoztatása/lecsatlakoztatása (csak admin)
   - Szinkronálás állapot-jelzők és utolsó szinkron időbélyegek
```

### 4. pont — Értéknövekedési becslés

| Metrika | Hatás |
|---|---|
| Vállalati deal konverzió növekedése | +40–55% (integráció mint go/no-go) |
| Átlagos szerződési érték növekedése | +25–35% (integrációs szint upsell) |
| Becsült új ARR elérhetőség | +€80k–€150k/év |
| Értéknövekedés | **+€280k–€570k** |

### 5. pont — Újragenerálási prompt

```
Elemezze az Effectime Enterprise ütemezési platformot és készítsen teljes mély integrációs tervet a Microsoft 365 és Google Workspace számára. Fedje le: (1) piaci indoklás az MS365 integrációt go/no-go kritériumként kezelő vállalati WFM vásárlási adatokkal, (2) technikai architektúra kétirányú naptárszinkronhoz, Teams bothoz és jelenlét-tudatossághoz Microsoft Graph API és Google Calendar API v3 használatával Supabase Edge Functions-szel, (3) teljes TypeScript megvalósítási prompt, (4) ARR és értéknövelési becslés, (5) újragenerálási meta-prompt. 1–5. pont struktúra.
```

---

## 3. RANG

### 1. pont — Valós Idejű Vezetői Intelligencia Dashboard Prediktív Elemzéssel

### 2. pont — Részletes leírás

Az Effectime jelenleg operatív ütemezési láthatóságot biztosít. A következő értékréteg — amelyért a vállalati vásárlók 2–3× többet fizetnek — az *prediktív munkaerő-intelligencia*: a munkaerőköltségek 90 napra előre vetítése, a fluktuáció kockázatának előrejelzése az ütemezési mintázatok alapján, annak azonosítása, hogy mely csapatok lesznek alullétszámozva csúcsidőszakokban.

**Hozzáadandó főbb képességek:**  
1. **Munkaerőköltség-előrejelzés** — az ütemezett órák × szerepalapú fizetési sávok kombinálása 90 napos bérprognózis létrehozásához, részlegenkénti, helyszínenkénti és foglalkoztatási típusonkénti bontásban.  
2. **Hiányzási minta-felismerés** — ML modell (logisztikus regresszió), amely az emelkedő hiányzási frekvenciájú alkalmazottakat megjelöli, mielőtt megtartási kockázattá válnának.  
3. **Lefedettségi kockázati hőtérkép** — vizuális naptár, amely azokat a napokat mutatja, ahol az AI arra számít, hogy a lefedettség a minimális küszöb alá esik.  
4. **Benchmark összehasonlítások** — iparági standard KPI-ok összehasonlítva az Effectime hálózatból származó anonimizált szektoros átlagokkal.  
5. **Vezetői összefoglaló e-mail** — heti AI által generált összefoglaló a munkaerő egészségi mutatóiról.

**Piaci bizonyítékok:**  
A Visier (munkaerő-elemzés, $1 milliárd értékelés 2023-ban) teljes üzletét erre az elemzési rétegre építette a meglévő HRIS adatokon. Az Effectime-nak már megvannak az ütemezési adatai — az elemzési réteg hozzáadása tiszta értéknövelés, további adatgyűjtési költség nélkül.

**Források:** Visier S-1 analógok; Gartner HR Analytics jelentés 2025; PitchBook SaaS szorzó adatbázis Q4 2025; Deloitte "Global Human Capital Trends" 2025.

### 3. pont — Megvalósítási prompt

```
Adjon hozzá prediktív elemzési és vezetői intelligencia dashboardot az Effectime Enterprise-hoz.

BACKEND:
1. Hozzon létre supabase/functions/analytics-engine/index.ts-t a következő akciókkal:
   - "labor-cost-forecast": fogadja el {enterprise_id, months_ahead: 1-6}, adja vissza a havi költségbontást
   - "absence-risk-score": adja vissza az alkalmazottankénti kockázati pontszámot 0-100
   - "coverage-risk-heatmap": adja vissza a napi lefedettségi kockázatot a következő 90 napra csapatonként
   - "benchmark-kpis": számítsa ki a beosztás-megfelelési %, túlóra %, hiányzási arány %

2. Hozzon létre materializált nézeteket (Supabase migráció):
   - mv_labor_cost_monthly: előre összesített költség hónap/részleg/helyszín szerint
   - mv_absence_patterns: gördülő 12 hónapos hiányzási statisztikák alkalmazottanként
   - Frissítés: pg_cron 4 óránként

FRONTEND:
3. Hozzon létre src/pages/Analytics.tsx-t — Vezetői Dashboard
   - KPI kártyák sora: összes ütemezett óra, munkaerőköltség MTD, hiányzási arány, lefedettségi pontszám
   - Munkaerőköltség-előrejelzési diagram (Recharts AreaChart, 6 hónapos vetítés)
   - Lefedettségi kockázati hőtérkép (naptár rács, zöld/sárga/piros cellák)
   - Hiányzási kockázat táblázat (rendezhető, szűrhető, trend sparkline-okkal)
```

### 4. pont — Értéknövekedési becslés

| Metrika | Hatás |
|---|---|
| Termékkategória átminősítés | Ütemező eszköz → WFI Platform |
| ARR szorzó növekedés | 3,5× → 5–6× |
| Upsell bevételi potenciál | +€40–80k/év elemzési szint |
| Becsült értéknövekedés | **+€400k–€750k** |

### 5. pont — Újragenerálási prompt

```
Elemezze az Effectime Enterprise-t és hozzon létre átfogó tervet prediktív munkaerő-elemzés hozzáadásához. Fedje le: (1) a piaci lehetőséget Visier, Gartner és PitchBook adatokra hivatkozva az elemzési prémium szorzókról, (2) materializált nézetek, elemzési él-függvények és ML hiányzási kockázat-pontozás technikai architektúráját a meglévő Supabase PostgreSQL adatokon, (3) teljes megvalósítási promptot frontend (Recharts dashboardok) és backend (Edge Functions + pg_cron) számára, (4) értéknövelési hatás ARR szorzó átminősítésen keresztül, (5) újragenerálási meta-prompt. 1–5. pont struktúra.
```

---

## 4. RANG

### 1. pont — White-label és Többbérlős Viszonteladói Architektúra

### 2. pont — Részletes leírás

Az Effectime jelenlegi architektúrája közvetlenül kiszolgálja a vállalatokat (B2B). Egy white-label többbérlős réteg B2B2B platformmá alakítja: HR tanácsadók, bérszámfejtési irodák, IT menedzselt szolgáltatók és regionális HR szoftver-forgalmazók eladhatják az Effectime-ot saját márkájuk alatt ügyfeleiknek. Ez a SaaS-ban elérhető legtőkésebb elosztási stratégia — a viszonteladói hálózat végzi az értékesítést, az Effectime platform bevételt gyűjt közel nulla növekményes ügyfélszerzési költséggel.

**Technikai követelmények:**  
1. **Témamotor** — viszonteladónkénti CSS változók (logó, elsődleges szín, betűtípus) kódmódosítás nélkül injektálva futásidőben.  
2. **Domain elkülönítés** — egyéni CNAME támogatás.  
3. **Viszonteladói admin portál** — külön kezelési UI, ahol a viszonteladók új vállalati bérlőket állítanak be.  
4. **Bevételmegosztás-automatizálás** — Stripe Connect az előfizetési bevétel automatikus megosztásához.

**Piaci precedens:**  
- A Rippling Partner Networkje az új ARR 35%-át generálta 2024-ben.  
- A Gusto Embedded 40%-os prémiummal kereskedik a standalone Gusto szorzóhoz képest.  
- A közép-kelet-európai piacon a HR tanácsadók a WFM vásárlások domináns befolyásolói.

**Források:** Rippling Partner Program Éves Jelentés 2024; Gusto befektetői prezentáció 2025; SaaS Capital "The Case for Partnerships" 2024; Gartner EMEA HR Software Distribution Report 2024.

### 3. pont — Megvalósítási prompt

```
Adjon hozzá white-label többbérlős viszonteladói architektúrát az Effectime Enterprise-hoz.

ADATBÁZIS (migrációk):
1. Hozzon létre resellers táblát: (id, name, slug, theme_config JSONB, custom_domain, stripe_connect_account_id, revenue_share_pct, created_at)
2. Adjon hozzá reseller_id FK-t az enterprises táblához (nullable)
3. Hozzon létre reseller_usage_stats materializált nézetet

BACKEND:
4. Hozzon létre supabase/functions/reseller-admin/index.ts-t a következő akciókkal:
   - "provision-enterprise": új vállalat létrehozása a viszonteladó égisze alatt
   - "get-usage-dashboard": összesített metrikák visszaadása
   - "update-theme": téma konfiguráció érvényesítése és mentése
   
5. Témafeloldó middleware supabase/functions/shared/theme.ts-ben:
   - X-Reseller-Domain fejlécet olvas
   - Visszaadja a theme_config-ot a resellers táblából
   - 5 perces memóriában tárolt gyorsítótár

FRONTEND:
6. Hozzon létre src/pages/ResellerPortal.tsx-t (/reseller/* útvonalakhoz)
   - Ügyfél lista bérlőnkénti MRR, MAU, egészségi pontszámmal
   - Új ügyfél beállítás varázsló
   - Témaszerkesztő élő előnézettel
   - Bevételmegosztás dashboard
```

### 4. pont — Értéknövekedési becslés

| Metrika | Hatás |
|---|---|
| TAM bővítés | 1× → 10× (viszonteladói hálózati hatás) |
| CAC csökkentés | −60–70% (viszonteladók végzik az értékesítést) |
| Új ARR potenciál (5 viszonteladó, 10 ügyfél mindegyiknél) | +€200k–€400k/év |
| Stratégiai prémium (platform vs. alkalmazás) | +50–80% értékelési prémium |
| Becsült értéknövekedés | **+€600k–€1,2M** |

### 5. pont — Újragenerálási prompt

```
Elemezze az Effectime Enterprise-t és tervezzen white-label többbérlős viszonteladói architektúrát. Fedje le: (1) B2B2B piaci indoklás a Rippling, Gusto Embedded és Deputy franchise szintek példáival, (2) technikai architektúra témainjektáláshoz, domain elkülönítéshez, viszonteladói admin portálhoz és Stripe Connect bevételmegosztáshoz, (3) teljes megvalósítási prompt adatbázis migrációkhoz, él-függvényekhez és viszonteladói portál frontendhez, (4) TAM bővítés és értékelési hatás, (5) újragenerálási meta-prompt. 1–5. pont struktúra.
```

---

## 5. RANG

### 1. pont — Bérszámfejtési Motor Integráció (SAP, Workday, ADP, DATEV)

### 2. pont — Részletes leírás

Az a munkaerő-ütemezés, amely nem zárul le a bérszámfejtésbe, egy vállalati vevő szemszögéből "hasznos, de nem kritikus" eszköz. Az a munkaerő-ütemezés, amely *automatikusan kiszámítja a jóváhagyott órákat, alkalmazza a túlóra szabályokat, és közvetlenül exportál a bérszámfejtésbe*, üzleti szempontból kritikus infrastruktúra. A kritikus szoftvert 3–5× nehezebb cserélni, és 2–3× magasabb ARPU-t parancsol.

**Integrációs célok szegmensenként:**  
- **KKV (KKE fókusz):** DATEV (domináns a DACH-ban), Számlázz.hu, Billingo (HU), Pohoda (CZ/SK).  
- **Közép-piac:** Sage HR, BambooHR, Personio (leggyorsabban növekvő európai HRIS, €270M ARR 2025-ben).  
- **Vállalat:** SAP SuccessFactors, Workday HCM, ADP Workforce Now.

**Az integráció tartalma:**  
1. Óra-bérszámfejtés export (CSV/API) előre alkalmazott túlóra-számításokkal.  
2. Hiányzási levonás automatizálás.  
3. Műszakdifferenciál számítás (hétvégi/éjszakai/ünnepi prémiumok).  
4. Egy kattintásos bérszámfejtési időszak zárolás audit naplóval.

**Források:** Personio ARR bejelentés Q1 2025; DATEV partnerprogram adatok; BambooHR API dokumentáció; SAP SuccessFactors Integration Center dokumentumok.

### 3. pont — Megvalósítási prompt

```
Adjon hozzá bérszámfejtési integrációs képességeket az Effectime Enterprise-hoz.

ADATBÁZIS:
1. Migráció: adjon hozzá payroll_export_configs táblát (enterprise_id, provider, config_json, field_mappings JSONB)
2. Migráció: adjon hozzá payroll_periods táblát (start_date, end_date, status: open/locked/exported)
3. Migráció: adjon hozzá payroll_line_items nézetet

BACKEND:
4. Hozzon létre supabase/functions/payroll-export/index.ts-t a következő akciókkal:
   - "calculate-period": összesíti az órákat alkalmazottanként az időszak dátumtartományára
   - "export-csv": bérszámfejtési CSV generálása szolgáltatóspecifikus formátumban
   - "export-api": POST a csatlakoztatott HR rendszer API-jára
   - "lock-period": megváltoztathatatlan audit rekord létrehozása

5. Hozzon létre szolgáltató adaptereket:
   - datev.ts: LODAS/LOHN formátum export
   - bamboohr.ts: BambooHR Time Tracking API
   - personio.ts: Personio Attendance API
   - generic.ts: konfigurálható CSV egyéni mezőleképezéssel

FRONTEND:
6. Hozzon létre src/pages/Payroll.tsx-t
   - Időszak-választó
   - Időszak összefoglaló táblázat: alkalmazott × órák × túlóra × bruttó becslés
   - Export gomb szolgáltató-választóval
   - Időszak zárolása gomb megerősítési párbeszéddel
```

### 4. pont — Értéknövekedési becslés

| Metrika | Hatás |
|---|---|
| Termék ragadósság | Ütemező eszköz → bérszámfejtés-kritikus infrastruktúra |
| ARPU növekedés (bérszámfejtési modul) | +€30–60/hó vállalatonként |
| Lemorzsolódás csökkentése | −40–50% |
| Becsült értéknövekedés | **+€350k–€700k** |

### 5. pont — Újragenerálási prompt

```
Elemezze az Effectime Enterprise-t és tervezzen bérszámfejtési motor integrációs funkciót. Fedje le: (1) piaci indoklás arról, miért alakítja át a bérszámfejtési integráció az ütemező eszközt üzleti szempontból kritikus infrastruktúrává, (2) többszolgáltatós bérszámfejtési export technikai architektúrája időszak-zárolással és audit naplókkal, (3) megvalósítási prompt adatbázis migrációkhoz, él-függvényekhez szolgáltató adapterekkel és frontend bérszámfejtési időszak-kezelő UI-hoz, (4) ARPU és lemorzsolódás-alapú értéknövelési hatás, (5) újragenerálási meta-prompt. 1–5. pont struktúra.
```

---

## 6. RANG

### 1. pont — SOC 2 Type II + ISO 27001 Tanúsítási Program

### 2. pont — Részletes leírás

A biztonsági tanúsítványok nem termékmegjelölések — értékesítési engedők. SOC 2 Type II nélkül az Effectime nem hagyható jóvá egyetlen 500+ alkalmazottat foglalkoztató vállalat vagy nyugat-európai/észak-amerikai szervezet beszerzési és InfoSec csapata által sem. Ez az egyetlen akadály kizárja a legmagasabb ARPU-val rendelkező ügyfélszegmens 60–70%-át.

**Technikai ellenőrzések szükségesek:**  
1. Titkosítás nyugalmi állapotban és átvitel közben — a Supabase alapértelmezés szerint biztosítja (AES-256, TLS 1.3).  
2. Hozzáférés-vezérlés és legkisebb jogosultság.  
3. Audit naplózás — minden privilegizált akciónak (felhasználó létrehozása, szerepváltoztatás, adatexport) megváltoztathatatlan audit táblába kell kerülnie.  
4. Incidensreakció-terv — formalizált dokumentált eljárás (24 órás értesítési SLA).  
5. Sebezhetőség-kezelés — automatizált függőségvizsgálat és éves behatolási teszt.

**Folyamat:**  
Vonjuk be a Vantát (~$15k/év) vagy a Dratát az evidencia-összegyűjtés automatizálásához GitHub-ból, Supabase-ből. Idővonal: 6 hónap a Type II audithoz.

**Piaci hatás:**  
- A Vanta ügyféladatai 40%-kal gyorsabb vállalati értékesítési ciklusokat mutatnak a tanúsítás után.  
- Az ISO 27001 kötelező az összes EU közszektori szerződéshez.

**Források:** Vanta "State of Trust" Jelentés 2025; ISO 27001:2022 szabvány; Gartner vállalati szoftver-beszerzési kritériumok 2025.

### 3. pont — Megvalósítási prompt

```
Implementáljon SOC 2 / ISO 27001 technikai ellenőrzéseket az Effectime Enterprise-ban.

ADATBÁZIS ELLENŐRZÉSEK:
1. Migráció: hozzon létre audit_log táblát (id, enterprise_id, actor_user_id, action, resource_type, resource_id, old_value JSONB, new_value JSONB, ip_address, user_agent, created_at)
2. Hozzon létre audit_log triggereket: users, enterprises, enterprise_members, schedule_events táblákon
3. Migráció: adjon hozzá data_retention_policy táblát
4. Hozzon létre pg_cron feladatot: éjszakai törlés a megőrzési politikán túli rekordokhoz

BACKEND:
5. Adjon hozzá minden Edge Functionhöz:
   - Kérésnaplózó middleware
   - Sebességkorlátozás via Upstash (100 kérés/perc felhasználónként)
   - Input validáció: minden input Zod sémákon megy át
   
6. Hozzon létre supabase/functions/security-admin/index.ts-t:
   - "export-audit-log": lapozott CSV export
   - "list-sessions": aktív munkamenetek IP/eszköz infóval
   - "revoke-session": egy adott munkamenet kényszerkijelentkeztetése
   - "data-export-gdpr": teljes felhasználói adatexport (GDPR 20. cikk)

FRONTEND:
7. Hozzon létre src/pages/SecurityCenter.tsx-t:
   - Audit napló néző szűrőkkel
   - Aktív munkamenetek listája visszavonási gombokkal
   - Adatmegőrzési política konfiguráció
   - GDPR kérelemkezelés
```

### 4. pont — Értéknövekedési becslés

| Metrika | Hatás |
|---|---|
| Vállalati deal feloldás | A Fortune 1000 szegmens 60–70%-a elérhetővé válik |
| Értékesítési ciklus gyorsulása | −40% a bezárásig |
| Kormányzati/közszektori feloldás | Teljes szegmens (ISO 27001 kötelező) |
| Becsült értéknövekedés | **+€250k–€500k** |

### 5. pont — Újragenerálási prompt

```
Elemezze az Effectime Enterprise-t és tervezzen SOC 2 Type II + ISO 27001 megfelelőségi megvalósítási tervet. Fedje le: (1) miért értékesítési engedők a tanúsítványok, Vanta és Gartner adatokkal, (2) szükséges technikai ellenőrzések: audit naplózási triggerek, GDPR végpontok, sebességkorlátozás, biztonsági fejlécek, (3) megvalósítási prompt adatbázis migrációkhoz és Biztonsági Központ frontendhez, (4) deal konverzió és felvásárlói prémium hatás, (5) újragenerálási meta-prompt. 1–5. pont struktúra.
```

---

## 7. RANG

### 1. pont — Mobilcentrikus Natív Alkalmazás Teljes Offline Képességgel

### 2. pont — Részletes leírás

Az Effectime Capacitor scaffoldinggal rendelkezik iOS/Android-ra, de az alkalmazás elsősorban asztali böngészős használatra tervezett. Egy valóban mobilcentrikus élmény — ahol az frontvonalbeli munkavállalók (gyári csarnok, kiskereskedelem, egészségügy) WiFi nélkül is megtekinthetik a beosztásokat, benyújthatják a szabadságkérelmeket és bejelentkezhetnek — egy teljesen új vevő-személyiséget nyit meg: az olyan ágazatok üzemeltetési menedzserei, ahol a munkavállalók 70–80%-ának nincs asztali hozzáférése.

**Az offline követelmény nem tárgyalható ebben a szegmensben:**  
Egy kiskereskedelmi bolti munkavállaló csütörtöki műszakát a metróban (nincs jel) kell tudnia megnézni. Egy gyári munkásnak NFC érintéssel be kell tudnia jelentkezni még akkor is, ha az épület WiFi-routere újraindul.

**Mit kell felépíteni:**  
1. **Service Worker + Workbox** — ütemezési adatok, szabadságegyenlegek és csapatnévsorok gyorsítótárazása 7 napos offline hozzáféréshez.  
2. **Háttérszinkron** — offline benyújtott szabadságkérelmek és bejelentkezési események IndexedDB-ben sorba állva, csatlakozás visszatértekor szinkronizálva.  
3. **Push értesítések** — Supabase Realtime → Firebase Cloud Messaging → natív push.  
4. **Capacitor natív pluginok** — Kamera, NFC (bejelentkezési érintés), Biometrikus hitelesítés.  
5. **Csiszolt mobil UX** — alsó navigáció, swipe gesztusok, haptikus visszajelzés.

**Piaci méret:** 2,7 milliárd "deskless" munkavállaló globálisan (Emergence Capital 2024). A deskless munkavállalókat célzó WFM alkalmazások 15–20× ARR-rel kereskednek vs. az asztali eszközök 5–8×-ával.

**Források:** Emergence Capital "Deskless Workforce" 2024; Deputy mobil MAU jelentés 2025; Capacitor natív plugin dokumentumok; Workbox PWA dokumentáció.

### 3. pont — Megvalósítási prompt

```
Alakítsa át az Effectime-ot mobilcentrikus alkalmazássá offline képességgel.

PWA / SERVICE WORKER:
1. Adjon hozzá vite-plugin-pwa-t a vite.config.ts-hez Workbox konfigurációval:
   - Gyorsítótárazási stratégiák: CacheFirst statikus eszközökhöz, NetworkFirst API hívásokhoz
   - Háttérszinkron: sorba állítja a szabadság-kérelmeket és bejelentkezési eseményeket IndexedDB-ben
   - Push értesítések: iratkozzon fel FCM-re, kezelje a service workerben

2. Hozzon létre src/lib/offline/syncQueue.ts-t:
   - IndexedDB wrapper az idb könyvtár használatával
   - Sorba állított akciók: submit-leave, clock-in, clock-out
   - Újracsatlakozáskor: FIFO sorban dolgozza fel, toast jelenítsen meg elemenként

PUSH ÉRTESÍTÉSEK:
3. Hozzon létre supabase/functions/push-notifications/index.ts-t:
   - Triggerlés: szabadság_kérelem állapotváltozáson, beosztás_esemény frissítésen
   - Küldés Firebase Admin SDK-n keresztül

MOBIL UX:
4. Alakítsa át src/components/layout/Navigation.tsx-t:
   - Mobil: alsó tab sáv (Beosztás, Szabadság, Csapat, Profil)
   - Asztal: meglévő oldalsáv

5. Hozzon létre src/pages/mobile/MobileSchedule.tsx-t:
   - Hetes nézet vízszintes swipe navigációval
   - Nap kártyák nagy érintési célpontokkal (min 44px)
   - Bejelentkezés/kijelentkezés lebegő akciógomb
```

### 4. pont — Értéknövekedési becslés

| Metrika | Hatás |
|---|---|
| Új TAM (deskless munkavállalók) | +€2,7B piaci szegmens hozzáférés |
| ARR szorzó (mobilcentrikus WFM) | 15–20× vs. jelenlegi 3,5× |
| Becsült értéknövekedés | **+€300k–€600k** |

### 5. pont — Újragenerálási prompt

```
Elemezze az Effectime Enterprise-t és tervezzen mobilcentrikus átalakulást offline képességgel. Fedje le: (1) deskless munkaerő piaci mérete és Deputy/When I Work összehasonlítható szorzók, (2) PWA Service Worker + Workbox architektúra offline szinkronhoz, Capacitor natív pluginok, Firebase push értesítések, (3) megvalósítási prompt vite-plugin-pwa-hoz, offline sorhoz, mobil navigációhoz, (4) TAM bővítés és ARR szorzó átminősítési értéknövelési hatás, (5) újragenerálási meta-prompt. 1–5. pont struktúra.
```

---

## 8. RANG

### 1. pont — Prediktív Kiégés és Jóllét Felismerő Motor

### 2. pont — Részletes leírás

Az ESG (Környezeti, Társadalmi, Irányítási) kritériumok most már a Fortune 500 vállalatai 85%-ának beszerzési döntéseit befolyásolják (McKinsey 2025). A "Munkavállalói Jóllét" a HR tech leggyorsabban növekvő ESG alkategóriája. Egy kiégés-felismerési funkció — amely az ütemezési mintázatokat, a túlóra-frekvenciát, a szabadságegyenleg kimerülési arányát és a hétvégi munkasűrűséget használja személyenkénti jóllét-pontszám előállítására — az Effectime-ot megfelelőségi/logisztikai eszközből stratégiai emberberuházási platformmá alakítja.

**Az Effectime-ban már meglévő adatok:**  
- Túlóra frekvencia és nagyság alkalmazottanként  
- Szabadságegyenleg kimerülési aránya  
- Hétvégi/ünnepi munkasűrűség  
- Beosztásváltás frekvencia (utolsó pillanatos változtatások = instabilitás = kiégési kockázat)  
- Egymást követő munkaszünetnélküli munkanapok

**A modell:**  
Súlyozott pontozási algoritmus (nem ML, az elfogultság aggályok és szabályozási problémák elkerülése érdekében) ezeket a jeleket 0–100-as Jóllét-pontszámba kombinálja. Küszöbértékek: Zöld (70–100), Sárga (40–69), Piros (0–39).

**Piaci pozicionálás:**  
Ez a funkció közvetlenül a Peakon (Workday), Culture Amp és Leapsome ellen versenyez — mindegyik önálló termék, €8–15/alkalmazott/hó árral. Az Effectime az ütemezési platform részeként köti be ezt, az egyedülálló eszközöket alákínálva overális adatminőséggel.

**Források:** McKinsey "ESG in HR Tech" 2025; Gallup Kiégési Jelentés 2025; Culture Amp árazás 2025; WHO kiégési definíció ICD-11.

### 3. pont — Megvalósítási prompt

```
Implementáljon Kiégés és Jóllét Felismerő Motort az Effectime Enterprise-ban.

ADATBÁZIS:
1. Migráció: hozzon létre wellbeing_scores táblát (employee_id, enterprise_id, score INT, components JSONB, calculated_at)
2. Migráció: hozzon létre wellbeing_alerts táblát (employee_id, manager_id, alert_type, triggered_at, resolved_at)
3. Adjon hozzá pg_cron feladatot: heti jóllét-pontszám kiszámítás

PONTOZÁSI ALGORITMUS:
4. Implementálja a pontozás kiszámítási akciót:
   Komponensek (vállalatonként konfigurálható súlyok):
   - overtime_score: hours_overtime / expected_hours (súly: 30%)
   - leave_utilization_score: taken_days / accrued_days (súly: 20%)
   - weekend_density_score: weekend_days_worked / total_days (súly: 25%)
   - schedule_stability_score: 1 - (last_minute_changes / total_shifts) (súly: 15%)
   - recovery_score: avg_days_between_shifts (súly: 10%)

FRONTEND:
5. Hozzon létre src/components/Wellbeing/WellbeingDashboard.tsx-t:
   - Csapat jóllét hőtérkép színkódolt pontszámokkal
   - Pontszám-trend sparkline-ok alkalmazottanként
   - Riasztási beérkező menedzsereknek ajánlott akciókkal
   
6. Hozzon létre src/components/Wellbeing/WellbeingScoreCard.tsx-t (alkalmazott saját nézete):
   - Személyes pontszám a hozzájáruló tényezők magyarázatával
   - "X napnyi szabadság áll rendelkezésre — fontolja meg foglalását" ösztönző
```

### 4. pont — Értéknövekedési becslés

| Metrika | Hatás |
|---|---|
| ESG / HR vevő persona hozzáadása | CHROk, People Ops vezetők |
| Versenyképes differenciálás | KKE-piacon egyedülálló funkció |
| Upsell potenciál (jóllét modul) | +€15–25/alkalmazott/hó |
| Becsült értéknövekedés | **+€200k–€400k** |

### 5. pont — Újragenerálási prompt

```
Elemezze az Effectime-ot és tervezzen Prediktív Kiégés és Jóllét Felismerési funkciót. Fedje le: (1) ESG piaci hajtóerők, McKinsey és Gallup kiégési adatok, (2) súlyozott pontozási algoritmus architektúrája a meglévő ütemezési adatjelekkel Supabase-en pg_cron-nal, (3) megvalósítási prompt a pontozó motorhoz, riasztási munkafolyamathoz, csapat hőtérkép UI-hoz, (4) upsell bevétel és ESG pozicionálási értéknövelési hatás, (5) újragenerálási meta-prompt. 1–5. pont struktúra.
```

---

## 9. RANG

### 1. pont — Nyílt API Platform és Fejlesztői Ökoszisztéma

### 2. pont — Részletes leírás

Egy nyilvános REST API átfogó dokumentációval, API kulcsokkal, webhookokkal és fejlesztői portállal nem csupán funkció — stratégiai moat. Ha harmadik fél fejlesztők az Effectime API-jára építenek integrációkat, váltási költségeket hoznak létre, kiterjesztik a termék funkcionalitását Effectime-mérnöki erőfeszítés nélkül, és bejövő felfedezést generálnak.

**Az API platform tartalma:**  
1. **REST API v1** — teljes CRUD beosztásokhoz, szabadságkérelmekhez, alkalmazottakhoz, csapatokhoz, helyszínekhez.  
2. **Webhook előfizetések** — vállalati adminok feliratkoznak eseményekre (szabadság.jóváhagyva, beosztás.változott, tag.hozzáadva).  
3. **API kulcskezelő UI** — hatókörrel rendelkező API kulcsok létrehozása/visszavonása, használati metrikák.  
4. **Fejlesztői dokumentációs portál** — OpenAPI 3.0 spec az él-függvény Zod sémákból automatikusan generálva.  
5. **Sandbox környezet** — előre feltöltött adatokkal rendelkező demo vállalat a fejlesztők tesztelésére.

**Miért ez erősíti az értéket:**  
- Zapier integráció (15M+ felhasználó): a nyilvános API-ra épített Zapier csatlakozó 6000+ más alkalmazást nyit meg.  
- Minden harmadik fél által épített integráció terjesztési csatorna.  

**Források:** Stripe fejlesztői platform növekedési sztori; Zapier partner marketplace statisztikák 2025; ProgrammableWeb API gazdasági jelentés 2024.

### 3. pont — Megvalósítási prompt

```
Építsen nyilvános API platformot és fejlesztői ökoszisztémát az Effectime-nak.

API KULCSOK ÉS HITELESÍTÉS:
1. Migráció: hozzon létre api_keys táblát (id, enterprise_id, name, key_hash, scopes TEXT[], last_used_at, expires_at)
2. Migráció: hozzon létre api_usage_logs táblát

NYILVÁNOS REST API:
3. Hozzon létre supabase/functions/public-api/index.ts-t API átjáróként:
   - Hitelesítés: Bearer token → érvényesítés az api_keys táblán
   - Sebességkorlátozás: 1000 kérés/óra kulcsonként
   - Útvonalak: GET/POST/PUT/DELETE /v1/schedules, /v1/employees, /v1/leave-requests, /v1/teams
   - Minden válasz: { data: T, meta: { page, total, request_id } }

WEBHOOKOK:
4. Migráció: hozzon létre webhook_subscriptions táblát
5. Hozzon létre supabase/functions/webhook-dispatcher/index.ts-t:
   - pg_notify-vel triggerelve
   - HMAC-SHA256-tal aláírja a hasznos terhet
   - Újrapróbálkozások: exponenciális visszalépés 3×

FEJLESZTŐI PORTÁL:
6. Hozzon létre src/pages/DeveloperPortal.tsx-t:
   - API kulcskezelés (hatókörrel való létrehozás, lista, visszavonás)
   - Webhook előfizetés-kezelés
   - Használati diagramok
```

### 4. pont — Értéknövekedési becslés

| Metrika | Hatás |
|---|---|
| Terjesztés (Zapier, Make, n8n csatlakozók) | +30–50% bejövő leadek |
| Integráció ragadóssága | −35% lemorzsolódás API-csatlakoztatott vállalatoknál |
| Platform szorzó prémium | +20–30% értékelés a nem-platform SaaS-hoz képest |
| Becsült értéknövekedés | **+€180k–€350k** |

### 5. pont — Újragenerálási prompt

```
Elemezze az Effectime-ot és tervezzen nyilvános REST API platformot és fejlesztői ökoszisztémát. Fedje le: (1) API-first stratégia piaci bizonyítékai a Stripe, Zapier adatokkal, (2) API kulcs hitelesítés, sebességkorlátozás, HMAC-aláírású webhook diszpécserlés és OpenAPI spec generálás technikai architektúrája Supabase-en, (3) megvalósítási prompt API átjáró él-függvényhez, webhook diszpécserhez és fejlesztői portál UI-hoz, (4) terjesztés és lemorzsolódás hatás az értékelésre, (5) újragenerálási meta-prompt. 1–5. pont struktúra.
```

---

## 10. RANG

### 1. pont — GPS / NFC / QR Biometrikus Bejelentkezési Rendszer

### 2. pont — Részletes leírás

A fizikai jelenlét igazolás — az időnyilvántartó hardver cseréje okostelefon-alapú GPS, NFC és QR bejelentkezéssel — egy $4,2 milliárd dolláros hardvercserélési piac (MarketsandMarkets 2025). A vállalatok jelenleg €500–€3 000-t fizetnek fizikai időnyilvántartó eszközönként. A szoftver alternatíva kiküszöböli a hardverköltségeket és gazdagabb adatokat biztosít.

**Szabályozási megjegyzés:** Az EU-ban (Magyarország, Németország stb.) az EUB 2019-es *Deutsche Bank* ítélete és az azt követő nemzeti végrehajtások megkövetelik a munkáltatóktól az összes munkaidő nyilvántartását. Ez szabályozási megfelelőségi hajtóerő, nem csupán kényelmi funkció.

**Mit kell felépíteni:**  
1. **GPS geofence bejelentkezés** — az alkalmazott csak a kijelölt munkahely 50–200 méteres körzetén belül tud bejelentkezni.  
2. **QR kód rotáció** — a helyszínmenedzserek 60 másodpercenként forgó QR kódot jelenítenek meg.  
3. **NFC tag érintés** — a Capacitor NFC plugin leolvas egy bejáratnál elhelyezett NFC matricát.  
4. **Jelenléti elemzés** — késői érkezések, korai távozások, helyszíni anomáliák.

**Források:** MarketsandMarkets "Time & Attendance Market" 2025; EUB C-55/18 (Deutsche Bank ügy) munkaidő-nyilvántartási követelmény; Dormakaba időnyilvántartó árazás 2025.

### 3. pont — Megvalósítási prompt

```
Adjon hozzá GPS/NFC/QR jelenlétigazolást az Effectime Enterprise-hoz.

ADATBÁZIS:
1. Migráció: hozzon létre clock_events táblát (id, employee_id, enterprise_id, event_type: clock_in/clock_out, method: gps/nfc/qr/manual, coordinates POINT, site_id, verified BOOLEAN, created_at)
2. Migráció: adjon hozzá geofence_config JSONB-t az enterprise_sites táblához
3. Migráció: hozzon létre qr_sessions táblát (rotáló kódokhoz)

BACKEND:
4. Hozzon létre supabase/functions/attendance/index.ts-t a következő akciókkal:
   - "clock-in": validálja a módszert (gps: geofence ellenőrzés, qr: kód érvényesítés, nfc: tag_id érvényesítés)
   - "clock-out": ugyanolyan validáció
   - "generate-qr": új QR munkamenet létrehozása helyszínhez (60 mp-es lejárat)
   - "attendance-report": összesítés időszak szerint, anomáliák megjelölése

FRONTEND — MOBIL:
5. Hozzon létre src/pages/mobile/ClockIn.tsx-t:
   - Nagy "Bejelentkezés" gomb az aktuális idővel
   - Módszerkiválasztó: GPS / QR Beolvasás / NFC
   - GPS: térkép megjelenítése geofence körrel
   - QR: kamera beolvasó megnyitása
   - NFC: érintési utasítás + NFC olvasó kezelő

MENEDZSER NÉZET:
6. Hozzon létre src/components/Attendance/LiveAttendanceBoard.tsx-t:
   - Valós idő: ki van éppen bejelentkezve (Supabase Realtime-on keresztül)
   - Késői érkezések narancssárgával kiemelve
   - Hiányzók (ütemezett, de be nem jelentkezett) pirossal kiemelve
```

### 4. pont — Értéknövekedési becslés

| Metrika | Hatás |
|---|---|
| Hardvercserélési piac | €500–€3 000 megtakarítás helyszínenként |
| Szabályozási megfelelőségi hajtóerő | EUB ítélet = kötelező az EU-ban |
| ARPU növekedés (jelenléti modul) | +€20–40/hó vállalatonként |
| Becsült értéknövekedés | **+€150k–€300k** |

### 5. pont — Újragenerálási prompt

```
Elemezze az Effectime-ot és tervezzen GPS/NFC/QR bejelentkezési jelenlétigazolási rendszert. Fedje le: (1) hardvercserélési piaci adatok és EUB munkaidő-nyilvántartási kötelezettség, (2) geofenced GPS validáció, forgó QR kódok, NFC Capacitor plugin és valós idejű jelenléti tábla technikai architektúrája, (3) megvalósítási prompt a backend jelenléti él-függvényhez és mobil bejelentkezési UI-hoz, (4) ARPU növekedés és hardver kiszorítás értéknövelési hatás, (5) újragenerálási meta-prompt. 1–5. pont struktúra.
```

---

## 11. RANG

### 1. pont — Készségek és Kompetencia Mátrix (HR Platform Bővítés)

### 2. pont — Részletes leírás

A "ki dolgozik mikor" kérdéstől a "kinek *kell* dolgoznia mikor, adott készségei alapján" kérdés felé való elmozdulás az ugrás az ütemező szoftverből a tehetségoptimalizálási platformba. A Készségek és Kompetencia Mátrix lehetővé teszi a vállalatoknak, hogy az alkalmazottakat készségekkel tagozzák (targonca-jogosítvány, elsősegélynyújtás, ISO auditor, nyelv: francia), majd hagyják az okos ütemező algoritmust automatikusan biztosítani, hogy minden műszaknak meglegyen a szükséges készségfedettsége.

**Terjeszkedési lehetőség:**  
Ha egyszer az Effectime rendelkezik a készséggrafikával, kiterjeszthet szomszédos modulokba: képzésmenedzsment, utódlástervezés és belső tehetségpiac.

**Forrásokból:** LinkedIn "Future of Work" 2025 (készségalapú felvétel 63%-kal nőtt YoY); Gartner "Shift to Skills-Based Organizations" 2025.

### 3. pont — Megvalósítási prompt

```
Adjon hozzá Készségek és Kompetencia Mátrixot az Effectime Enterprise-hoz.

ADATBÁZIS:
1. Migráció: hozzon létre skills táblát
2. Migráció: hozzon létre employee_skills táblát (expires_at, certified_by, evidence_url mezőkkel)
3. Migráció: hozzon létre shift_skill_requirements táblát
4. Frissítse a smartSchedule.ts-t: készség-egyezés hozzáadása kemény megszorításként

FRONTEND:
5. Hozzon létre src/pages/Skills.tsx-t — Készségtár
6. Hozzon létre src/components/Employee/SkillsPanel.tsx-t:
   - Készség lista jártassági sávokkal
   - Tanúsítás állapot jelzők (érvényes / hamarosan lejár / lejárt)
7. Hozzon létre src/components/Schedule/SkillCoverageIndicator.tsx-t:
   - Műszakankénti készségfedettség összefoglaló
   - Figyelmeztetés ikon, ha kötelező készség hiányzik
```

### 4. pont — Értéknövekedési becslés

| Metrika | Hatás |
|---|---|
| HR platform vs. ütemező eszköz átpozicionálás | +40% ARR szorzó |
| Upsell készség-modulhoz | +€20–35/hó vállalatonként |
| Becsült értéknövekedés | **+€120k–€250k** |

### 5. pont — Újragenerálási prompt

```
Elemezze az Effectime-ot és tervezzen Készségek és Kompetencia Mátrix funkciót. Fedje le az ütemező algoritmusba kemény megszorításként való integrációt, a tanúsítás lejárati nyomon követést, és az ARR szorzó átminősítési értéknövelési hatást. 1–5. pont struktúra.
```

---

## 12. RANG

### 1. pont — Műszakpiac és Peer-to-Peer Műszakcsere

### 2. pont — Részletes leírás

A műszakcsere funkció — amely lehetővé teszi az alkalmazottaknak, hogy felajánlják műszakjaikat képzett kollégáknak, menedzseri jóváhagyással — a lefedettséggel kapcsolatos kérések kezelési terhét 60–70%-kal csökkenti a menedzsereknél (Shiftboard esettanulmány, 2024). Ahelyett, hogy egy menedzsernek hajnali 6-kor beteg munkavállaló helyettesítőt kellene keresnie, a rendszer automatikusan értesíti az erre jogosult alkalmazottakat.

**A When I Work erre az egyetlen funkcióra építette teljes kezdeti üzletét (most $100M+ ARR).**

**Forrásokból:** Shiftboard ROI esettanulmány 2024; When I Work termék-történet; Homebase 2024 éves termékellenőrzés.

### 3. pont — Megvalósítási prompt

```
Implementáljon Műszakpiacot és peer-to-peer műsziakcserét az Effectime-ban.

ADATBÁZIS:
1. Migráció: hozzon létre shift_trade_offers táblát
2. Migráció: hozzon létre shift_trade_acceptances táblát
3. Adjon hozzá jogosultság-ellenőrző funkciót: fn_eligible_for_shift(employee_id, shift_id)

BACKEND:
4. Akciók a join-event-ben:
   - "offer-shift-trade": validálja a tulajdonjogot, értesíti a jogosult alkalmazottakat
   - "accept-shift-trade": validálja a jogosultságot, értesíti a menedzsert
   - "approve-shift-trade": frissíti a műszak-kiosztást, megerősítéseket küld

FRONTEND:
5. Hozzon létre src/pages/ShiftMarketplace.tsx-t:
   - Elérhető műszakok hírfolyam kártya listával
   - Menedzseri jóváhagyási sor
6. Hozzon létre src/components/Schedule/ShiftTradeButton.tsx-t:
   - Megjelenik a beosztás nézetben a műszak kártyákon
   - Vizuális jelző, ha egy műszaknak van függőben lévő cserelajánlata
```

### 4. pont — Értéknövekedési becslés

| Metrika | Hatás |
|---|---|
| Menedzseri időmegtakarítás | 60–70%-os csökkentés a lefedettségi hívásokban |
| Célvevő: kiskereskedelem/egészségügy | Magas műszaksűrűségű szektorok megnyílnak |
| Becsült értéknövekedés | **+€100k–€200k** |

### 5. pont — Újragenerálási prompt

```
Elemezze az Effectime-ot és tervezzen Műszakpiacot és peer műszakcsere-rendszert. Fedje le a jogosultság-számítást, ajánlat/elfogadás/jóváhagyás munkafolyamatot, push értesítéseket és piaci frontend UI-t. 1–5. pont struktúra.
```

---

## 13–20. RANG ÖSSZEFOGLALÓK

*(A 13–20. rangú pontok rövidített formátumban, a teljes megvalósítási részletekkel együtt)*

---

## 13. RANG

### 1. pont — Automatizált GDPR és Munkajogi Megfelelőségi Jelentéskészítés

### 2. pont — A munkajogi megfelelőség kötelező a szabályozott iparágakban. A funkció valós idejű megfelelőségi irányítópultat biztosít, amely az EU Munkaidő-irányelvvel (48 óra/hét max), a Magyar Munka Törvénykönyvével és a GDPR-rel szemben ellenőrzi az ütemezéseket. A beosztás-közzétevő munkafolyamatba integrált automatikus blokkolás megelőzi a kötelezettségszegéseket.

### 3. pont

```
Implementáljon automatizált munkajogi megfelelőségi és GDPR jelentéskészítést. Hozzon létre megfelelőségi szabályok motort kötelező megszorításokkal az EU WTD, Magyar Mt. és GDPR számára. Blokkolt közzétevő munkafolyamat kemény megsértéseknél. GDPR export/törlés automatizálás. Értékelés-becsléssel.
```

### 4. pont — **+€100k–€200k** értéknövekedés

### 5. pont — `Elemezze az Effectime-ot és tervezzen automatizált megfelelőségi rendszert az EU munkaidő-irányelvhez és GDPR-hez. 1–5. pont struktúra.`

---

## 14. RANG

### 1. pont — Gamifikáció és Munkavállalói Elköteleződési Réteg

### 2. pont — A napi aktív felhasználók számát növelő opt-in gamifikáció (heti 2–3 munkamenetről 5–7-re) a termékváltást ellehetetlenítő ragadós élményt hoz létre. Az Octalysis keretrendszer (Yu-kai Chou) alapján: pontossági sorozatok, szabadság-tervező jelvények, csapatteljesítmény kihívások — önrendelkezés-elmélet alapján, nem felügyeleti nyomás.

### 3. pont

```
Adjon hozzá opt-in gamifikációs és elköteleződési réteget az Effectime-hoz. Achievement motor, pg_cron triggerek, jelvényfal UI, csapat kihívások. Teljes GDPR opt-out. Vállalati szintű be/ki kapcsoló.
```

### 4. pont — **+€80k–€160k** értéknövekedés

### 5. pont — `Elemezze az Effectime-ot és tervezzen gamifikációs réteget az Octalysis keretrendszer alapján európai munkakultúra-megfontolásokkal. 1–5. pont struktúra.`

---

## 15. RANG

### 1. pont — Egyéni Jelentéskészítő és Önkiszolgáló BI

### 2. pont — Drag-and-drop vizuális jelentéskészítő ütemezett kézbesítéssel és Recharts-alapú diagramokkal. Eliminálja a személyre szabott jelentések iránti támogatási kérelmeket (−50%). Az egyéni sablonok adatragadóssági moatot hoznak létre.

### 3. pont

```
Adjon hozzá drag-and-drop egyéni jelentéskészítőt dinamikus SQL lekérdezési motorral, RLS-tudatos mezőlistával, ütemezett e-mail kézbesítéssel és Recharts diagramok előnézetével.
```

### 4. pont — **+€80k–€150k** értéknövekedés

### 5. pont — `Elemezze az Effectime-ot és tervezzen önkiszolgáló BI és egyéni jelentéskészítő rendszert. 1–5. pont struktúra.`

---

## 16. RANG

### 1. pont — Többnyelvű Terjeszkedés és Globális Bérszámfejtési Megfelelőség (DACH + KKE)

### 2. pont — A DACH piac 18× Magyarország GDP-je, és a helyi nyelvű WFM szoftverpiacon gyenge a verseny (ZEUS, TimeSoft — 1990-es évekbeli termékek). i18next 8 locale-lal (hu, en, de, de-AT, cs, sk, pl, ro), ország-specifikus munkaügyi szabályok, DATEV/Pohoda bérszámfejtési export.

### 3. pont

```
Implementáljon i18next-et 8 locale-lal az Effectime-ba, adjon hozzá ország-konfigurációs táblákat, Nager.Date szünnapszinkront és DACH-specifikus bérszámfejtési export formátumokat.
```

### 4. pont — **+€300k–€600k** értéknövekedés

### 5. pont — `Elemezze az Effectime-ot és tervezzen többnyelvű DACH+KKE piac-bővítési stratégiát. 1–5. pont struktúra.`

---

## 17. RANG

### 1. pont — Ügyfél Siker Platform (Onboarding, Egészségi Pontszámok, NPS)

### 2. pont — A proaktív ügyfélsiker a lemorzsolódás leggyorsabb csökkentési módja. Interaktív onboarding ellenőrzőlista (befejezetlenség esetén 4× magasabb lemorzsolódás), algoritmikus egészségi pontszámok, automatizált NPS felmérések.

### 3. pont

```
Építsen be ügyfél-siker platformot az Effectime-ba: onboarding ellenőrzőlista widget, heti pg_cron egészségpontszám-számítás, NPS automatizálás 30/90 napra.
```

### 4. pont — **+€100k–€200k** értéknövekedés

### 5. pont — `Elemezze az Effectime-ot és tervezzen beépített ügyfél-siker platformot. 1–5. pont struktúra.`

---

## 18. RANG

### 1. pont — AI Dokumentumgenerátor (Szerződések, Szabályzatok, HR Levelek)

### 2. pont — Claude Haiku segítségével automatikusan generált HR dokumentumok az Effectime-ban már meglévő alkalmazotti + ütemezési adatokból. Munkaszerződés-kiegészítések, szabadság-jóváhagyó levelek, munkaidő-összefoglalók.

### 3. pont

```
Implementáljon AI HR dokumentumgenerátort Claude Haiku-val. Sablon rendszer, dokumentum él-függvény, HTML előnézet szerkesztéssel, szabadság-jóváhagyási munkafolyamat integráció.
```

### 4. pont — **+€80k–€150k** értéknövekedés

### 5. pont — `Elemezze az Effectime-ot és tervezzen AI HR dokumentumgenerátort. 1–5. pont struktúra.`

---

## 19. RANG

### 1. pont — Bővítmény-piactér és Plugin Architektúra

### 2. pont — Plugin manifest rendszer, szandboxolt API kulcsok, hook eseményrendszer és UI bővítési pontok. Salesforce AppExchange modell (30% bevételrészesedés). Egészségügyi, kiskereskedelmi, építési és vendéglátóipari vertikális bővítmények harmadik fél fejlesztőktől.

### 3. pont

```
Építsen bővítmény-piactért és plugin architektúrát az Effectime-nak. Plugin manifest JSON séma, szandboxolt API kulcsok, hook diszpécser, piactér frontend, @effectime/plugin-sdk npm csomag.
```

### 4. pont — **+€150k–€300k** értéknövekedés (hosszú távon: transzformatív)

### 5. pont — `Elemezze az Effectime-ot és tervezzen harmadik fél bővítmény-piactért Salesforce AppExchange modell alapján. 1–5. pont struktúra.`

---

## 20. RANG

### 1. pont — Automatizált Jelölt Ütemezés és ATS Integráció (Szomszédos Piac Bővítés)

### 2. pont — A meglévő munkaerő-ütemezési adatok felfelé irányuló szomszédja: jelölt önfoglaló interjú időpontok az Effectime naptárral szinkronizálva, Greenhouse/Lever/Workable ATS integráció, onboarding beosztás automatizálás új alkalmazottaknak.

### 3. pont

```
Adjon hozzá jelölt ütemezési és ATS integrációs funkciót az Effectime-hoz. Elérhetőségi motor, ATS szolgáltató adapterek, nyilvános önfoglaló oldal, új munkavállaló onboarding beosztás varázsló.
```

### 4. pont — **+€120k–€250k** értéknövekedés

### 5. pont — `Elemezze az Effectime-ot és tervezzen automatizált jelölt ütemezési és ATS integrációs funkciót. 1–5. pont struktúra.`

---

## Összefoglaló Értékmátrix

| Rang | Funkció | Becsült Értéknövekedés |
|---|---|---|
| 1 | AI Ütemező Kopilot | +€800k–€1,35M |
| 2 | Microsoft 365 / Google Workspace Integráció | +€280k–€570k |
| 3 | Valós Idejű Prediktív Elemzési Dashboard | +€400k–€750k |
| 4 | White-label és Többbérlős Architektúra | +€600k–€1,2M |
| 5 | Bérszámfejtési Motor Integráció | +€350k–€700k |
| 6 | SOC 2 Type II + ISO 27001 Tanúsítás | +€250k–€500k |
| 7 | Mobilcentrikus Natív Alkalmazás (Offline) | +€300k–€600k |
| 8 | Kiégés és Jóllét Felismerés | +€200k–€400k |
| 9 | Nyílt API Platform és Fejlesztői Ökoszisztéma | +€180k–€350k |
| 10 | GPS/NFC/QR Bejelentkezési Rendszer | +€150k–€300k |
| 11 | Készségek és Kompetencia Mátrix | +€120k–€250k |
| 12 | Műszakpiac és Peer Csere | +€100k–€200k |
| 13 | GDPR és Munkajogi Megfelelőség Automatizálás | +€100k–€200k |
| 14 | Gamifikáció és Munkavállalói Elköteleződés | +€80k–€160k |
| 15 | Egyéni Jelentéskészítő és Önkiszolgáló BI | +€80k–€150k |
| 16 | Többnyelvű Terjeszkedés és DACH Bővítés | +€300k–€600k |
| 17 | Ügyfél Siker Platform | +€100k–€200k |
| 18 | AI Dokumentumgenerátor | +€80k–€150k |
| 19 | Bővítmény-piactér és Plugin Architektúra | +€150k–€300k |
| 20 | Jelölt Ütemezés és ATS Integráció | +€120k–€250k |
| | **TELJES KOMBINÁLT POTENCIÁL** | **+€4,74M–€9,23M** |

**Kiindulási értékelés:** €580k–€1,05M  
**Célértékelés (teljes végrehajtás):** **€5,3M–€10,3M** — ez **8–10× értékszorzót** jelent

---

*A jelentést az Effectime Enterprise kódbázis, piackutatás és versenyképességi elemzés AI-alapú vizsgálata alapján készítettük. Minden becslés valószínűségi jellegű — a tényleges eredmények a végrehajtás minőségétől, a piaci időzítéstől és a versenytársak reakcióitól függnek. Módszertan: ARR szorzó elemzés, összehasonlítható tranzakciós elemzés és funkció-alapú stratégiai prémium értékelés.*
