# Effectime Enterprise – Változásnapló-intelligencia és törékenységi elemzés

<!-- METADATA -->
| Mező | Érték |
|---|---|
| Dokumentum | CHANGE_INTELLIGENCE_APPENDIX.md |
| Generálva | 2026-05-10T12:00:00Z |
| Repozitórium | HenrikFaul/effectime-app-enterprise-a95029a1 |
| Branch | claude/create-software-documentation-O7kj1 |
| Revision | 8919c402e74e41bbe83ccf1e6385c92d0fddeada |
| Megbízhatóság | Magas (verified: CHANGELOG + codingLessonsLearnt.md) |
| Kapcsolódó dok. | TECHNICAL_ARCHITECTURE.md, DATA_FLOW_AND_ENTITY_REFERENCE.md |

---

## Tartalomjegyzék

1. [Verziótörténet (v3.3.1–v3.3.6)](#1-verziótörténet-v331v336)
2. [Ismert törékeny területek](#2-ismert-törékeny-területek)
3. [Ismert hibaminták](#3-ismert-hibaminták)
4. [Ne-törd-el területek (Do-Not-Break)](#4-ne-törd-el-területek-do-not-break)
5. [Migráció-érzékeny táblák és oszlopok](#5-migráció-érzékeny-táblák-és-oszlopok)
6. [Leckék kategória szerint](#6-leckék-kategória-szerint)

---

## 1. Verziótörténet (v3.3.1–v3.3.6)

### v3.3.6 — Demo seed schema-drift hotfix
**Dátum**: 2026-05-10 (legutóbbi)
**Kategória**: SEED, Hotfix

**Probléma**: A demo workspace seed (`seed-demo-workspace` edge function) schema-drift miatt meghibásodott — az adatbázis séma megváltozott, de a seed script nem követte a változásokat.

**Megoldás**: A seed script frissítve az aktuális séma mezőneveihez.

**Tanulság**: A seed script nem automatikusan frissül a séma migrációkkal együtt. Minden migráció után ellenőrizni kell, hogy a seed script kompatibilis-e.

---

### v3.3.5 — Demo workspace leave-entities completion fix
**Kategória**: SEED

**Probléma**: A demo workspace seed nem töltötte be teljes körűen a leave entitásokat (leave_requests, approval_decisions, enterprise_quota_transactions).

**Megoldás**: A seed script kibővítve a hiányzó leave entitásokkal.

**Tanulság**: A seed tesztelésekor minden fő entitást ellenőrizni kell, nem csak a tagokat és a workspace-t.

---

### v3.3.4 — Demo workspace leave seed fail-fast fix
**Kategória**: SEED

**Probléma**: A leave seed hibásan futott le anélkül, hogy a hiba azonnal megállítaná a folyamatot. Az adatok részlegesen kerültek be.

**Megoldás**: Fail-fast guard bevezetése — ha egy lépés hibás, az egész seed tranzakció visszagörgetődik.

**Tanulság**: Seed script-eknél mindig tranzakciót kell használni, és a hibákat azonnal propagálni kell.

---

### v3.3.3 — Timeline infinite re-render loop fix
**Kategória**: UI, React

**Probléma**: A `TimelineView` komponens végtelen újrarenderelési ciklust okozott. A `useCallback` referencia instabilnak bizonyult, ami rekurzív re-render triggert okozott.

**Megoldás**:
- Stabil `useCallback` referencia bevezetése
- `useRef` indirection alkalmazása a mutable értékek tárolásához a callback-ben

**Törékeny területek**: Bármilyen változtatás a `TimelineView`-ban vagy a hozzá kapcsolódó hook-okban potenciálisan újra bevezetheti ezt a problémát.

**Tanulság**: Nagy listákat megjelenítő, virtualizált komponenseknél (különösen `@tanstack/react-virtual`-lal) az összes callback-et stabil `useCallback`+`useRef` párossal kell kezelni.

---

### v3.3.2 — TimelineView hónapváltás debounce + Promise.allSettled
**Kategória**: UI, React, Supabase-SDK

**Probléma**: Gyors hónapváltáskor (pl. `<` / `>` gombok gyors kattintása) a TimelineView párhuzamos adatlekérések versenyhelyzetét produkálta, ami inkonzisztens állapothoz vezetett.

**Megoldás**:
- Debounce bevezetése a hónapváltó logikánál
- `Promise.allSettled` használata `Promise.all` helyett — így egy lekérés hibája nem blokkol más adatokat

**Tanulság**: Ha egy komponens gyors felhasználói interakciót vált ki és közben adatbetöltést is igényel, mindig debounce-ot kell alkalmazni.

---

### v3.3.1 — Org Chart Pan/Zoom + Fullscreen Popup Modal
**Kategória**: UI

**Probléma**: Az Org Chart nem volt navigálható nagy szervezetek esetén — nem volt zoom/pan lehetőség.

**Megoldás**:
- Pan/zoom navigáció hozzáadva az Org Chart-hoz
- Teljes képernyős modális nézet bevezetése

**Törékeny területek**: Az Org Chart SVG/Canvas renderelési logikája érzékeny. Változtatáskor tesztelni kell normál és teljes képernyős módban is.

---

### v3.2.2 — Help reference feature map
**Kategória**: Help rendszer

**Változtatás**: A `help-reference.md` kanonikus forrásként lett definiálva a `help_articles` tábla tartalmához. A `help-regenerator` edge function ezt a fájlt dolgozza fel.

**Fontosság**: Ha a help anchor ID-k megváltoznak a kódban, a `help-reference.md`-t is frissíteni kell, majd a help-regeneratort újra kell futtatni.

---

## 2. Ismert törékeny területek

### 2.1 TimelineView (KRITIKUS)
**Hely**: `src/` (TimelineView komponens)
**Kockázat**: Végtelen re-render loop

Figyelmeztetések:
- Ne adjunk hozzá új dependency-ket a belső `useCallback`-ekhez anélkül, hogy megbizonyosodunk az instabil referenciák kiküszöböléséről
- Minden state-változás, ami TimelineView re-rendert triggerál, debounce-olt kell legyen
- A `@tanstack/react-virtual` virtualizált lista különösen érzékeny

### 2.2 Demo Seed Script (MAGAS KOCKÁZAT)
**Hely**: `supabase/functions/seed-demo-workspace/`
**Kockázat**: Schema drift — a seed script nem automatikusan követi a migrációkat

Figyelmeztetések:
- Minden SQL migráció után ellenőrizni kell a seed script kompatibilitását
- Ha új kötelező oszlop kerül bármelyik seed által érintett táblába, a seed script megtörik
- A seed script fail-fast guard-okkal védett (v3.3.4 óta), de a guard nem véd a schema mismatch ellen

**Seed által érintett táblák**:
- `enterprise_workspaces`
- `enterprise_memberships`
- `leave_requests`
- `approval_decisions`
- `enterprise_quota_transactions`
- `enterprise_leave_types`
- `enterprise_holidays`

### 2.3 Leave Seed Guard (MAGAS KOCKÁZAT)
**Hely**: `supabase/functions/seed-demo-workspace/`
**Kockázat**: Részleges seed

Figyelmeztetések:
- Ha a leave seed script részlegesen fut le (pl. hálózati timeout), az adatbázis részleges állapotban maradhat
- Tranzakcióba kell csomagolni az összes seed lépést

### 2.4 Org Chart renderelés (KÖZEPES KOCKÁZAT)
**Hely**: OrgChart + OrgChartPremiumView komponensek
**Kockázat**: Pan/zoom és teljes képernyős mód meghibásodása módosítások esetén

### 2.5 E-mail értesítési sor (KÖZEPES KOCKÁZAT)
**Hely**: `supabase/functions/process-email-queue/`, `send-transactional-email/`
**Kockázat**: Sorból kiesett e-mailek, leiratkozási listával való szinkronizáció eltérés

---

## 3. Ismert hibaminták

| Hibaminta | Érintett terület | Megoldás |
|---|---|---|
| Végtelen re-render loop | TimelineView, bármely virtualizált lista | `useCallback` + `useRef` stabilizálás, debounce |
| Schema drift a seed scriptben | seed-demo-workspace edge function | Migráció után seed script felülvizsgálat |
| Részleges seed állapot | Seed scriptek | Tranzakció + fail-fast guard |
| Race condition adatlekérésnél | Gyors navigáció, hónapváltás | Debounce + `Promise.allSettled` |
| Help anchor ID eltérés | help-reference.md vs. HelpRegistryProvider | Anchor ID szinkronizálás, help-regenerator futtatás |

---

## 4. Ne-törd-el területek (Do-Not-Break)

A következő funkciók korábban hibásak voltak és javítva lettek — különösen óvatosan kell kezelni:

| Terület | Funkció | Miért törékeny |
|---|---|---|
| TimelineView | Idővonal nézet (Naptár → Idővonal) | v3.3.2–v3.3.3 javítás, komplex render logika |
| seed-demo-workspace | Demo workspace létrehozás | Háromszor javítva (v3.3.4–v3.3.6) |
| OrgChart pan/zoom | Szervezeti ábra navigáció | v3.3.1 új feature, érzékeny renderelés |
| Leave approval chain | Többlépéses jóváhagyás | Komplex állapotgép, eszkalációs logika |
| Email queue | E-mail kézbesítés | Sor-alapú, szinkronizáció-érzékeny |
| help-articles RLS | Publikus olvasás, service_role írás | RLS policy eltávolítása adatlekérési hibát okozna |

---

## 5. Migráció-érzékeny táblák és oszlopok

A következő táblák és oszlopok különösen érzékenyek, mert:
1. A seed script hivatkozik rájuk (bármely sémaváltozás megtöri a seed-et)
2. Frontend komponensek közvetlenül leképezik a mezőneveket
3. Edge function-ök hardkódolt mezőneveket használnak

| Tábla | Érzékeny mezők | Miért érzékeny |
|---|---|---|
| `leave_requests` | `status`, `is_half_day`, `half_day_period`, `is_private` | Conflict engine + frontend leképezés |
| `enterprise_memberships` | `role`, `status`, `base_working_hours`, `office_id` | Kapacitásszámítás + permission rendszer |
| `enterprise_approval_chains` | `steps` (JSONB), `escalation_hours` | Jóváhagyási motor |
| `enterprise_quota_transactions` | `amount`, `balance_after`, `transaction_type` | Egyenleg számítás |
| `help_articles` | `anchor_id`, `content` | Help rendszer anchor szinkronizáció |
| `enterprise_translation_overrides` | `locale`, `key`, `value` | I18n override rendszer |

**Migráció biztonsági protokoll:**
1. Ellenőrizni a seed script kompatibilitását
2. Edge function-ök felülvizsgálata (hardkódolt oszlopnevekre keresni)
3. Frontend TypeScript típusok frissítése
4. Demo workspace seed újratesztelése

---

## 6. Leckék kategória szerint

### SEED kategória
- Mindig tranzakciót kell használni seed script-ekben
- Fail-fast guard: ha egy lépés hibás, az egész seed visszagörgetődik
- Seed script nem automatikusan frissül séma migrációkkal — manuális felülvizsgálat szükséges
- A seed által érintett összes entitást tesztelni kell, nem csak az alapvető workspace/member adatokat
- Demo workspace cleanup edge function gondoskodik az elavult demo workspace-ek törléséről

### SUPABASE-SDK kategória
- `Promise.allSettled` vs. `Promise.all`: párhuzamos Supabase lekéréseknél `Promise.allSettled` biztonságosabb — egy hibás lekérés nem blokkol másokat
- RLS policy-k írásánál figyelni kell a service_role és anon role különbségére
- Edge function-öknél a service_role kulcsot kell használni az adatbázis-műveletekhez, nem az anon kulcsot

### UI kategória
- Virtualizált listák (`@tanstack/react-virtual`) különösen érzékenyek re-render loop-okra
- `useCallback` + `useRef` párosítás stabil referenciák biztosításához
- Debounce alkalmazása minden gyors felhasználói interakciónál, ami adatlekérést triggerel
- Teljes képernyős módok (modálok) tesztelése külön szükséges a normál nézetektől

### AUTH-OAUTH kategória
- `auth-email-hook` edge function testreszabja az összes Supabase auth e-mailt — módosítása minden auth folyamatra kihat
- Google OAuth provider konfigurációja Supabase Dashboard-on kell beállítani, nem csak a kódban
- `HashRouteBridge` + `SpaRedirectHandler`: Vercel SPA deploymenthez szükséges — eltávolítása vagy módosítása 404 hibákat okozhat

### JIRA kategória
- `jira-devops-proxy` edge function proxy-ként működik, nem közvetlen Jira SDK — API változások átírhatják
- OAuth token refresh kezelése Jira esetén kiemelten fontos
- ADO és Jira különböző autentikációs mechanizmust használ (OAuth vs. PAT) — nem szabad összemosni a konfiguráló kódban
