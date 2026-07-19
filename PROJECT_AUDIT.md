# Effectime Enterprise — projektátvételi és release-audit

Audit dátuma: 2026-07-17–19
Repository: `C:\Work\Github\effectime-app-enterprise-a95029a1`
Remote: `HenrikFaul/effectime-app-enterprise-a95029a1`
Auditált main HEAD: `a5a79136dcd003bf73b208f20febc470960ee173`
Munkabranch: `codex/ical-entitlement-parity`

## 1. Átvételi összkép

**BIZONYÍTOTT:** a korábbi „egyetlen magyar landingoldal” következtetés hibás
volt, mert a `C:\Work\effectime-app-enterprise` útvonalon lévő, kilenc commitból
és 73 fájlból álló másik checkout alapján készült. Ez az audit kizárólag a
felhasználó által megadott `C:\Work\Github\effectime-app-enterprise-a95029a1`
repositoryra vonatkozik.

**BIZONYÍTOTT:** a helyes repository a teljes Effectime Enterprise terméket
tartalmazza: 834 elérhető alapcommit, a candidate-del 1 481 követett fájl, 148
jelenlegi enterprise UI-fájl, 125 helyi SQL-migráció és 30 Edge Function-könyvtár. A publikus oldal,
auth, workspace shell, tagság/RBAC, naptár, szabadság, jóváhagyás, jelenlét,
payroll, szervezet, erőforrás, projekt/Gantt/Agile, riport, analitika, API,
webhook, biztonság és beállítások valós route-okba és futási útvonalakba vannak
integrálva.

**BIZONYÍTOTT:** a felhasználó hat, az `effectime.app` teljes alkalmazását mutató
képernyőképet adott; ezek összhangban vannak a repository route-jaival és
moduljaival. Az élő root és a felderített assetek ugyanazt a stabil provider-
deployment ID-t adják, de a release manifest 404. **BIZONYTALAN:** hitelesített
interaktív app-smoke és manifest nélkül az élő artifact pontos Git commitja és a
lokális javítások production státusza nem azonosítható bizonyosan.

**Release-döntés:** a termék működő, integrált alkalmazás; nem landing-only.
Az auditált következő backend release azonban **nem release-kész**, mert a
repository és a linked adatbázis migrációtörténete nem reprodukálható egymásból,
a clean replay 104/125 sikeres fájl után a 105. migrációnál hiányzó lokális DDL-re
fut, a generált public sémából 30 tábla, 1 view, 46 függvény és 2 enum eredete
nem bizonyítható migrációval, és a dokumentált többlépcsős approval chain nincs
bekötve a döntési runtime-ba. Az ebben a branchben készült javítások nincsenek
deployolva és nem lettek a linked adatbázisra alkalmazva.

### Rövid architektúra

| Réteg                 | Technológia és felelősség                                                       | Fő belépési pont                                        |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Publikus web          | React 18, TypeScript, Vite, React Router, SEO/PWA                               | `src/main.tsx`, `src/App.tsx`, `/` és pilléroldalak     |
| Alkalmazás            | TanStack Query, Tailwind, Radix/shadcn, i18n                                    | `/app`, `/w/:workspaceId`, `src/pages/Enterprise.tsx`   |
| Android / iOS         | Capacitor 8, közös React forrás, `dist-mobile`, PKCE, secure storage és natív CSP | `android/`, `ios/`, `MobileRuntimeBridge.tsx`           |
| Auth                  | Supabase Auth: email/jelszó, OAuth, reset, invite                               | `src/hooks/useAuth.tsx`, `src/pages/Auth.tsx`           |
| Tenant/RBAC           | workspace membership, owner/resourceAssistant/member, konfigurálható permission | `enterprise_memberships`, `enterprise_role_permissions` |
| Előfizetés            | tenant tier + add-on + override, frontend és szerveroldali gate                 | `src/hooks/useFeature.ts`, entitlement RPC-k            |
| Adatplatform          | Supabase PostgreSQL, RLS, RPC, Storage, Realtime                                | `supabase/migrations/`                                  |
| Privilegizált backend | Deno/Supabase Edge Functions, pg_cron, Vault                                    | `supabase/functions/`, `supabase/config.toml`           |
| Integráció            | Microsoft Graph, Jira/Azure DevOps, Gemini, Anthropic, email/webhook            | Edge Functionök és integration táblák                   |
| Deploy                | Vercel-kompatibilis SPA + külön Supabase release                                | `vercel.json`, `public/_headers`, `public/_redirects`   |

Külön hagyományos backend szerver nincs. A privilegizált műveletek PostgreSQL
RPC-kben és Edge Functionökben futnak. A web, Android és iOS ugyanazt a React
forrást, publikus Supabase project-konfigurációt, Auth/RLS/RPC/Edge adatforrást
használja; a natív kliensek külön CSP-hardened, egymással byte-azonos
`dist-mobile` artifactot kapnak. A Keychain/AndroidKeyStore session adapter és a
natív CSP elkészült, de aláírt/store release továbbra sincs igazolva; signing,
verified links, macOS/native CI és fizikai secure-storage/CSP/device smoke
kötelező release-kapu.

## 2. Vizsgált források

- Teljes repository-fa: `src/`, `public/`, `supabase/`, `docs/`, `db-audit/`,
  `versioning/`, `marketing/`, `growth_strategy/`, konfigurációk és assetek.
- `README.md`, teljes `CHANGELOG.md`, üzleti rendszerreferencia, feature catalog,
  tier mátrix, role-permission mátrix, user manual, technikai architektúra és
  verzióspecifikációk.
- TODO/FIXME/HACK/XXX/DEPRECATED/placeholder keresések, halott importok,
  nem mountolt komponensek, route-ok, tabok és feature gate-ek.
- Git remote, branchek, 834 alapcommit, commitüzenetek, tagek, stash-ek és release-ek.
  Tag és stash nincs; a repositoryhoz nem találtunk ki külön issue-követelményt.
- `package.json`, lockfile-ok, Node/npm engine, Vite, TypeScript, ESLint, Vitest,
  Tailwind, PWA, Vercel, Capacitor és GitHub Actions.
- A generált, verziókezelendő `android/` és `ios/` platformprojektek, natív
  manifest/plist, deep-link szerződés, PKCE bridge, lifecycle, PWA-elválasztás,
  Keychain/AndroidKeyStore session adapter, migráció, mobil CSP, külön build,
  mobile contract, komponensszintű cold/warm callback és natív E2E tesztek.
- Mind a 125 lokális migráció, generált Supabase típusok, RLS/policy-k, RPC-k,
  30 Edge Function-könyvtár és az összes runtime caller.
- Linked Supabase migrációlista és read-only `db lint`; generált/live sémaobjektum-
  inventory. Nem futott production write, deploy vagy linked migráció-apply.
- Izolált PostgreSQL/Supabase replay, célzott PG18 migration compile és access-
  szemantikai tesztek, valamint pinned PostgreSQL 18.4 payroll snapshot contract
  trusted extensions-schema owner/CREATE ACL-, pgcrypto-location és extension-
  membership-, digest-, runtime TRUNCATE-, trigger-, exact auditált break-glass
  rollback-, lock/reopen- és actor-demotion konkurenciavizsgálattal. Emellett npm
  audit, typecheck, Vitest, production build és ESLint-baseline.
- A felhasználó által adott hat, az élő teljes alkalmazást mutató képernyőkép; az
  in-app interaktív browser smoke webview-csatlakozási hiba miatt nem futott le.
- Current-tree secret scan 1 437 követett és nem ignorált untracked szövegfájlon,
  plusz tracked mobil signing-key fájlnév tiltással.
  Követett service-role kulcsot vagy privát
  provider secretet nem találtunk; teljes historikus secret scan még nyitott CI-tétel.

CodeGraph index (`.codegraph/`) ebben a repositoryban nincs. Az audit tiszteletben
tartotta a `db-audit/ambiguous_items_reeval_v3.42.1.md` elvét: bizonytalan
adatbázis-objektumot nem töröltünk.

