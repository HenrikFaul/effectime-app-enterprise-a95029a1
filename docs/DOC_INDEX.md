# Effectime Enterprise – Dokumentáció-index

<!-- METADATA -->
| Mező | Érték |
|---|---|
| Dokumentum | DOC_INDEX.md |
| Generálva | 2026-05-10T12:00:00Z |
| Repozitórium | HenrikFaul/effectime-app-enterprise-a95029a1 |
| Branch | claude/create-software-documentation-O7kj1 |
| Revision | 8919c402e74e41bbe83ccf1e6385c92d0fddeada |
| Megbízhatóság | Magas (verified forrás: codebase-audit + CHANGELOG) |
| Kapcsolódó dok. | Összes többi docs/*.md |

---

## Mi az Effectime Enterprise?

Az **Effectime Enterprise** egy vállalati szintű, SaaS-alapú HR és munkaszervezési platform, amely lehetővé teszi a szabadságkérelmek kezelését, kapacitástervezést, agilis projektmenedzsmentet, szervezeti struktúra karbantartását és onboarding workflow-k végrehajtását. A frontend React 18 + TypeScript + Vite + Tailwind CSS technológiára épül, a backend Supabase (PostgreSQL + Edge Functions) alapú.

---

## Dokumentumok áttekintése

| # | Fájl | Leírás | Célközönség |
|---|---|---|---|
| 1 | [DOC_INDEX.md](docs/DOC_INDEX.md) | Ez a lap – navigációs index az összes dokumentumhoz | Mindenki |
| 2 | [BUSINESS_SYSTEM_REFERENCE.md](docs/BUSINESS_SYSTEM_REFERENCE.md) | Részletes üzleti képességek referenciája modulonként | Product Owner, BA, Support |
| 3 | [USER_MANUAL.md](docs/USER_MANUAL.md) | Lépésről-lépésre felhasználói kézikönyv | Végfelhasználók (member, admin) |
| 4 | [PROCESS_FLOWS.md](docs/PROCESS_FLOWS.md) | Mermaid folyamatábrák a kulcsfolyamatokhoz | BA, fejlesztők, tesztelők |
| 5 | [NAVIGATION_TREE.md](docs/NAVIGATION_TREE.md) | Teljes navigációs fa – útvonalak, tabok, sub-tabok | UX, fejlesztők |
| 6 | [TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) | Technikai architektúra (frontend, backend, DB, auth, deploy) | Fejlesztők, DevOps |
| 7 | [FEATURE_CATALOG.md](docs/FEATURE_CATALOG.md) | Összes funkció strukturált katalógusa modulonként | PM, QA, fejlesztők |
| 8 | [ROLE_PERMISSION_MATRIX.md](docs/ROLE_PERMISSION_MATRIX.md) | Szerepkör–jogosultság mátrix | BA, Support, fejlesztők |
| 9 | [DATA_FLOW_AND_ENTITY_REFERENCE.md](docs/DATA_FLOW_AND_ENTITY_REFERENCE.md) | Entitások, mezők, kapcsolatok, állapotgépek, ER-diagram | Backend fejlesztők, DBA |
| 10 | [CHANGE_INTELLIGENCE_APPENDIX.md](docs/CHANGE_INTELLIGENCE_APPENDIX.md) | Változásnapló-alapú törékenységi elemzés, ismert bugok, leckék | Fejlesztők, QA |
| 11 | [HELP_MENU_MASTERFILE.json](docs/HELP_MENU_MASTERFILE.json) | Teljes help-system metadata JSON (anchor IDs, navigation) | Fejlesztők, tartalomszerkesztők |
| 12 | [DOC_GENERATION_REPORT.md](docs/DOC_GENERATION_REPORT.md) | Generálási jelentés (scope, megbízhatóság, hiányok) | Tech lead, PM |

---

## Gyors navigáció témakör szerint

### Felhasználók számára
- Bejelentkezés és regisztráció → [USER_MANUAL.md §1](docs/USER_MANUAL.md#1-bejelentkezés--regisztráció)
- Szabadságkérelem benyújtása → [USER_MANUAL.md §4](docs/USER_MANUAL.md#4-szabadságkérelem-beküldése)
- Naptár és idővonal → [USER_MANUAL.md §6](docs/USER_MANUAL.md#6-naptár-és-idővonal-használata)
- Riportok → [USER_MANUAL.md §7](docs/USER_MANUAL.md#7-riport-generálása-és-ütemezése)

### Adminisztrátorok számára
- Jóváhagyási folyamat → [BUSINESS_SYSTEM_REFERENCE.md](docs/BUSINESS_SYSTEM_REFERENCE.md#4-jóváhagyási-workflow)
- Jogosultságok → [ROLE_PERMISSION_MATRIX.md](docs/ROLE_PERMISSION_MATRIX.md)
- Beállítások → [USER_MANUAL.md §10](docs/USER_MANUAL.md#10-beállítások-módosítása)
- Onboarding workflow → [BUSINESS_SYSTEM_REFERENCE.md](docs/BUSINESS_SYSTEM_REFERENCE.md#9-workflows-onboardingaccess)

### Fejlesztők számára
- Architektúra → [TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md)
- Adatbázis séma → [DATA_FLOW_AND_ENTITY_REFERENCE.md](docs/DATA_FLOW_AND_ENTITY_REFERENCE.md)
- Folyamatábrák → [PROCESS_FLOWS.md](docs/PROCESS_FLOWS.md)
- Ismert törékeny területek → [CHANGE_INTELLIGENCE_APPENDIX.md](docs/CHANGE_INTELLIGENCE_APPENDIX.md)
- Funkció katalógus → [FEATURE_CATALOG.md](docs/FEATURE_CATALOG.md)

---

## Aktuális verzió

**v3.3.6** – Demo seed schema-drift hotfix (2026-05-10)

Előző főbb verziók:
- v3.3.1 – Org Chart Pan/Zoom + Fullscreen Popup Modal
- v3.2.2 – Help reference feature map

Részletek: [CHANGE_INTELLIGENCE_APPENDIX.md](docs/CHANGE_INTELLIGENCE_APPENDIX.md)

---

## Megjegyzések a dokumentációról

- A felhasználói felület elsősorban **magyarul** érhető el (HU locale).
- A technikai azonosítók (táblanevek, komponensnevek, route-ok, permission kulcsok) angolul szerepelnek.
- A „verified" jelölés azt jelenti, hogy a forrás közvetlenül a kódbázisból vagy a CHANGELOG-ból van megerősítve. Az „inferred" jelölés következtetésen alapul.
- A dokumentáció a `8919c402` revízió alapján készült; a kódbázis változásával egyes részletek frissítést igényelhetnek.
