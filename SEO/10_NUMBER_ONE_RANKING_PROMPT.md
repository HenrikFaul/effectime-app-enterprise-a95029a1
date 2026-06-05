# Effectime — #1 Google Ranking Master Prompt

> **Status:** Living document. Last updated 2026-06-03 (v3.49.4).
> **Owner:** SEO orchestration agents (see `00_MASTER_CONTROLLER_PROMPT.md`).
> **Mission:** Effectime must rank **#1 on google.hu** for the head terms in its category, and appear in **AI Overviews** and **LLM answers** (ChatGPT, Perplexity, Gemini) when Hungarian users ask about műszakbeosztás, szabadságkezelés, kapacitástervezés.

---

## 1. Mission statement

Treat every SEO-touching change as a vote toward this single goal:

> *When a Hungarian decision-maker (HR vezető, ops manager, kkv-tulajdonos) searches Google for any term in Tier 1 below, the first organic result — and the AI Overview citation — is Effectime.*

If a proposed change does not measurably help that goal, deprioritize it.

---

## 2. Target keyword tiers

These keywords are the **acceptance contract**. Every landing page revision, every schema change, every blog post must be checked against this list.

### Tier 1 — Head terms (must rank #1 on google.hu) — 10 keywords

| Keyword | Intent | Current target page |
|---|---|---|
| `műszakbeosztó program` | Commercial / category | `/` (Landing) |
| `műszakbeosztó szoftver` | Commercial | `/` (Landing) |
| `online műszakbeosztás` | Commercial | `/` (Landing) |
| `szabadságkezelő rendszer` | Commercial / category | `/` (Landing) |
| `szabadságnyilvántartó program` | Commercial | `/` (Landing) |
| `kapacitástervező szoftver` | Commercial / category | `/` (Landing) |
| `erőforrás tervező szoftver` | Commercial | `/` (Landing) |
| `beosztáskészítő program` | Commercial | `/` (Landing) |
| `beosztáskészítő szoftver` | Commercial | `/` (Landing) |
| `munkaidő nyilvántartó szoftver` | Commercial | `/` (Landing) |

### Tier 2 — Mid-tail (top 3 on google.hu within 6 months) — 17 keywords

- `workforce management magyar`, `WFM rendszer`
- `csapatnaptár szoftver`, `csapatnaptár online`, `közös naptár csapatnak`
- `távollétkezelő rendszer`, `távollét nyilvántartás`, `online szabadságkérés`
- `jelenlétkezelő szoftver`, `jelenléti ív program`, `munkaidő nyilvántartás online`
- `HR szoftver kkv`, `HR rendszer magyar`, `kkv HR megoldás`
- `projekt kapacitás tervezés`
- `műszakbeosztó Excel helyett`, `beosztás Excel helyett`

### Tier 3 — Long-tail, AI Overview & comparison triggers — 20 keywords

- `hogyan készítsek műszakbeosztást Excel helyett`
- `legjobb műszakbeosztó program 2026`
- `legjobb szabadságkezelő rendszer 2026`
- `ingyenes műszakbeosztó program`
- `ingyenes szabadságkezelő kkv-knak`
- `Microsoft 365 csapatnaptár integráció`
- `Outlook szabadság naptár`
- `Teams beosztás integráció`
- `műszakbeosztó CRM-be ágyazva`
- `hány órát dolgozhat egy munkavállaló műszakban`
- `szabadság felhalmozási szabályok Mt.`
- `mennyibe kerül egy workforce management szoftver`
- `GDPR megfelelő HR szoftver`
- `EU adatközpont HR szoftver`
- `magyar nyelvű HR szoftver`
- `Absentify alternatíva`
- `Vacation Tracker alternatíva`
- `Resource Guru alternatíva`
- `Humanforce alternatíva`
- `Nexum alternatíva`

### Tier 4 — Vertical / industry long-tail (high commercial intent) — 5 keywords

- `vendéglátás beosztás szoftver`
- `gyártás műszakbeosztás`
- `egészségügy műszakbeosztás`
- `IT csapat kapacitás tervezés`
- `multi-tenant HR platform`

**Total tracked HU keywords: 52** (10 Tier 1 + 17 Tier 2 + 20 Tier 3 + 5 Tier 4).
All 52 are present in `index.html` `<meta name="keywords">` (v3.49.6) and must reappear in the visible HU landing copy + `<noscript>` fallback (semantic density target: each Tier 1 term ≥3×, each Tier 2 ≥2×, each Tier 3 ≥1×).

### Tier 5 — International (later, when EN route ships)

- `workforce management software Hungary`
- `absence management for SMEs`
- `Microsoft 365 shift scheduling`


---

## 3. Competitive landscape (benchmark)

Direct and adjacent competitors whose SERP positions we must beat:

| Competitor | Threat level | Why they rank |
|---|---|---|
| **Absentify** | High | Strong Microsoft 365 integration story, content marketing |
| **Vacation Tracker** | High | Heavy SEO investment on `vacation tracker` long-tail |
| **Resource Guru** | Medium | Capacity planning vertical, strong DA |
| **Humanforce** | Medium | Enterprise workforce, EN content |
| **Nexum / Nexon** (HU) | Medium | HU enterprise HR brand recognition |
| **Excel templates / blog tutorials** | Low–Medium | Steal long-tail "how-to" intents |

**Differentiation moat to amplify in every page:**
1. **Hungarian-first** (felület + ügyfélszolgálat + DPA + Hungarian case studies).
2. **CRM-embeddable** (iframe SDK — no competitor offers this).
3. **Unified surface** (műszak + szabadság + kapacitás one tool, not three).
4. **Microsoft 365 SSO + Outlook** out of the box.
5. **GDPR EU adatközpont** (vs US-hosted competitors).

---

## 4. The #1 Ranking Playbook (8-pillar checklist)

Every SEO-touching PR MUST tick these. An unchecked pillar blocks ranking gains.

### 4.1 On-page (per target page)

- [ ] `<title>` 50–60 chars, primary keyword in first 30 chars, brand at end
- [ ] `<meta description>` 140–160 chars, primary keyword + USP + CTA
- [ ] Single `<h1>` with exact-match primary keyword
- [ ] Primary keyword in first 100 words of visible body
- [ ] Keyword density 1–2% (natural; never stuff)
- [ ] LSI / semantic variants in H2/H3 (synonyms, plurals, related entities)
- [ ] All images have descriptive `alt` (keyword + concept, not stuffed)
- [ ] Internal links to ≥3 cluster pages with descriptive anchors
- [ ] Outbound link to 1–2 high-authority sources (gov, research, schema.org)

### 4.2 Schema (JSON-LD in `index.html` — sitewide minimum)

- [x] `Organization` with address, contactPoint, sameAs
- [x] `SoftwareApplication` with `AggregateRating` + `Offer`
- [x] `FAQPage` (8+ Q&A blocks)
- [x] `HowTo` (Excel → Effectime migration — AI Overview trigger)
- [x] `Service` with `areaServed` (HU + CEE)
- [x] `BreadcrumbList`
- [x] `WebSite` (Sitelinks Searchbox eligibility)
- [ ] `Article` schema per blog post (Helmet, when blog ships)
- [ ] `Product` + `Review` schema per case study (Helmet)

### 4.3 E-E-A-T (Experience / Expertise / Authority / Trust)

- [ ] Author bio with credentials on every long-form page
- [ ] "Frissítve: YYYY-MM-DD" timestamp on every content page
- [ ] At least 3 Hungarian customer case studies with named companies
- [ ] Real customer testimonials with photo + role + company
- [ ] Public roadmap or changelog accessible from footer
- [ ] About page with founder bio, registered company info, address

### 4.4 Topical authority (pillar–cluster)

**Pillar pages to build (in order of priority):**
1. `/muszakbeosztas` — pillar for shift scheduling
2. `/szabadsagkezeles` — pillar for absence management
3. `/kapacitastervezes` — pillar for capacity planning

**Cluster article seed list (5 per pillar minimum):**
- *Műszakbeosztás Excel helyett: 5 ok a váltásra*
- *Hány órát dolgozhat egy munkavállaló műszakban? — Mt. összefoglaló 2026*
- *Forgó műszakbeosztás minták (3 példa kkv-knak)*
- *Szabadság felhalmozási szabályok a magyar Mt. szerint*
- *Hogyan integrálható a csapatnaptár Microsoft 365-be*
- *Kapacitástervezés agilis csapatoknak — keret és sablonok*

### 4.5 Internal linking architecture

- Hub-spoke: every cluster article links to its pillar with primary anchor
- Every pillar links down to all its clusters
- Landing → 3 pillars (primary anchor) in hero + footer
- Breadcrumbs on every non-landing page
- No orphan pages (sitemap audit monthly)

### 4.6 Core Web Vitals (technical SEO floor)

| Metric | Target | Source of truth |
|---|---|---|
| LCP | < 2.5s mobile, < 1.8s desktop | PageSpeed Insights |
| INP | < 200ms | PageSpeed Insights |
| CLS | < 0.1 | PageSpeed Insights |
| TTFB | < 800ms | WebPageTest |
| Bundle (initial JS) | < 2.5 MB | Vite build report |

Currently mitigated via code splitting (v3.48.0); re-verify after every layout change.

### 4.7 Off-page (backlinks + brand mentions)

**Year 1 link-building priorities (Hungarian-first):**
- HVG Tech, Forbes HU, hrportal.hu, kkv-portál guest posts
- HRMagazin, Profession.hu thought leadership
- ITBusiness.hu, Computerworld.hu product feature
- Startup ökoszisztéma: Startup Hungary, Bridge Budapest
- Microsoft Partner Network listing
- G2, Capterra, Software Advice (international DA carry-over)

**Tactic:** ship 1 datapoint-led press piece per quarter ("HU workforce admin survey 2026", etc.) — repeatable backlink magnet.

### 4.8 AI search / LLM readiness (GEO — Generative Engine Optimization)

- [x] `/llms.txt` published and current
- [x] Definitional opening sentence on landing: *"Az Effectime egy magyar fejlesztésű workforce management platform…"*
- [x] FAQPage schema with conversational Q&A
- [x] HowTo schema with explicit steps
- [ ] Factoid-friendly structure in pillar articles (one fact per sentence, bulleted lists, definitions)
- [ ] Comparison pages: *"Effectime vs Absentify"*, *"Effectime vs Vacation Tracker"* (LLM citation magnets)
- [ ] Public statistics page with shareable numbers (LLMs love numerical sources)

---

## 5. Acceptance criteria (per release)

Before any release that touches `index.html`, landing copy, schema, or routes:

1. **All 8 pillars above ticked** (or explicit waiver with reason in `versioning/*.md`).
2. **Title + description regression check** — manually grep `<title>` and `description` to confirm Tier 1 keyword presence.
3. **Schema validation** — paste into <https://validator.schema.org/> and confirm 0 errors.
4. **Rich Results test** — <https://search.google.com/test/rich-results> shows ≥3 eligible result types.
5. **Lighthouse SEO score ≥ 95**.
6. **No regression in Tier 1 keyword density** (compare diff of visible HU copy on landing).

---

## 6. Verification & monitoring protocol

| Cadence | Action | Tool |
|---|---|---|
| Weekly | Position check Tier 1 keywords (HU) | Google Search Console + manual SERP |
| Bi-weekly | Competitor SERP diff | `semrush--serp_analysis` per Tier 1 |
| Monthly | Domain trend snapshot | `semrush--domain_analysis` + `seo_trend` |
| Monthly | Keyword volume refresh | `semrush--keyword_research` on Tier 1+2 |
| Quarterly | Full competitor re-audit | `semrush--competitive_analysis` |
| Quarterly | Backlink profile review | `semrush--backlink_analysis` |
| On every release | Lighthouse + Rich Results test | manual |

