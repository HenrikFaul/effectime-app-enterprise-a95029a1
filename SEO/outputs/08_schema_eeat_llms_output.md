# Schema / E-E-A-T / LLMs Agent — Output
# effectime.app | 2026-05-23

## 1. Schema Recommendations by Page Type

### 1A. Landing Page (effectime.app/)

**Schema types:** `Organization`, `WebSite`, `SoftwareApplication`, `FAQPage`  
**Implementation priority:** IMMEDIATE — zero structured data currently, only crawlable page.

---

**Organization schema:**
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Effectime",
  "url": "https://effectime.app",
  "logo": "https://effectime.app/effectime-favicon.svg",
  "description": "Magyar fejlesztésű workforce management szoftver kis- és középvállalkozásoknak — műszakbeosztás, kapacitástervezés, szabadságkezelés és CRM-beágyazás.",
  "foundingLocation": {
    "@type": "Place",
    "addressCountry": "HU",
    "addressLocality": "Budapest"
  },
  "areaServed": ["HU", "CZ", "SK", "PL"],
  "sameAs": [
    "https://www.linkedin.com/company/effectime",
    "https://twitter.com/Effectime"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "sales",
    "availableLanguage": ["Hungarian", "English"]
  }
}
```

---

**WebSite schema (enables Sitelinks Searchbox):**
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Effectime",
  "url": "https://effectime.app",
  "inLanguage": "hu",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://effectime.app/hu/blog?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

---

**SoftwareApplication schema:**
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Effectime",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "WorkforceManagement",
  "operatingSystem": "Web, iOS, Android (PWA)",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "HUF",
    "description": "Ingyenes csomag elérhető; Enterprise ajánlat egyedi árazással."
  },
  "description": "Effectime: műszakbeosztás, kapacitástervezés, szabadságkezelés és CRM-beágyazás egységes platformon. Magyar fejlesztésű, KKV-knak optimalizált workforce management szoftver.",
  "featureList": [
    "Műszakbeosztás-kezelés",
    "Kapacitástervezés",
    "Szabadságkezelés és jóváhagyás",
    "CRM Embed SDK",
    "Microsoft 365 szinkronizáció",
    "Irodai létszám-követés",
    "Jóváhagyási lánc",
    "Viszonteladói portál"
  ],
  "url": "https://effectime.app",
  "inLanguage": "hu",
  "audience": {
    "@type": "Audience",
    "audienceType": "HR managers, operations managers, team leads at Hungarian SMEs"
  }
}
```

---

**FAQPage schema (landing page):**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Mi az Effectime és kinek szól?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Az Effectime egy magyar fejlesztésű workforce management szoftver, amely 30–150 fős kis- és középvállalkozásoknak segít a műszakbeosztás, kapacitástervezés és szabadságkezelés digitalizálásában."
      }
    },
    {
      "@type": "Question",
      "name": "Ingyenesen kipróbálható az Effectime?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Igen. Az Effectime freemium modellben működik: az alapfunkciók ingyenesen elérhetők, az enterprise funkciókhoz előfizetés szükséges."
      }
    },
    {
      "@type": "Question",
      "name": "Hogyan különbözik az Effectime a többi HR szoftvertől?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Az Effectime natív magyar termék. Egyedi funkciója a CRM Embed SDK, amely lehetővé teszi, hogy a beosztás- és kapacitásadatok közvetlenül megjelenjenek a partnerek CRM rendszerében — iframe-beágyazással, külön belépés nélkül."
      }
    },
    {
      "@type": "Question",
      "name": "Milyen rendszerekkel integrálható az Effectime?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Az Effectime integrálható Microsoft 365 naptárral, és a CRM Embed SDK segítségével bármilyen CRM vagy operációs portálba beágyazható — iframe token alapján, nincs szükség API-fejlesztésre."
      }
    },
    {
      "@type": "Question",
      "name": "Megfelel-e az Effectime a magyar munkajogi előírásoknak?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Az Effectime a magyar Munka Törvénykönyvével (Mt.) összhangban kezeli a távolléti napokat, a szabadságkeretet és a műszakbeosztást. A nyilvántartás digitálisan auditálható és exportálható."
      }
    }
  ]
}
```

---

### 1B. Feature / Product Pages

**Schema types:** `SoftwareApplication` (narrowed) + `BreadcrumbList`

**Example: Műszakbeosztás feature page:**
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Effectime Műszakbeosztás",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "ShiftScheduling",
  "description": "Heti műszakbeosztás-kezelés irodánként, automatikus értesítésekkel, lefedettség-ellenőrzéssel és jóváhagyási lánccal.",
  "isPartOf": { "@type": "SoftwareApplication", "name": "Effectime", "url": "https://effectime.app" },
  "featureList": [
    "Heti beosztási rács irodánként",
    "Automatikus értesítések",
    "Lefedettség-ellenőrzés jóváhagyás előtt",
    "Szabadság és távolléti integráció",
    "CRM beágyazás (Embed SDK)"
  ],
  "url": "https://effectime.app/hu/muszakbeosztás"
}
```

