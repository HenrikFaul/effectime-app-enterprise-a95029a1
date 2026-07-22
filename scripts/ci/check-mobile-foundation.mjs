import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const supportedArguments = new Set(["--release", "--source-only"]);
const unknownArguments = process.argv.slice(2).filter((argument) => !supportedArguments.has(argument));
if (unknownArguments.length > 0) {
  throw new Error(`Unsupported mobile check argument(s): ${unknownArguments.join(", ")}`);
}
const sourceOnly = process.argv.includes("--source-only");
const releaseMode = process.argv.includes("--release");
if (sourceOnly && releaseMode) throw new Error("--source-only and --release are mutually exclusive.");

const EXPECTED_APP_ID = "app.effectime";
const EXPECTED_APP_NAME = "Effectime";
const EXPECTED_WEB_DIR = "dist-mobile";
const EXPECTED_NODE_ENGINE = ">=22.9.0";
const MIN_ANDROID_SDK = 24;
const MIN_ANDROID_COMPILE_SDK = 36;
const MIN_ANDROID_TARGET_SDK = 36;
// Web Locks is a security boundary for the crash-safe admin leave override
// outbox. WebKit shipped it in iOS 15.4, so an older deployment target would
// advertise a runtime where this critical operation must always fail closed.
const MIN_IOS_DEPLOYMENT_TARGET = 15.4;
const REQUIRED_ENV_KEYS = [
  "VITE_PUBLIC_APP_ORIGIN",
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
];
const REQUIRED_CAPACITOR_PACKAGES = [
  "@aparajita/capacitor-secure-storage",
  "@capacitor/android",
  "@capacitor/app",
  "@capacitor/browser",
  "@capacitor/cli",
  "@capacitor/core",
  "@capacitor/ios",
];
const CORE_CAPACITOR_PACKAGES = [
  "@capacitor/android",
  "@capacitor/cli",
  "@capacitor/core",
  "@capacitor/ios",
];
const EXPECTED_IOS_SWIFT_PACKAGE_PINS = Object.freeze({
  "capacitor-swift-pm": Object.freeze({
    kind: "remoteSourceControl",
    location: "https://github.com/ionic-team/capacitor-swift-pm.git",
    version: "8.3.1",
    revision: "f1a8fadf1437c23b825c818fb6509c9dbbae2f61",
  }),
  "keychain-swift": Object.freeze({
    kind: "remoteSourceControl",
    location: "https://github.com/evgenyneu/keychain-swift.git",
    version: "21.0.0",
    revision: "265806607b45687a3d646e4c9837c31c90f202e8",
  }),
});

const failures = [];
let assertionCount = 0;

function assert(condition, message) {
  assertionCount += 1;
  if (!condition) failures.push(message);
}

function repositoryPath(relativePath) {
  return resolve(repositoryRoot, relativePath);
}

function readRequired(relativePath) {
  const path = repositoryPath(relativePath);
  if (!existsSync(path)) {
    assert(false, `Required file is missing: ${relativePath}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function parseJson(relativePath) {
  const source = readRequired(relativePath);
  if (!source) return null;

  try {
    return JSON.parse(source);
  } catch (error) {
    assert(
      false,
      `${relativePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function parseJsonWithComments(relativePath) {
  const source = readRequired(relativePath);
  if (!source) return null;
  const parsed = ts.parseConfigFileTextToJson(relativePath, source);
  if (parsed.error) {
    assert(false, `${relativePath} is not a valid TypeScript JSON config.`);
    return null;
  }
  return parsed.config;
}

function parseTypeScript(relativePath) {
  const source = readRequired(relativePath);
  if (!source) return null;
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  assert(
    sourceFile.parseDiagnostics.length === 0,
    `${relativePath} contains TypeScript syntax errors.`,
  );
  return sourceFile;
}

function propertyName(property) {
  if (!property.name) return null;
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
    return property.name.text;
  return null;
}

function staticString(expression) {
  return ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)
    ? expression.text
    : null;
}

function findObjectVariable(sourceFile, variableName, relativePath) {
  let object = null;
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === variableName &&
        declaration.initializer &&
        ts.isObjectLiteralExpression(declaration.initializer)
      ) {
        object = declaration.initializer;
      }
    }
  }
  assert(
    Boolean(object),
    `${relativePath} must declare ${variableName} as a static object literal.`,
  );
  return object;
}

function objectProperties(object, relativePath) {
  const properties = new Map();
  if (!object) return properties;

  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) {
      assert(
        false,
        `${relativePath} must not use spreads, methods or shorthand in the production config.`,
      );
      continue;
    }
    const name = propertyName(property);
    assert(Boolean(name), `${relativePath} contains a non-static property name.`);
    if (name) properties.set(name, property.initializer);
  }
  return properties;
}

function exactVersion(version) {
  return typeof version === "string" && /^\d+\.\d+\.\d+$/.test(version);
}

function majorVersion(version) {
  return exactVersion(version) ? Number(version.split(".", 1)[0]) : null;
}

