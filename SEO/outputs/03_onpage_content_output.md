# On-Page Content Agent — Output
# effectime.app | 2026-05-23

## 1. Landing Page Optimization

### 1.1 Rewritten `<title>` tag

**HU (primary):**
```html
<title>Effectime – Vállalati Kapacitástervező, Szabadságkezelő és Műszakbeosztó Platform</title>
```

**EN (secondary / hreflang):**
```html
<title>Effectime – Enterprise Capacity Planning, Leave Management & Shift Scheduling Software</title>
```

**Rationale:** The current `<title>Effectime</title>` is branding-only with zero keyword signal. The rewrite leads with brand, follows with the three core product categories (capacity planning = highest search volume in B2B HR SaaS in Hungary; leave management = high intent; shift scheduling = product differentiator).

---

### 1.2 Rewritten `<meta description>`

**HU:**
```html
<meta name="description" content="Az Effectime enterprise platform valós idejű kapacitástervezést, automatizált szabadságkezelést, műszakbeosztást és CRM-beágyazható nézetek API-ját kínálja. GDPR-kompatibilis, iCal-integráció, auditált jóváhagyási lánc. Ingyenes regisztráció.">
```

**EN:**
```html
<meta name="description" content="Effectime is an enterprise HR platform for real-time capacity planning, shift scheduling, leave management and CRM-embeddable workforce views. GDPR-compliant, audit trail, iCal sync. Free to start.">
```

---

### 1.3 H1 Recommendation

**Current problem:** Metaphorical H1 ("Navigáld vállalkozásod erőforrásait stratégiával") maps to no keyword anyone types.

**Recommended H1 (HU):**
```
Vállalati kapacitástervező és szabadságkezelő platform közép- és nagyvállalatoknak
```

**Alternative H1 if brand-first approach preferred:**
```
Effectime: Intelligens műszakbeosztás, kapacitástervezés és szabadságkezelés egy rendszerben
```

**Supporting subtitle (hero_subtitle replacement):**
```
Valós idejű csapatkapacitás, automatizált jóváhagyási munkafolyamatok, iCal-szinkronizáció és CRM-beágyazható nézetek — egyetlen platformon, magyar és angol felületen.
```

---

### 1.4 Full Content Outline for the Landing Page

Current page covers: badge → H1 → subtitle → 6 feature cards → 6 benefit bullets → CTA card → footer. ~350–500 words rendered — far below the 1,500–2,500 words Google favors for single-page SaaS authority sites.

**Recommended expanded outline:**

```
1. [KEEP & EXPAND] Hero section
   - Rewritten H1
   - Expanded subtitle (mention sectors: healthcare rosters, IT capacity, retail shifts)
   - Social proof line: "Több mint X csapat már Effectime-ban tervez" (add when data available)
   - Primary CTA: "Ingyenes regisztráció" | Secondary CTA: anchor scroll to features

2. [NEW] Trust bar — single-line with 5 badges
   - GDPR-kompatibilis | ISO 27001 elvek | 99.9% uptime SLA | iCal / Outlook szinkronizáció | CRM SDK

3. [KEEP & EXPAND] Főbb funkciók (Features section)
   Expand each card description by 1–2 sentences. Add 2 more:
   - Időnyilvántartás (Time & Attendance)
   - Beágyazható CRM-nézetek (Embed SDK / iFrame API)

4. [NEW] How it works — 3-step visual
   "Három lépés a teljes kapacitásképig"
   Step 1: Munkaterület létrehozása
   Step 2: Csapat és szabályok hozzáadása
   Step 3: Kapacitás optimalizálása

5. [KEEP & EXPAND] Benefits section
   - Expand from 6 to 8–10 bullets
   - Add: "Prediktív hiány-előrejelzés 90 napra", "CRM beágyazható nézetek", "Szervezeti diagram automatikus generálás"

6. [NEW] Comparison table: "Hagyományos eszközök vs. Effectime"
   6 rows: Beállítási idő | Jóváhagyási folyamat | Kapacitásnézet | Szabadságegyenleg | Auditnyomvonal | Mobil hozzáférés

7. [NEW] Use-case industry strip (3 cards, scannable)
   - IT és szoftver csapatok (sprint kapacitás, Jira integráció)
   - Egészségügy és műszakos munkakörök
   - Pénzügyi szolgáltatások és tanácsadás

8. [NEW] FAQ section (6–8 questions targeting featured snippets)

9. [KEEP] CTA section with improved copy

10. [EXPAND] Footer
    - Add nav links: Funkciók | Árképzés | Adatvédelem | ÁSZF | Kapcsolat | Blog
    - Add schema markup
```

