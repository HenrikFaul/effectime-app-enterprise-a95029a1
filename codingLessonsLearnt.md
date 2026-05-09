# codingLessonsLearnt.md — Kapakka PubApp

## ⚠️ UTASÍTÁSOK (MINDIG OLVASD EL ELŐSZÖR!)

**KÖTELEZŐ MUNKAFOLYAMAT — Minden fejlesztés előtt:**
1. Nyisd meg és olvasd végig ezt a fájlt MIELŐTT bármit kódolnál
2. Ellenőrizd, hogy az új kódod nem tartalmaz-e az itt felsorolt hibamintákat
3. Ha új hibát találsz/javítasz, AZONNAL appendeld a megfelelő kategóriába
4. SOHA ne töröld a meglévő tartalmat — csak hozzáadni szabad
5. SOHA ne hozz létre új fájlt ezzel a céllal — mindig ebbe a fájlba írd

**Struktúra minden hiba bejegyzésnél:**
```
### [HIBA-XXX] Rövid cím
- **Dátum**: Mikor fordult elő
- **Fájl**: Melyik fájlban volt
- **Hibaüzenet**: Pontos TypeScript/build error
- **Gyökérok**: Miért történt
- **Javítás**: Hogyan lett megoldva
- **Megelőzés**: Hogyan kerüld el a jövőben
```

---

## 🔴 KATEGÓRIA 1: TypeScript típus hibák

### [HIBA-001] Hiányzó property az interface-ből
- **Dátum**: 2026-03-30 (v1.1.0)
- **Fájl**: `src/app/admin/menu/templates/page.tsx:157`
- **Hibaüzenet**: `Type error: Property 'item_sort' does not exist on type 'TemplateItem'.`
- **Gyökérok**: A `TemplateItem` interface-ben nem volt definiálva az `item_sort` property, miközben a kód hivatkozott rá (`sort_order: item.item_sort`). Az interface-t kézzel írtam, és kifelejtettem egy mezőt amit az SQL tábla tartalmaz.
- **Javítás**: Hozzáadtam `item_sort: number` a `TemplateItem` interface-hez.
- **Megelőzés**: **MINDIG** hasonlítsd össze az interface mezőket az SQL tábla oszlopaival. Ha az SQL-ben van `item_sort`, az interface-ben is KELL lennie. Checklist: minden SQL oszlop = egy interface property.

### [HIBA-002] Supabase FK reláció típusozás — `.table.number` hiba
- **Dátum**: 2026-03-30 (v1.2.0)
- **Fájl**: `src/app/admin/reports/page.tsx:61`
- **Hibaüzenet**: `Type error: Property 'number' does not exist on type '{ number: any; }[]'.`
- **Gyökérok**: Supabase `.select('table:tables(number)')` esetén a TypeScript a relációt **tömbként** (`{ number: any }[]`) típusozza, nem objektumként. Ezért `o.table.number` helyett `o.table[0].number` kellene, de valójában futásidőben objektumot ad vissza (nem tömböt).
- **Javítás**: A `.map()` callback-ben `(o: any)` típust használtam: `.map((o: any) => [...])` — ez megkerüli a Supabase TS típus problémát.
- **Megelőzés**: **MINDIG** használj `(item: any)` cast-ot amikor Supabase `.select()` eredményt iterálsz és FK relációkat (`table:tables(...)`, `venue:venues(...)`, `menu_item:menu_items(...)`) használsz. VAGY használj `useState<any[]>([])` a state-hez. A kettő közül az egyik KÖTELEZŐ.

### [HIBA-003] Supabase FK — új oszlopok nem ismertek a TS típusokban
- **Dátum**: 2026-03-30 (v1.2.0)
- **Fájl**: `src/app/admin/reports/page.tsx:137`
- **Hibaüzenet**: Potenciális — `total_orders`, `total_spent` nem létezik a `profiles` Supabase típusban
- **Gyökérok**: Ha ALTER TABLE-lel új oszlopot adsz hozzá (`total_orders`, `total_spent`), a Supabase TS generált típusok nem frissülnek automatikusan. A `.select()` eredmény típusa nem tartalmazza az új mezőket.
- **Javítás**: `(c: any)` cast a `.map()` callback-ben.
- **Megelőzés**: Ha SQL migrációval új oszlopokat adsz egy meglévő táblához, az adott tábla select eredményeit MINDIG `(row: any)` casttal kezeld, amíg a típusok nem lesznek újragenerálva (`supabase gen types`).

### [HIBA-018] Implicit `any` a chained `.map().filter()` callbackben
- **Dátum**: 2026-03-31 (v1.3.1)
- **Fájl**: `src/lib/place-search.ts:98`
- **Hibaüzenet**: `Type error: Parameter 'row' implicitly has an 'any' type.`
- **Gyökérok**: A `rows` tömb `any[]` típusú volt, és a `rows.map(...).filter((row) => row.external_id)` láncban a `filter` callback paramétere nem kapott explicit típust. `noImplicitAny` mellett ez build hibát okozott.
- **Javítás**: A nyers API választ `const rows: any[]` formában explicitáltam, külön `normalizedRows: ExternalPlace[]` tömbbe mapeltem, majd a filter callbacket `ExternalPlace` típussal adtam meg.
- **Megelőzés**: Ha `any[]` tömbből több lépéses `.map().filter().reduce()` lánc készül, a köztes eredményt MINDIG nevezd el és adj neki explicit típust. A végső callback paramétereknél ne hagyatkozz implicit inference-re `strict` TypeScript beállítás mellett.

---

## 🟡 KATEGÓRIA 2: SQL / RLS / Adatbázis hibák

### [HIBA-004] SQL szintaxis hiba — RLS policy zárójelezés
- **Dátum**: 2026-03-29 (v1.0.0)
- **Fájl**: `supabase/migrations/001_initial_schema.sql:47`
- **Hibaüzenet**: `syntax error at or near "or" LINE 47: ) or is_active = true;`
- **Gyökérok**: Az RLS policy USING() zárójelén kívül volt egy `or is_active = true` feltétel. A helyes szintaxis: `USING ((feltétel1) OR (feltétel2))` — minden feltétel a USING() BELSEJÉBE kerül.
- **Javítás**: Az egész policy-t újraírtam helyes zárójelezéssel.
- **Megelőzés**: RLS policy írásakor MINDIG ellenőrizd, hogy MINDEN feltétel a `USING(...)` zárójelen BELÜL van. Soha ne legyen logikai operátor a zárójelen kívül.

### [HIBA-005] RLS policy circular dependency — profil olvasás blokkolva
- **Dátum**: 2026-03-29 (v1.0.1)
- **Fájl**: Profiles RLS policies
- **Hibaüzenet**: Profil lekérdezés sikertelen admin felhasználóknál
- **Gyökérok**: A profiles SELECT policy JOIN-t tartalmazott a `venues` táblára, ami maga is RLS-sel volt védve. Ha a venues policy is hivatkozott a profiles-ra → circular dependency. Az admin felhasználó nem tudta olvasni a saját profilját.
- **Javítás**: Egyszerű policy: `CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);` — minden bejelentkezett felhasználó olvashat minden profilt.
- **Megelőzés**: **SOHA** ne legyen RLS SELECT policy-ban JOIN más RLS-védett táblára. Ha kell cross-table check, használj egyszerű `auth.uid()` alapú feltételt, vagy SECURITY DEFINER funkciót.