function checkPackageContract() {
  const packageJson = parseJson("package.json");
  const packageLock = parseJson("package-lock.json");
  const eslintConfig = readRequired("eslint.config.js");
  if (!packageJson || !packageLock) return;

  assert(
    [
      '"dist-mobile"',
      '"android/**/build/**"',
      '"android/.gradle/**"',
      '"ios/**/build/**"',
      '"ios/**/DerivedData/**"',
    ].every((ignoredPath) => eslintConfig.includes(ignoredPath)),
    "ESLint must ignore generated native artifacts so quality results do not depend on prior Gradle/Xcode runs.",
  );

  assert(
    packageJson.engines?.node === EXPECTED_NODE_ENGINE,
    `package.json engines.node must be exactly ${EXPECTED_NODE_ENGINE}.`,
  );
  const [runtimeMajor, runtimeMinor] = process.versions.node.split(".").map(Number);
  assert(
    runtimeMajor > 22 || (runtimeMajor === 22 && runtimeMinor >= 9),
    `The mobile contract requires Node.js ${EXPECTED_NODE_ENGINE}; current runtime is ${process.versions.node}.`,
  );
  assert(
    packageJson.packageManager === "npm@11.13.0",
    "package.json must pin packageManager to npm@11.13.0.",
  );
  assert(
    packageJson.scripts?.["mobile:check"] === "node scripts/ci/check-mobile-foundation.mjs",
    "package.json must expose the canonical mobile:check script.",
  );
  assert(
    packageJson.scripts?.["mobile:check:source"] ===
      "node scripts/ci/check-mobile-foundation.mjs --source-only",
    "package.json must expose the artifact-independent mobile source contract.",
  );
  assert(
    packageJson.scripts?.["mobile:check:release"] ===
      "node scripts/ci/check-mobile-foundation.mjs --release",
    "package.json must expose the strict native release contract.",
  );
  assert(
    packageJson.scripts?.["build:mobile"] === "node scripts/mobile/build.mjs",
    "package.json must expose the CSP-hardened build:mobile script.",
  );
  assert(
    packageJson.scripts?.["mobile:sync"] ===
      "npm run build:mobile && cap sync && node scripts/mobile/normalize-native.mjs",
    "mobile:sync must synchronize the artifact and normalize generated native source.",
  );
  assert(
    packageJson.scripts?.["test:e2e:mobile"] ===
      "npm run build:mobile && npm run test:e2e:mobile:built",
    "The public mobile E2E command must build the exact artifact it tests.",
  );
  assert(
    packageJson.scripts?.["test:e2e:mobile:built"] ===
      "playwright test --config playwright.mobile.config.ts",
    "CI must expose a separate mobile E2E command for an already reviewed build.",
  );

  const declared = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };
  const coreVersion = declared["@capacitor/core"];
  assert(exactVersion(coreVersion), "@capacitor/core must use an exact stable semantic version.");

  for (const packageName of REQUIRED_CAPACITOR_PACKAGES) {
    const declaredVersion = declared[packageName];
    assert(
      exactVersion(declaredVersion),
      `${packageName} must use an exact stable semantic version.`,
    );
    assert(
      majorVersion(declaredVersion) === majorVersion(coreVersion),
      `${packageName} must use the same major version as @capacitor/core.`,
    );

    const lockedVersion = packageLock.packages?.[`node_modules/${packageName}`]?.version;
    assert(
      lockedVersion === declaredVersion,
      `${packageName} must resolve in package-lock.json to its exact declared version.`,
    );
  }

  for (const packageName of CORE_CAPACITOR_PACKAGES) {
    assert(
      declared[packageName] === coreVersion,
      `${packageName} must be exactly aligned with @capacitor/core (${coreVersion ?? "missing"}).`,
    );
  }

  for (const [packageName, version] of Object.entries(declared)) {
    if (!packageName.startsWith("@capacitor/")) continue;
    assert(
      exactVersion(version),
      `${packageName} must not use a range, tag or prerelease version.`,
    );
  }

  const secureStorageLock = packageLock.packages?.[
    "node_modules/@aparajita/capacitor-secure-storage"
  ];
  assert(
    secureStorageLock?.integrity ===
      "sha512-oYnwSjdIh23aRNgz8982+TmFvQH/2yZkEdw1iIg+H2ziFJoOVELPTc7u6Ez2HwOuDIW5AGqBX75GvrzQ+D70Qg==",
    "The reviewed secure-storage tarball integrity must remain exact.",
  );
}

function checkCapacitorConfig() {
  const relativePath = "capacitor.config.ts";
  const sourceFile = parseTypeScript(relativePath);
  if (!sourceFile) return;
  const configObject = findObjectVariable(sourceFile, "config", relativePath);
  const config = objectProperties(configObject, relativePath);

  assert(
    staticString(config.get("appId")) === EXPECTED_APP_ID,
    `Capacitor appId must be ${EXPECTED_APP_ID}.`,
  );
  assert(
    staticString(config.get("appName")) === EXPECTED_APP_NAME,
    `Capacitor appName must be ${EXPECTED_APP_NAME}.`,
  );
  assert(
    staticString(config.get("webDir")) === EXPECTED_WEB_DIR,
    `Capacitor webDir must be ${EXPECTED_WEB_DIR}.`,
  );
  assert(
    !config.has("server"),
    "Production capacitor.config.ts must not define server.url, cleartext or allowNavigation.",
  );

  const exportsConfig = sourceFile.statements.some(
    (statement) =>
      ts.isExportAssignment(statement) &&
      !statement.isExportEquals &&
      ts.isIdentifier(statement.expression) &&
      statement.expression.text === "config",
  );
  assert(exportsConfig, "capacitor.config.ts must default-export the validated config object.");
}

function checkGeneratedCapacitorConfig(relativePath) {
  // Capacitor intentionally ignores copied web assets and generated JSON.
  // Validate them after a local/CI `cap sync`, but do not make a clean clone
  // depend on ignored build output.
  if (!existsSync(repositoryPath(relativePath))) return;
  const config = parseJson(relativePath);
  if (!config) return;
  assert(config.appId === EXPECTED_APP_ID, `${relativePath} appId must be ${EXPECTED_APP_ID}.`);
  assert(
    config.appName === EXPECTED_APP_NAME,
    `${relativePath} appName must be ${EXPECTED_APP_NAME}.`,
  );
  assert(config.webDir === EXPECTED_WEB_DIR, `${relativePath} webDir must be ${EXPECTED_WEB_DIR}.`);
  assert(
    !Object.hasOwn(config, "server"),
    `${relativePath} must not contain a production server override.`,
  );
}

function gradleInteger(source, key) {
  const match = source.match(new RegExp(`\\b${key}\\s*=\\s*(\\d+)\\b`));
  return match ? Number(match[1]) : null;
}

function xmlString(source, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    source
      .match(new RegExp(`<string\\s+name=["']${escapedName}["']\\s*>([^<]*)<\\/string>`))?.[1]
      ?.trim() ?? null
  );
}

