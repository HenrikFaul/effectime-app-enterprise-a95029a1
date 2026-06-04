## Mit találtam (audit)

**Admin felületi kód (forrás):**
- `src/pages/Admin.tsx` (94 sor) — workspace-szintű admin oldal shell
- `src/pages/Superadmin.tsx` (66 sor) — platform-superadmin shell
- `src/components/admin/AdminDashboard.tsx` (178 sor)
- `src/components/admin/AdminUsers.tsx` (208 sor)
- `src/components/superadmin/SuperadminControlPlane.tsx` (**1297 sor** — tenant create, impersonate, tier change, jelszó-reset, stb.)
- `src/components/superadmin/FeatureTiersTab.tsx` (1158 sor)
- `src/components/superadmin/PlatformAuditLogTab.tsx` (308 sor)

**Meglévő admin-vonatkozású dokumentáció/prompt:**
| Fájl | Mit fed le | Mély technikai? |
|---|---|---|
| `docs/tiering/superadmin_spec.md` | Csak a **FeatureTiersTab** (wireframe + i18n + audit) | ✅ részben |
| `docs/help/en/08-settings-admin.md` | Workspace settings **end-user** help | ❌ user-facing |
| `docs/ROLE_PERMISSION_MATRIX.md` | Szerep ↔ permisszió mátrix | ❌ csak mátrix |
| `docs/tiering/master_spec.md`, `rls_policies.md`, `rollout_plan.md` | Tiering rendszer egésze | ❌ nem admin-feature szintű |
| `AI_PROMPTING_FOLDERSTRUCTURE/{ui,ux,backend,frontend}/` | Általános AI dev promptok | ❌ nem admin-specifikus |

**Lefedetlen admin funkciók (NINCS mély technikai prompt egyikre sem):**
1. `SuperadminControlPlane` — tenant lista + szűrés + lapozás
2. Tenant létrehozás (admin által, tier-választással)
3. **Impersonate** (workspace-be belépés superadmin session-nel) — security-kritikus
4. Workspace tier váltás (`superadmin_change_workspace_tier` RPC + audit)
5. Jelszó-reset / felhasználó tiltás superadmin oldalról
6. `PlatformAuditLogTab` — audit-esemény szűrés/export
7. `AdminDashboard` (workspace admin) — metrikák, gyors-akciók
8. `AdminUsers` — workspace tag létrehozás közvetlenül (v3.33.0), jelszó-policy, role-permissions tier-szerinti szűrése

**Regresszió-rizikó az utolsó (v3.49.9–v3.49.10) sweepből:**
- A v3.49.9 migráció érintette a `enterprise_*` view-kat és a `set_updated_at` triggert — admin view-k (`enterprise_org_pulse_membership`) `security_invoker=on` lett, ami **megváltoztathatja** mit lát a superadmin egy view-ban (caller jogai, nem creator). Ezt explicit ellenőrizni kell az admin felületen.
- v3.49.10 audit csak read-only volt → onnan regresszió nem várható.

## Mit fogok csinálni (build módban)

### 1. Új mappa: `AI_PROMPTING_FOLDERSTRUCTURE/admin/`
Per-feature mély technikai promptok — minden fájl szigorú struktúrában:
- Feladat / Scope
- Komponens-fa + fájlhivatkozások (sorszámmal)
- Adat-kontraktus (táblák, RPC-k, RLS policy-k, GRANT-ek)
- State machine / lifecycle
- Security / authorization (role + tier gate)
- i18n kulcs-namespace
- Audit-log követelmények
- E2E acceptance kritériumok
- Regression-protection lista (mit ne törj el)

### 2. Konkrét fájlok (8 db prompt + 1 index)
```
AI_PROMPTING_FOLDERSTRUCTURE/admin/
  00_INDEX.md                                  (router + read order)
  01_workspace_admin_dashboard.md              (AdminDashboard)
  02_workspace_admin_users.md                  (AdminUsers + direct-create + tier-role gate)
  03_superadmin_control_plane_shell.md         (Superadmin.tsx + tab routing)
  04_superadmin_tenant_management.md           (list/filter/create/tier-change)
  05_superadmin_impersonation.md               (security-kritikus, külön fájl)
  06_superadmin_feature_tiers_tab.md           (átemeli + bővíti a meglévő superadmin_spec.md-t)
  07_superadmin_platform_audit_log.md          (PlatformAuditLogTab)
  08_admin_password_policy_and_reset.md        (közös policy mindkét admin szintre)
```

### 3. Regresszió-check az utolsó sweepre
Olvasom a `SuperadminControlPlane.tsx`-t és bármely `enterprise_*` view-t hívó admin komponenst, ellenőrzöm hogy a `security_invoker=on` váltás után a superadmin role látja-e azokat (vagy explicit GRANT/policy kell). Ha találok regressziót → külön versioning + javítás, **nem ebbe a PR-be**.

### 4. Hivatkozások bekötése
- `AGENTS.md` és `CLAUDE.md` read-order kibővítése: új `admin/00_INDEX.md` belekerül, hogy minden admin-érintő fejlesztési session kötelezően olvassa.
- `docs/tiering/superadmin_spec.md` legacy-marker + redirect az új `06_…` fájlra (nem törlöm, hogy ne legyen regresszió a tiering doc-láncban).

### 5. Versioning + marketing_value
- `versioning/04062603_v3.49.11_admin-deep-prompts.md`
- `marketing/marketing_values/20260604_v3.49.11_admin-deep-prompts_marketing_value.md` (internal-only enablement)
- `CHANGELOG.md` v3.49.11 entry

### Mit NEM csinálok ebben a PR-ben
- Nem írok át admin UI kódot.
- Nem futtatok DB-migrációt.
- A v3.49.9 view-váltás esetleges regressziójának **javítása** külön PR lesz, ha az audit talál ilyet.

## Megerősítés kérek
Jó-e az `AI_PROMPTING_FOLDERSTRUCTURE/admin/` útvonal, vagy inkább `docs/admin/` legyen? (Az előbbi mellett szól, hogy ez a "promptok AI dev-hez" konvenció a repodban; az utóbbi mellett, hogy a végfelhasználói `docs/help/`-pel egy fán lenne.)