### [HIBA-006] Profil email NULL — role update 0 rows
- **Dátum**: 2026-03-29 (v1.0.1)
- **Hibaüzenet**: `UPDATE public.profiles SET role = 'admin' WHERE email = 'x@y.com'` → 0 rows affected
- **Gyökérok**: A `handle_new_user()` trigger nem másolta át az email-t az `auth.users` táblából a `profiles` táblába. A `profiles.email` mező NULL volt, ezért a WHERE feltétel nem talált sort.
- **Javítás**: JOIN-os UPDATE: `UPDATE profiles p SET role = 'admin' FROM auth.users u WHERE p.id = u.id AND u.email = 'x@y.com';`
- **Megelőzés**: A `handle_new_user()` trigger MINDIG másolja át az email-t: `NEW.raw_user_meta_data->>'email'` VAGY `(SELECT email FROM auth.users WHERE id = NEW.id)`. Soha ne feltételezd, hogy a profiles.email ki van töltve.

### [HIBA-007] Supabase FK constraint név — törékeny hivatkozás
- **Dátum**: 2026-03-30 (v1.1.0)
- **Fájl**: `src/app/siteadmin/venues/page.tsx`
- **Hibaüzenet**: Potenciális — `profiles!venues_owner_id_fkey` nem létezik
- **Gyökérok**: `.select('*, owner:profiles!venues_owner_id_fkey(full_name, email)')` — a constraint név adatbázisonként eltérhet. A Supabase automatikusan generálja a FK constraint nevet, és nem garantált, hogy mindig `venues_owner_id_fkey`.
- **Javítás**: Lecseréltem `.select('*, owner:profiles(full_name, email)')` — constraint név nélkül, a Supabase automatikusan feloldja.
- **Megelőzés**: **SOHA** ne használj explicit FK constraint nevet a `.select()` relációkban. Használd a szimpla `table_name(columns)` szintaxist. Ha ambiguous, használd a `table_name!column_name(columns)` formátumot (oszlop nevet, NEM constraint nevet).

---

## 🟠 KATEGÓRIA 3: Auth / Redirect / Session hibák

### [HIBA-008] Auth redirect loop — 4 helyen konkurens redirect
- **Dátum**: 2026-03-29 (v1.0.0 → v1.0.1)
- **Fájl**: middleware.ts + page.tsx + customer/page.tsx + admin/layout.tsx
- **Hibaüzenet**: Végtelen loading screen — az alkalmazás sosem jutott túl az „Átirányítás..." képernyőn
- **Gyökérok**: 4 különböző helyen volt routing logika, és egymásba irányítottak: middleware → /admin → admin/layout ellenőrzi → /customer → customer/page ellenőrzi → /admin → ∞ loop
- **Javítás**:
  1. `middleware.ts` — CSAK cookie frissítés, NULLA redirect
  2. `page.tsx` — Egyetlen auth check 4s timeout-tal, `hasRedirected` ref a dupla redirect ellen
  3. `customer/page.tsx` — Admin felhasználóknak "Admin panel megnyitása" GOMB, nem redirect
  4. `admin/layout.tsx` — Nem-admin felhasználóknak error screen, nem redirect
- **Megelőzés**: **EGY SZABÁLY**: Routing döntés KIZÁRÓLAG client-side, egyetlen helyen. Middleware SOHA ne redirecteljen. Ha jogosultsági hiba van, mutass error screen-t, ne redirectelj másik oldalra.

### [HIBA-009] getSession() vs getUser() — elavult session
- **Dátum**: 2026-03-29
- **Gyökérok**: `getSession()` a helyi cache-ből olvas, ami elavult lehet. `getUser()` mindig a Supabase szerverhez fordul.
- **Megelőzés**: Auth ellenőrzésnél MINDIG `getUser()` a megbízható módszer, NEM `getSession()`.

### [HIBA-014] Venue JOIN a profil lekérdezésben blokkolja az auth-ot
- **Dátum**: 2026-03-30 (v1.2.0)
- **Fájl**: `src/app/admin/layout.tsx`
- **Hibaüzenet**: "Nincs hozzáférésed" — admin felhasználó nem tud belépni az admin panelre
- **Gyökérok**: A profil lekérdezés `select('*, venue:venues(*)')` formában volt, ami FK JOIN-t csinál a venues táblára. Ha a `profiles.venue_id` NULL (nincs venue hozzárendelve), VAGY ha nincs explicit FK constraint a DB-ben, VAGY ha az RLS policy blokkolja a venues lekérést, az EGÉSZ lekérdezés hibával tér vissza (`profileError` != null). Emiatt a kód a `no-permission` ágra futott, pedig a felhasználó valójában admin role-lal rendelkezett.
- **Javítás**: A profil és venue lekérdezést SZÉTVÁLASZTOTTAM:
  1. Először: `select('*')` a profiles-ból (FK JOIN nélkül) — ez az auth check
  2. Utána: külön `select('*')` a venues-ból venue_id alapján — ez már NEM blokkolja az auth-ot
- **Megelőzés**: **SOHA** ne legyen FK JOIN egy auth-kritikus lekérdezésben! Az auth ellenőrzés (profil + role check) MINDIG egyszerű, single-table query legyen. Ha kiegészítő adatok kellenek (venue, orders stb.), azokat KÜLÖN, NEM-BLOKKOLÓ lekérdezésben szerzd be MIUTÁN az auth check sikeres.

---

## 🔵 KATEGÓRIA 4: Build / Import / Kompatibilitás hibák

### [HIBA-010] Next.js fájlnév konvenció — page.tsx kötelező
- **Dátum**: 2026-03-29
- **Gyökérok**: A felhasználó a letöltött fájlokat `admin-layout.tsx` és `customer-page.tsx` néven mentette el `layout.tsx` és `page.tsx` helyett. Next.js App Router CSAK a `page.tsx`, `layout.tsx`, `loading.tsx` stb. pontos neveket ismeri fel.
- **Megelőzés**: Fájlok MINDIG a pontos Next.js konvenció szerinti nevekkel készüljenek. A letöltési/mentési utasításokban MINDIG jelöld meg a cél fájlnevet.

### [HIBA-011] Lucide React ikon import — nem létező ikon név
- **Dátum**: Általános (megelőző figyelmeztetés)
- **Megelőzés**: Lucide React ikonokat MINDIG a hivatalos listáról importáld. Ha nem biztos, hogy létezik, használj olyan ikont ami biztosan megvan (pl. `Settings`, `User`, `Search`, `Plus`, `Check`, `X`). A `lucide-react@0.363.0` verzióban ezek biztosan elérhetők: Zap, ClipboardList, UtensilsCrossed, Package, BarChart3, Settings, HelpCircle, Menu, Bell, LogOut, Shield, ChevronRight, X, Monitor, CalendarClock, FileDown, Plus, Pencil, Trash2, Search, CheckCircle, XCircle, Volume2, VolumeX, Maximize, Minimize, RefreshCw, Check, Clock, AlertTriangle, Download, FileSpreadsheet, Calendar, TrendingUp, ShoppingBag, Users, Phone, Mail, User, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowLeft, Sparkles, Star, MapPin, Store, ScrollText, LayoutDashboard, Activity, Info, AlertCircle, ToggleLeft, ToggleRight, Save, Filter, Bug, Send.

