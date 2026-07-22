# Effectime Enterprise — projektátvételi és release-audit

Audit dátuma: 2026-07-17–22
Repository: `C:\Work\Github\effectime-app-enterprise-a95029a1`
Remote: `HenrikFaul/effectime-app-enterprise-a95029a1`
Auditált main HEAD: `f52671880748c58802d94e0705204d846f4b5928`
Munkabranch: `codex/created-identity-cleanup-scheduler`

## 1. Átvételi összkép

**BIZONYÍTOTT:** a korábbi „egyetlen magyar landingoldal” következtetés hibás
volt, mert a `C:\Work\effectime-app-enterprise` útvonalon lévő, kilenc commitból
és 73 fájlból álló másik checkout alapján készült. Ez az audit kizárólag a
felhasználó által megadott `C:\Work\Github\effectime-app-enterprise-a95029a1`
repositoryra vonatkozik.

**BIZONYÍTOTT:** a helyes repository a teljes Effectime Enterprise terméket
tartalmazza: több mint 846 elérhető alapcommit, a candidate-del több mint 1 500
követett vagy új fájl, 149 jelenlegi enterprise UI-fájl, az I-30 candidate-del
131 helyi SQL-migráció és 31 Edge Function-könyvtár. A publikus oldal,
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
a clean replay 104/131 sikeres fájl után a 105. migrációnál hiányzó lokális DDL-re
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
- Mind a 131 lokális migráció, generált Supabase típusok, RLS/policy-k, RPC-k,
  31 Edge Function-könyvtár és az összes runtime caller.
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
- Current-tree secret scan 1 519 követett és nem ignorált untracked szövegfájlon,
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
| R-031 | Kérelem létrehozása más nevében + opcionális admin auto-approve | APR-004 UI/RPC call path | BIZONYÍTOTT frontend + szerver-contract | `AdminLeaveOverride`, v1/v2 RPC, privát ledger, request listák | igen | I-25 main 7/7; I-26 82 célzott + PG18 + hosted 8/8 | igen | I-26 PR #175-ben mainre merge-elve; production APR-004 NO-GO | restored staging, DB-first rollout |
| R-032 | Enterprise collapsible kártyák billentyűzetes és AT-elérése | runtime source audit + reprodukált div-backed trigger | BIZONYÍTOTT | `CollapsibleCardTrigger` és 17 call-site öt enterprise modulban | igen | 4 célzott + teljes unit/type/web/mobile/release + hosted 7/7 | igen | I-24 PR #173-ban mainre merge-elve | production publish/acceptance |
| R-033 | Admin override dialog programozott név, fókusz és aszinkron lifecycle | runtime source audit + reprodukált label/focus/stale-response hiány | BIZONYÍTOTT frontend | `AdminLeaveOverride`, `WorkspaceDashboard`, shared `DialogContent` | igen | 28 admin + 4 valós Radix Dialog; 63/63 célzott; 56/56 és 616/616 coverage; hosted 7/7 | igen | I-25 PR #174-ben mainre merge-elve | production keyboard/AT acceptance |
| R-034 | Admin override same-key exactly-once és crash-safe retry | lost-response kockázat + v1/v2 call path + mobil közös adatforrás | BIZONYÍTOTT main + hosted | v2 RPC, hash-only ledger, közös adapter, 7 napos retry/reconciliation-horizontú outbox | igen | PG18 + runner 12/12 + 82 célzott + hosted 8/8 | igen | PR #175, main `f526718…`, run `29682829301`; production NO-GO | restored staging, DB→client rollout |
| R-035 | Profiles tenant privacy, self locale/profile és közös workspace-mérföldkövek | történeti globális policy + raw widget/caller inventory | BIZONYÍTOTT source candidate + hosted | restrictive RLS/update guard, catalog-driven ACL, három RPC, shared adapter/widget, AST caller contract | candidate-ben igen | runner 10/10; PG18 + mind a 4 DB contract PASS; focused 77/77; full coverage 727/727; type/build/bundle/audit/web/mobile PASS; hosted 9/9 | igen | P0 forrásjavítás és regressziókapuk elkészültek; draft PR #176; production NO-GO | 59/69/84 history reconcile, restored staging, controlled DB-first rollout, live SHA-attestation |
| R-036 | Workspace-member profil atomi, konkurenciabiztos szerkesztése minden kliensen | négy független UI-mutation + direct allocation writer + tenant/RBAC audit | BIZONYÍTOTT source candidate + hosted | egy-statement read RPC, atomi save RPC, `profile_revision`, exact self-name baseline, shared TypeScript adapter, Auth/Edge writer contract, nyolc locale | igen a candidate-ben | runner 15/15; PG18 atomic + 4 legacy DB PASS; focused UI/client/Edge-writer 208/208; full coverage 896/896; type/lint/build/bundle/Edge/security/mobile PASS; hosted 10/10 | igen | draft PR #177, final head `9dea63e…`, run `29868681921`; production NO-GO | history reconcile, restored-staging inventories, DB-first rollout |
| R-037 | Atomi business-role allokáció/törlés és tartós direct-identity kompenzáció | I-28 nyitott direct writer + Edge Auth-create/error útvonal inventory | BIZONYÍTOTT source candidate + hosted | max-20/exact-100/exact-one-priority draft, atomic profile save, tenant-wide role-delete RPC; négyállapotú pre-Auth saga, hat service-only RPC, retry-prepare, membership/profile write guard, gated finalizer, Edge writerek és cleanup worker | igen a candidate-ben | focused Vitest 99/99; Edge 60/60 és entrypoint 30/30; runner 15/15; PG18 member-profile/business-role/identity-saga két-session finalizer/writer contracttal; full coverage 76 fájl / 992 teszt; type/build/bundle/mobile PASS; hosted 10/10 | igen | draft PR #178, final source `f628d0b…`, run `29879703648`; production NO-GO | recurring cleanup scheduler, history reconcile, restored staging, DB-first rollout és live SHA-attestation |
| R-038 | Fenced recurring created-identity cleanup és legacy temp-cleanup szétválasztása | I-29 durable saga + hiányzó recurring worker/single-flight/secret boundary | BIZONYÍTOTT source candidate + hosted | külön `cleanup-created-identities` Edge worker; per-job tokenes lease, worker singleton, pontos receipt, Vaultból futáskor feloldott cron credential; `cleanup-temp-users` külön legacy felelősség, renew-ölt delete-adjacent lease és szűkített profile/event guard | forrásban igen; scheduler szándékosan dormant | Edge 86/86, entrypoint/config 31/31, 65/65 pinned import, AST log-safety 9/9, runner 16/16, öt PG18 contract, köztük két-session single-flight/event-extension/temp-upgrade; hosted 10/10 | igen | draft PR #179, implementation head `1e3d874…`, run `29885969841`; production NO-GO | restored staging DB→Edge→scheduler, pg_net response+worker-state korreláció, secret rotation, monitoring és live attestation |

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
  PASS. Az I-26 a same-key idempotenciát és a dinamikus PG18 bizonyítékot
  lokálisan pótolja; restored-staging és production rollout továbbra nyitott.
- Az I-25 az admin override dialógus minden látható formmezőjét egyedi,
  programozott label/required szerződéshez köti, lokalizált élő validációs és
  submit státuszt, generikus fail-visible hibát, valamint determinisztikus
  retry/empty fókuszkezelést ad. A nyitógomb és a Dialog explicit kapcsolatban
  áll, bezáráskor a fókusz a még elérhető nyitóra tér vissza; submit közben a
  natív close, Escape, outside interaction és minden módosítható kontroll zárt.
  A shared `DialogContent` új propjai opcionálisak és a korábbi `Close`/enabled
  viselkedésre defaultolnak.
- A submit payload a validált aktuális kontextusból egyszer készül, a szinkron
  re-entry guard és a futás/scope generáció pedig nem enged elavult workspace-
  vagy unmount utáni success/error UI-mellékhatást. A candidate 28/28 admin,
  4/4 valós Radix Dialog és összesen 63/63 célzott tesztet, továbbá 56/56 fájlban
  616/616 full coverage tesztet teljesít. A type/lint/build, exact bundle,
  web/mobile, audit/secrets, schema/release/Edge és a már meglévő dinamikus PG18
  payroll/HR contract lokális kapuk is zöldek. PR #174 merge-elve a
  `0a33e8cd0309d35e820fb1df9e8194dfbcce7242` main SHA-ra; run `29678100165`
  7/7 PASS. A production keyboard/AT acceptance nyitott; a globális `profiles`
  határhoz az I-27 source candidate elkészült, de nincs productionben alkalmazva.