**Always set Semrush `database=hu`** for HU-targeting queries. Always name Semrush as the data source when reporting numbers.

---

## 7. Anti-patterns (do NOT do)

- ❌ Keyword stuffing in title/description/H1 (Google penalty + lower CTR)
- ❌ Hidden text, white-on-white, doorway pages
- ❌ Duplicate `<link rel="canonical">` (one in `index.html`, another via Helmet)
- ❌ Hreflang pointing two locales to the same URL without `x-default`
- ❌ AggregateRating without real underlying reviews (Google manual action risk)
- ❌ Generic `og-image.png` placeholder — replace with branded asset
- ❌ Adding `noindex` to landing
- ❌ Migrating sitemap mechanism without confirmation
- ❌ Hardcoding english strings in pages targeting HU market

---

## 8. Update protocol for this prompt

This document is the source of truth. Update it when:
- A Tier 1 keyword hits #1 (move to "won" appendix, promote a Tier 2)
- A new competitor enters SERP top 10 (add to §3)
- A new schema type ships in `index.html` (tick §4.2)
- A pillar page launches (tick §4.4 and add to internal linking matrix)
- Core Web Vitals targets change (Google announcement)

Every update bumps the "Last updated" header and creates a `versioning/*.md` entry.

---

## 9. Quick-reference one-liner for AI agents

> *"You are working on Effectime. Every SEO change must move us toward #1 on google.hu for `műszakbeosztó program`, `szabadságkezelő rendszer`, and `kapacitástervező szoftver`. Read `SEO/10_NUMBER_ONE_RANKING_PROMPT.md` before acting. Tick all 8 pillars or explain the waiver."*


========================================================================================
DEEP-KNOWLEDGE EXPANSION — Number One Ranking Orchestrator
========================================================================================


> This file is intentionally exhaustive. It is the long-form operating
> manual for the **Number One Ranking Orchestrator**, designed so a senior practitioner
> can run the agent end-to-end without external context. Length is not
> padding — it is breadth across industries, locales, scenarios, KPIs,
> anti-patterns, and orchestration with the other SEO agents.

**Agent identity.** Number One Ranking Orchestrator.
**Operating lens.** end-to-end #1 ranking campaign for a single keyword/cluster.
**Primary artifacts.** campaign_brief.md, ranking_war_room.md, weekly_progress.md, moat_plan.md.
**Owning personas.** SEO Campaign Director, Growth Lead, Founder/Operator.
**Generated at.** 2026-06-05.


----------------------------------------------------------------------------------------
SECTION A — OPERATING PRINCIPLES (LONG FORM)
----------------------------------------------------------------------------------------

1. Every finding ships with severity, effort, owner, evidence, and KPI link.
2. No vague verbs (`improve`, `consider`, `optimize`) without measurable acceptance criteria.
3. Every recommendation must be reversible or carry an explicit rollback note.
4. Every intervention has a verification method and a re-audit cadence.
5. Cross-agent contracts are honored: dependencies are declared, not implied.
6. Locale and template variance must be explicitly modeled, not averaged away.
7. Algorithm updates are annotated in the timeline; correlation is not causation.
8. Baselines are captured before action; KPIs without a baseline are rejected.
9. Data freshness ≤ 7 days for tactical decisions, ≤ 30 days for strategic.
10. Outputs are reproducible: same inputs + same prompt = same artifact.


----------------------------------------------------------------------------------------
SECTION B — INPUT CONTRACT
----------------------------------------------------------------------------------------


The agent refuses to execute when required inputs are missing. Required:
`target_domain`, `primary_market`, `business_model`, `priority_objective`,
`timeline`, and at least one of `gsc_export`, `ga4_export`, or `crawl_export`.

Optional but recommended: `competitor_list`, `topic_clusters`,
`conversion_goals`, `revenue_per_lead`, `historical_algorithm_log`,
`internal_search_log`, `helpdesk_top_questions`, and `crm_revenue_data`.

Missing inputs are reported in `open_questions` with a confidence
penalty applied to every dependent finding.


----------------------------------------------------------------------------------------
SECTION C — KPI SYSTEM
----------------------------------------------------------------------------------------

| KPI | Targets | Source | Cadence | Owner |
|-----|---------|--------|---------|-------|
| `target_keyword_position` | baseline + 30/60/90 day targets | GSC / GA4 / crawl tool | weekly | SEO Lead |
| `serp_feature_capture` | baseline + 30/60/90 day targets | GSC / GA4 / crawl tool | weekly | SEO Lead |
| `campaign_completion_pct` | baseline + 30/60/90 day targets | GSC / GA4 / crawl tool | weekly | SEO Lead |
| `weeks_to_top3` | baseline + 30/60/90 day targets | GSC / GA4 / crawl tool | weekly | SEO Lead |
| `weeks_to_top1` | baseline + 30/60/90 day targets | GSC / GA4 / crawl tool | weekly | SEO Lead |


##### KPI Deep-Dive — `target_keyword_position`

- **Definition.** Precise numerator/denominator; document edge cases.
- **Source of truth.** Primary tool + secondary cross-check.
- **Cadence.** Daily snapshot, weekly aggregate, monthly trend, quarterly review.
- **Baseline capture.** Record the value before any intervention; never
  retro-calculate from a moving window.
- **Target setting.** Use the 80/50/20 rule — 80% probable, 50% stretch,
  20% moonshot — and pre-commit which the program is funded for.
- **Alert thresholds.** WoW Δ > 10% triggers investigation;
  WoW Δ > 25% triggers P0 review.
- **Common misreads.** Seasonality, attribution windows, sampling.
- **Reporting visualization.** Line chart with rolling 7-day mean +
  band of ±1 stdev; annotate algorithm updates and launches.


##### KPI Deep-Dive — `serp_feature_capture`

- **Definition.** Precise numerator/denominator; document edge cases.
- **Source of truth.** Primary tool + secondary cross-check.
- **Cadence.** Daily snapshot, weekly aggregate, monthly trend, quarterly review.
- **Baseline capture.** Record the value before any intervention; never
  retro-calculate from a moving window.
- **Target setting.** Use the 80/50/20 rule — 80% probable, 50% stretch,
  20% moonshot — and pre-commit which the program is funded for.
- **Alert thresholds.** WoW Δ > 10% triggers investigation;
  WoW Δ > 25% triggers P0 review.
- **Common misreads.** Seasonality, attribution windows, sampling.
- **Reporting visualization.** Line chart with rolling 7-day mean +
  band of ±1 stdev; annotate algorithm updates and launches.


##### KPI Deep-Dive — `campaign_completion_pct`

- **Definition.** Precise numerator/denominator; document edge cases.
- **Source of truth.** Primary tool + secondary cross-check.
- **Cadence.** Daily snapshot, weekly aggregate, monthly trend, quarterly review.
- **Baseline capture.** Record the value before any intervention; never
  retro-calculate from a moving window.
- **Target setting.** Use the 80/50/20 rule — 80% probable, 50% stretch,
  20% moonshot — and pre-commit which the program is funded for.
- **Alert thresholds.** WoW Δ > 10% triggers investigation;
  WoW Δ > 25% triggers P0 review.
- **Common misreads.** Seasonality, attribution windows, sampling.
- **Reporting visualization.** Line chart with rolling 7-day mean +
  band of ±1 stdev; annotate algorithm updates and launches.


##### KPI Deep-Dive — `weeks_to_top3`

- **Definition.** Precise numerator/denominator; document edge cases.
- **Source of truth.** Primary tool + secondary cross-check.
- **Cadence.** Daily snapshot, weekly aggregate, monthly trend, quarterly review.
- **Baseline capture.** Record the value before any intervention; never
  retro-calculate from a moving window.
- **Target setting.** Use the 80/50/20 rule — 80% probable, 50% stretch,
  20% moonshot — and pre-commit which the program is funded for.
- **Alert thresholds.** WoW Δ > 10% triggers investigation;
  WoW Δ > 25% triggers P0 review.
- **Common misreads.** Seasonality, attribution windows, sampling.
- **Reporting visualization.** Line chart with rolling 7-day mean +
  band of ±1 stdev; annotate algorithm updates and launches.


##### KPI Deep-Dive — `weeks_to_top1`

- **Definition.** Precise numerator/denominator; document edge cases.
- **Source of truth.** Primary tool + secondary cross-check.
- **Cadence.** Daily snapshot, weekly aggregate, monthly trend, quarterly review.
- **Baseline capture.** Record the value before any intervention; never
  retro-calculate from a moving window.
- **Target setting.** Use the 80/50/20 rule — 80% probable, 50% stretch,
  20% moonshot — and pre-commit which the program is funded for.
- **Alert thresholds.** WoW Δ > 10% triggers investigation;
  WoW Δ > 25% triggers P0 review.
- **Common misreads.** Seasonality, attribution windows, sampling.
- **Reporting visualization.** Line chart with rolling 7-day mean +
  band of ±1 stdev; annotate algorithm updates and launches.


----------------------------------------------------------------------------------------
SECTION D — INDUSTRY PLAYBOOKS
----------------------------------------------------------------------------------------


#### Playbook 01 — Number One Ranking Orchestrator in SaaS / B2B software

**Context.** When operating in SaaS / B2B software, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by editorial guides.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (en-GB, hu-HU, de-DE).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 21 days of shipping, the targeted URL must:
> - rank within top-5 for the head term,
> - capture at least 2 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 02 — Number One Ranking Orchestrator in E-commerce

**Context.** When operating in E-commerce, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by tool/calculator pages.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (hu-HU, de-DE, pl-PL).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 28 days of shipping, the targeted URL must:
> - rank within top-5 for the head term,
> - capture at least 3 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 03 — Number One Ranking Orchestrator in Marketplaces

**Context.** When operating in Marketplaces, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by transactional listings.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (de-DE, pl-PL, cs-CZ).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 35 days of shipping, the targeted URL must:
> - rank within top-5 for the head term,
> - capture at least 1 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 04 — Number One Ranking Orchestrator in Local services

**Context.** When operating in Local services, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by editorial guides.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (pl-PL, cs-CZ, sk-SK).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 42 days of shipping, the targeted URL must:
> - rank within top-10 for the head term,
> - capture at least 2 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 05 — Number One Ranking Orchestrator in Healthcare

**Context.** When operating in Healthcare, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by tool/calculator pages.
- Buyer journey involves high-trust evaluation cycles.
- E-E-A-T weight is critical (YMYL).

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (cs-CZ, sk-SK, fr-FR).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 49 days of shipping, the targeted URL must:
> - rank within top-5 for the head term,
> - capture at least 3 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 06 — Number One Ranking Orchestrator in Legal

**Context.** When operating in Legal, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by transactional listings.
- Buyer journey involves high-trust evaluation cycles.
- E-E-A-T weight is critical (YMYL).

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (sk-SK, fr-FR, es-ES).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 14 days of shipping, the targeted URL must:
> - rank within top-5 for the head term,
> - capture at least 1 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 07 — Number One Ranking Orchestrator in FinTech

**Context.** When operating in FinTech, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by editorial guides.
- Buyer journey involves high-trust evaluation cycles.
- E-E-A-T weight is critical (YMYL).

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (fr-FR, es-ES, it-IT).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 21 days of shipping, the targeted URL must:
> - rank within top-5 for the head term,
> - capture at least 2 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 08 — Number One Ranking Orchestrator in EdTech

**Context.** When operating in EdTech, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by tool/calculator pages.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (es-ES, it-IT).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 28 days of shipping, the targeted URL must:
> - rank within top-10 for the head term,
> - capture at least 3 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 09 — Number One Ranking Orchestrator in Real Estate

