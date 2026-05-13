# RLS & Multi-Tenant Security — Phase 6

## Princípium

A tier/feature katalógus (features, tiers, addons, tier_features, addon_features)
**publikus olvasásra** authenticated felhasználók számára — ezek nem tartalmaznak
PII-t és minden tenantnak ugyanazok. A tenant-scoped táblákon
(tenant_subscriptions, tenant_addons, tenant_feature_overrides) RLS limitálja
az olvasást/írást a tenant tagjaira és a superadminokra.

## Pattern

```sql
-- 1. Katalógus: minden authenticated user olvashatja
CREATE POLICY "features_select_authenticated"
ON public.features FOR SELECT TO authenticated
USING (true);

-- 2. Tenant-scoped: csak tenant tagok + superadmin
CREATE POLICY "tenant_subscriptions_select_member"
ON public.tenant_subscriptions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR EXISTS (
    SELECT 1 FROM public.tenant_workspaces tw
    JOIN public.enterprise_memberships em
      ON em.workspace_id = tw.workspace_id
    WHERE tw.tenant_id = tenant_subscriptions.tenant_id
      AND em.user_id = auth.uid()
      AND em.status = 'active'
  )
);

-- 3. Írás kizárólag superadmin
CREATE POLICY "tenant_subscriptions_write_superadmin"
ON public.tenant_subscriptions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
```

## Helper függvények

`tenant_id_for_workspace(uuid)` és `tenant_enabled_features(uuid)` — mindkettő
`SECURITY DEFINER` és `SET search_path = public`. Ezek RLS-bypass-ot adnak
csak a saját definícióhoz, **nem** a teljes táblához. A SQL belül továbbra
is csak a megfelelő rekordokat kéri.

## Audit

Minden írás (insert/update/delete a tenant_*) auditálva van a
`feature_gate_events` táblában (terv: külön `tenant_audit` tábla a v1.4-ben,
ld. backlog). A Superadmin UI minden „Tenant Assignment" akcióhoz auto-loggal
a felhasználó id-jét.

## Connection pool (pgbouncer) hatás

Mivel nem használunk `current_setting('app.tenant_id')` session változót
(helyette `auth.uid()` JWT-ből + EXISTS join), a transaction-mode pooling
biztonságos. Ha későbbi optimalizációhoz session változó kell, váltani kell
session-mode-ra vagy minden tranzakció elején `SET LOCAL app.tenant_id`-t
küldeni.

## Rationale (Phase 6 deliverable kibővítés)

### Miért `auth.uid()` + EXISTS join, nem `current_setting`?

A spec eredetileg `current_setting('app.tenant_id')` session-variable pattern-t
javasolt. Elvetve, mert:

1. **Supabase + pgbouncer transaction-mode konfliktus.** Supabase production
   pgbouncer-en fut transaction-mode-ban — session-szintű `SET app.tenant_id`
   nem ragad át tranzakciók között. A megoldás vagy session-mode (-> connection
   exhaustion kockázat), vagy minden tranzakció elején explicit `SET LOCAL`
   (-> RLS policy minden DB hívásnál egy plusz round-trip).
2. **JWT-natív megoldás működik.** Supabase JWT-ben `auth.uid()` minden
   PostgREST hívásban implicit elérhető, RLS policy-kben natív SQL függvényként
   hívható. Az EXISTS join az `enterprise_memberships`-szel azonos
   biztonsági garanciát ad, plusz egy index-elérést igényel.
3. **Audit-pontosabb.** `auth.uid()` minden RLS error message-ben szerepel
   (PostgreSQL log + Supabase log), míg `current_setting` változó esetén nincs
   automatikus actor-binding.

### Superadmin bypass

A platform-szintű katalógusműveletekhez (`tier_features`, `addon_features`,
`platform_audit_events`) `has_role(auth.uid(), 'admin')` ellenőrzés a
WITH CHECK clause-ban. Az `app_role` enum + `user_roles` tábla a `2026041*`
migrációkban definiálva. A `has_role` SECURITY DEFINER függvény — nem lehet
client-side spoofolni JWT-claim-mel.

### `SECURITY DEFINER` használata

- `tenant_id_for_workspace(_workspace_id uuid)` — `SECURITY DEFINER`, mert a
  workspace → tenant mapping kell a feature-gating-hez, de a felhasználónak
  nem feltétlenül van `tenant_workspaces`-olvasási joga.
- `tenant_enabled_features(_tenant_id uuid)` — `SECURITY DEFINER`, mert a
  tier/addon/override union resolution-höz több táblát kell olvasni.
- Mindkettő `SET search_path = public, pg_catalog` — a search-path
  hijacking elleni védelem.
- Sem definer-függvény nem fogad el USER-CONTROLLED SQL-t (csak UUID
  paramétereket), így SQL injection nem alkalmazható.

### Audit-elvárások (v3.15.0 utáni állapot)

A v3.15.0 előtt nem volt audit-tábla a platform-szintű műveletekhez. v3.15.0
óta:

- **`platform_audit_events`** — minden tier-feature toggle, addon-feature
  toggle, feature routing edit ide ír (`actor_id`, `action`, `new_state`,
  `metadata`, `created_at`).
- **Immutable** — UPDATE és DELETE policy hiányzik, így csak INSERT és SELECT
  lehetséges. Plain admin sem tudja törölni vagy módosítani.
- **RLS** — SELECT és INSERT csak `has_role(auth.uid(), 'admin')`-nak.
- **`enterprise_audit_events`** — workspace-scoped audit (megelőzött, v3.12+).
  Külön él, mert `workspace_id NOT NULL` constraint van rajta, és a
  platform-szintű műveletek nem kötődnek egy konkrét workspace-hez.

### pgbouncer-kompatibilitási teszt

Production deploy-nál ellenőrizendő:

```sql
-- Egy psql sessionben (transaction-mode pgbouncer-en át)
BEGIN;
SELECT auth.uid();          -- valid uuid?
SELECT count(*) FROM public.tenant_subscriptions; -- RLS-szűrt eredmény
COMMIT;

-- Most: indítsunk egy másik pgbouncer connection-t ugyanazzal a JWT-vel,
-- és győződjünk meg, hogy ugyanazt látja (nincs leak a connection-pool-ban).
```

Ha session-mode-ra kell váltanunk a jövőben:
- pgbouncer config: `pool_mode = session` a tier-érzékeny appra
- monitor: `pg_stat_activity` connection-count
- alternatíva: külön Postgres pool a superadmin operációkra
