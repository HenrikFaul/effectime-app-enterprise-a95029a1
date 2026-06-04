# 11 — Indexability Guardian Output

**Run:** 2026-06-04T00:00:00Z · session-end
**Guardian:** `SEO/11_AUTO_INDEXABILITY_GUARDIAN.md`

## §1 Invariant matrix

| # | Invariant | Status | Note |
|---|-----------|--------|------|
| I1 | Canonical host = `https://effectime.app` | PASS | `SITE_URL` in `SeoHead.tsx` confirmed. |
| I2 | Exactly one `<link rel="canonical">` per route | PASS | Only Helmet-emitted; `index.html` has none. |
| I3 | `robots.txt` allows pillars + blocks auth routes | **FIXED** | Re-emitted from §3 canonical block; added `Disallow:` for `/app`, `/w/`, `/profile`, `/enterprise`, `/reset-password`, `/unsubscribe`, `/admin`, `/superadmin`, `/reseller`, `/book/`, `/embed/`. |
| I4 | `sitemap.xml` ≡ canonical set | PASS | `/`, `/muszakbeosztas`, `/szabadsagkezeles`, `/kapacitastervezes`, `/auth` present; no auth-gated route leaked. |
| I5 | hreflang `hu` + `x-default` on every public entry | PASS | Verified in `SeoHead.tsx` and `sitemap.xml`. |
| I6 | No redirecting / query-string / trailing-slash drift | PASS | Routes match canonical literals byte-for-byte. |
| I7 | No `lovable.app` preview host in production HTML | PASS | grep clean across `src/`, `public/`, `index.html`. |
| I8 | `sitemap.xml` `lastmod` ≤ 30 days | PASS | All entries dated 2026-06-03 / 2026-06-04. |

## §2 Canonical set

| Route | Canonical | Sitemap | robots |
|-------|-----------|---------|--------|
| `/` | https://effectime.app/ | ✓ | allow |
| `/muszakbeosztas` | https://effectime.app/muszakbeosztas | ✓ | allow |
| `/szabadsagkezeles` | https://effectime.app/szabadsagkezeles | ✓ | allow |
| `/kapacitastervezes` | https://effectime.app/kapacitastervezes | ✓ | allow |
| `/auth` | https://effectime.app/auth | ✓ | allow |

## §6 Audit steps — execution log

1. robots.txt diff vs §3 → FAIL on initial read; auto-fix applied; re-read = PASS.
2. sitemap `<loc>` set parsed → equal to canonical set.
3. Per-route `<SeoHead path>` literals verified against `src/App.tsx`.
4. `rg 'rel="canonical"' index.html` → empty (PASS).
5. `rg 'lovable\.app' src/ public/ index.html` → empty (PASS).
6. `rg 'www\.effectime\.app'` repo-wide (excluding docs/audit dirs) → empty (PASS).
7. `llms.txt` `## Pages` list = canonical set (PASS).
8. SEO/01 audit canonical sub-check → no new findings.
9. This report written.
10. No remaining FAIL rows; rerun unnecessary.
11. PASS run #1 of 3 (consecutive-clean counter reset by I3 auto-fix).

## Footer

- Files modified this session: `public/robots.txt` (canonical block re-emitted).
- No code/route changes required.
- Next guardian invocation: at the start of the next development session per `AGENTS.md` read-order step 7.