## 3. Requirement Traceability Matrix

| ID    | Követelmény / funkció                 | Forrás                            | Bizonyosság                         | Implementáció helye                             | Integrált?            | Tesztelt?           | Dokumentált? | Állapot                                 | Teendő                   |
| ----- | ------------------------------------- | --------------------------------- | ----------------------------------- | ----------------------------------------------- | --------------------- | ------------------- | ------------ | --------------------------------------- | ------------------------ |
| R-001 | Teljes webapp és workspace shell      | `App.tsx`, modulok, screenshotok  | BIZONYÍTOTT                         | `src/App.tsx`, `Enterprise.tsx`                 | igen                  | build/local smoke   | igen         | kész                                    | live deploy SHA          |
| R-002 | Workspace, tagság, invite, RBAC       | feature catalog, role matrix      | BIZONYÍTOTT                         | member UI, membership/invite RPC/RLS            | igen                  | kontrakt+PG         | igen         | hardeningelt lokálisan                  | staging E2E              |
| R-003 | Szabadság, kvóta és privát láthatóság | user manual, data reference       | BIZONYÍTOTT                         | leave UI, quota táblák/RPC                      | igen                  | kontrakt+PG         | igen         | kvóta/refund/privacy javítva            | staging fixture          |
| R-004 | Jóváhagyás / elutasítás               | APR-001–003, docs                 | BIZONYÍTOTT                         | `ApprovalInbox`, `decide_leave_request`          | igen                  | kontrakt+PG         | igen         | atomi/RBAC javítva                      | chain: R-005             |
| R-005 | Többlépcsős approval chain            | master spec, UI/config táblák     | BIZONYÍTOTT                         | chain editor létezik; döntési RPC nem használja | nem                   | nincs runtime teszt | igen         | nem integrált P1                        | tervezés+implementáció   |
| R-006 | Naptár és kapacitástervező            | screenshot, CAL/RES catalog       | BIZONYÍTOTT                         | calendar/resource komponensek                   | igen                  | unit/build          | igen         | működő                                  | E2E                      |
| R-007 | Jelenlét és payroll export            | screenshot, TA/payroll docs       | BIZONYÍTOTT                         | attendance/payroll UI+Edge+RPC                  | igen                  | contract+unit+Edge+PG18 | igen      | immutable snapshot és atomi lock/export javítva lokálisan | szemantikai döntés+staging |
| R-008 | Erőforrás, projekt, Gantt, scenario   | screenshot, CHANGELOG             | BIZONYÍTOTT                         | `ResourcesTab`, scenario RLS                    | igen                  | kontrakt            | igen         | gate/correlation javítva                | DB E2E                   |
| R-009 | Jira/Azure DevOps/Agile               | screenshot, AGL catalog           | BIZONYÍTOTT                         | Agile UI, `jira-devops-proxy`                   | igen                  | security teszt      | igen         | authz/tier/SSRF alap javítva            | egress hardening         |
| R-010 | Szervezet, pozíció, skill mátrix      | screenshot, org docs              | BIZONYÍTOTT                         | Organization modul                              | igen                  | build               | igen         | működő                                  | browser E2E              |
| R-011 | Onboarding workflow                   | WFL catalog                       | BIZONYÍTOTT                         | onboarding UI/RLS/RPC                           | igen                  | kontrakt+PG         | igen         | exact tier+tenant guard javítva         | E2E                      |
| R-012 | Access systems/templates/inbox        | WFL catalog, UI                   | BIZONYÍTOTT                         | workflow UI, access táblák/RPC                  | igen                  | kontrakt+PG         | igen         | tier+tenant+atomi ledger javítva        | E2E                      |
| R-013 | Riport builder és schedule            | CHANGELOG, report UI              | BIZONYÍTOTT                         | `run-report`, scheduled reports                 | igen                  | 36+11 teszt         | igen         | kontrakt javítva                        | staging DB fixture       |
| R-014 | Analitika, wellbeing, executive       | screenshot, feature catalog       | BIZONYÍTOTT                         | analytics/wellbeing komponensek                 | igen                  | részben             | igen         | live RPC drift kockázat                 | DB lint javítás          |
| R-015 | Decision Memory                       | CHANGELOG/help                    | BIZONYÍTOTT                         | approval UI + decision memory RLS               | igen                  | kontrakt            | igen         | bekötve és tier-gated                   | smoke                    |
| R-016 | Microsoft 365 szinkron                | UI, CHANGELOG                     | BIZONYÍTOTT kimenő                  | `ms365-sync`                                    | kimenő igen           | security kontrakt   | részben      | OAuth/cron hardeningelt                 | inbound döntés           |
| R-017 | AI Copilot                            | CHANGELOG v3.27                   | BIZONYÍTOTT                         | `ai-copilot`, Copilot UI                        | igen                  | security teszt      | igen         | ownership/rate/PII/tier javítva         | provider smoke           |
| R-018 | Dokumentumgenerátor/AI polish         | CHANGELOG v3.26                   | BIZONYÍTOTT                         | document UI+Edge                                | igen                  | security teszt      | igen         | sandbox/authz/tier javítva              | DPA+staging              |
| R-019 | Public API                            | CHANGELOG v3.24, élő function     | BIZONYÍTOTT                         | `public-api`, developer portal                  | igen                  | contract/security   | igen         | source helyreállítva                    | staging key test         |
| R-020 | Kimenő webhook                        | CHANGELOG v3.24, élő function     | BIZONYÍTOTT                         | `webhook-dispatcher`                            | runtime source igen   | 15 teszt            | igen         | auth/lease/SSRF/tier javítva            | DDL/producers reconcile  |
| R-021 | Email queue és tranzakciós email      | template registry/callerek        | BIZONYÍTOTT                         | email Edge Functionök, cron                     | igen                  | kontrakt            | részben      | auth/idempotency javítva                | provider integration     |
| R-022 | Feature tier/add-on enforcement       | tier docs                         | BIZONYÍTOTT                         | hook, RPC, Edge, RLS                            | igen                  | több kontrakt+PG    | igen         | kritikus bypassok javítva               | teljes table inventory   |
| R-023 | Fióktörlés                            | UI, feature catalog               | BIZONYÍTOTT                         | `delete-account`                                | igen                  | 25 teszt            | részben      | fail-closed, nem atomi                  | retention workflow       |
| R-024 | Embed SDK/views                       | CHANGELOG v3.44–3.51              | BIZONYÍTOTT                         | `/embed/:view`, embed RPC-k                     | igen                  | korábbi suite       | igen         | működő, header/token kérdés nyitott     | security design          |
| R-025 | PWA / Android / iOS, közös adatforrás | explicit felhasználói kérés + mobile spec + runtime | BIZONYÍTOTT | PWA + Capacitor Android/iOS + közös Supabase client + PKCE + secure storage + CSP | foundation igen | 93 contract/component + 2 E2E + build/sync + hosted Android/iOS | igen | secure implementation, candidate source, exact Swift lock és hosted unsigned native build kész; store release NO-GO | signing/verified links/device evidence |
| R-026 | Import és data migration              | UI/Edge registry                  | BIZONYÍTOTT                         | import Edge Functionök                          | igen                  | security contract   | részben      | auth javítva, tranzakciósság nyitott    | resumable design         |
| R-027 | Közvetlen tenant user creation        | CHANGELOG v3.33, paid feature     | BIZONYÍTOTT                         | `create-workspace-user`                         | fail-closed           | 6 kontraktteszt     | most igen    | biztonságosan letiltva, funkcióhiány P1 | provisioning döntés      |
| R-028 | Reprodukálható DB/CI/release          | repo konvenció, migration history | BIZONYÍTOTT                         | migrations, lock, provenance CI                 | frontend igen; DB nem | ratchet+replay      | igen         | no-new-debt kapu kész; DB release blokkolt | history/schema reconcile |
| R-029 | HR task-kérés sorrend és lifecycle    | runtime call path + reprodukált komponens-race | BIZONYÍTOTT              | `HRWorkflowInbox.tsx`                           | igen                  | 4 concurrency teszt | igen         | PR #169-ben mainre merge-elve             | production publish       |
| R-030 | iCal/admin-override entitlement paritás | tier/permission docs + UI/DB/Edge call path  | BIZONYÍTOTT              | `WorkspaceDashboard`, `ICalSubscription`        | igen                  | 8 komponens + 28 contract | igen      | PR #170-ben mainre merge-elve; fail-closed downgrade/revoke UX | production publish |
| R-031 | Kérelem létrehozása más nevében + opcionális admin auto-approve | APR-004 UI/RPC call path | BIZONYÍTOTT frontend / részleges szerver | `AdminLeaveOverride`, `create_admin_leave_override`, request listák | frontend igen | 23 komponens-race + statikus contract; dinamikus DB részleges | pontosítva | frontend hotfix candidate; teljes APR-004 NO-GO | szerepkör-egységesítés, PG18/staging/idempotencia |