**BreadcrumbList (add to every feature/cluster page):**
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Főoldal", "item": "https://effectime.app" },
    { "@type": "ListItem", "position": 2, "name": "Funkciók", "item": "https://effectime.app/hu/funkciok" },
    { "@type": "ListItem", "position": 3, "name": "Műszakbeosztás", "item": "https://effectime.app/hu/muszakbeosztás" }
  ]
}
```

---

### 1C. Blog / Article Pages

**Schema types:** `Article`, `Person` (author), `Organization` (publisher)

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Műszakbeosztás és a magyar munkajog: amit tudnod kell 2026-ban",
  "description": "A Munka Törvénykönyve alapján összefoglaltuk a műszakbeosztásra vonatkozó legfontosabb szabályokat.",
  "datePublished": "2026-08-15",
  "dateModified": "2026-08-15",
  "author": {
    "@type": "Person",
    "name": "Faul Henrik",
    "url": "https://effectime.app/hu/szerzok/faul-henrik",
    "jobTitle": "Effectime alapítója",
    "sameAs": "https://www.linkedin.com/in/[founder-linkedin-slug]"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Effectime",
    "logo": { "@type": "ImageObject", "url": "https://effectime.app/effectime-favicon.svg" }
  },
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://effectime.app/hu/blog/muszakbeosztás-munkajog-2026" },
  "inLanguage": "hu",
  "keywords": "műszakbeosztás, munkajog, Munka Törvénykönyve, munkaidő-beosztás Magyarország"
}
```

---