**Context.** When operating in Real Estate, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by transactional listings.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (it-IT).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 35 days of shipping, the targeted URL must:
> - rank within top-5 for the head term,
> - capture at least 1 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 10 — Number One Ranking Orchestrator in Travel

**Context.** When operating in Travel, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by editorial guides.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (en-US, en-GB, hu-HU).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 42 days of shipping, the targeted URL must:
> - rank within top-5 for the head term,
> - capture at least 2 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 11 — Number One Ranking Orchestrator in Media & Publishing

**Context.** When operating in Media & Publishing, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by tool/calculator pages.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (en-GB, hu-HU, de-DE).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 49 days of shipping, the targeted URL must:
> - rank within top-5 for the head term,
> - capture at least 3 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 12 — Number One Ranking Orchestrator in Manufacturing

**Context.** When operating in Manufacturing, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by transactional listings.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (hu-HU, de-DE, pl-PL).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 14 days of shipping, the targeted URL must:
> - rank within top-10 for the head term,
> - capture at least 1 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 13 — Number One Ranking Orchestrator in DTC consumer goods

**Context.** When operating in DTC consumer goods, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by editorial guides.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (de-DE, pl-PL, cs-CZ).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 21 days of shipping, the targeted URL must:
> - rank within top-5 for the head term,
> - capture at least 2 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 14 — Number One Ranking Orchestrator in Hospitality

**Context.** When operating in Hospitality, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by tool/calculator pages.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (pl-PL, cs-CZ, sk-SK).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 28 days of shipping, the targeted URL must:
> - rank within top-5 for the head term,
> - capture at least 3 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 15 — Number One Ranking Orchestrator in Government & Nonprofit

**Context.** When operating in Government & Nonprofit, the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by transactional listings.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (cs-CZ, sk-SK, fr-FR).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 35 days of shipping, the targeted URL must:
> - rank within top-5 for the head term,
> - capture at least 1 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


#### Playbook 16 — Number One Ranking Orchestrator in Workforce / HR software (Effectime)

**Context.** When operating in Workforce / HR software (Effectime), the Number One Ranking Orchestrator must adapt
its end-to-end #1 ranking campaign for a single keyword/cluster lens to the dominant SERP patterns, regulatory
constraints, and buyer behavior of this segment.

**Top hypotheses to test first**
- SERP archetype is dominated by editorial guides.
- Buyer journey involves fast comparison and conversion.
- E-E-A-T weight is moderate.

**Working procedure**
1. Pull top-20 SERPs for the cluster head term and 5 modifiers.
2. Classify result types and identify the dominant content archetype.
3. Extract the median word count, schema mix, author signals, and update cadence.
4. Map findings to the ranking_campaign backlog with severity (P0-P3) and effort (XS-XL).
5. Define a measurable acceptance criterion per finding.
6. Re-audit at 14 / 30 / 60 / 90 days; record movement vs baseline.

**Common traps**
- Treating navigational queries as informational and over-investing in long-form.
- Ignoring locale variants (sk-SK, fr-FR, es-ES).
- Skipping schema variants required by this vertical.

**Acceptance criteria template**
> Within 42 days of shipping, the targeted URL must:
> - rank within top-10 for the head term,
> - capture at least 2 SERP feature(s),
> - hold CWV pass on mobile,
> - and show a non-decreasing CTR week over week.


----------------------------------------------------------------------------------------
SECTION E — LOCALE & MARKET MATRIX
----------------------------------------------------------------------------------------


#### Locale `en-US`

- SERP characteristics: research dominant features (FS, PAA, AI Overview, local pack).
- hreflang strategy: ensure reciprocal `hreflang` tags between locale variants
  and an `x-default` fallback; canonicalize per-locale.
- Currency, units, date formats: must match locale; mismatches kill CTR.
- Schema localization: translate `name`, `description`, and `inLanguage` fields;
  keep `@id` stable across locales.
- Search intent drift: head-term volume differs by locale; rebuild clusters per market.
- Cultural angle: terminology, examples, screenshots, social proof must localize.
- Internal linking: each locale has its own pillar set; never cross-link locales
  to dilute relevance signals.


#### Locale `en-GB`

- SERP characteristics: research dominant features (FS, PAA, AI Overview, local pack).
- hreflang strategy: ensure reciprocal `hreflang` tags between locale variants
  and an `x-default` fallback; canonicalize per-locale.
- Currency, units, date formats: must match locale; mismatches kill CTR.
- Schema localization: translate `name`, `description`, and `inLanguage` fields;
  keep `@id` stable across locales.
- Search intent drift: head-term volume differs by locale; rebuild clusters per market.
- Cultural angle: terminology, examples, screenshots, social proof must localize.
- Internal linking: each locale has its own pillar set; never cross-link locales
  to dilute relevance signals.


#### Locale `hu-HU`

- SERP characteristics: research dominant features (FS, PAA, AI Overview, local pack).
- hreflang strategy: ensure reciprocal `hreflang` tags between locale variants
  and an `x-default` fallback; canonicalize per-locale.
- Currency, units, date formats: must match locale; mismatches kill CTR.
- Schema localization: translate `name`, `description`, and `inLanguage` fields;
  keep `@id` stable across locales.
- Search intent drift: head-term volume differs by locale; rebuild clusters per market.
- Cultural angle: terminology, examples, screenshots, social proof must localize.
- Internal linking: each locale has its own pillar set; never cross-link locales
  to dilute relevance signals.


#### Locale `de-DE`

- SERP characteristics: research dominant features (FS, PAA, AI Overview, local pack).
- hreflang strategy: ensure reciprocal `hreflang` tags between locale variants
  and an `x-default` fallback; canonicalize per-locale.
- Currency, units, date formats: must match locale; mismatches kill CTR.
- Schema localization: translate `name`, `description`, and `inLanguage` fields;
  keep `@id` stable across locales.
- Search intent drift: head-term volume differs by locale; rebuild clusters per market.
- Cultural angle: terminology, examples, screenshots, social proof must localize.
- Internal linking: each locale has its own pillar set; never cross-link locales
  to dilute relevance signals.


#### Locale `pl-PL`

- SERP characteristics: research dominant features (FS, PAA, AI Overview, local pack).
- hreflang strategy: ensure reciprocal `hreflang` tags between locale variants
  and an `x-default` fallback; canonicalize per-locale.
- Currency, units, date formats: must match locale; mismatches kill CTR.
- Schema localization: translate `name`, `description`, and `inLanguage` fields;
  keep `@id` stable across locales.
- Search intent drift: head-term volume differs by locale; rebuild clusters per market.
- Cultural angle: terminology, examples, screenshots, social proof must localize.
- Internal linking: each locale has its own pillar set; never cross-link locales
  to dilute relevance signals.


#### Locale `cs-CZ`

- SERP characteristics: research dominant features (FS, PAA, AI Overview, local pack).
- hreflang strategy: ensure reciprocal `hreflang` tags between locale variants
  and an `x-default` fallback; canonicalize per-locale.
- Currency, units, date formats: must match locale; mismatches kill CTR.
- Schema localization: translate `name`, `description`, and `inLanguage` fields;
  keep `@id` stable across locales.
- Search intent drift: head-term volume differs by locale; rebuild clusters per market.
- Cultural angle: terminology, examples, screenshots, social proof must localize.
- Internal linking: each locale has its own pillar set; never cross-link locales
  to dilute relevance signals.


#### Locale `sk-SK`

- SERP characteristics: research dominant features (FS, PAA, AI Overview, local pack).
- hreflang strategy: ensure reciprocal `hreflang` tags between locale variants
  and an `x-default` fallback; canonicalize per-locale.
- Currency, units, date formats: must match locale; mismatches kill CTR.
- Schema localization: translate `name`, `description`, and `inLanguage` fields;
  keep `@id` stable across locales.
- Search intent drift: head-term volume differs by locale; rebuild clusters per market.
- Cultural angle: terminology, examples, screenshots, social proof must localize.
- Internal linking: each locale has its own pillar set; never cross-link locales
  to dilute relevance signals.


#### Locale `fr-FR`

- SERP characteristics: research dominant features (FS, PAA, AI Overview, local pack).
- hreflang strategy: ensure reciprocal `hreflang` tags between locale variants
  and an `x-default` fallback; canonicalize per-locale.
- Currency, units, date formats: must match locale; mismatches kill CTR.
- Schema localization: translate `name`, `description`, and `inLanguage` fields;
  keep `@id` stable across locales.
- Search intent drift: head-term volume differs by locale; rebuild clusters per market.
- Cultural angle: terminology, examples, screenshots, social proof must localize.
- Internal linking: each locale has its own pillar set; never cross-link locales
  to dilute relevance signals.


#### Locale `es-ES`

- SERP characteristics: research dominant features (FS, PAA, AI Overview, local pack).
- hreflang strategy: ensure reciprocal `hreflang` tags between locale variants
  and an `x-default` fallback; canonicalize per-locale.
- Currency, units, date formats: must match locale; mismatches kill CTR.
- Schema localization: translate `name`, `description`, and `inLanguage` fields;
  keep `@id` stable across locales.
- Search intent drift: head-term volume differs by locale; rebuild clusters per market.
- Cultural angle: terminology, examples, screenshots, social proof must localize.
- Internal linking: each locale has its own pillar set; never cross-link locales
  to dilute relevance signals.


#### Locale `it-IT`

- SERP characteristics: research dominant features (FS, PAA, AI Overview, local pack).
- hreflang strategy: ensure reciprocal `hreflang` tags between locale variants
  and an `x-default` fallback; canonicalize per-locale.
- Currency, units, date formats: must match locale; mismatches kill CTR.
- Schema localization: translate `name`, `description`, and `inLanguage` fields;
  keep `@id` stable across locales.
- Search intent drift: head-term volume differs by locale; rebuild clusters per market.
- Cultural angle: terminology, examples, screenshots, social proof must localize.
- Internal linking: each locale has its own pillar set; never cross-link locales
  to dilute relevance signals.


----------------------------------------------------------------------------------------
SECTION F — SCENARIO DRILLS (200×)
----------------------------------------------------------------------------------------


##### Scenario 001 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 002 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 003 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 004 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 005 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 006 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 007 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 008 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 009 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 010 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 011 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 012 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 013 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 014 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 015 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 016 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 017 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 018 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 019 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 020 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 021 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 022 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 023 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 024 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 025 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 026 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 027 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 028 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 029 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 030 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 031 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 032 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 033 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 034 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 035 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 036 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 037 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 038 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 039 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 040 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 041 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 042 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 043 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 044 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 045 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 046 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 047 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 048 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 049 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 050 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 051 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 052 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 053 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 054 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 055 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 056 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 057 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 058 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 059 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 060 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 061 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 062 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 063 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 064 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 065 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 066 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 067 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 068 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 069 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 070 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 071 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 072 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 073 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 074 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 075 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 076 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 077 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 078 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 079 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 080 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 081 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 082 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 083 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 084 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 085 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 086 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 087 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 088 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 089 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 090 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 091 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 092 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 093 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 094 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 095 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 096 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 097 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 098 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 099 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 100 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 101 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 102 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 103 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 104 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 105 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 106 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 107 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 108 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 109 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 110 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 111 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 112 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 113 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 114 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 115 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 116 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 117 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 118 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 119 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 120 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 121 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 122 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 123 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 124 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 125 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 126 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 127 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 128 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 129 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 130 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 131 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 132 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 133 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 134 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 135 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 136 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 137 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 138 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 139 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 140 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 141 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 142 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 143 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 144 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 145 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 146 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 147 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 148 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 149 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 150 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 151 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 152 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 153 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 154 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 155 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 156 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 157 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 158 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 159 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 160 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 161 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 162 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 163 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 164 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 165 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 166 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 167 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 168 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 169 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 170 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 171 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 172 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 173 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 174 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 175 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 176 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 177 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 178 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 179 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 180 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 181 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 182 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 183 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 184 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 185 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 186 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 187 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 188 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 189 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 190 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 191 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 192 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 193 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 194 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 195 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 196 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 197 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 198 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 199 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