### [HIBA-015] Lucide React redesign patch — `House` ikon build hibát okozott
- **Dátum**: 2026-03-30 (v1.2.1)
- **Fájl**: `src/app/customer/page.tsx:15`
- **Hibaüzenet**: `Type error: "lucide-react" has no exported member named 'House'. Did you mean 'Mouse'?`
- **Gyökérok**: A redesign patch-ben olyan Lucide ikont importáltam (`House`), ami a projektben használt verzióban nem exportált. Ráadásul több más ikon is a "biztosan elérhető" listán kívül volt, ezért a patch nem követte a kötelező ikon-import szabályt.
- **Javítás**: A `House` importot `LayoutDashboard`-ra cseréltem, és a redesign patch összes új Lucide importját átnéztem. Az összes bizonytalan ikont lecseréltem a codingLessonsLearnt-ben felsorolt, biztosan elérhető ikonokra.
- **Megelőzés**: **MINDIG** ellenőrizd a redesign patch összes Lucide importját a `codingLessonsLearnt.md` [HIBA-011] pontja alapján. Új UI csomag kiadása előtt kötelező grep-pel végignézni az összes `from 'lucide-react'` importot, és csak a whitelistelt ikonok maradhatnak.



---

## 🟢 KATEGÓRIA 5: CSS / UI hibák

### [HIBA-012] Admin `.input` class hiányzik
- **Dátum**: 2026-03-30 (v1.1.0)
- **Gyökérok**: Az admin oldalak `.input` CSS class-t használnak az input mezőkhöz, de ez nem volt definiálva a globals.css-ben. A Tailwind nem generálja automatikusan.
- **Javítás**: `.input` class hozzáadása a globals.css-hez explicit CSS-ként.
- **Megelőzés**: Ha egyedi CSS class-t használsz (`.input`, `.status-badge`, `.animate-slide-up`), MINDIG ellenőrizd, hogy definiálva van-e a globals.css-ben.

### [HIBA-013] Admin sidebar mobil nézet — nem jelenik meg
- **Dátum**: 2026-03-30
- **Gyökérok**: A `display: none` `@media(max-width:768px)` felülírta a JavaScript-ből adott `translate-x-0` class-t.
- **Javítás**: CSS override: `.admin-sidebar.translate-x-0 { display: flex !important; }`
- **Megelőzés**: Ha egy elem CSS-ből `display:none`, a JS class hozzáadás NEM elég — `!important` kell a CSS-ben is.

---

### [HIBA-015] Patch-only csomagból kimaradt új supporting fájlak
- **Dátum**: 2026-03-30 (v1.2.1)
- **Fájl**: patch csomag / `src/app/layout.tsx`, `src/app/admin/config/page.tsx`
- **Hibaüzenet**: Build/import hiba, mert az újonnan hivatkozott `@/components/AppShellProviders` és `@/lib/themes` fájlok nem voltak benne a patch-only zipben.
- **Gyökérok**: A patch-only csomagolásnál nem csak a módosított meglévő fájlakat, hanem az újonnan BEVEZETETT supporting fájlokat is csomagolni kell. Ezek kimaradtak.
- **Javítás**: A patch-only csomag listáját úgy kell összeállítani, hogy minden új import célfájlja bekerüljön.
- **Megelőzés**: Patch készítés előtt **MINDIG** futtasd le ezt a checklistet: minden `import '@/...'` útvonalhoz létezik fájl ÉS a zipben is benne van, ha újonnan lett bevezetve.

### [HIBA-016] Design patch buildbiztonság — csak syntax-ellenőrzött fájl csomagolható
- **Dátum**: 2026-03-30 (v1.3.0)
- **Fájl**: összes új / módosított `.tsx` fájl
- **Hibaüzenet**: Potenciális — reszponzív redesign közben könnyű szintaktikai hibát vagy félbehagyott importot hagyni.
- **Gyökérok**: Nagy redesignnál sok fájl változik egyszerre, ezért megnő a hibázás esélye.
- **Javítás**: A patch csomagolás előtt a módosított TS/TSX fájlakat legalább TypeScript parser szinten ellenőrizni kell.
- **Megelőzés**: **MINDIG** legyen build-safety lépés: ha teljes `npm build` nem futtatható, akkor minimum parser/syntax ellenőrzést kell végezni minden módosított TS/TSX fájlra.

### [HIBA-017] Új adatbázis tábla / migráció még nincs fent — UI ne omoljon össze
- **Dátum**: 2026-03-30 (v1.3.0)
- **Fájl**: `src/app/customer/page.tsx`, `src/app/admin/config/page.tsx`, új social/place feature lekérdezések
- **Hibaüzenet**: Potenciális — ha a `place_favorites`, `friendships`, `place_lists`, `app_settings` vagy `reservations` migráció még nincs lefuttatva, a featurelekérdezések hibát dobhatnak.
- **Gyökérok**: A frontend hamarabb kerülhet fel, mint az új migráció.
- **Javítás**: A lekérdezések `maybeSingle()` / `|| []` fallback mintával készültek, és a feature nem auth-kritikus ágon fut.
- **Megelőzés**: **SOHA** ne legyen új opcionális feature táblára épített lekérdezés auth-kritikus vagy page-blocking. Új feature tábla = null-safe, fallbackes, nem-blokkoló betöltés.

## 📋 ELLENŐRZŐ LISTA (Minden commit előtt)

- [ ] Auth-kritikus lekérdezésben NINCS FK JOIN? (profiles select = egyszerű `select('*')`)
- [ ] Minden interface/type property megegyezik az SQL tábla oszlopaival?
- [ ] Supabase `.select()` FK relációk használatánál van `(row: any)` cast?
- [ ] Nincs explicit FK constraint név a Supabase select-ben?
- [ ] Nincs middleware-ben redirect?
- [ ] Auth check `getUser()`-t használ, nem `getSession()`-t?
- [ ] Fájlnevek Next.js konvenciónak megfelelnek (`page.tsx`, `layout.tsx`)?
- [ ] Egyedi CSS class-ok definiálva vannak a globals.css-ben?
- [ ] Lucide ikonok a hivatalos listáról importálva?
- [ ] Minden új import célfájlja benne van a patch-only csomagban?
- [ ] Parser/syntax ellenőrzés lefutott a módosított TS/TSX fájlakon?
- [ ] RLS policy-kban nincs cross-table JOIN más RLS-védett táblára?
- [ ] Új SQL oszlopok esetén a kód `(: any)` castot használ?

---

*Utoljára frissítve: 2026-04-11 — v2.0.0*
*Ez egy FOLYAMATOSAN BŐVÜLŐ fájl. Új hibákat MINDIG appendelj, SOHA ne törölj!*

## ➕ APPEND — 2026-03-31 build hiba kiegészítés

