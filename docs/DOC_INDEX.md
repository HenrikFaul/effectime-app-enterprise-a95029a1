# Effectime Enterprise — Dokumentáció-index

<!-- METADATA -->
| Mező | Érték |
|---|---|
| **Dokumentum** | DOC_INDEX.md — Dokumentáció-index |
| **Generálva** | 2026-05-10T12:00:00Z |
| **Repository** | HenrikFaul/effectime-app-enterprise-a95029a1 |
| **Branch** | claude/create-software-documentation-O7kj1 |
| **Revision** | 8919c402e74e41bbe83ccf1e6385c92d0fddeada |
| **Megbízhatóság** | Magas (verified codebase scan) |

---

## Üdvözlő

Ez az index az Effectime Enterprise alkalmazás teljes technikai és felhasználói dokumentációs rendszerének belépési pontja. A dokumentumok a következő célcsoportokat fedik le: fejlesztők, rendszergazdák, végfelhasználók, és üzleti döntéshozók.

Az alkalmazás neve: **Effectime Enterprise**  
UI nyelvezete: magyar (HU) + angol (EN) lokalizáció-váltással  
Tech stack: React 18 + TypeScript + Vite + Supabase (PostgreSQL + Edge Functions)

---

## A 12 dokumentum áttekintő táblázata

| # | Fájl | Leírás | Célcsoport | Kapcsolódó |
|---|---|---|---|---|
| 1 | [DOC_INDEX.md](DOC_INDEX.md) | Ez a fájl — dokumentum-index és áttekintő | Mindenki | Összes |
| 2 | [BUSINESS_SYSTEM_REFERENCE.md](BUSINESS_SYSTEM_REFERENCE.md) | Részletes üzleti képesség-referencia modulonként | Üzleti elemzők, PM-ek, adminok | USER_MANUAL, PROCESS_FLOWS, ROLE_PERMISSION_MATRIX |
| 3 | [USER_MANUAL.md](USER_MANUAL.md) | Lépésről lépésre felhasználói kézikönyv (HU) | Végfelhasználók, adminok | NAVIGATION_TREE, BUSINESS_SYSTEM_REFERENCE |
| 4 | [PROCESS_FLOWS.md](PROCESS_FLOWS.md) | Mermaid folyamatábrák a főbb munkafolyamatokhoz | Fejlesztők, üzleti elemzők | BUSINESS_SYSTEM_REFERENCE, DATA_FLOW_AND_ENTITY_REFERENCE |
| 5 | [NAVIGATION_TREE.md](NAVIGATION_TREE.md) | Teljes navigációs fa (route-ok, tab-ok, sub-tab-ok) | Fejlesztők, UX tervezők | TECHNICAL_ARCHITECTURE, USER_MANUAL |
| 6 | [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) | Technikai architektúra-referencia (frontend, backend, DB, auth) | Fejlesztők, DevOps | DATA_FLOW_AND_ENTITY_REFERENCE, CHANGE_INTELLIGENCE_APPENDIX |
| 7 | [FEATURE_CATALOG.md](FEATURE_CATALOG.md) | Összes funkció strukturált leltára modulonként | Fejlesztők, PM-ek, QA | BUSINESS_SYSTEM_REFERENCE, ROLE_PERMISSION_MATRIX |
| 8 | [ROLE_PERMISSION_MATRIX.md](ROLE_PERMISSION_MATRIX.md) | Szerepkör × funkció jogosultsági mátrix | Adminok, fejlesztők, biztonság | BUSINESS_SYSTEM_REFERENCE, FEATURE_CATALOG |
| 9 | [DATA_FLOW_AND_ENTITY_REFERENCE.md](DATA_FLOW_AND_ENTITY_REFERENCE.md) | Adatentitások, kapcsolatok, életciklus-állapotok, ER-diagram | Fejlesztők, DB adminok | TECHNICAL_ARCHITECTURE, PROCESS_FLOWS |
| 10 | [CHANGE_INTELLIGENCE_APPENDIX.md](CHANGE_INTELLIGENCE_APPENDIX.md) | Changelog-intelligencia, ismert törékenységek, tanulságok | Fejlesztők, karbantartók | TECHNICAL_ARCHITECTURE, DATA_FLOW_AND_ENTITY_REFERENCE |
| 11 | [HELP_MENU_MASTERFILE.json](HELP_MENU_MASTERFILE.json) | Gépi feldolgozásra szánt JSON master-fájl (help rendszer) | Fejlesztők, help-regenerator | FEATURE_CATALOG, NAVIGATION_TREE |
| 12 | [DOC_GENERATION_REPORT.md](DOC_GENERATION_REPORT.md) | Generálási jelentés: scope, lefedettség, hiányok | Fejlesztők, PM-ek | Összes |