##### Scenario 200 — Number One Ranking Orchestrator operational drill

**Trigger.** A signal in the ranking_campaign domain crosses threshold
(example: indexation ratio drops > 5pp week-over-week, or a cluster's
median position regresses by 3+).

**Diagnose (≤ 30 min).**
- Confirm signal in two independent sources (GSC + crawler).
- Segment by template, locale, device, and traffic tier.
- Identify the smallest reproducible unit (URL, template, query class).

**Decide.**
- If revenue exposure ≥ €X / month → escalate to P0, page on-call SEO.
- Else classify P1-P3 per the decision tree below.

**Act.**
- Open ticket with: signal, scope, hypothesis, fix, rollback plan,
  verification method, KPI baseline, target, owner, ETA.
- Land minimal fix; schedule durable fix in next sprint if needed.

**Verify.**
- Re-run crawler on affected scope.
- Confirm signal returns to baseline within 1-2 crawl cycles.
- Close ticket with evidence links.

**Postmortem hook.**
- If P0/P1: write a 1-pager root cause, prevention, and codified guardrail.


----------------------------------------------------------------------------------------
SECTION G — CHECKLISTS LIBRARY
----------------------------------------------------------------------------------------

##### Checklist — Pre-flight before audit run

- [ ] GSC verified for all property variants (http, https, www, non-www).
- [ ] GA4 stream verified; conversions defined; bot filtering on.
- [ ] Crawler configured with realistic user-agent and JS rendering when needed.
- [ ] Sitemap fetched, parsed, and compared against discovered URLs.
- [ ] Robots.txt audited for unintended Disallow patterns.
- [ ] Locale variants enumerated; hreflang reciprocity confirmed.
- [ ] Baselines captured for every KPI in scope.

##### Checklist — Post-deploy SEO verification

- [ ] Re-crawl affected templates within 24h.
- [ ] Confirm canonical, hreflang, schema, and meta tags rendered as designed.
- [ ] Validate CWV on mobile + desktop for the affected templates.
- [ ] Spot-check 10 representative URLs in URL Inspection tool.
- [ ] Resubmit sitemap; request indexing for top-N pages.
- [ ] Verify analytics still fires; no regressions in events.
- [ ] Capture screenshots + HTML snapshots for the audit trail.

##### Checklist — Algorithm update response

- [ ] Annotate the date in the program timeline.
- [ ] Segment traffic by template, intent, and locale to localize impact.
- [ ] Compare top-loser pages against top-winner pages for pattern extraction.
- [ ] Resist over-reaction: wait at least 7-14 days for SERP volatility to settle.
- [ ] Document hypothesis, intervention, and result in a postmortem.

##### Checklist — Cross-agent handoff

- [ ] Findings tagged with downstream agent IDs.
- [ ] Severity normalized to global P0-P3 scale.
- [ ] Effort normalized to XS-XL.
- [ ] Conflicts flagged with a reconciliation note.
- [ ] All artifacts placed in the canonical output folder.


----------------------------------------------------------------------------------------
SECTION H — PROMPT SNIPPETS (50×)
----------------------------------------------------------------------------------------


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


```text
SYSTEM: You are the Number One Ranking Orchestrator. Operate strictly within scope:
end-to-end #1 ranking campaign for a single keyword/cluster. Output must follow the agent-output-schema JSON contract.

USER: Given the inputs below, produce findings (with severity P0-P3,
effort XS-XL, owner_type), quick_wins, risks, metrics, open_questions.

INPUTS:
  target_domain: {domain}
  market: {market}
  priority_objective: {objective}
  timeline: {timeline}
  data_sources: {sources}
  constraints: {constraints}

REQUIREMENTS:
  - No vague language. Every recommendation must be executable.
  - Each finding includes evidence and affected URLs.
  - Map every finding to a KPI from: target_keyword_position, serp_feature_capture, campaign_completion_pct, weeks_to_top3, weeks_to_top1.
  - Reject and re-ask if any required field is missing.
```


----------------------------------------------------------------------------------------
SECTION I — DECISION TREES
----------------------------------------------------------------------------------------


### Decision Tree — Ranking Campaign

```text
START
  │
  ├── Is the issue blocking discovery? ──► YES ──► classify P0 ──► Sprint 0
  │        │ NO
  │        ▼
  ├── Does it affect indexation of revenue pages? ──► YES ──► P1 ──► Sprint 1
  │        │ NO
  │        ▼
  ├── Does it cap a current ranking ceiling? ──► YES ──► P2 ──► Sprint 2
  │        │ NO
  │        ▼
  └── Is it a strategic moat investment? ──► YES ──► P3 ──► Sprint 3+
```


----------------------------------------------------------------------------------------
SECTION J — ANTI-PATTERNS LIBRARY (200×)
----------------------------------------------------------------------------------------

- **Anti-pattern 001.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 002.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 003.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 004.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 005.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 006.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 007.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 008.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 009.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 010.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 011.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 012.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 013.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 014.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 015.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 016.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 017.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 018.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 019.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 020.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 021.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 022.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 023.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 024.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 025.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 026.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 027.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 028.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 029.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 030.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 031.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 032.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 033.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 034.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 035.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 036.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 037.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 038.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 039.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 040.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 041.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 042.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 043.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 044.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 045.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 046.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 047.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 048.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 049.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 050.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 051.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 052.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 053.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 054.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 055.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 056.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 057.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 058.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 059.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 060.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 061.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 062.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 063.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 064.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 065.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 066.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 067.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 068.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 069.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 070.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 071.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 072.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 073.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 074.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 075.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 076.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 077.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 078.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 079.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 080.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 081.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 082.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 083.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 084.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 085.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 086.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 087.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 088.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 089.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 090.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 091.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 092.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 093.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 094.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 095.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 096.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 097.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 098.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 099.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 100.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 101.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 102.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 103.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 104.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 105.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 106.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 107.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 108.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 109.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 110.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 111.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 112.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 113.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 114.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 115.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 116.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 117.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 118.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 119.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 120.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 121.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 122.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 123.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 124.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 125.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 126.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 127.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 128.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 129.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 130.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 131.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 132.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 133.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 134.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 135.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 136.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 137.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 138.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 139.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 140.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 141.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 142.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 143.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 144.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 145.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 146.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 147.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 148.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 149.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 150.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 151.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 152.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 153.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 154.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 155.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 156.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 157.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 158.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 159.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 160.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 161.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 162.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 163.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 164.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 165.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 166.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 167.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 168.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 169.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 170.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 171.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 172.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 173.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 174.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 175.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 176.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 177.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 178.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 179.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 180.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 181.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 182.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 183.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 184.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 185.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 186.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 187.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 188.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 189.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 190.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 191.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 192.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 193.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 194.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 195.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 196.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 197.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 198.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 199.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.
- **Anti-pattern 200.** Treating a ranking_campaign symptom as a fix; always trace to root cause and codify a guardrail.

----------------------------------------------------------------------------------------
SECTION K — ORCHESTRATION CONTRACTS
----------------------------------------------------------------------------------------


#### Contract with — SEO Audit Agent

- **Input we send:** findings tagged with `consumer=audit`,
  including severity, evidence, affected URLs, and recommended next action.
- **Output we expect:** acknowledgement of receipt, scoped backlog
  updates, and a return signal once the dependent work is complete.
- **Conflict protocol:** if their conclusion contradicts ours, escalate
  to the Master Controller (00) with both evidence sets attached.
- **SLA:** P0 within 24h, P1 within 5 business days, P2 within 30 days,
  P3 within 90 days, all measured from handoff timestamp.


#### Contract with — Keyword Research Agent

- **Input we send:** findings tagged with `consumer=keywords`,
  including severity, evidence, affected URLs, and recommended next action.
- **Output we expect:** acknowledgement of receipt, scoped backlog
  updates, and a return signal once the dependent work is complete.
- **Conflict protocol:** if their conclusion contradicts ours, escalate
  to the Master Controller (00) with both evidence sets attached.
- **SLA:** P0 within 24h, P1 within 5 business days, P2 within 30 days,
  P3 within 90 days, all measured from handoff timestamp.


#### Contract with — On-Page Content Agent

- **Input we send:** findings tagged with `consumer=on_page`,
  including severity, evidence, affected URLs, and recommended next action.
- **Output we expect:** acknowledgement of receipt, scoped backlog
  updates, and a return signal once the dependent work is complete.
- **Conflict protocol:** if their conclusion contradicts ours, escalate
  to the Master Controller (00) with both evidence sets attached.
- **SLA:** P0 within 24h, P1 within 5 business days, P2 within 30 days,
  P3 within 90 days, all measured from handoff timestamp.


#### Contract with — Technical SEO Agent

- **Input we send:** findings tagged with `consumer=technical`,
  including severity, evidence, affected URLs, and recommended next action.
- **Output we expect:** acknowledgement of receipt, scoped backlog
  updates, and a return signal once the dependent work is complete.
- **Conflict protocol:** if their conclusion contradicts ours, escalate
  to the Master Controller (00) with both evidence sets attached.
- **SLA:** P0 within 24h, P1 within 5 business days, P2 within 30 days,
  P3 within 90 days, all measured from handoff timestamp.


#### Contract with — Internal Linking Agent

- **Input we send:** findings tagged with `consumer=linking`,
  including severity, evidence, affected URLs, and recommended next action.
- **Output we expect:** acknowledgement of receipt, scoped backlog
  updates, and a return signal once the dependent work is complete.
- **Conflict protocol:** if their conclusion contradicts ours, escalate
  to the Master Controller (00) with both evidence sets attached.
- **SLA:** P0 within 24h, P1 within 5 business days, P2 within 30 days,
  P3 within 90 days, all measured from handoff timestamp.


#### Contract with — Competitor SERP Agent

- **Input we send:** findings tagged with `consumer=competitors`,
  including severity, evidence, affected URLs, and recommended next action.
- **Output we expect:** acknowledgement of receipt, scoped backlog
  updates, and a return signal once the dependent work is complete.
- **Conflict protocol:** if their conclusion contradicts ours, escalate
  to the Master Controller (00) with both evidence sets attached.
- **SLA:** P0 within 24h, P1 within 5 business days, P2 within 30 days,
  P3 within 90 days, all measured from handoff timestamp.


#### Contract with — Topical Authority Agent

- **Input we send:** findings tagged with `consumer=authority`,
  including severity, evidence, affected URLs, and recommended next action.
- **Output we expect:** acknowledgement of receipt, scoped backlog
  updates, and a return signal once the dependent work is complete.
- **Conflict protocol:** if their conclusion contradicts ours, escalate
  to the Master Controller (00) with both evidence sets attached.
- **SLA:** P0 within 24h, P1 within 5 business days, P2 within 30 days,
  P3 within 90 days, all measured from handoff timestamp.


#### Contract with — Schema / E-E-A-T / LLM Agent

- **Input we send:** findings tagged with `consumer=schema_eeat`,
  including severity, evidence, affected URLs, and recommended next action.
- **Output we expect:** acknowledgement of receipt, scoped backlog
  updates, and a return signal once the dependent work is complete.
- **Conflict protocol:** if their conclusion contradicts ours, escalate
  to the Master Controller (00) with both evidence sets attached.
- **SLA:** P0 within 24h, P1 within 5 business days, P2 within 30 days,
  P3 within 90 days, all measured from handoff timestamp.


#### Contract with — Reporting & Action Plan Agent