---

### 1.5 Missing Subtopics

| Missing Subtopic | HU Keyword Targets | Why Critical |
|---|---|---|
| Shift trading / Műszakcsere | műszakcsere, beosztás csere kérelem | ShiftMarketplacePanel exists (v3.21.0) but invisible to crawlers |
| Time & Attendance | időnyilvántartás, jelenléti ív szoftver | time-attendance tab exists in product |
| Predictive analytics | prediktív kapacitástervezés, hiányelőrejelzés | PredictiveAnalyticsPanel exists (v3.29.0) — never mentioned on landing |
| CRM embed SDK | iframe beosztás beágyazás, CRM integráció | Unique differentiator — 5 embed views + write-mode tokens |
| Agile / Sprint integration | Jira szabadság integráció, sprint kapacitás tervezés | Jira + Azure DevOps integration exists |
| Multi-workspace / Multi-entity | több cégegység kezelés, holding HR platform | Core architecture of the product |
| GDPR & Security | GDPR HR szoftver Magyarország, immutable audit trail | RLS, SOC2/ISO 27001 security center exist |
| iCal / Calendar sync | iCal szabadság naptár, Outlook szinkronizáció | ICalSubscription component exists |

---

### 1.6 CTA Copy Improvements

| Position | Current | Recommended HU | Recommended EN |
|---|---|---|---|
| Hero primary | Kezdje el ingyen | Ingyenes próba — percek alatt elindul | Start free — set up in minutes |
| CTA card title | Próbálja ki már ma | Próbálja ki 0 Ft-ért — nincs kötelezettség | Try for free — no commitment |
| CTA card button | Ingyenes regisztráció | Regisztráció indítása | Get started free |
| CTA card sub-copy | (existing) | Hozzon létre munkaterületet, hívja meg csapatát, és nézze meg valós időben a kapacitást — 2 perc alatt. | Create your workspace, invite your team, and see real-time capacity — in 2 minutes. |

---

### 1.7 FAQ Section Design (for Featured Snippet Capture)

**Section H2:** "Gyakran Ismételt Kérdések"  
**Schema:** `FAQPage` markup  
**Format:** Accordion (collapsed by default)

**8 Q&A pairs (HU):**