### 1D. Comparison Pages

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Effectime vs. Excel — Műszakbeosztás és HR kezelés összehasonlítása",
  "description": "Részletes összehasonlítás: miben különbözik az Effectime a táblázat-alapú HR kezeléstől, mikor érdemes váltani.",
  "url": "https://effectime.app/hu/hasonlitas/effectime-vs-excel",
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Effectime", "url": "https://effectime.app" },
      { "@type": "ListItem", "position": 2, "name": "Microsoft Excel" }
    ]
  }
}
```

---

### 1E. Glossary Pages

```json
{
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  "name": "Workforce Management Fogalomtár — Effectime",
  "url": "https://effectime.app/hu/fogalomtar",
  "hasDefinedTerm": [
    {
      "@type": "DefinedTerm",
      "name": "Műszakbeosztás",
      "description": "A munkavállalók munkaidejének, munkanaprendi sorrendjének előre tervezett meghatározása — általában heti vagy havi ciklusokban.",
      "url": "https://effectime.app/hu/fogalomtar/muszakbeosztás"
    },
    {
      "@type": "DefinedTerm",
      "name": "Kapacitástervezés",
      "description": "A rendelkezésre álló munkaerő-kapacitás és az elvárt terhelés összehangolásának folyamata.",
      "url": "https://effectime.app/hu/fogalomtar/kapacitastervezes"
    }
  ]
}
```

---

## 2. Trust Signal Plan — E-E-A-T

### Missing E-E-A-T Signals (Current State)

| Signal | Status | Priority |
|--------|--------|----------|
| Author bylines on content | Missing | CRITICAL |
| About / Company page | Missing | CRITICAL |
| Team page with real names | Missing | HIGH |
| Client testimonials | Missing | HIGH |
| Case studies | Missing | HIGH |
| Security / Data policy page | Missing | HIGH |
| `html lang="hu"` | Wrong (is "en") | CRITICAL |
| Google Business Profile | Unknown | HIGH |

---

### Trust Pages to Create

**`/hu/rolunk` (About page)** — Priority 1
- Founding story — why Effectime was built (specific operational problem)
- Mission statement in operational language
- Founded: year, location (Budapest)
- Team section
- Client/workspace count (if publishable)
- Schema: `AboutPage` + `Organization`

**`/hu/csapat` (Team page)** — Priority 1
- Founder bio (Faul Henrik): name, photo, role, LinkedIn, background
- Schema: `Person` for each member

**`/hu/biztonsag` (Security page)** — Priority 1
- Data hosting (EU servers)
- GDPR compliance statement
- Access control (token-based embed security)
- SOC 2 status (v3.12.0 Security Center exists per changelog)
- Schema: `WebPage` with `about` → security

**`/hu/adatvédelem` + `/hu/aszf`** — Priority 1
- Full GDPR-compliant privacy policy and terms in Hungarian
- Legal compliance AND trust signal

**`/hu/esettanulmanyok` (Case Studies)** — Priority 2
Format for each case study:
- Cím: [Cég neve vagy típusa] — [eredmény egy mondatban]
- Iparág / Méret / Kihívás / Megoldás / Eredmény / Idézet
- HU market note: anonymized references acceptable ("30 fős optikai üzletlánc")

**`/hu/velemenyek` (Testimonials)** — Priority 2
- 3–5 testimonials with: name, title, company/industry, photo if available
- Schema: `Review` + `Person`

---

### Author Bio Requirements

Every blog post must have:
- Author name (real, not "Effectime csapata")
- Author title (Founder / HR Szakértő)
- Author photo
- Short bio (2–3 sentences — specific expertise, not generic)
- LinkedIn URL
- Link to author page (`/hu/szerzok/[nev]`)

**Author page schema:**
```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Faul Henrik",
  "jobTitle": "Effectime alapítója és CEO",
  "url": "https://effectime.app/hu/szerzok/faul-henrik",
  "image": "https://effectime.app/images/team/faul-henrik.jpg",
  "sameAs": ["https://www.linkedin.com/in/[slug]", "https://twitter.com/[handle]"],
  "worksFor": { "@type": "Organization", "name": "Effectime", "url": "https://effectime.app" },
  "knowsAbout": ["Workforce management", "Műszakbeosztás", "HR digitalizáció", "KKV operációs folyamatok"],
  "description": "Faul Henrik az Effectime alapítója. KKV-k operációs és HR-folyamatainak digitalizálásával foglalkozik. Az Effectime-t azért hozta létre, mert a hazai KKV-k nagy részénél a munkaerő-koordináció még mindig Excelben zajlik."
}
```

---

### Industry Certifications Relevant to HU HR Market

| Association / Certification | Relevance | Action |
|----------------------------|-----------|----|
| MKIK (Iparkamara) | SME credibility | Member registration; display badge |
| IVSZ (IT/SaaS Association) | SaaS credibility | Member application; listed in HU software directory |
| GDPR certification / ISO 27001 | Data trust | Medium-term — year 2 |
| SOC 2 Type II | Enterprise trust | v3.12.0 indicates Security Center exists; document + display |
| Made in Hungary badge | HU native product signal | KIFÜ program |

---

## 3. LLM SEO / AI Overview Optimization

### Content Structuring for LLM Extractability

LLMs extract content that is:
1. **Definitionally precise** — starts with a clear one-sentence definition
2. **Structurally clear** — H2/H3 hierarchy, bullet lists, numbered steps
3. **Source-credible** — clear authorship and About page
4. **Factually specific** — numbers, named laws, named products
5. **Answer-complete** — the answer to the query is fully contained in one section

**Content pattern — "DEAR" framework:**
```
D — Definition (Mi a [fogalom]?)
E — Explanation (Hogyan működik a gyakorlatban?)
A — Application (Mikor releváns, ki használja?)
R — Resource or Reference (Mire hivatkozz: jogszabály, számítás, eszköz)
```

---

### Target AI Overview Queries

| Query | Target Page | Format |
|-------|------------|--------|
| `mi a legjobb műszakbeosztó szoftver Magyarországon` | Pillar P1 + Roundup C1.8 | Numbered list + comparison table |
| `hogyan kell műszakbeosztást készíteni` | C1.3 | Numbered steps (5-step guide) |
| `szabadságkezelés szoftver KKV` | Pillar P3 | Definition → features → pricing → CTA |
| `kapacitástervezés HR` | Pillar P2 | Definition → why it matters → how to → tool |
| `HR szoftver Magyarország` | Pillar P4 | Category definition → comparison → recommendation |
| `CRM HR integráció` | Pillar P5 | Definition → use case → implementation → security |

---

### FAQ Patterns for AI Overview Capture

**Pattern 1 — Definition anchor:**
```
Q: Mi a műszakbeosztás?
A: A műszakbeosztás a munkavállalók munkaidejének, munkanapjainak és munkaköreinek
   előre tervezett, dokumentált meghatározása — általában heti vagy havi ciklusokban.
   A Munka Törvénykönyve (Mt. 96–99. §) meghatározza a kötelező nyilvántartási szabályokat.