### [HIBA-023] Supabase Edge Function `Deno` globál — Next.js build alatti típushiba
- **Dátum**: 2026-03-31
- **Fájl**: `supabase/functions/place-search/index.ts:110`
- **Hibaüzenet**: `Type error: Cannot find name 'Deno'.`
- **Gyökérok**: A Next.js root build / TypeScript ellenőrzés belefutott a `supabase/functions/...` alatti Supabase Edge Function fájlba, ami **Deno runtime-ra** íródott (`Deno.serve(...)`). A Next/Node oldali TypeScript környezet nem ismeri automatikusan a `Deno` globált, ezért a build megállt. A probléma nem maga a business logika, hanem a runtime-keveredés: a Deno-s Edge Function ugyanabban a TypeScript ellenőrzési körben maradt, mint a Next app.
- **Javítás**: A stabil megoldás két részből áll:
  1. A Next app `tsconfig.json` fájljából ki kell zárni a `supabase/functions/**/*` útvonalat, hogy a Next build ne próbálja Node/Next környezetben típusellenőrizni a Deno Edge Functionöket.
  2. Az Edge Function saját Deno/Supabase runtime típusreferenciát kapjon, és külön Supabase / Deno folyamatban legyen ellenőrizve (például a projektben használt Supabase edge runtime type importtal).
- **Megelőzés**: **SOHA** ne hagyd a Deno runtime-ra írt Supabase Edge Function fájlokat a Next.js root typecheck hatókörében. Node/Next build és Supabase Edge Function typecheck legyen külön kezelve. Ha új Edge Function készül, azonnal ellenőrizd, hogy:
  - a `supabase/functions/**` mappa ki van-e zárva a root `tsconfig.json`-ból;
  - az adott function rendelkezik-e a szükséges Deno / Supabase edge runtime típusreferenciával;
  - az ellenőrzése külön Supabase / Deno parancsból történik-e, nem `npm run build` alatt.

## 📋 ELLENŐRZŐ LISTA — új buildbiztonsági pontok

- [ ] A `supabase/functions/**` mappa ki van zárva a Next.js root `tsconfig.json` typecheckjéből?
- [ ] A Deno runtime-os Edge Function saját runtime típusreferenciával rendelkezik?
- [ ] A Supabase Edge Function ellenőrzése külön történik a Next app buildtől?

*Appendelve: 2026-03-31 — v1.3.3*

### [HIBA-017] Supabase enum típus nem illeszkedik string filterhez
- **Dátum**: 2026-04-11 (v2.1.0)
- **Fájl**: `src/components/enterprise/ApprovalInbox.tsx:61`
- **Hibaüzenet**: `Argument of type 'string' is not assignable to parameter of type 'NonNullable<"approved" | ...>'`
- **Gyökérok**: A Supabase SDK generált típusai szűk uniót várnak, de a React state `string`-ként tárolta a filter értéket
- **Javítás**: `as any` cast alkalmazása a `.eq('status', statusFilter as any)` hívásban
- **Megelőzés**: Supabase `.eq()` hívásokban ha a filter értéke React state-ből jön és az enum típus szűk, használj explicit castot

*Appendelve: 2026-04-11 — v2.1.0*

---

## 🟢 KATEGÓRIA — Architektúra: Single Source of Truth (2026-04-22, v2.5.0)

### [LESSON-SSOT-001] Pozíció ↔ tag allokáció listázása JOIN-on keresztül
- **Dátum**: 2026-04-22
- **Fájl**: `src/components/enterprise/BusinessRoleManager.tsx`
- **Probléma**: A pozíció kártya csak 1 tagot mutatott, miközben a Member Profile %-os allokációt is támogat → adat-dissonance.
- **Gyökérok**: A korábbi lekérdezés a `business_role` mezőre szűrt a `enterprise_memberships`-en (régi 1:1 modell), figyelmen kívül hagyva az `enterprise_member_role_allocations` junction táblát.
- **Javítás**: Always read az allokációt a junction táblából, és join-old a `enterprise_memberships` + `profiles` adatokkal. UI-ban listázd MINDEN tagot %-os értékkel és számolt napi órával (`base_working_hours * pct / 100`).
- **Megelőzés**: Ha létezik junction tábla bármilyen N:M kapcsolatra, sose dolgozz a denormalizált, régi szűrőmezővel — a junction table az igazság forrása.

### [LESSON-SSOT-002] Dropdown / szűrő hardcoded listák tilosak
- **Dátum**: 2026-04-22
- **Fájl**: `src/components/enterprise/LeaveCalendar.tsx`
- **Probléma**: A csapat-szűrő hardcoded értékeket mutatott, eltérve a Settings → Teams modultól.
- **Javítás**: Minden szűrő opciólistát ugyanabból a Supabase táblából tölts (`enterprise_teams`), amit a CRUD-ot végző modul is használ.
- **Megelőzés**: Ha egy entitásnak van CRUD UI-ja, sose duplikáld statikusan máshol — egyetlen forrás (DB tábla / view) létezzen.

### [LESSON-PERMISSIONS-001] Hierarchikus jogosultság-fa katalógus táblából
- **Dátum**: 2026-04-22
- **Fájl**: `src/hooks/useEnterprisePermissions.ts`, `RolePermissionManager.tsx`
- **Probléma**: Statikus, lapos `FEATURE_GROUPS` array nehezen tartható szinkronban a tényleges navigációs fával.
- **Javítás**: `enterprise_feature_catalog` tábla bevezetése `parent_key` self-FK-val. A hook `featureTree`-t épít, az UI rekurzív komponenssel rendereli (`FeatureTreeRow`). Fallback: ha a katalógus üres, marad a régi flat lista.
- **Megelőzés**: Bármi, ami "tükrözi az alkalmazás struktúráját", legyen DB-ben tárolt fa, ne forrásban kódolt enum.

### [LESSON-CAPACITY-001] Kapacitás óra-egységben, ne csak százalékban
- **Dátum**: 2026-04-22
- **Fájl**: `src/lib/capacityEngine.ts`
- **Probléma**: Csak %-ban számolt kapacitás félrevezető részmunkaidős (4–6 órás) tagoknál.
- **Javítás**: Új `base_working_hours` mező a membership-en; minden ouputba (PositionSummary) számolj `total_available_hours = base_working_hours * (pct / 100)`-ot is.
- **Megelőzés**: Ha valós erőforrás-tervezést támogatunk, mindig legyen abszolút mértékegység (óra/nap), ne csak relatív arány.

### [LESSON-DASH-001] Új enterprise panelek integrálása csak meglévő tab/section alá
- **Dátum**: 2026-04-25
- **Fájl**: `src/components/enterprise/WorkspaceDashboard.tsx`
- **Probléma**: Új funkciók gyors beépítésekor könnyű külön tabot/szekciót nyitni, ami duplikált navigációt és regressziós kockázatot okoz.
- **Javítás**: Az új panelek (`AllowanceManager`, `WorkspaceGeneralSettings`, `BrandingManager`, `CsvImportPanel`) kizárólag meglévő `SettingsSection` blokkokba kerültek.
- **Megelőzés**: Dashboard bővítésnél elsődleges szabály: meglévő tab-hierarchiát bővíts, ne hozz létre párhuzamos felületet.

### [LESSON-CALENDAR-002] Éves nézetet sub-tabként kell integrálni, nem külön route-on
- **Dátum**: 2026-04-25
- **Fájl**: `src/components/enterprise/WorkspaceDashboard.tsx`, `src/components/enterprise/AnnualLeaveGrid.tsx`
- **Probléma**: Az éves naptár nézet külön route/tab esetén szétszórja a felhasználói flow-t.
- **Javítás**: A `Calendar` fülön belül másodlagos sub-tab struktúra (`Naptár`, `Éves nézet`) került bevezetésre.
- **Megelőzés**: Naptár-funkciók bővítésekor maradj a meglévő Calendar kontextusban.

