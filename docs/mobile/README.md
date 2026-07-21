# Effectime Android/iOS foundation

## Dokumentum státusza

- **BIZONYÍTOTT:** ez a dokumentum a repositoryban jelenleg megvalósított
  Capacitor 8 foundation átadási és architektúra-leírása.
- **BIZONYÍTOTT:** az Android- és iOS-projekt forrása létezik, de ez még nem
  jelent aláírt, store-ban lefoglalt vagy készüléken elfogadott mobil release-t.
- **BIZONYÍTOTT:** a store release döntése jelenleg **NO-GO**. A blokkoló
  feltételeket a [Store release kapuk](#store-release-kapuk-no-go) rész sorolja.
- **BIZONYÍTOTT:** a v3.51.4 / I-26 fejlesztési kör a
  [#175 pull requestben](https://github.com/HenrikFaul/effectime-app-enterprise-a95029a1/pull/175)
  integrálódott a `main` branchre
  (`f52671880748c58802d94e0705204d846f4b5928`), és a main hosted quality run
  `29682829301` mind a 8 jobja sikeres volt. Ez repository- és CI-bizonyíték,
  **nem** production deploy-, store-publikálási vagy készülékes release-bizonyíték.
- **BIZONYTALAN:** a végleges store-tulajdonosok, signing team-ek, certificate-ek
  és provisioning adatok nem állapíthatók meg a repositoryból; ezekről az arra
  jogosult embernek kell döntenie.

A bizonyossági címkék jelentése:

- **BIZONYÍTOTT:** közvetlenül igazolható a repositoryból vagy lefuttatott
  ellenőrzésből.
- **VALÓSZÍNŰ:** a jelenlegi kód és termékidentitás erősen alátámasztja, de külső
  store-, DNS- vagy account-állapot még nem igazolja.
- **BIZONYTALAN:** külső hozzáférés vagy termék-/biztonsági döntés szükséges.

## Architektúra és adatforrás

```mermaid
flowchart LR
  Web["Web / PWA"]
  Android["Android Capacitor WebView"]
  IOS["iOS Capacitor WKWebView"]
  React["Közös React + TypeScript bundle"]
  Client["Supabase kliens\npublishable key + user JWT"]
  Boundary{{"Tenant trust boundary"}}
  Auth["Supabase Auth"]
  Data["PostgreSQL RLS + RPC"]
  Edge["Edge Functions"]

  Web --> React
  Android --> React
  IOS --> React
  React --> Client
  Client --> Boundary
  Boundary --> Auth
  Boundary --> Data
  Boundary --> Edge
```

- **BIZONYÍTOTT:** a web, Android és iOS ugyanazt a React/Vite forrást és üzleti
  logikát használja. A Capacitor a külön CSP-hardened `dist-mobile` artifactot
  csomagolja; Android és iOS byte-azonos mobil buildet kap, miközben a webes
  `dist` SEO/PWA szerződése változatlan. Production `server.url` vagy cleartext
  override nincs
  ([`capacitor.config.ts`](../../capacitor.config.ts)).
- **BIZONYÍTOTT:** mindhárom kliens ugyanazt a Supabase klienst és ugyanazokat a
  build-time publikus változókat használja: `VITE_SUPABASE_URL` és
  `VITE_SUPABASE_PUBLISHABLE_KEY`
  ([`client.ts`](../../src/integrations/supabase/client.ts),
  [`.env.example`](../../.env.example)). Külön mobil adatbázis vagy mobil-specifikus
  üzleti API nincs.
- **BIZONYÍTOTT:** a kliens és a mobil binary nem bizalmi határ. A publishable
  kulcs nyilvános klienskonfiguráció; a felhasználói JWT, a PostgreSQL RLS/RPC és
  az Edge Function authorization együtt védi a workspace/tenant adatokat.
- **BIZONYÍTOTT:** service-role kulcs, provider secret, signing private key vagy
  más szerveroldali titok nem kerülhet `VITE_*` változóba, JavaScript bundle-be,
  native resource-ba vagy logba.
- **BIZONYÍTOTT:** a natív kliens nem kap külön tenant-jogosultságot. Minden
  workspace ID és rekordazonosító támadó által módosíthatónak tekintendő; a
  szerveroldali tenant-izolációt a mobil UI nem helyettesítheti.
- **BIZONYÍTOTT v3.51.4 / I-26 main:** az admin leave override weben,
  Androidon és iOS-en ugyanazt a közös TypeScript adaptert és Supabase
  `create_admin_leave_override_v2` RPC-t használja. A régi, tízparaméteres v1
  RPC változatlan marad a már telepített binarykhez, de a v1 nem kap
  idempotenciakulcsot, ezért arra nem állítunk exactly-once garanciát.
- **BIZONYÍTOTT v3.51.4 / I-26 main:** a v2 same-key retryhoz actor/workspace-
  scope-olt outbox készül a webes vagy Capacitor WebView `localStorage`
  rétegén. A hét nap retry/reconciliation-horizont, nem automatikus törlési
  TTL. Csak UUID scope, SHA-256 payload digest, UUID kulcs, verzió és időbélyeg
  tartós; justification/comment nem. Web Crypto kötelező, a tárolás write/
  readback-ellenőrzött, az RPC 30 másodpercre bounded. Ez nem 14 napos offline
  command queue és nem tárol újrajátszható nyers üzleti adatot.
- **BIZONYÍTOTT fail-closed v3.51.4 / I-26 main:** actor/workspace scope-onként egy
  feloldatlan művelet lehet. A változatlan payload ugyanazt a kulcsot használja,
  az eltérő payload blokkolt. A bizonytalan, lejárt vagy sérült kliensbizonyíték
  nem törlődik automatikusan; exact-key cleanup csak hiteles szerver receipt után
  történik. Minden hibaválasz megtartja a bizonyítékot: az ismert 4xx pontosan
  ugyanazzal a kulccsal próbálható újra, míg HTTP 408/499, 5xx, transport-
  bizonytalanság, `0` státusz vagy hibás receipt a lokalizált
  `outcome_uncertain` állapotot mutatja. Ehhez a kritikus művelethez kötelező az
  origin-szintű Web Locks; hiányzó vagy letiltott API esetén az RPC előtt
  fail-closed marad. A kompatibilitási határ forrása a WebKit
  [Safari 15.4 release note](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/);
  a WebKit [Lockdown Mode leírása](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)
  külön is rögzíti az API letiltását. Az iOS deployment target ezért 15.4; a
  source/release mobile contract ennél régebbi targetet visszautasít. Lockdown
  Mode-ban az admin override tudatosan nem érhető el, miközben a többi mobil
  funkció támogatási szerződése változatlan.
- **BIZONYÍTOTT rollout-korlát:** a v2 DB-migrációt és a PostgREST schema-cache
  ellenőrzését a v2-only kliens előtt kell kiadni. Rollbackkor először a kliens
  tér vissza v1-re; a v2 függvény/ledger nem távolítható el, amíg támogatott v2
  binary létezik. A dokumentált migration-history/schema drift miatt a production
  DB-first rollout továbbra is **NO-GO**.
- **VALÓSZÍNŰ:** a canonical publikus origin productionben
  `https://effectime.app`. Ezt a `VITE_PUBLIC_APP_ORIGIN` adja meg, és ez szolgál
  a WebView lokális originjét elhagyni képes meghívó-, booking- és embed linkek
  alapjául ([`mobile.ts`](../../src/lib/platform/mobile.ts)).

### Workspace-mérföldkövek közös adaptere (v3.51.5 candidate)

- **BIZONYÍTOTT a candidate forrásban:** a web, Android és iOS ugyanazt a
  [`workspaceMilestonesApi.ts`](../../src/lib/workspaceMilestonesApi.ts)
  adaptert használja. Az adapter kizárólag a
  `get_workspace_member_milestones_v1(p_workspace_id)` RPC-t hívja; nincs külön
  mobil adatforrás, nyers `profiles.preferences` lekérdezés vagy csendes legacy
  fallback.
- **BIZONYÍTOTT a candidate migrációban:** az RPC aktív workspace-tagságot,
  `calendar` és `members` read jogosultságot, valamint `birthday_widget` és
  `members_list` feature-entitlementet követel. Csak a normalizált
  `membership_id`, `display_name`, mérföldkőtípus, hónap és nap hagyja el a
  szervert; `user_id`, születési év, teljes preferences JSON, aktivációs token
  vagy más privát profilmező nem.
- **BIZONYÍTOTT a candidate migrációban:** a közös coworker-directory külön,
  szűk identity-resolution szerződés. Az aktív viewer ugyanazon workspace
  történeti tagjának nevét/avatarját is feloldhatja members-admin jogosultság
  nélkül, de a böngészős projekció csak `user_id`, `display_name`, `avatar_url`.
  A saját locale kizárólag a `get_my_profile_locale_v1()` RPC-n olvasható.
- **BIZONYÍTOTT a candidate forrásban:** a globális display name csak self-service
  módon, az `update_my_workspace_profile_display_name_v1` RPC-n módosítható. Az
  RPC az aktív membership workspace-ét és `auth.uid()` tulajdonosát is ellenőrzi;
  egy tenant admin nem nevezheti át más felhasználó minden workspace-ben látható
  globális identitását. A mobil shell nem kap közvetlen profile insert/upsert
  vagy szélesebb update jogot.
- **BIZONYÍTOTT a candidate kliensben:** az adapter UUID-, mezőkészlet-, típus-
  és dátumtartomány-validációval, 15 másodperces timeouttal és megszakítható
  kéréssel fail-closed működik. Tenantváltáskor a régi kérés eredménye nem írhatja
  felül az új workspace állapotát.
- **BIZONYÍTOTT kompatibilitási korlát:** a migráció után a régi, közvetlen
  `profiles.preferences` olvasást végző kliens permission hibával fail-closed
  marad: érzékeny adatot nem kap, de a régi widget nem tekinthető funkcionálisan
  kompatibilisnek. Ezért a DB-first rolloutot restored stagingben a régi és az
  új klienssel is igazolni kell, majd a v3.51.5 klienst közvetlenül utána kell
  kiadni.
- **BIZONYÍTOTT kliensvédelem:** egy TypeScript-AST contract a teljes elérhető
  browser forrásban tiltja a túl széles/nem literális `profiles` projectiont és
  a közvetlen insert/upsert/delete hívásokat. A `CapacityFit` csak pontosan egy
  normalizált `display_name` találat esetén egyeztet. A duplikált, üres és csak
  emailként érkező identitások unmatched állapotban maradnak, a tervezett órák
  egyszer számítódnak, browser profile emailt pedig nem kér és nem jelenít meg.
- **BIZONYÍTOTT típus/provenance korlát:** a három új publikus RPC —
  `get_my_profile_locale_v1`, `update_my_workspace_profile_display_name_v1` és
  `get_workspace_member_milestones_v1` — még nincs benne a generált
  [`types.ts`](../../src/integrations/supabase/types.ts) állományban; a kliensek
  addig explicit, szűk lokális szerződést használnak. A generált típus csak a
  migration-history/schema provenance drift helyreállítása után regenerálható
  hitelesen; kézi „generated” típusmódosítás nem elfogadható bizonyíték.
- **BIZONYÍTOTT a candidate UI-ban:** a mérföldkő dátuma szerveren és kliensen a
  workspace timezone-ját használja. A widget focus/visibility resume után órát
  frissít, tenantváltáskor eldobja a régi választ, és szemantikus loading/error/
  retry/empty állapotokat ad. A locale és workspace override hidratálás külön
  generációs guarddal nem enged előző account- vagy tenant-adatot visszaírni.
- **BIZONYÍTOTT rollout- és rollback-szerződés:** először a javított
  migration-historyn kell a v3.51.5 migrációt alkalmazni és az RPC/RLS/column ACL
  contractot ellenőrizni, utána azonnal ki kell adni a közös web/Android/iOS
  bundle-t. Ez kontrollált/maintenance rollout: a cached régi kliens raw
  preferences olvasása adatvédelmileg fail-closed, de a widget funkcionálisan
  kiesik. Hiba esetén először a kliens rolloutját kell megállítani; az adatvédelmi
  RLS/ACL szigorítás nem lazítható vissza csendben. A jelenlegi schema drift, hiányzó
  generated-type provenance és staging bizonyíték miatt a production rollout
  **NO-GO**.

### Atomi workspace-member profil adapter (v3.51.6 candidate)

- **BIZONYÍTOTT a candidate forrásban:** web, Android és iOS ugyanazt a
  [`workspaceMemberProfileApi.ts`](../../src/lib/workspaceMemberProfileApi.ts)
  read/save adaptert és ugyanazt a publikus Supabase klienst használja. Nincs
  külön mobil adatbázis, privileged key, platformfüggő üzleti API vagy nyers
  táblás fallback.
- **BIZONYÍTOTT a candidate migrációban:**
  `get_workspace_member_profile_edit_snapshot_v1` egy PostgreSQL statementből
  adja az editable membership, office, role allocation, revision és self-only
  display-name állapotot. `save_workspace_member_profile_v1` ugyanazt a teljes
  snapshotot egy tranzakcióban menti és egy minimalizált audit receiptet ír.
- **BIZONYÍTOTT konkurenciavédelem:** a server-managed `profile_revision`, exact
  self-name baseline, advisory/sorzárak és permission/entitlement recheck a késői
  vagy párhuzamos mobil/web írást reload-required conflictként állítja meg. Az
  abort csak kliensoldali várakozást szakít meg; a szervertranzakció biztonságát a
  revision és az atomi commit/rollback adja.
- **BIZONYÍTOTT tenant- és inputhatár:** cross-tenant office/allocation,
  inaktív target/actor, hiányzó `members:edit` vagy `members_list`, több mint 20
  szerep, malformed text/decimal és új snapshotnál a nem 100 százalék vagy nem
  pontosan egy priority fail-closed. A régi, hibásan részleges allocation
  snapshot olvasható marad javításhoz, de nem menthető vissza érvényesítés nélkül.
- **BIZONYÍTOTT UI-lifecycle:** load hiba nem válik üres írható profillá; timeout,
  abort, tenantváltás, unmount, double submit, zero-row CAS és lock conflict
  lokalizált, adatmegőrző állapotot ad mind a nyolc locale-ban. Siker után minden
  mount authoritative member-refetch-et végez.
- **BIZONYÍTOTT helyi regresszió:** runner 15/15, pinned PG18 atomic contract és
  négy legacy DB suite PASS; focused UI/client/Edge-writer 208/208, teljes
  coverage 70 fájl és 896/896 teszt, typecheck, production build/bundle, Edge,
  secret/schema/dependency kapuk PASS; mobile source 183/183, synced artifact
  345/345, bridge E2E 2/2 és tracked native drift 0. Ez nem production vagy
  fizikai-device bizonyíték.
- **BIZONYÍTOTT rollout-korlát:** a DB-migráció, PostgREST schema-cache és exact
  RPC/ACL/constraint inventory kerül ki először, utána azonos commitból a web,
  Android és iOS kliens. A history driftből levezetett 59 shared / 69 local-only /
  84 remote-only állapot, a hiányzó hiteles generated types és a restored-staging
  adat-inventory miatt production **NO-GO**. A direct `BusinessRoleManager`
  total/priority tranzakciós invariantjai külön következő P1 csomag.

## Alkalmazásidentitás és platform ownership

- **VALÓSZÍNŰ:** a javasolt Android Application ID és iOS Bundle ID
  `app.effectime`; a megjelenített név `Effectime`
  ([`capacitor.config.ts`](../../capacitor.config.ts),
  [`android/app/build.gradle`](../../android/app/build.gradle),
  [`ios/App/App.xcodeproj/project.pbxproj`](../../ios/App/App.xcodeproj/project.pbxproj)).
- **VALÓSZÍNŰ:** a jelenlegi custom URL scheme szintén `app.effectime`, így az
  auth callback alap-URI-ja pontosan:

  ```text
  app.effectime://auth/callback
  ```

- **BIZONYTALAN / NO-GO:** az `app.effectime` azonosító App Store Connect- és
  Google Play Console-foglalása nem bizonyított. Production signing vagy külső
  terjesztés előtt mindkét store-ban, a megfelelő jogi tulajdonos accountjában
  ellenőrizni és lefoglalni kell.
- **BIZONYÍTOTT:** publikálás után az alkalmazásazonosító megváltoztatása új
  alkalmazásidentitást jelenthet. Ezért az ID-t csak explicit release-döntéssel
  szabad módosítani.
- **BIZONYÍTOTT:** az `android/` és `ios/` könyvtárak review-zandó
  termékforrások, nem egyszer használatos build outputok. A teljes natív,
  CI-, teszt- és dokumentációs csomag külön candidate commitokban rögzítve van.
- **BIZONYÍTOTT:** a `cap sync` által kezelt plugin- és webasset-fájlok mellett a
  manifest, entitlements, signing, privacy és store-verzió beállítások platform
  source-of-truthként is működnek. Minden sync után a natív diffet is review-zni
  kell.
- **BIZONYÍTOTT:** keystore, certificate, `.p12`, provisioning profile,
  `local.properties` és signing-property nem kerülhet gitbe; a root
  [`.gitignore`](../../.gitignore) ezeket kizárja.

## Toolchain

### Közös

- **BIZONYÍTOTT:** Node.js `>=22.9.0` és npm `11.13.0` szükséges
  ([`package.json`](../../package.json)).
- **BIZONYÍTOTT:** a Capacitor runtime/platform csomagok és a CLI exact verzióra
  vannak rögzítve. A jelenlegi foundation Capacitor `8.3.1`-et használ; az App és
  Browser pluginok verziója a lockfile source-of-truthja.
- **BIZONYÍTOTT:** a natív Supabase session adapter exact-pinned
  `@aparajita/capacitor-secure-storage@8.0.0` csomagot használ (MIT). Androidon
  AndroidKeyStore-backed AES-GCM, iOS-en Keychain `whenUnlockedThisDeviceOnly`
  és kikapcsolt Keychain-szinkronizáció a szerződés. A dependency egy
  maintainerhez kötődő supply-chain kockázat; az exact lock/integrity, npm audit,
  SBOM és plugin-allowlist ezért kötelező.
- **BIZONYÍTOTT:** kizárólag publikus Supabase klienskonfiguráció másolható
  `.env.local` fájlba.

```powershell
Copy-Item .env.example .env.local
npm ci
npm run typecheck
npm run mobile:check:source
```

Unix shellben az első parancs megfelelője:

```sh
cp .env.example .env.local
```

### Android Windows/macOS/Linux

- **BIZONYÍTOTT:** a projekt minimum API 24-et, compile/target API 36-ot és a
  repositoryban rögzített Gradle wrappert használ
  ([`variables.gradle`](../../android/variables.gradle),
  [`gradle-wrapper.properties`](../../android/gradle/wrapper/gradle-wrapper.properties)).
- **BIZONYÍTOTT:** Android Studio, Android SDK platform 36, build-tools, egy API
  24+ emulator vagy fizikai eszköz szükséges. A signing nélküli debug build nem
  bizonyít store-release képességet.

```powershell
npm run mobile:sync:android
npm run mobile:open:android
Push-Location android
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug --no-daemon
Pop-Location
```

macOS/Linux terminálon:

```sh
npm run mobile:sync:android
cd android
./gradlew testDebugUnitTest lintDebug assembleDebug --no-daemon
```

### iOS kizárólag macOS-en

- **BIZONYÍTOTT:** a generált projekt iOS 15.4 minimumot és Swift Package Managert
  használ ([`Package.swift`](../../ios/App/CapApp-SPM/Package.swift)).
- **BIZONYÍTOTT:** Capacitor 8-hoz Node 22+, Xcode 26+ és Xcode Command Line Tools
  szükséges. Windows alatt az iOS-projekt forrása előkészíthető, de fordítása,
  signingja és készülékes validációja nem igazolható.
- **BIZONYÍTOTT:** hosted Xcode 26.5 feloldotta a commitolt SwiftPM gráfot,
  drift nélkül lefordította az unsigned generic simulator alkalmazást.
- **BIZONYÍTOTT:** a sync utáni normalizáló kapu a Windows által generált `\`
  SPM útvonalakat determinisztikus `/` formára alakítja. A hosted Xcode által
  generált `Package.resolved` review-ja megtörtént és a candidate részeként
  commitolt; a két pin exact forrása, verziója és tagrevíziója allowlistelt.

```sh
npm ci
npm run mobile:sync:ios
npm run mobile:open:ios
xcodebuild \
  -resolvePackageDependencies \
  -project ios/App/App.xcodeproj \
  -scheme App
npm run mobile:check:release
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -onlyUsePackageVersionsFromResolvedFile \
  CODE_SIGNING_ALLOWED=NO \
  build
```

## Build és sync parancsok

| Parancs                       | Bizonyított feladat                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run build:mobile`        | Külön CSP-hardened `dist-mobile` artifact előállítása a közös React forrásból.            |
| `npm run mobile:check:source` | Buildfüggetlen clean-checkout forrás-, identity-, auth- és CI-szerződéskapu.               |
| `npm run mobile:check`        | Kötelező build/sync artifact, CSP, plugin és teljes fájdfa SHA-256 kapu.                   |
| `npm run mobile:check:release`| A fentieken túl commitolt natív forrást és review-zott iOS dependency lockot követel.     |
| `npm run test:e2e:mobile`     | Friss mobile build, majd bridge-emulált landing/auth secure-store/CSP smoke.               |
| `npm run test:e2e:mobile:built` | Már review-zott build E2E-je; CI-ben használható új build nélkül.                       |
| `npm run mobile:sync`         | Mobile build, majd ugyanazon artifact Android+iOS szinkronja.                             |
| `npm run mobile:sync:android` | Mobile build és kizárólag Android sync.                                                   |
| `npm run mobile:sync:ios`     | Mobile build és kizárólag iOS sync; érdemi release-validáció macOS-en szükséges.          |
| `npm run mobile:open:android` | Az Android projekt megnyitása Android Studióban.                                          |
| `npm run mobile:open:ios`     | Az iOS projekt megnyitása Xcode-ban; csak macOS-en használható.                           |

- **BIZONYÍTOTT:** `mobile:sync*` futtatás előtt a Vite build beégeti a kiválasztott
  publikus backendkonfigurációt. Ugyanahhoz a release-hez Android és iOS alatt
  ugyanazt az ellenőrzött környezeti profilt kell használni.
- **BIZONYÍTOTT:** a majdani production candidate a csomagolt `dist-mobile`
  artifactot használja. A
  `server.url`, `cleartext` vagy távoli live-reload URL visszaállítása nem
  elfogadható production rollback.

## Secure session storage és natív CSP

### Supabase session storage

- **BIZONYÍTOTT:** weben a meglévő `localStorage` kompatibilitás marad; natív
  runtime-ban a Supabase kizárólag az OS secure store adaptert kapja
  ([`nativeAuthStorage.ts`](../../src/lib/platform/nativeAuthStorage.ts)). Nincs
  localStorage- vagy memóriás fallback secure-store hiba esetén.
- **BIZONYÍTOTT:** az explicit stabil storage key
  `sb-<VITE_SUPABASE_PROJECT_ID>-auth-token`; csak a session,
  `-code-verifier` és `-user` kulcs engedélyezett. Custom Supabase domain mellett
  is a konfigurált project ID tartja stabilan az identitást.
- **BIZONYÍTOTT:** a három nyers Supabase-string egy verziózott, projecthez kötött
  envelope-ban tárolódik. Minden read-modify-write mutex alatt fut, és a cache
  csak byte-azonos secure write/readback után frissül.
- **BIZONYÍTOTT:** legacy natív localStorage migrációnál a secure commit és
  visszaolvasás megelőzi a legacy törlést. Hiba esetén nincs csendes tokenvesztés
  vagy gyengébb fallback. Secure/legacy konfliktusban a secure állapot az
  autoritatív.
- **BIZONYÍTOTT kódban és tesztben; BIZONYTALAN készüléken:** mivel az iOS
  Keychain túlélheti az uninstallt, sandbox install
  marker védi az újratelepítést: marker nélküli, migrálható legacy állapot nélküli
  régi session törlődik, és új login szükséges.
- **BIZONYÍTOTT:** a Supabase auth lock szerződése támogatja a `0 ms`
  non-blocking auto-refresh próbát (`isAcquireTimeout`), így normál lock-verseny
  nem aktiválja tévesen a recovery UI-t.
- **BIZONYÍTOTT:** storage/config/migrációs hiba blokkoló, kétnyelvű fail-closed
  képernyőt ad biztonságos hibakóddal. A helyi session törlése kétlépcsős
  megerősítést igényel; token, plugin- vagy OS-részlet nem kerül a logba.
- **BIZONYÍTOTT:** explicit reset kezdetétől reloadig minden késői auth-írás
  blokkolt. Minden legacy tokenkulcs külön törlési kísérletet kap; a verified
  üres secure envelope autoritatív tombstone-ként megakadályozza a stale legacy
  session újramigrálását. Secure delete-fallback csak tartós pending marker vagy
  bizonyítottan teljes legacy-törlés mellett engedélyezett.
- **BIZONYÍTOTT:** hálózati/5xx logout hiba nem látszik sikernek: az eredményt a
  kliens ellenőrzi, az összes helyi Supabase credentialt egy validált mutációban
  törli, majd a távoli revokáció hibáját felhasználói warningként jelzi.

### WebView Content Security Policy

- **BIZONYÍTOTT:** a mobile build a validált Supabase HTTPS originből állít elő
  exact `connect-src` HTTPS/WSS allowlistet. Nincs wildcard Supabase,
  `unsafe-eval` vagy script `unsafe-inline`.
- **BIZONYÍTOTT:** a natív indexből kimarad a webes JSON-LD, `noscript`, manifest,
  service-worker és preconnect tartalom. Néhány platform-meta megmarad; a webes
  `dist` SEO/PWA artifactja ettől nem változik.
- **BIZONYÍTOTT:** a mobil shell csak külső module scriptet enged; style
  `unsafe-inline` a meglévő React/chart inline style szerződés miatt marad.
  **KÖZEPES ADATVÉDELMI ADÓSSÁG:** a Google Fonts külső hálózati függőség, az
  `img-src https:` pedig minden HTTPS képforrást enged a tenant-branding miatt;
  self-hosted font és validált image proxy/allowlist külön hardening csomag.
- **BIZONYÍTOTT:** `mobile:check` a `dist-mobile`, Android és iOS teljes relatív
  fájdfáját és minden fájl SHA-256 hashét összehasonlítja, ellenőrzi a CSP-t, a
  web-only assetek hiányát, valamint az exact Android/iOS plugin allowlistet. A
  transitive Capacitor Keyboard egyik platformon sincs regisztrálva.
- **BIZONYÍTOTT lokálisan, készüléken még BIZONYTALAN:** Playwright Android
  bridge-emulációban a landing és auth 2/2 zöld, nulla CSP-, konzol-, oldal- vagy
  **lokális** asset hibával. A teszt nem állítja, hogy minden külső font/kép
  elérhető; valódi Android WebView és iOS WKWebView smoke továbbra is release-kapu.

## Auth, PKCE, system browser és deep link

### Megvalósult folyamat

- **BIZONYÍTOTT:** natív platformon a Supabase kliens PKCE flow-t használ,
  kikapcsolja az automatikus URL-session detektálást, és az App lifecycle alapján
  indítja/leállítja a token auto-refresh-t
  ([`client.ts`](../../src/integrations/supabase/client.ts),
  [`MobileRuntimeBridge.tsx`](../../src/components/mobile/MobileRuntimeBridge.tsx)).
- **BIZONYÍTOTT:** Google OAuth esetén a kliens `skipBrowserRedirect` módban kéri
  az authorization URL-t, csak a konfigurált Supabase HTTPS originen lévő
  `/auth/v1/authorize` útvonalat fogadja el, majd a Capacitor Browser pluginban
  nyitja meg ([`Auth.tsx`](../../src/pages/Auth.tsx)).
- **BIZONYÍTOTT:** cold start esetén `getLaunchUrl`, futó alkalmazásnál
  `appUrlOpen` továbbítja a callbacket. A bridge a PKCE code-ot
  `exchangeCodeForSession` hívással váltja sessionre, deduplikálja a rövid időn
  belüli ismétlést, és csak allowlistelt belső route-ra navigál.
- **BIZONYÍTOTT:** a natív callback kizárólag PKCE authorization code-ot fogad.
  Bármely custom-scheme vagy canonical HTTPS link `access_token` vagy
  `refresh_token` paraméterét — az általános `/auth` route-on is — fail-closed
  elutasítja, mert az
  implicit fallback login-CSRF/session-swap kockázatot jelentene. A webes legacy
  implicit callback kompatibilitása ettől változatlan marad.
- **BIZONYÍTOTT:** recovery callbacknél a bridge csak sikeres kódcserét követően,
  belső router-state-tel jelöli a jelszó-visszaállítási szándékot; a reset oldal
  emellett meglévő sessiont is ellenőriz.
- **BIZONYÍTOTT:** a PWA service worker és install prompt natív runtime-ban nem
  indul el, így nem hoz létre a WebView-ben külön webes cache-életciklust
  ([`registerSW.ts`](../../src/lib/pwa/registerSW.ts),
  [`InstallPwaPrompt.tsx`](../../src/components/pwa/InstallPwaPrompt.tsx)).

### Supabase URL-konfiguráció

- **VALÓSZÍNŰ:** a production Supabase **Site URL** értéke:

  ```text
  https://effectime.app
  ```

- **BIZONYÍTOTT a kódban, külső dashboardban BIZONYTALAN:** a Supabase
  Authentication → URL Configuration → **Redirect URLs** listába pontosan ezt a
  callback-prefixet kell felvenni. A szűk suffix-glob azért szükséges, mert a
  kliens ugyanazon a fix host/path értéken `flow` és allowlistelt belső
  `redirect` query paramétert ad át, a Supabase pedig hibát vagy PKCE-kódot fűz
  hozzá:

  ```text
  app.effectime://auth/callback**
  ```

  Ne kerüljön mellé `capacitor://localhost`, Lovable preview URL, más host/path
  vagy általános scheme wildcard. A production allowlistet a
  [Supabase redirect URL dokumentáció](https://supabase.com/docs/guides/auth/redirect-urls)
  alapján kell felvenni és stagingben igazolni.

- **BIZONYTALAN / NO-GO:** a redirect tényleges felvétele és end-to-end működése
  a kiválasztott production Supabase projektben nincs bizonyítva.
- **BIZONYÍTOTT:** a Google provider konzolban használt provider callback nem a
  custom scheme. Annak a kiválasztott Supabase projekt HTTPS callbackjére kell
  mutatnia:

  ```text
  https://<project-ref>.supabase.co/auth/v1/callback
  ```

  A `<project-ref>` csak a tényleges production project inventoryból vehető át;
  nem található ki és nem helyettesíthető staging értékkel.

### Verified HTTPS link célállapot

- **BIZONYÍTOTT:** a JavaScript parser elő van készítve a canonical
  `https://effectime.app/auth/mobile-callback` és allowlistelt HTTPS alkalmazáslinkek
  fogadására.
- **BIZONYÍTOTT:** a jelenlegi natív manifestek csak az `app.effectime` custom
  scheme-et regisztrálják. Android `autoVerify` App Link, iOS Associated Domains,
  `assetlinks.json` és `apple-app-site-association` még nincs kész.
- **BIZONYTALAN / NO-GO:** verified link csak az Apple Team ID, a végleges Bundle
  ID, az Android release/Play signing certificate SHA-256 fingerprint és a
  production domain ownership ismeretében aktiválható.
- **VALÓSZÍNŰ:** a verified HTTPS callback a hosszú távú biztonságos cél, mert a
  custom scheme-et más alkalmazás is megpróbálhatja regisztrálni. Átálláskor a
  custom scheme-et csak explicit kompatibilitási időablakban szabad fenntartani.

## CI és validáció

### Kötelező merge gate

```sh
npm ci
npm run security:secrets
npm run mobile:check:source
npm run typecheck
npx vitest run src/test/internalPath.test.ts src/test/mobileFoundation.test.ts src/test/mobileRuntimeBridge.test.tsx src/test/publicRuntime.test.ts src/test/nativeAuthStorage.test.ts src/test/mobileCsp.test.ts src/test/authStorageRecovery.test.tsx
npm run test:coverage
npm run build
npm run bundle:check
npm run test:e2e:built
npm run mobile:sync
npm run mobile:check
npm run test:e2e:mobile:built
```

- **BIZONYÍTOTT:** a mobil unit/contract suite ellenőrzi az origin-normalizálást,
  open-redirect védelmet, PKCE callbacket, az implicit-token callback tiltását,
  recovery state-et, cold/warm startot, callback-deduplikációt, Supabase OAuth URL
  allowlistet, production-safe Capacitor configot és a PWA/native elválasztást
  ([`mobileFoundation.test.ts`](../../src/test/mobileFoundation.test.ts),
  [`mobileRuntimeBridge.test.tsx`](../../src/test/mobileRuntimeBridge.test.tsx),
  [`nativeAuthStorage.test.ts`](../../src/test/nativeAuthStorage.test.ts),
  [`mobileCsp.test.ts`](../../src/test/mobileCsp.test.ts),
  [`authStorageRecovery.test.tsx`](../../src/test/authStorageRecovery.test.tsx),
  [`publicRuntime.test.ts`](../../src/test/publicRuntime.test.ts) és
  [`internalPath.test.ts`](../../src/test/internalPath.test.ts)).
- **BIZONYÍTOTT I-25 baseline:** a célzott eredmény 93/93 sikeres teszt; a
  `mobile:check:source` 183/183, a build/sync utáni `mobile:check` 343/343
  fail-closed assertionnel volt zöld. A 4 077 modulos mobile build, a 2/2 natív
  E2E és mindkét `cap sync` szintén sikeres volt azon a candidate-en. Az I-26
  aktuális, magasabb 345 pontos eredményét a Release-döntés szakasz rögzíti.
- **BIZONYÍTOTT / I-25 TÖRTÉNETI PASS KORLÁTTAL:** a helyi Windows Android
  `testDebugUnitTest lintDebug assembleDebug --no-daemon --stacktrace` lánc a
  telepített Android Studio SDK-val 3 perc 42 másodperc alatt 276 taskot futtatott,
  `BUILD SUCCESSFUL` eredménnyel. Nincs új lint finding; a debug APK 6 049 206
  byte, SHA-256 `EFA6125663E4D0BFF4EE02C2A318C5D90F9A22DE0F90041C3339FF8AF61F05D7`.
  Az app és a bevont pluginok unit taskjai `NO-SOURCE`, ezért ez fordítási,
  lint- és csomagolási bizonyíték, nem natív unit vagy készülékes lefedettség.
- **BIZONYÍTOTT forrásban:** a commitolt általános quality workflow
  Node 22-n az alábbi kapuk futtatására van konfigurálva: dependency
  auditot, secret scant, `mobile:check` contractot, typechecket, coverage suite-ot,
  buildet, bundle-kaput és böngészős smoke teszteket
  ([`quality.yml`](../../.github/workflows/quality.yml)).
- **BIZONYÍTOTT hosted futásban:** a v3.51.4 / I-26
  [#175 PR](https://github.com/HenrikFaul/effectime-app-enterprise-a95029a1/pull/175)
  integrált main SHA-ja `f52671880748c58802d94e0705204d846f4b5928`. A hozzá
  tartozó main quality run `29682829301` 8/8 jobja zöld, beleértve a hosted
  Android- és iOS-kaput. A release evidence artifact ID-ja `8441138073`, az
  Android artifact ID-ja `8441127446`.
- **BIZONYÍTOTT korlátozás:** a hosted artifactok fordítási, contract- és
  provenance-bizonyítékok; nem aláírt store artifactok, nem fizikai készülékes
  acceptance evidence-ek, és nem bizonyítják, hogy production deploy történt.
- **BIZONYÍTOTT:** a böngészős E2E és a statikus mobil contract nem helyettesíti
  a Gradle-, Xcode-, emulator- vagy fizikai eszköztesztet.

### Kötelező natív release evidence

- **BIZONYÍTOTT:** `npm run mobile:check:release` clean, commitolt candidate
  forráson 363/363 PASS. A lock kizárólag `capacitor-swift-pm` 8.3.1 és
  `keychain-swift` 21.0.0 tageket enged, exact upstream URL-lel és revízióval.

- **BIZONYÍTOTT:** a lokális és a lockos candidate hosted Android
  compile/lint/debug build zöld; az app/plugin Java unit taskok továbbra is
  `NO-SOURCE`, az emulatoros/fizikai smoke nyitott.
- **BIZONYÍTOTT:** GitHub `macos-26-arm64`, Xcode 26.5 alatt az unsigned iOS
  simulator build ugyanazon PR candidate-en zöld, exact committed lockkal.
- **BIZONYÍTOTT korlátozás:** az M365 webes `auth_url` redirect nincs natív
  system-browser callback és allowlistelt visszatérés mögé integrálva. Natív
  runtime-ban a Connect vezérlő ezért fail-closed módon tiltott, a handler is
  megáll, és mind a nyolc támogatott locale lokalizált korlátozásüzenetet ad.
  A natív OAuth-paritás külön, state-kötött fejlesztési csomag marad.
- **NO-GO, amíg nincs bizonyítva:** legalább egy támogatott fizikai Android- és
  iOS-eszközön az alábbi smoke:
  - első indítás, login, logout és session restore;
  - Google PKCE system-browser round-trip cold és warm startból;
  - signup-verifikáció, password recovery, meghívó és workspace deep link;
  - workspace-váltás és negatív tenant/RBAC hozzáférési próbák;
  - háttér/előttér váltás és token refresh;
  - offline/reconnect hibaállapot adatduplikáció nélkül;
  - admin override transport-loss/timeout, process-kill és restart után ugyanaz
    a v2 kulcs, egyetlen request/approval/quota/audit side-effect és sikeres
    receipt-cleanup; Web Crypto UUID/SHA-256 capability mindkét WebView-ban;
  - soft keyboard, safe area, Android back, rotáció;
  - GPS engedélyezés/elutasítás és clock-in, ha a funkció része a mobil scope-nak;
  - CSV/export letöltés vagy natív megosztás, külső linkek és clipboard.
- **BIZONYÍTOTT:** minden store artifacthoz rögzíteni kell a git SHA-t, web bundle
  hash-t, Capacitor/npm lock hash-t, natív versionCode/build numbert, signing
  certificate fingerprintet és a lefuttatott tesztek eredményét.

## Store release kapuk — NO-GO

| Blokkoló                          | Jelenlegi bizonyosság                                                                                                    | GO feltétel                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Biztonságos session storage       | **BIZONYÍTOTT kódban:** Keychain/AndroidKeyStore adapter, crash-safe migráció, reset latch, verified üres secure tombstone, logout fallback és fail-closed recovery kész; 17 storage + 4 auth/recovery teszt zöld. A reviewed iOS dependency lock commitolt. **BIZONYTALAN készüléken.** | Valódi Android/iOS session migrate/restart/uninstall/logout, OS-lock és reprezentatív tokenméret teszt. |
| Candidate provenance             | **BIZONYÍTOTT v3.51.4 / I-26:** PR #175, main SHA `f52671880748c58802d94e0705204d846f4b5928`, run `29682829301` 8/8; release evidence artifact `8441138073`, Android artifact `8441127446`. **BIZONYÍTOTT korlát:** ez nem production deploy vagy aláírt store release. | A kapuk required-checkként fenntartva; signed/store artifactnál SHA és signing provenance. |
| Backend schema/API kompatibilitás | **BIZONYÍTOTT kódban:** az I-26 v2 additív és a v1-et változatlanul tartja; lokális PG18 v1/v2 smoke zöld. **v3.51.5–3.51.6 CANDIDATE:** a 127–128. lokális migráció restrictive profile RLS/update guardot, catalog-driven column revokot, self-locale/self-profile/milestone és atomi member-profile read/save RPC-ket ad, közös adapterekkel. A candidate RPC-k/generated `profile_revision` hiánya, az 59/69/84 migration drift és a régi raw-preferences kliens funkcionális törése miatt nincs restored-staging vagy production bizonyíték. | Controlled DB-first restored-staging; exact RPC/RLS/column-ACL/FK/CHECK catalog; AST caller kapu; régi kliens fail-closed smoke; új web/Android/iOS kliens smoke; hiteles típusregenerálás; immediate client rollout és privacy-preserving rollback. |
| App ID és store reservation       | **VALÓSZÍNŰ:** `app.effectime` a cél; **BIZONYTALAN:** nincs bizonyított foglalás.                                       | App Store Connect és Play Console reservation a jóváhagyott jogi accountban.                                                        |
| Signing ownership                 | **BIZONYÍTOTT:** nincs review-zott production Android signing config vagy iOS Team ID/provisioning.                      | CI secret ownership, Play App Signing, Apple Team/certificate/profile, rotációs és recovery runbook.                                |
| Supabase redirect/provider config | **BIZONYÍTOTT a kódban, BIZONYTALAN külső állapotban.**                                                                  | Az exact host/path-prefixet engedő `app.effectime://auth/callback**`, production Site URL és Google/Supabase provider callback staging+production E2E bizonyítéka. |
| Verified HTTPS links              | **BIZONYÍTOTT:** még nincs AASA/assetlinks, Associated Domains vagy Android `autoVerify`.                                | Domain association deploy, release certificate fingerprint, OS-verifikáció és cold/warm link teszt.                                 |
| Final brand assetek               | **BIZONYÍTOTT:** a generált platformprojektekben még Capacitor template ikon/splash van; ez dokumentált átmeneti asset, nem végleges Effectime branding. | Jóváhagyott 1024×1024 iOS ikon, Android adaptive/round ikon, splash, store screenshot és minden szükséges méret vizuális QA-val.    |
| iOS macOS compile                 | **BIZONYÍTOTT:** hosted Xcode 26.5 locked resolve, drift check és unsigned simulator `BUILD SUCCEEDED`. | Signinggal végzett archive/TestFlight próba és készülékteszt. |
| Fizikai készülék smoke            | **BIZONYÍTOTT:** nincs átadott device evidence.                                                                          | A fenti acceptance checklist Androidon és iOS-en, valós production-szerű auth konfigurációval.                                      |
| Native CI                         | **BIZONYÍTOTT v3.51.4 / I-26:** main run `29682829301` 8/8, benne Android és iOS; release evidence artifact `8441138073`, Android artifact `8441127446`. | Required check, retention és protected-branch enforcement; signed release külön kapu. |
| Privacy és engedélyek             | **BIZONYÍTOTT:** a termék GPS-t használhat; a generated platform permission/privacy szerződés nem teljes.                | Minimális permissionök, indoklószöveg, iOS privacy manifest/App Privacy, Android Data Safety, GDPR retention/export/delete review.  |
| WebView/adatvédelem               | **BIZONYÍTOTT kódban:** `allowBackup=false`, `usesCleartextTraffic=false`, exact-origin mobil CSP, web/native artifact-szétválasztás és token/PII log scan kész; 2/2 bridge-emulált E2E zöld. **KÖZEPES:** külső Google Fonts és széles HTTPS image policy marad. | Self-hosted font vagy jóváhagyott privacy döntés; image proxy/allowlist; Android WebView+iOS WKWebView fizikai CSP/auth/realtime/export smoke. |
| M365 natív OAuth                  | **BIZONYÍTOTT korlátozás:** a webes redirect útvonal nincs natív Browser/app-link flow-ba integrálva; natív runtime-ban a Connect vezérlő és handler fail-closed feature-gated, lokalizált üzenettel. | Ha a mobil launch scope része: state-kötött system-browser callback, allowlist, cold/warm E2E és fizikai teszt. Egyébként product owner által jóváhagyott, release note-ban rögzített ismert korlátozás. |

Egyik blokkoló sem oldható fel dokumentációs kijelentéssel; minden GO feltételhez
konkrét store-, CI-, konfiguráció- vagy készülékteszt-bizonyíték szükséges.

## Külön deferred fejlesztési csomagok

### Push notification

- **BIZONYÍTOTT:** APNs/FCM push nincs a foundation release scope-jában.
- **BIZONYTALAN:** a notification use case-ek, tenant policy, felhasználói consent,
  quiet hours, badge és retention termékdöntést igényelnek.
- **Külön csomag feltétele:** APNs/FCM credential ownership, device-token
  lifecycle és kijelentkezéskori törlés, tenant/RLS védelem, idempotens backend
  delivery, permission UX, deep-link allowlist és fizikai eszközteszt.

### 14 napos offline működés

- **BIZONYÍTOTT:** a jelenlegi PWA cache nem 14 napos offline üzleti adattár és
  nem tartalmaz offline write queue-t.
- **BIZONYTALAN:** pontosan mely adatok olvashatók/módosíthatók offline, melyik
  konfliktusstratégia érvényes, és mi történik tenant- vagy jogosultságváltáskor.
- **Külön csomag feltétele:** titkosított helyi adatbázis, tenant/user partition,
  TTL és távoli wipe/logout törlés, változásnapló, idempotens sync, konfliktus- és
  clock-skew szabályok, schema migration, terhelési és adatvesztési tesztek.
- **BIZONYÍTOTT:** 14 napos offline írást nem szabad service worker cache-re vagy
  hallgatólagos last-write-wins fallbackre építeni.

### Biometrikus feloldás

- **BIZONYÍTOTT:** biometrikus plugin és policy nincs a foundationben.
- **VALÓSZÍNŰ:** a biometria helyi Keychain/Keystore secret feloldására
  használható, de nem helyettesíti a Supabase identitást, tenant RBAC-ot vagy
  szerveroldali session revocationt.
- **Külön csomag feltétele:** secure storage előfeltétel, passcode fallback,
  enrollment-változás és lockout kezelés, MDM/enterprise policy, threat model,
  privacy disclosure és valódi készülékteszt.

## Kompatibilitás és rollback

- **BIZONYÍTOTT:** a web/PWA továbbra is a meglévő implicit callback utat és
  BrowserRouter/legacy hash kompatibilitást használja; a PKCE és system-browser
  ág natív runtime-ra van korlátozva.
- **BIZONYÍTOTT:** a backend schema, RLS, RPC és Edge Function szerződés közös.
  A mobil release nem jogosít breaking API- vagy adatmodell-változásra.
- **BIZONYÍTOTT:** a már telepített mobil binaryk a web deploynál lassabban
  frissülnek. A backendnek minden támogatott, még használatban lévő mobilverzió
  szerződésével kompatibilisnek kell maradnia, vagy explicit verziózott
  deprecáció/migráció szükséges.
- **BIZONYÍTOTT I-26 terv:** admin override rolloutnál a sorrend DB v2 → exact
  catalog/ACL/schema-cache és v1/v2 acceptance → új web/mobile artifact. Hiba
  esetén az új klienst kell először v1-re visszaállítani. A forward-only v2
  ledgert meg kell tartani, amíg akár egy v2 kliens is aktív; a DB rollback nem
  lehet az első lépés.
- **BIZONYÍTOTT v3.51.5 candidate terv:** a workspace-mérföldkő rollout sorrendje
  helyreállított migration-history → restored-staging régi/új kliens acceptance
  → kontrollált change window → profiles RLS/column ACL és RPC contract/schema-
  cache → azonnali új közös web/Android/iOS kliens. A régi raw
  `profiles.preferences` út permission hibája megakadályozza az adatszivárgást,
  de nem funkcionális fallback. Rollbackkor a kliens rollout áll le először; az
  adatvédelmi ACL-t nem szabad bizonyíték nélkül visszalazítani, az RPC pedig
  additívan megtartható a támogatott kliensek kifutásáig.
- **BIZONYÍTOTT:** store publikálás előtt a foundation kódja és a két natív
  projekt normál git reverttel visszaállítható; a közös Supabase adatot ez nem
  törölheti és migrációt nem fordíthat vissza automatikusan.
- **BIZONYÍTOTT:** store publikálás után az app ID nem rollback-eszköz. Hibás
  release esetén a rolloutot kell megállítani, javító binaryt kiadni, és ahol a
  store támogatja, az előző jó verzióhoz visszatérni.
- **BIZONYÍTOTT:** natív auth incidensnél tilos fallbackként production
  `server.url`-t, cleartextet, auth bypass-t vagy service-role kulcsot bevezetni.
  A biztonságos rollback a mobil rollout leállítása és a korábbi igazolt auth
  szerződés visszaállítása.
- **BIZONYÍTOTT:** a localStorage → Keychain/Keystore egyszeri, verziózott,
  write/readback-ellenőrzött migráció implementált. Sikertelen migráció vagy
  secure-store hiba blokkolja az authot; csendes tokenvesztés és gyengébb
  storage-fallback nincs.

## Release-döntés

- **BIZONYÍTOTT:** a repository alkalmas közös React/Supabase-alapú Android és
  iOS fejlesztés folytatására.
- **BIZONYÍTOTT:** a production-safe Capacitor identity/config, platformprojektek,
  PKCE/system-browser bridge, lifecycle-kezelés, secure session adapter, natív
  CSP és regressziós contract/E2E tesztek rendelkezésre állnak.
- **BIZONYÍTOTT v3.51.4 / I-26 main:** a közös v2 adapter/outbox a
  `f52671880748c58802d94e0705204d846f4b5928` SHA-n integrált. A main quality
  run `29682829301` 8/8 jobja — az Android- és iOS-kapuval együtt — sikeres; a
  release evidence artifact `8441138073`, az Android artifact `8441127446`.
  Ez a bizonyíték nem production deploy, nem signed/store release és nem
  kétplatformos fizikai transport-loss acceptance.
- **BIZONYÍTOTT v3.51.5 candidate forrásban:** a közös workspace-mérföldkő
  adapter/RPC ugyanazt az adatforrást adja a web, Android és iOS számára; a
  válasz pontosan membership ID, display name, típus, hónap és nap, user ID
  nélkül. A self-locale és self-only global-name RPC, AST caller contract és
  fail-closed profiles privacy határ ugyanebben a candidate-ben van.
- **BIZONYÍTOTT v3.51.5 candidate:** a tízfájlos focused suite 77/77,
  typecheck, build, reviewed bundle, `npm audit` és web smoke 7/7 PASS. A közös
  mobil forráskapu 183/183, az artifact contract 345/345, a bridge smoke 2/2 és
  a natív drift 0. A v3.51.5-tree full coverage 66 fájl és 727/727 teszt PASS;
  draft PR #176 run `29687248014` 9/9 hosted jobbal — Android és locked iOS
  compile-lal együtt — zöld. **NO-GO
  production deployra**, amíg a migration-history/schema drift nincs
  helyreállítva, a generált Supabase típus provenance nincs újra igazolva, a
  live release marker hiányzik, és a DB-first restored-staging régi/új kliens
  acceptance nem zöld.
- **BIZONYÍTOTT v3.51.6 lokális candidate:** az atomi member-profile read/save
  adapter és RPC ugyanazt a tenant- és konkurenciavédett adatforrást adja minden
  kliensnek; runner 15/15, PG18 + négy legacy DB, focused 208/208 és teljes
  coverage 896/896, mobile 183/345/2 és drift 0 PASS.
- **BIZONYÍTOTT:** a v3.51.4-en commitolt platformforrás, a v3.51.5–3.51.6
  candidate implementációk és a review-zott Swift dependency lock fejlesztési
  foundationként **GO**, de a
  store release **NO-GO** a signing/store és device kapuk nélkül.
  A következő legkisebb biztonságos csomag: signing/store ownership + verified
  links + kétplatformos fizikai secure-storage/CSP/auth smoke.