```
Q1: Miben különbözik az Effectime a hagyományos HR szoftverektől?
A1: Az Effectime valós idejű kapacitástervezést, automatizált jóváhagyási munkafolyamatokat,
    műszakbeosztást, agilis sprint-integrációt (Jira, Azure DevOps) és CRM-beágyazható
    nézeteket kínál egyetlen platformon, GDPR-kompatibilis adatkezeléssel.

Q2: Hogyan működik a szabadságkezelés és a jóváhagyási folyamat?
A2: A munkavállalók a naptárban kérelmet nyújtanak be; a rendszer automatikusan értesíti a
    jóváhagyási lánc tagjait. Többlépéses jóváhagyási lánc konfigurálható osztályonként és
    szerepköronként. Minden döntés megváltoztathatatlan audit naplóba kerül.

Q3: Beágyazható az Effectime a saját CRM rendszerünkbe?
A3: Igen. Az Embed SDK iframe-tokenekkel működik: a kapacitástervező, műszakbeosztás,
    szabadságnaptár, irodai létszám és személyes beosztás — mind beágyazható bármely
    webapplikációba. Az írható tokenek lehetővé teszik, hogy a CRM-operátorok közvetlenül
    a beágyazott nézetből kezeljék a beosztásokat.

Q4: Hogyan segít az Effectime a kapacitástervezésben?
A4: A Kapacitás DNA pillanatkép napi szinten mutatja az elérhető, lekötött és hiányzó
    kapacitást. A prediktív analitika 90 napos lefedettségi kockázati hőtérképet és
    6 hónapos munkaerőköltség-előrejelzést generál.

Q5: Támogatja a platform a több cégegységet vagy telephelyet?
A5: Igen. Minden munkaterület izolált: saját tagság, jóváhagyási lánc, ünnepnapok és
    lefedettségi szabályok. Holdingok és több telephellyel rendelkező vállalatok külön
    munkaterületen kezelhetik az egyes egységeket.

Q6: Megfelel az Effectime a GDPR-nak?
A6: Igen. Sor szintű (RLS) adatbiztonsággal, immutable audit trail-lel, GDPR Art. 17
    törlési és Art. 20 adatexportálási funkcióval, és ISO 27001 elveken alapuló
    biztonsági architektúrával működik.

Q7: Integrálható az Effectime a Jirával vagy az Azure DevOps-szal?
A7: Igen. Az Agile panel összeköti a Jira vagy Azure DevOps projekteket az Effectime-mal.
    Böngészhető backlog, sprint-kapacitás távollétek tükrében, mi-lenne-ha szimulációk,
    és Jira/ADO issue-k létrehozása Effectime-ból.

Q8: Milyen gyorsan indítható el az Effectime?
A8: A munkaterület 2 perc alatt elkészíthető: cégegységek, telephelyek, pozíciók és
    jogosultságok beállítása, tagok meghívása, kvóták és jóváhagyási lánc konfigurálása.
    Nincs szükség külső integrációra vagy IT-projekt indítására.
```

---