### [LESSON-TEAMS-003] Team policy mezők szerkesztését validációval és blur-commit mintával kezeld
- **Dátum**: 2026-04-25
- **Fájl**: `src/components/enterprise/TeamManager.tsx`
- **Probléma**: Számmező közvetlen onChange mentése túl sok írást és hibás értéket okozhat.
- **Javítás**: `max_absent` mező draft state-ben tárolódik, és csak `onBlur` eseménykor mentődik validáció után; `approval_mode` explicit select opciókkal állítható.
- **Megelőzés**: Policy típusú mezőknél használj draft + commit mintát, ne per-keystroke adatbázis frissítést.

---

## ➕ APPEND — 2026-04-27 v2.5.1 Calendar/Capacity regression hotfix

### [LESSON-SCHEMA-002] Supabase schema-cache safe frontend payload kötelező új opcionális oszlopoknál
- **Dátum**: 2026-04-27
- **Fájl**: `src/components/enterprise/OfficeCoverageRuleManager.tsx`
- **Probléma**: A telephelyi szabály mentése eldobta a felületet `Could not find the 'business_roles' column of 'enterprise_office_coverage_rules' in the schema cache` hibával.
- **Gyökérok**: A frontend azonnal írta az új `business_roles` / `skill_ids` tömb oszlopokat, de a production Supabase/PostgREST schema cache vagy az aktuális adatbázis még a régi sémát látta.
- **Javítás**: Az új tömb oszlopos payload megmaradt elsődleges útnak, de PGRST/schema-cache hiányzó oszlop hibánál automatikus legacy fallback fut csak a régi `business_role` / `skill_id` oszlopokkal.
- **Megelőzés**: Új opcionális DB oszlop bevezetésekor a frontend írás legyen backward-compatible: régi payload fallback, célzott error-detekció, és csak az érintett schema-cache hibák kezelése fallbackként.

### [LESSON-UI-REGRESSION-004] Navigációs shortcutot ne hagyj bent, ha nem garantáltan jó célra visz
- **Dátum**: 2026-04-27
- **Fájl**: `src/components/enterprise/calendar/CoveragePlannerView.tsx`, `src/components/enterprise/WorkspaceDashboard.tsx`
- **Probléma**: A Kapacitástervező `Szabályok szerkesztése` gombja rossz helyre navigált.
- **Gyökérok**: A shortcut nem konkrét szekcióra/deep-linkre vitt, hanem túl általános tabváltást végzett.
- **Javítás**: A gomb eltávolításra került a Kapacitástervezőből; a szabálykezelés továbbra is a saját meglévő beállítási/szabálykezelő felületén érhető el.
- **Megelőzés**: Shortcut csak akkor maradhat, ha célzottan és validáltan a megfelelő modulrészhez visz. Ellenkező esetben jobb eltávolítani, mint félrenavigálni.

### [LESSON-CALENDAR-003] Havi gridben az üres állapot nem növelheti soronként a cellamagasságot
- **Dátum**: 2026-04-27
- **Fájl**: `src/components/enterprise/calendar/CoveragePlannerView.tsx`
- **Probléma**: Havi Kapacitástervező nézetben a `Nincs szabály — adj hozzá...` szöveg tördelődött és túl magas sorokat okozott.
- **Gyökérok**: A dinamikus `col-span-${colCount}` Tailwind class nem garantáltan generálódik, ezért a szöveg nem valódi többoszlopos cellaként viselkedett.
- **Javítás**: Szöveges üres állapot helyett napcellánként visszafogott szürke jelölés és vékony `border-border/70` elválasztó vonalak jelennek meg.
- **Megelőzés**: Dinamikus Tailwind class helyett inline style vagy explicit renderelt grid cellák használata szükséges változó oszlopszámnál.

### [LESSON-LAYOUT-002] Timeline szűrőpanel desktopon oldalsáv, nem teljes szélességű blokk
- **Dátum**: 2026-04-27
- **Fájl**: `src/components/enterprise/calendar/TimelineView.tsx`
- **Probléma**: Az Idővonal szűrők túl szélesen, teljes sorban jelentek meg.
- **Javítás**: Desktopon kétoszlopos grid layout: keskeny sticky bal oldali szűrősáv + mellette naptárterület. Mobilon megmarad az egymás alatti elrendezés.
- **Megelőzés**: Nagy naptár/grid nézetnél a konfigurációs/szűrőpanelt külön `aside` régióban kell kezelni, hogy ne nyomja le a fő tartalmat.

---

## ➕ APPEND — 2026-04-30 Produkció-stabilizálási audit (audit-stabilize-production)

### [LESSON-CONFLICT-001] officeRuleApplies ne hagyja ki a legacy `day_of_week` (singular) oszlopot
- **Dátum**: 2026-04-30
- **Fájl**: `src/lib/conflictEngine.ts`
- **Probléma**: A `ruleApplies` (daily rules) és az `officeRuleApplies` (coverage rules) függvény eltérően kezelte a `days_of_week` / `day_of_week` mezőket. A `officeRuleApplies` csak a tömb verziót (`days_of_week`) vizsgálta, ha az üres volt, visszaesett `[]`-re, ami miatt a rule minden napra érvényesnek számított (nem csak a konfigurált napra).
- **Gyökérok**: A multi-position/skill migrációkor az `officeRuleApplies` nem kapta meg a `ruleApplies`-ból már ismert legacy fallback logikát.
- **Javítás**: `officeRuleApplies` átírva: ha `days_of_week` tömb üres/null, fallback a `day_of_week` (singular) mezőre — azonos logika, mint `ruleApplies`.
- **Megelőzés**: Ha két kódhely azonos adatmodellt értelmez (rule applies), legyen egyetlen helper, ne duplikált, eltérő implementáció.

### [LESSON-QUERY-SCOPE-001] Supabase query-t mindig szűkítsd a szükséges dátumtartományra
- **Dátum**: 2026-04-30
- **Fájl**: `src/lib/conflictEngine.ts`
- **Probléma**: Az `enterprise_holidays` és `leave_requests` lekérdezések a TELJES workspace-rekordhalmazt hozták le dátumszűrés nélkül, majd JavaScript-szinten szűrtek.
- **Gyökérok**: A feature gyors fejlesztésekor a legegyszerűbb query-t írták meg, és a JS-oldali szűrés elfedi a felesleges adatátvitelt.
- **Javítás**: Mindkét lekérdezésbe bekerültek a `.gte` / `.lte` feltételek a kért napok tartományára.
- **Megelőzés**: Minden Supabase lekérdezésnél gondold végig: van-e dátum- vagy ID-alapú határoló feltétel, amit a DB-nek kell elvégeznie? Ne hagyd a szűrést csak JS-oldalra.