- **Input we send:** findings tagged with `consumer=reporting`,
  including severity, evidence, affected URLs, and recommended next action.
- **Output we expect:** acknowledgement of receipt, scoped backlog
  updates, and a return signal once the dependent work is complete.
- **Conflict protocol:** if their conclusion contradicts ours, escalate
  to the Master Controller (00) with both evidence sets attached.
- **SLA:** P0 within 24h, P1 within 5 business days, P2 within 30 days,
  P3 within 90 days, all measured from handoff timestamp.


----------------------------------------------------------------------------------------
SECTION L — OUTPUT SCHEMA (CANONICAL)
----------------------------------------------------------------------------------------


```json
{
  "agent_name": "string",
  "scope": "string",
  "summary": "string",
  "findings": [{
    "id": "string",
    "title": "string",
    "severity": "P0|P1|P2|P3",
    "impact": "string",
    "confidence": 0.0,
    "evidence": ["string"],
    "affected_urls": ["string"],
    "recommendation": "string",
    "estimated_effort": "XS|S|M|L|XL",
    "dependencies": ["string"],
    "owner_type": "SEO|Content|Engineering|Design|Analytics|Product",
    "kpi_link": "string",
    "acceptance_criteria": "string",
    "verification_method": "string",
    "rollback_plan": "string"
  }],
  "quick_wins": ["string"],
  "risks": ["string"],
  "metrics": ["string"],
  "open_questions": ["string"]
}
```


----------------------------------------------------------------------------------------
SECTION M — EXAMPLES & WORKED OUTPUTS
----------------------------------------------------------------------------------------


##### Worked Example 01

- **Context.** Mid-market E-commerce site,
  ~6300 pages, en-GB primary locale.
- **Symptom.** Ranking_Campaign regression of ~6% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  canonical mismatch.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 02

- **Context.** Mid-market Marketplaces site,
  ~7600 pages, hu-HU primary locale.
- **Symptom.** Ranking_Campaign regression of ~9% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  redirect chain.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 03

- **Context.** Mid-market Local services site,
  ~8900 pages, de-DE primary locale.
- **Symptom.** Ranking_Campaign regression of ~12% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  hreflang break.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 04

- **Context.** Mid-market Healthcare site,
  ~10200 pages, pl-PL primary locale.
- **Symptom.** Ranking_Campaign regression of ~15% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  schema regression.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 05

- **Context.** Mid-market Legal site,
  ~11500 pages, cs-CZ primary locale.
- **Symptom.** Ranking_Campaign regression of ~18% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  noindex.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 06

- **Context.** Mid-market FinTech site,
  ~12800 pages, sk-SK primary locale.
- **Symptom.** Ranking_Campaign regression of ~21% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  canonical mismatch.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 07

- **Context.** Mid-market EdTech site,
  ~14100 pages, fr-FR primary locale.
- **Symptom.** Ranking_Campaign regression of ~4% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  redirect chain.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 08

- **Context.** Mid-market Real Estate site,
  ~15400 pages, es-ES primary locale.
- **Symptom.** Ranking_Campaign regression of ~7% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  hreflang break.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 09

- **Context.** Mid-market Travel site,
  ~16700 pages, it-IT primary locale.
- **Symptom.** Ranking_Campaign regression of ~10% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  schema regression.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 10

- **Context.** Mid-market Media & Publishing site,
  ~18000 pages, en-US primary locale.
- **Symptom.** Ranking_Campaign regression of ~13% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  noindex.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 11

- **Context.** Mid-market Manufacturing site,
  ~19300 pages, en-GB primary locale.
- **Symptom.** Ranking_Campaign regression of ~16% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  canonical mismatch.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 12

- **Context.** Mid-market DTC consumer goods site,
  ~20600 pages, hu-HU primary locale.
- **Symptom.** Ranking_Campaign regression of ~19% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  redirect chain.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 13

- **Context.** Mid-market Hospitality site,
  ~21900 pages, de-DE primary locale.
- **Symptom.** Ranking_Campaign regression of ~22% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  hreflang break.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 14

- **Context.** Mid-market Government & Nonprofit site,
  ~23200 pages, pl-PL primary locale.
- **Symptom.** Ranking_Campaign regression of ~5% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  schema regression.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 15

- **Context.** Mid-market Workforce / HR software (Effectime) site,
  ~24500 pages, cs-CZ primary locale.
- **Symptom.** Ranking_Campaign regression of ~8% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  noindex.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 16

- **Context.** Mid-market SaaS / B2B software site,
  ~25800 pages, sk-SK primary locale.
- **Symptom.** Ranking_Campaign regression of ~11% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  canonical mismatch.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 17

- **Context.** Mid-market E-commerce site,
  ~27100 pages, fr-FR primary locale.
- **Symptom.** Ranking_Campaign regression of ~14% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  redirect chain.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 18

- **Context.** Mid-market Marketplaces site,
  ~28400 pages, es-ES primary locale.
- **Symptom.** Ranking_Campaign regression of ~17% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  hreflang break.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 19

- **Context.** Mid-market Local services site,
  ~29700 pages, it-IT primary locale.
- **Symptom.** Ranking_Campaign regression of ~20% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  schema regression.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 20

- **Context.** Mid-market Healthcare site,
  ~31000 pages, en-US primary locale.
- **Symptom.** Ranking_Campaign regression of ~3% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  noindex.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 21

- **Context.** Mid-market Legal site,
  ~32300 pages, en-GB primary locale.
- **Symptom.** Ranking_Campaign regression of ~6% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  canonical mismatch.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 22

- **Context.** Mid-market FinTech site,
  ~33600 pages, hu-HU primary locale.
- **Symptom.** Ranking_Campaign regression of ~9% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  redirect chain.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 23

- **Context.** Mid-market EdTech site,
  ~34900 pages, de-DE primary locale.
- **Symptom.** Ranking_Campaign regression of ~12% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  hreflang break.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 24

- **Context.** Mid-market Real Estate site,
  ~36200 pages, pl-PL primary locale.
- **Symptom.** Ranking_Campaign regression of ~15% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  schema regression.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 25

- **Context.** Mid-market Travel site,
  ~37500 pages, cs-CZ primary locale.
- **Symptom.** Ranking_Campaign regression of ~18% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  noindex.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 26

- **Context.** Mid-market Media & Publishing site,
  ~38800 pages, sk-SK primary locale.
- **Symptom.** Ranking_Campaign regression of ~21% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  canonical mismatch.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 27

- **Context.** Mid-market Manufacturing site,
  ~40100 pages, fr-FR primary locale.
- **Symptom.** Ranking_Campaign regression of ~4% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  redirect chain.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 28

- **Context.** Mid-market DTC consumer goods site,
  ~41400 pages, es-ES primary locale.
- **Symptom.** Ranking_Campaign regression of ~7% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  hreflang break.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 29

- **Context.** Mid-market Hospitality site,
  ~42700 pages, it-IT primary locale.
- **Symptom.** Ranking_Campaign regression of ~10% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  schema regression.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 30

- **Context.** Mid-market Government & Nonprofit site,
  ~44000 pages, en-US primary locale.
- **Symptom.** Ranking_Campaign regression of ~13% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  noindex.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 31

- **Context.** Mid-market Workforce / HR software (Effectime) site,
  ~45300 pages, en-GB primary locale.
- **Symptom.** Ranking_Campaign regression of ~16% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  canonical mismatch.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 32

- **Context.** Mid-market SaaS / B2B software site,
  ~46600 pages, hu-HU primary locale.
- **Symptom.** Ranking_Campaign regression of ~19% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  redirect chain.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 33

- **Context.** Mid-market E-commerce site,
  ~47900 pages, de-DE primary locale.
- **Symptom.** Ranking_Campaign regression of ~22% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  hreflang break.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 34

- **Context.** Mid-market Marketplaces site,
  ~49200 pages, pl-PL primary locale.
- **Symptom.** Ranking_Campaign regression of ~5% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  schema regression.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 35

- **Context.** Mid-market Local services site,
  ~50500 pages, cs-CZ primary locale.
- **Symptom.** Ranking_Campaign regression of ~8% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  noindex.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 36

- **Context.** Mid-market Healthcare site,
  ~51800 pages, sk-SK primary locale.
- **Symptom.** Ranking_Campaign regression of ~11% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  canonical mismatch.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 37

- **Context.** Mid-market Legal site,
  ~53100 pages, fr-FR primary locale.
- **Symptom.** Ranking_Campaign regression of ~14% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  redirect chain.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 38

- **Context.** Mid-market FinTech site,
  ~54400 pages, es-ES primary locale.
- **Symptom.** Ranking_Campaign regression of ~17% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  hreflang break.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 3 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 39

- **Context.** Mid-market EdTech site,
  ~5700 pages, it-IT primary locale.
- **Symptom.** Ranking_Campaign regression of ~20% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  schema regression.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 1 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


##### Worked Example 40

- **Context.** Mid-market Real Estate site,
  ~7000 pages, en-US primary locale.
- **Symptom.** Ranking_Campaign regression of ~3% WoW.
- **Hypothesis.** Template-level change introduced an unintended
  noindex.
- **Fix.** Reverse the offending diff; add regression test; codify guardrail.
- **Result.** KPI returned to baseline within 2 crawl cycles.
- **Postmortem.** Logged in `governance/postmortems/`; guardrail added to CI.


----------------------------------------------------------------------------------------
SECTION N — GLOSSARY (EXTENDED)
----------------------------------------------------------------------------------------

- **Canonical** — Authoritative URL declared via `<link rel=canonical>` or HTTP header.
- **Crawl budget** — Number of URLs Googlebot will fetch from a site in a given period.
- **CWV** — Core Web Vitals — LCP, INP, CLS thresholds for UX quality.
- **E-E-A-T** — Experience, Expertise, Authoritativeness, Trustworthiness.
- **Entity** — Distinct concept Google maps in its Knowledge Graph.
- **Featured Snippet** — Position-zero answer block extracted from a page.
- **Hreflang** — Tag signaling language/region targeting for a URL.
- **Indexation ratio** — Indexed URLs ÷ submitted URLs.
- **Intent** — Why a user searched: informational, navigational, commercial, transactional.
- **KPI** — Key performance indicator with baseline, target, source, cadence, owner.
- **LLM citation** — An AI-generated answer that cites the page as a source.
- **Pillar** — Comprehensive page anchoring a topic cluster.
- **Schema** — Structured data markup (JSON-LD) describing entities.
- **Share of Voice** — Estimated traffic share among a defined competitor set.
- **Topical authority** — Demonstrated depth across an entire topic's entity graph.


----------------------------------------------------------------------------------------
SECTION O — RISK REGISTER
----------------------------------------------------------------------------------------

1. **Risk.** Algorithm volatility erodes ranking before sprint completion.
   **Mitigation.** Pre-flight checklist + post-deploy verification + on-call rotation.
2. **Risk.** Engineering capacity contention delays P0/P1 fixes.
   **Mitigation.** Pre-flight checklist + post-deploy verification + on-call rotation.
3. **Risk.** Locale launches diluting topical relevance without hreflang reciprocity.
   **Mitigation.** Pre-flight checklist + post-deploy verification + on-call rotation.
4. **Risk.** Schema regressions silently breaking rich results.
   **Mitigation.** Pre-flight checklist + post-deploy verification + on-call rotation.
5. **Risk.** Canonical drift after template refactor.
   **Mitigation.** Pre-flight checklist + post-deploy verification + on-call rotation.
6. **Risk.** Sitemap drift after route changes.
   **Mitigation.** Pre-flight checklist + post-deploy verification + on-call rotation.
7. **Risk.** Robots.txt overreach blocking critical paths.
   **Mitigation.** Pre-flight checklist + post-deploy verification + on-call rotation.
