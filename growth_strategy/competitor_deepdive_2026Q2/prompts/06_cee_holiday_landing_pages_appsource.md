# Prompt 06 — CEE ünnepnap landing-ek + Microsoft AppSource listing

**Beat:** absentify.com (`/public-holidays/<country>` ~41% organikus traffic)
**Cél:** 7-10 ország ünnepnap-landing + Microsoft AppSource / Teams App Store listing → két disztribúciós csatorna párhuzamosan.
**Effort:** M (5-8 hét)

## User story (kettős)

> **SEO:** Mint EU HR-manager, aki rákeres "munkaszüneti napok 2026 magyarország" / "public holidays 2026 czech republic"-re, Effectime-ot lássam az első találatok közt — naprakész, letölthető .ics naptárral.
>
> **Distribution:** Mint Microsoft 365 admin, aki a Teams App Store-ban keres szabadság-/workforce-megoldást, találjam meg Effectime-ot ott, ne csak Absentify-t.

## Acceptance criteria — ünnepnap landings

`/munkaszuneti-napok/<country-locale>` és `/public-holidays/<country>`:

1. `/munkaszuneti-napok/magyarorszag-2026` + `/public-holidays/hungary-2026`
2. `/public-holidays/czech-republic-2026` + `/svatky/cesko-2026`
3. `/public-holidays/slovakia-2026` + `/sviatky/slovensko-2026`
4. `/public-holidays/poland-2026` + `/dni-wolne/polska-2026`
5. `/public-holidays/romania-2026` + `/zile-libere/romania-2026`
6. `/public-holidays/austria-2026` + `/feiertage/oesterreich-2026`
7. `/public-holidays/germany-2026` + `/feiertage/deutschland-2026`

Minden oldal:
- Évente frissülő ünnepnap-lista (forrás: Nager.Date API / kézi review).
- Híd-napok + pihenő-napok automatikus számítás.
- **.ics letöltés** (Outlook/Google Calendar import).
- **JSON-LD:** `Event` + `ItemList`.
- **Cluster-internal-linking:** mindegyik link a többi country-re + Effectime-product-page-re.
- **Title pattern:** `Munkaszüneti napok <ország> 2026 | Pihenőnapok + híd-napok ingyenes naptár`
- **Auto-refresh** minden január 2-án új évre.

## Acceptance criteria — Microsoft AppSource & Teams App Store

1. **Microsoft Partner Center** account setup (publisher: Effectime).
2. **AppSource listing**: tagline, screenshot-pack, kategória "HR & Recruiting", támogatott Microsoft 365 SKU-k.
3. **Teams App Store manifest** (manifest.json + ikon + színek) — meglévő Teams-bot (`competitor_feature_prompts/01`) builddel együtt.
4. **Privacy policy + terms** Microsoft-megfelelően.
5. **Submission review** átfutási idő ~2-4 hét.

## Anti-regression

- Country-landing oldalak statikus generálás (build-time), nem futási adatbázis-call.
- AppSource listing nem érinti a meglévő auth-flow-t.

## Marketing claim

*"Effectime ott, ahol a HR-manager keres: Google első oldalon az ünnepnap-keresésre, és Microsoft AppSource / Teams App Store-ban közvetlenül telepíthetően."*