### [LESSON-CAPACITY-ERROR-001] Párhuzamos Supabase-hívások hibáit mindig logold
- **Dátum**: 2026-04-30
- **Fájl**: `src/lib/capacityEngine.ts`
- **Probléma**: A `computeWorkspaceCapacity` a `Promise.all`-ból érkező Supabase válaszokat destrukturáló módon kezelte (`{ data: allocs }`), az `.error` mezőt teljesen figyelmen kívül hagyva. Ha a lekérdezés meghiúsult, `allocs = null` lett, és a kapacitásszámítás némán nulla-eredményt adott vissza.
- **Gyökérok**: A Supabase SDK nem dob kivételt hálózati/RLS hibánál, hanem `{ data: null, error: ... }` formát ad vissza, amit explicit kezelni kell.
- **Javítás**: Minden párhuzamos hívás eredménye `allocsResult / membershipsResult` névvel van szétválasztva, `.error` mező ellenőrzött és konzolra logolt.
- **Megelőzés**: **MINDIG** destrukturáld ki az `.error` mezőt is, ne csak a `.data`-t. Engine-szintű üzleti logikánál egyetlen néma hiba elfedi az egész számítás helytelenségét.

### [LESSON-ADO-UPDATE-001] ADO update előtt ellenőrizd, hogy van-e módosítandó mező
- **Dátum**: 2026-04-30
- **Fájl**: `supabase/functions/jira-devops-proxy/index.ts`
- **Probléma**: Az `adoUpdate` függvény üres `ops = []` tömböt küldhetett Azure DevOps API-nak, ha a payload egyetlen szerkeszthető mezőt sem tartalmazott. Az ADO API üres JSON-patch-et visszautasítja, és félrevezető hibát ad.
- **Gyökérok**: Nem volt guard a `ops` tömb összerakása előtt.
- **Javítás**: `if (ops.length === 0) throw new Error(...)` kerül a `fetch` előtt.
- **Megelőzés**: Bármely patch/update API hívásnál, ahol a payload opcionális mezőkből épül fel, ellenőrizd, hogy legalább egy mező ki van töltve, mielőtt elküldenéd a kérést.

### [LESSON-JIRA-PROJECTKEY-001] sync_project_config ne fusson üres project_key-jel
- **Dátum**: 2026-04-30
- **Fájl**: `supabase/functions/jira-devops-proxy/index.ts`
- **Probléma**: A `jiraSyncProjectConfig` `integ.project_key ?? ''`-vel dolgozott. Ha a project_key nincs kitöltve az integrációs rekordban, az API-hívás üres project key-jel fut le, ami vagy rossz adatot hoz, vagy félrevezető Jira API hibát ad.
- **Gyökérok**: Nem volt korai validáció a project_key meglétére.
- **Javítás**: Explicit `if (!integ.project_key) throw new Error(...)` a függvény elején.
- **Megelőzés**: Minden külső API-hívás előtt validáld az összes kötelező paramétert, ne hagyd a null/empty értéket „csendesen" az API-nak.

---

## ➕ APPEND — 2026-05-09 Demo workspace seeder v8 tanulságok

### [LESSON-SEED-001] Supabase Auth Admin API — közvetlen fetch Deno edge functionban
- **Dátum**: 2026-05-09 (v8 seeder)
- **Fájl**: `supabase/functions/seed-demo-workspace/index.ts`
- **Probléma**: A `@supabase/supabase-js` SDK `auth.admin.createUser()` metódusa nem mindig érhető el megbízhatóan Deno edge function kontextusból — vagy hiányzó header, vagy undefined visszatérési érték, vagy runtime-version-függő viselkedés.
- **Gyökérok**: A Supabase JS SDK service-role auth.admin wrapperje edge function futtatásnál nem feltétlenül küldi el a szükséges `Authorization: Bearer <service_role_key>` headert, ami néma hibát okoz.
- **Javítás**: Közvetlen `fetch` hívás a Supabase REST Admin API-ra: `fetch(\`\${SUPABASE_URL}/auth/v1/admin/users\`, { method: 'POST', headers: { Authorization: \`Bearer \${SERVICE_ROLE_KEY}\`, apikey: SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })`. Az érkező JSON-ból `resp.json()` kell, és a `id` mező az auth user UUID.
- **Megelőzés**: Ha edge functionből service role-lal kell auth user-t létrehozni, MINDIG közvetlen REST API fetch mintát használj, ne a JS SDK `auth.admin.*` metódusaira bízd. Documéntáld a fejléceket kommentben a kódban.

### [LESSON-SEED-002] PERSONA_ORG_ASSIGNMENTS — adatvezérelt lookup tábla az összes personára
- **Dátum**: 2026-05-09 (v8 seeder)
- **Fájl**: `supabase/functions/seed-demo-workspace/seed-data.ts`
- **Probléma**: A v7-es seeder hardcoded if-else blokkokban csak 7/22 personának rendelt org_unit / manager / leadership_level / contract_type értéket. A maradék 15 tag hiányos org-struktúrával jött létre — SQL-ellenőrzés igazolta: `has_org_unit: 7/23`.
- **Gyökérok**: Személynév-alapú hardcoded hozzárendelés nem skálázható; ha új persona kerül be, a B8 blokkot kézzel kell bővíteni, és könnyen kihagyható valaki.
- **Javítás**: `PERSONA_ORG_ASSIGNMENTS: Record<string, PersonaOrgAssignment>` lookup objektum minden persona `display_name`-jéhez hozzárendeli az `{orgUnit, llCode, contractCode, leadershipCategory, seniority, managerName?}` struktúrát. A B8 seeding blokk egyszerűen iterál minden `demoUserId`-n, megkeresi a display_name-t, majd lookup-ol.
- **Megelőzés**: Összetett hierarchikus adat (org-struktúra, manager-lánc, több mező kombinációja) SOHA ne legyen hardcoded if-else mint — mindig `Record<string, T>` lookup tábla vagy konfigurációs objektum a `seed-data.ts`-ben.

### [LESSON-SEED-003] Min-enforced slice pattern a katalógus insert blokkokban
- **Dátum**: 2026-05-09 (v8 seeder)
- **Fájl**: `supabase/functions/seed-demo-workspace/index.ts`
- **Probléma**: Ha a felhasználó a seed config UI-ban pl. `leadership_levels=1`-et állít be, de a B8 blokk 4 különböző `llCode`-ot próbál feloldani (`strategic`, `operational`, `technical`, `execution`), az FK lookup `undefined`-ot ad vissza, és az UPDATE meghiúsul.
- **Gyökérok**: A seed config mennyiségeket a felhasználó szabadon csökkenthetné, ami letörheti a downstream FK-függőségeket.
- **Javítás**: `DEFS.slice(0, Math.max(MIN_COUNT, seedQty.key))` — a `MIN_COUNT` értékét minden katalógusnál a downstream FK-függőségek alapján kell meghatározni (pl. leadership levels min=4, contract types min=2).
- **Megelőzés**: Ha egy katalógus INSERT blokk más blokkok FK-forrása, MINDIG adj hozzá `Math.max(min, qty)` védelmet a slice-ba. Kommentben dokumentáld a min értéket és a függőség okát.

### [LESSON-SEED-004] Map-alapú FK-feloldás multi-entity seeder blokkokban
- **Dátum**: 2026-05-09 (v8 seeder)
- **Fájl**: `supabase/functions/seed-demo-workspace/index.ts`
- **Probléma**: A katalógus INSERT után UUID-k szükségesek a downstream FK mezőkhöz (`leadership_level_id`, `contract_type_id`, stb.). Iteratív DB lekérdezés minden egyes member-hez O(n) extra round-trip-et jelent.
- **Gyökérok**: Az INSERT eredmény UUID-jai elvesznek, ha nem tároljuk el; a következő blokk már nem tudja FK-ként feloldani őket anélkül, hogy újra lekérdezné.
- **Javítás**: Az INSERT válasz után azonnal Map-et építsünk: `const llByCode = new Map(llRows.map(r => [r.code, r.id]))`. A downstream blokk egyszerűen `llByCode.get(assignment.llCode)` — nulla extra DB round-trip.
- **Megelőzés**: Multi-entity seederben minden katalógus INSERT után AZONNAL építsd fel a `code→UUID` (vagy `name→UUID`) Map-et. A teljes seeder futás O(1) lookup-okkal dolgozzon, ne O(n) extra query-kel. Kövesd ezt a sorrendet: INSERT → `new Map(rows.map(...))` → downstream block uses Map.

