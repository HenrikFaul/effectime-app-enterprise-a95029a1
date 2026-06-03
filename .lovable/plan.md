## Cél
A landing page (`src/pages/Landing.tsx` által használt `landing.*` kulcsok) magyar szövegeinek lektorálása és újraírása marketing-, SEO- és nyelvi szempontból. Gombfeliratokat NEM módosítunk. Az EN kulcsok közül csak azokat csiszoljuk, ahol a HU változtatás miatt szemantikai eltérés keletkezne — egyébként az angol érintetlen marad.

## Azonosított főbb problémák a jelenlegi HU szövegben

**1. T/V (tegezés/magázás) keveredése — törésvonal a hangnemben**
- Magázás: „Próbálja ki már ma", „Regisztráljon ingyenesen", „Kezdje el ingyen"
- Tegezés: „Lásd egy nézetben", „Cseréld le a táblázatot", „Hozd létre", „Hívd meg"
- → Egységes **tegezés** (modern B2B SaaS norma HU-ban, Absentify, Mention, Notion HU is ezt használja). Gombokat nem írjuk át.

**2. Anglicizmusok / magyartalan kifejezések**
- „people ops" → „HR-műveletekhez" / „napi HR-működéshez"
- „accrual szabályok" → „felhalmozási szabályok"
- „post-itek" → „cetlik"
- „Sérthetetlen audit napló / log" → „változtathatatlan audit napló"
- „Alapból enterprise szintű" → „Vállalati szint alapból"
- „auditált egyenlegek" megmarad (szakszó), de pontosítva

**3. Nyelvtani / ragozási hibák**
- „Hozd létre a munkaterületed" → „Hozd létre a munkaterületedet" (tárgyrag)
- „Olyan szabványokra építve, amit … elvár" → „amiket … elvárnak" (számbeli egyeztetés)
- „70%-kal csökkent a szabadság-adminisztráció" → „70%-kal csökkent a szabadságok adminisztrációja"
- „Tömeges import vagy meghívók" → „Tömeges importtal vagy meghívókkal"

**4. Konverziós / SEO szempont (értékfókusz, kulcsszavak)**
- `hero_subtitle`: „Az Effectime platformmal" redundáns; tömörítés + fő kulcsszó („szabadságkezelés", „kapacitástervezés") elöl
- `trusted_by`: „Operatív csapatok bíznak benne 14 országban" — „benne" antecedens nélkül → „14 ország operatív csapatai bíznak bennünk"
- `stat_4_label`: „Ország, ahol használják" → „Ország használja"
- `showcase_title`: „Mindent, ami a people ops-hoz kell" → „Minden, ami a napi HR-működéshez kell"
- `s3_title`: „Két héttel előre lásd a hiányokat" → „Lásd a hiányokat két héttel korábban" (természetesebb mondatdallam)
- `s4_title`: „Jóváhagyások a csapatod sebességén" → „Jóváhagyások a csapatod tempójában"
- `testimonial_3_quote`: szóhasználat finomítás („…ez a legnagyobb dicséret, amit szoftvernek adhatunk.")
- `faq_5_a`: „Aktív felhasználónként havidíjas, havi vagy éves számlázással." → „Aktív felhasználónkénti havidíj, havi vagy éves elszámolással. 50 fő felett mennyiségi kedvezmény jár."

**5. Érintett kulcsok (kb. 45–50 db a `landing.*` blokkban)**
Hero (subtitle), trusted_by, mind a 4 stat label, problem (title/desc + 3 kártya), showcase (title/desc), s1–s4 (title/desc/bullet/mock egyes feliratok), how (title/desc + 3 lépés), vs (desc + néhány sor), proof (title + 3 testimonial), trust (title/desc + 4 chip), faq (összes Q/A), final (desc).

**Gombfeliratok és nav linkek (NEM nyúlunk hozzájuk):**
`btn_*`, `nav_*`, `s1_mock_approve/decline`, `final_cta`, `final_cta_secondary`, `cta_*` címkék.

## Technikai részletek

- Egyetlen fájl módosul: `src/i18n/resources/hu.ts` (sorok ~1586–1750, `landing:` blokk).
- EN (`src/i18n/resources/en.ts`) változatlan — a meglévő EN szöveg jó, és a HU módosítások nem érintik a kulcsok szemantikáját.
- Komponens (`src/pages/Landing.tsx`) nem módosul.
- Stílus: B2B-szakmai, határozott, tegező, kerüljük a felesleges anglicizmust, de a meghonosodott szakszavakat (SLA, audit napló, SSO, GDPR, ISO 27001, iCal) megtartjuk.
- Karakterhossz: a hero subtitle 160 karakter alatt marad (meta-konzisztencia), a FAQ válaszok 2 mondatban.

## Governance lépések a kódmódosítás után
1. `CHANGELOG.md` – új patch verzió (v3.49.3) HU copy lektor.
2. `versioning/03062602_v3.49.3_landing-hu-copy-rewrite.md`
3. `marketing/marketing_values/20260603_v3.49.3_landing-hu-copy-rewrite_marketing_value.md`
4. Vizuális regresszió nincs — csak szöveg.

## Nem ezen feladat hatókörében
- Auth oldal (`auth_page.*`) szövegei — külön körben, ha kéred.
- Gombfeliratok és navigáció.
- EN copy átírása (csak ha kifejezetten kéred).
