## Mit fogok csinálni

Négy munkacsomagot vittem fel sorrendben. Mindegyik **külön PR / külön verzió** lesz a `AGENTS.md` + `CLAUDE.md` szabályai szerint (rebase `origin/main`, `CHANGELOG.md`, `versioning/*.md`, `marketing/marketing_values/*.md`). Először **csak auditot és terveket** írok kódváltozás nélkül — utána egyenként végrehajtjuk, mert mindegyik regresszió-kockázatos és a governance kifejezetten tiltja a „break already working functionality"-t.

---

### 1. csomag — Terminológia-audit (tier / feature / routing domain)

**Cél:** egyetlen canonical szótár a `feature_key`, `route_path`, `menu_path`, `module`, `enterprise_role_permissions.feature_key` mezőkre.

**Lépések:**
1. `db-audit/` és `src/` átfésülése: minden `feature_key`, `route_path`, `menu_path`, `module` előfordulás listázása (DB + kód).
2. Duplikátum/szinonima mátrix: melyik kulcs hányféle néven él (`time-tracking` vs `timeTracking` vs `time_tracking` stb.).
3. Canonical map javaslat (snake_case, egy igazságforrás: `features` tábla).
4. Deliverable: `db-audit/terminology_audit.md` + javasolt rename-migration vázlat (NEM futtatva).

**Nincs kódváltozás ebben a körben** — csak audit dokumentum.

---

### 2. csomag — Role / position normalizáció

**Cél:** a jelenleg 5-féle „role" fogalom (`app_role`, `enterprise_role` enum, `enterprise_role_definitions`, `enterprise_workspace_roles`, `business_role` szabad szöveg, + `position`) egyetlen koherens modellbe rendezése.

**Lépések:**
1. Minden role-szerű mező és tábla teljes inventárja: oszlop, típus, használat (kód+RLS+UI).
2. Konfliktus-térkép: hol ütköznek (pl. ugyanaz a user kap-e `app_role`-t ÉS `enterprise_workspace_role`-t, mi a precedence).
3. Canonical model javaslat — várhatóan:
   - **platform-szint:** `app_role` (super admin, user) — marad
   - **workspace-szint:** `enterprise_workspace_roles` (owner, admin, member) — marad, ez a canonical
   - **HR-szint:** `position` (job title szabad szöveg) — marad, NEM role
   - **business_role / enterprise_role enum / enterprise_role_definitions:** deprecate vagy egyesítés
4. Deliverable: `db-audit/role_model_normalization.md` + migration path lépésekre bontva (backfill → dual-write → cutover → drop). NEM futtatva.

**Nincs kódváltozás ebben a körben** — csak terv.

---

### 3. csomag — DB cleanup (confirmed-unused)

**Cél:** a `db-audit/master_inventory.md` szerinti 5 tábla + 1 függvény biztonságos drop-ja.

**Lépések:**
1. `feature_gate_events` sorsa előbb eldöntendő — a tiering doksi még említi → ellenőrzöm hivatkozik-e élő kód, ha nem, dropolható.
2. Mindegyik objektumra friss `pg_catalog` + `rg` keresés: tényleg nulla referencia kódból és DB triggerekből/view-kből.
3. Egy migráció, ami mindet `DROP ... CASCADE` nélkül, függőség-helyes sorrendben dobja, `IF EXISTS` őrzéssel.
4. `CHANGELOG.md` + `versioning/*.md` + `marketing/marketing_values/*.md` az `AGENTS.md` szerint.

**Ez a csomag már futtat migrációt** — külön user-jóváhagyással.

---

### 4. csomag — Konkrét feladat

Miután a fenti 3 auditdokumentum kész és átnéztük, megkérdezem **melyik konkrét feature/bug** kerüljön sorra. A fenti auditok alapján már tisztább lesz, hogy melyik domainben érdemes haladni.

---

## Végrehajtási sorrend ebben a session-ben

1. **MOST:** 1. csomag audit (terminology_audit.md) — read-only
2. **Utána:** 2. csomag audit (role_model_normalization.md) — read-only
3. **Utána:** 3. csomag drop-migráció **terv** szövegesen, és megkérdezem mehet-e az élesítés
4. **Utána:** 4. csomag — megkérdezem mi a konkrét feladat

Minden lépés után megállok és visszajelzést kérek, mert a governance „smallest regression-risk solution" és „re-check affected flows after every change" előírásokat tartalmaz — nem futtatok 4 nagy átalakítást egyszerre, jóváhagyás nélkül.

## Amit NEM teszek meg jóváhagyás nélkül

- Rename-migráció futtatása (1. csomag)
- Role-tábla összevonás vagy enum drop (2. csomag)
- Tényleges `DROP TABLE` (3. csomag)
- Új feature kódolása (4. csomag)