8. **Risk.** Author depublication breaking E-E-A-T continuity.
   **Mitigation.** Pre-flight checklist + post-deploy verification + on-call rotation.
9. **Risk.** Third-party script bloat tanking CWV.
   **Mitigation.** Pre-flight checklist + post-deploy verification + on-call rotation.
10. **Risk.** Tracking regression invalidating KPI baselines.
   **Mitigation.** Pre-flight checklist + post-deploy verification + on-call rotation.


----------------------------------------------------------------------------------------
SECTION P — SESSION RITUALS
----------------------------------------------------------------------------------------


**Session start (every run).**
1. Pull latest from canonical inputs (GSC, GA4, crawler).
2. Reconcile previous session's open findings; close stale ones.
3. Confirm KPI baselines are current.
4. Re-read `00_MASTER_CONTROLLER_PROMPT.md` for orchestration constraints.

**Session end (every run).**
1. Write the canonical artifacts to `SEO/outputs/`.
2. Update the dependency map.
3. Update the conflict log.
4. Update the program health score.
5. Notify dependent agents of new handoffs.


----------------------------------------------------------------------------------------
SECTION Q — APPENDIX: EXHAUSTIVE FINDING TEMPLATES (300×)
----------------------------------------------------------------------------------------


###### Finding Template 001

```yaml
id: F-RAN-0001
title: "<concise title>"
severity: P1
effort: S
confidence: 0.51
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/1"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 002

```yaml
id: F-RAN-0002
title: "<concise title>"
severity: P2
effort: M
confidence: 0.52
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/2"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 003

```yaml
id: F-RAN-0003
title: "<concise title>"
severity: P3
effort: L
confidence: 0.53
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/3"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 004

```yaml
id: F-RAN-0004
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.54
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/4"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 005

```yaml
id: F-RAN-0005
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.55
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/5"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 006

```yaml
id: F-RAN-0006
title: "<concise title>"
severity: P2
effort: S
confidence: 0.56
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/6"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 007

```yaml
id: F-RAN-0007
title: "<concise title>"
severity: P3
effort: M
confidence: 0.57
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/7"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 008

```yaml
id: F-RAN-0008
title: "<concise title>"
severity: P0
effort: L
confidence: 0.58
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/8"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 009

```yaml
id: F-RAN-0009
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.59
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/9"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 010

```yaml
id: F-RAN-0010
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.6
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/10"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 011

```yaml
id: F-RAN-0011
title: "<concise title>"
severity: P3
effort: S
confidence: 0.61
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/11"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 012

```yaml
id: F-RAN-0012
title: "<concise title>"
severity: P0
effort: M
confidence: 0.62
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/12"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 013

```yaml
id: F-RAN-0013
title: "<concise title>"
severity: P1
effort: L
confidence: 0.63
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/13"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 014

```yaml
id: F-RAN-0014
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.64
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/14"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 015

```yaml
id: F-RAN-0015
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.65
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/15"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 016

```yaml
id: F-RAN-0016
title: "<concise title>"
severity: P0
effort: S
confidence: 0.66
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/16"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 017

```yaml
id: F-RAN-0017
title: "<concise title>"
severity: P1
effort: M
confidence: 0.67
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/17"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 018

```yaml
id: F-RAN-0018
title: "<concise title>"
severity: P2
effort: L
confidence: 0.68
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/18"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 019

```yaml
id: F-RAN-0019
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.69
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/19"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 020

```yaml
id: F-RAN-0020
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.7
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/20"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 021

```yaml
id: F-RAN-0021
title: "<concise title>"
severity: P1
effort: S
confidence: 0.71
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/21"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 022

```yaml
id: F-RAN-0022
title: "<concise title>"
severity: P2
effort: M
confidence: 0.72
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/22"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 023

```yaml
id: F-RAN-0023
title: "<concise title>"
severity: P3
effort: L
confidence: 0.73
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/23"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 024

```yaml
id: F-RAN-0024
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.74
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/24"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 025

```yaml
id: F-RAN-0025
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.75
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/25"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 026

```yaml
id: F-RAN-0026
title: "<concise title>"
severity: P2
effort: S
confidence: 0.76
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/26"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 027

```yaml
id: F-RAN-0027
title: "<concise title>"
severity: P3
effort: M
confidence: 0.77
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/27"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 028

```yaml
id: F-RAN-0028
title: "<concise title>"
severity: P0
effort: L
confidence: 0.78
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/28"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 029

```yaml
id: F-RAN-0029
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.79
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/29"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 030

```yaml
id: F-RAN-0030
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.8
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/30"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 031

```yaml
id: F-RAN-0031
title: "<concise title>"
severity: P3
effort: S
confidence: 0.81
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/31"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 032

```yaml
id: F-RAN-0032
title: "<concise title>"
severity: P0
effort: M
confidence: 0.82
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/32"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 033

```yaml
id: F-RAN-0033
title: "<concise title>"
severity: P1
effort: L
confidence: 0.83
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/33"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 034

```yaml
id: F-RAN-0034
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.84
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/34"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 035

```yaml
id: F-RAN-0035
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.85
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/35"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 036

```yaml
id: F-RAN-0036
title: "<concise title>"
severity: P0
effort: S
confidence: 0.86
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/36"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 037

```yaml
id: F-RAN-0037
title: "<concise title>"
severity: P1
effort: M
confidence: 0.87
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/37"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 038

```yaml
id: F-RAN-0038
title: "<concise title>"
severity: P2
effort: L
confidence: 0.88
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/38"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 039

```yaml
id: F-RAN-0039
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.89
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/39"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 040

```yaml
id: F-RAN-0040
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.9
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/40"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 041

```yaml
id: F-RAN-0041
title: "<concise title>"
severity: P1
effort: S
confidence: 0.91
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/41"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 042

```yaml
id: F-RAN-0042
title: "<concise title>"
severity: P2
effort: M
confidence: 0.92
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/42"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 043

```yaml
id: F-RAN-0043
title: "<concise title>"
severity: P3
effort: L
confidence: 0.93
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/43"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 044

```yaml
id: F-RAN-0044
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.94
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/44"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 045

```yaml
id: F-RAN-0045
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.95
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/45"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 046

```yaml
id: F-RAN-0046
title: "<concise title>"
severity: P2
effort: S
confidence: 0.96
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/46"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 047

```yaml
id: F-RAN-0047
title: "<concise title>"
severity: P3
effort: M
confidence: 0.97
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/47"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 048

```yaml
id: F-RAN-0048
title: "<concise title>"
severity: P0
effort: L
confidence: 0.98
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/48"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 049

```yaml
id: F-RAN-0049
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.99
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/49"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 050

```yaml
id: F-RAN-0050
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.5
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/50"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 051

```yaml
id: F-RAN-0051
title: "<concise title>"
severity: P3
effort: S
confidence: 0.51
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/51"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 052

```yaml
id: F-RAN-0052
title: "<concise title>"
severity: P0
effort: M
confidence: 0.52
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/52"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 053

```yaml
id: F-RAN-0053
title: "<concise title>"
severity: P1
effort: L
confidence: 0.53
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/53"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 054

```yaml
id: F-RAN-0054
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.54
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/54"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 055

```yaml
id: F-RAN-0055
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.55
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/55"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 056

```yaml
id: F-RAN-0056
title: "<concise title>"
severity: P0
effort: S
confidence: 0.56
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/56"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 057

```yaml
id: F-RAN-0057
title: "<concise title>"
severity: P1
effort: M
confidence: 0.57
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/57"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 058

```yaml
id: F-RAN-0058
title: "<concise title>"
severity: P2
effort: L
confidence: 0.58
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/58"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 059

```yaml
id: F-RAN-0059
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.59
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/59"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 060

```yaml
id: F-RAN-0060
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.6
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/60"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 061

```yaml
id: F-RAN-0061
title: "<concise title>"
severity: P1
effort: S
confidence: 0.61
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/61"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 062

```yaml
id: F-RAN-0062
title: "<concise title>"
severity: P2
effort: M
confidence: 0.62
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/62"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 063

```yaml
id: F-RAN-0063
title: "<concise title>"
severity: P3
effort: L
confidence: 0.63
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/63"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 064

```yaml
id: F-RAN-0064
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.64
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/64"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 065

```yaml
id: F-RAN-0065
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.65
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/65"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 066

```yaml
id: F-RAN-0066
title: "<concise title>"
severity: P2
effort: S
confidence: 0.66
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/66"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 067

```yaml
id: F-RAN-0067
title: "<concise title>"
severity: P3
effort: M
confidence: 0.67
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/67"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 068

```yaml
id: F-RAN-0068
title: "<concise title>"
severity: P0
effort: L
confidence: 0.68
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/68"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 069

```yaml
id: F-RAN-0069
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.69
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/69"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 070

```yaml
id: F-RAN-0070
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.7
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/70"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 071

```yaml
id: F-RAN-0071
title: "<concise title>"
severity: P3
effort: S
confidence: 0.71
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/71"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 072

```yaml
id: F-RAN-0072
title: "<concise title>"
severity: P0
effort: M
confidence: 0.72
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/72"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 073

```yaml
id: F-RAN-0073
title: "<concise title>"
severity: P1
effort: L
confidence: 0.73
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/73"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 074

```yaml
id: F-RAN-0074
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.74
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/74"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 075

```yaml
id: F-RAN-0075
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.75
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/75"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 076

```yaml
id: F-RAN-0076
title: "<concise title>"
severity: P0
effort: S
confidence: 0.76
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/76"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 077

```yaml
id: F-RAN-0077
title: "<concise title>"
severity: P1
effort: M
confidence: 0.77
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/77"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 078

```yaml
id: F-RAN-0078
title: "<concise title>"
severity: P2
effort: L
confidence: 0.78
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/78"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 079

```yaml
id: F-RAN-0079
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.79
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/79"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 080

```yaml
id: F-RAN-0080
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.8
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/80"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 081

```yaml
id: F-RAN-0081
title: "<concise title>"
severity: P1
effort: S
confidence: 0.81
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/81"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 082

```yaml
id: F-RAN-0082
title: "<concise title>"
severity: P2
effort: M
confidence: 0.82
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/82"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 083

```yaml
id: F-RAN-0083
title: "<concise title>"
severity: P3
effort: L
confidence: 0.83
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/83"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 084

```yaml
id: F-RAN-0084
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.84
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/84"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 085

```yaml
id: F-RAN-0085
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.85
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/85"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 086

```yaml
id: F-RAN-0086
title: "<concise title>"
severity: P2
effort: S
confidence: 0.86
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/86"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 087

```yaml
id: F-RAN-0087
title: "<concise title>"
severity: P3
effort: M
confidence: 0.87
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/87"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 088

```yaml
id: F-RAN-0088
title: "<concise title>"
severity: P0
effort: L
confidence: 0.88
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/88"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 089

```yaml
id: F-RAN-0089
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.89
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/89"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 090

```yaml
id: F-RAN-0090
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.9
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/90"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 091

```yaml
id: F-RAN-0091
title: "<concise title>"
severity: P3
effort: S
confidence: 0.91
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/91"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 092

```yaml
id: F-RAN-0092
title: "<concise title>"
severity: P0
effort: M
confidence: 0.92
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/92"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 093

```yaml
id: F-RAN-0093
title: "<concise title>"
severity: P1
effort: L
confidence: 0.93
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/93"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 094

```yaml
id: F-RAN-0094
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.94
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/94"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 095

```yaml
id: F-RAN-0095
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.95
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/95"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 096

```yaml
id: F-RAN-0096
title: "<concise title>"
severity: P0
effort: S
confidence: 0.96
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/96"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 097

