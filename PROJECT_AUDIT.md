# Effectime Enterprise — projektátvételi és release-audit

Audit dátuma: 2026-07-17–23
Repository: `C:\Work\Github\effectime-app-enterprise-a95029a1`
Remote: `HenrikFaul/effectime-app-enterprise-a95029a1`
Auditált main HEAD: `f52671880748c58802d94e0705204d846f4b5928`
Munkabranch: `codex/export-wizard-integrity`

## 1. Átvételi összkép

**BIZONYÍTOTT:** a korábbi „egyetlen magyar landingoldal” következtetés hibás
volt, mert a `C:\Work\effectime-app-enterprise` útvonalon lévő, kilenc commitból
és 73 fájlból álló másik checkout alapján készült. Ez az audit kizárólag a
felhasználó által megadott `C:\Work\Github\effectime-app-enterprise-a95029a1`
repositoryra vonatkozik.

**BIZONYÍTOTT:** a helyes repository a teljes Effectime Enterprise terméket
tartalmazza: több mint 846 elérhető alapcommit, a candidate-del több mint 1 500
  követett vagy új fájl, 149 jelenlegi enterprise UI-fájl, az I-38 candidate-del
138 helyi SQL-migráció és 31 Edge Function-könyvtár. A publikus oldal,
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
repository és a linked adatbázis migrációtörténete nem reprodukálható egymásból.
A korábbi 105. migrációs töréspont két hiányzó történeti DDL-je bitpontosan
visszakerült, és az első forward-only ACL/search-path hardening local PG17
contractja zöld, de linked apply és teljes Supabase clean replay még nem futott.
Az I-33 forward-only candidate a plugin-konfigurációkat privát táblába mozgatja
és a publikus kompatibilitási oszlopot `{}` értékre redaktálja; az I-34 ugyanazon
RPC mögött Enterprise-entitlementet és exact `published` kaput ad. A linked
adatbázisra egyik sem lett alkalmazva. Az I-35 candidate a történeti
install/uninstall számlálórace-t friss statement-snapshotra épülő lock-protokollal
  javítja, és a már stale derived értékeket öt másodperces fail-closed lock-budget
  mellett globálisan reconciliálja; a lokális contract- és széles kapuk, valamint
  az implementációs SHA 11/11 hosted Quality Gate-je zöld. Az I-36 a változatlan
  install RPC-re öt másodperces funkciószintű lock-budgetet, sanitizált klienshiba-
  szerződést és stale-workspace-safe kézi retry UX-et ad; a pinned PG17.6
  timeout/rollback/retry contract és minden széles lokális kapu zöld. Linked
  apply egyik csomagnál sem futott.
  Az I-37 code-only source+hosted candidate az exact owner számára a marketplace entitlement-
  gaten kívüli, katalógusfüggetlen installed-plugin cleanup felületet ad aktív
  Enterprise→Pro/Freemium downgrade és catalog archival után; a lokális teljes
  regressziós, webes és közös Android/iOS kapuk, valamint az implementációs SHA
  11/11 hosted Quality Gate-je zöld, production deploy nincs.
  Az I-38 source+hosted candidate a minden hosted jobon jelentkező Node 20
  action-runtime deprecációt teljes SHA-ra rögzített Node 24 actionökkel és
  cache-policy regressziós contracttal váltja ki; a lokális kapuk és az
  implementációs SHA 11/11 hosted Quality Gate-je nulla annotációval zöld.
  Az I-39 source+hosted candidate a current-tree secret kaput explicit HEAD +
  minden fetched ref teljes Git-történetére kiterjeszti; a végső hosted kapu
  11/11 zöld és nulla annotációt adott. Az I-40 frontend candidate a feature
  entitlement cache-t actor/workspace kulcsra váltja, stale refetch-hibánál
  központilag fail-closed, malformált RPC-választ validál, és token nélküli
  iCal-revoke recovery felületet ad. Request-owned A→B→A retry, kizárólagos
  recovery/content állapot, history-replace és main-landmark fókusz-helyreállítás
  készült; a célzott 9 fájl / 68 teszt, teljes 86/1076, type/lint/build/bundle,
  web/mobile, Edge/security és hat izolált DB-contract lokálisan zöld. Hosted
  kapu és production deploy még nincs állítva.
  Az I-41 v3.51.19 candidate az invitation UI, a bulk-import service-role ág,
  az issue/reissue RPC és a közvetlen authenticated INSERT/UPDATE határ számára
  ugyanazt az exact `members_invite` entitlementet teszi kötelezővé. A változatlan
  RPC/accept/cleanup szerződést pinned PostgreSQL 18.4 contract, a UI/Edge ágat
  célzott tesztek és külön hosted DB job védi. A teljes lokális 88 fájl /
  1083 teszt, build, web/mobile, Edge/security/provenance és mind a hét izolált
   DB-contract zöld; az exact branch-head hosted kapuja 12/12 PASS és 0
   annotáció. Linked apply és production deploy nem történt.
  Az I-42 v3.51.20 source + hosted candidate az aktív Import/Export Center Import módját és
  az `import-entity-data` service-role íráshatárát ugyanarra az exact
  `csv_import` + `members_list` döntésre köti. A kapu auth/RBAC után, de audit,
  dry-run, referenciaolvasás és mutáció előtt fut; 403/503 válaszai sanitizáltak.
  Focused 23/23, Deno 10/10, Edge 96/96, teljes 90 fájl / 1092 teszt, build,
  web/mobile, security és provenance lokálisan zöld. Az exact source head hosted
  kapuja 12/12 PASS és 0 annotáció; production deploy nem történt.
  Az I-43 v3.51.21 source + hosted candidate az import teljes request-határát valós
  `Request`-tesztelhető handler factoryba emeli, a tiltott auth/RBAC/entitlement
  útvonalakon nulla executort bizonyít, és stabil additív hibakódot,
  request-korrelációt, `no-store` választ és CORS-exponált `X-Request-Id` headert
  ad. A fatal és tíz row-write provider üzenet sanitizált, minden visszatükrözött
  sorérték 256 Unicode code pointra korlátozott, kilenc dependency read és az
  `import.started` audit fail-closed. A post-write completion-audit csak bounded
  warning lehet, ezért a szekvenciális írások atomitása változatlanul nyitott.
  A CSV-generátor a spreadsheet formulákat szöveggé neutralizálja, az AST
  log-kapu pedig tartós regresszióvédelmet ad. Focused 52/52, teljes 92 fájl /
  1116 teszt, Edge 109/109, entrypoint 31/31, type/lint/build/bundle, web 7/7,
  mobile 390/390 + 2/2, security/provenance/release és mind a hét izolált
  PostgreSQL-contract lokálisan PASS. Az exact source head hosted kapuja 12/12
  PASS és 0 annotáció; production deploy nem történt.
  Az I-44 v3.51.22 source + hosted candidate az aktív Import Wizard feltöltés utáni
  zsákutcáját közvetlen mapping-lépéssel zárja le, és dependency-free kliens
  adapterrel csak belsőleg konzisztens success/accounting/error választ fogad
  el. A tömörített valid sorok szerverindexét visszaköti az eredeti fájlsorhoz;
  csak az allowlistelt status/code párral igazolt 4xx preflight elutasítás
  definitív, míg az ismeretlen 4xx, 5xx, hálózati hiba és malformált 200
  ismeretlen kimenetel, automatikus retry nélkül. A Functions/error bodyból
  csak allowlisted code/status és korrelációbiztos request ID jelenhet meg, a
  hibabody olvasása 2 másodperces timeoutot kap; az
  import/export adatlekérések pedig raw provider-detail nélkül fail-closed
  működnek. Nincs DB-, Edge-, request-shape- vagy dependency-változás. A célzott
  öt adapter/data-fetcher/guidance/i18n/komponens fájl 89/89, teljes 96 fájl /
  1 190 teszt,
  type/lint/build/bundle, web 7/7, mobile release 410/410 + 2/2, Edge 109/109,
  security/provenance/release és mind a hét izolált PostgreSQL-contract PASS.
  Az exact source head hosted kapuja 12/12 PASS és 0 annotáció; production
  deploy nem történt.
  Az I-45 v3.51.23 source + hosted candidate a közös Reports/Audit/Export shell három
  külön RBAC-képességét a saját exact `run_report` / `audit_log` /
  `export_center` entitlementjével metszi, így sem sibling permission, sem
  sibling entitlement nem tágíthatja a mountolást. Az aktív legacy leave export
  minden provider-, transport- és null-read hibán fail-closed, auditálás előtt
  nem indít letöltést, a CSV formulaértékeket semlegesíti, a dátumátfedést
  helyesen kezeli, az Excel XML-t `.xls` néven jelöli, és workspace-váltás/
  dupla kattintás ellen generációs single-flight védelmet kapott. Focused 83/83,
  teljes 99 fájl / 1223 teszt, type/lint/build/bundle, web 7/7, mobile source
  228/228 + determinisztikus sync + release 410/410 + 2/2 lokálisan PASS; az
  exact source head hosted Quality Gate-je 12/12 és 0 annotáció. A böngészőoldali RLS
  továbbra sem exact export-permission boundary, az audit actor caller-owned,
  a többquerys export pedig nem atomi, exact-count snapshot; ezért server-owned
  export RPC/job és restored staging nélkül production **NO-GO**.
  Az I-46 v3.51.24 source candidate lezárja a Settings alatti második Export
  Wizard mount-bypasst: az export és import capability külön, exact módon jut el
  a mode/dialog/wizard határig, entitlementvesztéskor a futó scope invalidálódik,
  módváltáskor a tiltott entitás nem vihető át. Az aktív wizard most artifactot
  épít, exact-null auditválaszt követel, és csak utána kér böngészőletöltést;
  minden entity read null/malformed/rejected envelope-en fail-closed. A már
  elindított audit scope-váltáskor még befejeződhet
  `browser_download_pending` jelöléssel, de a következő stale-check után nincs
  letöltés, toast vagy dialog-zárás; észlelt stale állapotból új audit nem indul.
  A célzott
  nyolcfájlos 120/120 teszt, teljes single-worker 101 fájl / 1267/1267 coverage, typecheck,
  változatlan 1108/98 lint-ratchet, build/bundle, web 7/7, mobil 2/2 + clean
  release 410/410 és Edge
  109/109 + 31/31 kapu PASS. Az exact `0a4994d…` head hosted runja
  (`29965167738`) 12/12 PASS, nulla annotáció; potential merge `a120686…`, PR
  #195 `MERGEABLE/CLEAN`.
  Ez továbbra is kliensintegritási candidate: authoritative server permission,
  actor, snapshot és lapozás nélkül production **NO-GO**.
A generált
public sémából 25 tábla, 1 view, 41 függvény és 2 enum eredete továbbra sem
bizonyítható migrációval, és a dokumentált többlépcsős approval chain nincs
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
- Git remote, branchek, több mint 860 elérhető commit, commitüzenetek, tagek,
  stash-ek és release-ek.
  Tag és stash nincs; a repositoryhoz nem találtunk ki külön issue-követelményt.
- `package.json`, lockfile-ok, Node/npm engine, Vite, TypeScript, ESLint, Vitest,
  Tailwind, PWA, Vercel, Capacitor és GitHub Actions.
- A generált, verziókezelendő `android/` és `ios/` platformprojektek, natív
  manifest/plist, deep-link szerződés, PKCE bridge, lifecycle, PWA-elválasztás,
  Keychain/AndroidKeyStore session adapter, migráció, mobil CSP, külön build,
  mobile contract, komponensszintű cold/warm callback és natív E2E tesztek.