- Az I-26 additív v2 RPC-t és privát, hash-only idempotency ledgert ad, a v1
  szerződés érintetlen megtartásával. A közös web/Android/iOS adapter Web Crypto
  UUID-t, 30 másodperces request-határt és actor/workspace-scope-olt, hét napos
  retry/reconciliation-horizontú tartós outboxot használ; raw justification/
  comment nem kerül storage-ba vagy logba. Egy scope-ban egyszerre egy feloldatlan
  művelet lehet: a változatlan payload ugyanazt a kulcsot használja, az eltérő
  payload blokkolt. A bizonytalan, lejárt vagy sérült kliensbizonyíték nem törlődik
  automatikusan; exact-key cleanup csak hiteles szerver receipt után történik.
  Minden hibaválasz megtartja a bizonyítékot: az ismert 4xx exact-key retryként
  marad, míg HTTP 408/499, 5xx, transport-bizonytalanság, `0` státusz vagy hibás
  receipt esetén a lokalizált `outcome_uncertain` állapot
  reconciliationt kér. A PG18 contract igazolja az ACL/owner/v1
  kompatibilitást, malformed ledger elutasítást, audit/quota rollbacket és két
  determinisztikus serialization scenariót. PR #175 a
  `f52671880748c58802d94e0705204d846f4b5928` main SHA-n merge-elve; hosted
  Quality Gate `29682829301` 8/8 PASS, release artifact `8441138073`, Android
  artifact `8441127446`. Restored staging, linked DB és production deploy nem
  történt; a drift miatt a DB-first production rollout NO-GO.
- Az I-27 a történeti globális profile-read útvonalat restrictive select/update
  guarddal és catalog-driven column ACL revokkal zárja. Böngészőből csak
  `user_id`, `display_name`, `avatar_url` olvasható; a safe coworker-directory
  members-admin permission nélkül is használható név/avatar feloldásra, de locale,
  milestone és globális profilírás külön RPC-határon marad. A self locale a
  `get_my_profile_locale_v1`, a saját globális névfrissítés az
  `update_my_workspace_profile_display_name_v1`, a mérföldkőlista pedig a pontos
  ötmezős `get_workspace_member_milestones_v1` szerződésen halad, `user_id`
  nélkül. A `MemberProfileSheet`, a unique-name-only `CapacityFit`, a
  timezone/resume/a11y widget és
  az account/tenant race-safe i18n útvonal átvezetése elkészült; az AST caller
  contract a teljes elérhető browser forrás oszlop- és mutation-határát őrzi.
  A current self-only revision runner 10/10, mind a négy PostgreSQL contract és
  a tízfájlos célzott klienssuite 77/77 PASS; typecheck, build, reviewed bundle,
  audit, web smoke és mobile source/artifact/smoke/drift kapuk is zöldek. A
  current-tree full coverage 66 fájl és 727/727 teszt PASS. Draft PR #176 hosted
  futása (`29687248014`) 9/9 PASS; release evidence `8442491749`, diagnostics
  `8442490776`, Android artifact `8442475433`. Linked apply, production
  deploy és live SHA-attestation nem történt.
- Az I-28 a `MemberProfileSheet` korábbi négy független membership/allocation/
  profile mutationjét egy `save_workspace_member_profile_v1` tranzakcióra cseréli,
  és a szerkesztési alapállapotot egy statementből adó
  `get_workspace_member_profile_edit_snapshot_v1` RPC-vel tölti. A szerver kezeli
  a monoton `profile_revision` tokent; a self display-name exact baseline, a
  sor- és advisory lockok, az actor/target/RBAC/entitlement recheck és az egyetlen
  minimális audit receipt együtt akadályozza a lost update-et és részleges commitot.
  Cross-tenant office/allocation FK, restrictive allocation policy, legfeljebb 20
  canonical szerep és exact lexical CHECK-ek zárják a direct-writer határt. A
  kliens load/timeout/abort/stale/zero-row/conflict állapotai nyolc locale-ban
  lokalizáltak, és minden runtime mount authoritative refetch-et kap. A signup,
  Auth trigger és inventoried Edge writer explicit Unicode display-name
  szerződésen osztozik; a trigger/ACL drift adversarial teszttel védett. Runner
  15/15, atomic PG18 és négy legacy DB contract PASS; focused 208/208, teljes
  coverage 896/896, type/lint/build/bundle/Edge/security/mobile PASS. Production
  rollout továbbra NO-GO. A final v3.51.6 source head `9dea63e…`; hosted run
  `29868681921` 10/10 PASS, release `8510309445`, diagnostics `8510306792` és
  unsigned Android artifact `8510265497`.
- Az I-29 bezárja a közvetlen `BusinessRoleManager` írási határt. A draft
  legfeljebb 20 canonical szerepet, pontosan 100,00 százalékot és pontosan egy
  prioritást enged; tagonként az I-28 atomi, optimista save RPC-je kap friss
  authoritative snapshotot. A tenant-wide role-delete RPC tenant/RBAC/
  entitlement recheckkel, advisory- és sorlockkal, determinisztikus rebalance-
  szal, exact postconditionnel és minimális audittal egy tranzakcióban fut.
  Ugyanez a csomag a direct Auth identity létrehozást durable pre-Auth sagával
  védi: négy állapot, hat service-role-only RPC, DB-first kompenzáció, minden
  `pending_auth` retry előtti re-prepare, per-user membership/profile write guard,
  valamint workspace/user gate alatt atomikusan befejező finalizer. A két-session
  PG18 contract bizonyítja a finalizer/writer sorosítást. Focused Vitest 99/99,
  Edge 60/60, entrypoint 30/30, runner 15/15, PG18 member-profile/business-role/
  identity-saga, teljes coverage 76 fájl / 992 teszt és typecheck PASS; lint-
  ratchet 1 148 error / 98 warning, 11 javulással. Hosted
  PR/run még függőben. A recurring cleanup scheduler hiánya explicit production
  **NO-GO**; a közös React/Supabase adatforrás weben, Androidon és iOS-en
  változatlan.

## 5. Hiányok és kockázatok

### P0

| Tétel | Bizonyíték | Hatás / kockázat | Kötelező javítás és elfogadás |
| --- | --- | --- | --- |
| HR workflow tenant-boundary / IDOR | A live és történeti `hr_workflow_create_instance` nem validálja `p_membership_id` workspace-ét; az instance/task member policy-k nem korrelálják a membership workspace-ét és nem mindenhol követelik az aktív státuszt; az update/list RPC-k joinjai ugyanezt a globális UUID-feltételezést viszik tovább. A legacy globális FK-k cross-tenant `CASCADE`/`SET NULL` adatvesztést is lehetővé tesznek. A hiba már a remote `20260511163148 create_hr_workflows` migrationben jelen van. A candidate `20260719000000_v3_51_3_hr_workflow_tenant_boundaries.sql` forward-only trigger/RLS/RPC/ACL/parent-guard javítást ad, és nem ír át legacy sort. | Cross-workspace referencia létrehozása, más tenant workflow-jának olvasása, inactive assignee ismert task UUID-val történő módosítása, admin listában kereszt-tenant név/e-mail összekapcsolás és idegen workspace taskjának parent-kaszkádos törlése lehetséges. **BIZONYÍTOTT kód/history finding; a candidate célzott PostgreSQL-contractja zöld, de production rollout nem történt.** | A kódoldali javítás elkészült; `npm run db:hr-workflow:test` két tenanttal, authenticated RLS/RPC, inactive-assignee, list-leak, parent-delete, reapply és négy determinisztikus race esettel PASS. Production GO előtt kötelező az aggregált restored-staging inventory, non-zero sorok jóváhagyott data-preserving rendezése, history reconcile és teljes staging acceptance. |
| Globális `profiles` SELECT / születésnapi PII leak | **Történeti main-bizonyíték:** a `20260503073040_d6471f9e-4600-4c3e-b426-15bed631ac1b.sql` globális authenticated policyje és a korábbi widget raw `user_id,display_name,preferences` lekérése browser-side szűrés előtt továbbította a preferencia-JSON-t. **I-27 candidate:** a migráció RLS-t kényszerít, matching restrictive select/update guardot ad, catalogból minden browser column ACL-t visszavon, majd csak `user_id,display_name,avatar_url` SELECT-et enged. Self locale, self-only global display-name update és ötmezős milestone külön RPC; az AST contract a caller-határt őrzi. | **BIZONYÍTOTT történeti cross-tenant PII-kitettség; BIZONYÍTOTT source + local/hosted contract; production továbbra P0 blocker.** A candidate nincs a linked DB-re alkalmazva, az 59/69/84 drift és live SHA-attestation hiányzik. | A forrásjavítás és a current self-only revision két-tenant PG18 negatív ACL/RPC contractja PASS. GO előtt: teljes caller/Edge inventory lezárása, adatvédelmi incidensértékelés, backup, history reconcile, restored-staging exact policy/ACL/owner/schema-cache diff, régi fail-closed és új kliens smoke, DB-first apply, azonnali client rollout és privacy-preserving rollback. |