## 4. Megtalált és kijavított hiányok

Az alábbi lista az audit során elkészült csomagokat foglalja össze; a pontos
`main`/candidate/production állapotot az implementációs és validációs táblák
státuszoszlopai jelzik:

- Helyes checkout és teljes termékmodell; a landing-only állítás visszavonva.
- Valós `tsc -b` typecheck, npm-only lock, halott TanStack Start/Lovable auth kód
  eltávolítása, friss lockfile, `.env.example` és GitHub quality workflow.
- Fail-closed feature gate-ek és azonos nav/content entitlement; Gantt és Decision
  Memory tényleges runtime-integráció.
- Dokumentum preview sandbox/CSP; internal redirect normalizálás.
- A kézi `/src/main.tsx` modulepreload eltávolítása: a production buildben ez
  `application/octet-stream` data URL-ként böngésző-MIME hibát okozott. A
  production preview smoke most a JavaScript/CSS MIME-ot, manifestet, favicont,
  service worker regisztrációt és a 320/390/768 px nézeteket is ellenőrzi.
- Edge Function request-auth helper, explicit gateway policy, action-specifikus
  RBAC/tier, kontextusos hibák és idempotencia az érintett funkciókban.
- M365 OAuth state TTL/one-use/membership/canonical redirect és Vault-kötött cron.
- Jira, AI, dokumentum, public API, webhook, iCal, riport, payroll, email,
  unsubscribe, import és account-delete határok célzott megerősítése.
- A payroll számítás, zárolás és CSV-export kizárólag typed Edge-szerződésen fut;
  fail-closed entitlement, UUID- és válaszvalidáció, 11 provider allowlist,
  determinisztikus lapozás és felső korlát, CSV-injection védelem került bele. Az
  open időszak számítása élő, a locked/exported időszak számítása és exportja csak
  az eltárolt, verziózott snapshotot használja; a legacy snapshot-hiány explicit
  409. A canonical JSON SHA-256 digestjét Edge és PostgreSQL is ellenőrzi, a
  lock/export állapot és elsődleges audit egy tranzakcióban íródik. A nem
  implementált direct provider API explicit HTTP 501-et ad. Közvetlen
  `service_role` reset és transition-audit manipuláció tiltott; a break-glass
  reopen csak aktív adminnal, POSIX-whitespace normalizálás után 8–1000 karakteres
  indokkal és a teljes előző védett állapotot bitazonosan őrző atomi audittal
  végezhető. A `payroll_periods` és `enterprise_audit_events` runtime `TRUNCATE`
  joga PUBLIC/anon/authenticated/service_role számára explicit tiltott; lock,
  reopen és párhuzamos actor-demotion sorzáras szerződése PG18-on igazolt.
- A workspace AuditLog kizárólag `id`, `action`, `actor_id`,
  `affected_user_id`, `created_at`, `metadata` mezőket kér a böngészőbe;
  `prev_state`, `new_state`, IP-cím és user-agent nem kerül a kliens payloadba.
  A renderelt `metadata` tartalma továbbra is szerveroldali adatminimalizálási
  felelősség.
- Credential-oszlop és érzékeny RPC EXECUTE revoke-ok; anon/public surface
  csökkentése az új migrációkban.
- Atomi invite issue/reissue/accept, mailbox-email autoritás, concurrency lock,
  tenant-local role/skill/materialization és idempotens email fingerprint.
- Direct tenant password creation fail-closed a globális identity-preclaim hiba
  miatt; invitation flow megmaradt.
- Membership/role/permission owner boundary, tenant-local FK-k, közvetlen delete
  tiltás, configured approval permission szerveroldali érvényesítés.
- Leave decision/admin override/decision ledger atomi RPC; privát leave RLS;
  kvóta cross-tenant correlation; consume nélküli refund-infláció megszüntetése.
- Onboarding/access/scenario/rate/payroll/capacity/decision-memory direct RLS
  entitlementek; access request decision + ledger atomi RPC és immutable guard.
- Öt historikus migráció clean-replay szintaktikai/signature javítása. Ezek
  alkalmazott historyn nem írhatók felül automatikusan; reconcile szükséges.
- Öt új, additív v3.51.3 migráció és célzott regressziós/security tesztek; az
  ötödik az immutable payroll snapshotot, DB-oldali digest/member/totals
  validációt, védett státuszátmenetet és atomi lock/export RPC-ket vezeti be.
- Exact generated-schema provenance ratchet: a 30/1/46/2 ismert hiány nem nőhet
  és review nélkül nem is írható át; ez regresszióvédelem, nem DDL-pótlás.
- Production-safe Capacitor 8 konfiguráció és repository-local Android/iOS projektek
  `app.effectime` javasolt identitással, távoli preview/cleartext nélkül. Mindkét
  platform ugyanazt a buildelt React bundle-t és Supabase adatforrást használja.
- Natív PKCE + system-browser auth, cold/warm deep-link bridge, lifecycle token
  refresh, recovery-session védelem és implicit custom-scheme token tiltás.
  Kanonikus invite/booking/embed linkek nem öröklik a WebView lokális originjét.
- Android cleartext és backup tiltás; natív runtime-ban PWA worker/install prompt
  tiltás; tokenes 404/navigation cache naplózás megszüntetése és régi runtime
  cache verzióváltással történő ürítése.
- Exact-pinned Keychain/AndroidKeyStore Supabase session adapter háromkulcsos
  allowlisttel, project-bound envelope-pal, write/readback-verifikált legacy
  migrációval, iOS reinstall markerrel, Supabase-kompatibilis mutexszel és
  kétlépcsős fail-closed recovery UX-szel; natív insecure fallback nincs.
- Külön `dist-mobile` build exact-origin WebView CSP-vel; nincs wildcard
  Supabase, `unsafe-eval`, inline script vagy webes JSON-LD/PWA asset. Android és
  iOS ugyanazt az artifactot kapja; a publikus web SEO/PWA build változatlan.
- Natív raw-token session-swap tiltás minden custom/HTTPS app-link route-on;
  logout revokációs hiba esetén atomi local purge; reset latch és best-effort
  secure/legacy cleanup. A Swift sync-utak platformfüggetlenek, az artifactkapu
  teljes fájdfa SHA-256 egyezést és exact kétplatformos plugin allowlistet mér.
- A natív/CI forrás és a hosted Xcode által generált, review-zott
  `Package.resolved` külön candidate commitokban rögzítve van. A release-kapu
  clean worktree-n 363/363 PASS, exact identity/URL/verzió/revízió allowlisttel.
- A macOS CI lock nélküli első PR-futásnál review-artifactként bootstrapolta a
  `Package.resolved` fájlt, majd fail-closed leállt; fordítás csak commitolt lockkal,
  release-ellenőrzés után és `-onlyUsePackageVersionsFromResolvedFile` módban indul.