```

**Pattern 2 — Comparison anchor:**
```
Q: Mi a különbség az Effectime és az Excel között?
A: Excelben manuálisan frissíteni kell minden változást, nincs automatikus értesítés,
   és nem látszik valós időben a lefedettségi állapot. Az Effectime automatikusan kezeli
   a jóváhagyásokat, értesíti az érintetteket, és a kapacitástervező nézeten azonnal
   megmutatja, ha egy műszak fedetlenül marad.
```

**Pattern 3 — Action anchor (highest AI Overview capture):**
```
Q: Hogyan vezessek be műszakbeosztó szoftvert?
A: 1) Térképezd fel a jelenlegi folyamatot (beosztó, jóváhagyó, értesítési út).
   2) Határozd meg a telephelyek és munkavállalók körét.
   3) Importáld a meglévő beosztási adatokat.
   4) Állítsd be a jóváhagyási láncat és értesítési szabályokat.
   5) Próbaidőszak: az első heti beosztás az új rendszerben.
```

---

### DEAR Content Structure Template

Every pillar page section:

```markdown
## Mi a kapacitástervezés? [DEFINITION]

A kapacitástervezés a rendelkezésre álló munkaerő és az elvárt terhelés
összehangolásának folyamata — napi, heti vagy szezonális szinten.

[EXPLANATION]
A kapacitástervezés nem ugyanaz, mint a fejlécek számolgatása.
Egy 50 fős cégnél, ahol 3 telephely működik, a kapacitás naponta változik
a távollétek, betegségek és szezonális igények miatt. Ha nincs valós idejű
láthatóság, a vezető csak utólag értesül a lefedettségi hiányokról.

[EXAMPLE]
Példa: egy 5 telephelyes optikai üzletlánc HR menedzsere minden reggel
egyenként telefonál az irodavezetőknek. Ez napi 45 percet visz el — havonta
~15 munkaórát. Az Effectime kapacitástervező nézete ezt egyetlen dashboardon
jeleníti meg.