### 1.8 Schema Suggestion

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Effectime",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "url": "https://effectime.app",
      "description": "Enterprise kapacitástervező, szabadságkezelő és műszakbeosztó platform.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "HUF", "description": "Ingyenes regisztráció" },
      "featureList": ["Kapacitástervezés", "Szabadságkezelés", "Műszakbeosztás", "CRM beágyazható nézetek", "Jóváhagyási munkafolyamatok", "GDPR-kompatibilis", "Jira integráció", "iCal szinkronizáció"],
      "inLanguage": ["hu", "en"]
    },
    {
      "@type": "Organization",
      "name": "Effectime",
      "url": "https://effectime.app",
      "sameAs": ["https://twitter.com/Effectime"]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Miben különbözik az Effectime a hagyományos HR szoftverektől?",
          "acceptedAnswer": { "@type": "Answer", "text": "Az Effectime valós idejű kapacitástervezést, automatizált jóváhagyási munkafolyamatokat, műszakbeosztást, agilis sprint-integrációt és CRM-beágyazható nézeteket kínál egyetlen platformon." }
        },
        {
          "@type": "Question",
          "name": "Beágyazható az Effectime a saját CRM rendszerünkbe?",
          "acceptedAnswer": { "@type": "Answer", "text": "Igen. Az Embed SDK iframe-tokenekkel működik: kapacitástervező, műszakbeosztás, szabadságnaptár és személyes beosztás beágyazható bármely webapplikációba." }
        },
        {
          "@type": "Question",
          "name": "Megfelel az Effectime a GDPR-nak?",
          "acceptedAnswer": { "@type": "Answer", "text": "Igen. Sor szintű adatbiztonság, immutable audit trail, GDPR Art. 17 törlési és Art. 20 exportálási funkcióval működik." }
        }
      ]
    }
  ]
}
```

---

## 2. Feature Page Templates (for Future URL Migration)

### Template 1: Műszakbeosztás (Shift Scheduling)
- **Target URL:** `/hu/muszakbeosztás`
- **Primary keyword:** `műszakbeosztás szoftver`
- **Title:** `Műszakbeosztás Szoftver Vállalkozásoknak | Effectime`
- **Meta:** `Automatikus műszakbeosztás: az Effectime figyelembe veszi a szabadságokat, ünnepnapokat, telephely-prioritást és pozícióegyezést. Beosztás varázsló, jóváhagyási lánc, beágyazható nézetek.`
- **H1:** Automatikus műszakbeosztás — a varázsló elvégzi a nehéz munkát
- **H2 outline:** Mi az intelligens beosztás varázsló? | Hogyan veszi figyelembe a hiányzásokat? | Telephely-prioritás és pozícióegyezés | Beágyazható műszakbeosztás CRM-be | Jóváhagyási folyamat | Adatbiztonság

### Template 2: Kapacitástervezés (Capacity Planning)
- **Target URL:** `/hu/kapacitastervezes`
- **Primary keyword:** `kapacitástervezés szoftver`
- **Title:** `Kapacitástervező Szoftver — Valós Idejű Csapatkapacitás | Effectime`
- **Meta:** `Az Effectime kapacitástervező valós időben mutatja a csapat elérhetőségét, a hiányokat és a 90 napos kockázati hőtérképet. Prediktív analitika, Jira integráció, beágyazható CRM nézet.`
- **H1:** Valós idejű kapacitástervező — tudd előre, hol lesz hiány
- **H2 outline:** Mi a Kapacitás DNA pillanatkép? | 90 napos lefedettségi kockázati hőtérkép | 6 hónapos munkaerőköltség-előrejelzés | Agilis sprint-kapacitás | Irodai létszám valós időben | Mi-lenne-ha szimulációk

### Template 3: Szabadságkezelés (Leave Management)
- **Target URL:** `/hu/szabadsagkezeles`
- **Primary keyword:** `szabadságkezelés szoftver`
- **Title:** `Szabadságkezelő Szoftver — Automatizált Kérelmek és Jóváhagyások | Effectime`
- **Meta:** `Digitális szabadságkezelés: kérelem, jóváhagyás, kvóta, iCal exportálás, GDPR-kompatibilis audit trail. Többlépéses jóváhagyási lánc, félnapos szabadság, éves nézet, Outlook szinkronizáció.`
- **H1:** Szabadságkezelés automatizálva — kevesebb email, több átláthatóság
- **H2 outline:** Hogyan nyújtható be a távolléti kérelem? | Többlépéses jóváhagyási lánc | Kvóták és félnapos szabadság | iCal / Outlook szinkronizáció | Éves nézet | GDPR adatkezelés

### Template 4: CRM Beágyazás / Embed SDK
- **Target URL:** `/hu/crm-beagyazas`
- **Primary keyword:** `CRM beágyazás HR nézet` / `HR widget CRM rendszerbe`
- **Title:** `CRM Beágyazható HR Nézetek — Embed SDK & iframe API | Effectime`
- **Meta:** `Az Effectime Embed SDK tokenizált iframe-nézeteket kínál: kapacitástervező, műszakbeosztás, szabadságnaptár, irodai létszám és személyes beosztás — bármely CRM-be. Írható tokenekkel CRM-ből is kezelhető a beosztás.`
- **H1:** Beágyazható HR nézetek — integráld az Effectime-ot bármely CRM rendszerbe
- **H2 outline:** Mik az Embed SDK tokenizált nézetei? | 5 beágyazható nézet | Írható tokenek | Biztonság | Snippet generálás | Multi-nézet (/embed/multi)

---

## 3. Content Gap Notes

| Gap | Competitor Coverage | Effectime Status |
|---|---|---|
| Pricing page | All competitors have /pricing | Not public — only "Ingyenes regisztráció" |
| Customer testimonials | Personio, Sympa: full case study library | Zero social proof on landing |
| Blog / resources | Personio HU blog: 200+ posts | No blog exists |
| Competitor comparison pages | Sloneek has /vs/personio etc | None exist |
| Integration directory | All major competitors list integrations | Not listed publicly |
| Security / trust page | GDPR, SOC2 claims need dedicated page | Only in auth_page i18n |
| Help center | Competitors have public knowledge bases | In-app help only — not crawlable |
| Sector landing pages | e.g., /egeszsegugy, /it-csapatok | None |

**Highest-impact gap:** A public `/blog` or `/tudastar` section — long-tail articles capture decision-stage traffic at near-zero CPC.