- A HR task request lifecycle javítás PR #169-ben mainre került; a main merge
  SHA mind a hét hosted Quality jobja zöld.
- Az iCal/admin-override candidate az entitlement lookup loading/error állapotát
  fail-closed kezeli, a szűkített approval/override admin profil Requests fülét
  megtartja, és role szerint választja szét a személyes/team feed létrehozást.
  A `settings=none` alap member/resourceAssistant profil a mindig elérhető saját
  portálon kapja meg ugyanazt az iCal kártyát; settings-jogosultsággal a korábbi
  Beállítások hely marad meg, így a workspace-konfiguráció nem szélesedik ki.
  Downgrade esetén a bearer URL/copy rejtett, a saját dormant token revoke-ja
  elérhető marad. Workspace/user váltás azonnal törli a token state-et; stale
  válasz/error és unmount utáni toast tiltott; az ikonműveletek lokalizált
  accessible nevet kaptak.
- Az admin által más nevében létrehozott kérelem fél napnál a kezdő dátumot
  használja effektív végdátumként, teljes napnál továbbra is explicit végdátumot
  kér. A validáció az exact workspace/tag/típus/dátum/félnap kontextushoz kötött,
  a technikai hiba fail-closed és újrapróbálható, az elavult validációs és
  tagkönyvtár-válaszok pedig nem írhatják felül az aktuális sessiont. Siker után
  mindkét lista frissül; a listák későn beérkező base/enrichment válaszait és a
  jogosultság-szűkítés előtti széles lekérdezést generációs guard dobja el.
  Célzottan 16 admin-flow + 7 lista-race, a kapcsolódó contractokkal 75/75 teszt
  PASS; szerveroldali szerepkör-, idempotencia- és dinamikus PG18 bizonyíték nyitott.

## 5. Hiányok és kockázatok

### P0

| Tétel | Bizonyíték | Hatás / kockázat | Kötelező javítás és elfogadás |
| --- | --- | --- | --- |
| HR workflow tenant-boundary / IDOR | A live és történeti `hr_workflow_create_instance` nem validálja `p_membership_id` workspace-ét; az instance/task member policy-k nem korrelálják a membership workspace-ét és nem mindenhol követelik az aktív státuszt; az update/list RPC-k joinjai ugyanezt a globális UUID-feltételezést viszik tovább. A legacy globális FK-k cross-tenant `CASCADE`/`SET NULL` adatvesztést is lehetővé tesznek. A hiba már a remote `20260511163148 create_hr_workflows` migrationben jelen van. A candidate `20260719000000_v3_51_3_hr_workflow_tenant_boundaries.sql` forward-only trigger/RLS/RPC/ACL/parent-guard javítást ad, és nem ír át legacy sort. | Cross-workspace referencia létrehozása, más tenant workflow-jának olvasása, inactive assignee ismert task UUID-val történő módosítása, admin listában kereszt-tenant név/e-mail összekapcsolás és idegen workspace taskjának parent-kaszkádos törlése lehetséges. **BIZONYÍTOTT kód/history finding; a candidate célzott PostgreSQL-contractja zöld, de production rollout nem történt.** | A kódoldali javítás elkészült; `npm run db:hr-workflow:test` két tenanttal, authenticated RLS/RPC, inactive-assignee, list-leak, parent-delete, reapply és négy determinisztikus race esettel PASS. Production GO előtt kötelező az aggregált restored-staging inventory, non-zero sorok jóváhagyott data-preserving rendezése, history reconcile és teljes staging acceptance. |

### P1

| Tétel                                       | Üzleti/technikai indok és bizonyíték                                                                                                                                                                             | Érintett terület                                       | Kockázat, függőség, méret                                     | Elfogadási kritérium / teszt / dokumentáció                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| DB history és schema drift                  | 59 közös migration ID; **65 local-only**; 84 remote-only. Három local-only HR/office/analytics fájl remote migrationök eltérő ID alatti tartalmi duplikátuma. A clean replay 104/125 után a `plugin_webhook_events` hiányán áll meg. A generált public felület 165 tábla/4 view/99 függvény/11 enum; ezekből 30/1/46/2 helyi DDL-je nem bizonyított. Hat attendance tábla a `d4a441a4` types-only commitban, további 21 tábla a `7c59e9a7` „Regenerate types.ts from live DB” commitban jelent meg; a `b952a466` v3.6 commit 24 frontend/test/docs fájlt és 0 SQL-t adott hozzá. | `supabase/migrations`, generated types, git history    | hibás deploy vagy repair; backup+staging kell; XL             | remote statement/hash manifest; duplikátum-besorolás; transitívan teljes recovery migration; clean shadow replay; regenerated-types/schema fingerprint diff; DB lint/RLS teszt; bulk `migration repair` tilos |
| Linked DB lint                              | read-only `supabase db lint --linked --level warning`: 7 error, 6 warning                                                                                                                                        | compliance/webhook/analytics/onboarding/password RPC-k | runtime hiba; a history reconcile előfeltétel; L              | 0 error; pgTAP/integration; caller smoke; changelog                                                               |
| Approval chain nincs runtime-ban            | chain editor/táblák és `step_order` dokumentált, de `decide_leave_request` nem választ stepet/approvert; első jogosult véglegesít                                                                                | approval UI/RPC/schema                                 | kiadott fő funkció nem teljes; L/XL                           | step/approver modell; sorzár; rész-döntések; végső státusz csak utolsó stepnél; concurrency/E2E; migrációs leírás |
| `instant_member_create` biztonságos pótlása | v3.33 dokumentált fizetős funkció; régi admin-confirmed email globális identityt foglalhatott; most 409 fail-closed                                                                                              | user provisioning/auth/invite                          | funkciókompatibilitás; product+security döntés; L             | SCIM/domain vagy mailbox-verified activation; cross-tenant adversarial teszt; admin UX és migration note          |
| Fióktörlés nem atomi                        | GoTrue delete és DB cleanup nem egy tranzakció; a preflight csak ismert FK-ket fed                                                                                                                               | `delete-account`, retention                            | részleges törlés / blokkolt GDPR-flow; jogi döntés; XL        | retention policy; job/RPC+kompenzáció; retry/idempotency/concurrency; audit és runbook                            |
| Webhook/API DDL és producer provenance      | live/repo function source helyreállt, de egyes delivery/config objektumok és producer-ek helyi eredete nem teljes                                                                                                | public API/webhook                                     | következő clean deploy nem reprodukálja a live viselkedést; L | helyi DDL+producer inventory; staging key/revoke/rate/delivery/SSRF E2E; source↔deploy checksum                   |
| Data migration részleges commit             | több entitás egymás után íródik, hiba esetén részleges eredmény/HTTP-eredmény lehetséges; nincs teljes resumable checksum                                                                                        | `data-migration`, import                               | ismétlés/duplikáció/kevert állapot; L                         | manifest+checksum; idempotens resume; hibastátusz; fixture és rollback doc                                        |
| Deploy provenance és provider lánc          | A main merge SHA és CI artifact bizonyított, de a jelenlegi `effectime.app` Lovable/Cloudflare deploymentje nem köthető Git SHA-hoz; a Lovable webhook HTTP 405. A release-identity kód ebben a következő candidate branchben elkészült, productionben még nincs. | frontend/Edge/DB release | rollback és audit nem reprodukálható; M | élő `/.well-known/effectime-release.json`; Edge body/header SHA; provider deployment-ID↔SHA rekord; fail-closed verifier; azonos commitból háromrétegű deploy |
| Payroll időszak/rate/export szemantika      | Tetszőleges részidőszakhoz teljes havi attendance aggregate kerülhet; a rate-választás latest-all; a v1 szerződés az ISO pénznemkódot validálja, de tagonként eltérő pénznemeket egyetlen `total_gross` mezőbe összead (a contract teszt EUR+USD összeget is elfogad); az attendance/leave/rate HTTP-olvasások nem egyetlen MVCC snapshotból készülnek. A lock/export és elsődleges audit már atomi, a snapshot immutable és DB-digestelt. | payroll Edge/DB/domain                                 | magas pénzügyi eltérés vagy időközi read drift; termékdöntés és egyetlen DB-számítási határ kell; L | full-month vagy napi canonical szabály; rate-as-of/effective-to; v1 single-currency vagy v2 per-currency totals; egy statement/transaction számítás; concurrency+staging fixture; legacy snapshot inventory/remediation |
| Natív store release biztonsági kapuk        | Android/iOS és CI forrás, PKCE, Keychain/AndroidKeyStore adapter, exact-origin CSP, hosted Android build és locked Xcode 26.5 simulator build kész; nincs store reservation/signing, verified HTTPS link, jóváhagyott brand asset vagy fizikai smoke | mobile auth/platform/release | signing/scheme ownership, OS-integráció és rollback kockázat; L | app ID/team/cert; AASA/assetlinks; device storage+CSP+auth smoke; signed internal rollout; `docs/mobile/README.md` |
| Admin-created leave szerver acceptance      | A frontend exact-kontekstukezelése és race-védelme bizonyított, de a repository csak statikusan ellenőrzi a `create_admin_leave_override` RPC-t; nincs teljes PG18 pozitív/negatív RBAC, tenant, audit, kvóta/rollback, konkurens duplikáció és actor-demotion futtatás. | admin override RPC/RBAC/audit | jogosulatlan vagy duplikált kérelem kockázata több kliens/retry esetén; M/L | egységes szerepkör-szerződés; idempotency key/unique ledger; pinned PG18 race suite; restored-staging acceptance |