- Mind a 137 lokális migráció, generált Supabase típusok, RLS/policy-k, RPC-k,
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
- Current-tree magas bizonyosságú secret scan 1 556 követett és nem ignorált
  untracked szövegfájlon, plusz mobil signing-key fájlnév tiltással. A teljes,
  fetched refekből és az explicit HEAD-ből elérhető Git-előzmény külön
  scannerrel: az exact `ce79141…` implementációs HEAD-en 884 commitobjektum,
  0 annotált tagobjektum, 3 653 egyedi blob, 1 618 tartalmilag is vizsgált
  történeti útvonal, 3 606 szöveges és 47 bináris blob, összesen 208 967 248
  streamelt objektum-byte. Követett service-role kulcsot, privát provider
  secretet vagy történeti signing fájlt nem találtunk. Ez magas bizonyosságú
  pattern gate, nem általános entropy- vagy minden kódolást felismerő DLP.

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
| R-039 | Hiányzó remote migrációforrások bitpontos helyreállítása | linked history, generated types, későbbi feltétlen táblahivatkozások és remote statement-fetch | BIZONYÍTOTT source + hosted candidate | eredeti clock/marketplace SQL, kódba és manifestbe rögzített exact SHA-256/byte attesztáció, LF checkout contract, CI byte- és schema-provenance kapu | forrásban igen; linked DB-t nem ír | byte gate 9/9 + 2/2, schema parser 7/7, 133-migration exact gate; hosted 10/10 PASS | igen | draft PR #180, implementation head `b98cdc8…`, run `29888707884`; production NO-GO | full Supabase replay, további remote-source recovery, forward-only ACL/tenant/secret hardening és restored staging |
| R-040 | Recovered clock/marketplace explicit ACL, immutable search path és drift-attesztáció | linked catalog/ACL/policy/source inventory + recovered SQL + independent security review | BIZONYÍTOTT source + hosted candidate | forward-only PG17 migration; exact 10-policy, owner/config/source/pgcrypto preflight; browser least privilege és veszélyes role-capability tiltás; service-role contract preservation; QR exact extension binding | candidate-ben igen; linked DB-t nem ír | runner 11/11; pinned PG17.6, 15/15 tamper + repair/reapply/RPC/RLS smoke; invariants 34/34; full 76/995; web/mobile/release gates; hosted 11/11 PASS | igen | draft PR #181, implementation head `4046c8a…`, run `29891543713`; production NO-GO | history reconcile, restored staging, linked apply; plugin config safe projection/Vault; clock tenant/retention/idempotency wave |
| R-041 | Plugin-konfiguráció browser-secret határa közös web/Android/iOS adatúton | történeti public JSONB + active-member SELECT policy + webhook URL manifest + runtime caller inventory | BIZONYÍTOTT source + hosted candidate | forward-only private table/backfill; public `{}` CHECK; atomikus install/reinstall; cascade uninstall; enabled + workspace-páros service getter; browser AST caller gate | candidate-ben igen; linked DB-t nem ír | runner 11/11; pinned PG17.6: 15 korábbi + 7 új preflight és 3 reapply tamper, known-role ACL repair, legacy JSON-shape/tenant/role/atomicity/apply+reapply; browser caller 1/1; full 77/996; hosted 11/11 | igen | draft PR #182, final head `e9cddac…`, run `29897254527`; production NO-GO | restored staging és DB-first rollout; Vault/rotation/restore; webhook tenant FK/SSRF/retention következő hullám |
| R-042 | Plugintelepítés Enterprise-entitlementje és published-only szerződése | marketplace specifikáció `plugin_install` Enterprise mappingje + történeti RPC `approved` elfogadása + UI exact `published` szűrése | BIZONYÍTOTT source + hosted candidate | változatlan install RPC-shape; server-side `plugin_install` kapu; exact `published`; státusz sorlock alatti újraellenőrzése; meglévő installok és uninstall megőrzése | candidate-ben igen; linked DB-t nem ír | runner 12/12; pinned PG17.6: 40 fail-closed tamper, ebből 15 install-policy; státusz-race rollback, két-workspace konkurens count, reapply; full 77/996; type/build/web/mobile/security/Edge kapuk; hosted 11/11 | igen | draft PR #183, implementation head `1aa7bcd…`, run `29901330094`; production NO-GO | history reconcile; restored-staging DB-first apply; P2 stale install-count race, runtime feature-metaadat, downgrade UX, getter-policy és bounded lock-wait |
| R-043 | Plugin install/uninstall számláló konzisztencia és meglévő drift helyreállítása | történeti uninstall statement-snapshot + determinisztikusan reprodukált `1 aktív / 0 tárolt` állapot + marketplace UI rendezés/megjelenítés | BIZONYÍTOTT source + hosted candidate | változatlan uninstall RPC-shape/OID/ACL; külön plugin `FOR NO KEY UPDATE`; következő statementben friss count; öt másodperces fail-closed lock-budget és drift-only globális reconciliation | candidate-ben igen; linked DB-t nem ír | runner 14/14; pinned PG17.6 végső teljes contract 95,6 s: 43 tamper, legacy red, globális repair, fixed green, grandfather/API/ACL/OID és dupla reapply; type/coverage/lint/build/web/mobile/Edge/security/provenance lokálisan PASS; hosted 11/11 | igen | draft PR #184, implementation head `cb0358e…`, run `29907202609`; production NO-GO | history reconcile; plugin-write drain; restored-staging DB-first apply + exact post-count; ugyanazon SHA deploy |
| R-044 | Bounded plugin-install lock wait és sanitizált kézi retry | install RPC késői plugin-sorlockja korlátlanul várhatott; a kliens nyers backend hibaüzenetet fűzött a toastba | BIZONYÍTOTT source + local/hosted contract | változatlan RPC body/API/OID/ACL mellett `lock_timeout=5s`; 55P03/40P01/40001 bounded klienshiba; raw részletek tiltása; per-plugin pending, explicit retry és szinkron workspace-azonossági stale-result guard | candidate-ben igen; linked DB-t nem ír | runner 14/14; API+UI 21/21; pinned PG17.6 46 tamper + exact blocker + 4,5–8 s 55P03 + teljes rollback + stabil-ID manual retry + dupla reapply; full 79/1017; type/lint/build/bundle/web/mobile/Edge/security/provenance PASS; hosted 11/11 | igen | draft PR #185, implementation head `d75f269…`, run `29913434706`; production NO-GO | history reconcile; restored-staging DB-first apply; timeout-metrika |
| R-045 | Owner-only installed-plugin cleanup aktív csomag-downgrade vagy katalógus-archiválás után | I-34 grandfathering/uninstall contract + marketplace FeatureGate és runtime caller inventory | BIZONYÍTOTT source + hosted candidate | `InstalledPluginCleanupPanel`, `WorkspaceDashboard`, meglévő redaktált inventory hook és owner-only uninstall RPC | candidate-ben igen; Enterprise→Pro/Freemium Settings útvonalon | cleanup 16/16; focused 6 fájl / 52/52; full 80/1034; type/lint/build/bundle/web/mobile/Edge/security/provenance PASS; hosted 11/11 | igen | draft PR #186, implementation head `cfb1322…`, run `29917203882`; production nincs deployolva | authenticated owner/non-owner downgrade/archive E2E; inactive/expired product policy; ugyanazon SHA production acceptance |
| R-046 | GitHub Actions Node 24 runtime és változatlan cache/artifact szerződés | hosted run `29917203882` 11/11 zöld, de 11/11 Node 20 deprecation annotáció + hivatalos action release-ek | BIZONYÍTOTT source + hosted candidate | `quality.yml`, `check-mobile-foundation.mjs`; checkout v5.1.0, setup-node v5.0.0, upload-artifact v6.0.0, setup-java v5.2.0 és setup-deno v2.0.5 immutable SHA-val | igen; app runtime és deploy útvonal változatlan | local source 216/216 és teljes regresszió PASS; implementation run `29920014033` és docs-head `29920515458` 11/11, 0 összes/Node 20 annotáció; logban 6 no-cache / 5 cache és Node 22.23.1 | igen | draft PR #187, final head `aeb9b9e…`; production nincs deployolva | production history/staging/same-SHA blokkerek feloldása |
| R-047 | Teljes fetched Git-előzmény magas bizonyosságú secret kapuja | korábbi current-tree-only scanner + auditban nyitott history scan | BIZONYÍTOTT source + local/hosted contract | közös detector core; current-tree és explicit HEAD + all-ref blob/commit/tag scanner; külön, tartalmilag vizsgált történeti path inventory; CI a dependency install előtt | igen a candidate-ben | scanner 10/10; current 1 556; exact `ce79141…` local history 884 commitobjektum / 0 tag / 3 653 blob / 208 967 248 byte; hosted merge 884 / 0 / 3 655 / 209 574 766; source 226/226; hosted 11/11 | igen | draft PR #188; run `29927511094` 11/11, 0 annotáció | production rollout-blokkerek változatlanok |
| R-048 | Feature-entitlement outage fail-closed recovery és tokenminimalizált iCal-visszavonás | dokumentált P2 gap + TanStack stale-data reprodukció + hook/dashboard/iCal runtime call path | BIZONYÍTOTT source + local/hosted candidate | actor/workspace query key; runtime payload parser; csak sikeres queryből publikus feature set; request-owned sanitized retry; kizárólagos recovery/content; history-replace + fókusz; token nélküli `id, scope` summary; exact ID/workspace/user revoke és per-token sticky hiba | igen a candidate-ben; DB/API/dependency változatlan | focused 9 fájl / 68/68; full coverage 86/1074 + final full 86/1076; type/lint/build/bundle; web 7/7; mobile 226/388/2/408; audit/secrets/Edge és 6 DB-contract; hosted 11/11, 0 annotáció PASS | igen | draft PR #189, implementation `76f3c84…`, run `29934837022`; production NO-GO | authenticated outage→recovery acceptance; ugyanazon SHA publish csak rollout-blokker feloldása után |
| R-049 | Exact `members_invite` entitlement minden meghívási íráshatáron | feature catalog + Dashboard/MemberList + bulk import + issue RPC/RLS/trigger runtime inventory | BIZONYÍTOTT source + hosted candidate | közös fail-closed UI-döntés; Edge tenant-feature preflight; változatlan RPC mögötti direct entitlement; INSERT/UPDATE RLS+trigger; külön PG18 CI contract | igen a candidate-ben; accept/DELETE változatlan | focused Vitest 18/18; Deno target 7/7 és Edge 93/93; runner 10/10 + pinned PG18; full 88/1083; type/lint/build/bundle/web/mobile/security/provenance és 7 DB-contract; hosted 12/12, 0 annotáció PASS | igen | draft PR #190, head `4dbba09…`, run `29939910831`; production NO-GO | linked DB-first staging csak history reconcile után |
| R-050 | Exact `csv_import` + `members_list` entitlement az aktív import UI- és service-role íráshatáron | tier matrix + feature catalog + WorkspaceDashboard → ImportExportCenter → ImportWizard + Edge runtime call path | BIZONYÍTOTT source + hosted candidate | közös fail-closed UI-döntés; entitlement-loss állapot/fókusz recovery; Edge tenant-feature preflight auth/RBAC után és audit/dry-run/read/write előtt; sanitizált 403/503 | igen a candidate-ben; Export változatlan | focused 23/23; Deno 10/10; Edge 96/96; full 90/1092; type/lint/build/bundle/web/mobile/security/provenance PASS; hosted 12/12 és 0 annotáció | igen | draft PR #191, head `91696b6…`, run `29942854980`; production NO-GO | authenticated tier/outage acceptance; külön transactional/dry-run/schema-version csomag |
| R-051 | Bounded CSV-import failure, audit és spreadsheet-output boundary | raw fatal/tíz row-write provider message; hét prerequisite read hiba üres adatként kezelve, kettő raw provider részlettel leállva; ignored `import.started` insert; non-POST/invalid-JSON contract és formula-leading CSV reprodukció | BIZONYÍTOTT source + hosted candidate | valós `Request` handler factory; zero-executor auth/RBAC/exact-feature denial; stabil additív code/request ID/no-store/CORS; bounded log/row error; mind a kilenc prerequisite read és start-audit fail-closed; CSV formula neutralization; AST structured-logger/console gate + külön provider-detail contract | igen a candidate-ben; success shape változatlan, error code/header additív | focused 52/52; full 92/1116; Edge 109/109; entrypoint 31/31; type/lint/build/bundle; web 7/7; mobile 390/390 + 2/2; security/provenance/release és hét DB-contract PASS; hosted 12/12, 0 annotáció | igen | draft PR #192, source `4dfa4b1…`, run `29949758390`; production NO-GO | transactional DB boundary, mutation-time authz/revoke és guaranteed failed/completion audit |
| R-052 | CSV-import kliensintegritás és fail-visible adatlekérés | aktív Wizard step-2 zsákutca; malformált 200 hamis készállapot; tömörített sorindex; stale parse/result race; guidance-row limit/index drift; üres/duplikált header és mapping-collision; raw Functions/provider UI detail; ignored category/position lookup error | BIZONYÍTOTT source + hosted candidate | single-attempt validáló adapter; source-index remap; csak matched handler 4xx definitive; minden unknown-4xx/5xx/network/malformed outcome-unknown; bounded allowlisted code/request ID; last-selection-wins és confirmation invalidation; versioned guidance marker; fail-closed header/mapping; lokalizált és hozzáférhető result UI; minden export-read fail-closed | igen a candidate-ben; wire request változatlan; a bizonyított egy terminális hiba/sor response-contract explicit lett | focused 5 fájl / 89; full 96/1190; type/lint/build/bundle; web 7/7; mobile release 410/410 + 2/2; Edge 109/109; security/provenance/release és hét DB-contract; hosted 12/12, 0 annotáció PASS | igen | draft PR #193, source `15b482e…`, run `29956363505`; production NO-GO | paginált export és transactional server boundary |
| R-053 | Reports/Audit/Export exact hozzáférés és legacy leave-export kliensintegritás | sibling permission + umbrella entitlement mount-bypass; ignored provider/audit hibák; rejected transport/null read hamis siker; audit utáni letöltés helyett korábbi letöltés; formula-leading CSV; hibás dátum-containment; `.xlsx` címke `.xls` artifacthoz; XML 1.0-tiltott vezérlőkarakter; stale actor/workspace és dupla submit | BIZONYÍTOTT source + hosted candidate | capabilitynként permission × exact entitlement; külön komponenshatár; típusos fail-closed query/audit/artifact/download adapter; audit-before-download; közös CSV neutralizer; overlap query; XML 1.0 szűrés + escaping; igaz `.xls`; generation + symbol-token single-flight; nyolc locale stabil hiba | kliens runtime-ban igen; DB/API/Edge változatlan | focused 6 fájl / 83; full 99/1223; type/lint/build/bundle; web 7/7; mobile source 228 + sync + release 410/410 + E2E 2/2; hosted 12/12, 0 annotáció PASS | igen | draft PR #194, head `52a8f72…`, run `29961698732`; production NO-GO | server-owned exact permission+entitlement export RPC/job; auth.uid actor; atomi audit+snapshot; exact-count pagination; restored staging |
| R-054 | Settings Export Wizard exact hozzáférés, audit- és delivery-integritás | `canAccessExport` nem jutott el a Settings útvonalra; download audit előtt; audit `{error}` ignored; null provider adat üres siker; mode-selection bypass; same-tick dupla submit és stale scope | BIZONYÍTOTT source + hosted candidate | independent `canExport`/`canImport`; mode/entity triple recheck; typed artifact→strict audit→download executor; exact `error: null`; truthful additive artifact/delivery metadata; mounted+actor/workspace/entity token; észlelt stale után nincs új audit, in-flight audit után nincs download/UI-success | kliens runtime-ban igen; DB/API/Edge változatlan | focused 8 fájl / 120; full 101/1267; type/lint/build/bundle; web 7/7; mobile 2/2 + release 410/410; Edge 109/109 + 31/31; security/provenance; hosted 12/12, 0 annotáció PASS | igen | draft PR #195, head `0a4994d…`, merge `a120686…`, run `29965167738`; production NO-GO | server-owned authorization/snapshot/pagination külön P1 |

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
- Az I-34 candidate a meglévő plugin-install RPC alakjának megtartásával
  szerveroldali `plugin_install` entitlementet és exact `published` kaput ad. A
  publikáció státuszát commit előtt sorlock mellett újraellenőrzi; a public
  redakció és private config ugyanabban a tranzakcióban marad. Meglévő
  installációt nem töröl vagy tilt le, és entitlement-vesztés után is megtartja
  az uninstall útvonalat. A lokális regressziós kapu 12/12 runner-unitot, pinned
  PostgreSQL 17.6-on 40 fail-closed tampert (ebből 15 új install-policy esetet),
  státusz-race rollbacket, két-workspace konkurens countot és reapply-t igazolt;
  a teljes 77/996 coverage, typecheck, build, web/mobile/security és Edge kapuk
  is lefutottak. Az első teljes Edge futás egy meglévő időzítésérzékeny teszten
  85/86 lett, az izolált 11/11 és ismételt teljes 86/86 PASS; ezért a flake P2,
  nem elhallgatott zöld. A `29901330094` hosted Quality Gate 11/11 PASS; linked
  apply és deploy továbbra sem bizonyított.
  Production a history reconcile és restored-staging DB-first acceptance előtt
  **NO-GO**.
- Az I-35 candidate determinisztikusan reprodukálta a v3.51.12 uninstall-versenyt:
  egy ténylegesen aktív telepítés mellett a régi RPC nullát írt. Az új uninstall
  az installation-törlés után külön `FOR NO KEY UPDATE` statementben vár a plugin
  sorra, így a következő count-frissítés friss READ COMMITTED snapshotot kap. A
  migration installation→marketplace `SHARE ROW EXCLUSIVE` sorrendben, öt
  másodperces transaction-local lock-timeouttal minden meglévő driftet csak akkor
  ír át, ha eltér a valós enabled sorok számától. A 14/14 runner-unit és a végső
  pinned PG17.6 contract 95,6 másodperc alatt PASS: 43 fail-closed tamper, legacy
  `1/0`, közvetlen migration repair, fixed `1/1`, API/ACL/OID, grandfathered
  business-state, authorization-atomicitás és dupla reapply. Linked apply/deploy
  nem történt; rolloutkor rövid plugin-write drain és exact post-count kötelező.
- Az I-36 candidate kizárólag `ALTER FUNCTION ... SET lock_timeout='5s'`
  metadata-változással korlátozza a plugin install késői lock-várakozását; a
  forrástest, OID, signature/default, return, owner, ACL és search path változatlan.
  A kliens a három retryolható SQLSTATE-et strukturáltan osztályozza, minden
  backend részletet sanitizál, és csak explicit új kattintásra próbálkozik újra.
  Workspace-váltás invalidálja a régi mutation toast/refetch/retry állapotát. A
  runner 14/14, API+UI 21/21 és a végső pinned PG17.6 contract 76,5 másodperc
  alatt PASS; linked apply és production deploy nem történt.