### P1

| Tétel                                       | Üzleti/technikai indok és bizonyíték                                                                                                                                                                             | Érintett terület                                       | Kockázat, függőség, méret                                     | Elfogadási kritérium / teszt / dokumentáció                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| DB history és schema drift                  | A v3.51.6 read-only baseline 59 közös migration ID / **69 local-only** / 84 remote-only (128 local, 143 remote); az I-29 két és az I-30 egy további, szándékosan nem alkalmazott local migrationnel 131 repository-fájlt tartalmaz. Három local-only HR/office/analytics fájl remote migrationök eltérő ID alatti tartalmi duplikátuma. A clean replay 104/131 után a `plugin_webhook_events` hiányán áll meg. A generált public felület 165 tábla/4 view/99 függvény/11 enum; ezekből 30/1/46/2 helyi DDL-je nem bizonyított; a candidate RPC-k/táblák sincsenek még hitelesen regenerált types-ban. Hat attendance tábla a `d4a441a4` types-only commitban, további 21 tábla a `7c59e9a7` „Regenerate types.ts from live DB” commitban jelent meg; a `b952a466` v3.6 commit 24 frontend/test/docs fájlt és 0 SQL-t adott hozzá. | `supabase/migrations`, generated types, git history    | hibás deploy vagy repair; backup+staging kell; XL             | remote statement/hash manifest; duplikátum-besorolás; transitívan teljes recovery migration; clean shadow replay; regenerated-types/schema fingerprint diff; DB lint/RLS teszt; bulk `migration repair` tilos |
| Linked DB lint                              | read-only `supabase db lint --linked --level warning`: 7 error, 6 warning                                                                                                                                        | compliance/webhook/analytics/onboarding/password RPC-k | runtime hiba; a history reconcile előfeltétel; L              | 0 error; pgTAP/integration; caller smoke; changelog                                                               |
| Approval chain nincs runtime-ban            | chain editor/táblák és `step_order` dokumentált, de `decide_leave_request` nem választ stepet/approvert; első jogosult véglegesít                                                                                | approval UI/RPC/schema                                 | kiadott fő funkció nem teljes; L/XL                           | step/approver modell; sorzár; rész-döntések; végső státusz csak utolsó stepnél; concurrency/E2E; migrációs leírás |
| `instant_member_create` biztonságos pótlása | v3.33 dokumentált fizetős funkció; régi admin-confirmed email globális identityt foglalhatott; most 409 fail-closed                                                                                              | user provisioning/auth/invite                          | funkciókompatibilitás; product+security döntés; L             | SCIM/domain vagy mailbox-verified activation; cross-tenant adversarial teszt; admin UX és migration note          |
| Created-identity cleanup scheduler hiányzik | Az I-29 durable pre-Auth saga és DB-first worker retry forrása kész, de repositoryban/linked környezetben nincs bizonyított recurring scheduler. Manuális worker-hívás nem release-képes kompenzáció. | Edge worker / service-role RPC / operations | hibán maradt Auth identity és provisioning saga automatikus helyreállítása nem garantált; production NO-GO; M | least-privilege ütemezés, secret ownership, singleton/overlap és backoff acceptance, pending-age/dead-letter metrika+riasztás, restored-staging fault injection és runbook drill |
| Fióktörlés nem atomi                        | GoTrue delete és DB cleanup nem egy tranzakció; a preflight csak ismert FK-ket fed                                                                                                                               | `delete-account`, retention                            | részleges törlés / blokkolt GDPR-flow; jogi döntés; XL        | retention policy; job/RPC+kompenzáció; retry/idempotency/concurrency; audit és runbook                            |
| Webhook/API DDL és producer provenance      | live/repo function source helyreállt, de egyes delivery/config objektumok és producer-ek helyi eredete nem teljes                                                                                                | public API/webhook                                     | következő clean deploy nem reprodukálja a live viselkedést; L | helyi DDL+producer inventory; staging key/revoke/rate/delivery/SSRF E2E; source↔deploy checksum                   |
| Data migration részleges commit             | több entitás egymás után íródik, hiba esetén részleges eredmény/HTTP-eredmény lehetséges; nincs teljes resumable checksum                                                                                        | `data-migration`, import                               | ismétlés/duplikáció/kevert állapot; L                         | manifest+checksum; idempotens resume; hibastátusz; fixture és rollback doc                                        |
| Deploy provenance és provider lánc          | Az I-30 revalidáláskor a repositoryban egyetlen workflow a quality gate; nincs GitHub environment, deployment, release, Actions secret vagy variable. A jelenlegi `effectime.app` Lovable/Cloudflare deploymentje továbbra sem köthető Git SHA-hoz: a live release marker hiányzik, a repository Lovable webhook utolsó válasza HTTP 405, a Vercel projekt pedig nem az élő domain célpontja. A push ezért validál, de nem deployol. | frontend/Edge/DB release | rollback és audit nem reprodukálható; M | publish authority helyreállítása; védett production environment; provider preview + deployment-ID↔SHA rekord; élő `/.well-known/effectime-release.json`; Edge body/header SHA; fail-closed verifier; azonos commitból háromrétegű deploy |
| Payroll időszak/rate/export szemantika      | Tetszőleges részidőszakhoz teljes havi attendance aggregate kerülhet; a rate-választás latest-all; a v1 szerződés az ISO pénznemkódot validálja, de tagonként eltérő pénznemeket egyetlen `total_gross` mezőbe összead (a contract teszt EUR+USD összeget is elfogad); az attendance/leave/rate HTTP-olvasások nem egyetlen MVCC snapshotból készülnek. A lock/export és elsődleges audit már atomi, a snapshot immutable és DB-digestelt. | payroll Edge/DB/domain                                 | magas pénzügyi eltérés vagy időközi read drift; termékdöntés és egyetlen DB-számítási határ kell; L | full-month vagy napi canonical szabály; rate-as-of/effective-to; v1 single-currency vagy v2 per-currency totals; egy statement/transaction számítás; concurrency+staging fixture; legacy snapshot inventory/remediation |
| Natív store release biztonsági kapuk        | Android/iOS és CI forrás, PKCE, Keychain/AndroidKeyStore adapter, exact-origin CSP, hosted Android build és locked Xcode 26.5 simulator build kész; nincs store reservation/signing, verified HTTPS link, jóváhagyott brand asset vagy fizikai smoke | mobile auth/platform/release | signing/scheme ownership, OS-integráció és rollback kockázat; L | app ID/team/cert; AASA/assetlinks; device storage+CSP+auth smoke; signed internal rollout; `docs/mobile/README.md` |
| Admin-created leave production acceptance   | Az I-26 lokálisan additív v2 RPC-t, hash-only ledgert, v1 compatibility smoke-ot, pozitív/negatív RBAC/tenant/audit/quota contractot és duplicate/demotion serialization tesztet ad. A linked sémára a drift miatt nem alkalmazható vakon, a PostgREST schema-cache és valós policy/trigger-kombináció nem igazolt. | admin override RPC/RBAC/audit + web/mobile rollout | client-first deploy 404/RPC-hibát, hibás DB apply üzemzavart okozna; M/L | backup/PITR; restored production-like staging; exact catalog/ACL; v1+v2 smoke; DB-first apply/schema reload; client-second deploy; client-first rollback |

### P2

