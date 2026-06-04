# Prompt 03 — Magyar Mt. tartalom-motor + compliance engine

**Beat:** olmunkaido.hu (SEO content-leadership)
**Cél:** 20+ Mt./munkajogi SEO-oldal + termékbeli compliance-figyelmeztető motor.
**Effort:** L (6-10 hét, tartalom-írás + jogi review + termék-integráció)

## User story (kettős)

> **SEO user story:** Mint magyar HR-manager / könyvelő, aki rákeres a "túlóra szabályai 2026"-ra, az első találatok között Effectime-ot kell látnom mély, jogász-által reviewolt cikkel.
>
> **Termék user story:** Mint vendéglátós manager, aki egy 14 órás műszakot próbál beosztani, az Effectime piros figyelmeztetést mutasson: "Mt. 99. § — napi pihenőidő sérül, minimum 11 óra pihenő szükséges."

## Acceptance criteria — SEO oldalak

A `marketing/content/` mappába 20 darab, magyar nyelvű, 1500-3000 szavas tartalom:
1. `mt-117-paragrafus-szabadsag-szamitas.md`
2. `tuloradijak-szamitasa-2026.md`
3. `pihenoido-mt-99.md`
4. `vasarnapi-potlek-szabalyok.md`
5. `ejszakai-potlek-2026.md`
6. `szabadsag-eves-megallapodas-szabalyai.md`
7. `keret-munkaido-mt.md`
8. `munkaszuneti-napok-2026.md`
9. `apasagi-szabadsag-szabalyai.md`
10. `gyed-gyes-szabadsag-kezelés.md`
11. `jelenléti-iv-sablon-letoltheto.md`
12. `tavolléti-igazolas-szabalyai.md`
13. `unnepnap-pottnap-szabaly.md`
14. `vasarnapi-munka-tilalom-kivetelek.md`
15. `egészségügyi-alkalmasság-lejarat.md`
16. `tanulmanyi-szabadsag-szabalyai.md`
17. `betegszabadsag-vs-keresokeptelenseg.md`
18. `osszevont-munkaido-keret.md`
19. `keszenlet-mt-szabalyai.md`
20. `bertranszparencia-eu-direktíva-2026.md`

Minden oldal: JSON-LD `Article` schema, OG, canonical, hreflang HU, internal-linking cluster, **lábjegyzet:** "Tartalom-review: [ügyvédi iroda neve]", **CTA:** "Próbáld ki, hogyan figyelmeztet az Effectime Mt.-szabálysértésre".

## Acceptance criteria — Compliance engine

- `mt_compliance_rules` JSON-config a kódban (napi pihenőidő ≥ 11h, heti ≥ 48h, túlóra max 250h/év, vasárnapi munka korlátozás).
- Műszakbeosztás során real-time validáció → piros/sárga/zöld badge a sliton.
- "Magyarázat" tooltip: melyik Mt. paragrafust sérti.
- Override admin által, audit-loggal.

## Anti-regression

- Tartalom-oldalak `/blog/<slug>` route-on — nem érintik a meglévő `/app` routes-okat.
- Compliance engine **figyelmeztet**, de **nem block-ol** (manager felelőssége) — kivéve ha workspace setting-ben strict-mode bekapcsolva.

## Marketing claim

*"Az egyetlen magyar workforce-platform, amely magyar Mt.-szakértők által reviewolt tartalmat és real-time compliance-figyelmeztetést ad."*