- Az I-37 source candidate lezárja az aktív csomag-downgrade és katalógus-
  archiválás után elárvuló uninstall UI P2 rését. Az exact owner számára a
  Settingsben, a marketplace browse gate-en kívül jelenik meg a defaultból
  összecsukott cleanup panel. Kizárólag a redaktált installation inventoryt
  olvassa, nem függ a published katalógustól, és a meglévő owner-only RPC-t exact
  installation ID-val hívja. Explicit konfigurációtörlési/újratelepíthetetlenségi
  figyelmeztetés, fail-closed receipt, sanitizált hiba, friss kézi retry,
  post-delete refetch-lock, fókusz-visszaállítás és workspace-generation/
  operation-token stale guard készült. Cleanup 16/16, focused 52/52, full
  80/1034, type/lint/build/bundle/web/mobile/Edge/security/provenance PASS.
  **BIZONYÍTOTT korlát:** aktív `ws_general` nélkül a Settings tab sem mountol;
  az inactive/expired recovery kívánt működése **BIZONYTALAN** termékdöntés.
- Az I-38 candidate lecseréli a 11 checkout, 11 setup-node és négy
  upload-artifact Node 20 action-runtime-ját a hivatalos Node 24 release-ek teljes
  commit SHA-jára. A projekt Node 22 marad; a setup-node v5 automatikus cache-
  felismerését a hat DB-job explicit tiltja, az öt korábban cache-elt job pedig
  változatlanul `cache: npm`. A tartós source contract mind az öt külső action-
  család exact darabszámát, pinjét, a teljes 31 elemű action-allowlistet és cache-policyját követeli. YAML, 216/216
  source contract, 9/9 Edge workflow,
  célzott ESLint, diff-check és a változatlan 1 148/98 lint-ratchet PASS. Run
  `29920014033` mind a 11 jobja, Android és iOS compile-ja zöld; 0 annotáció,
  logból igazolt 6 no-cache / 5 cache job és Node 22.23.1. A három artifact neve,
  30/14/7 napos retentionje és tartalma változatlan szerződést követ.

## 5. Hiányok és kockázatok

### P0

| Tétel | Bizonyíték | Hatás / kockázat | Kötelező javítás és elfogadás |
| --- | --- | --- | --- |
| HR workflow tenant-boundary / IDOR | A live és történeti `hr_workflow_create_instance` nem validálja `p_membership_id` workspace-ét; az instance/task member policy-k nem korrelálják a membership workspace-ét és nem mindenhol követelik az aktív státuszt; az update/list RPC-k joinjai ugyanezt a globális UUID-feltételezést viszik tovább. A legacy globális FK-k cross-tenant `CASCADE`/`SET NULL` adatvesztést is lehetővé tesznek. A hiba már a remote `20260511163148 create_hr_workflows` migrationben jelen van. A candidate `20260719000000_v3_51_3_hr_workflow_tenant_boundaries.sql` forward-only trigger/RLS/RPC/ACL/parent-guard javítást ad, és nem ír át legacy sort. | Cross-workspace referencia létrehozása, más tenant workflow-jának olvasása, inactive assignee ismert task UUID-val történő módosítása, admin listában kereszt-tenant név/e-mail összekapcsolás és idegen workspace taskjának parent-kaszkádos törlése lehetséges. **BIZONYÍTOTT kód/history finding; a candidate célzott PostgreSQL-contractja zöld, de production rollout nem történt.** | A kódoldali javítás elkészült; `npm run db:hr-workflow:test` két tenanttal, authenticated RLS/RPC, inactive-assignee, list-leak, parent-delete, reapply és négy determinisztikus race esettel PASS. Production GO előtt kötelező az aggregált restored-staging inventory, non-zero sorok jóváhagyott data-preserving rendezése, history reconcile és teljes staging acceptance. |
| Globális `profiles` SELECT / születésnapi PII leak | **Történeti main-bizonyíték:** a `20260503073040_d6471f9e-4600-4c3e-b426-15bed631ac1b.sql` globális authenticated policyje és a korábbi widget raw `user_id,display_name,preferences` lekérése browser-side szűrés előtt továbbította a preferencia-JSON-t. **I-27 candidate:** a migráció RLS-t kényszerít, matching restrictive select/update guardot ad, catalogból minden browser column ACL-t visszavon, majd csak `user_id,display_name,avatar_url` SELECT-et enged. Self locale, self-only global display-name update és ötmezős milestone külön RPC; az AST contract a caller-határt őrzi. | **BIZONYÍTOTT történeti cross-tenant PII-kitettség; BIZONYÍTOTT source + local/hosted contract; production továbbra P0 blocker.** A candidate nincs a linked DB-re alkalmazva, az 59/69/84 drift és live SHA-attestation hiányzik. | A forrásjavítás és a current self-only revision két-tenant PG18 negatív ACL/RPC contractja PASS. GO előtt: teljes caller/Edge inventory lezárása, adatvédelmi incidensértékelés, backup, history reconcile, restored-staging exact policy/ACL/owner/schema-cache diff, régi fail-closed és új kliens smoke, DB-first apply, azonnali client rollout és privacy-preserving rollback. |

### P1

| Tétel                                       | Üzleti/technikai indok és bizonyíték                                                                                                                                                                             | Érintett terület                                       | Kockázat, függőség, méret                                     | Elfogadási kritérium / teszt / dokumentáció                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| DB history és schema drift                  | A legutóbbi read-only linked inventory 61 közös migration ID / 76 local-only / 82 remote-only volt; az új I-36 forward migrationgel a candidate **77 local-only / 138 local** (remote 143), linked írás nélkül. Két eredetileg hiányzó remote DDL bitpontosan, hash-manifesttel visszakerült, ezért a `plugin_webhook_events` korábbi hiánya forrásszinten megszűnt; teljes clean replay még nincs. Három local-only HR/office/analytics fájl remote migrationök eltérő ID alatti tartalmi duplikátuma. A generált public felület 165 tábla/4 view/99 függvény/11 enum; ezekből 25/1/41/2 helyi DDL-je nem bizonyított; a candidate RPC-k/táblák sincsenek még hitelesen regenerált types-ban. Hat attendance tábla a `d4a441a4` types-only commitban, további 21 tábla a `7c59e9a7` „Regenerate types.ts from live DB” commitban jelent meg; a `b952a466` v3.6 commit 24 frontend/test/docs fájlt és 0 SQL-t adott hozzá. | `supabase/migrations`, generated types, git history    | hibás deploy vagy repair; backup+staging kell; XL             | további remote statement/hash recovery; duplikátum-besorolás; full Supabase clean replay; regenerated-types/schema fingerprint diff; DB lint/RLS teszt; bulk `migration repair` tilos |
| Recovered clock tenant-, credential- és adat-életciklus | A visszaállított `clock_events` append-only auditígéret mellett membership/workspace FK-kaszkáddal törölhető; a manuális `_office_id` nincs workspace-hez korrelálva; az `enterprise_offices.clock_in_nfc_tag` a jelenlegi aktív-member policy mellett böngészőből olvasható; a QR nem egyszer használatos és nincs szigorú TTL; GPS-koordinátákhoz nincs igazolt retention; clock state/idempotency contract sincs. A történeti SQL byte-fagyasztott. Az I-32 candidate az explicit browser ACL/search_path és QR extension-binding rést lokálisan lezárja, linked apply nélkül. **BIZONYÍTOTT source finding + local contract.** | clock DDL/RPC/RLS, office credential, GDPR/audit | cross-tenant referencia, QR/NFC replay, payroll-audit adatvesztés, duplikált vagy sorrendhibás esemény és korlátlan helyadat-megőrzés; L | I-32 restored-staging/linked ACL apply; kompozit tenant-kényszerek; private hash/HMAC-alapú NFC credential; TTL+single-use QR; explicit retention; állapotgép+idempotency; két-tenant, concurrency, cascade és GDPR deletion/export contract; rollback/runbook |
| Recovered marketplace secret-, entitlement- és tenant-határ | A történeti `workspace_installed_plugins.config` minden aktív workspace-tag számára olvasható, miközben a mintamanifest webhook URL-t deklarál. Az I-33 candidate a raw JSON-t privát táblába másolja, a publikus mezőt `{}`-ra kényszeríti, eltávolítja a shared browser callerből, és workspace-páros/enabled service gettert ad; column ACL driftet javít, elveszett private sornál fail-closed. A linked DB-t nem írta. Az I-34 candidate a dokumentált Enterprise `plugin_install` entitlementet és exact `published` státuszt ugyanazon RPC-shape mögött ellenőrzi, majd a státuszt sorlock mellett újra validálja; meglévő installációt nem töröl és az uninstallt entitlement-vesztés után is megőrzi. Az I-35 candidate a történeti install/uninstall count-race-t és a már stale derived értékeket javítja. Az I-36 ugyanazon install RPC body/API/OID/ACL megtartásával öt másodpercre korlátozza az egyedi lock-várakozást, teljes rollbacket és sanitizált kézi retryt ad. **BIZONYÍTOTT source finding + local/hosted candidate-ek; I-36 local contract, széles kapu és 11/11 hosted Quality Gate PASS.** A webhook workspace/installation FK független, payload/response retention és SSRF contract nincs. | marketplace DDL/RPC/RLS, secrets, webhook delivery | linked rolloutig secret-, entitlement-, count- és korlátlan lock-wait kitettség; utána private plaintext/Vault, runtime feature-metaadat drift, downgrade-cleanup, cross-tenant routing-integritás és PII/payload megőrzési kockázat; L | history reconcile; plugin-write drain; restored-staging DB-first apply, exact count és 55P03/latency monitor; old/new-client acceptance; majd Vault, kompozit tenant FK, audit+retention+input bound+DNS-aware SSRF és több-session contract |
| Linked DB lint                              | read-only `supabase db lint --linked --level warning`: 7 error, 6 warning                                                                                                                                        | compliance/webhook/analytics/onboarding/password RPC-k | runtime hiba; a history reconcile előfeltétel; L              | 0 error; pgTAP/integration; caller smoke; changelog                                                               |
| Approval chain nincs runtime-ban            | chain editor/táblák és `step_order` dokumentált, de `decide_leave_request` nem választ stepet/approvert; első jogosult véglegesít                                                                                | approval UI/RPC/schema                                 | kiadott fő funkció nem teljes; L/XL                           | step/approver modell; sorzár; rész-döntések; végső státusz csak utolsó stepnél; concurrency/E2E; migrációs leírás |
| `instant_member_create` biztonságos pótlása | v3.33 dokumentált fizetős funkció; régi admin-confirmed email globális identityt foglalhatott; most 409 fail-closed                                                                                              | user provisioning/auth/invite                          | funkciókompatibilitás; product+security döntés; L             | SCIM/domain vagy mailbox-verified activation; cross-tenant adversarial teszt; admin UX és migration note          |
| Created-identity cleanup scheduler hiányzik | Az I-29 durable pre-Auth saga és DB-first worker retry forrása kész, de repositoryban/linked környezetben nincs bizonyított recurring scheduler. Manuális worker-hívás nem release-képes kompenzáció. | Edge worker / service-role RPC / operations | hibán maradt Auth identity és provisioning saga automatikus helyreállítása nem garantált; production NO-GO; M | least-privilege ütemezés, secret ownership, singleton/overlap és backoff acceptance, pending-age/dead-letter metrika+riasztás, restored-staging fault injection és runbook drill |
| Fióktörlés nem atomi                        | GoTrue delete és DB cleanup nem egy tranzakció; a preflight csak ismert FK-ket fed                                                                                                                               | `delete-account`, retention                            | részleges törlés / blokkolt GDPR-flow; jogi döntés; XL        | retention policy; job/RPC+kompenzáció; retry/idempotency/concurrency; audit és runbook                            |
| Webhook/API DDL és producer provenance      | live/repo function source helyreállt, de egyes delivery/config objektumok és producer-ek helyi eredete nem teljes                                                                                                | public API/webhook                                     | következő clean deploy nem reprodukálja a live viselkedést; L | helyi DDL+producer inventory; staging key/revoke/rate/delivery/SSRF E2E; source↔deploy checksum                   |
| Data migration részleges commit             | több entitás egymás után íródik, hiba esetén részleges eredmény/HTTP-eredmény lehetséges; nincs teljes resumable checksum                                                                                        | `data-migration`, import                               | ismétlés/duplikáció/kevert állapot; L                         | manifest+checksum; idempotens resume; hibastátusz; fixture és rollback doc                                        |
| CSV import atomitás, revoke-race és audit-tranzakció | Az I-43 candidate lezárja a raw fatal/row-write provider-detail, ignored prerequisite-read és ignored start-audit ágakat, de az exact entitlement-kapu továbbra is csak a kérés elején fut. A legfeljebb 2 000 soros service-role import soronként ír, ezért közbeni demotion/entitlement-revoke után folytatódhat, szerverhiba részleges eredményt hagyhat, a post-write completion-audit pedig a már megtörtént írást nem tudja visszagörgetni. **BIZONYÍTOTT inherited production blocker; a v3.51.21 bounded failure contract source + hosted candidate, nem atomitási javítás.** | `import-entity-data`, audit/error contract, web+mobile | jogosultságváltozás utáni írás, részleges commit és hiányos completion/failed audit; L | DB-oldali atomi importhatár és mutációkori authoritative recheck; konkurens demotion/revoke és rollback contract; guaranteed `import.failed`/completion audit; server dry-run/schema-version contract; staging acceptance |
| Authoritatív export permission, entitlement, actor és snapshot | Az I-45/I-46 minden ismert UI-mountot exact permission × entitlement mögé zár és audit nélkül nem tölt le, de a browser readet továbbra is az entitások RLS-e szabályozza, nem egy authoritative export boundary. Az audit INSERT policy workspace-tagságot ellenőriz, de a caller által adott `actor_id`/`action` mezőt nem köti `auth.uid()`-hoz. A többquerys olvasás nem egy MVCC snapshot. **BIZONYÍTOTT szerver-authorizációs és auditintegritási hiány.** | `legacyLeaveExport`, `entity-export`, data-fetcher, entity RLS, `enterprise_audit_events`, közös web/Android/iOS adatút | jogosultságeltérés, hamis actor, részleges/driftelt compliance export; L; DB history + restored staging függőség | szerver-owned, verziózott RPC/job: auth.uid-ból actor, exact permission+entitlement, egy snapshot/materializált job, bounded row ceiling, atomi audit receipt; két-tenant/RBAC/entitlement/demotion/concurrency/forged-actor PG-contract; DB→client rollout és same-SHA acceptance |
| Nagy exportok lapozása és csonkolásdetektálása | Az I-44 fail-closed hibakezelése és az I-45 null-read kapuja mellett a primary/category/position és legacy exportlekérdezések explicit `range`/exact count nélkül futnak. A szolgáltatói sorlimit hibamentes, de részleges `data` választ adhat; így egy nagy export észrevétlenül hiányos lehet. **BIZONYÍTOTT kliens-contract hiány; a tényleges live limit és érintett tenant-méret nincs bizonyítva.** | `data-fetcher`, legacy leave export, Export Wizard, közös web/Android/iOS API | csendes adatkihagyás és hibás audit/export; M | 500 soros stabil rendezett oldalak; első oldali exact count; rövid/túl hosszú oldal és globális ID-duplikáció fail-closed; final HEAD count; 100 000-es explicit ceiling; nagy fixture; teljes snapshothoz server-owned RPC/job |
| Deploy provenance és provider lánc          | Az I-30 revalidáláskor a repositoryban egyetlen workflow a quality gate; nincs GitHub environment, deployment, release, Actions secret vagy variable. A jelenlegi `effectime.app` Lovable/Cloudflare deploymentje továbbra sem köthető Git SHA-hoz: a live release marker hiányzik, a repository Lovable webhook utolsó válasza HTTP 405, a Vercel projekt pedig nem az élő domain célpontja. A push ezért validál, de nem deployol. | frontend/Edge/DB release | rollback és audit nem reprodukálható; M | publish authority helyreállítása; védett production environment; provider preview + deployment-ID↔SHA rekord; élő `/.well-known/effectime-release.json`; Edge body/header SHA; fail-closed verifier; azonos commitból háromrétegű deploy |
| Payroll időszak/rate/export szemantika      | Tetszőleges részidőszakhoz teljes havi attendance aggregate kerülhet; a rate-választás latest-all; a v1 szerződés az ISO pénznemkódot validálja, de tagonként eltérő pénznemeket egyetlen `total_gross` mezőbe összead (a contract teszt EUR+USD összeget is elfogad); az attendance/leave/rate HTTP-olvasások nem egyetlen MVCC snapshotból készülnek. A lock/export és elsődleges audit már atomi, a snapshot immutable és DB-digestelt. | payroll Edge/DB/domain                                 | magas pénzügyi eltérés vagy időközi read drift; termékdöntés és egyetlen DB-számítási határ kell; L | full-month vagy napi canonical szabály; rate-as-of/effective-to; v1 single-currency vagy v2 per-currency totals; egy statement/transaction számítás; concurrency+staging fixture; legacy snapshot inventory/remediation |
| Natív store release biztonsági kapuk        | Android/iOS és CI forrás, PKCE, Keychain/AndroidKeyStore adapter, exact-origin CSP, hosted Android build és locked Xcode 26.5 simulator build kész; nincs store reservation/signing, verified HTTPS link, jóváhagyott brand asset vagy fizikai smoke | mobile auth/platform/release | signing/scheme ownership, OS-integráció és rollback kockázat; L | app ID/team/cert; AASA/assetlinks; device storage+CSP+auth smoke; signed internal rollout; `docs/mobile/README.md` |
| Admin-created leave production acceptance   | Az I-26 lokálisan additív v2 RPC-t, hash-only ledgert, v1 compatibility smoke-ot, pozitív/negatív RBAC/tenant/audit/quota contractot és duplicate/demotion serialization tesztet ad. A linked sémára a drift miatt nem alkalmazható vakon, a PostgREST schema-cache és valós policy/trigger-kombináció nem igazolt. | admin override RPC/RBAC/audit + web/mobile rollout | client-first deploy 404/RPC-hibát, hibás DB apply üzemzavart okozna; M/L | backup/PITR; restored production-like staging; exact catalog/ACL; v1+v2 smoke; DB-first apply/schema reload; client-second deploy; client-first rollback |