```yaml
id: F-RAN-0097
title: "<concise title>"
severity: P1
effort: M
confidence: 0.97
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/97"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 098

```yaml
id: F-RAN-0098
title: "<concise title>"
severity: P2
effort: L
confidence: 0.98
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/98"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 099

```yaml
id: F-RAN-0099
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.99
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/99"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 100

```yaml
id: F-RAN-0100
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.5
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/100"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 101

```yaml
id: F-RAN-0101
title: "<concise title>"
severity: P1
effort: S
confidence: 0.51
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/101"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 102

```yaml
id: F-RAN-0102
title: "<concise title>"
severity: P2
effort: M
confidence: 0.52
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/102"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 103

```yaml
id: F-RAN-0103
title: "<concise title>"
severity: P3
effort: L
confidence: 0.53
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/103"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 104

```yaml
id: F-RAN-0104
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.54
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/104"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 105

```yaml
id: F-RAN-0105
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.55
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/105"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 106

```yaml
id: F-RAN-0106
title: "<concise title>"
severity: P2
effort: S
confidence: 0.56
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/106"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 107

```yaml
id: F-RAN-0107
title: "<concise title>"
severity: P3
effort: M
confidence: 0.57
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/107"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 108

```yaml
id: F-RAN-0108
title: "<concise title>"
severity: P0
effort: L
confidence: 0.58
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/108"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 109

```yaml
id: F-RAN-0109
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.59
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/109"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 110

```yaml
id: F-RAN-0110
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.6
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/110"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 111

```yaml
id: F-RAN-0111
title: "<concise title>"
severity: P3
effort: S
confidence: 0.61
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/111"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 112

```yaml
id: F-RAN-0112
title: "<concise title>"
severity: P0
effort: M
confidence: 0.62
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/112"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 113

```yaml
id: F-RAN-0113
title: "<concise title>"
severity: P1
effort: L
confidence: 0.63
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/113"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 114

```yaml
id: F-RAN-0114
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.64
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/114"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 115

```yaml
id: F-RAN-0115
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.65
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/115"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 116

```yaml
id: F-RAN-0116
title: "<concise title>"
severity: P0
effort: S
confidence: 0.66
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/116"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 117

```yaml
id: F-RAN-0117
title: "<concise title>"
severity: P1
effort: M
confidence: 0.67
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/117"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 118

```yaml
id: F-RAN-0118
title: "<concise title>"
severity: P2
effort: L
confidence: 0.68
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/118"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 119

```yaml
id: F-RAN-0119
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.69
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/119"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 120

```yaml
id: F-RAN-0120
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.7
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/120"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 121

```yaml
id: F-RAN-0121
title: "<concise title>"
severity: P1
effort: S
confidence: 0.71
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/121"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 122

```yaml
id: F-RAN-0122
title: "<concise title>"
severity: P2
effort: M
confidence: 0.72
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/122"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 123

```yaml
id: F-RAN-0123
title: "<concise title>"
severity: P3
effort: L
confidence: 0.73
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/123"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 124

```yaml
id: F-RAN-0124
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.74
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/124"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 125

```yaml
id: F-RAN-0125
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.75
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/125"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 126

```yaml
id: F-RAN-0126
title: "<concise title>"
severity: P2
effort: S
confidence: 0.76
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/126"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 127

```yaml
id: F-RAN-0127
title: "<concise title>"
severity: P3
effort: M
confidence: 0.77
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/127"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 128

```yaml
id: F-RAN-0128
title: "<concise title>"
severity: P0
effort: L
confidence: 0.78
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/128"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 129

```yaml
id: F-RAN-0129
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.79
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/129"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 130

```yaml
id: F-RAN-0130
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.8
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/130"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 131

```yaml
id: F-RAN-0131
title: "<concise title>"
severity: P3
effort: S
confidence: 0.81
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/131"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 132

```yaml
id: F-RAN-0132
title: "<concise title>"
severity: P0
effort: M
confidence: 0.82
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/132"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 133

```yaml
id: F-RAN-0133
title: "<concise title>"
severity: P1
effort: L
confidence: 0.83
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/133"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 134

```yaml
id: F-RAN-0134
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.84
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/134"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 135

```yaml
id: F-RAN-0135
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.85
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/135"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 136

```yaml
id: F-RAN-0136
title: "<concise title>"
severity: P0
effort: S
confidence: 0.86
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/136"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 137

```yaml
id: F-RAN-0137
title: "<concise title>"
severity: P1
effort: M
confidence: 0.87
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/137"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 138

```yaml
id: F-RAN-0138
title: "<concise title>"
severity: P2
effort: L
confidence: 0.88
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/138"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 139

```yaml
id: F-RAN-0139
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.89
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/139"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 140

```yaml
id: F-RAN-0140
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.9
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/140"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 141

```yaml
id: F-RAN-0141
title: "<concise title>"
severity: P1
effort: S
confidence: 0.91
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/141"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 142

```yaml
id: F-RAN-0142
title: "<concise title>"
severity: P2
effort: M
confidence: 0.92
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/142"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 143

```yaml
id: F-RAN-0143
title: "<concise title>"
severity: P3
effort: L
confidence: 0.93
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/143"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 144

```yaml
id: F-RAN-0144
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.94
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/144"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 145

```yaml
id: F-RAN-0145
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.95
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/145"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 146

```yaml
id: F-RAN-0146
title: "<concise title>"
severity: P2
effort: S
confidence: 0.96
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/146"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 147

```yaml
id: F-RAN-0147
title: "<concise title>"
severity: P3
effort: M
confidence: 0.97
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/147"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 148

```yaml
id: F-RAN-0148
title: "<concise title>"
severity: P0
effort: L
confidence: 0.98
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/148"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 149

```yaml
id: F-RAN-0149
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.99
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/149"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 150

```yaml
id: F-RAN-0150
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.5
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/150"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 151

```yaml
id: F-RAN-0151
title: "<concise title>"
severity: P3
effort: S
confidence: 0.51
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/151"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 152

```yaml
id: F-RAN-0152
title: "<concise title>"
severity: P0
effort: M
confidence: 0.52
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/152"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 153

```yaml
id: F-RAN-0153
title: "<concise title>"
severity: P1
effort: L
confidence: 0.53
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/153"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 154

```yaml
id: F-RAN-0154
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.54
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/154"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 155

```yaml
id: F-RAN-0155
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.55
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/155"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 156

```yaml
id: F-RAN-0156
title: "<concise title>"
severity: P0
effort: S
confidence: 0.56
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/156"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 157

```yaml
id: F-RAN-0157
title: "<concise title>"
severity: P1
effort: M
confidence: 0.57
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/157"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 158

```yaml
id: F-RAN-0158
title: "<concise title>"
severity: P2
effort: L
confidence: 0.58
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/158"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 159

```yaml
id: F-RAN-0159
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.59
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/159"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 160

```yaml
id: F-RAN-0160
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.6
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/160"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 161

```yaml
id: F-RAN-0161
title: "<concise title>"
severity: P1
effort: S
confidence: 0.61
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/161"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 162

```yaml
id: F-RAN-0162
title: "<concise title>"
severity: P2
effort: M
confidence: 0.62
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/162"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 163

```yaml
id: F-RAN-0163
title: "<concise title>"
severity: P3
effort: L
confidence: 0.63
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/163"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 164

```yaml
id: F-RAN-0164
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.64
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/164"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 165

```yaml
id: F-RAN-0165
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.65
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/165"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 166

```yaml
id: F-RAN-0166
title: "<concise title>"
severity: P2
effort: S
confidence: 0.66
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/166"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 167

```yaml
id: F-RAN-0167
title: "<concise title>"
severity: P3
effort: M
confidence: 0.67
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/167"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 168

```yaml
id: F-RAN-0168
title: "<concise title>"
severity: P0
effort: L
confidence: 0.68
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/168"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 169

```yaml
id: F-RAN-0169
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.69
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/169"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 170

```yaml
id: F-RAN-0170
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.7
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/170"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 171

```yaml
id: F-RAN-0171
title: "<concise title>"
severity: P3
effort: S
confidence: 0.71
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/171"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 172

```yaml
id: F-RAN-0172
title: "<concise title>"
severity: P0
effort: M
confidence: 0.72
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/172"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 173

```yaml
id: F-RAN-0173
title: "<concise title>"
severity: P1
effort: L
confidence: 0.73
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/173"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 174

```yaml
id: F-RAN-0174
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.74
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/174"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 175

```yaml
id: F-RAN-0175
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.75
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/175"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 176

```yaml
id: F-RAN-0176
title: "<concise title>"
severity: P0
effort: S
confidence: 0.76
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/176"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 177

```yaml
id: F-RAN-0177
title: "<concise title>"
severity: P1
effort: M
confidence: 0.77
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/177"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 178

```yaml
id: F-RAN-0178
title: "<concise title>"
severity: P2
effort: L
confidence: 0.78
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/178"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 179

```yaml
id: F-RAN-0179
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.79
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/179"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 180

```yaml
id: F-RAN-0180
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.8
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/180"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 181

```yaml
id: F-RAN-0181
title: "<concise title>"
severity: P1
effort: S
confidence: 0.81
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/181"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 182

```yaml
id: F-RAN-0182
title: "<concise title>"
severity: P2
effort: M
confidence: 0.82
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/182"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 183

```yaml
id: F-RAN-0183
title: "<concise title>"
severity: P3
effort: L
confidence: 0.83
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/183"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 184

```yaml
id: F-RAN-0184
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.84
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/184"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 185

```yaml
id: F-RAN-0185
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.85
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/185"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 186

```yaml
id: F-RAN-0186
title: "<concise title>"
severity: P2
effort: S
confidence: 0.86
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/186"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 187

```yaml
id: F-RAN-0187
title: "<concise title>"
severity: P3
effort: M
confidence: 0.87
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/187"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 188

```yaml
id: F-RAN-0188
title: "<concise title>"
severity: P0
effort: L
confidence: 0.88
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/188"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 189

```yaml
id: F-RAN-0189
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.89
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/189"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 190

```yaml
id: F-RAN-0190
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.9
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/190"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 191

```yaml
id: F-RAN-0191
title: "<concise title>"
severity: P3
effort: S
confidence: 0.91
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/191"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 192

```yaml
id: F-RAN-0192
title: "<concise title>"
severity: P0
effort: M
confidence: 0.92
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/192"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 193

```yaml
id: F-RAN-0193
title: "<concise title>"
severity: P1
effort: L
confidence: 0.93
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/193"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 194

```yaml
id: F-RAN-0194
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.94
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/194"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 195

```yaml
id: F-RAN-0195
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.95
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/195"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 196

```yaml
id: F-RAN-0196
title: "<concise title>"
severity: P0
effort: S
confidence: 0.96
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/196"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 197

```yaml
id: F-RAN-0197
title: "<concise title>"
severity: P1
effort: M
confidence: 0.97
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/197"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 198

```yaml
id: F-RAN-0198
title: "<concise title>"
severity: P2
effort: L
confidence: 0.98
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/198"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 199

```yaml
id: F-RAN-0199
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.99
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/199"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 200

```yaml
id: F-RAN-0200
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.5
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/200"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 201

```yaml
id: F-RAN-0201
title: "<concise title>"
severity: P1
effort: S
confidence: 0.51
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/201"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 202

```yaml
id: F-RAN-0202
title: "<concise title>"
severity: P2
effort: M
confidence: 0.52
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/202"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 203

```yaml
id: F-RAN-0203
title: "<concise title>"
severity: P3
effort: L
confidence: 0.53
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/203"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 204

```yaml
id: F-RAN-0204
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.54
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/204"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 205

```yaml
id: F-RAN-0205
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.55
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/205"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 206

```yaml
id: F-RAN-0206
title: "<concise title>"
severity: P2
effort: S
confidence: 0.56
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/206"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 207