### P2

| Tétel                               | Bizonyíték / kockázat                                                                                                                | Méret | Elfogadási kritérium                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------- |
| ESLint-adósság                      | 1 209 error + 104 warning 178 fájlban; ez a csomag további 9 errort, 4 warningot és 1 érintett fájlt szüntet meg a main baseline-hoz képest; a csökkentett fingerprint-baseline védi a javítást | XL    | modulonkénti csökkentés, baseline-frissítés, végül 0                |
| E2E/coverage                        | nincs teljes auth/workspace/RBAC/leave/payroll/integration böngészős release gate                                                    | L     | Playwright staging suite, fixture, coverage baseline                |
| Bundle-méret                        | I-22 hosted Linux candidate: JS 4 453 006 raw / 1 271 333 gzip; largest 1 739 506 / 551 837; CSS 180 798 / 29 589. Az I-21 tiszta main artifacthoz képest +5 092 raw / +1 511 gzip (+0,114% raw), largest +1 131 / +263. A hosted exact raw plafon 4 453 006, a total-gzip plafon 1 271 461 a korábbi 128-byte toleranciával; largest-gzip/CSS plafon nem nőtt. A Windows candidate 4 452 913 / 1 271 182 értékkel a plafon alatt marad. | M | további route split és regressziós mérés |
| Payroll provider config             | Nincs explicit default/unique aktív konfiguráció; több aktív sor esetén a `.maybeSingle()` hibázik                                    | M     | default mező vagy partial unique index; migration+concurrency teszt |
| Public function privilege inventory | linked baselineban 114 public function, 94 SECURITY DEFINER, mind anon executable volt; az új revoke-ok nem fednek teljes inventoryt | L     | funkciónként owner/search_path/ACL audit, negatív auth teszt        |
| M365 inbound ígéret                 | kimenő sync bizonyított, teljes tartós inbound OOF integráció nem                                                                    | M     | scope döntés, implementáció vagy marketingkorrekció                 |
| Embed security contract             | statikus frame header és embed cél, illetve token tárolás/rotáció nincs egységesen dokumentálva                                      | L     | origin allowlist, hash/rotation, cross-origin browser teszt         |
| DNS-rebinding egress                | Jira/webhook host/private-IP ellenőrzés alap szintű; nincs bizonyított egress proxy                                                  | M     | resolve+connect pinning vagy egress proxy; redirect/rebinding teszt |
| Dokumentum-AI adatkezelés           | technikai PII/authz javult, provider régió/DPA/retention termékjogi döntés                                                           | M     | DPA, régió, retention, user disclosure                              |
| Demo seed                           | nem minden paid modulhoz teljes/konzisztens fixture; tier-választás részben környezeti                                               | M     | verziózott seed manifest, deterministic fixture, teardown           |
| Chain config RBAC drift             | docs RA konfigurációt sejtet, a chain RLS owner-only; runtime chain amúgy is nyitott P1                                              | S/M   | approval-chain tervezésben egységes permission contract             |
| iCal credential lifecycle           | Demotion/inaktiválás/tier downgrade esetén az Edge 403-at ad, de a bearer token nem rotálódik vagy törlődik; későbbi reenable újraaktiválja. Owner más RA team tokenjét nem tudja inventoryzni/revokálni. | M | forward revoke/expiry modell, role/tier transition teszt, owner admin inventory |
| Feature-entitlement outage UX       | A feature RPC hibája minden top-level tab entitlementet fail-closed hamisra állít; paid akció nem szivárog ki, de a core shell és a dormant iCal token revoke UI is eltűnik a lookup helyreállásáig. | M | külön core/error recovery surface, revoke-only runtime teszt, retry/hibaállapot |
| Admin-override role szerződés       | backend bármely explicit `admin_override=edit` active role-t elfogad, a UI továbbra is admin szerepre szűkít; default member permission none | S | termékdöntés: hard admin role vagy teljesen konfigurálható permission |
| Kérelemlista hiba- és a11y UX       | Az obsolete eredmények már nem maradhatnak láthatók, de az `ApprovalInbox` és `LeaveRequestList` még nem ad tartós inline load-error/retry felületet; a valódi Radix dialog/select billentyűzet-, fókusz- és accessible-name út nincs böngészőteszttel igazolva | S/M | explicit retryable error state; keyboard/focus/a11y browser acceptance |
| OG/native/observability             | hiányzó OG asset; natív M365 Connect már fail-closed tiltott, de az OAuth-paritás, export/GPS/safe-area teljes device UX, secure telemetry és release marker/SLO nincs igazolva | M | asset/device smoke; platform adapterek; structured telemetry/release marker |

### P3

- Csak usage-bizonyítás után törölhető legacy UI/kód és régi auditdokumentum.
- Teljes i18n kulcs- és nyelvi konzisztencia-audit.
- Caniuse adatbázis és nem biztonsági transitive deprecationök ütemezett frissítése.
- Komponensenkénti típus/refaktor és render-optimalizálás.

## 6. Végrehajtási terv és visszaállítás