### P2

| Tétel                               | Bizonyíték / kockázat                                                                                                                | Méret | Elfogadási kritérium                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------- |
| ESLint-adósság                      | 1 145 error + 98 warning; az I-29 ratchet 11, az I-43 további 3 fingerprint-javulást rögzít új diagnosztika nélkül | XL    | modulonkénti csökkentés, baseline-frissítés, végül 0                |
| Secret scan felismerési szélesség   | Az I-39 lezárja a current-tree és teljes fetched-history magas bizonyosságú pattern/signing-file rést, de nem entropy/DLP scanner és a bináris tartalomban elrejtett credentialt nem értelmezi | M | kontrollált provider-secret fixture-ek; entropy/encoded-secret policy; hamis pozitív baseline nélkül külső scanner értékelése |
| Admin override globális retry-határ | A lokális outbox ugyanazon actor/workspace/payload kulcsát restart után visszaállítja, és scope-onként egy feloldatlan művelet mellett az eltérő payloadot blokkolja. A hét nap retry/reconciliation-horizont, nem automatikus törlési TTL: minden hibaválasz, valamint a bizonytalan/lejárt/sérült bizonyíték megmarad. Raw commandot nem tárol; másik eszköz eltérő kulcsot generálhat. Origin-szintű Web Locks nélkül a művelet az RPC előtt fail-closed; a [WebKit Safari 15.4-ben vezette be](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/), ezért az iOS target és a mobile contract minimuma 15.4. A [Lockdown Mode letiltja](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/), ami e privilegizált művelet dokumentált fail-closed korlátja. | M | fizikai Android/iOS transport-loss/Web Locks/Lockdown smoke; lejárt/corrupt művelet reconciliation acceptance; cross-device operation-token design csak igazolt üzleti igény esetén |
| E2E/coverage                        | nincs teljes auth/workspace/RBAC/leave/payroll/integration böngészős release gate                                                    | L     | Playwright staging suite, fixture, coverage baseline                |
| CSV import authenticated acceptance és template-export policy | Az I-43 valós `Request` handler-harnessa auth/RBAC/exact-feature denial vagy outage esetén zero executort, valamint 405/invalid JSON/no-store/request-ID/CORS és bounded fatal választ bizonyít. Ez dependency-injektált contract, nem authenticated restored-staging web/mobile acceptance. Az Import Wizard current-data template exportja `csv_import` mellett külön `export_center` nélkül elérhető; add-on/override esetén a kívánt privacy/termékpolitika nem bizonyított. | M | authenticated staging request acceptance; explicit export-entitlement termékdöntés 2–3 opcióval; web/mobile adversarial teszt |
| Plugin secret catalog/lock mélység  | Az I-33 exact ACL és adat-totalitás contractja zöld, de a private tábla extra user-trigger/constraint készletét és a korábbi public policy-k reapply driftjét nem attesztálja újra; a migrációs lockot a runner egy sessionben teszteli. | M | exact policy/constraint/trigger-set pre/postcondition; rosszindulatú extra trigger és permisszív policy tamper; két-session lock-timeout + veszteségmentes retry |
| Plugin runtime feature-metaadat      | Az I-34 apply-preflight az aktuális `plugin_install` catalog státuszt ellenőrzi, de a közös runtime entitlement-helper feature-status és feature-dependency szemantikája nincs e csomagban megerősítve. Későbbi catalog-deaktiválás vagy dependency-változás ezért külön runtime-policy kérdés. | M | fail-closed aktív-státusz/dependency contract; catalog-váltás alatti két-session teszt; downgrade runbook |
| Plugin cleanup recovery edge cases   | Az I-37 source+hosted candidate az Enterprise→Pro/Freemium és catalog-hidden exact-owner cleanupot lezárja. **BIZONYÍTOTT korlát:** a panel a `ws_general`-lel entitlementelt Settings tabban van; aktív tier/add-on/override nélkül nem mountol. Valódi authenticated owner/non-owner + downgrade + archived-plugin E2E még nincs. A teljesen inactive/expired recovery kívánt útvonala **BIZONYTALAN** termékpolitika. | S/M | product decision az inactive/expired útvonalról; authenticated böngészős downgrade/archive E2E; ugyanazon SHA production acceptance |
| Plugin service getter grandfathering | Az I-33 service-role getter enabled + exact workspace/install párra korlátozott, de nem követel aktuális `plugin_install` entitlementet vagy `published` státuszt. Ez támogatja a szándékos grandfatheringet, ugyanakkor a háttérfeldolgozás leállítási/folytatási termékpolitikája nincs rögzítve. | M | explicit continue/pause/revoke policy; auditált transition; worker/service contract entitlement- és archive-esetekkel |
| Plugin install bounded lock-wait     | Az I-34 státusz sorlockja megszünteti az install/archive TOCTOU-t, de nem vezet be saját lock- vagy statement-timeoutot és retry receiptet. Hosszú státusztranzakció ezért a platform timeoutjáig blokkolhatja a telepítést. | S/M | dokumentált bounded timeout; retryable hibakód; két-session wait/timeout/rollback teszt; kliens fail-visible retry UX |
| Plugin install/uninstall count race  | Az I-35 candidate a régi `1 aktív / 0 tárolt` állapotot determinisztikusan reprodukálja, külön plugin-lock statementtel megszünteti a stale snapshotot, és bounded globális reconciliationnel javítja a korábbi driftet. A teljes PG17.6 contract lokálisan zöld; linked rollout még nincs. | M | **forrásban javítva:** restored-staging plugin-write drain, migration apply, exact globális post-count és konkurens acceptance; utána ugyanazon SHA rollout |
| Plugin concurrency-test determinism  | Az I-35 exact `pg_blocking_pids` láncokra és allowlistelt advisory barrierekre váltott. A 35 s barrier, 42 s SQL timeout, 45 s child timeout és 13,1 s readiness bounded; timeout viselkedés unit-tesztelt. Mindkét install-policy fázis és az install-count race a primer és cleanup hibát sorrendhelyes `AggregateError`-ban őrzi meg. | S/M | **lokálisan javítva:** ismételt hosted CI/stress után tartható lezártnak; timeout/cleanup diagnosztika artifactban maradjon |
| Bundle-méret                        | I-36 reviewed pre-commit measurement: JS 4 529 639 raw / 1 297 427 gzip; a committed `d75f269…` lokális build 4 529 750 / 1 297 483, a hosted merge-candidate 4 529 732 / 1 297 498; largest rendre 1 765 336 raw / 561 521–561 526 gzip, CSS 180 862 / 29 600. Mind az explicit szűk SHA/platform allowance-on belül PASS, de az abszolút méret továbbra is jelentős. | M | további route split; regressziós mérés |
| Browserslist-adat és support policy | Minden clean build 13 hónapos `caniuse-lite` warningot ad. A review-zott update explicit policy hiányában a 32 elemű implicit defaults 23 targetét eldobná és 23 újat venne fel; az iOS deployment minimum 15.4, de a web/mobile CSS policy közös és nincs iOS WebKit gate. A mért CSS-diff egy szabály két legacy prefixe, konkrét vizuális regresszió nem bizonyított. | S/M | **BIZONYTALAN / nem implementált:** web és natív támogatási policy termék+QA döntése; ezután célzott adatfrissítés és valós iOS WebKit smoke |
| Payroll provider config             | Nincs explicit default/unique aktív konfiguráció; több aktív sor esetén a `.maybeSingle()` hibázik                                    | M     | default mező vagy partial unique index; migration+concurrency teszt |
| Public function privilege inventory | linked baselineban 114 public function, 94 SECURITY DEFINER, mind anon executable volt; az új revoke-ok nem fednek teljes inventoryt | L     | funkciónként owner/search_path/ACL audit, negatív auth teszt        |
| M365 inbound ígéret                 | kimenő sync bizonyított, teljes tartós inbound OOF integráció nem                                                                    | M     | scope döntés, implementáció vagy marketingkorrekció                 |
| Embed security contract             | statikus frame header és embed cél, illetve token tárolás/rotáció nincs egységesen dokumentálva                                      | L     | origin allowlist, hash/rotation, cross-origin browser teszt         |
| DNS-rebinding egress                | Jira/webhook host/private-IP ellenőrzés alap szintű; nincs bizonyított egress proxy                                                  | M     | resolve+connect pinning vagy egress proxy; redirect/rebinding teszt |
| Dokumentum-AI adatkezelés           | technikai PII/authz javult, provider régió/DPA/retention termékjogi döntés                                                           | M     | DPA, régió, retention, user disclosure                              |
| Demo seed                           | nem minden paid modulhoz teljes/konzisztens fixture; tier-választás részben környezeti                                               | M     | verziózott seed manifest, deterministic fixture, teardown           |
| Chain config RBAC drift             | docs RA konfigurációt sejtet, a chain RLS owner-only; runtime chain amúgy is nyitott P1                                              | S/M   | approval-chain tervezésben egységes permission contract             |
| iCal credential lifecycle           | Demotion/inaktiválás/tier downgrade esetén az Edge 403-at ad, de a bearer token nem rotálódik vagy törlődik; későbbi reenable újraaktiválja. Owner más RA team tokenjét nem tudja inventoryzni/revokálni. | M | forward revoke/expiry modell, role/tier transition teszt, owner admin inventory |
| Feature-entitlement outage UX       | Az I-40 candidate a stale és malformált hook-választ központilag fail-closed állítja, a core shellben request-owned sanitized retryt és token nélküli saját iCal revoke-listát tart meg, majd history-replace és fókusz-helyreállítás mellett csak az új authoritative navmodellre áll vissza. **BIZONYÍTOTT local candidate:** 9/68 focused, full 86/1076, type/lint/build/bundle/web/mobile/Edge/security/DB PASS. Authenticated böngészős outage→retry→success és production acceptance még nincs. | S | hosted gate; authenticated web/mobile acceptance; ugyanazon SHA production smoke |
| Meghívási entitlement-paritás       | Az I-41 candidate a Dashboard és MemberList kontrollját ugyanarra az exact, outage-kor fail-closed `members_invite` döntésre köti; az Edge bulk import, az issue/reissue RPC és a közvetlen INSERT/UPDATE RLS+trigger ugyanezt a tenant tier/add-on/override uniont ellenőrzi. RPC metadata, accept és owner DELETE cleanup változatlan. **BIZONYÍTOTT source + hosted candidate:** focused 18/18, Edge 93/93, runner 10/10, pinned PG18 és hosted 12/12 / 0 annotáció PASS. | M | history reconcile után linked DB-first staging és authenticated acceptance |
| CSV-import entitlement-paritás      | Az I-42 candidate az aktív Import módot és az `import-entity-data` hat szolgáltatásiszerepű mutációcsaládját exact `csv_import` + `members_list` union mögé zárja; lookup/malformed outage fail-closed, az Export változatlan. **BIZONYÍTOTT source + hosted candidate:** focused 23/23, Deno 10/10, Edge 96/96, full 90/1092 és hosted 12/12 / 0 annotáció PASS. A specifikációban vállalt tranzakciósság, UI által használt szerver dry-run és `schema_version`-validáció ettől külön nyitott. | S/M | authenticated tier/outage acceptance; külön import-integritási csomag |
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
| I-08   | DB history reconcile                       | remote/local manifests, hiányzó DDL repair                                                                          | clean replay/schema diff/pgTAP | backup kötelező; semmit nem töröl automatikusan; teljes 133-migrációs replay                                 | nyitott P1                 |
| I-09   | Multi-step approval runtime                | chain schema, approver resolution, partial decisions, UI                                                            | unit+PG concurrency+E2E        | meglévő single-step migrálható alap chainné; rollback feature flaggel                                        | nyitott P1                 |
| I-10   | Biztonságos instant provisioning           | SCIM/domain vagy verified activation                                                                                | auth/API/UI/migration          | invitation kompatibilis; cross-tenant identity teszt                                                         | emberi döntés              |
| I-11   | Staging/release                            | azonos SHA frontend+Edge+DB, smoke, release marker                                                                  | teljes staging suite           | backup/rollback artifact; production csak jóváhagyás után                                                    | blokkolt I-08/I-09-en, payroll szemantikán/legacy inventoryn és staging bizonyítékon |
| I-12   | Quality Gate & Runtime Safety Foundation   | SHA-pinnelt CI, fingerprint lint és coverage/bundle ratchet, production-preview Playwright, PII logger, AuditLog exact field-allowlist, két SBOM/provenance, runbookok | nincs DB/API shape változás    | Edge 30/30, 0 diagnostic, raw check PASS, 64/64 exact import, 0 unpinned; Deno izolált az npm tree-től; egy commitban visszavonható | lokális és hosted CI kész; release-process enforcement nyitott |
| I-13   | Payroll Edge/UI contract repair            | `payroll-export/index.ts`, contract/helper/tesztek, `PayrollPanel.tsx`                                  | Deno contract+check, Vitest    | direct provider hamis 200 helyett explicit 501; Edge/web együtt visszaállítható                                  | kész lokálisan; staging és termékdöntés nyitott |
| I-14   | Generated-schema provenance ratchet        | `scripts/ci/schema-provenance*`, exact baseline, package script és workflow                              | parser unit+current gate       | ratchet only; a 25/1/41/2 hiányzó provenance továbbra is release blocker                                      | kész lokálisan             |
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
| I-31   | Remote migrációforrás-proveniencia recovery Wave 1 | két eredeti remote SQL bitpontos visszaállítása; kódba és exact két-entry manifestbe rögzített SHA-256/byte/path attesztáció; célzott LF checkout contract; schema-debt exact csökkentés; CI kapu | byte-provenance 9/9 + current 2/2, beleértve koordinált SQL+manifest driftet; schema parser 7/7 + 133-migration exact gate; full 76/992, type/lint/build/bundle/web 7/mobile 183/345/2/Edge 31+86, audit/secrets; hosted 10/10 | történeti SQL változatlan; linked DB write/history repair nincs; a source commit egyben reverttel visszaállítható, de a visszanyert DDL törlése újra clean-replay regressziót okozna | draft PR #180, implementation head `b98cdc8…`, run `29888707884`, release `8517495434`, diagnostics `8517494400`, Android `8517474651`; full replay és production NO-GO |
| I-32   | Recovered clock/marketplace ACL hardening Wave 1 | forward-only PG17 migration: exact ordinary-table/owner/RLS-policy, browser-role capability, routine source/config/metadata és pgcrypto trust preflight; PUBLIC/anon revoke, authenticated read + hat RPC; service-role effective ACL preservation; QR schema-qualified entropy; read-only linked inventories | runner 11/11; pinned PG17.6 contract 15/15 preflight/postcondition tamper, baseline-intact rollback, drift repair, idempotent reapply, tenant RLS és teljes clock/marketplace smoke; invariants 34/34; full 76/995; type/lint/build/bundle/web 7/mobile 183/345/2/release 365, audit/secrets; hosted 11/11 PASS | egy additív migration; PostgreSQL 17+ előfeltétel; történeti SQL és üzleti RLS változatlan; rollback csak catalog/ACL inventoryval, mert biztonsági jogokat nem szabad vakon visszalazítani | draft PR #181, implementation head `4046c8a…`, run `29891543713`, release `8518456625`, diagnostics `8518455066`, Android `8518432152`; linked apply/production NO-GO; secret projection, tenant/entitlement/retention/idempotency következő hullám |
| I-33   | Plugin config private/redacted secret boundary | forward-only private JSONB backfill; public compatibility `{}` CHECK; totalitás trigger; változatlan install/uninstall API; enabled+workspace-páros service getter; shared caller projection gate | runner 11/11; PG17.6 15 korábbi + 7 új preflight és 3 reapply tamper, custom-role és known-role ACL contract/repair, pre-existing private schema preservation, object/array/scalar/JSON-null, role/tenant/atomic rollback/reinstall/uninstall/apply+reapply; client 1/1; full 77/996; hosted 11/11 | egy additív migration; private plaintext nem Vault; DB rollback csak forward-fix/feature pause, raw public visszaállítás tilos; nincs linked write | draft PR #182, final head `e9cddac…`, run `29897254527`, release `8520498650`, diagnostics `8520497375`, Android `8520475937`; production NO-GO |
| I-34   | Plugin install entitlement + published-only boundary | egy forward-only migration ugyanazon RPC OID/signature/default/return/ACL mögött; owner után server-side `plugin_install`; exact `published`; státusz-lock és commit előtti recheck; public/private atomi write; grandfathered install + uninstall | runner 12/12; pinned PG17.6: 40 fail-closed tamper, ebből 15 install-policy; státusz-race rollback, két-workspace konkurens count, explicit reapply; full 77/996; type/lint/build/bundle/web 7/mobile 183/345/2/365/security/Edge PASS, egy dokumentált 85/86→86/86 flake; hosted 11/11 | additív migration; linked apply előtt history reconcile; DB-first rollout; rollback csak forward-fix/feature pause, entitlementet vagy published-only határt nem szabad vakon lazítani; meglévő installáció nem törölhető automatikusan | draft PR #183, implementation head `1aa7bcd…`, run `29901330094`, release `8522068999`, diagnostics `8522067209`, Android `8522032542`; production NO-GO |
| I-35   | Plugin install-count concurrency + derived-data repair | változatlan uninstall RPC OID/signature/ACL; installation delete → külön plugin `FOR NO KEY UPDATE` → friss count statement; öt másodperces lock-timeout, installation→marketplace `SHARE ROW EXCLUSIVE`, drift-only globális repair és exact postcondition; deterministic barrier/cleanup hardening | runner 14/14; pinned PG17.6 végső run 95,6 s: összesen 43 tamper, legacy `1/0`, közvetlen migration repair, fixed `1/1`, API/ACL/OID/grandfather/auth-atomicity és dupla reapply; type/coverage/lint/build/web/mobile/Edge/security/provenance lokálisan PASS; hosted 11/11 | additív forward-only migration; rolloutkor rövid plugin-write drain és post-count; lock-timeoutnál teljes retry; régi RPC-re revert és count-lock megkerülése tilos, csak forward fix/pause | draft PR #184, implementation head `cb0358e…`, run `29907202609`, release `8524406237`, diagnostics `8524404239`, Android `8524356479`; linked apply és production NO-GO |
| I-36   | Bounded plugin-install lock wait + safe manual retry | változatlan install RPC body/OID/signature/ACL mellett function-scoped `lock_timeout=5s`; code-only retry classification, sanitizált hiba, per-plugin pending, explicit friss kattintás és workspace/unmount stale-result guard | runner 14/14; pinned PG17.6 46 tamper, exact blocker chain, 4,5–8 s `55P03`, teljes rollback, stabil-ID friss retry és dupla reapply; API/UI 21/21; full 79/1017; type/lint/build/web/mobile/Edge/security/provenance; hosted 11/11 | additív forward-only metadata migration; nincs automatikus retry; DB-first rollout, timeoutnál teljes tranzakció retry; linked history/staging nélkül apply tilos | draft PR #185, implementation head `d75f269…`, hosted merge `cb93c099…`, run `29913434706`, release `8526921475`, diagnostics `8526918713`, Android `8526878038`; linked apply és production NO-GO |
| I-37   | Owner-only installed-plugin cleanup downgrade/archive után | marketplace browse gate-en kívüli, owner-only, összecsukott panel; redaktált catalog-independent inventory; exact-ID confirm; konfigurációtörlési/reinstall warning; sanitizált fail-visible állapotok; friss kézi retry; refetchig globális lock; generation+operation stale guard; fókusz-visszaállítás; EN/HU + EN fallback | cleanup 16/16; focused 6 fájl / 52/52; full 80/1034; type/lint/build/bundle/web 7/mobile 183/345/2/Edge 86/security/provenance PASS; clean release 365/365; hosted 11/11 | nincs DB/API/dependency/migration változás; frontend revert eltávolítja a felületet, de a felhasználó által megerősített uninstall/config-törlés nem áll vissza kódreverttel; inactive/expired útvonal nincs megváltoztatva | draft PR #186, implementation `cfb1322…`, hosted merge `1fd445d…`, run `29917203882`, release `8528453444`, diagnostics `8528450962`, Android `8528411950`; production NO-GO |
| I-38   | GitHub Actions Node 24 runtime hardening | checkout v5.1.0, setup-node v5.0.0 és upload-artifact v6.0.0 signed release teljes SHA-n; meglévő setup-java v5.2.0/setup-deno v2.0.5 exact contract; Node 22 command runtime; hat DB-jobban automatic cache tiltás, öt jobban változatlan explicit npm cache | YAML/actionlint PASS; mobile/CI source 216/216; full local regresszió; hosted 11/11, 0 annotáció, exact 6/5 cache split, Android/iOS compile és artifact contract PASS | nincs DB/API/app dependency/bundle/runtime vagy artifact-shape változás; egy workflow/checker commit reverttel visszaállítható | draft PR #187, final head `aeb9b9e…`, final run `29920515458`; production NO-GO |
| I-39   | Current-tree + teljes fetched Git-history secret gate | közös dependency-free detector core; scanner-path kivétel nélkül; unreadable/unsupported/8 MiB felett fail-closed; explicit HEAD + all-ref blob/commit/tag stream replacement/env izolációval; külön path-content/signing-alias inventory; SHA-1/SHA-256 és shallow/missing/malformed tiltás; process-szinten redaktált diagnosztika | scanner 10/10; current 1 556; exact `ce79141…` history 884 commitobjektum / 0 tag / 3 653 blob / 1 618 path / 208 967 248 byte; source 226/226; teljes 80 fájl / 1 034 teszt; web 7/7; mobile 388/388 + 2/2; clean release 408/408; Edge 86/86; hat DB contract; build/type/lint-ratchet/audit/provenance; hosted 11/11 és 0 annotáció PASS | nincs DB/API/app dependency/runtime változás; CI/scanner/version/docs revert; a gate magas bizonyosságú pattern scan, nem teljes DLP | draft PR #188; implementation `ce79141…`; merge `5edb21c…`; run `29927511094`; production NO-GO |
| I-40   | Actor-scoped fail-closed entitlement outage recovery | stale TanStack data publikus nullázása; actor/workspace cache; deduplikált sanitized retry; paid header/dialog/nav/content lezárás; első authoritative tabra deep-link repair; külön tokenmentes saját iCal summary és exact scoped revoke; nyolc locale | focused 9 fájl / 68/68; full coverage 86/1074 + final 86/1076; type/lint/build/bundle/web/mobile/release/security/Edge/hat DB contract lokálisan PASS; hosted 11/11, 0 annotáció | nincs DB/API/migration/dependency változás; frontend commit revert; végrehajtott feed-revoke nem állítható vissza kódreverttel; inaktív/suspended token inventory külön policy | draft PR #189; implementation `76f3c84…`; potential merge `9e7f5a9…`; run `29934837022`; release `8535733292`, diagnostics `8535731033`, Android `8535674674`; production NO-GO |
| I-41   | Invitation entitlement parity | exact fail-closed UI gate; bulk-import tenant-feature preflight; unchanged issue/reissue API behind authoritative tenant lookup; direct authenticated INSERT/UPDATE RLS+trigger; preserved accept/SELECT/DELETE; pinned PG18 contract and independent CI job | focused UI/import 18/18; Deno target 7/7; Edge 93/93; runner 10/10; PG18 tier/add-on/override/RBAC/service/direct-write/reapply contract; full 88/1083; hosted 12/12 és 0 annotáció PASS | forward-only migration; DB-first rollout after history reconcile; code rollback is a commit revert, applied migration requires reviewed forward repair; no new dependency | draft PR #190; head `4dbba09…`; merge candidate `50597c4…`; run `29939910831`; release `8537795808`, diagnostics `8537793580`, Android `8537760838`; production NO-GO |
| I-42   | CSV import entitlement parity | exact fail-closed `csv_import` + `members_list` UI gate; accessible locked explanation; entitlement-loss dialog/state/focus recovery; Edge tenant-feature preflight auth/RBAC után és audit/dry-run/read/write előtt; sanitizált 403/503; Export változatlan | focused 23/23; Deno helper 10/10; Edge 96/96 és 31/31; full 90/1092; type/lint/build/bundle/web 7/7/mobile release 410/410 + 2/2/security/provenance; hosted 12/12 és 0 annotáció PASS | nincs DB/API/migration/dependency változás; teljes commit revert; az Edge gate önálló visszavonása csak endpoint-tiltással biztonságos | draft PR #191; head `91696b6…`; potential merge `d6994f3…`; run `29942854980`; release `8538995651`, diagnostics `8538993487`, Android `8538946339`; production NO-GO |
| I-43   | CSV import bounded failure boundary | dependency-injektált valós-Request handler; zero-executor auth/RBAC/exact-feature denial; 405/invalid JSON; stabil additív code, no-store, request ID+CORS; fatal és tíz row-write provider redakció; 256-code-point row-value bound; kilenc prerequisite read és start-audit fail-closed; bounded post-write audit warning; CSV formula neutralization; permanent AST log gate | focused 52/52; full 92/1116; Edge 109/109 és 31/31; type/lint/build/bundle; web 7/7; mobile 390/390 + 2/2; security/provenance/release és mind a hét DB-contract lokálisan PASS; hosted 12/12, 0 annotáció | nincs DB migration vagy új dependency; success response kompatibilis, error code/header additív; commit revert; a fail-closed/sanitizáció részleges visszavonása csak endpoint-tiltással biztonságos; atomitás nincs állítva | draft PR #192; source `4dfa4b1…`; potential merge `355e3c9…`; run `29949758390`; production NO-GO |
| I-44   | CSV import client integrity boundary | dependency-free response/error adapter; exact accounting és bounded row-error parse; original source-index remap; no-retry outcome-unknown; direct upload→mapping; last-selection-wins + confirmation invalidation; versioned guidance/source offset; duplicate header/mapping guards; safe localized+a11y result UI; export/data-fetcher fail-closed | focused 5 fájl / 89; full 96/1190; type/lint/build/bundle; web 7/7; mobile release 410/410 + 2/2; Edge 109/109 és 31/31; security/provenance/release és hét DB-contract; hosted 12/12, 0 annotáció PASS | nincs DB/API/Edge/request/dependency változás; source/test/i18n commit revert; bizonytalan importkimenetnél automatikus retry tilos | draft PR #193, source `15b482e…`, potential merge `86d89b3…`, run `29956363505`; production NO-GO |
| I-45   | Export permission és legacy kliensintegritási boundary | exact permission × entitlement capability-k; külön Reports/Audit/Export komponenshatár; típusos fail-closed provider/transport/null-read/audit/artifact/download szerződés; audit-before-download; formula-neutralizált CSV; overlap query; truthful XLS; XML 1.0 szűrés + escaping; actor/workspace-generation és single-flight | focused 6 fájl / 83; full 99/1223; coverage 56,92/80,63/40,45; typecheck; lint 1108/98; build és lokális 4 573 782 / 1 312 186, hosted 4 573 875 / 1 312 283 bundle; web 7/7; mobile source 228 + sync + release 410/410 + 2/2; Edge 109/109, check 31/31, ratchet 24/24; security/history/provenance/release és hét DB-contract; hosted 12/12, 0 annotáció PASS | nincs DB/API/Edge/dependency változás; commit revert; már letöltött fájl/audit nem vonható vissza; server-owned snapshot/actor/authorizáció és pagination nyitott | draft PR #194, source `52a8f72…`, merge `6a9b7fc…`, run `29961698732`; release `8546300258`, diagnostics `8546297683`, Android `8546246028`; production NO-GO |
| I-46   | Export Wizard exact capability és delivery boundary | Settings `canAccessExport` prop; independent export/import loss recovery; entity-mode recheck; typed artifact→audit→download executor; exact `error: null`; compatibility + truthful artifact metadata; scope-token/single-flight; észlelt stale után nincs új audit, in-flight audit után nincs download/UI-success; outcome-safe i18n és a11y | focused 8 fájl / 120; full 101/1267, coverage 57,21/81,24/40,99; typecheck; lint 1108/98; build + JS 4 578 450 / 1 313 642, hosted 4 578 543 / 1 313 727; web 7/7; mobile sync + 2/2 + clean release 410/410; Edge 109/109 + 31/31; security/provenance; hosted 12/12 PASS | nincs DB/API/Edge/dependency változás; commit revert; már megírt audit/letöltési kérés nem vonható vissza; server actor/snapshot/pagination nyitott | draft PR #195, implementation `c7e2caa…`, head `0a4994d…`, merge `a120686…`, run `29965167738`; production NO-GO |

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

