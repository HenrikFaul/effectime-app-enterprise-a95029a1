# Internal Linking Agent — Output
# effectime.app | 2026-05-23

## 1. Future Information Architecture — Recommended URL Structure

Critical prerequisite: **migrate from HashRouter (`/#/route`) to BrowserRouter with SSG/SSR** so marketing pages get real server-renderable URLs. The existing app routes (`/app`, `/w/:workspaceId`, `/auth`) can remain in the SPA layer; only public marketing pages need to be static-rendered.

### URL Structure Map

```
effectime.app/                          [HUB: Landing / Home]
effectime.app/hu/funkciok/              [HUB: Features overview]
  ├── /hu/funkciok/muszakbeosztas       [SPOKE: Shift Scheduling]
  ├── /hu/funkciok/kapacitastervezes    [SPOKE: Capacity Planning]
  ├── /hu/funkciok/szabadsagkezeles     [SPOKE: Leave Management]
  ├── /hu/funkciok/jovahagyasi-folyamatok [SPOKE: Approval Workflows]
  ├── /hu/funkciok/embed-sdk            [SPOKE: CRM Embed SDK]
  ├── /hu/funkciok/idonyilvantartas     [SPOKE: Time & Attendance]
  ├── /hu/funkciok/szervezeti-diagram   [SPOKE: Org Chart]
  └── /hu/funkciok/agile-integraciok   [SPOKE: Jira / ADO Integration]

effectime.app/hu/megoldasok/            [HUB: Use Cases]
  ├── /hu/megoldasok/it-csapatok        [SPOKE: IT & Software Teams]
  ├── /hu/megoldasok/egeszsegugy        [SPOKE: Healthcare / Shift Workers]
  ├── /hu/megoldasok/penzugyi-szolgaltatas [SPOKE: Financial Services]
  └── /hu/megoldasok/holding-vallalatcsoport [SPOKE: Multi-entity / Holding]

effectime.app/hu/integraciok/           [HUB: Integrations]
  ├── /hu/integraciok/jira              [SPOKE: Jira]
  ├── /hu/integraciok/azure-devops      [SPOKE: Azure DevOps]
  ├── /hu/integraciok/ical-outlook      [SPOKE: iCal / Outlook]
  └── /hu/integraciok/crm-embed        [SPOKE: CRM Embed]

effectime.app/hu/biztonsag/             [SPOKE: Security & GDPR]
effectime.app/hu/arak/                  [SPOKE: Pricing]
effectime.app/hu/blog/                  [HUB: Blog / Resources]
  └── /hu/blog/<slug>                   [SPOKEs: individual posts]
effectime.app/hu/hasonlitas/            [HUB: Comparisons]
  ├── /hu/hasonlitas/effectime-vs-personio
  ├── /hu/hasonlitas/effectime-vs-sloneek
  └── /hu/hasonlitas/effectime-vs-excel
effectime.app/hu/referenciak/           [SPOKE: Case Studies]
effectime.app/hu/adatvédelem/           [SPOKE: Privacy Policy]
effectime.app/hu/aszf/                  [SPOKE: Terms of Service]
effectime.app/hu/kapcsolat/             [SPOKE: Contact]
```

**Slug philosophy:** All slugs are Hungarian-primary. No accented characters in URLs (ASCII-only). Exception: `embed-sdk` and `agile-integraciok` where HU market uses EN loanwords.

### Hub vs. Spoke Classification

| Level | Pages | Authority Role |
|---|---|---|
| L1 Hub | `/` | Receives all inbound links; redistributes to all L2 hubs |
| L2 Hub | `/hu/funkciok/`, `/hu/megoldasok/`, `/hu/integraciok/`, `/hu/hasonlitas/`, `/hu/blog/` | Consolidate topical authority; link down to spokes and up to home |
| L3 Spoke | All feature, use-case, integration, comparison, blog pages | Rank for long-tail keywords; link up to hub and laterally to related spokes |
| Support | `/hu/biztonsag/`, `/hu/arak/`, `/hu/referenciak/`, legal pages | Serve conversion / trust / compliance needs |