function checkAndroidFoundation() {
  const variables = readRequired("android/variables.gradle");
  const build = readRequired("android/app/build.gradle");
  const strings = readRequired("android/app/src/main/res/values/strings.xml");
  const manifest = readRequired("android/app/src/main/AndroidManifest.xml");
  if (!variables || !build || !strings || !manifest) return;

  const minSdk = gradleInteger(variables, "minSdkVersion");
  const compileSdk = gradleInteger(variables, "compileSdkVersion");
  const targetSdk = gradleInteger(variables, "targetSdkVersion");
  assert(
    minSdk !== null && minSdk >= MIN_ANDROID_SDK,
    `Android minSdkVersion must be at least ${MIN_ANDROID_SDK}.`,
  );
  assert(
    compileSdk !== null && compileSdk >= MIN_ANDROID_COMPILE_SDK,
    `Android compileSdkVersion must be at least ${MIN_ANDROID_COMPILE_SDK}.`,
  );
  assert(
    targetSdk !== null && targetSdk >= MIN_ANDROID_TARGET_SDK,
    `Android targetSdkVersion must be at least ${MIN_ANDROID_TARGET_SDK}.`,
  );
  assert(
    compileSdk !== null && targetSdk !== null && targetSdk <= compileSdk,
    "Android targetSdkVersion must not exceed compileSdkVersion.",
  );

  assert(
    /\bnamespace\s*=\s*["']app\.effectime["']/.test(build),
    `Android namespace must be ${EXPECTED_APP_ID}.`,
  );
  assert(
    /\bapplicationId\s*(?:=\s*)?["']app\.effectime["']/.test(build),
    `Android applicationId must be ${EXPECTED_APP_ID}.`,
  );
  assert(
    xmlString(strings, "app_name") === EXPECTED_APP_NAME,
    `Android app_name must be ${EXPECTED_APP_NAME}.`,
  );
  assert(
    xmlString(strings, "title_activity_main") === EXPECTED_APP_NAME,
    `Android activity title must be ${EXPECTED_APP_NAME}.`,
  );
  assert(
    xmlString(strings, "package_name") === EXPECTED_APP_ID,
    `Android package_name must be ${EXPECTED_APP_ID}.`,
  );
  assert(
    xmlString(strings, "custom_url_scheme") === EXPECTED_APP_ID,
    `Android custom URL scheme must be ${EXPECTED_APP_ID}.`,
  );

  assert(
    /android:name=["']android\.intent\.action\.VIEW["']/.test(manifest),
    "Android must register a VIEW deep-link action.",
  );
  assert(
    /android:name=["']android\.intent\.category\.DEFAULT["']/.test(manifest),
    "Android deep links must use the DEFAULT category.",
  );
  assert(
    /android:name=["']android\.intent\.category\.BROWSABLE["']/.test(manifest),
    "Android deep links must use the BROWSABLE category.",
  );
  assert(
    /android:scheme=["']@string\/custom_url_scheme["']/.test(manifest),
    "Android must bind its deep-link intent filter to @string/custom_url_scheme.",
  );
  assert(
    /android:launchMode=["']singleTask["']/.test(manifest),
    "Android MainActivity must remain singleTask for appUrlOpen delivery.",
  );
  assert(
    /android:usesCleartextTraffic=["']false["']/.test(manifest),
    "Android production manifest must explicitly disable clear-text traffic.",
  );
  assert(
    /android:allowBackup=["']false["']/.test(manifest),
    "Android must not back up the current WebView session store.",
  );
  assert(
    /android:name=["']android\.permission\.INTERNET["']/.test(manifest),
    "Android must declare the INTERNET permission for the shared Supabase backend.",
  );
  assert(
    /android:host=["']auth["']/.test(manifest),
    "Android must restrict the authentication deep link to the auth host.",
  );
  assert(
    /android:path=["']\/callback["']/.test(manifest),
    "Android must restrict the authentication deep link to /callback.",
  );
  assert(
    /android:host=["']w["']/.test(manifest),
    "Android must register the workspace deep-link host.",
  );

  checkGeneratedCapacitorConfig("android/app/src/main/assets/capacitor.config.json");
}

function plistString(source, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    source
      .match(new RegExp(`<key>${escapedKey}<\\/key>\\s*<string>([^<]*)<\\/string>`))?.[1]
      ?.trim() ?? null
  );
}

function checkIosFoundation() {
  const project = readRequired("ios/App/App.xcodeproj/project.pbxproj");
  const info = readRequired("ios/App/App/Info.plist");
  const swiftPackage = readRequired("ios/App/CapApp-SPM/Package.swift");
  if (!project || !info || !swiftPackage) return;

  const bundleIds = Array.from(
    project.matchAll(/\bPRODUCT_BUNDLE_IDENTIFIER\s*=\s*["']?([^;"']+)["']?;/g),
    (match) => match[1].trim(),
  );
  assert(
    bundleIds.length >= 2,
    "iOS project must define bundle identifiers for Debug and Release configurations.",
  );
  assert(
    bundleIds.length > 0 && bundleIds.every((bundleId) => bundleId === EXPECTED_APP_ID),
    `All iOS app bundle identifiers must be ${EXPECTED_APP_ID}.`,
  );

  const deploymentTargets = Array.from(
    project.matchAll(/\bIPHONEOS_DEPLOYMENT_TARGET\s*=\s*([0-9.]+)\s*;/g),
    (match) => Number(match[1]),
  );
  assert(deploymentTargets.length > 0, "iOS project must declare an IPHONEOS_DEPLOYMENT_TARGET.");
  assert(
    deploymentTargets.length > 0 &&
      deploymentTargets.every((target) => target >= MIN_IOS_DEPLOYMENT_TARGET),
    `Every iOS deployment target must be at least ${MIN_IOS_DEPLOYMENT_TARGET}.`,
  );
  assert(
    plistString(info, "CFBundleDisplayName") === EXPECTED_APP_NAME,
    `iOS CFBundleDisplayName must be ${EXPECTED_APP_NAME}.`,
  );
  assert(
    info.includes("<key>CFBundleURLTypes</key>"),
    "iOS Info.plist must declare CFBundleURLTypes.",
  );
  assert(
    info.includes("<key>CFBundleURLSchemes</key>"),
    "iOS Info.plist must declare CFBundleURLSchemes.",
  );
  assert(
    info.includes(`<string>${EXPECTED_APP_ID}</string>`),
    `iOS URL scheme must be ${EXPECTED_APP_ID}.`,
  );
  assert(
    !/<key>NSAllowsArbitraryLoads<\/key>\s*<true\s*\/>/.test(info),
    "iOS production transport security must not allow arbitrary loads.",
  );
  assert(
    !/(?:path\s*:\s*")[^"]*\\/.test(swiftPackage),
    "iOS Swift package paths must use portable forward slashes.",
  );
  for (const dependency of [
    ['AparajitaCapacitorSecureStorage', '../../../node_modules/@aparajita/capacitor-secure-storage'],
    ['CapacitorApp', '../../../node_modules/@capacitor/app'],
    ['CapacitorBrowser', '../../../node_modules/@capacitor/browser'],
  ]) {
    assert(
      swiftPackage.includes(`.package(name: "${dependency[0]}", path: "${dependency[1]}")`),
      `iOS Swift package manifest must pin the reviewed ${dependency[0]} local package path.`,
    );
  }
  assert(
    !swiftPackage.includes("CapacitorKeyboard") && !swiftPackage.includes("@capacitor/keyboard"),
    "Transitive Keyboard must not be registered in the iOS package manifest.",
  );

  checkGeneratedCapacitorConfig("ios/App/App/capacitor.config.json");
}

function parseEnvironmentSample() {
  const relativePath = ".env.example";
  const source = readRequired(relativePath);
  if (!source) return;
  const entries = new Map();

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    assert(Boolean(match), `${relativePath}:${index + 1} is not a valid KEY=value entry.`);
    if (!match) continue;

    const [, key, rawValue] = match;
    assert(!entries.has(key), `${relativePath} contains duplicate key ${key}.`);
    const value = rawValue
      .trim()
      .replace(
        /^(?:"([\s\S]*)"|'([\s\S]*)')$/,
        (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted,
      );
    assert(value.length > 0, `${relativePath} key ${key} must have a non-empty sample value.`);
    assert(
      key.startsWith("VITE_"),
      `${relativePath} may contain only public VITE_* keys; found ${key}.`,
    );
    assert(
      !/(?:SERVICE_ROLE|CLIENT_SECRET|PASSWORD|PRIVATE|SIGNING_SECRET|ACCESS_TOKEN|REFRESH_TOKEN)/i.test(
        key,
      ),
      `${relativePath} contains a forbidden secret-like key name: ${key}.`,
    );
    entries.set(key, value);
  }

  for (const key of REQUIRED_ENV_KEYS) {
    assert(entries.has(key), `${relativePath} is missing required public key ${key}.`);
  }

  const publicOrigin = entries.get("VITE_PUBLIC_APP_ORIGIN");
  if (publicOrigin) {
    try {
      const url = new URL(publicOrigin);
      assert(url.protocol === "https:", "VITE_PUBLIC_APP_ORIGIN sample must use HTTPS.");
      assert(
        url.origin === publicOrigin.replace(/\/$/, ""),
        "VITE_PUBLIC_APP_ORIGIN sample must contain only an origin.",
      );
    } catch {
      assert(false, "VITE_PUBLIC_APP_ORIGIN sample must be an absolute HTTPS origin.");
    }
  }

  console.log(
    `[mobile-foundation] Environment sample keys (${entries.size}): ${Array.from(entries.keys()).sort().join(", ")}`,
  );
}

function checkTypeScriptInclusion() {
  const config = parseJsonWithComments("tsconfig.node.json");
  if (!config) return;
  const included = new Set(
    Array.isArray(config.include)
      ? config.include.map((entry) => String(entry).replace(/^\.\//, ""))
      : [],
  );
  assert(
    included.has("vite.config.ts"),
    "tsconfig.node.json must continue to type-check vite.config.ts.",
  );
  assert(
    included.has("capacitor.config.ts"),
    "tsconfig.node.json must type-check capacitor.config.ts.",
  );
}

function statementContainsReturn(statement) {
  let found = false;
  function visit(node) {
    if (ts.isReturnStatement(node)) found = true;
    if (!found) ts.forEachChild(node, visit);
  }
  visit(statement);
  return found;
}

function isNativeGuard(statement) {
  return (
    ts.isIfStatement(statement) &&
    ts.isCallExpression(statement.expression) &&
    ts.isIdentifier(statement.expression.expression) &&
    statement.expression.expression.text === "isNativeRuntime" &&
    statement.expression.arguments.length === 0 &&
    statementContainsReturn(statement.thenStatement)
  );
}

function findFunction(sourceFile, name) {
  return sourceFile.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
}

function checkNativeGuard(sourceFile, functionName, operationPattern) {
  const declaration = findFunction(sourceFile, functionName);
  assert(Boolean(declaration?.body), `src/lib/pwa/registerSW.ts must declare ${functionName}.`);
  if (!declaration?.body) return;

  const statements = declaration.body.statements;
  const guardIndex = statements.findIndex(isNativeGuard);
  const operationIndex = statements.findIndex((statement) =>
    operationPattern.test(statement.getText(sourceFile)),
  );
  assert(guardIndex >= 0, `${functionName} must fail closed through isNativeRuntime().`);
  assert(operationIndex >= 0, `${functionName} no longer contains its expected PWA operation.`);
  assert(
    guardIndex >= 0 && operationIndex >= 0 && guardIndex < operationIndex,
    `${functionName} must exit native runtimes before invoking browser-only PWA APIs.`,
  );
}

function checkPwaNativeBoundary() {
  const relativePath = "src/lib/pwa/registerSW.ts";
  const sourceFile = parseTypeScript(relativePath);
  if (!sourceFile) return;

  const hasImport = sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "@/lib/platform/mobile" &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) => element.name.text === "isNativeRuntime",
      ),
  );
  assert(
    hasImport,
    `${relativePath} must import isNativeRuntime from the shared mobile platform boundary.`,
  );
  checkNativeGuard(
    sourceFile,
    "registerEffectimeServiceWorker",
    /navigator\.serviceWorker\.register/,
  );
  checkNativeGuard(
    sourceFile,
    "captureInstallPrompt",
    /addEventListener\s*\(\s*['"]beforeinstallprompt['"]/,
  );

  const mobilePlatform = readRequired("src/lib/platform/mobile.ts");
  if (!mobilePlatform) return;
  assert(
    /EFFECTIME_APP_ID\s*=\s*['"]app\.effectime['"]/.test(mobilePlatform),
    `The shared mobile platform app ID must remain ${EXPECTED_APP_ID}.`,
  );
  assert(
    /EFFECTIME_MOBILE_SCHEME\s*=\s*EFFECTIME_APP_ID/.test(mobilePlatform),
    "The shared mobile URL scheme must derive from EFFECTIME_APP_ID.",
  );
  assert(
    /isCapacitorNativeRuntime\s*\(\s*\)/.test(mobilePlatform),
    "isNativeRuntime must delegate to the shared fail-closed native bridge.",
  );

  const nativeBridge = readRequired("src/lib/platform/nativeBridge.ts");
  if (nativeBridge) {
    assert(
      nativeBridge.includes('typeof bridge.isNativePlatform !== "function"') &&
        nativeBridge.includes("return bridge.isNativePlatform() !== false"),
      "A partially initialized Capacitor global must remain on the native PKCE path.",
    );
    assert(
      !nativeBridge.includes("from '@capacitor/") && !nativeBridge.includes('from "@capacitor/'),
      "The injected native bridge boundary must not bundle Capacitor's browser runtime.",
    );
  }

  const installPrompt = readRequired("src/components/pwa/InstallPwaPrompt.tsx");
  if (installPrompt) {
    const guardIndex = installPrompt.indexOf("if (isNativeRuntime()) return;");
    const browserApiIndex = installPrompt.indexOf("window.matchMedia");
    assert(guardIndex >= 0, "InstallPwaPrompt must fail closed in a native runtime.");
    assert(
      browserApiIndex >= 0 && guardIndex < browserApiIndex,
      "InstallPwaPrompt must exit native runtimes before accessing PWA browser APIs.",
    );
  }
}

function checkNativeAuthBoundary() {
  const app = readRequired("src/App.tsx");
  const bridge = readRequired("src/components/mobile/MobileRuntimeBridge.tsx");
  const client = readRequired("src/integrations/supabase/client.ts");
  if (!app || !bridge || !client) return;

  assert(
    app.includes("<MobileRuntimeBridge />"),
    "The application router must mount MobileRuntimeBridge.",
  );
  assert(
    /nativeApp\s*\.\s*getLaunchUrl\s*\(/.test(bridge),
    "The native bridge must handle cold-start URLs.",
  );
  assert(/['"]appUrlOpen['"]/.test(bridge), "The native bridge must handle warm-start URLs.");
  assert(
    /['"]appStateChange['"]/.test(bridge),
    "The native bridge must bind auth refresh to app lifecycle changes.",
  );
  assert(
    bridge.includes("exchangeCodeForSession"),
    "The native bridge must exchange PKCE authorization codes.",
  );
  assert(
    !bridge.includes("supabase.auth.setSession"),
    "The native bridge must not accept implicit token sessions from a custom scheme.",
  );
  assert(
    bridge.includes("nativeRecovery: true"),
    "The native bridge must preserve successful PKCE recovery intent for the reset screen.",
  );
  assert(
    client.includes("flowType: nativeRuntime ? 'pkce' : 'implicit'"),
    "The native Supabase client must use PKCE.",
  );
  assert(
    client.includes("detectSessionInUrl: !nativeRuntime"),
    "Native auth callbacks must be handled by the allowlisted bridge.",
  );
  assert(
    client.includes("storage: supabaseAuthStorage") &&
      client.includes("storageKey: SUPABASE_AUTH_STORAGE_KEY"),
    "The Supabase client must use the explicit secure native auth-storage boundary.",
  );
  assert(
    !/storage\s*:\s*localStorage/.test(client),
    "The Supabase client must not persist native sessions directly in localStorage.",
  );

  const secureStorage = readRequired("src/lib/platform/nativeAuthStorage.ts");
  if (!secureStorage) return;
  assert(
    secureStorage.includes('import("@aparajita/capacitor-secure-storage")'),
    "Secure storage must be loaded lazily only through the native adapter.",
  );
  assert(
    secureStorage.includes("SecureStorage.setSynchronize(false)"),
    "iOS Keychain synchronization must remain disabled for auth sessions.",
  );
  assert(
    secureStorage.includes("KeychainAccess.whenUnlockedThisDeviceOnly"),
    "iOS auth sessions must use this-device-only Keychain accessibility.",
  );
  assert(
    secureStorage.includes("secure-write-verification") &&
      secureStorage.includes("installMarkerKey"),
    "Secure storage must preserve verified migration and reinstall protection.",
  );
  assert(
    !secureStorage.includes("return module.SecureStorage;"),
    "The Capacitor plugin proxy must never be returned from a Promise (thenable assimilation).",
  );
  assert(
    secureStorage.includes("getItem: (key) => module.SecureStorage.getItem(key)") &&
      secureStorage.includes(
        "setItem: (key, value) => module.SecureStorage.setItem(key, value)",
      ) &&
      secureStorage.includes("removeItem: (key) => module.SecureStorage.removeItem(key)"),
    "Secure storage must expose a plain non-thenable adapter around the Capacitor plugin proxy.",
  );
}

function extractCsp(relativePath, source) {
  const matches = Array.from(
    source.matchAll(
      /<meta\s+[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content=(["'])(.*?)\1[^>]*>/gi,
    ),
  );
  assert(matches.length === 1, `${relativePath} must contain exactly one early CSP meta.`);
  return matches[0]?.[2] ?? "";
}

function checkMobileHtml(relativePath, source) {
  if (!source) return;
  const csp = extractCsp(relativePath, source);
  assert(!csp.includes("unsafe-eval"), `${relativePath} CSP must not allow unsafe-eval.`);
  assert(
    !/script-src[^;]*unsafe-inline/.test(csp),
    `${relativePath} CSP must not allow executable inline scripts.`,
  );
  assert(!csp.includes("*.supabase.co"), `${relativePath} CSP must not wildcard Supabase.`);
  assert(
    /connect-src 'self' https:\/\/[^\s;]+ wss:\/\/[^\s;]+/.test(csp),
    `${relativePath} CSP must pin one HTTPS/WSS backend origin.`,
  );
  assert(
    !/type=["']application\/ld\+json["']/.test(source),
    `${relativePath} must not retain inline JSON-LD scripts.`,
  );
  assert(!/<noscript\b/i.test(source), `${relativePath} must not retain the web SEO fallback.`);
  const scripts = Array.from(source.matchAll(/<script\b[^>]*>/gi), (match) => match[0]);
  assert(scripts.length > 0, `${relativePath} must load the compiled application module.`);
  assert(
    scripts.every((script) => /type=["']module["']/.test(script) && /src=["'][^"']+["']/.test(script)),
    `${relativePath} may contain only external module scripts.`,
  );
}

function checkMobileArtifact() {
  const artifactIndexPath = repositoryPath("dist-mobile/index.html");
  assert(existsSync(artifactIndexPath), "dist-mobile/index.html is required; run npm run build:mobile.");
  if (!existsSync(artifactIndexPath)) return;

  const artifactIndex = readRequired("dist-mobile/index.html");
  checkMobileHtml("dist-mobile/index.html", artifactIndex);
  for (const webOnlyAsset of [
    "404.html",
    "embed.js",
    "manifest.webmanifest",
    "sw.js",
    "_headers",
    "_redirects",
  ]) {
    assert(
      !existsSync(repositoryPath(`dist-mobile/${webOnlyAsset}`)),
      `dist-mobile must not contain the web-only ${webOnlyAsset} asset.`,
    );
  }

  for (const generatedIndex of [
    "android/app/src/main/assets/public/index.html",
    "ios/App/App/public/index.html",
  ]) {
    assert(
      existsSync(repositoryPath(generatedIndex)),
      `${generatedIndex} is required; synchronize both native projects before validation.`,
    );
    if (!existsSync(repositoryPath(generatedIndex))) continue;
    const generated = readRequired(generatedIndex);
    checkMobileHtml(generatedIndex, generated);
    assert(
      generated === artifactIndex,
      `${generatedIndex} must exactly match the reviewed dist-mobile index.`,
    );
  }

  const androidPluginsPath = "android/app/src/main/assets/capacitor.plugins.json";
  assert(
    existsSync(repositoryPath(androidPluginsPath)),
    `${androidPluginsPath} is required after native synchronization.`,
  );
  if (existsSync(repositoryPath(androidPluginsPath))) {
    const plugins = parseJson(androidPluginsPath);
    const packages = Array.isArray(plugins) ? plugins.map((plugin) => plugin?.pkg).sort() : [];
    assert(
      JSON.stringify(packages) ===
        JSON.stringify([
          "@aparajita/capacitor-secure-storage",
          "@capacitor/app",
          "@capacitor/browser",
        ]),
      "Android must register only the reviewed App, Browser and SecureStorage plugins.",
    );
    assert(!packages.includes("@capacitor/keyboard"), "Transitive Keyboard must not be registered.");
  }

  const iosConfigPath = "ios/App/App/capacitor.config.json";
  assert(
    existsSync(repositoryPath(iosConfigPath)),
    `${iosConfigPath} is required after native synchronization.`,
  );
  if (existsSync(repositoryPath(iosConfigPath))) {
    const iosConfig = parseJson(iosConfigPath);
    assert(
      JSON.stringify(iosConfig?.packageClassList) ===
        JSON.stringify(["SecureStorage", "AppPlugin", "CAPBrowserPlugin"]),
      "iOS must register exactly the reviewed SecureStorage, App and Browser plugin classes.",
    );
  }

  const artifactTree = fileHashTree("dist-mobile");
  const emptySha256 = createHash("sha256").update("").digest("hex");
  for (const nativeTree of [
    "android/app/src/main/assets/public",
    "ios/App/App/public",
  ]) {
    const shimNames = ["cordova.js", "cordova_plugins.js"];
    const completeCopiedTree = fileHashTree(nativeTree);
    for (const shimName of shimNames) {
      assert(
        completeCopiedTree.get(shimName) === emptySha256,
        `${nativeTree}/${shimName} must be the reviewed empty Capacitor shim.`,
      );
    }
    const copiedTree = new Map(
      [...completeCopiedTree].filter(([relativePath]) => !shimNames.includes(relativePath)),
    );
    assert(
      JSON.stringify([...copiedTree.keys()]) === JSON.stringify([...artifactTree.keys()]),
      `${nativeTree} must contain the exact dist-mobile relative file tree plus reviewed Cordova shims.`,
    );
    for (const [relativePath, digest] of artifactTree) {
      assert(
        copiedTree.get(relativePath) === digest,
        `${nativeTree}/${relativePath} must be byte-identical to dist-mobile/${relativePath}.`,
      );
    }
  }
}

function fileHashTree(relativeRoot, excluded = new Set()) {
  const absoluteRoot = repositoryPath(relativeRoot);
  assert(existsSync(absoluteRoot), `Required artifact directory is missing: ${relativeRoot}`);
  if (!existsSync(absoluteRoot)) return new Map();

  const paths = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(absolutePath);
      else if (entry.isFile()) paths.push(absolutePath);
    }
  };
  walk(absoluteRoot);

  const normalizedRoot = absoluteRoot.replaceAll("\\", "/").replace(/\/$/, "");
  const manifest = new Map();
  for (const absolutePath of paths) {
    const normalizedPath = absolutePath.replaceAll("\\", "/");
    const relativePath = normalizedPath.slice(normalizedRoot.length + 1);
    if (excluded.has(relativePath)) continue;
    const digest = createHash("sha256").update(readFileSync(absolutePath)).digest("hex");
    manifest.set(relativePath, digest);
  }
  return new Map([...manifest].sort(([left], [right]) => left.localeCompare(right)));
}

function checkSharedDataSourceBoundary() {
  const runtime = readRequired("src/config/publicRuntime.ts");
  const client = readRequired("src/integrations/supabase/client.ts");
  const apiPanel = readRequired("src/components/integrations/PublicApiGatewayPanel.tsx");
  const iCal = readRequired("src/components/enterprise/ICalSubscription.tsx");
  if (!runtime || !client || !apiPanel || !iCal) return;

  assert(
    runtime.includes("import.meta.env.VITE_SUPABASE_URL"),
    "The shared runtime config must own VITE_SUPABASE_URL.",
  );
  assert(
    runtime.includes("import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"),
    "The shared runtime config must own the publishable key.",
  );
  assert(
    runtime.includes("VITE_SUPABASE_PROJECT_ID does not match"),
    "The runtime config must fail on project URL/ID drift.",
  );
  assert(
    runtime.includes("payload?.role === 'service_role'"),
    "The runtime config must reject service-role JWTs.",
  );
  assert(
    client.includes("from '@/config/publicRuntime'"),
    "The Supabase client must use the shared validated config.",
  );
  assert(
    !client.includes("import.meta.env.VITE_SUPABASE"),
    "The Supabase client must not bypass the shared runtime config.",
  );
  assert(
    !/https:\/\/[a-z0-9-]+\.supabase\.co/.test(apiPanel),
    "The public API panel must not hard-code a Supabase project.",
  );
  assert(
    apiPanel.includes("buildSupabaseFunctionUrl('public-api', projectUrl)"),
    "The public API panel must derive its endpoint from shared config.",
  );
  assert(
    !iCal.includes("VITE_SUPABASE_PROJECT_ID"),
    "iCal links must not construct a second backend origin from a separate project ID.",
  );
  assert(
    iCal.includes("buildSupabaseFunctionUrl('leave-ical', SUPABASE_URL)"),
    "iCal links must use the shared Supabase origin.",
  );
}

function checkNativeCiSource() {
  const workflow = readRequired(".github/workflows/quality.yml");
  if (!workflow) return;

  assert(workflow.includes("android-compile:"), "Quality CI must declare an Android compile job.");
  assert(workflow.includes("ios-compile:"), "Quality CI must declare an iOS compile job.");
  assert(workflow.includes("runs-on: macos-26"), "iOS CI must use a current Xcode 26 runner.");
  const androidJob = workflow.slice(
    workflow.indexOf("  android-compile:"),
    workflow.indexOf("  ios-compile:"),
  );
  const iosJob = workflow.slice(
    workflow.indexOf("  ios-compile:"),
    workflow.indexOf("  edge-safety:"),
  );
  assert(
    /^\s*run:\s*npm run mobile:sync\s*$/mu.test(androidJob),
    "Android CI must synchronize both platform copies before full-tree validation.",
  );
  assert(
    /^\s*run:\s*npm run mobile:sync\s*$/mu.test(iosJob),
    "iOS CI must synchronize both platform copies before full-tree validation.",
  );
  assert(
    workflow.includes("testDebugUnitTest lintDebug assembleDebug"),
    "Android CI must test, lint and compile the debug app.",
  );
  assert(
    workflow.includes("CODE_SIGNING_ALLOWED=NO"),
    "iOS CI must perform an unsigned simulator build without signing secrets.",
  );
  assert(
    workflow.includes("git diff --exit-code -- android"),
    "Android CI must reject generated source drift.",
  );
  assert(
    workflow.includes("git diff --exit-code -- ios"),
    "iOS CI must reject generated source drift.",
  );
  assert(
    workflow.includes("npm run mobile:check:source"),
    "Quality CI must validate source contracts before build artifacts exist.",
  );
  assert(
    workflow.includes("npm run mobile:sync") &&
      workflow.includes("npm run test:e2e:mobile:built"),
    "Quality CI must synchronize and smoke-test the exact reviewed mobile artifact.",
  );
  assert(
    workflow.includes("-resolvePackageDependencies") &&
      workflow.includes("-onlyUsePackageVersionsFromResolvedFile") &&
      workflow.includes("npm run mobile:check:release") &&
      workflow.includes("Bootstrap missing Swift package lock for review") &&
      workflow.includes("Stop until the reviewed Swift package lock is committed") &&
      workflow.includes("git status --porcelain=v1 --untracked-files=all -- ios"),
    "iOS CI must bootstrap a missing lock only for review, then lock-check, drift-check and compile only committed Swift package versions.",
  );
  const releaseCheckIndex = iosJob.indexOf("npm run mobile:check:release");
  const lockedResolveIndex = iosJob.indexOf("Resolve only the committed Swift package graph");
  assert(
    releaseCheckIndex >= 0 && lockedResolveIndex >= 0 && releaseCheckIndex < lockedResolveIndex,
    "iOS CI must validate the committed release contract before resolving the locked Swift graph.",
  );

  const node24ActionPins = [
    [
      "actions/checkout",
      "actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0",
      11,
      "checkout",
    ],
    [
      "actions/setup-node",
      "actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0",
      11,
      "setup-node",
    ],
    [
      "actions/upload-artifact",
      "actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6.0.0",
      4,
      "upload-artifact",
    ],
    [
      "actions/setup-java",
      "actions/setup-java@be666c2fcd27ec809703dec50e508c2fdc7f6654 # v5.2.0",
      1,
      "setup-java",
    ],
    [
      "denoland/setup-deno",
      "denoland/setup-deno@22d081ff2d3a40755e97629de92e3bcbfa7cf2ed # v2.0.5",
      4,
      "setup-deno",
    ],
  ];
  for (const [actionFamily, pin, expectedCount, actionName] of node24ActionPins) {
    const actualCount = workflow.split(pin).length - 1;
    const familyCount = workflow.split(`${actionFamily}@`).length - 1;
    assert(
      actualCount === expectedCount,
      `Quality CI must use the reviewed Node 24 ${actionName} pin exactly ${expectedCount} times; found ${actualCount}.`,
    );
    assert(
      familyCount === expectedCount,
      `Quality CI must not use an additional or alternate ${actionName} pin; expected ${expectedCount} total references, found ${familyCount}.`,
    );
  }
  const expectedActionReferenceCount = node24ActionPins.reduce(
    (total, [, , expectedCount]) => total + expectedCount,
    0,
  );
  // Count every YAML `uses:` token, including canonical multi-line steps,
  // shorthand `- uses:` steps and flow-style mappings. A new syntax shape must
  // fail closed instead of bypassing the reviewed action-family allowlist.
  const actionReferenceCount = workflow.match(/\buses\s*:/gu)?.length ?? 0;
  assert(
    actionReferenceCount === expectedActionReferenceCount,
    `Quality CI must use only the ${expectedActionReferenceCount} reviewed external action references; found ${actionReferenceCount}.`,
  );

  const jobSlice = (jobName, nextJobName) => {
    const start = workflow.indexOf(`  ${jobName}:`);
    const end = nextJobName ? workflow.indexOf(`  ${nextJobName}:`, start) : workflow.length;
    assert(start >= 0 && end > start, `Quality CI job ${jobName} must remain discoverable.`);
    return workflow.slice(start, end);
  };
  const uncachedNodeJobs = [
    ["database-contract", "hr-workflow-database-contract"],
    ["hr-workflow-database-contract", "admin-override-database-contract"],
    ["admin-override-database-contract", "profiles-tenant-database-contract"],
    ["profiles-tenant-database-contract", "member-profile-save-database-contract"],
    ["member-profile-save-database-contract", "recovered-surface-acl-database-contract"],
    ["recovered-surface-acl-database-contract", "verify"],
  ];
  for (const [jobName, nextJobName] of uncachedNodeJobs) {
    const job = jobSlice(jobName, nextJobName);
    assert(
      job.includes("node-version: 22") &&
        job.includes("package-manager-cache: false") &&
        !job.includes("cache: npm"),
      `Database contract job ${jobName} must keep Node 22 and explicitly disable setup-node v5 automatic caching.`,
    );
  }
  const cachedNodeJobs = [
    ["verify", "android-compile"],
    ["android-compile", "ios-compile"],
    ["ios-compile", "edge-safety"],
    ["edge-safety", "edge-check"],
    ["edge-check", undefined],
  ];
  for (const [jobName, nextJobName] of cachedNodeJobs) {
    const job = jobSlice(jobName, nextJobName);
    assert(
      job.includes("node-version: 22") &&
        job.includes("cache: npm") &&
        !job.includes("package-manager-cache: false"),
      `Quality CI job ${jobName} must keep the explicit reviewed Node 22 npm-cache contract.`,
    );
  }
  assert(
    !/^\s*(?:-\s*)?uses:\s*[^\s]+@(?![a-f0-9]{40}\s*(?:#|$))/mu.test(workflow),
    "Every GitHub Action in quality.yml must be pinned to a full commit SHA.",
  );
}

function checkReleaseReadiness() {
  const dirtyReleaseTree = execFileSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
    },
  )
    .split("\0")
    .filter(Boolean);
  assert(
    dirtyReleaseTree.length === 0,
    `Native release attestation requires a fully committed clean worktree; found ${dirtyReleaseTree.length} changed or untracked paths.`,
  );

  const tracked = new Set(
    execFileSync("git", ["ls-files", "-z", "--", "android", "ios", ".github/workflows/quality.yml", "scripts/mobile"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
    })
      .split("\0")
      .filter(Boolean)
      .map((path) => path.replaceAll("\\", "/")),
  );
  for (const requiredSource of [
    ".github/workflows/quality.yml",
    "android/app/build.gradle",
    "android/app/src/main/AndroidManifest.xml",
    "ios/App/App.xcodeproj/project.pbxproj",
    "ios/App/App/Info.plist",
    "ios/App/CapApp-SPM/Package.swift",
    "scripts/mobile/normalize-native.mjs",
  ]) {
    assert(
      tracked.has(requiredSource),
      `Native release source must be committed before attestation: ${requiredSource}`,
    );
  }

  const resolvedCandidates = [
    "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved",
    "ios/App/CapApp-SPM/Package.resolved",
  ];
  const resolvedPath = resolvedCandidates.find((path) => existsSync(repositoryPath(path)));
  assert(
    Boolean(resolvedPath),
    "A macOS/Xcode-generated and reviewed iOS Package.resolved is required for release.",
  );
  if (!resolvedPath) return;

  assert(tracked.has(resolvedPath), `iOS dependency lock must be committed: ${resolvedPath}`);
  const resolved = parseJson(resolvedPath);
  assert(resolved?.version === 3, "iOS Package.resolved must use the reviewed schema version 3.");
  const pins = Array.isArray(resolved?.pins) ? resolved.pins : [];
  const identities = pins.map((pin) => pin?.identity).filter(Boolean).sort();
  const expectedIdentities = Object.keys(EXPECTED_IOS_SWIFT_PACKAGE_PINS).sort();
  assert(
    JSON.stringify(identities) === JSON.stringify(expectedIdentities),
    `iOS Package.resolved identities must exactly match ${expectedIdentities.join(", ")}.`,
  );
  for (const [identity, expected] of Object.entries(EXPECTED_IOS_SWIFT_PACKAGE_PINS)) {
    const pin = pins.find((candidate) => candidate?.identity === identity);
    if (!pin) continue;
    assert(pin.kind === expected.kind, `iOS package ${identity} must use ${expected.kind}.`);
    assert(
      pin.location === expected.location,
      `iOS package ${identity} must resolve from the reviewed source URL.`,
    );
    assert(
      pin.state?.version === expected.version,
      `iOS package ${identity} must resolve to reviewed version ${expected.version}.`,
    );
    assert(
      pin.state?.revision === expected.revision,
      `iOS package ${identity} must resolve to the reviewed revision.`,
    );
  }
}

checkPackageContract();
checkCapacitorConfig();
checkAndroidFoundation();
checkIosFoundation();
parseEnvironmentSample();
checkTypeScriptInclusion();
checkPwaNativeBoundary();
checkNativeAuthBoundary();
checkSharedDataSourceBoundary();
checkNativeCiSource();
if (!sourceOnly) checkMobileArtifact();
if (releaseMode) checkReleaseReadiness();

if (failures.length > 0) {
  console.error(
    `[mobile-foundation] FAIL: ${failures.length}/${assertionCount} contract assertions failed.`,
  );
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `[mobile-foundation] PASS: ${assertionCount} fail-closed contract assertions passed.`,
  );
}