---

## Gyors navigáció célcsoport szerint

### Végfelhasználók
1. [USER_MANUAL.md](USER_MANUAL.md) — kezdj itt
2. [NAVIGATION_TREE.md](NAVIGATION_TREE.md) — ha nem találsz valamit

### Adminok / Workspace Ownerek
1. [BUSINESS_SYSTEM_REFERENCE.md](BUSINESS_SYSTEM_REFERENCE.md) — üzleti szabályok
2. [ROLE_PERMISSION_MATRIX.md](ROLE_PERMISSION_MATRIX.md) — jogosultságok
3. [USER_MANUAL.md](USER_MANUAL.md) — jóváhagyási folyamat fejezet

### Fejlesztők
1. [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) — architektúra
2. [DATA_FLOW_AND_ENTITY_REFERENCE.md](DATA_FLOW_AND_ENTITY_REFERENCE.md) — adatmodell
3. [PROCESS_FLOWS.md](PROCESS_FLOWS.md) — folyamatábrák
4. [CHANGE_INTELLIGENCE_APPENDIX.md](CHANGE_INTELLIGENCE_APPENDIX.md) — ismert problémák
5. [FEATURE_CATALOG.md](FEATURE_CATALOG.md) — komponens-leltár

### Üzleti elemzők / PM-ek
1. [BUSINESS_SYSTEM_REFERENCE.md](BUSINESS_SYSTEM_REFERENCE.md)
2. [FEATURE_CATALOG.md](FEATURE_CATALOG.md)
3. [PROCESS_FLOWS.md](PROCESS_FLOWS.md)

---

## Verziótörténet áttekintés

| Verzió | Fő változás |
|---|---|
| v3.3.6 | Demo seed schema-drift hotfix |
| v3.3.5 | Demo workspace leave-entities completion fix |
| v3.3.4 | Demo workspace leave seed fail-fast fix |
| v3.3.3 | Timeline végtelen újrarenderelés javítása |
| v3.3.2 | TimelineView hónapváltás debounce + Promise.allSettled |
| v3.3.1 | Org Chart Pan/Zoom + Fullscreen Popup Modal |
| v3.2.2 | Help reference feature map |

Részletek: [CHANGE_INTELLIGENCE_APPENDIX.md](CHANGE_INTELLIGENCE_APPENDIX.md)

---

## Belső cross-link térkép

```
DOC_INDEX
├── USER_MANUAL ──────────────────────── NAVIGATION_TREE
│                                              │
├── BUSINESS_SYSTEM_REFERENCE ──── ROLE_PERMISSION_MATRIX
│         │                               │
│    PROCESS_FLOWS ──────── DATA_FLOW_AND_ENTITY_REFERENCE
│         │                               │
│    FEATURE_CATALOG              TECHNICAL_ARCHITECTURE
│                                         │
│                           CHANGE_INTELLIGENCE_APPENDIX
│
├── HELP_MENU_MASTERFILE.json
└── DOC_GENERATION_REPORT
```