---

## 2. Internal Linking Plan (25 Recommendations)

| # | Source Page | Target Page | Anchor Text (HU) | Link Type | Reason | Expected Impact | Priority |
|---|---|---|---|---|---|---|---|
| 1 | `/` (Hero section) | `/hu/funkciok/` | Összes funkció megtekintése | CTA button | Primary conversion path from landing; pulls authority from H1 context | High CTR from above-fold placement; passes maximum PageRank | P1 |
| 2 | `/` (Features card: Beosztás varázsló) | `/hu/funkciok/muszakbeosztas` | Műszakbeosztás részletei | Contextual text link | Card anchor targets exact feature URL; reinforces feature cluster | Helps `/hu/funkciok/muszakbeosztas` rank for "műszakbeosztás szoftver" | P1 |
| 3 | `/` (Features card: Erőforrás-tervezés) | `/hu/funkciok/kapacitastervezes` | Kapacitástervező bemutatása | Contextual text link | Connects home to top-priority feature spoke | Boosts kapacitástervezés cluster | P1 |
| 4 | `/` (Features card: Szabadság-kezelés) | `/hu/funkciok/szabadsagkezeles` | Szabadságkezelés részletei | Contextual text link | Highest search volume HU keyword in HR SaaS | Direct ranking support | P1 |
| 5 | `/` (Features card: CRM beágyazás) | `/hu/funkciok/embed-sdk` | Embed SDK dokumentáció | Contextual text link | Differentiator feature; unique in HU market; developer audience | Attracts developer / CTO persona | P1 |
| 6 | `/` (Benefits section) | `/hu/biztonsag/` | GDPR-kompatibilis adatkezelés | Inline text link | Trust signal to dedicated security page; important for enterprise | Reduces bounce for enterprise evaluators | P2 |
| 7 | `/` (Benefits section) | `/hu/integraciok/ical-outlook` | iCal és Outlook szinkronizáció | Inline text link | High-frequency query from HU HR managers | Boosts integration spoke | P2 |
| 8 | `/` (Benefits section) | `/hu/integraciok/jira` | Agilis sprint-integráció (Jira) | Inline text link | Captures IT-manager persona | Drives Jira integration spoke | P2 |
| 9 | `/` (FAQ: Q3 CRM question) | `/hu/funkciok/embed-sdk` | Embed SDK és iframe API | Contextual link in answer | FAQ answers enrich snippet content and distribute authority | FAQ → Spoke strengthens featured snippet capture | P1 |
| 10 | `/` (Footer) | `/hu/funkciok/` | Funkciók | Footer nav | Universal site-wide signal | Passes consistent PageRank across all pages | P1 |
| 11 | `/` (Footer) | `/hu/arak/` | Árazás | Footer nav | Pricing is high-intent discovery page | Conversion support | P1 |
| 12 | `/` (Footer) | `/hu/biztonsag/` | Adatbiztonság | Footer nav | Trust signal for enterprise | Reduces enterprise drop-off | P2 |
| 13 | `/` (Footer) | `/hu/blog/` | Blog és tudástár | Footer nav | Seeds blog as a crawlable section | Enables future content cluster indexing | P2 |
| 14 | `/hu/funkciok/` (Feature hub) | `/hu/funkciok/muszakbeosztas` | Műszakbeosztás automatizálása | Hub card link | Hub must link to all spokes | Hub → Spoke foundational link | P1 |
| 15 | `/hu/funkciok/` (Feature hub) | `/hu/funkciok/kapacitastervezes` | Valós idejű kapacitástervező | Hub card link | Same | Same | P1 |
| 16 | `/hu/funkciok/` (Feature hub) | `/hu/funkciok/szabadsagkezeles` | Automatizált szabadságkezelés | Hub card link | Same | Same | P1 |
| 17 | `/hu/funkciok/` (Feature hub) | `/hu/funkciok/embed-sdk` | CRM beágyazható HR nézetek | Hub card link | Same | Same | P1 |
| 18 | `/hu/funkciok/muszakbeosztas` | `/hu/funkciok/kapacitastervezes` | Csapatkapacitás valós időben | Related feature link (sidebar) | Shift users also need capacity planning; lateral spoke-to-spoke | Increases pages-per-session; distributes authority | P2 |
| 19 | `/hu/funkciok/muszakbeosztas` | `/hu/funkciok/embed-sdk` | Beágyazható műszakbeosztás nézet | Inline contextual | Shift roster embed is a core SDK use case | Drives embed-sdk spoke ranking | P1 |
| 20 | `/hu/funkciok/kapacitastervezes` | `/hu/integraciok/jira` | Jira sprint-kapacitás integráció | Inline contextual | Jira integration is a key USP of capacity planning | Boosts Jira integration spoke | P2 |
| 21 | `/hu/funkciok/szabadsagkezeles` | `/hu/funkciok/jovahagyasi-folyamatok` | Jóváhagyási munkafolyamat beállítása | Inline contextual | Leave management is incomplete without approval chain context | Natural user journey link | P2 |
| 22 | `/hu/funkciok/embed-sdk` | `/hu/funkciok/muszakbeosztas` | Műszakbeosztás a CRM-ben | Inline contextual | Each embed view links back to its feature page | Spoke ↔ spoke reciprocal link | P2 |
| 23 | `/hu/megoldasok/it-csapatok` | `/hu/integraciok/jira` | Jira és Azure DevOps integráció IT csapatoknak | Inline contextual | Use-case page must link to relevant integration spoke | Authority flows through use-case hub into integration spokes | P2 |
| 24 | `/hu/hasonlitas/effectime-vs-personio` | `/hu/arak/` | Effectime árazás | Sidebar/CTA | Comparison pages are high-intent; pricing link captures bottom-of-funnel users | Direct conversion opportunity | P1 |
| 25 | `/hu/blog/<cikk-muszakbeosztas>` | `/hu/funkciok/muszakbeosztas` | Effectime műszakbeosztó szoftver | Contextual (within article) | Blog content clusters must link to the monetized feature page | Blog → Feature passes authority from informational to commercial | P1 |