Az I-32 implementation head `4046c8ae799678b76589be57d216feff7279850e`.
A pinned PostgreSQL 17.6 contract 15/15 drift/tamper esetet állít meg, majd
igazolja a hardeninget, service-role megőrzést, drift-repairt, idempotens
újrafuttatást és a két-tenant clock/marketplace runtime útvonalakat. A teljes
Vitest 76 fájl / 995 teszt, a web 7/7 és mobile 183/345/2 + clean release
365/365 kapu PASS. A linked lekérdezések csak olvastak; DB apply nem történt.
Az I-33 lokális candidate a böngészős plugin-config kitettséget a forrásban
lezárja: a PG17 contract 7 új preflight és 3 reapply tampert, a teljes Vitest
77 fájl / 996 tesztet, a web 7/7 és mobile 183/345/2 kapukat igazolja. A linked
adatbázis változatlan, ezért az ottani történeti policy a DB-first rolloutig
továbbra is kockázat; a private tároló plaintext JSONB, nem Vault.

Az I-33 stacked draft PR #182 final source commitja
`e9cddac573f7310737ce2608cfbabe5a32e2cc9c`; a `29897254527` hosted Quality
Gate mind a 11 jobja PASS. Release evidence `8520498650`, diagnostics
`8520497375`, unsigned Android artifact `8520475937`. Ez source/CI bizonyíték,
nem linked apply vagy production deploy.

