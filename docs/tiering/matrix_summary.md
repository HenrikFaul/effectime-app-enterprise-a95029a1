# Phase 3 — Dependency & Value Matrix Summary

Forrás: `docs/tiering/dependency_matrix.csv` és `features.json` (regenerálva: `node scripts/build_tiering_csvs.mjs`).

## Számok

| Mérőszám | Érték |
|----------|-------|
| Feature-ek összesen | 135 |
| Dependency edge összesen | 151 |
| Modulok száma | 18 |
| Függőség nélküli "gyökér" feature-ek | 3 (`auth_email_signup`, `email_unsubscribe`, `leave_daily_rules`) |
| Árva feature (nincs dep, nincs dependent) | 1 (`email_unsubscribe` — szándékosan; CAN-SPAM/GDPR-független) |
| Required | 49 |
| Recommended | 46 |
| Optional | 40 |

## Kritikus alapfunkciók (legmagasabb fan-out)

A spec elvárta, hogy "kritikus alapfunkciók" külön jelölve legyenek — ezek a freemium tier gerincét adják, és gyakorlatilag minden más feature függ tőlük.

| Rank | feature_key | Fan-out (dependents) | Modul | Tier |
|------|-------------|----------------------|-------|------|
| 1 | `members_list` | 24 | members | Freemium |
| 2 | `workspace_create` | 23 | workspace | Freemium |
| 3 | `leave_submit` | 10 | leave | Freemium |
| 4 | `calendar_monthly` | 8 | calendar | Freemium |
| 5 | `attendance_log` | 7 | attendance | Pro |
| 6 | `leave_my_view` | 7 | leave | Freemium |
| 7 | `agile_panel` | 5 | agile | Pro |
| 8 | `projects` | 5 | resources | Pro |
| 9 | `approval_individual` | 4 | approvals | Freemium |
| 10 | `auth_email_signup` | 4 | auth | Freemium |

**Következmény:** ezt a 10 feature-t **nem lehet kikapcsolni egyik tier-ből sem**, különben más feature-ek logikailag elérhetetlenek lesznek. A Freemium 41 feature-e a 10-ből 8-at tartalmaz; `attendance_log` és `agile_panel` szándékosan Pro+ szinten van fence-elve.

## Modulok mérete

| Modul | Feature-ek |
|-------|------------|
| leave | 11 |
| calendar | 11 |
| resources | 11 |
| agile | 10 |
| settings | 10 |
| org | 10 |
| members | 9 |
| auth | 8 |
| rules | 8 |
| approvals | 7 |
| attendance | 7 |
| workspace | 7 |
| reports | 6 |
| workflows | 5 |
| platform | 5 |
| admin | 4 |
| ai | 3 |
| help | 3 |

## Methodology

- **Static code analysis** — `INSERT INTO public.features (...)` parsolása minden migrációból (`supabase/migrations/2026051221*.sql` + `220309`, `221335`, `221850`, `221952`).
- **Korrekciós overlay** — `UPDATE public.features SET dependencies = ARRAY[...]` statementek alkalmazása (lásd `20260513120100_fix_feature_dependencies.sql`).
- **Cycle detection** — iteratív DFS coloring algoritmus, `src/test/featureTiering.test.ts`-ben tesztelve.
- **Dependent map** — fordított gráf-építés a `dependencies` listából.

## Vitathato / "assumed" függőségek

A v3.15.0 előtti seed több olyan függőséget tartalmazott, amelyet kódban / UX-flow-ban nem lehetett megerősíteni. A `featureTiering.test.ts` által elkapott bugok (4 vesszővel rosszul tagolt dep + 1 cycle) javítva, de néhány implicit függőség még review-ra vár:

| Feature | Deklarált dep | Megjegyzés |
|---------|---------------|------------|
| `ai_smart_schedule` | `calendar_monthly`, `leave_quotas` | Asszumált — AI input források, de runtime guard nincs (ha `leave_quotas` ki van kapcsolva, az AI funkcionálisan üres állapotba esik, nem hibára) |
| `burnout_engine` | `leave_my_view`, `attendance_log` | Asszumált — analitikus input források |
| `org_chart_snapshot` | `org_chart` | Csak Enterprise — `tier_feature` mapping bal-szabályozza |
| `payroll_engine` | `payroll_export` | Egymástól függ kódban (`enterprise_payroll_*` szignatúrák) |

## Cycle-mentes igazolás

`featureTiering.test.ts > dependency graph has no cycles` — 13 teszt között a 4. teszt iteratív DFS coloringgal végigjárja a 135 csúcsú gráfot és 0 cycle-t igazol. Korábban 1 cycle volt (`leave_conflict_check ↔ leave_daily_rules`), feloldva: `leave_daily_rules` többé nem függ `leave_conflict_check`-től, hanem ennek inputja.

## Tier inheritance validáció

`featureTiering.test.ts > tier inheritance` — minden Freemium ⊂ Pro ⊂ Enterprise. Az aktuális számok:

- Freemium 41 → Pro 101 (+60 új feature) → Enterprise 130 (+29 új)
- Az 5 addon (Agile, Wellbeing, Payroll, API, AI) 11 feature-t mapping-el rá Enterprise feature-ekre, így opcionális modul-vásárlás.