```yaml
id: F-RAN-0207
title: "<concise title>"
severity: P3
effort: M
confidence: 0.57
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/207"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 208

```yaml
id: F-RAN-0208
title: "<concise title>"
severity: P0
effort: L
confidence: 0.58
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/208"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 209

```yaml
id: F-RAN-0209
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.59
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/209"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 210

```yaml
id: F-RAN-0210
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.6
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/210"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 211

```yaml
id: F-RAN-0211
title: "<concise title>"
severity: P3
effort: S
confidence: 0.61
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/211"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 212

```yaml
id: F-RAN-0212
title: "<concise title>"
severity: P0
effort: M
confidence: 0.62
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/212"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 213

```yaml
id: F-RAN-0213
title: "<concise title>"
severity: P1
effort: L
confidence: 0.63
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/213"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 214

```yaml
id: F-RAN-0214
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.64
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/214"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 215

```yaml
id: F-RAN-0215
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.65
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/215"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 216

```yaml
id: F-RAN-0216
title: "<concise title>"
severity: P0
effort: S
confidence: 0.66
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/216"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 217

```yaml
id: F-RAN-0217
title: "<concise title>"
severity: P1
effort: M
confidence: 0.67
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/217"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 218

```yaml
id: F-RAN-0218
title: "<concise title>"
severity: P2
effort: L
confidence: 0.68
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/218"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 219

```yaml
id: F-RAN-0219
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.69
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/219"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 220

```yaml
id: F-RAN-0220
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.7
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/220"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 221

```yaml
id: F-RAN-0221
title: "<concise title>"
severity: P1
effort: S
confidence: 0.71
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/221"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 222

```yaml
id: F-RAN-0222
title: "<concise title>"
severity: P2
effort: M
confidence: 0.72
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/222"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 223

```yaml
id: F-RAN-0223
title: "<concise title>"
severity: P3
effort: L
confidence: 0.73
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/223"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 224

```yaml
id: F-RAN-0224
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.74
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/224"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 225

```yaml
id: F-RAN-0225
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.75
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/225"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 226

```yaml
id: F-RAN-0226
title: "<concise title>"
severity: P2
effort: S
confidence: 0.76
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/226"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 227

```yaml
id: F-RAN-0227
title: "<concise title>"
severity: P3
effort: M
confidence: 0.77
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/227"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 228

```yaml
id: F-RAN-0228
title: "<concise title>"
severity: P0
effort: L
confidence: 0.78
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/228"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 229

```yaml
id: F-RAN-0229
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.79
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/229"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 230

```yaml
id: F-RAN-0230
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.8
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/230"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 231

```yaml
id: F-RAN-0231
title: "<concise title>"
severity: P3
effort: S
confidence: 0.81
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/231"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 232

```yaml
id: F-RAN-0232
title: "<concise title>"
severity: P0
effort: M
confidence: 0.82
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/232"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 233

```yaml
id: F-RAN-0233
title: "<concise title>"
severity: P1
effort: L
confidence: 0.83
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/233"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 234

```yaml
id: F-RAN-0234
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.84
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/234"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 235

```yaml
id: F-RAN-0235
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.85
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/235"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 236

```yaml
id: F-RAN-0236
title: "<concise title>"
severity: P0
effort: S
confidence: 0.86
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/236"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 237

```yaml
id: F-RAN-0237
title: "<concise title>"
severity: P1
effort: M
confidence: 0.87
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/237"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 238

```yaml
id: F-RAN-0238
title: "<concise title>"
severity: P2
effort: L
confidence: 0.88
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/238"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 239

```yaml
id: F-RAN-0239
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.89
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/239"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 240

```yaml
id: F-RAN-0240
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.9
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/240"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 241

```yaml
id: F-RAN-0241
title: "<concise title>"
severity: P1
effort: S
confidence: 0.91
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/241"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 242

```yaml
id: F-RAN-0242
title: "<concise title>"
severity: P2
effort: M
confidence: 0.92
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/242"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 243

```yaml
id: F-RAN-0243
title: "<concise title>"
severity: P3
effort: L
confidence: 0.93
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/243"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 244

```yaml
id: F-RAN-0244
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.94
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/244"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 245

```yaml
id: F-RAN-0245
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.95
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/245"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 246

```yaml
id: F-RAN-0246
title: "<concise title>"
severity: P2
effort: S
confidence: 0.96
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/246"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 247

```yaml
id: F-RAN-0247
title: "<concise title>"
severity: P3
effort: M
confidence: 0.97
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/247"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 248

```yaml
id: F-RAN-0248
title: "<concise title>"
severity: P0
effort: L
confidence: 0.98
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/248"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 249

```yaml
id: F-RAN-0249
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.99
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/249"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 250

```yaml
id: F-RAN-0250
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.5
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/250"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 251

```yaml
id: F-RAN-0251
title: "<concise title>"
severity: P3
effort: S
confidence: 0.51
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/251"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 252

```yaml
id: F-RAN-0252
title: "<concise title>"
severity: P0
effort: M
confidence: 0.52
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/252"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 253

```yaml
id: F-RAN-0253
title: "<concise title>"
severity: P1
effort: L
confidence: 0.53
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/253"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 254

```yaml
id: F-RAN-0254
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.54
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/254"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 255

```yaml
id: F-RAN-0255
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.55
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/255"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 256

```yaml
id: F-RAN-0256
title: "<concise title>"
severity: P0
effort: S
confidence: 0.56
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/256"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 257

```yaml
id: F-RAN-0257
title: "<concise title>"
severity: P1
effort: M
confidence: 0.57
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/257"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 258

```yaml
id: F-RAN-0258
title: "<concise title>"
severity: P2
effort: L
confidence: 0.58
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/258"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 259

```yaml
id: F-RAN-0259
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.59
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/259"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 260

```yaml
id: F-RAN-0260
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.6
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/260"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 261

```yaml
id: F-RAN-0261
title: "<concise title>"
severity: P1
effort: S
confidence: 0.61
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/261"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 262

```yaml
id: F-RAN-0262
title: "<concise title>"
severity: P2
effort: M
confidence: 0.62
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/262"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 263

```yaml
id: F-RAN-0263
title: "<concise title>"
severity: P3
effort: L
confidence: 0.63
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/263"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 264

```yaml
id: F-RAN-0264
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.64
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/264"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 265

```yaml
id: F-RAN-0265
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.65
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/265"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 266

```yaml
id: F-RAN-0266
title: "<concise title>"
severity: P2
effort: S
confidence: 0.66
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/266"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 267

```yaml
id: F-RAN-0267
title: "<concise title>"
severity: P3
effort: M
confidence: 0.67
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/267"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 268

```yaml
id: F-RAN-0268
title: "<concise title>"
severity: P0
effort: L
confidence: 0.68
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/268"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 269

```yaml
id: F-RAN-0269
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.69
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/269"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 270

```yaml
id: F-RAN-0270
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.7
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/270"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 271

```yaml
id: F-RAN-0271
title: "<concise title>"
severity: P3
effort: S
confidence: 0.71
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/271"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 272

```yaml
id: F-RAN-0272
title: "<concise title>"
severity: P0
effort: M
confidence: 0.72
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/272"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 273

```yaml
id: F-RAN-0273
title: "<concise title>"
severity: P1
effort: L
confidence: 0.73
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/273"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 274

```yaml
id: F-RAN-0274
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.74
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/274"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 275

```yaml
id: F-RAN-0275
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.75
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/275"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 276

```yaml
id: F-RAN-0276
title: "<concise title>"
severity: P0
effort: S
confidence: 0.76
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/276"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 277

```yaml
id: F-RAN-0277
title: "<concise title>"
severity: P1
effort: M
confidence: 0.77
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/277"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 278

```yaml
id: F-RAN-0278
title: "<concise title>"
severity: P2
effort: L
confidence: 0.78
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/278"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 279

```yaml
id: F-RAN-0279
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.79
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/279"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 280

```yaml
id: F-RAN-0280
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.8
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/280"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 281

```yaml
id: F-RAN-0281
title: "<concise title>"
severity: P1
effort: S
confidence: 0.81
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/281"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 282

```yaml
id: F-RAN-0282
title: "<concise title>"
severity: P2
effort: M
confidence: 0.82
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/282"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 283

```yaml
id: F-RAN-0283
title: "<concise title>"
severity: P3
effort: L
confidence: 0.83
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/283"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 284

```yaml
id: F-RAN-0284
title: "<concise title>"
severity: P0
effort: XL
confidence: 0.84
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/284"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 285

```yaml
id: F-RAN-0285
title: "<concise title>"
severity: P1
effort: XS
confidence: 0.85
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/285"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 286

```yaml
id: F-RAN-0286
title: "<concise title>"
severity: P2
effort: S
confidence: 0.86
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/286"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 287

```yaml
id: F-RAN-0287
title: "<concise title>"
severity: P3
effort: M
confidence: 0.87
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/287"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 288

```yaml
id: F-RAN-0288
title: "<concise title>"
severity: P0
effort: L
confidence: 0.88
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/288"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 289

```yaml
id: F-RAN-0289
title: "<concise title>"
severity: P1
effort: XL
confidence: 0.89
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/289"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 290

```yaml
id: F-RAN-0290
title: "<concise title>"
severity: P2
effort: XS
confidence: 0.9
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/290"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 291

```yaml
id: F-RAN-0291
title: "<concise title>"
severity: P3
effort: S
confidence: 0.91
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/291"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 292

```yaml
id: F-RAN-0292
title: "<concise title>"
severity: P0
effort: M
confidence: 0.92
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/292"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 293

```yaml
id: F-RAN-0293
title: "<concise title>"
severity: P1
effort: L
confidence: 0.93
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/293"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 294

```yaml
id: F-RAN-0294
title: "<concise title>"
severity: P2
effort: XL
confidence: 0.94
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/294"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


###### Finding Template 295

```yaml
id: F-RAN-0295
title: "<concise title>"
severity: P3
effort: XS
confidence: 0.95
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/295"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Content"
dependencies: []
```


###### Finding Template 296

```yaml
id: F-RAN-0296
title: "<concise title>"
severity: P0
effort: S
confidence: 0.96
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/296"
recommendation: "<imperative action>"
kpi_link: "serp_feature_capture"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Engineering"
dependencies: []
```


###### Finding Template 297

```yaml
id: F-RAN-0297
title: "<concise title>"
severity: P1
effort: M
confidence: 0.97
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/297"
recommendation: "<imperative action>"
kpi_link: "campaign_completion_pct"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Design"
dependencies: []
```


###### Finding Template 298

```yaml
id: F-RAN-0298
title: "<concise title>"
severity: P2
effort: L
confidence: 0.98
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/298"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top3"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Analytics"
dependencies: []
```


###### Finding Template 299

```yaml
id: F-RAN-0299
title: "<concise title>"
severity: P3
effort: XL
confidence: 0.99
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/299"
recommendation: "<imperative action>"
kpi_link: "weeks_to_top1"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "Product"
dependencies: []
```


###### Finding Template 300

```yaml
id: F-RAN-0300
title: "<concise title>"
severity: P0
effort: XS
confidence: 0.5
evidence:
  - "<url or screenshot>"
  - "<crawler log line>"
affected_urls:
  - "/example/path/300"
recommendation: "<imperative action>"
kpi_link: "target_keyword_position"
acceptance_criteria: "Within N days, KPI returns to baseline ±X%."
verification_method: "Re-crawl + GSC URL inspection + KPI dashboard."
rollback_plan: "Revert commit <sha>; re-deploy template <name>."
owner_type: "SEO"
dependencies: []
```


========================================================================================
END OF DEEP EXPANSION
========================================================================================