| Egység | Cél és pontos változás                     | Fájl/API/adatmodell-hatás                                                                                           | Teszt                          | Kompatibilitás / rollback / kész feltétel                                                                    | Állapot                    |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------- |
| I-01   | Checkout-azonosítás, architektúra és RTM   | audit/README, nincs runtime API                                                                                     | git/live evidence              | dokumentáció visszavonható; bizonyíték linkelt                                                               | kész                       |
| I-02   | Determinisztikus frontend toolchain        | `package*.json`, CI, valódi `tsc -b`; bun lock eltávolítva                                                          | ci/type/test/build/audit       | npm@11; lock visszaállítható; CI zöld                                                                        | kész                       |
| I-03   | Route/tab/feature runtime integráció       | app/shell/workflow/resource UI; nincs DB shape change                                                               | UI/static/unit                 | fail-closed; komponensenként revert                                                                          | kész                       |
| I-04   | Edge auth, tier, timeout, idempotency      | Edge request contract szigorodik; új közös helper                                                                   | esbuild/contract/security      | régi jogosulatlan hívás 401/403; functionenként rollback                                                     | kész lokálisan             |
| I-05   | DB security és tenant correlation          | `20260717130000..132000`; új RPC/policy/trigger/ACL                                                                 | PG18+contract                  | additív repair; policy/RPC migration rollback kell                                                           | kész lokálisan             |
| I-06   | Invite acceptance és provisioning boundary | `20260717133000`, invite UI/Edge                                                                                    | 6 contract+PG                  | invitation backward path megmarad; direct-create 409 dokumentált                                             | kész lokálisan             |
| I-07   | Leave/access döntés és ledger atomizálás   | `decide_leave_request`, `decide_access_request`, guardok, UI                                                        | concurrency/semantic/static    | direct decision write megszűnik; RPC rollback csak auditált migrationnel                                     | kész lokálisan             |
| I-08   | DB history reconcile                       | remote/local manifests, hiányzó DDL repair                                                                          | clean replay/schema diff/pgTAP | backup kötelező; semmit nem töröl automatikusan; 125/125 replay                                              | nyitott P1                 |
| I-09   | Multi-step approval runtime                | chain schema, approver resolution, partial decisions, UI                                                            | unit+PG concurrency+E2E        | meglévő single-step migrálható alap chainné; rollback feature flaggel                                        | nyitott P1                 |
| I-10   | Biztonságos instant provisioning           | SCIM/domain vagy verified activation                                                                                | auth/API/UI/migration          | invitation kompatibilis; cross-tenant identity teszt                                                         | emberi döntés              |
| I-11   | Staging/release                            | azonos SHA frontend+Edge+DB, smoke, release marker                                                                  | teljes staging suite           | backup/rollback artifact; production csak jóváhagyás után                                                    | blokkolt I-08/I-09-en, payroll szemantikán/legacy inventoryn és staging bizonyítékon |
| I-12   | Quality Gate & Runtime Safety Foundation   | SHA-pinnelt CI, fingerprint lint és coverage/bundle ratchet, production-preview Playwright, PII logger, AuditLog exact field-allowlist, két SBOM/provenance, runbookok | nincs DB/API shape változás    | Edge 30/30, 0 diagnostic, raw check PASS, 64/64 exact import, 0 unpinned; Deno izolált az npm tree-től; egy commitban visszavonható | lokális és hosted CI kész; release-process enforcement nyitott |
| I-13   | Payroll Edge/UI contract repair            | `payroll-export/index.ts`, contract/helper/tesztek, `PayrollPanel.tsx`                                  | Deno contract+check, Vitest    | direct provider hamis 200 helyett explicit 501; Edge/web együtt visszaállítható                                  | kész lokálisan; staging és termékdöntés nyitott |
| I-14   | Generated-schema provenance ratchet        | `scripts/ci/schema-provenance*`, exact baseline, package script és workflow                              | parser unit+current gate       | ratchet only; a 30/1/46/2 hiányzó provenance továbbra is release blocker                                      | kész lokálisan             |
| I-15   | Immutable payroll snapshot és DB contract  | `20260717134000_payroll_immutable_snapshots.sql`, snapshot helper, generated types, pinned PG18 fixture   | Deno+Vitest+PG18+concurrency   | trusted pgcrypto, TRUNCATE denial, exact audited `reopen_payroll_period_break_glass`, lock/reopen/demotion races; legacy locked/exported snapshot nélkül 409; rollout: payroll write pause, DB → Edge azonnal → web; régi Edge rollbackje az új DB-n nem biztonságos | kész lokálisan; staging/legacy inventory nyitott |
| I-16   | Android/iOS közös adatforrás foundation    | Capacitor config/package/lock, `android/`, `ios/`, mobile platform+bridge, auth/link/PWA/cache hardening, CI contract, mobil docs | typecheck+source/artifact/release contract+build+2x sync; hosted Android compile/lint/assemble és locked Xcode 26.5 simulator build zöld | web/API/DB kompatibilis; platform source git reverttel visszaállítható; app ID store-foglalás előtt módosítható | development foundation és unsigned native CI kész; signed store release NO-GO |
| I-17   | Natív session storage és CSP hardening     | secure-store adapter/envelope/migráció/recovery, verified reset tombstone, logout fallback, raw-token link tiltás, explicit project/storage key, `dist-mobile`, CSP transform, mobile E2E és CI allowlist | 93/93 mobile target, 183/183 source, 345/345 current artifact és 363/363 prior release contract, 2/2 mobile E2E, 586/586 current full suite, web 7/7, hosted Android+iOS | web login/callback/storage és SEO/PWA kompatibilis; a közös logout hibakezelése szándékosan fail-closed módon erősödött; nincs DB/API shape; package/config/source normál reverttel visszaállítható, local purge explicit | kód, emulált regresszió, exact Swift provenance és unsigned native CI kész; fizikai evidence nyitott |
| I-18   | Release Identity + Same-SHA attestation | determinisztikus web/mobile manifest, Vite client SHA, Edge health/platform-version body+header, Superadmin match UI, deploy verifier, CI/runbook | Node/Vitest/Deno/E2E/type/build | additív API mező/header; env hiányakor fail-visible unknown; normál git revert; production kész csak live verifierrel | PR #167-ben `main`-re merge-elve; live manifest/publish nyitott |
| I-19   | HR workflow tenant-boundary forward repair | `20260719000000...` migration locked trigger/RLS/RPC/ACL/private-helper/parent-guard korrekcióval; explicit admin/member inbox és fail-visible UX; történeti fájlok és legacy sorok változatlanok | két-tenant authenticated RLS/RPC + PG18 reapply/delete/catalog + négy determinisztikus concurrency race + UI data contract | meglévő hibás adat nem törölhető automatikusan; inventory és forward repair/rollback owner kell | PR #168-ban `main`-re merge-elve; restored staging/production nyitott P0 |
| I-20   | HR task request lifecycle hardening | per-instance in-flight dedupe, monoton request-generation, workspace/unmount invalidáció; nincs API/DB shape változás | 4 determinisztikus komponens-race + teljes unit/type/lint/build/bundle/smoke | régi válasz és hiba nem írhatja felül az aktuális tenant UI-state-et; egy frontend commit reverttel visszaállítható | PR #169-ben mainre merge-elve; run 29667441811 7/7 PASS |
| I-21   | iCal/admin override UI és token-state hardening | fail-closed permission/entitlement, approval-only Requests elérés, role-gated create, revoke-only downgrade UX, bearer request-generation, lokalizált accessible kontrollok | 8 komponens + 28 DB/Edge/static contract; teljes unit/type/lint/build/bundle/web+mobile smoke | nincs DB/API/dependency változás; saját dormant token törölhető; frontend commit reverttel visszaállítható; automatikus token-revocation külön P2 | PR #170-ben mainre merge-elve; run `29669034798` 7/7 PASS; production publish nyitott |
| I-22   | Admin-created leave és request-list race hardening | half-day exact dátum, kontextuskötött fail-closed validáció, tagkönyvtár readiness/retry, exception-safe submit, exact actor/workspace scope és monoton query-generation | 16 admin + 7 lista-race + 52 kapcsolódó célzott contract/unit; teljes unit/type/lint/build/bundle/web+mobile gate | nincs DB/API/dependency változás; frontend commit egyben reverttel visszaállítható; szerveroldali szerepkör/idempotencia külön kapu | teljes lokális Quality PASS; clean/hosted/PG18 még nyitott |

## 7. Ellenőrzések és eredmények

Az I-22 teljes lokális candidate kapuja az alábbiak szerint PASS. A tiszta,
commitolt release-artifact és a hosted kapu továbbra is külön bizonyíték; a
dinamikus PG18 admin-override acceptance nem része a frontend PASS-nak.