[CTA]
→ Próbáld ki az Effectime kapacitástervező modulját [Ingyenes próba indítása]
```

---

## 4. Entity Clarity Plan

### Organization Entity Definition

| Field | Value |
|-------|-------|
| **Name** | Effectime (consistent — no variations) |
| **Type** | Software company / SaaS product |
| **Location** | Budapest, Hungary |
| **Description (HU)** | Magyar fejlesztésű workforce management szoftver KKV-knak — műszakbeosztás, kapacitástervezés, szabadságkezelés és CRM-beágyazás. |
| **Description (EN)** | Hungarian-built workforce management software for SMEs — shift scheduling, capacity planning, leave management, and CRM embed SDK. |
| **URL** | https://effectime.app |
| **Social profiles** | LinkedIn, Twitter/X (name: "Effectime" — identical everywhere) |
| **Market** | Hungary, Czech Republic, Slovakia, Poland |

**Consistency rule:** "Effectime" must appear identically across website, social profiles, Google Business Profile, Crunchbase, Wikidata, and press mentions. No variations (Effectime.app, effectime, EffecTime).

---

### Product Entities — 4 Named Feature Schema

```json
[
  {
    "@type": "SoftwareApplication",
    "name": "Effectime Műszakbeosztás",
    "alternateName": "Shift Roster",
    "applicationSubCategory": "ShiftScheduling",
    "isPartOf": {"@type": "SoftwareApplication", "name": "Effectime"}
  },
  {
    "@type": "SoftwareApplication",
    "name": "Effectime Kapacitástervező",
    "alternateName": "Capacity Planner",
    "applicationSubCategory": "CapacityPlanning",
    "isPartOf": {"@type": "SoftwareApplication", "name": "Effectime"}
  },
  {
    "@type": "SoftwareApplication",
    "name": "Effectime Távollétek",
    "alternateName": "Leave Calendar",
    "applicationSubCategory": "LeaveManagement",
    "isPartOf": {"@type": "SoftwareApplication", "name": "Effectime"}
  },
  {
    "@type": "SoftwareApplication",
    "name": "Effectime CRM Embed SDK",
    "alternateName": "CRM Beágyazás",
    "applicationSubCategory": "BusinessApplication",
    "description": "Token-alapú iframe beágyazás bármilyen CRM rendszerbe.",
    "isPartOf": {"@type": "SoftwareApplication", "name": "Effectime"}
  }
]
```

---

### Knowledge Panel Strategy

**Step 1 — Entity consistency (do first):**
- Organization schema on every page with identical name/URL
- Google Business Profile created and verified
- LinkedIn company page with consistent name, description, URL
- Consistent entity on Crunchbase, AngelList / Wellfound

**Step 2 — Entity corroboration (months 1–3):**
- Press mentions citing "Effectime" by name (target: itbusiness.hu, startupdate.hu, portfolio.hu tech)
- Wikidata entry: create minimal entity (Q-number) with name, URL, country, founded, product category, founder

**Step 3 — Knowledge Graph reinforcement (months 3–6):**
- `sameAs` properties in Organization schema pointing to all social and directory profiles
- Consistent NAP across all listings
- Google Business Profile fully completed with product descriptions

**Expected outcome:** Within 6–9 months, Effectime should appear in Google's Knowledge Graph and trigger a Knowledge Panel for branded queries ("effectime", "effectime szoftver", "effectime hr").

---

## 5. Implementation Priority Checklist

**Week 1 (Zero-code-change):**
- [ ] Fix `html lang="en"` → `html lang="hu"` in `index.html`
- [ ] Add Organization + WebSite + SoftwareApplication JSON-LD to landing page
- [ ] Add FAQPage schema (5 Q&A pairs)
- [ ] Create Google Business Profile
- [ ] Verify LinkedIn company page consistent with website

**Month 1:**
- [ ] Create `/hu/rolunk` About page with Organization schema
- [ ] Create `/hu/szerzok/faul-henrik` author page with Person schema
- [ ] Add Article + Person + BreadcrumbList schema to first 3 blog posts
- [ ] Add `hreflang` tags to all pages
- [ ] Create Wikidata entity for Effectime

**Month 2–3:**
- [ ] Add DefinedTermSet schema to glossary
- [ ] Add FAQPage schema to all pillar pages
- [ ] Create `/hu/biztonsag` Security page
- [ ] Add SoftwareApplication schema to all feature pages
- [ ] Submit sitemap to Google Search Console (both hu + en properties)

**Month 4–6:**
- [ ] Add Review schema to testimonials page
- [ ] Add HowTo or Article schema to case study pages
- [ ] Publish original HU research piece (authority asset)
- [ ] Pursue first external link from hrportal.hu or profession.hu
