# Prompt 04 — Vendéglátás-vertikál landing + sablon-library

**Beat:** beosztasom.hu (vendéglátás niche)
**Cél:** Vendéglátás + retail + egészségügy vertikális landing-oldalak + iparág-specifikus műszak-sablonok.
**Effort:** S-M (3-4 hét)

## User story

> Mint étterem-tulajdonos, aki rákeres "étterem műszakbeosztás"-ra, lássak egy iparág-specifikus Effectime landing-page-t a saját nyelvemen (példák: "szombat este 8 fős konyha + 5 fő pincér"), és tudjak ingyen letölteni egy heti műszak-sablont.

## Acceptance criteria

### Landing pages (`/iparag/<slug>`)
1. `/iparag/vendéglatas` — étterem, kávézó, bár
2. `/iparag/szallodaipar` — recepció, housekeeping, F&B
3. `/iparag/retail-bolt` — multi-shift retail
4. `/iparag/egészségügy` — ápolók, orvosok, cert-tracking
5. `/iparag/építőipar` — építkezés-helyszín + GPS clock-in
6. `/iparag/iroda-knowledge-work` — kapacitás-tervezés, projekt

Minden oldal: hero (iparág-specifikus pain), 3 use-case, 1 testimonial (pilot partner vagy "coming soon"), CTA "Próbáld ki", linkek a relevant feature-pagekre.

### Műszak-sablon library (`/sablonok`)
- 15+ ingyen letölthető CSV / Effectime-import template:
  - "Étterem heti műszak — 12 fő"
  - "Kávézó hétvégi műszak — 6 fő"
  - "Bolt 2-shift — 8 fő"
  - "Recepció 24/7 — 6 fő"
  - "Ápolói műszak 3-shift — 12 fő"
  - "Építőipari brigád — 8 fő"
  - stb.
- Email-gate **NEM kötelező** (free download, csak Effectime-CTA a footer-ben).

### SEO
- Schema: `Service` + `FAQPage`.
- Internal linking: minden landing → 3-5 blog-cikk + feature-page.
- Title pattern: `<Iparág> műszakbeosztás | Effectime — ingyen sablon és próba`

## Anti-regression

- Új route-ok csak — semmi meglévő oldal módosítás.

## Marketing claim

*"Iparág-specifikus műszak-sablonok, magyar nyelven, ingyen — egy kattintással Effectime-ba importálva."*