| Tétel                               | Bizonyíték / kockázat                                                                                                                | Méret | Elfogadási kritérium                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------- |
| ESLint-adósság                      | 1 148 error + 98 warning; az I-29 ratchet 11 további fingerprint-javulást rögzít, új diagnosztika nélkül | XL    | modulonkénti csökkentés, baseline-frissítés, végül 0                |
| Admin override globális retry-határ | A lokális outbox ugyanazon actor/workspace/payload kulcsát restart után visszaállítja, és scope-onként egy feloldatlan művelet mellett az eltérő payloadot blokkolja. A hét nap retry/reconciliation-horizont, nem automatikus törlési TTL: minden hibaválasz, valamint a bizonytalan/lejárt/sérült bizonyíték megmarad. Raw commandot nem tárol; másik eszköz eltérő kulcsot generálhat. Origin-szintű Web Locks nélkül a művelet az RPC előtt fail-closed; a [WebKit Safari 15.4-ben vezette be](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/), ezért az iOS target és a mobile contract minimuma 15.4. A [Lockdown Mode letiltja](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/), ami e privilegizált művelet dokumentált fail-closed korlátja. | M | fizikai Android/iOS transport-loss/Web Locks/Lockdown smoke; lejárt/corrupt művelet reconciliation acceptance; cross-device operation-token design csak igazolt üzleti igény esetén |
| E2E/coverage                        | nincs teljes auth/workspace/RBAC/leave/payroll/integration böngészős release gate                                                    | L     | Playwright staging suite, fixture, coverage baseline                |
| Bundle-méret                        | Current I-29 build: JS 4 527 940 raw / 1 296 700 gzip; largest 1 765 067 raw / 561 428 gzip; CSS 180 862 / 29 600. A +0,417% raw I-29 termék-contract növekedés explicit review-zott; a total ceiling csak a meglévő 128/279 byte cross-platform/SHA mozgásteret tartja, largest-raw exact. | M | további route split; hosted artifact összevetés; regressziós mérés |
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
| Collapsible trigger production acceptance | Az I-24 mind a 17 div-backed `CollapsibleTrigger`/`Card` kontrollt shared native-button overlayre váltotta (WorkspaceDashboard 13, Invitations 1, MemberList 1, Onboarding 1, Access 1), explicit accessible labellel és `aria-hidden` vizuális tartalommal; callback/state/API/DB változatlan. PR #173 mainen, hosted Quality Gate 7/7 PASS; a live release marker és production billentyűzetes acceptance még hiányzik. | S | authenticated Lovable publish; live SHA-marker; production keyboard/AT smoke |
| Admin dialog/select a11y candidate  | Az I-25 candidate egyedi ID+label/required szerződést, lokalizált busy/error állapotot, natively disabled close-t, explicit return focus-t, submit alatti dismissal/control lockot és stale RPC scope guardot ad. 28 admin + 4 valós Dialog teszt, 63/63 célzott, 616/616 coverage és a teljes lokális gate PASS. | S/M | hosted/PR; merge után production keyboard/AT smoke |
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
| I-08   | DB history reconcile                       | remote/local manifests, hiányzó DDL repair                                                                          | clean replay/schema diff/pgTAP | backup kötelező; semmit nem töröl automatikusan; 131/131 replay                                              | nyitott P1                 |
| I-09   | Multi-step approval runtime                | chain schema, approver resolution, partial decisions, UI                                                            | unit+PG concurrency+E2E        | meglévő single-step migrálható alap chainné; rollback feature flaggel                                        | nyitott P1                 |
| I-10   | Biztonságos instant provisioning           | SCIM/domain vagy verified activation                                                                                | auth/API/UI/migration          | invitation kompatibilis; cross-tenant identity teszt                                                         | emberi döntés              |
| I-11   | Staging/release                            | azonos SHA frontend+Edge+DB, smoke, release marker                                                                  | teljes staging suite           | backup/rollback artifact; production csak jóváhagyás után                                                    | blokkolt I-08/I-09-en, payroll szemantikán/legacy inventoryn és staging bizonyítékon |
| I-12   | Quality Gate & Runtime Safety Foundation   | SHA-pinnelt CI, fingerprint lint és coverage/bundle ratchet, production-preview Playwright, PII logger, AuditLog exact field-allowlist, két SBOM/provenance, runbookok | nincs DB/API shape változás    | Edge 30/30, 0 diagnostic, raw check PASS, 64/64 exact import, 0 unpinned; Deno izolált az npm tree-től; egy commitban visszavonható | lokális és hosted CI kész; release-process enforcement nyitott |
| I-13   | Payroll Edge/UI contract repair            | `payroll-export/index.ts`, contract/helper/tesztek, `PayrollPanel.tsx`                                  | Deno contract+check, Vitest    | direct provider hamis 200 helyett explicit 501; Edge/web együtt visszaállítható                                  | kész lokálisan; staging és termékdöntés nyitott |
| I-14   | Generated-schema provenance ratchet        | `scripts/ci/schema-provenance*`, exact baseline, package script és workflow                              | parser unit+current gate       | ratchet only; a 30/1/46/2 hiányzó provenance továbbra is release blocker                                      | kész lokálisan             |
| I-15   | Immutable payroll snapshot és DB contract  | `20260717134000_payroll_immutable_snapshots.sql`, snapshot helper, generated types, pinned PG18 fixture   | Deno+Vitest+PG18+concurrency   | trusted pgcrypto, TRUNCATE denial, exact audited `reopen_payroll_period_break_glass`, lock/reopen/demotion races; legacy locked/exported snapshot nélkül 409; rollout: payroll write pause, DB → Edge azonnal → web; régi Edge rollbackje az új DB-n nem biztonságos | kész lokálisan; staging/legacy inventory nyitott |
| I-16   | Android/iOS közös adatforrás foundation    | Capacitor config/package/lock, `android/`, `ios/`, mobile platform+bridge, auth/link/PWA/cache hardening, CI contract, mobil docs | typecheck+source/artifact/release contract+build+2x sync; hosted Android compile/lint/assemble és locked Xcode 26.5 simulator build zöld | web/API/DB kompatibilis; platform source git reverttel visszaállítható; app ID store-foglalás előtt módosítható | development foundation és unsigned native CI kész; signed store release NO-GO |
| I-17   | Natív session storage és CSP hardening     | secure-store adapter/envelope/migráció/recovery, verified reset tombstone, logout fallback, raw-token link tiltás, explicit project/storage key, `dist-mobile`, CSP transform, mobile E2E és CI allowlist | 93/93 mobile target, 183/183 source, 345/345 current artifact és 363/363 prior release contract, 2/2 mobile E2E, 595/595 current full suite, web 7/7, hosted Android+iOS | web login/callback/storage és SEO/PWA kompatibilis; a közös logout hibakezelése szándékosan fail-closed módon erősödött; nincs DB/API shape; package/config/source normál reverttel visszaállítható, local purge explicit | kód, emulált regresszió, exact Swift provenance és unsigned native CI kész; fizikai evidence nyitott |
| I-18   | Release Identity + Same-SHA attestation | determinisztikus web/mobile manifest, Vite client SHA, Edge health/platform-version body+header, Superadmin match UI, deploy verifier, CI/runbook | Node/Vitest/Deno/E2E/type/build | additív API mező/header; env hiányakor fail-visible unknown; normál git revert; production kész csak live verifierrel | PR #167-ben `main`-re merge-elve; live manifest/publish nyitott |
| I-19   | HR workflow tenant-boundary forward repair | `20260719000000...` migration locked trigger/RLS/RPC/ACL/private-helper/parent-guard korrekcióval; explicit admin/member inbox és fail-visible UX; történeti fájlok és legacy sorok változatlanok | két-tenant authenticated RLS/RPC + PG18 reapply/delete/catalog + négy determinisztikus concurrency race + UI data contract | meglévő hibás adat nem törölhető automatikusan; inventory és forward repair/rollback owner kell | PR #168-ban `main`-re merge-elve; restored staging/production nyitott P0 |
| I-20   | HR task request lifecycle hardening | per-instance in-flight dedupe, monoton request-generation, workspace/unmount invalidáció; nincs API/DB shape változás | 4 determinisztikus komponens-race + teljes unit/type/lint/build/bundle/smoke | régi válasz és hiba nem írhatja felül az aktuális tenant UI-state-et; egy frontend commit reverttel visszaállítható | PR #169-ben mainre merge-elve; run 29667441811 7/7 PASS |
| I-21   | iCal/admin override UI és token-state hardening | fail-closed permission/entitlement, approval-only Requests elérés, role-gated create, revoke-only downgrade UX, bearer request-generation, lokalizált accessible kontrollok | 8 komponens + 28 DB/Edge/static contract; teljes unit/type/lint/build/bundle/web+mobile smoke | nincs DB/API/dependency változás; saját dormant token törölhető; frontend commit reverttel visszaállítható; automatikus token-revocation külön P2 | PR #170-ben mainre merge-elve; run `29669034798` 7/7 PASS; production publish nyitott |
| I-22   | Admin-created leave és request-list race hardening | half-day exact dátum, kontextuskötött fail-closed validáció, tagkönyvtár readiness/retry, exception-safe submit, exact actor/workspace scope és monoton query-generation | 16 admin + 7 lista-race + 52 kapcsolódó célzott contract/unit; teljes unit/type/lint/build/bundle/web+mobile gate | nincs DB/API/dependency változás; frontend commit egyben reverttel visszaállítható; szerveroldali szerepkör/idempotencia külön kapu | PR #171-ben mainre merge-elve; run `29672580843` 7/7 PASS; dinamikus admin-override PG18 és production publish nyitott |
| I-23   | Leave-list fail-visible recovery és a11y | explicit lokalizált alert/retry, accessible loading/empty state, fail-closed adatürítés és a monoton query-generation megtartása | 8 új lista-state teszt + 7 meglévő race + 10 i18n contract; teljes 595/595 coverage, type/lint/build/bundle, web 7/7, mobile source 183/artifact 345/E2E 2, clean release contract 365 | nincs DB/API/dependency változás; komponens+i18n commit reverttel visszaállítható; raw backend hiba nem kerül DOM-ba | PR #172-ben `main`-re merge-elve (`5b502e12ca4f9169a366347e1d9d9079f7b1517e`); run `29673606633` 7/7 PASS; schema-2 artifact `8438122116`; production publish nyitott |
| I-24   | Native collapsible-card trigger a11y | shared native-button overlay a 17 korábbi div-backed triggerhez; explicit accessible label és `aria-hidden` vizuális Card, callback/open-state/layout változatlan | targeted 4/4, typecheck, 55 fájl 599/599 coverage, build/bundle/lint/audit/secrets, mobile source 183/artifact 345/release 365/E2E 2, tracked native drift 0, web 7/7 + post-tightening 2/2; hosted 7/7 | nincs API/DB/dependency változás; shared komponens és 17 call-site egy frontend commitból visszaállítható | PR #173-ban `main`-re merge-elve (`b0d129c41c56920c432d97eae3c93d63cb6dbd9a`); run `29675611155` 7/7 PASS; artifact `8438782050`; production publish nyitott |
| I-25   | Admin override a11y, fókusz és async race hardening | programozott label/required, localized live/error/empty/retry, opener↔dialog kapcsolat és return focus, native disabled close, submit dismissal/control lock, immutable payload + stale scope suppression; shared Dialog opcionális backward-compatible propok | 63/63 célzott; 56/56 és 616/616 coverage; type/lint/build/exact bundle/web 7/7/audit/secrets; mobile source 183/artifact 345/sync/drift 0/E2E 2; hosted 7/7 | nincs API/DB/Edge/dependency változás; frontend/shared-dialog commit reverttel visszaállítható; profile production rollout külön P0 | PR #174-ben mainre merge-elve (`0a33e8cd0309d35e820fb1df9e8194dfbcce7242`); run `29678100165`; artifact `8439647584`; production publish nyitott |
| I-26   | Admin override idempotency és tartós retry | additív v2 RPC, privát SHA-256 ledger, reserved-audit guard, determinisztikus authorization lockok, közös adapter, 30 s timeout, hét napos retry/reconciliation-horizontú PII-mentes outbox, egy unresolved művelet/scope, lokalizált `outcome_uncertain`; legacy v1 érintetlen | PG18 teljes contract; runner 12/12; outbox/API/UI/Dialog 82/82; teljes 666/666 coverage; typecheck/lint/build/bundle/web+mobile/Edge/security; hosted 8/8 | exact-key cleanup csak hiteles receipt után; minden hiba evidence-retaining; Web Locks hiányában RPC előtti fail-closed; DB-first/client-second; rollback client-first v1-re, v2/ledger marad; új dependency nincs; generated type cast az adapterre izolált | PR #175-ben mainre merge-elve (`f52671880748c58802d94e0705204d846f4b5928`); run `29682829301`; artifact `8441138073`; restored staging, linked DB és production deploy NO-GO |
| I-27   | Profiles tenant privacy és közös mobil mérföldkő/profile szerződés | restrictive select/update RLS, catalog-driven ACL, `get_my_profile_locale_v1`, self-only `update_my_workspace_profile_display_name_v1`, ötmezős milestone RPC, AST caller contract, shared adapters, CapacityFit, widget és i18n | runner 10/10; DB-runner 42/42; mind a 4 PG18 contract; focused 77/77; full coverage 727/727; type/build/bundle/audit/web 7/7; mobile 183/345/2, drift 0; hosted 9/9 | három RPC additív, de a raw preferences grant megvonása régi cached klienst funkcionálisan tör; controlled maintenance DB-first/immediate-client rollout, privacy ACL rollback tilos | draft PR #176; run `29687248014`; artifact `8442491749`; linked apply/live deploy nem történt; production P0 NO-GO |
| I-28   | Atomi workspace-member profilolvasás és -mentés | egy-statement read RPC, teljes-snapshot save RPC, server-managed `profile_revision`, exact self-name CAS, tenant office/allocation FK, restrictive policy, lexical/max-20 guard, minimális reserved audit, közös web/Android/iOS adapter, Auth/Edge writer contract és fail-visible UI | runner 15/15; atomic PG18 + négy legacy PG18; focused 208/208; full coverage 896/896; type/lint/build/bundle/Edge/security; mobile 183/345/2, drift 0; hosted 10/10 | forward-only DB/schema-cache-first rollout; stale kliens RPC hiányán fail-closed; rollback client capabilityvel, constraint/tenant guard nem lazítható; generated types csak history reconcile után | draft PR #177, final source `9dea63e…`, run `29868681921`, release `8510309445`, diagnostics `8510306792`, Android `8510265497`; production NO-GO |
| I-29   | Atomi business-role allokáció/törlés és durable identity-provisioning saga | bounded role draft, friss optimistic member snapshot/save, tenant-wide transactional delete+audit; pre-Auth saga négy állapottal, hat service-only RPC-vel, DB-first compensationnel, pending retry-prepare-rel, tenant-write guarddal, gated finalizerrel, Edge-writer/worker bekötéssel és operátori runbookkal | focused Vitest 99/99; Edge helper 60/60; entrypoint 30/30; runner 15/15; pinned PG18 member-profile/business-role/identity saga két-session finalizer/writer contracttal; full coverage 76/992; type/build/bundle/mobile PASS; lint ratchet 1 148/98, 11 javulás; hosted 10/10 | additív két migration; shared web/Android/iOS React/Supabase contract; DB/schema-cache-first rollout; worker/saga reverttel nem törölhető pending job mellett; recurring scheduler, restored staging és live attestation kötelező | draft PR #178, final source `f628d0b…`, run `29879703648`, release `8514318251`, diagnostics `8514316593`, Android `8514289059`; production NO-GO |
| I-30   | Fenced created-identity worker és dormant scheduler foundation | additív tokenes job lease, immutable expiry, késői worker tiltás, singleton run state, service-only v2 RPC-k; POST-only dedicated Edge worker; owner-only Vault/pg_cron installer és pause; legacy cleanup külön claim/prepare/complete handlerrel, 120 s renew-ölt tokennel és eligibility guarddal | Edge 86/86; inventory/config 31/31 és 65/65 pinned import; AST log-safety 9/9; runner 16/16; öt pinned PG18 contract, köztük token/late-writer/ACL/reclaim/same-owner cascade/expired-orphan rotation és determinisztikus két-session overlap/event-extension/temp-upgrade; source identity `5d38e629…`; hosted 10/10 | egy additív migration; scheduler nem települ automatikusan; DB→érintett Edge funkciók→scheduler-last; rollback/pause csak pending jobok és worker lease-ek auditja után | draft PR #179, implementation head `1e3d874…`, run `29885969841`, release `8516558700`, diagnostics `8516557751`, Android `8516531963`; production NO-GO |

