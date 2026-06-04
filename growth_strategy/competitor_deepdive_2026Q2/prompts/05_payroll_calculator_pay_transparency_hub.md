# Prompt 05 — Bérkalkulátor + bértranszparencia hub

**Beat:** nexon.hu (`/berkalkulator` SEO-magnet + bértranszparencia 2026 EU direktíva)
**Cél:** Public, ingyen használható bér-, szabadság-, és bértranszparencia-kalkulátorok mikrosite + organikus SEO-magnet.
**Effort:** M (4-6 hét)

## User story

> Mint HR-felelős vagy munkavállaló, aki rákeres "bérkalkulátor 2026"-ra vagy "bértranszparencia EU direktíva"-ra, lássam Effectime-ot az első találatok között egy működő, ingyen használható kalkulátorral, anélkül hogy regisztrálnom kellene.

## Acceptance criteria

### Kalkulátorok (`/kalkulator/<slug>` — public, no auth)

1. **`/kalkulator/ber-2026`** — Bruttó ↔ nettó bér kalkulátor 2026 adótáblákkal (SZJA, TB, ny.járulék). Frissítés évente.
2. **`/kalkulator/szabadsag-2026`** — Életkor + munkaviszony hossza + Mt. 117. § → éves szabadság-nap kalkulátor.
3. **`/kalkulator/tulorabber`** — Túlóra-pótlék kalkulátor (hétközi 50%, vasárnapi 100%, ünnepi 100% + 100%).
4. **`/kalkulator/munkaszuneti-napok-2026`** — Magyar ünnepnapok 2026 + naptár-export (.ics).
5. **`/kalkulator/pay-gap-audit`** — Csapat-szintű pay-gap kalkulátor (CSV upload: név, beosztás, nem, bér → gender pay gap %). **EU 2026 direktíva-megfelelőség.**

Mindegyik:
- **No-auth, public.**
- **Result-page CTA:** "Mentsd el az eredményt Effectime workspace-edben."
- **JSON-LD:** `WebApplication` schema.
- **Embeddable widget** (`<iframe>`) — HR-blog-okba könnyen beépíthető (link-build).

### Bértranszparencia hub (`/bertranszparencia`)
- Tartalom-cluster: EU 2026 direktíva magyarázat, mit jelent a 250+ fős cégeknek, mikortól kötelező, mit kell jelenteni, hogyan segít Effectime.
- 5-7 cikk-aloldal.
- Lead-magnet PDF: "EU bértranszparencia checklist 2026".

## Anti-regression

- Public routes, no auth.
- Kalkulátorok kliens-oldali számítás (no backend call) — privacy-first.

## Marketing claim

*"Ingyenes magyar bér-, szabadság- és bértranszparencia-kalkulátor — regisztráció nélkül. Bízd ránk a számolást, te koncentrálj a csapatra."*