### [LESSON-GOVERNANCE-001] entity-creation-inventory.md — governance source of truth az összes seedelt entitáshoz
- **Dátum**: 2026-05-09 (v8 seeder)
- **Fájl**: `.governance/entity-creation-inventory.md`
- **Probléma**: Az új katalógus entity típusok (job families, leadership levels, contract types, industries, work categories) be lettek illesztve a seederbe, de a governance dokumentum nem tükrözte ezt — audit trail hiány, és a következő fejlesztő nem látja, mi van seedelve.
- **Gyökérok**: A fejlesztés a governance dokumentum frissítése nélkül haladt.
- **Javítás**: Az `entity-creation-inventory.md` 2.1–2.5 szekciói frissítve ✅ markerekkel és seed config kulcsokkal.
- **Megelőzés**: Minden új seeded entity type bevezetésekor ELŐSZÖR frissítsd az `entity-creation-inventory.md`-t, MAJD implementáld a seeder kódot. A governance dokumentum a source of truth — a kód azt kövesse, ne fordítva.

---

## ➕ APPEND — 2026-05-09 Auth, routing, branding, katalógus és UI tanulságok (PRs #1–28)

### [LESSON-AUTH-OAUTH-001] Google OAuth URL fragment session restoration
- **Dátum**: 2026-05-04 (PR #1, #2)
- **Fájl**: `src/pages/Auth.tsx`, `src/hooks/useAuth.tsx`, `src/pages/Landing.tsx`
- **Probléma**: Google OAuth visszatérés után a `access_token` és `refresh_token` a `window.location.hash`-ben (`#access_token=...`) érkezett, de az app nem parseolta a hash-t — session nem lett visszaállítva, a UI az `/auth` oldalon fagy.
- **Gyökérok 1**: `Auth.tsx` nem olvasta a `window.location.hash` fragmentet `?oauth=google` esetén.
- **Gyökérok 2**: A `redirectTo: '/auth'` az OAuth provider-nél a Cloudflare Pages-en hard-404-ot okoz, mert az SPA shell nem töltődik be közvetlen navigációnál.
- **Javítás**: (a) Explicit hash-token feldolgozás `Auth.tsx`-ben: `?oauth=google` + nem hydratált user esetén `window.location.hash`-ből kiolvasni az access/refresh token-t, `setSessionFromTokens()` hívás, majd `history.replaceState` a hash törlésére. (b) `redirectTo` átírva `/`-re (mindig kiszolgált). (c) `AuthProvider`-ben centralizált fragment-feloldás app bootstrap-kor. (d) Landing page navigál a `redirect` targetbe miután session + `?oauth=google` detektálva.
- **Megelőzés**: OAuth `redirectTo` SOHA ne mutasson `/auth`-ra SPA-ban — mindig a root `/` az, ami biztosan kiszolgált. Az `#access_token=...` URL fragmentet a kliens oldalon kell kézzel kezelni; `history.replaceState`-tel töröld a feldolgozás után.

### [LESSON-ROUTING-SPA-001] Cloudflare Pages SPA fallback — `_redirects` formátum kritikus
- **Dátum**: 2026-05-04 (PR #6, #7, #8)
- **Fájl**: `public/_redirects`, `public/404.html`, `src/App.tsx`
- **Probléma**: Direkt URL navigáció (`/auth`, `/app?tab=resources` stb.) 404-et adott Cloudflare Pages-en.
- **Gyökérok**: A `_redirects` fájlnak PONTOSAN egyszeri szóközzel kell elválasztani a mezőket: `/*  /index.html  200`. Kettős szóköz vagy tab elvétheti a Cloudflare / Netlify parsert.
- **Háromrétegű megoldás**:
  1. `public/_redirects`: `/*  /index.html  200` (szimpla szóköz formátum)
  2. `public/404.html`: eltárolja a teljes path+query+hash-t `sessionStorage`-ban, átirányít `/?r=...`-re
  3. `src/App.tsx` `SpaRedirectHandler`: `sessionStorage`/`?r=` alapján kliens oldali navigáció
- **Megelőzés**: Új Cloudflare Pages / Netlify SPA deploymentnél MINDIG ellenőrizd a `_redirects` szóköz-formátumát. A `404.html` fallback + `SpaRedirectHandler` páros a legellenállóbb megoldás mert statikus hostoknál is működik.

### [LESSON-ROUTING-SPA-002] URL UUID-mentesítés: workspace ID localStorage-ban, ne URL-ben
- **Dátum**: 2026-05-04 (PR #3)
- **Fájl**: `src/pages/Enterprise.tsx`, `src/App.tsx`, `src/hooks/useAuth.tsx`
- **Probléma**: A `?ws=<uuid>` URL param lehetővé tette a workspace UUID kiszivárgását a böngésző history-ban, megosztott linkekben, analytics toolokban.
- **Gyökérok**: Az aktív workspace azonosítását az URL-re bízta a kód, ahelyett hogy kliens-oldali state-ben tárolná.
- **Javítás**: Workspace feloldási sorrend: (1) `?ws=` egyszer, backward compat → (2) `localStorage.active_workspace_id` → (3) első elérhető workspace. A `?ws=` paraméter `history.replaceState`-tel el lesz távolítva a feloldás után. `/enterprise` backward-compat redirect alias → `/app`.
- **Megelőzés**: Munkamenethez kötött belsős azonosítók (UUID-k, session ID-k) NE kerüljenek az URL-be. Használj `localStorage` vagy `sessionStorage` persistent state-et. Deep-link-ek csak olvasható, nem szenzitív paramétereket tartalmazzanak (pl. `?tab=`).

### [LESSON-SUPABASE-SDK-VERSION-001] Supabase JS verzió kompatibilitás Deno edge function-ökben
- **Dátum**: 2026-05-09 (PR #23)
- **Fájl**: `supabase/functions/seed-demo-workspace/index.ts`
- **Probléma**: Supabase JS `v2.45.0`-val a service role admin client minden insert operációt némán eldobott Deno edge function runtime-ban — sem hiba, sem log, sem beillesztett sor.
- **Gyökérok**: A `v2.45.0` SDK auth layer a Deno runtime-ban nem kezelte megfelelően a service role token-t a schema-szintű insert hívásokban.
- **Javítás**: Upgrade `v2.98.0`-ra (amely a többi működő edge functionben, pl. `create-instant-enterprise-member`, már jelen volt). Explicit auth options: `autoRefreshToken: false, persistSession: false, detectSessionInUrl: false`. Smoke test a startup-ban.
- **Megelőzés**: Edge function SDK verziót MINDIG az összes többi működő edge functionnel egységesítsd. Ha egy edge function néma hibával meghiúsul (no error, no rows), ELŐSZÖR az SDK verziót ellenőrizd — ez a leggyakoribb rejlő ok Deno futtatásnál.

### [LESSON-SELECTITEM-EMPTY-001] Radix UI `SelectItem` üres string `value` crash
- **Dátum**: 2026-05-09 (PR #21)
- **Fájl**: `src/components/enterprise/*` — minden Radix `Select` komponens
- **Probléma**: `<SelectItem value="">` futásidejű hibát dob Radix UI-ban — az üres string mint "nincs kiválasztva" sentinel érték nem támogatott.
- **Gyökérok**: A Radix UI Select component belső logikája az üres stringet érvénytelen értékként kezeli és kivételt dob.
- **Javítás**: Minden `value=""` helyettesítve nem-üres sentinel értékkel (pl. `value="__none__"`, `value="unselected"`).
- **Megelőzés**: Radix UI `Select` és `SelectItem` komponenseknél SOHA ne használj üres string `value`-t. Az "üres / nincs kiválasztva" állapothoz mindig használj nem-üres placeholder értéket, pl. `"__none__"` vagy a domain-specifikus sentinel.

### [LESSON-EMAIL-DIACRITIC-001] Magyar ékezetes karakterek slugify-álása email-generálásban
- **Dátum**: 2026-05-09 (PR #25)
- **Fájl**: `supabase/functions/seed-demo-workspace/index.ts`
- **Probléma**: Magyar nevekből generált email-ek (pl. `"Viktor Mátyás"` → `"viktor.matyas@demo.test"`) ékezetes karaktereket tartalmaztak, amelyek email-validáción elbuknak.
- **Gyökérok**: Közvetlen lowercase + `.replace(' ', '.')` transzformáció az ékezetes betűket megtartja.
- **Javítás**: `slugify()` helper: unicode normalizer (`NFD`) + `/[̀-ͯ]/g` regex strip + alphanum-only szűrő. `"Mátyás"` → `"matyas"`, `"Ádám"` → `"adam"`.
- **Megelőzés**: Névből generált email-eknél, username-eknél, slug-oknál MINDIG alkalmazz diacritic normalizálást. A magyar ábécé problémás karakterek: á→a, é→e, í→i, ó/ö/ő→o, ú/ü/ű→u. Email domain: `.local` helyett `.test` (RFC 2606 szerint a `.test` az ajánlott tesztkörnyezeti TLD).

### [LESSON-CATALOG-RLS-001] Globális katalógus táblák: RLS engedélyezve, de policy nélkül = 0 sor
- **Dátum**: 2026-05-09 (PR #22)
- **Fájl**: `supabase/migrations/` — `enterprise_catalog_categories`, `enterprise_catalog_roles`, `enterprise_catalog_skills`, `enterprise_catalog_role_skills`
- **Probléma**: A globális katalógus táblák RLS-sel lettek létrehozva, de egyetlen SELECT policy sem volt definiálva. Eredmény: minden `authenticated` user lekérdezése 0 sort adott vissza — `PositionPickerDialog` mindig üres volt.
- **Gyökérok**: A migráció hozzáadta az `ENABLE ROW LEVEL SECURITY`-t, de elfelejtette hozzáadni az olvasási policy-t a megosztott (nem workspace-scoped) globális táblákhoz.
- **Javítás**: `CREATE POLICY ... FOR SELECT USING (auth.uid() IS NOT NULL)` minden globális katalógus táblán.
- **Megelőzés**: Ha egy táblán `ENABLE ROW LEVEL SECURITY` szerepel, MINDIG adj hozzá legalább egy olvasási policy-t. Globális, workspace-független adatoknál (`enterprise_catalog_*`) a `authenticated` role számára egyszerű `auth.uid() IS NOT NULL` policy elegendő. Checklist: minden `ENABLE ROW LEVEL SECURITY` mellé kell legalább egy USING feltétel.

### [LESSON-POSITION-SOURCE-001] Pozíció dropdown: mindkét forrás szükséges (legacy + junction tábla)
- **Dátum**: 2026-05-04 (PR #6)
- **Fájl**: `src/components/enterprise/TeamManager.tsx`, `src/components/enterprise/InviteMemberDialog.tsx`
- **Probléma**: A pozíció dropdownok kizárólag az `enterprise_memberships.business_role` (legacy text oszlop) alapján épültek. Az `enterprise_member_role_allocations` junction táblában létrehozott pozíciók láthatatlanok maradtak minden dropdownban.
- **Gyökérok**: A junction tábla volt a kanonikus forrás, de a UI csak a régi denormalizált oszlopot nézte.
- **Javítás**: Mindkét forrás párhuzamos lekérdezése + halmazegyesítés: `[...new Set([...legacyRoles, ...allocationRoles])]`.
- **Megelőzés**: Ha létezik junction tábla bármely N:M kapcsolatra, a UI MINDIG innen olvassa az opciókat — nem a denormalizált legacy oszlopból. Ha backward compat miatt mindkettő létezik, MINDIG mergeld a kettőt.

### [LESSON-ORGCHART-FLATTEN-001] Org fa pre-flattening premium rendererhez
- **Dátum**: 2026-05-09 (PR #28)
- **Fájl**: `src/components/enterprise/organization/OrgChartPremiumView.tsx`
- **Probléma**: Rekurzív fa-renderelés során minden kártya megnyitásakor újra kellett bejárni a fát a manager/gyerek relációk feloldásához — O(n²) komplexitás nagy csapatoknál.
- **Gyökérok**: A fa-struktúra nem volt indexelve, mindig traversal kellett.
- **Javítás**: A render előtt egyszer `flatNodes: Map<string, OrgNode>` map buildek a teljes fából — ezután minden lookup O(1). A drawer adatai (manager neve, közvetlen beosztottak listája) egy `Map.get(id)` hívással elérhetők.
- **Megelőzés**: Bármely fa-alapú UI rendernél (org chart, comment thread, category tree) MINDIG prepare-elj egy `Map<id, node>` flat lookup structure-t a render előtt. A rekurzív traversal csak az initial tree build-hez szükséges, utána minden lookup O(1) legyen.

### [LESSON-THEME-CSS-001] CSS változó token alapú téma rendszer — 6 sablon
- **Dátum**: 2026-05-04 (PR #5)
- **Fájl**: `src/hooks/useTheme.tsx`, `src/styles/themes.css`
- **Probléma**: Komponensekbe kódolt szín- és stílusértékek témaváltást lehetetlenné tesznek, vagy minden egyes komponenst módosítani kell.
- **Gyökérok**: Közvetlenül Tailwind szín-class-ok komponens szinten, nincs CSS változó réteg.
- **Javítás**: `themes.css`-ben CSS változók definiálva minden témához (`enterprise`, `nebula`, `aurora`, `graphite`, `sunrise`, `mono`). `<html>` root osztályváltás (`document.documentElement.classList`) + `localStorage` perzisztencia. Komponensek ugyanazon token neveket használják — csak a gyökerükön definiált értékek változnak.
- **Megelőzés**: Témát igénylő alkalmazásoknál MINDIG CSS változó token réteget vezess be. A komponensek ne hard-coded Tailwind színeket (`bg-purple-600`) használjanak, hanem semantic token osztályokat (`bg-primary`). A témaváltás egyetlen osztálycsere legyen a `<html>` elemen.
