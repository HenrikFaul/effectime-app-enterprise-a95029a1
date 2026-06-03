## Cél
1. `index.html` SEO metaadatok továbbfejlesztése (rich SEO + AI Overview + LLM search).
2. SEO/ mappa output fájljainak frissítése a v3.48.0 óta megtörtént fejlesztésekkel (v3.49.x landing, copy lektor, a11y).
3. Új master prompt elhelyezése a SEO/ mappában, amely tartalmazza a #1 Google ranking eléréséhez szükséges kulcsszavakat, megoldásokat és checklistát.
4. Verziózás + marketing_value + CHANGELOG.

## 1. index.html — meta- és schema-bővítés

**Új / pontosított elemek:**
- `<title>` újraírva ranking-cél kulcsszavakra: „Műszakbeosztó program & Szabadságkezelő rendszer | Effectime" (58 char, primary keyword #1 pozícióban)
- `<meta description>` újraírva CTR-optimalizáltan, kulcsszó-sűrítve + USP + CTA (155 char)
- `<meta name="keywords">` — secondary signal, 8–10 magas-szándékú HU kulcsszó (műszakbeosztó program, szabadságkezelő rendszer, kapacitástervező szoftver, workforce management magyar, csapatnaptár, távollétkezelő, Excel helyett, HR szoftver kkv)
- `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">` — AI Overview + rich snippet engedélyezés
- `<meta name="google" content="notranslate">` (magyar elsődleges piacon)
- `<meta name="rating" content="General">`, `<meta name="revisit-after" content="7 days">`
- `<meta name="geo.region" content="HU">`, `<meta name="geo.placename" content="Budapest">`, `<meta name="geo.position">`, `<meta name="ICBM">` — lokális SEO HU piacra
- Hreflang javítás: jelenleg `hu` és `en` ugyanarra mutat — `en` href-et `/en/` vagy alternate URL-re kell állítani vagy ideiglenesen csak `hu` + `x-default` (utóbbit választjuk amíg nincs EN route)
- Article-szintű `og:site_name`, `og:image:type`
- LinkedIn-specifikus tag: `<meta property="og:image:secure_url">`
- JSON-LD bővítések:
  - **BreadcrumbList** schema (sitelink-eligible)
  - **AggregateRating** a SoftwareApplication schemán (csillagos rich result a SERP-en — ez adja a vizuális #1 előnyt)
  - **Offer** kibővítése: `priceValidUntil`, `availability`, `category`
  - **Organization** kiegészítése: `contactPoint`, `address` (PostalAddress, HU), `sameAs` LinkedIn + GitHub
  - **HowTo** schema „Hogyan kezdj el műszakbeosztást készíteni" — AI Overview trigger
  - **Service** schema (workforce management szolgáltatás kategória)
- Noscript fallback bővítése további szekciókkal (jelenleg ~200 szó → ~600 szó) — több crawler-látható kulcsszó
- Performance hint: `<link rel="preload" as="image" href="/og-image.png">` lecserélve a tényleges hero képre, és `<link rel="modulepreload">` a main.tsx-re

## 2. SEO/ output fájlok frissítése

A v3.48.0 óta megvalósult fejlesztések szinkronizálása az érintett output fájlokba:
- `SEO/outputs/03_onpage_content_output.md` → új landing copy (v3.49.0 funkció-showcase, v3.49.3 HU lektor), új H2/H3 struktúra
- `SEO/outputs/04_technical_seo_output.md` → a11y javítások (v3.49.1, v3.49.2), focus-visible, ARIA, viewport sweep
- `SEO/outputs/08_schema_eeat_llms_output.md` → új schema típusok (BreadcrumbList, AggregateRating, HowTo, Service)
- `SEO/outputs/09_seo_action_backlog.md` → lezárt feladatok megjelölése DONE-ra, új P0/P1 tételek a #1 ranking eléréséhez
- `SEO/outputs/executive_summary.md` → status update (mit értünk el v3.48.0 → v3.49.x között)
- `SEO/outputs/implementation_roadmap.md` → fázisok aktualizálása

## 3. Új master prompt: `SEO/10_NUMBER_ONE_RANKING_PROMPT.md`

Tartalom (használható későbbi AI sessionökhöz):
- **Mission**: Effectime #1 Google találat HU piacon a kategóriájában
- **Target keywords (priority tiers)**:
  - **Tier 1 (head, #1 cél)**: műszakbeosztó program, szabadságkezelő rendszer, kapacitástervező szoftver
  - **Tier 2 (mid-tail)**: workforce management magyar, csapatnaptár szoftver, távollétkezelő rendszer, beosztáskészítő program, jelenlétkezelő szoftver
  - **Tier 3 (long-tail / AI Overview)**: hogyan készítsek műszakbeosztást Excel helyett, ingyenes szabadságkezelő kkv-knak, Microsoft 365 csapatnaptár integráció
- **Competitor benchmark**: Absentify, Vacation Tracker, Humanforce, Resource Guru, Excel-alapú megoldások
- **Solution playbook** (mit kell tennie az AI-nak ranking-emeléshez):
  1. On-page: H1 = primary keyword exact match, első 100 szóban keyword, kulcsszó-sűrűség 1–2%
  2. Schema: SoftwareApplication + AggregateRating + FAQPage + HowTo + BreadcrumbList kötelező
  3. E-E-A-T: szerző bio, „Updated YYYY-MM-DD" minden cikkre, magyar ügyfél case studyk
  4. Topical authority: pillar (`/muszakbeosztas`, `/szabadsagkezeles`, `/kapacitastervezes`) + cluster cikkek
  5. Internal linking: minden cluster cikk → pillar, hub-spoke
  6. Core Web Vitals: LCP <2.5s, CLS <0.1, INP <200ms
  7. Backlink stratégia: HVG Tech, Forbes HU, hrportal.hu, kkv-portál guest postok
  8. LLM search readiness: llms.txt frissítve, faktoidikus mondatszerkezet, „Az Effectime egy …" definíciós mondatok
- **Acceptance criteria**: a fenti checklist 100%-os teljesítése előtt nem zárható le SEO task
- **Verification protocol**: Semrush domain_analysis + serp_analysis havonta, Google Search Console pozíció-monitoring
- **Frissítési naptár**: havonta keyword refresh, negyedévente competitor re-audit

## 4. Verziózás
- `versioning/03062603_v3.49.4_seo-meta-deep-optimization.md`
- `marketing/marketing_values/20260603_v3.49.4_seo-meta-deep-optimization_marketing_value.md`
- `CHANGELOG.md` új entry: v3.49.4 SEO meta + schema deep optimization + #1 ranking playbook

## Érintett fájlok
- edit: `index.html`, `CHANGELOG.md`
- edit: `SEO/outputs/03_onpage_content_output.md`, `04_technical_seo_output.md`, `08_schema_eeat_llms_output.md`, `09_seo_action_backlog.md`, `executive_summary.md`, `implementation_roadmap.md`
- new: `SEO/10_NUMBER_ONE_RANKING_PROMPT.md`
- new: `versioning/03062603_v3.49.4_seo-meta-deep-optimization.md`
- new: `marketing/marketing_values/20260603_v3.49.4_seo-meta-deep-optimization_marketing_value.md`

## Nem ezen feladat hatókörében
- React komponensek (csak `index.html` szintű meta)
- Új útvonalak (`/en/`, `/muszakbeosztas` pillar oldalak) — backlogba kerül
- Tényleges Semrush adatlekérés / SEO scan — opcionális utólag

## Kockázat
- Alacsony: `index.html` head-only változások, nincs viselkedés-regresszió.
- Hreflang `en` átállítás x-default-only-ra biztonságos, mert nincs külön EN route.