---

## 3. Hub-Spoke Authority Map

```
                        ┌─────────────────────────────┐
                        │       effectime.app/         │
                        │   [Root Hub — Max Authority] │
                        └──────────────┬──────────────┘
           ┌─────────────┬─────────────┼──────────────┬─────────────┐
           ▼             ▼             ▼              ▼             ▼
      /hu/funkciok/  /hu/megoldasok/  /hu/integraciok/  /hu/hasonlitas/  /hu/blog/
      [L2 Hub]       [L2 Hub]         [L2 Hub]          [L2 Hub]        [L2 Hub]
           │             │                │                  │               │
    ┌──────┴──────┐      │         ┌──────┴──────┐          │        ┌──────┴──────┐
    ▼      ▼      ▼      ▼         ▼      ▼     ▼           ▼        ▼      ▼     ▼
  /muszak /kapac /szab /it-cs   /jira  /ical /crm-embed  /vs-per  post1  post2  ...
  /embed  /jova  /ido  /egesz   /ado         
  /agile  /org   

LATERAL LINKS (spoke ↔ spoke, same topic cluster):
  /muszakbeosztas ↔ /embed-sdk           (shift scheduling ↔ CRM embed)
  /kapacitastervezes ↔ /jira             (capacity ↔ Jira integration)
  /szabadsagkezeles ↔ /jovahagyasi-folyamatok  (leave ↔ approval chain)
  /it-csapatok ↔ /jira                   (use case ↔ integration)

UPWARD LINKS (every spoke → parent hub → root):
  All /funkciok/* → /funkciok/ → /
  All /megoldasok/* → /megoldasok/ → /
  All /integraciok/* → /integraciok/ → /

CROSS-HUB LINKS (limited, high-value only):
  /megoldasok/it-csapatok → /integraciok/jira
  /blog posts → /funkciok/* (monetize informational traffic)
  /hasonlitas/* → /arak/ (comparison + pricing intent)
```

