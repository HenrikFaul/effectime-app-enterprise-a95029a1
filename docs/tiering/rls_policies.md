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