## 7. Ellenőrzések és eredmények

Az I-26 PR #175-tel a `f52671880748c58802d94e0705204d846f4b5928` main SHA-ra
került; a `29682829301` hosted Quality Gate 8/8 PASS, beleértve Androidot és a
locked iOS compile-t. Ez source/CI bizonyíték, nem production deploy. Az I-27
profile-privacy source candidate current self-only runner 10/10, mind a négy
PostgreSQL contractja, focused 77/77, full coverage 727/727,
type/build/bundle/audit/web és mobile 183/345/2 + drift 0 kapuja zöld. A külön
v3.51.5 hosted run `29687248014` 9/9 PASS. Az I-28 atomic profile runner 15/15,
az új PG18 contract és mind a négy érintett legacy DB contract, focused 208/208,
full coverage 896/896, type/lint/build/bundle/Edge/security és mobile 183/345/2,
drift 0 kapuja PASS. Draft PR #177 final source commitja
`9dea63e733589a3debd7d6d794c353cb24a0e548`; a `29868681921` hosted Quality
Gate mind a 10 jobja PASS; release `8510309445`, diagnostics `8510306792` és
unsigned Android artifact `8510265497`. Az I-29 local candidate focused Vitest
99/99, Edge helper 60/60, entrypoint 30/30, runner 15/15, pinned PG18 member-
profile/business-role/identity-saga, két-session finalizer/writer serialization,
typecheck, build, bundle, web és mobile kapuja PASS. A teljes coverage 76 fájl /
992 teszt (51,27% statements/lines, 75,11% branches, 46,39% functions). A lint-
ratchet 1 148 error / 98 warning baseline-t rögzít 11 javulással. Draft PR #178
final source commitja `f628d0b7d0931be5f16ebd03e14a608648077ac8`; a `29879703648`
hosted Quality Gate 10/10 PASS. Release evidence `8514318251`, diagnostics
`8514316593`, unsigned Android artifact `8514289059`.
Restored staging, linked DB apply és production rollout egyik csomagnál sem
történt; az I-27 production státusza P0/NO-GO, az I-29 pedig a hiányzó recurring
identity-cleanup scheduler miatt külön is production NO-GO.