---

## 4. Anchor Text Guide

### Primary Keywords as Anchors

| Target Page | Primary Anchor (HU) | Primary Anchor (EN) |
|---|---|---|
| `/hu/funkciok/muszakbeosztas` | műszakbeosztás szoftver | shift scheduling software |
| `/hu/funkciok/kapacitastervezes` | kapacitástervező | capacity planning |
| `/hu/funkciok/szabadsagkezeles` | szabadságkezelés | leave management |
| `/hu/funkciok/embed-sdk` | CRM beágyazható nézetek | CRM embed SDK |
| `/hu/funkciok/jovahagyasi-folyamatok` | jóváhagyási munkafolyamat | approval workflow |
| `/hu/integraciok/jira` | Jira integráció | Jira integration |
| `/hu/integraciok/ical-outlook` | iCal szinkronizáció | iCal / Outlook sync |
| `/hu/biztonsag/` | GDPR-kompatibilis adatkezelés | GDPR-compliant |
| `/hu/arak/` | Effectime árazás | Effectime pricing |
| `/hu/blog/` | HR tudástár | HR resources |

### Variation Rules

1. **Exact match anchor** (primary keyword): Use on first occurrence per page only
2. **Partial match / phrase anchor**: Embed keyword in natural phrase (most links should be this type). Example: "automatikus műszakbeosztás funkcióink"
3. **Brand + keyword**: Use on external or comparison pages. Example: "Effectime kapacitástervező"
4. **Descriptive functional anchor**: In how-to contexts. Example: "Jóváhagyási lánc beállítása"
5. **No naked URLs in body copy** — footer and schema markup only

### Variation Cap Rule
No single anchor text variant on more than 3 links site-wide pointing to the same target URL. Track: target URL → anchor text → source page.

### Banned Anchors

| Banned | Reason | Replace With |
|--------|--------|-------------|
| kattints ide | Zero keyword signal | Műszakbeosztás részletei |
| tovább | Generic nav | Kapacitástervező megismerése |
| itt | Generic | Any descriptive phrase |
| bővebben | Thin anchor on blog | [Topic] — részletek |
| Repeating exact-match 10+ times | Over-optimization risk | Use variations |

---

## 5. Current State Orphan Analysis

HashRouter makes every route below `/` invisible to crawlers. From a search engine's perspective, effectime.app has exactly one public page.

| Hash Route | Maps To | Orphan Status | Content Value |
|---|---|---|---|
| `/#/auth` | Auth/login | Full orphan | High (conversion page — should be indexable post-BrowserRouter) |
| `/#/app` | Workspace picker | Intentionally gated | N/A |
| `/#/w/:workspaceId` | Workspace dashboard | Intentionally gated | N/A |
| `/#/profile` | User profile | Intentionally gated | N/A |
| `/#/embed/:view` | Embed views (5 types) | Full orphan | High (should be publicly documented) |
| `/#/reset-password` | Password reset | Full orphan | Low |
| `/#/admin` | Admin panel | Intentionally gated | N/A |
| `/#/superadmin` | Platform admin | Intentionally gated | N/A |
| `/#/unsubscribe` | Email unsub | Orphan — should remain non-indexed | Low |
| `/#/reseller` | Reseller portal | Gated — but public `/viszontelado` page would have SEO value | Medium |
| `/#/book/:token` | Candidate booking | Token-based orphan | Low |

**Recommended fix sequence:**
1. Keep HashRouter for the **app layer** (auth, workspace, admin — should not be indexed)
2. Add SSG for the **marketing layer** (landing, features, blog — build to static HTML at deploy time)
3. Configure `robots.txt` to disallow `/#/` (hash-routed app) while allowing all SSG-rendered paths
4. The `/embed/:view` documentation page (not the runtime embed itself) should exist as a static SSG page at `/hu/funkciok/embed-sdk` to capture developer search traffic

**Immediate fix (no migration required):** Add `<link rel="canonical" href="https://effectime.app/">` to `index.html` so all hash-route variants consolidate authority to the root URL.