| Ellenőrzés                              | Eredmény                | Megjegyzés / fennmaradó kockázat                                                                                                                                   |
| --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci --no-audit --no-fund`           | PASS                    | lockfile-ból determinisztikus install                                                                                                                              |
| `npm run typecheck`                     | PASS                    | `tsc -b --pretty false`; nem a korábbi félrevezető `tsc --noEmit`                                                                                                  |
| Admin override I-22 célzott regresszió  | PASS KORLÁTTAL          | 16 admin-flow + 7 lista-race + 32 conflict-i18n + 20 runtime contract = 75/75; typecheck és diff check PASS. A dinamikus PG18 szerver acceptance még nyitott. |
| Release identity unit/UI contract       | PASS                    | Node 55/55 + Vitest 9/9: strict full-SHA és clean HEAD, deterministic per-file web/mobile fingerprint, immutable Edge source-tree, source/header/origin eltérés, same-SHA stale Edge, Superadmin match/mismatch/unknown/error |
| `release:verify:deployment`             | LOKÁLIS CONTRACT PASS / LIVE FAIL | A fail-closed verifier unit 27/27; a jelenlegi `effectime.app` még nem szolgál release manifestet, és a Lovable/Cloudflare immutable deployment-ID header/API mapping sincs igazolva, ezért production attestation NO-GO. |
| Mobile target suite                     | PASS                    | 93/93 célzott teszt: URL/origin, PKCE/deep-link és HTTPS raw-token tiltás, secure envelope/migráció/reinstall/reset tombstone/logout lock, recovery UX, CSP transform, native bridge és internal path |
| `mobile:check:source` / `mobile:check`  | PASS                    | 183/183 source és 345/345 build/sync assertion: exact dependency integrity/kétplatformos plugin allowlist, release identity, teljes artifact-fájdfa és négy üres Capacitor shim SHA-256, CSP, identity/deep link/minimumok, auth/data-source/CI, iOS lock-bootstrap és natív build-artifact lint-ignore contract |
| `npm run mobile:check:release`          | PASS                    | Clean, commitolt candidate forráson 363/363: a hosted-Xcode lock kizárólag Capacitor 8.3.1 és KeychainSwift 21.0.0 exact upstream URL/tagrevízióit engedi. |
| `npm run test:e2e:mobile:built`         | PASS                    | 2/2 landing/auth Android bridge-emuláció a friss `dist-mobile` artifacton: secure store meghívás, nulla recovery/CSP/console/page/lokális-asset hiba; külső font/kép availability nem része a bizonyítéknak |
| `npm run mobile:sync` / `npx cap sync`  | PASS                    | 4 080 modul mobile build; ugyanaz a `dist-mobile` és publikus config Android/iOS projektbe másolva; SecureStorage 8.0.0, App és Browser plugin mindkét platformon felismerve, Keyboard nincs regisztrálva; tracked native drift 0 |
| Android unit/lint/assemble              | PASS KORLÁTTAL          | A tényleges Android Studio SDK-val `testDebugUnitTest lintDebug assembleDebug --no-daemon --stacktrace`: 3m42s, 276/276 task, `BUILD SUCCESSFUL`, nincs új lint finding, 6 049 206 byte debug APK (`EFA61256…`). Az app és plugin unit taskok `NO-SOURCE`; ez compile/lint/assemble bizonyíték, nem natív unit lefedettség. |
| iOS Xcode build                         | PASS                    | GitHub `macos-26-arm64`, image `20260715.0248.1`, Xcode 26.5: commitolt lock felismerve; 363/363 gate, `-onlyUsePackageVersionsFromResolvedFile`, drift check és `CODE_SIGNING_ALLOWED=NO` generic simulator build PASS (`BUILD SUCCEEDED`). |
| `npm test`                              | PASS (coverage runner)  | A teljes coverage-futtatás ugyanazt az 54/54 fájlban 586/586 tesztet futtatta zölden. |
| `npm run test:coverage`                 | PASS                    | 54/54 fájl, 586/586 teszt; statements/lines 47,65% (40 578/85 148), branches 65,34% (943/1 443), functions 32,13% (161/501). Két előző teljes futásban 1, majd 3 DOM-heavy teszt a terhelés alatt 5,17–5,41 s-nál timeoutolt; izoláltan PASS, ezért csak e három eset kapott lokális 10 s-os felső korlátot; a végső teljes futás változatlan assertionökkel PASS. |
| `npm run test:e2e:built`                | PASS                    | 7/7 Chromium public smoke ugyanazon végső `dist` artifacton: asset MIME/runtime, manifest/favicon/PWA, auth, anonymous redirect, 404, accessible names és 320/390/768 px; végső szekvenciális futás 13,8 másodperc. |
| `npm run build`                         | PASS                    | Vite 6.4.3, 4 080 modul; nagy chunk warning; ugyanaz a forrás web és mobile artifactba épült |
| `npm run bundle:check`                  | PASS lokálisan; hosted baseline korrekció újrafutás alatt | Windows candidate: JS 4 452 913 raw / 1 271 182 gzip; hosted Linux candidate: 4 453 006 / 1 271 333; largest hosted 1 739 506 / 551 837; CSS 180 798 / 29 589. Az I-21 artifacthoz képest hosted +5 092 raw / +1 511 gzip (+0,114% raw); reviewed total-gzip ceiling 1 271 461, largest-gzip és CSS plafon változatlan. |
| `npm audit --audit-level=high`          | PASS                    | 0 ismert vulnerability |
| `npm run security:secrets`              | PASS                    | 1 437 tracked és nem ignorált untracked text file magas bizonyosságú current-tree scan + tracked mobil signing-key fájlnév tiltás; history scan még nyitott |
| `npm run lint:ratchet`                  | PASS                    | fingerprint-baseline: új vagy áthelyezett finding hibát okoz, csökkentéskor baseline-frissítés kötelező; az I-22 baseline 1 209 error / 104 warning 178 fájlban      |
| Strukturált logger Deno teszt/check     | PASS                    | 2/2 redaction teszt; `auth-email-hook` és `send-transactional-email` check PASS                                                                                    |
| `npm run edge:check` / ratchet / test    | PASS                    | 30/30 entrypoint és config, 0 Deno diagnostic; 64/64 remote import exact, 0 unpinned; Deno 2.9.3, `node_modules=none`; runner/ratchet unit 14/14 és automatikusan felderített Edge teszt 25/25 PASS, ebből 4 endpoint release body/header/CORS contract; immutable source gate 73 fájl |
| Payroll contract és UI regresszió       | PASS                    | Deno payroll contract 15/15; célzott Vitest 20/20; AuditLog allowlist 2/2; typed Edge check PASS; current full unit 549/549 |
| Payroll snapshot DB contract            | PASS                    | runner unit 12/12; pinned PostgreSQL 18.4 migration/digest/ACL/search_path/trigger/negative auth/member drift/audit rollback PASS. A readiness valódi `SELECT 1` lekérdezéssel igazolja a név szerinti céladatbázist, ezért a konténerfolyamat és az adatbázis-létrehozás közti race fail-closed. Négy manipulált pgcrypto/schema trust eset fail-closed; runtime TRUNCATE, direct service reset és reserved-audit forge/tamper/delete tiltott; whitespace/NULL és 7/8/1000/1001 indokhatárok, exact prev/new audit, locked/exported/legacy reopen auditált. Determinisztikus lock és reopen exactly-one-winner, valamint actor-demotion→reopen fail-closed, bitazonos sor/0 audit igazolt. Collisionteszt idegen konténert megőriz; nincs hálózat/host port, csak két read-only mount, ownership-ID+label cleanup PASS. Ez célzott fixture, nem teljes migration replay. |
| HR workflow tenant DB/UI contract       | PASS                    | runner unit 8/8; pinned PostgreSQL 18.4 static contract, repeat apply és legacy-row preservation PASS; cross-workspace template/membership/instance/task/assignee, inactive membership, member/admin RLS, list PII, parent cascade és exact RPC/FK catalog fail-closed. Négy determinisztikus reassignment/suspension/direct-write lock-race PASS. UI data+a11y+request-ordering 10/10; nincs `eq.undefined`, backend/task hiba fail-visible, pending instance-read deduplikált, workspace-váltás és unmount utáni válasz invalidált. Nincs hálózat/host port; exact ownership cleanup és bounded child termination. Célzott fixture, nem teljes migration replay vagy restored-staging bizonyíték. |
| Schema provenance gate                  | PASS                    | parser unit 7/7; 125 migráció; generated/backed/unproven: table 165/135/30, view 4/3/1, function 99/53/46, enum 11/9/2                                             |
| SBOM és release manifest                | PASS (lokális + hosted evidence) | Shared web/mobile package-lock CycloneDX 707 + Edge/Deno 464 komponens. A release-identity merge artifactja hash-eli a web/mobile outputot, 124 akkori migrációt, 30 Edge entrypointot, exact Capacitor integritásokat és a `3bf37e13…` iOS lockot; a candidate új, 125. migrationjéhez friss evidence csak a candidate commiton fogadható el. |
| GitHub-hosted quality workflow          | PASS / I-22 PENDING     | Main run `29669034798`: mind a hét hosted job PASS a `f2348c559958931a65e68157d5dd590ec22782aa` merge SHA-n, beleértve a HR PostgreSQL 18.4, Android és iOS kaput. Az I-22 candidate hosted futása commit után kötelező. |
| Új v3.51.3 migration PG18 compile/apply | PASS                    | Access submit/döntés/ledger/rollback szemantika PASS; candidate dual-feature compile PASS, candidate runtime smoke megszakadt; production/linked apply nem történt |
| Clean lokális migration replay          | FAIL                    | 104/125 után `20260517230000...`: `plugin_webhook_events` helyi CREATE TABLE hiányzik                                                                              |
| Linked `db lint --level warning`        | FAIL                    | 7 error, 6 warning; read-only ellenőrzés                                                                                                                           |
| Live `effectime.app` release attestation | FAIL                    | A Lovable/Cloudflare root és a hét felderített asset ugyanazt a stabil `x-deployment-id: 205b23c0-72e8-4158-853e-348a2358fd10` értéket adja, de `/.well-known/effectime-release.json` továbbra is 404. A live artifact ezért nem köthető a merge SHA-hoz; authenticated Lovable publish nélkül production attestation NO-GO. |
| Linked DB write/deploy                  | NEM FUTOTT              | szándékosan; history drift miatt veszélyes lenne                                                                                                                   |

Az első build-újrafutásnál átmeneti helyi npm/Node launcher hiba jelent meg; az
eszközútvonal ellenőrzése után ugyanaz a parancs sikeresen lefutott. Nem termék-
vagy forráskódhibaként van lezárva, mert a tényleges production build PASS.

## 8. Technikai adósság és javasolt sorrend

1. A P0 HR workflow candidate forrás/contract elkészült; következő kapu az
   aggregált cross-tenant inventory restored stagingen és minden non-zero sor
   jóváhagyott, adatmegőrző rendezése.
2. Production backup és a 59/65/84 migration history tartalmi/hash reconcile.
3. Hiányzó 30 tábla, 1 view, 46 function és 2 enum eredetének besorolása; read-only
   live dumpból transitívan teljes recovery migration; clean replay
   125/125 és jóváhagyott schema diff.
4. Linked DB lint 7 error javítása repair migrationökben.
5. Multi-step approval chain runtime és concurrency/E2E.
6. Staging deploy azonos commitból: DB, Edge, frontend; adversarial RBAC/tier,
   invite, leave, access, payroll, API/webhook és integration smoke.
7. Biztonságos instant provisioning termékdöntése és implementációja.
8. Account deletion retention/kompenzáció, data migration resumability.
9. A hosted quality gate required-checkként való fenntartása; a zero-diagnostic
   és zero-unpinned Edge baseline, illetve a schema-provenance ratchet őrzése.
10. Store/app-ID/signing ownership és verified links; Android CI + macOS/Xcode
   CI; kétplatformos secure-storage/CSP/tenant/RBAC/auth fizikai smoke és csak
   ezután internal TestFlight/Play rollout.
11. Fokozatos lint-, coverage-, E2E- és bundle-adósság csökkentés.

## 9. Emberi döntést igénylő kérdések

1. `instant_member_create`: managed-domain/SCIM provisioning legyen, vagy a
   felhasználó által mailboxból befejezett jelszóaktiválás? Az admin által
   email-confirmált globális identity nem állítható vissza biztonságosan.
2. Approval chainben az `approver_role` enterprise membership role-t, business
   role-t vagy mindkettőt jelentsen, és mi történjen hiányzó approvernél?
3. Fióktörlésnél mely audit/payroll rekordokra vonatkozik jogi retention, és
   anonimizálás vagy teljes törlés szükséges?
4. M365 esetén valódi kétirányú tartós sync a cél, vagy a termékszöveget kell a
   bizonyított kimenő működéshez szűkíteni?
5. Az embed engedélyezett origin/token-rotáció szerződése mi legyen? A natív
   Android/iOS célplatformot a felhasználó explicit megerősítette; ez már nem
   nyitott termékfeltételezés.
6. Payroll period csak teljes naptári hónap lehet, vagy napi canonical adatra
   kell átállni a részidőszakok helyes számításához?
7. A payroll rate a period end / `effective_from` / `effective_to` mely
   szabályával érvényes? Több pénznemnél a v1 legyen fail-closed egyetlen
   pénznemre, vagy készüljön v2 per-currency totals; árfolyam-konverzió csak külön
   forrás/időpont/audit szerződéssel vállalható.
8. Legyen-e adatbázis-invariáns az egyetlen aktív/default provider config, és a
   direct provider API része-e a terméknek; ha igen, mely provider/credential
   szerződés az első?
9. Ki a Play Console/App Store Connect jogi tulajdonos, igazoltan foglalható-e az
   `app.effectime` azonosító, és mely signing/team account a release source of truth?
10. A push, 14 napos offline és biometrikus feloldás közül melyik legyen az első
    külön mobil termékcsomag; pontosan mely adatok és műveletek tartozzanak az
    offline szerződésbe?
11. Az admin-created leave jogosultsága hard `owner`/`resourceAssistant` határ
    legyen, amelyen belül az `admin_override=edit` is kötelező, vagy a UI is
    engedjen be bármely aktív, explicit `admin_override=edit` jogosultságú egyedi
    szerepkört? Az első a kisebb jogosultság elvét, a második a konfigurálható
    RBAC-szerződést követi; automatikusan egyik irányt sem tágítjuk.

## 10. Release-nyilatkozat

Az audit-, hardening-, release-identity, HR lifecycle és iCal entitlement forrás
PR #167–#170-ből bekerült a `main` ágba; a
`f2348c559958931a65e68157d5dd590ec22782aa` SHA mind a hét hosted kaput
teljesítette. Ez nem production release: a live manifest 404, matching Edge
deploy és linked DB apply nem történt. Az I-22 admin-created leave csomag
frontendként a teljes lokális Quality Gate alapján **GO FELTÉTELEKKEL**, de a
tiszta commit és hosted CI bizonyítéka még kötelező; a teljes APR-004 továbbra is
**NO-GO** az egységes szerepkör, dinamikus PG18
tenant/RBAC/audit/rollback/concurrency/idempotencia és restored-staging bizonyíték
nélkül. A HR tenant-boundary backend csak DB-history reconcile, restored-staging
inventory/adversarial teszt, approval-chain, payroll-szemantikai/legacy-snapshot
döntés és provisioning/retention döntések után jelölhető release-késznek.
Az Android/iOS implementáció, candidate forrás, reviewed Xcode lock és unsigned
hosted Android/iOS build fejlesztésre alkalmas, de store release-re külön
**NO-GO**, amíg a `docs/mobile/README.md` signing, verified-link, brand-asset és
fizikai secure-storage/CSP/készülékes kapui nem teljesülnek.

**Kiadási döntés: production/backend NO-GO.** A lokális hardening-csomag a fenti
zöld kapuk alapján **GO FELTÉTELEKKEL**, de csak tiszta candidate SHA, teljes DB-
reconcile, payroll-döntések, staging és jóváhagyott rollout után bocsátható ki.