| Ellenőrzés                              | Eredmény                | Megjegyzés / fennmaradó kockázat                                                                                                                                   |
| --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci --no-audit --no-fund`           | PASS                    | lockfile-ból determinisztikus install                                                                                                                              |
| `npm run typecheck`                     | I-29 LOKÁLIS PASS       | A current-tree typecheck az atomi profil/business-role adapterrel, identity writer bekötéssel és minden mounttal PASS. |
| Admin override I-22 célzott regresszió  | PASS KORLÁTTAL          | 16 admin-flow + 7 lista-race + 32 conflict-i18n + 20 runtime contract = 75/75; typecheck és diff check PASS. A dinamikus PG18 szerver acceptance még nyitott. |
| Admin override I-25 a11y/fókusz/race    | PASS                    | 28/28 admin komponens + 4/4 valós Radix Dialog + 11 i18n + 20 runtime contract = 63/63; PR #174 és main hosted 7/7. Production keyboard/AT acceptance nyitott; profile privacy production rollout I-27 P0. |
| Admin override I-26 kliens/outbox       | LOKÁLIS PASS            | 16 outbox + 30 adapter + 32 komponens + 4 Dialog = 82/82; process-restart key restore, scope-onként egy unresolved művelet, eltérő payload blokkolása, minden hibaválasz evidence retentionje, bizonytalan/lejárt/sérült bizonyíték megtartása, Web Locks nélküli RPC előtti fail-closed, WebCrypto, strict storage, preflight UUID/timeout, actor-scope reset, HTTP 408/499/5xx/status `0`/malformed receipt `outcome_uncertain`, timeout/abort és stale-scope tesztelt. Fizikai WebView smoke nyitott. |
| Admin override I-26 PG18 contract       | LOKÁLIS PASS            | runner 12/12; PostgreSQL 18.4 két tenant, v1/v2 owner+ACL, same-key replay, malformed ledger, audit/quota rollback, duplicate/demotion serialization PASS. Restored staging és linked apply nem történt. |
| Profiles I-27 isolated runner           | LOKÁLIS PASS            | runner 10/10; SHA-pinned PostgreSQL 18.4, hálózat/host port nélkül, read-only mountokkal és ownership-alapú cleanup-pal. |
| Profiles I-27 PG18 contract             | LOKÁLIS PASS            | A current self-only fixture lefedi a két tenantot, restrictive select/update guardot, catalog-driven drift-column ACL revokot, három RPC owner/search-path/ACL-jét, self locale/profile update-et, ötmezős milestone/timezone-t és denial eseteket. Ez célzott contract, nem teljes replay vagy linked acceptance. |
| Profiles I-27 browser/client suite      | LOKÁLIS PASS            | Tíz focused fájl 77/77: AST caller inventory, shared adapterek, widget a11y/timezone/resume, i18n auth/tenant race, CapacityFit unique safe-directory matching és bounded provider-response validáció; célzott lint is PASS. |
| Atomic profile I-28 isolated runner     | LOKÁLIS PASS            | runner 15/15; SHA-pinned PostgreSQL 18.4, network/host port nélkül, read-only SQL mountokkal, exact container ID+ownership-label cleanup-pal; három same-name `CHECK(true)` drift fail-closed, hibás/disabled auth trigger és service-role ACL drift exact repair, idegen extra auth trigger silent delete nélkül fail-closed. |
| Atomic profile I-28 PG18 contract       | LOKÁLIS PASS            | Kétszeri apply, exact FK/index/CHECK/trigger/RLS/RPC owner-search_path-ACL, tenant/RBAC/entitlement, audit/cascade/rollback, revision/name conflict, 5 s lock timeout + fresh retry, mixed writer 40P01 whole-transaction abort és one-statement MVCC PASS. A négy legacy DB suite is PASS. |
| Atomic profile I-28 UI/client suite     | LOKÁLIS PASS            | Tizenegy focused fájl 208/208: strict read/save parser, full-snapshot/CAS, load/retry/conflict, abort/stale/unmount/double-submit, signup/Auth/Edge Unicode display-name parity, invalid self-name fail-closed, zero-row update, writer inventory, mount refetch, RBAC/entitlement, AuditLog action és nyolclocale recovery. Full coverage 70 fájl/896 teszt; typecheck, lint-ratchet és diff-check PASS. |
| Atomic profile I-28 build/security/mobile | LOKÁLIS PASS          | Production build; reviewed bundle JS 4,509,150 raw / 1,290,450 gzip, largest 1,756,879 / 558,651; Edge Deno 39/39, release identity 55/55; 1,485-fájlos secret scan; 128 migration schema provenance; dependency audit 0 vulnerability; mobile source 183/183, artifact 345/345, E2E 2/2, native drift 0. |
| Business role / identity I-29 focused suite | LOKÁLIS PASS | 99/99 focused Vitest: bounded exact allocation, optimistic save/delete adapter és manager, audit minimizálás, identity writer inventory/auth integration. |
| Created identity I-29 Edge contract       | LOKÁLIS PASS | 60/60 Edge helper teszt és 30/30 entrypoint check: négyállapotú saga, strict receipt, minden claimed `pending_auth` Auth-művelet előtti DB re-prepare, Auth delete, idempotens complete/fail és inventoried Edge writer/worker bekötés. Recurring scheduler nincs telepítve. |
| Business role / identity I-29 PG18 contract | LOKÁLIS PASS | Isolated runner 15/15; pinned PostgreSQL 18.4-en atomic member-profile save, tenant-wide business-role delete/serialization, membership/profile feltámasztást tiltó per-user write guard, gated finalization és két-session finalizer/writer serialization PASS. Ez nem linked apply vagy restored-staging bizonyíték. |
| I-29 typecheck és ESLint ratchet          | LOKÁLIS PASS KORLÁTTAL | Typecheck PASS. Ratchet baseline 1 148 error / 98 warning, 11 javulás; a történeti lint-adósság nem zéró és külön P2 marad. |
| Mind a 4 legacy PostgreSQL DB contract  | LOKÁLIS PASS            | `db:payroll:test`, `db:hr-workflow:test`, `db:admin-override:test` és `db:profiles-tenant:test` pinned PostgreSQL 18.4-en PASS; az I-29 member-profile/business-role/identity contracttal együtt ez öt current DB gate. Nem teljes migration replay vagy linked acceptance. |
| Release identity / Edge SBOM contract   | I-29 LOKÁLIS PASS       | Release-identity 55/55 és Edge SBOM 2/2; a verifier fixture a package aktuális verzióját olvassa, ezért patch-verzió emeléskor sem ad hamis hibát. Strict full-SHA/clean HEAD, deterministic web/mobile fingerprint, immutable Edge source-tree és pontos Edge inventory. |
| `release:verify:deployment`             | LOKÁLIS CONTRACT PASS / LIVE FAIL | A fail-closed verifier unit 27/27; a jelenlegi `effectime.app` még nem szolgál release manifestet, és a Lovable/Cloudflare immutable deployment-ID header/API mapping sincs igazolva, ezért production attestation NO-GO. |
| Mobile target suite                     | PASS                    | 93/93 célzott teszt: URL/origin, PKCE/deep-link és HTTPS raw-token tiltás, secure envelope/migráció/reinstall/reset tombstone/logout lock, recovery UX, CSP transform, native bridge és internal path |
| `npm run mobile:check:source`           | I-29 LOKÁLIS PASS       | 183/183 source assertion: exact dependency integrity/kétplatformos plugin allowlist, release identity, CSP, identity/deep link/minimumok, auth/data-source/CI és natív build-artifact contract. |
| `npm run mobile:check`                  | I-29 LOKÁLIS PASS       | A current shared `dist-mobile` és Android/iOS artifact contract 345/345 PASS; a v3.51.5 hosted kapu 9/9 PASS. |
| `npm run test:e2e:mobile:built`         | I-29 LOKÁLIS PASS       | 2/2 landing/auth bridge-emuláció a current `dist-mobile` artifacton PASS. |
| `npm run mobile:sync` / `npx cap sync`  | I-29 LOKÁLIS PASS       | Android/iOS sync PASS; tracked és untracked natív drift 0. |
| Android unit/lint/assemble              | I-27 HOSTED PASS        | Run `29687248014` Android jobja PASS, artifact `8442475433`; ez unsigned candidate, nem store release. |
| iOS Xcode build                         | I-27 HOSTED PASS        | Run `29687248014` locked Xcode buildje PASS; ez unsigned candidate, nem store release. |
| `npm test`                              | I-29 LOKÁLIS PASS       | A teljes Vitest állomány 76 fájl és 992/992 teszt PASS; külön funkcionális assertion-hiba nincs. |
| `npm run test:coverage`                 | I-29 LOKÁLIS PASS       | Current tree: 76 fájl, 992/992 teszt; statements/lines 51,27% (45 444/88 636), branches 75,11% (2 176/2 897), functions 46,39% (322/694). |
| `npm run test:e2e:built`                | I-29 LOKÁLIS PASS       | A current built-web smoke 7/7 PASS. |
| `npm run build`                         | I-29 LOKÁLIS PASS       | A current production build PASS; nincs új runtime dependency. |
| `npm run bundle:check`                  | I-29 LOKÁLIS PASS       | JS 4 527 940 raw / 1 296 700 gzip; largest 1 765 067 / 561 428; CSS 180 862 / 29 600. A +0,417% raw növekedés a review-zott I-29 contract; az exact ratchet csak a korábbi platformtoleranciát tartja meg. |
| `npm audit --audit-level=moderate`      | I-27 LOKÁLIS PASS       | 0 ismert vulnerability. |
| `npm run security:secrets`              | I-30 LOKÁLIS PASS       | 1 519 tracked és nem ignorált untracked text file magas bizonyosságú current-tree scan + tracked mobil signing-key fájlnév tiltás; history scan még nyitott. |
| `npm run lint:ratchet`                  | I-29 LOKÁLIS PASS       | 1 148 error / 98 warning; az I-29 11 további javulást rögzít, új vagy elmozdított diagnosztika nélkül. |
| Strukturált logger Deno teszt/check     | I-26 LOKÁLIS PASS       | Edge log-safety, `auth-email-hook` és `send-transactional-email` Deno 2.9.3 check PASS; strukturálatlan érzékeny hiba nem került vissza. |
| `npm run edge:check` / ratchet / test    | I-30 LOKÁLIS PASS       | 31/31 entrypoint és config, 0 Deno diagnostic; 65/65 remote import exact, 0 unpinned; Deno 2.9.3; Edge 86/86 PASS. Immutable source gate `5d38e629bc798af9e4536f51b819e2b99cd5378f95250478e09d05c3c26c6bce`, 89 fájl / 859 724 canonical byte. |
| Edge strukturált log és release SBOM    | I-30 LOKÁLIS PASS       | Adversarial AST log-safety 9/9, közvetlen és globális console/stdout/stderr escape tiltással; Edge SBOM unit 3/3, a 31 deployálható entrypoint/config teljes leltárával. |
| Payroll contract és UI regresszió       | PASS                    | Deno payroll contract 15/15; célzott Vitest 20/20; AuditLog allowlist 2/2; typed Edge check PASS; current full unit 549/549 |
| Payroll snapshot DB contract            | I-25 REVALIDÁLVA PASS   | runner unit 12/12; pinned PostgreSQL 18.4 migration/digest/ACL/search_path/trigger/negative auth/member drift/audit rollback PASS. A readiness valódi `SELECT 1` lekérdezéssel igazolja a név szerinti céladatbázist, ezért a konténerfolyamat és az adatbázis-létrehozás közti race fail-closed. Négy manipulált pgcrypto/schema trust eset fail-closed; runtime TRUNCATE, direct service reset és reserved-audit forge/tamper/delete tiltott; whitespace/NULL és 7/8/1000/1001 indokhatárok, exact prev/new audit, locked/exported/legacy reopen auditált. Determinisztikus lock és reopen exactly-one-winner, valamint actor-demotion→reopen fail-closed, bitazonos sor/0 audit igazolt. Collisionteszt idegen konténert megőriz; nincs hálózat/host port, csak két read-only mount, ownership-ID+label cleanup PASS. Ez célzott fixture, nem teljes migration replay. |
| HR workflow tenant DB/UI contract       | I-25 REVALIDÁLVA PASS   | runner unit 8/8; pinned PostgreSQL 18.4 static contract, repeat apply és legacy-row preservation PASS; cross-workspace template/membership/instance/task/assignee, inactive membership, member/admin RLS, list PII, parent cascade és exact RPC/FK catalog fail-closed. Négy determinisztikus reassignment/suspension/direct-write lock-race PASS. UI data+a11y+request-ordering 10/10; nincs `eq.undefined`, backend/task hiba fail-visible, pending instance-read deduplikált, workspace-váltás és unmount utáni válasz invalidált. Nincs hálózat/host port; exact ownership cleanup és bounded child termination. Célzott fixture, nem teljes migration replay vagy restored-staging bizonyíték. |
| Schema provenance gate                  | I-30 LOKÁLIS PASS KORLÁTTAL | Unit 7/7 és exact-debt gate PASS 131 migráción; az I-27–I-30 candidate RPC-k, private worker state és a `profile_revision` nincsenek generated types-ban, ezért az exact local interface nem helyettesíti a hiteles linked-schema regenerálást. |
| SBOM és release manifest                | I-29 HOSTED PASS | Run `29879703648`, release evidence artifact `8514318251`, diagnostics `8514316593`; ez source candidate evidence, nem live deploy. |
| GitHub-hosted quality workflow          | I-29 PASS | Draft PR #178 final source `f628d0b7d0931be5f16ebd03e14a608648077ac8`; run `29879703648` mind a 10 jobja PASS, benne az öt PostgreSQL contract, frontend/Edge, Android és locked iOS. |
| I-30 hosted release evidence            | PASS | Draft PR #179 implementation head `1e3d874275c33115e97c0216ef36e5b832edd3f7`; run `29885969841` mind a 10 jobja PASS, release artifact `8516558700`, diagnostics `8516557751`, unsigned Android `8516531963`. Ez source/CI bizonyíték, nem linked apply vagy production deploy. |
| Új v3.51.3 migration PG18 compile/apply | PASS                    | Access submit/döntés/ledger/rollback szemantika PASS; candidate dual-feature compile PASS, candidate runtime smoke megszakadt; production/linked apply nem történt |
| Clean lokális migration replay          | FAIL                    | 104/131 után `20260517230000...`: `plugin_webhook_events` helyi CREATE TABLE hiányzik                                                                              |
| Linked `db lint --level warning`        | FAIL                    | 7 error, 6 warning; read-only ellenőrzés                                                                                                                           |
| Live `effectime.app` release attestation | FAIL                    | A Lovable/Cloudflare root elérhető, de `/.well-known/effectime-release.json` továbbra is 404. A live artifact ezért nem köthető az I-27–I-30 SHA-k egyikéhez sem; production attestation NO-GO. |
| Linked DB write/deploy                  | NEM FUTOTT              | szándékosan; history drift miatt veszélyes lenne                                                                                                                   |

Az első build-újrafutásnál átmeneti helyi npm/Node launcher hiba jelent meg; az
eszközútvonal ellenőrzése után ugyanaz a parancs sikeresen lefutott. Nem termék-
vagy forráskódhibaként van lezárva, mert a tényleges production build PASS.

## 8. Technikai adósság és javasolt sorrend

1. A P0 HR workflow candidate forrás/contract elkészült; következő kapu az
   aggregált cross-tenant inventory restored stagingen és minden non-zero sor
   jóváhagyott, adatmegőrző rendezése.
2. Production backup és a 59/69/84 migration history tartalmi/hash reconcile.
3. Hiányzó 30 tábla, 1 view, 46 function és 2 enum eredetének besorolása; read-only
   live dumpból transitívan teljes recovery migration; clean replay
   131/131 és jóváhagyott schema diff.
4. Linked DB lint 7 error javítása repair migrationökben.
5. I-26 restored-snapshot acceptance; v2 DB/schema-cache deploy a kliens előtt,
   majd web/Android/iOS ugyanabból az attestált forrásból. Rollbackkor először a
   kliens tér vissza v1-re; a v2 ledger nem törölhető aktív v2 kliens mellett.
6. I-27 controlled/maintenance rollout: teljes browser+Edge caller inventory,
   restored-staging old-client fail-closed és new-client acceptance, exact három-
   RPC/RLS/catalog ACL/schema-cache ellenőrzés, DB-migráció és azonnali kliens-
   rollout egy változtatási ablakban. A korábbi cached kliens raw
   `profiles.preferences` olvasása a hardening után szándékosan permission hibát
   kap; ez adatvédelmileg biztonságos, de funkcionálisan inkompatibilis.
7. I-28 restored-staging inventory és DB/schema-cache-first rollout: allocation
   tenant/lexical/canonical/cardinality, membership metadata, office tenant és
   display-name inventory csak jóváhagyott adatmegőrző remediation után lehet
   nulla; utána atomic read/save old/new-client acceptance és azonos attestált
   web/Android/iOS kliens.
8. Az I-30 fenced worker és dormant least-privilege scheduler forrása elkészült.
   A legacy temp-cleanup eligibility/lease/deadline review, same-owner cascade,
   expired-orphan tokenrotáció és két determinisztikus race lokálisan zöld. A
   következő kapu a restored-staging DB→négy Edge artifact→scheduler-last fault-injection:
   provisioning/pending age, dead-letter, pg_net response/worker-state
   korreláció, overlap/singleton és secret-rotation acceptance. Telepített és
   monitorozott scheduler-bizonyíték nélkül a direct identity provisioning
   production NO-GO marad.
9. Az I-29 BusinessRoleManager allokáció/save/delete restored-staging acceptance:
   max-20/exact-100/exact-one-priority, tenant/RBAC/entitlement, konkurens delete/
   save, audit és régi kliens fail-closed; utána a site priority/goals tenant FK
   és szerveroldali authorization P1 csomag.
10. Multi-step approval chain runtime és concurrency/E2E.
11. Staging deploy azonos commitból: DB, Edge, frontend; adversarial RBAC/tier,
    invite, leave, access, payroll, API/webhook és integration smoke.
12. Biztonságos instant provisioning termékdöntése és implementációja.
13. Account deletion retention/kompenzáció, data migration resumability.
14. A hosted quality gate required-checkként való fenntartása; a zero-diagnostic
    és zero-unpinned Edge baseline, illetve a schema-provenance ratchet őrzése.
15. Store/app-ID/signing ownership és verified links; Android CI + macOS/Xcode
    CI; kétplatformos secure-storage/CSP/tenant/RBAC/auth fizikai smoke és csak
    ezután internal TestFlight/Play rollout.
16. Fokozatos lint-, coverage-, E2E- és bundle-adósság csökkentés.

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

Az audit- és hardening-forrás PR #167–#175-ből bekerült a `main` ágba. Az I-26
admin-override exactly-once csomag PR #175 merge SHA-ja
`f52671880748c58802d94e0705204d846f4b5928`; a `29682829301` Quality Gate mind a
8 jobja PASS, beleértve Androidot és locked iOS compile-t. A release evidence
artifact `8441138073`, az Android artifact `8441127446`. Ez source/CI és unsigned
native bizonyíték, nem production release: restored staging, linked DB apply,
matching Edge/web deploy és live SHA-attestation nem történt.

Az I-27 profile-privacy és I-28 atomic member-profile source candidate-ek
forrás-, lokális és hosted kapui zöldek. Az I-28 végleges PR-headje `9dea63e…`;
a `29868681921` Quality Gate 10/10 PASS, release `8510309445`, diagnostics
`8510306792`, unsigned Android artifact `8510265497`. Ezek source/CI
bizonyítékok, nem linked apply vagy production release.

Az I-29 v3.51.7 source + hosted candidate atomi `BusinessRoleManager` allokáció/save/delete
határt és durable pre-Auth identity-provisioning sagát ad. A focused Vitest
99/99, Edge 60/60, entrypoint 30/30, runner 15/15, pinned PostgreSQL 18.4
member-profile/business-role/identity-saga két-session concurrency contracttal,
teljes coverage 76 fájl / 992 teszt, typecheck, build, bundle, web/mobile és lint-
ratchet kapuk zöldek. Draft PR #178 final source commit `f628d0b…`; a hosted
`29879703648` run 10/10 PASS, release `8514318251`, diagnostics `8514316593`,
unsigned Android artifact `8514289059`. A web, Android és iOS változatlanul
ugyanazt a React/Supabase adatforrást használja.

Az I-30 v3.51.8 local candidate tokenesen fence-elt created-identity jobokat,
whole-worker singletont, bounded POST-only Edge workert és owner-only, dormant
Vault/pg_cron installert ad. A 86/86 Edge, 31/31 entrypoint/config, 65/65 pinned
import, AST log-safety 9/9, runner 16/16 és mind az öt pinned PG18 contract,
köztük a late-worker/single-flight/event-extension/temp-upgrade védelem,
lokálisan zöld. A scheduler nem települt; a hosted bizonyíték még a candidate
lezárási kapuja.

**Kiadási döntés: production/backend NO-GO.** A v3.51.6 read-only linked baseline
59 shared / 69 local-only / 84 remote-only volt, az I-29 két további unapplied
local migrationt ad; az I-30 további egy candidate migrationnel a clean replay
104/131 után elakad, a linked lint hibás és a
live release manifest hiányzik. A created-identity cleanup recurring schedulere
nincs telepítve, ezért a kompenzáció automatikus működése sem release-képes.
Backup, history reconcile, 131/131 clean replay, restored-staging old/new-client
és fault-injection acceptance, reviewed scheduler, DB-first apply/schema-cache,
majd azonnali attestált web/Android/iOS rollout kötelező. A privacy ACL és pending
saga adat rollbackként sem lazítható/törölhető.

Az Android/iOS közös forrás és unsigned hosted build fejlesztésre alkalmas, de a
store release külön **NO-GO**, amíg a `docs/mobile/README.md` signing,
verified-link, brand-asset és fizikai secure-storage/CSP/auth kapui nem teljesülnek.
Production csak tiszta candidate SHA, teljes DB-reconcile, működő cleanup
scheduler, jóváhagyott staging és ellenőrzött rollout után bocsátható ki.