Az I-34 v3.51.12 source candidate célzott runner-unitja 12/12 PASS. A pinned
PostgreSQL 17.6 contract 40 fail-closed tampert futtatott, köztük 15 új
install-policy esetet és öt runtime-schema manipulációt; a behavior,
entitlement-denial, mind a négy nem publikált státusz, public/private atomicitás,
grandfathering, uninstall entitlement-vesztés után, státusz-race rollback,
két-workspace konkurens count és explicit reapply PASS. A teljes coverage 77
fájl / 996 teszt; typecheck, lint-ratchet, production build, bundle, web 7/7,
mobile 183/345/2, audit, secret scan, migration/schema provenance és Edge kapuk
lefutottak. Az első teljes Edge futás egy meglévő cleanup-timeout teszten 85/86,
az izolált futás 11/11 és az ismételt teljes futás 86/86 lett; ez P2 flake.
A `29901330094` hosted Quality Gate mind a 11 jobja PASS, benne Android és locked
iOS compile; release `8522068999`, diagnostics `8522067209`, unsigned Android
`8522032542`. Linked adatbázisírás és production deploy nem történt; a kiadási
döntés history reconcile és restored-staging DB-first acceptance előtt **NO-GO**.

Az I-35 v3.51.13 source candidate runner-unitja 14/14 PASS. A végső pinned
PostgreSQL 17.6 contract 95,6 másodperc alatt determinisztikusan előállította a
v3.51.12 `1 aktív / 0 tárolt` hibát, majd ugyanarra az állapotra alkalmazta a
migrációt: a globális reconciliation három stale derived számlálót javított, a
grandfathered üzleti adatok változatlanok maradtak, és a friss két-session race
`1/1` eredménnyel zárt. A három új fail-closed tamperrel összesen 43 eset, az
uninstall API/ACL/OID/source, authorization-atomicitás és két reapply PASS. A
35/42/45 másodperces barrier/SQL/child korlátok exact PID-lánccal és timeout-unit
teszttel védettek; a policy és count fázisok primer+cleanup hibáit külön unit teszt
őrzi. Két korábbi, szándékosan hibán megálló futás és mindkét sikeres futás saját
konténere eltávolításra került. A typecheck, 77 fájl / 996 teszt coverage,
változatlan lint-ratchet, build/bundle, web 7/7, mobil 183/345/2 + determinisztikus
sync, Edge 31/65 + 86/86, release identity 55/55, SBOM 7/7, dependency audit,
1 545-fájlos secret scan és 137-migration provenance lokálisan PASS. A draft PR
#184 implementation headje `cb0358eb6ab934fa5fb2a15012b93c74f1193674`; a
`29907202609` hosted Quality Gate mind a 11 jobja PASS, benne Android és locked
iOS. Release `8524406237`, diagnostics `8524404239`, unsigned Android
`8524356479`. Linked apply és production deploy nem történt.

| Ellenőrzés                              | Eredmény                | Megjegyzés / fennmaradó kockázat                                                                                                                                   |
| --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci --no-audit --no-fund`           | PASS                    | lockfile-ból determinisztikus install                                                                                                                              |
| `npm run typecheck`                     | I-35 LOKÁLIS + HOSTED PASS | A v3.51.13 current-tree typecheck minden web/mobile mounttal PASS; run `29907202609`. |
| Entitlement recovery I-40 focused gate  | LOKÁLIS PASS            | 8 fájl / 52/52: stale success→error→recovery, actor cache-isolation, retry dedupe/busy/sanitization, tokenmentes `id, scope` summary, exact actor/workspace/token revoke, zero-row fail-visible, workspace/tenant race, FeatureGate/legacy iCal és nyolclocale contract. Current typecheck és az új/kis érintett fájlok ESLintje PASS; a nagy Dashboard történeti lint baseline-ját a teljes ratchet ellenőrzi. |
| Invitation entitlement I-41 gate | LOKÁLIS + HOSTED PASS | UI/import Vitest 18/18; Deno helper 7/7; teljes Edge 93/93; runner unit 10/10; pinned PostgreSQL 18.4 issue/reissue/RLS/trigger/metadata/reapply contract PASS; typecheck, 228/228 CI/mobile source, 1 148/98 változatlan lint fingerprint és Edge identity 91 fájl / 875 652 byte PASS. A széles kapu 88 fájl / 1083/1083, build, bundle, web 7/7, mobile 390/390 + 2/2, 7 DB-contract, 0 vulnerability és 1573-fájlos / 0 találatos current secret scan PASS. Run `29939910831` exact head `4dbba09…`: 12/12 és 0 annotáció; potential merge `50597c4…`. Ez source/merge-candidate evidence, nem linked apply vagy production acceptance. |
| CSV import entitlement I-42 gate | LOKÁLIS + HOSTED PASS | UI/source Vitest 23/23; Deno helper 10/10; teljes Edge 96/96; 31/31 entrypoint és 0/0 diagnostic; typecheck, 1 148/98 változatlan lint fingerprint és Edge identity `a5f6228…` / 91 fájl / 882 441 byte PASS. A széles kapu 90 fájl / 1092/1092, build, reviewed bundle baseline és clean-head SHA-variáns a +128/+279 allowance-on belül, web 7/7, Android/iOS sync, mobile release 410/410 + 2/2, 0 vulnerability, 1 575-fájlos / 0 találatos current secret scan és provenance kapuk PASS. Run `29942854980` exact head `91696b6…`: 12/12 és 0 annotáció; potential merge `d6994f3…`. Authenticated tier/outage acceptance nyitott. |
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
| I-39 teljes PostgreSQL regresszió         | LOKÁLIS PASS | Mind a hat izolált contract PASS: payroll 55,520 s; HR workflow 29,250 s; admin override 7,988 s; profiles tenant 5,226 s; member profile 69,236 s; recovered ACL 108,854 s; összesen 276,074 s. A payroll negatív trust-ága egy `migration.sql\r` harness-diagnosztikai zajt írt, de az exit-kód, a fail-closed ágak és a rollback-assertionök PASS értéket adtak. Nincs linked apply vagy teljes restored-staging replay állítás. |
| Mind a 4 legacy PostgreSQL DB contract  | LOKÁLIS PASS            | `db:payroll:test`, `db:hr-workflow:test`, `db:admin-override:test` és `db:profiles-tenant:test` pinned PostgreSQL 18.4-en PASS; az I-29 member-profile/business-role/identity contracttal együtt ez öt current DB gate. Nem teljes migration replay vagy linked acceptance. |
| Recovered ACL I-32 PG17 contract        | LOKÁLIS PASS            | Runner 11/11; exact-pinned PostgreSQL 17.6; 15/15 policy/partition/parent-role/browser SUPERUSER+BYPASSRLS/pgcrypto owner+membership/source+config tamper fail-closed és baseline-intact; hardening, service-role preservation, drift repair, idempotens reapply, QR/clock/marketplace RPC, negatív ACL és két-tenant RLS smoke PASS. Nincs host port/hálózat, read-only mountok és exact ID+label cleanup. Ez célzott fixture, nem linked apply vagy teljes replay. |
| Plugin secret boundary I-33 PG17/client contract | LOKÁLIS PASS | Ugyanaz a runner 11/11; 7/7 schema/table/column/trigger/source/function/private-collision preflight tamper és 3/3 missing-row/custom table+getter ACL reapply tamper fail-closed; known-role column/getter ACL drift repair, meglévő private schema/helper megőrzés, négy legacy JSON-shape, member/assistant/admin/outsider/owner-B/service-role és disabled/cross-workspace denial, atomikus rollback/reinstall/uninstall és ismételt apply PASS. Shared browser caller AST 1/1 és typecheck PASS. Ez private plaintext boundary, nem Vault vagy linked apply. |
| Plugin install policy I-34 contract  | LOKÁLIS PASS             | Runner 12/12; pinned PostgreSQL 17.6; 40 fail-closed tamperből 15 install-policy, köztük 5 runtime-schema eset; published install/reinstall, mind a 4 nem publikált státusz denial, entitlement denial/no mutation, public/private atomicitás, grandfathering, entitlement-vesztés utáni uninstall, státusz-race rollback, két-workspace concurrent count és explicit reapply PASS. Nincs linked apply vagy deploy állítás. |
| Plugin install-count I-35 contract | LOKÁLIS PASS | Runner 14/14; pinned PostgreSQL 17.6 végső teljes contract 95,6 s. A régi `1/0` race, közvetlen bounded globális repair, új `1/1` race, három új fail-closed tamper, exact API/ACL/OID/source, grandfathered business-state, authorization rollback és dupla reapply PASS. Ez célzott fixture, nem linked apply vagy production deploy. |
| Plugin install lock-timeout I-36 contract | LOKÁLIS PASS | Runner 14/14; pinned PostgreSQL 17.6 végső teljes contract 76,5 s. Három új fail-closed tamper, exact barrier→holder→client PID-lánc, 4,5–8 s ablakban `55P03`, teljes public/private/timestamp rollback, a lock előtt változatlanul pontos count, azonos installation-ID-jú friss kézi retry és dupla reapply PASS. API+UI 21/21, TypeScript és célzott ESLint PASS. Ez célzott fixture, nem linked apply vagy production deploy. |
| Release identity / Edge SBOM contract   | I-39 LOKÁLIS + I-38 HOSTED PASS | Release-identity 55/55 és Edge SBOM unit 7/7; I-39 exact `ee032dc…` manifest 62 910 byte. I-38 run `29920014033` merge-candidate `44c44c7…` manifestje 62 981 byte; release artifact `8529577754`. |
| `release:verify:deployment`             | LOKÁLIS CONTRACT PASS / LIVE FAIL | A fail-closed verifier unit 27/27; a jelenlegi `effectime.app` még nem szolgál release manifestet, és a Lovable/Cloudflare immutable deployment-ID header/API mapping sincs igazolva, ezért production attestation NO-GO. |
| Mobile target suite                     | PASS                    | 93/93 célzott teszt: URL/origin, PKCE/deep-link és HTTPS raw-token tiltás, secure envelope/migráció/reinstall/reset tombstone/logout lock, recovery UX, CSP transform, native bridge és internal path |
| `npm run mobile:check:source`           | I-40 LOKÁLIS PASS       | 226/226 source assertion a v3.51.18 közös web/Android/iOS forráson. |
| `npm run mobile:check`                  | I-40 LOKÁLIS PASS       | A v3.51.18 shared `dist-mobile` és Android/iOS artifact contract 388/388 PASS; ugyanaz a React/Supabase adatforrás. |
| `npm run test:e2e:mobile:built`         | I-40 LOKÁLIS PASS       | 2/2 landing/auth bridge-emuláció a v3.51.18 `dist-mobile` artifacton PASS. |
| `npm run mobile:sync` / release check   | I-40 CLEAN-HEAD PASS | Exact `76f3c84…` Android/iOS sync és normalizálás determinisztikus, natív drift 0; release contract 408/408 és a 62 918 byte-os manifest ugyanazt a HEAD-et attesztálja. |
| Android unit/lint/assemble              | I-40 HOSTED PASS        | Run `29934837022` Android jobja PASS, artifact `8535674674`; ez unsigned candidate, nem store release. |
| iOS Xcode build                         | I-40 HOSTED PASS        | Run `29934837022` locked Swift package graphja és unsigned simulator buildje PASS; ez nem store release. |
| `npm test` / `npm run test:coverage`    | I-40 LOKÁLIS PASS       | Coverage: 86 fájl, 1074/1074; statements/lines 55,47% (49 696/89 587), branches 80,71% (2 415/2 992), functions 35,76% (358/1 001). A végső a11y/rAF tesztbővítés után full 86/1076 PASS. |
| Plugin downgrade cleanup I-37 UI/integration | LOKÁLIS PASS KORLÁTTAL | Cleanup komponens 16/16; hat focused fájl 52/52; exact-owner gate, catalog-independent inventory, exact installation ID, malformed receipt, sanitizált hiba, friss confirmos retry, refetch-lock, Escape/cancel/fókusz és A→B→A stale guard PASS. Authenticated böngészős downgrade/archive E2E még nyitott. |
| `npm run test:e2e:built`                | I-40 LOKÁLIS PASS       | A v3.51.18 built-web smoke 7/7 PASS egy workerrel, köztük 320/390/768 px public clipping check; ez még nem authenticated outage E2E. |
| `npm run build`                         | I-40 LOKÁLIS PASS       | A v3.51.18 production build 4095 modullal PASS; nincs új runtime dependency. |
| `npm run bundle:check`                  | I-40 LOKÁLIS PASS | Clean HEAD JS 4 553 895 raw / 1 304 480 gzip; largest 1 775 966 / 564 885; CSS 180 900 / 29 610. A teljes v3.51.17-hez mért növekedés review-zott; csak a meglévő 128/279/35 byte reprodukciós tolerancia maradt. |
| `npm audit`                             | I-40 LOKÁLIS PASS       | 0 ismert production vagy development vulnerability. |
| Browserslist dataset                    | AUDIT NO-GO             | A review-zott `1.0.30001806` update 32→32 targetből csak 9-et tartott volna meg és iOS 16.6–18.5 targeteket is kivezetne; explicit web/native support policy nélkül nem commitoltuk. A repository továbbra a régi `1.0.30001727` adaton marad és 13 hónapos warningot ad. |
| `npm run security:secrets:test`         | I-39 LOKÁLIS PASS       | 10/10 dependency-free teszt: minden detektorcsalád; anon/service-role JWT; blob-, fájlnév-, commit- és tag-secret; binary signing alias; refs-ből hiányzó detached HEAD; CLI exit+redakció; clean/üres blob; SHA-256; oversized, shallow és hiányzó objektum fail-closed; attacker-controlled hibás Git ref nyers stderr-je nem szivárog. |
| `npm run security:secrets`              | I-40 LOKÁLIS PASS       | 1 565 tracked és nem ignorált untracked szövegfájl; nincs scanner-path kivétel, symlink-követés, silent unreadable vagy over-limit skip; secret/signing találat 0. |
| `npm run security:secrets:history`      | I-40 CLEAN-HEAD PASS       | Exact `76f3c84…`, nem shallow explicit HEAD + all-ref scan: 887 commitobjektum, 0 annotált tag, 3 688 egyedi blob, 1 627 tartalmilag vizsgált történeti útvonal, 3 641 szöveg + 47 bináris blob és 213 094 552 streamelt objektum-byte; secret/signing találat 0. |
| `npm run lint:ratchet`                  | I-40 LOKÁLIS PASS       | 1 148 error / 98 warning; a diagnosztikai fingerprint változatlan, új vagy elmozdított diagnosztika nincs. |
| GitHub Actions Node 24 I-38 contract    | LOKÁLIS + HOSTED PASS | YAML/actionlint és 216/216 source PASS; minden action full SHA és exact allowlist; checkout 11, setup-node 11, upload-artifact 4, setup-java 1, setup-deno 4. Run `29920014033`: 11/11, 0 összes és 0 Node 20 annotáció, Node 22.23.1, 6 no-cache / 5 cache. Artifact retention 30/14/7 nap. |
| Strukturált logger Deno teszt/check     | I-26 LOKÁLIS PASS       | Edge log-safety, `auth-email-hook` és `send-transactional-email` Deno 2.9.3 check PASS; strukturálatlan érzékeny hiba nem került vissza. |
| `npm run edge:check` / ratchet / test    | I-39 LOKÁLIS PASS       | 31/31 entrypoint és config, 0 Deno diagnostic; 65/65 remote import exact, 0 unpinned; Deno 2.9.3; teljes Edge suite 86/86 és ratchet unit 23/23 PASS. Immutable source gate `27bdaca73e6d84b12c4d28aac81ae2797aaecec7ab1beade24ecb7c9aebe1180`, 89 fájl / 859 880 canonical byte. |
| Edge strukturált log és release SBOM    | I-39 LOKÁLIS PASS       | Edge log-safety PASS; release identity 55/55 és Edge SBOM unit 7/7, a 31 deployálható entrypoint/config teljes leltárával. |
| CSV import I-43 bounded failure contract | LOKÁLIS + HOSTED PASS | Focused 52/52; complete coverage 92 fájl / 1116 teszt; Edge 109/109 és `edge:check` 31/31; log-safety három funkción; ratchet 24/24; typecheck; lint 1,145/98 változatlan; build/bundle; web 7/7; mobile foundation 390/390 és E2E 2/2; hét DB-contract; security/provenance/release PASS. Edge identity `060c81a…` (95 fájl / 913,321 byte). Run `29949758390` 12/12 PASS, 0 annotáció. |
| CSV import I-44 client integrity contract | LOKÁLIS + HOSTED PASS | Focused 5 fájl / 89 teszt; full coverage 96 fájl / 1190 teszt (56,50% statement/line, 80,84% branch, 39,56% function); typecheck és célzott ESLint; csökkentett lint-ratchet 1121/98; build; source clean bundle 4 570 199 / 1 310 246, hosted merge 4 570 181 / 1 310 205, largest 1 783 491 / 567 356, CSS 180 900 / 29 610; web 7/7; mobile source 228, determinisztikus sync, release foundation 410 és E2E 2/2; Edge 109/109, entrypoint 31/31, ratchet 24/24; hét DB-contract; 0 dependency vulnerability; hosted current 1586 fájl és history 894 commit / 3779 blob / 222 477 389 byte secret scan; provenance/release PASS. Run `29956363505` 12/12, 0 annotáció. |
| Export I-45 permission/client-integrity contract | LOKÁLIS + HOSTED PASS | Focused access/export/i18n 6 fájl / 83 teszt; full coverage 99 fájl / 1223 teszt (56,92% statement/line, 80,63% branch, 40,45% function); typecheck; csökkentett lint-ratchet 1108/98; build; lokális bundle 4 573 782 / 1 312 186, largest 1 784 589 / 567 739; hosted 4 573 875 / 1 312 283, largest 1 784 589 / 567 743; CSS 180 900 / 29 610; web 7/7; mobile source 228, determinisztikus Android/iOS sync, clean-worktree release 410/410 és E2E 2/2; Edge 109/109, entrypoint 31/31, ratchet 24/24; hét DB-contract; release identity 55/55 és Edge SBOM 7/7; 0 dependency vulnerability; current secret scan 1591 fájl, history 896 commit / 3782 blob / 223 133 199 byte / 0 találat; migration 2/26 678 byte és schema provenance 139 migration PASS. Első run `29961344196` 11/12-ként feltárta a 74 byte-tal szűk raw plafont; explicit baseline után run `29961698732` exact head `52a8f72…`, merge `6a9b7fc…`: 12/12, 0 annotáció. Release `8546300258`, diagnostics `8546297683`, Android `8546246028`. |
| Export Wizard I-46 authorization/delivery contract | LOKÁLIS + HOSTED PASS | Focused 8 fájl / 120; full single-worker coverage 101/1267 (57,21% statement/line, 81,24% branch, 40,99% function); typecheck; változatlan lint 1108/98; build; local JS 4 578 450 / 1 313 642, hosted 4 578 543 / 1 313 727, largest hosted 1 785 150 / 567 948, CSS 180 900 / 29 610; web 7/7; determinisztikus Android/iOS sync + mobile 2/2, clean-worktree release 410/410 és 0 tracked drift; Edge 109/109, entrypoint 31/31, diagnostic 0/0; audit 0 vulnerability; current secret 1594 fájl, history 900 commit / 3817 blob / 228 468 667 byte; migration 2/26 678 byte, schema 139 migration és Edge source 95 fájl / 913 321 byte PASS. Run `29965167738`, exact head `0a4994d…`, potential merge `a120686…`: 12/12, 0 annotáció; release `8547601907`, diagnostics `8547600079`, Android `8547564723`; production NO-GO. |
| Payroll contract és UI regresszió       | PASS                    | Deno payroll contract 15/15; célzott Vitest 20/20; AuditLog allowlist 2/2; typed Edge check PASS; current full unit 549/549 |
| Payroll snapshot DB contract            | I-25 REVALIDÁLVA PASS   | runner unit 12/12; pinned PostgreSQL 18.4 migration/digest/ACL/search_path/trigger/negative auth/member drift/audit rollback PASS. A readiness valódi `SELECT 1` lekérdezéssel igazolja a név szerinti céladatbázist, ezért a konténerfolyamat és az adatbázis-létrehozás közti race fail-closed. Négy manipulált pgcrypto/schema trust eset fail-closed; runtime TRUNCATE, direct service reset és reserved-audit forge/tamper/delete tiltott; whitespace/NULL és 7/8/1000/1001 indokhatárok, exact prev/new audit, locked/exported/legacy reopen auditált. Determinisztikus lock és reopen exactly-one-winner, valamint actor-demotion→reopen fail-closed, bitazonos sor/0 audit igazolt. Collisionteszt idegen konténert megőriz; nincs hálózat/host port, csak két read-only mount, ownership-ID+label cleanup PASS. Ez célzott fixture, nem teljes migration replay. |
| HR workflow tenant DB/UI contract       | I-25 REVALIDÁLVA PASS   | runner unit 8/8; pinned PostgreSQL 18.4 static contract, repeat apply és legacy-row preservation PASS; cross-workspace template/membership/instance/task/assignee, inactive membership, member/admin RLS, list PII, parent cascade és exact RPC/FK catalog fail-closed. Négy determinisztikus reassignment/suspension/direct-write lock-race PASS. UI data+a11y+request-ordering 10/10; nincs `eq.undefined`, backend/task hiba fail-visible, pending instance-read deduplikált, workspace-váltás és unmount utáni válasz invalidált. Nincs hálózat/host port; exact ownership cleanup és bounded child termination. Célzott fixture, nem teljes migration replay vagy restored-staging bizonyíték. |
| Migration byte provenance gate         | I-39 LOKÁLIS PASS       | Unit 9/9; két exact recovered SQL / 26 678 raw byte; a kanonikus byte+SHA a verifierben és a manifestben is rögzített; path, entry-set, type, symlink, length, SHA-256 és koordinált SQL+manifest drift fail-closed ellenőrzés; Git LF contract PASS. |
| Schema provenance gate                  | I-39 LOKÁLIS PASS | Exact-debt gate és 7/7 unit 138 migráción megtartotta a 25/1/41/2 ismert unproven surface baseline-t. Az I-27–I-36 candidate RPC-k és private táblák nincsenek hitelesen regenerált generated types-ban, ezért az exact local interface nem helyettesíti a linked-schema regenerálást. I-39 nem módosít sémát. |
| SBOM és release manifest                | I-29 HOSTED PASS | Run `29879703648`, release evidence artifact `8514318251`, diagnostics `8514316593`; ez source candidate evidence, nem live deploy. |
| GitHub-hosted quality workflow          | I-29 PASS | Draft PR #178 final source `f628d0b7d0931be5f16ebd03e14a608648077ac8`; run `29879703648` mind a 10 jobja PASS, benne az öt PostgreSQL contract, frontend/Edge, Android és locked iOS. |
| I-36 hosted release evidence            | PASS | Draft PR #185 implementation head `d75f269d73dc9c27be1949e3d1a2f009fc3134c6`; a PR checkout potential merge SHA-ja `cb93c0998c6645e4b680f434fa308e8795b85ff3`. Run `29913434706` mind a 11 jobja PASS; release `8526921475`, diagnostics `8526918713`, unsigned Android `8526878038`. Ez source/merge-candidate CI bizonyíték, nem linked apply vagy production deploy. |
| I-37 hosted release evidence            | PASS | Draft PR #186 implementation head `cfb132251c871c12b4e99395a3274dbc642ff1b5`; a PR checkout potential merge SHA-ja `1fd445d8614c9d73062f0b04ebca25b5d5e93abb`. Run `29917203882` mind a 11 jobja PASS; release `8528453444`, diagnostics `8528450962`, unsigned Android `8528411950`. Ez source/merge-candidate CI bizonyíték, nem linked apply vagy production deploy. |
| I-38 hosted release evidence            | PASS | Draft PR #187 implementation head `f92fdec011d1d9073bb989d42015bbca5b45754f`; potential merge `44c44c75ff53c62d10bccf871bec22e010a5de10`. Run `29920014033` 11/11 és 0 annotáció; release `8529577754`, diagnostics `8529557269`, unsigned Android `8529531692`. Ez source/merge-candidate CI bizonyíték, nem production deploy. |
| I-39 hosted release evidence            | PASS | Draft PR #188 implementation `ce7914114a345aafb6b075b399f6edc47853c3b7`, source head `1c1f4bc73b4378df592f7fa6183d0438b14b3ebd`, potential merge `5edb21c5ba4e2fccf25f50b366a63a84b783cd51`. Run `29927511094` 11/11 és 0 annotáció; scanner 10/10, hosted history 884 commit / 3 655 blob / 209 574 766 byte / 0 finding; release `8532684019`, diagnostics `8532681136`, unsigned Android `8532609597`. Ez source/merge-candidate CI bizonyíték, nem production deploy. |
| I-40 hosted release evidence            | PASS | Draft PR #189 implementation `76f3c8406ca45791b5f521c683123afd3e83ba22`, potential merge `9e7f5a9045d9d63f9876f4e4af5393a4b9d42e93`. Run `29934837022` 11/11 és 0 annotáció; a 62 981 byte-os manifest a potential merge SHA-t attesztálja; release `8535733292`, diagnostics `8535731033`, unsigned Android `8535674674`. Ez source/merge-candidate CI bizonyíték, nem production deploy. |
| I-43 hosted release evidence            | PASS | Draft PR #192 source head `4dfa4b1b4e2f15d93ee2673fa3e8c1b41dcf466d`; potential merge `355e3c9dcd98a99998bbee99faab893b064224fb`. Run `29949758390` 12/12 és 0 annotáció; release `8541710604` (30 nap), diagnostics `8541708590` (14 nap), unsigned Android `8541666923` (7 nap). Ez source/merge-candidate CI bizonyíték, nem production deploy. |
| I-44 hosted release evidence            | PASS | Draft PR #193 source head `15b482eeced593b51559982bb94e2eaf711a3432`; potential merge `86d89b35c0ba368926de8300c73dc83a688bbfec`. Run `29956363505` 12/12 és 0 annotáció; release `8544266999` (30 nap), diagnostics `8544265085` (14 nap), unsigned Android `8544223123` (7 nap). Ez source/merge-candidate CI bizonyíték, nem production deploy. |
| I-30 hosted release evidence            | PASS | Draft PR #179 implementation head `1e3d874275c33115e97c0216ef36e5b832edd3f7`; run `29885969841` mind a 10 jobja PASS, release artifact `8516558700`, diagnostics `8516557751`, unsigned Android `8516531963`. Ez source/CI bizonyíték, nem linked apply vagy production deploy. |
| I-31 hosted release evidence            | PASS | Draft PR #180 implementation head `b98cdc8f315eaf346ea8648b671506ac97d64caf`; run `29888707884` mind a 10 jobja PASS, release artifact `8517495434`, diagnostics `8517494400`, unsigned Android `8517474651`. Ez source/CI bizonyíték, nem migration repair, linked apply vagy production deploy. |
| I-32 hosted release evidence            | PASS | Draft PR #181 implementation head `4046c8ae799678b76589be57d216feff7279850e`; run `29891543713` mind a 11 jobja PASS, release `8518456625`, diagnostics `8518455066`, unsigned Android `8518432152`. Ez source/CI bizonyíték, nem linked apply vagy production deploy. |
| I-33 hosted release evidence            | PASS | Draft PR #182 final head `e9cddac573f7310737ce2608cfbabe5a32e2cc9c`; run `29897254527` mind a 11 jobja PASS, release `8520498650`, diagnostics `8520497375`, unsigned Android `8520475937`. Ez source/CI bizonyíték, nem linked apply vagy production deploy. |
| I-34 hosted release evidence            | PASS | Draft PR #183 implementation head `1aa7bcd7e84efaf3268f100a9a2123bd91464edc`; run `29901330094` mind a 11 jobja PASS, release `8522068999`, diagnostics `8522067209`, unsigned Android `8522032542`. Ez source/CI bizonyíték, nem linked apply vagy production deploy. |
| I-35 hosted release evidence            | PASS | Draft PR #184 implementation head `cb0358eb6ab934fa5fb2a15012b93c74f1193674`; run `29907202609` mind a 11 jobja PASS, release artifact `8524406237`, diagnostics `8524404239`, unsigned Android `8524356479`. Ez source/CI bizonyíték, nem linked apply vagy production deploy. |
| Új v3.51.3 migration PG18 compile/apply | PASS                    | Access submit/döntés/ledger/rollback szemantika PASS; candidate dual-feature compile PASS, candidate runtime smoke megszakadt; production/linked apply nem történt |
| Clean lokális migration replay          | NEM IGAZOLT             | A korábbi `plugin_webhook_events` source-hiány megszűnt. A friss DB-only Supabase replay a legelső migrációnál a hiányzó Storage-sémán állt meg; teljes Supabase-stack 139/139 replay még nem futott. |
| Linked `db lint --level warning`        | FAIL                    | 7 error, 6 warning; read-only ellenőrzés                                                                                                                           |
| Live `effectime.app` release attestation | FAIL                    | A Lovable/Cloudflare root elérhető, de `/.well-known/effectime-release.json` továbbra is 404. A live artifact ezért nem köthető az I-27–I-43 candidate SHA-k egyikéhez sem; production attestation NO-GO. |
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
10. Az exact `csv_import` + `members_list` source-kapu az I-42 candidate-ben,
    a bounded request/error/audit-start és CSV spreadsheet-output boundary az
    I-43 source + hosted candidate-ben elkészült. Az I-44 source + hosted candidate az
    Import Wizard feltöltés utáni zsákutcáját, response-validációját, eredeti
    sorindexeit és sanitizált code/request-ID hibakezelését zárja le; a teljes
    és hosted kapu után ezt követi a specifikációban vállalt tranzakciósság, a mutációkori
    authz/entitlement recheck, a UI által
    ténylegesen használt szerver dry-run, az explicit `schema_version` validáció
    és a tranzakcióval összekötött failed/completion audit. Ezt külön, DB/API-
    és concurrency-contracttal kell szállítani; az I-42/I-43 fail-closed kapuk
    nem lazíthatók.
11. Multi-step approval chain runtime és concurrency/E2E.
12. Staging deploy azonos commitból: DB, Edge, frontend; adversarial RBAC/tier,
    invite, leave, access, payroll, API/webhook és integration smoke.
13. Biztonságos instant provisioning termékdöntése és implementációja.
14. Account deletion retention/kompenzáció, data migration resumability.
15. A hosted quality gate required-checkként való fenntartása; a zero-diagnostic
    és zero-unpinned Edge baseline, a schema-provenance ratchet, valamint a
    current-tree + teljes fetched-history secret kapu őrzése. A magas
    bizonyosságú pattern gate későbbi entropy/DLP kiterjesztése csak mérhető
    hamispozitív-baseline és provider-fixture után történhet.
16. Store/app-ID/signing ownership és verified links; Android CI + macOS/Xcode
    CI; kétplatformos secure-storage/CSP/tenant/RBAC/auth fizikai smoke és csak
    ezután internal TestFlight/Play rollout.
17. Fokozatos lint-, coverage-, E2E- és bundle-adósság csökkentés.

Az I-34–I-36 következő kontrollált hulláma csak history reconcile után a restored-
staging DB-first acceptance. Az I-35 a count-race-t, az I-36 a bounded lock-waitet,
az I-37 pedig az aktív tier-downgrade/catalog-hidden owner cleanup UI-t zárja le
forrásszinten. A runtime feature-status/dependency és grandfathered service-getter
policy továbbra külön P2. Az inactive/expired, `ws_general` nélküli recovery
útvonala termékdöntést és külön acceptance-et igényel; egyik nyitott tétel sem
lazíthatja vissza az entitlement/published-only vagy owner-only szerverhatárt.

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

Az I-30 v3.51.8 candidate tokenesen fence-elt created-identity jobokat,
whole-worker singletont, bounded POST-only Edge workert és owner-only, dormant
Vault/pg_cron installert ad. A 86/86 Edge, 31/31 entrypoint/config, 65/65 pinned
import, AST log-safety 9/9, runner 16/16 és mind az öt pinned PG18 contract,
köztük a late-worker/single-flight/event-extension/temp-upgrade védelem,
lokálisan zöld. A scheduler nem települt; a hosted Quality Gate 10/10 PASS, de
ez nem linked apply vagy production deploy.

Az I-31 v3.51.9 candidate két remote-history DDL-t állít vissza az eredeti
migrációazonosítóval és byte-identitással. A 9/9 manifest-unit, 2/2 current
SHA-256 és 7/7 schema parser zöld; a 133-migrációs exact gate 25/1/41/2 ismert
proveniencia-adósságot tart meg. A linked inventory read-only 61 shared / 72
local-only / 82 remote-only. Draft PR #180 implementation head `b98cdc8…`
hosted Quality Gate runja (`29888707884`) 10/10 PASS; release evidence
`8517495434`, diagnostics `8517494400`, unsigned Android `8517474651`.
Migráció-history repair vagy linked write nem történt.

**Kiadási döntés: production/backend NO-GO.** A friss read-only linked inventory
61 shared / 78 local-only / 82 remote-only; a teljes 139-migrációs Supabase
clean replay nem igazolt, a linked lint hibás és a
live release manifest hiányzik. A created-identity cleanup recurring schedulere
nincs telepítve, ezért a kompenzáció automatikus működése sem release-képes.
Backup, history reconcile, teljes clean replay, restored-staging old/new-client
és fault-injection acceptance, reviewed scheduler, DB-first apply/schema-cache,
majd azonnali attestált web/Android/iOS rollout kötelező. A privacy ACL és pending
saga adat rollbackként sem lazítható/törölhető.

Az Android/iOS közös forrás és unsigned hosted build fejlesztésre alkalmas, de a
store release külön **NO-GO**, amíg a `docs/mobile/README.md` signing,
verified-link, brand-asset és fizikai secure-storage/CSP/auth kapui nem teljesülnek.
Production csak tiszta candidate SHA, teljes DB-reconcile, működő cleanup
scheduler, jóváhagyott staging és ellenőrzött rollout után bocsátható ki.

A v3.51.12 I-34 lokálisan és hosztolt CI-ben validált source candidate. Nem módosítja ezt a NO-GO
döntést: commit/push/hosted CI önmagában sem helyettesíti a migration-history
reconcile-t, a teljes replayt, a restored-staging DB-first próbát vagy az
attestált production deploymentet.

A v3.51.13 I-35 lokális contract- és széles source/CI kapui, valamint az
implementációs head 11/11 hosted Quality Gate-je zöld, de ugyanezt a NO-GO döntést
tartja fenn; linked apply és production deploy nem történt.
A production apply előtt kötelező a plugin-write drain, az öt másodperces lock-
budgeten belüli teljes migráció, a globális `install_count = enabled rows`
post-query, majd ugyanazon commitból a kliens- és release-attestation lánc.

A v3.51.14 I-36 source candidate öt másodperces funkciószintű install
lock-timeoutot és sanitizált, explicit kézi retryt ad. A végső pinned PG17.6
timeout/rollback/retry contract, runner 14/14, API+UI 21/21 és TypeScript kapu
zöld; a teljes 79/1017 coverage, lint/build/bundle, web 7/7, mobile
183/345/2, Edge 86/86, release/security és provenance kapuk is PASS. A draft
PR #185 implementációs headjére jelentett hosted run `29913434706` mind a 11
jobja PASS; a PR checkout a `cb93c099…` potential merge commitet attesztálja.
A migration-history drift miatt linked apply és production deploy továbbra sem
engedélyezett.

A v3.51.15 I-37 code-only source+hosted candidate nem módosít adatbázist, API-t
vagy függőséget. Az aktív tier-downgrade és catalog-hidden exact-owner cleanup
focused 52/52 és full 80/1034 kapuja, type/lint/build/bundle, web 7/7, mobile
183/345/2, Edge 86/86, release/security és provenance ellenőrzése zöld. Az exact
`cfb1322…` clean HEAD 365/365 release contractja és manifestje PASS. Draft PR
#186 implementációs headjére jelentett hosted run `29917203882` mind a 11 jobban
PASS; a PR checkout `1fd445d…` potential merge commitet attesztál. Authenticated
böngészős downgrade/archive acceptance és inactive/expired recovery policy még
nyitott. A globális migration-history, replay, linked-lint és live-attestation
blockerek miatt production deploy továbbra **NO-GO**.

A v3.51.16 I-38 CI-only source+hosted candidate a deprecated Node 20 GitHub Action
runtime-okat Node 24-re migrálja teljes SHA-pinekkel, miközben az Effectime Node
22 command runtime-ja, a minimális workflow-jogosultság, a checkout credential-
tiltás, az artifact-szerződés és a korábbi cache-határok változatlanok. A lokális
YAML, 216/216 source, 9/9 Edge workflow, ESLint, diff és lint-ratchet kapu zöld;
run `29920014033` 11/11 PASS, 0 annotáció, a cache split, Node 22 és artifact-
retention log/API szinten igazolt. Ez nem deploy workflow, és a production
**NO-GO** állapotát nem változtatja meg.

A `caniuse-lite` adatfrissítés read-only review-ja 32→32 targetből csak 9 közöset
talált, miközben az iOS deployment minimum 15.4 és nincs explicit web/native
support policy vagy iOS WebKit gate. Bár a mért CSS-diff egyetlen `.transition`
szabály két legacy prefixére korlátozódott és konkrét vizuális regresszió nem
bizonyított, regressziómentesség sem bizonyítható. A dependency candidate ezért
**NO-GO**, nem lett commitolva vagy pusholva; a régi dataset warningja ismert P2.

A v3.51.17 I-39 candidate a korábbi current-tree-only secret kaput közös,
dependency-free current/history detektormagra cseréli. A lokális 10/10 regresszió
commitált majd törölt provider tokent, service-role JWT-t, secret-bearing
fájlnevet/commit/tag üzenetet és binary signing-file aliast is megtalál; anon
JWT-t enged, oversized, shallow vagy hiányos object store esetén fail-closed,
és attacker-controlled hibás ref esetén sem írja ki a nyers Git hibát.
A valós, exact `ce79141…` HEAD + all-ref leltár 884 commitobjektum / 0 tag /
3 653 blob / 208 967 248 byte, találat nélkül; a CI source contract 226/226. Ez source/CI hardening, nem runtime
vagy deploy, és nem oldja fel a production history/staging/same-SHA **NO-GO**-t.

A v3.51.19 I-41 source + hosted candidate ugyanazt az exact `members_invite`
entitlementet érvényesíti a két UI belépési ponton, a bulk-import service-role
ágon, az issue/reissue RPC-ben és a közvetlen authenticated INSERT/UPDATE
határon. A focused 18/18, Edge 93/93, pinned PostgreSQL 18.4 invitation contract,
teljes 88 fájl / 1083/1083, type/lint/build/bundle, web 7/7, mobile 390/390 +
2/2, security/provenance és mind a hét DB-contract PASS. Az exact `4dbba09…`
branch-head hosted runja (`29939910831`) 12/12 és 0 annotáció; a retained
release/diagnostics/unsigned Android artifactok `8537795808` / `8537793580` /
`8537760838`. Ez nem linked DB-apply vagy production deploy; a history/staging/
same-SHA blokkerek miatt a kiadási döntés továbbra **NO-GO**.

A v3.51.20 I-42 source + hosted candidate az exact `csv_import` + `members_list`
entitlementet az aktív Import UI-ra és az `import-entity-data` authoritative
service-role határára is érvényesíti. Focused 23/23, Deno 10/10, Edge 96/96,
teljes 90 fájl / 1092/1092, type/lint/build/bundle, web 7/7, mobile release 410/410 +
2/2, security/provenance és 0 dependency vulnerability PASS. Az exact
`91696b6…` source head hosted runja (`29942854980`) 12/12 és 0 annotáció; a
retained release/diagnostics/unsigned Android artifactok `8538995651` /
`8538993487` / `8538946339`. Linked apply és production deploy nem történt; a
history/staging/Edge parity/same-SHA blokkok miatt a kiadási döntés továbbra
**NO-GO**.

A v3.51.21 I-43 source + hosted candidate. A valós `Request` handler
contract, az auth/RBAC/exact-feature zero-executor sorrend, a 405/invalid-JSON/
no-store/request-ID+CORS szerződés, a raw provider-detail redakció, a 256-code-
point row-value limit, a kilenc fail-closed dependency read, a start-audit kapu,
a bounded completion-audit warning, a CSV formula-neutralizáció és a permanent
AST log gate forrásszinten elkészült. Focused 52/52, teljes 92 fájl / 1116
teszt, Edge 109/109 és entrypoint 31/31, type/lint/build/bundle, web 7/7, mobile
390/390 + 2/2, security/provenance/release és mind a hét izolált DB-contract
lokálisan PASS. Az exact `4dfa4b1…` source head runja (`29949758390`) 12/12
PASS és 0 annotáció; retained release/diagnostics/unsigned Android artifactok
`8541710604` / `8541708590` / `8541666923`. Production deploy nem történt. A
szekvenciális írás,
mid-flight demotion/revoke, server dry-run, `schema_version` és atomi audit
nyitott marad, ezért a production kiadási döntés változatlanul **NO-GO**.

A v3.51.22 I-44 source + hosted candidate az Import Wizard kliensintegritási határát
lezárja: response/accounting ellenőrzés, eredeti sorindex-remap, outcome-unknown
no-retry, last-selection-wins feldolgozás, megerősítés-invalidation, versioned
guidance marker, duplikált header/mapping védelem, lokalizált fail-closed
adatlekérés és hozzáférhetőségi állapotjelzés készült. Focused 5 fájl / 89 teszt,
teljes 96 fájl / 1190 teszt, type/lint/build/bundle, web 7/7 és mobile
228/228 + 410/410 + 2/2 lokálisan PASS. Az exact `15b482e…` source head hosted
runja (`29956363505`) 12/12 PASS és 0 annotáció; a retained release/diagnostics/
unsigned Android artifactok `8544266999` / `8544265085` / `8544223123`. A teljes request timeout szándékosan
nyitott a nem atomi, legfeljebb 2 000 soros szerverírás mért latency- és
idempotencia-bizonyítékáig; a nagy exportok explicit lapozása/csonkoláskapuja a
következő P1 csomag. Production deploy nem történt, ezért a kiadási döntés
**NO-GO**.

A v3.51.23 I-45 source candidate lezárja a közös Reports/Audit/Export shell
sibling permission- és entitlement-bővítését: mindhárom capability csak a saját
RBAC-joga és exact feature-entitlementje együttes fennállásakor mountolódik. Az
aktív legacy leave export a provider `{ error }`, rejected transport és null
read eseteket fail-closed kezeli, audit nélkül nem tölt le, a CSV-formulákat
semlegesíti, az átnyúló szabadságokat overlap queryvel beemeli, az Excel XML-t
valós `.xls` fájlként jelöli, és stale workspace/dupla kattintás ellen védett.
Focused 83/83, teljes 99 fájl / 1223 teszt, type/lint/build/bundle, web 7/7,
mobile source 228/228 + determinisztikus sync + 2/2, Edge 109/109, security és
provenance kapuk lokálisan PASS. A production kiadási döntés mégis **NO-GO**:
a közvetlen browser-table RLS nem exact export-permission boundary, az audit
actor caller-owned, a többquerys olvasás pedig nem atomi/exact-count snapshot.
Ezekhez server-owned RPC/job, DB-contract, helyreállított staging és DB→client
same-SHA rollout szükséges; a jelenlegi migration-history drift mellett ezt nem
szabad spekulatív production módosítással megkerülni.
