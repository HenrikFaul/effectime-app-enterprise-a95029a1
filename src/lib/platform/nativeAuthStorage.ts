import { publicRuntimeConfig } from "@/config/publicRuntime";
import { isNativeRuntime } from "@/lib/platform/mobile";

export interface SupabaseAuthStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface LegacyAuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SecureStringStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type SupabaseAuthLock = <Result>(
  name: string,
  acquireTimeout: number,
  operation: () => Promise<Result>,
) => Promise<Result>;

export type NativeAuthStorageErrorCode =
  | "configuration"
  | "secure-store-unavailable"
  | "invalid-envelope"
  | "secure-write-verification"
  | "legacy-cleanup"
  | "unsupported-key"
  | "reset-required"
  | "reset-incomplete"
  | "lock-timeout";

const ERROR_MESSAGES: Record<NativeAuthStorageErrorCode, string> = {
  configuration: "Native authentication storage is not configured safely.",
  "secure-store-unavailable": "Native authentication storage is unavailable.",
  "invalid-envelope": "Native authentication storage contains invalid data.",
  "secure-write-verification": "Native authentication storage could not verify a write.",
  "legacy-cleanup": "Legacy authentication storage could not be removed safely.",
  "unsupported-key": "An unsupported authentication storage key was requested.",
  "reset-required": "Authentication storage was reset; an application reload is required.",
  "reset-incomplete": "Authentication storage could not be reset completely.",
  "lock-timeout": "Authentication storage could not acquire its lock in time.",
};

/**
 * Public errors deliberately contain no plugin details, keys, tokens or values.
 * Native diagnostic objects can contain OS metadata and must not reach logs.
 */
export class NativeAuthStorageError extends Error {
  readonly code: NativeAuthStorageErrorCode;
  readonly isAcquireTimeout: boolean;

  constructor(code: NativeAuthStorageErrorCode, _cause?: unknown) {
    super(ERROR_MESSAGES[code]);
    this.name = "NativeAuthStorageError";
    this.code = code;
    // Supabase Auth intentionally performs non-blocking lock attempts with a
    // zero timeout for token refresh. Its lock contract recognizes contention
    // structurally through this flag and treats it as a safe skipped tick.
    this.isAcquireTimeout = code === "lock-timeout";
  }
}

export interface SupabaseAuthStorageIdentity {
  projectRef: string;
  storageKey: string;
  sessionKey: string;
  verifierKey: string;
  userKey: string;
}

const PROJECT_REF_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62})$/;

export function buildSupabaseAuthStorageIdentity(
  supabaseUrl: string,
  configuredProjectRef: string,
): SupabaseAuthStorageIdentity {
  let url: URL;
  try {
    url = new URL(supabaseUrl);
  } catch (error) {
    throw new NativeAuthStorageError("configuration", error);
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !PROJECT_REF_PATTERN.test(configuredProjectRef)
  ) {
    throw new NativeAuthStorageError("configuration");
  }

  const hostedSuffix = ".supabase.co";
  if (url.hostname.endsWith(hostedSuffix)) {
    const hostedProjectRef = url.hostname.slice(0, -hostedSuffix.length);
    if (hostedProjectRef !== configuredProjectRef) {
      throw new NativeAuthStorageError("configuration");
    }
  }

  const storageKey = `sb-${configuredProjectRef}-auth-token`;
  return {
    projectRef: configuredProjectRef,
    storageKey,
    sessionKey: storageKey,
    verifierKey: `${storageKey}-code-verifier`,
    userKey: `${storageKey}-user`,
  };
}

interface AuthEnvelope {
  schema: 1;
  projectRef: string;
  revision: number;
  values: Record<string, string>;
}

interface MutexWaiter {
  settled: boolean;
  resolve: (release: () => void) => void;
  reject: (error: NativeAuthStorageError) => void;
  timer?: ReturnType<typeof setTimeout>;
}

class AsyncMutex {
  private locked = false;
  private readonly waiters: MutexWaiter[] = [];

  async run<Result>(operation: () => Promise<Result>, timeoutMs = -1): Promise<Result> {
    const release = await this.acquire(timeoutMs);
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private acquire(timeoutMs: number): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve(this.createRelease());
    }

    if (timeoutMs === 0) {
      return Promise.reject(new NativeAuthStorageError("lock-timeout"));
    }

    return new Promise((resolve, reject) => {
      const waiter: MutexWaiter = {
        settled: false,
        resolve,
        reject,
      };

      if (timeoutMs > 0) {
        waiter.timer = setTimeout(() => {
          if (waiter.settled) return;
          waiter.settled = true;
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          waiter.reject(new NativeAuthStorageError("lock-timeout"));
        }, timeoutMs);
      }

      this.waiters.push(waiter);
    });
  }

  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;

      while (this.waiters.length > 0) {
        const waiter = this.waiters.shift()!;
        if (waiter.settled) continue;
        waiter.settled = true;
        if (waiter.timer) clearTimeout(waiter.timer);
        waiter.resolve(this.createRelease());
        return;
      }

      this.locked = false;
    };
  }
}

export interface NativeAuthStorageRuntime {
  readonly storage: SupabaseAuthStorage;
  readonly lock: SupabaseAuthLock;
  readonly storageKey: string;
  readonly envelopeKey: string;
  readonly installMarkerKey: string;
  ready(): Promise<void>;
  clearSession(): Promise<void>;
  reset(): Promise<void>;
}

interface NativeAuthStorageRuntimeOptions {
  projectRef: string;
  storageKey: string;
  secureStore: SecureStringStore;
  legacyStorage: LegacyAuthStorage;
  onFailure?: (error: NativeAuthStorageError) => void;
}

function wrapError(
  code: NativeAuthStorageErrorCode,
  error: unknown,
): NativeAuthStorageError {
  return error instanceof NativeAuthStorageError ? error : new NativeAuthStorageError(code, error);
}

export function createNativeAuthStorageRuntime(
  options: NativeAuthStorageRuntimeOptions,
): NativeAuthStorageRuntime {
  const identity = buildSupabaseAuthStorageIdentity(
    `https://${options.projectRef}.supabase.co`,
    options.projectRef,
  );
  if (identity.storageKey !== options.storageKey) {
    throw new NativeAuthStorageError("configuration");
  }

  const allowedKeys = new Set([identity.sessionKey, identity.verifierKey, identity.userKey]);
  const envelopeKey = `effectime.supabase-auth.envelope.v1:${options.projectRef}`;
  const installMarkerKey = `effectime.native-auth.install.v1:${options.projectRef}`;
  const storageMutex = new AsyncMutex();
  const authMutex = new AsyncMutex();
  // Reset is a terminal operation for this JavaScript runtime. Supabase auth
  // methods such as signInWithPassword can finish a network request without
  // holding the configured auth lock, so a synchronous latch is required to
  // reject their late session write until the recovery UI reloads the app.
  let writesDisabled = false;
  let initialization: Promise<void> | undefined;
  let envelope: AuthEnvelope = {
    schema: 1,
    projectRef: options.projectRef,
    revision: 0,
    values: {},
  };

  const fail = (code: NativeAuthStorageErrorCode, error?: unknown): NativeAuthStorageError => {
    const wrapped = wrapError(code, error);
    options.onFailure?.(wrapped);
    return wrapped;
  };

  const assertAllowedKey = (key: string): void => {
    if (!allowedKeys.has(key)) throw fail("unsupported-key");
  };

  const parseEnvelope = (raw: string): AuthEnvelope => {
    let candidate: unknown;
    try {
      candidate = JSON.parse(raw);
    } catch (error) {
      throw fail("invalid-envelope", error);
    }

    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw fail("invalid-envelope");
    }

    const record = candidate as Record<string, unknown>;
    const values = record.values;
    if (
      record.schema !== 1 ||
      record.projectRef !== options.projectRef ||
      !Number.isSafeInteger(record.revision) ||
      (record.revision as number) < 1 ||
      !values ||
      typeof values !== "object" ||
      Array.isArray(values)
    ) {
      throw fail("invalid-envelope");
    }

    const normalizedValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
      if (!allowedKeys.has(key) || typeof value !== "string") {
        throw fail("invalid-envelope");
      }
      normalizedValues[key] = value;
    }

    return {
      schema: 1,
      projectRef: options.projectRef,
      revision: record.revision as number,
      values: normalizedValues,
    };
  };

  const secureGet = async (): Promise<string | null> => {
    try {
      return await options.secureStore.getItem(envelopeKey);
    } catch (error) {
      throw fail("secure-store-unavailable", error);
    }
  };

  const secureRemove = async (): Promise<void> => {
    try {
      await options.secureStore.removeItem(envelopeKey);
      if ((await options.secureStore.getItem(envelopeKey)) !== null) {
        throw new NativeAuthStorageError("secure-write-verification");
      }
    } catch (error) {
      throw fail("secure-store-unavailable", error);
    }
  };

  const legacyGet = (key: string): string | null => {
    try {
      return options.legacyStorage.getItem(key);
    } catch (error) {
      throw fail("legacy-cleanup", error);
    }
  };

  const setInstallMarker = (): void => {
    try {
      options.legacyStorage.setItem(installMarkerKey, "1");
      if (options.legacyStorage.getItem(installMarkerKey) !== "1") {
        throw new Error("Install marker verification failed.");
      }
    } catch (error) {
      throw fail("legacy-cleanup", error);
    }
  };

  const readLegacySnapshot = (): Record<string, string> => {
    const snapshot: Record<string, string> = {};
    for (const key of allowedKeys) {
      const value = legacyGet(key);
      if (value !== null) snapshot[key] = value;
    }
    return snapshot;
  };

  const cleanupLegacy = (keys: Iterable<string>): void => {
    try {
      for (const key of keys) options.legacyStorage.removeItem(key);
      for (const key of keys) {
        if (options.legacyStorage.getItem(key) !== null) {
          throw new Error("Legacy authentication value remained after cleanup.");
        }
      }
    } catch (error) {
      throw fail("legacy-cleanup", error);
    }
  };

  const commitEnvelope = async (next: AuthEnvelope): Promise<void> => {
    const serialized = JSON.stringify(next);
    try {
      await options.secureStore.setItem(envelopeKey, serialized);
      const verified = await options.secureStore.getItem(envelopeKey);
      if (verified !== serialized) {
        throw new NativeAuthStorageError("secure-write-verification");
      }
    } catch (error) {
      throw fail(
        error instanceof NativeAuthStorageError
          ? error.code
          : "secure-store-unavailable",
        error,
      );
    }
  };

  const initialize = async (): Promise<void> => {
    const marker = legacyGet(installMarkerKey);
    if (marker !== null && marker !== "1") throw fail("legacy-cleanup");

    const legacySnapshot = readLegacySnapshot();
    const legacyKeys = Object.keys(legacySnapshot);
    const secureRaw = await secureGet();

    // iOS Keychain survives uninstall while the WebView sandbox does not. If
    // there is no install marker and no migratable legacy state, a surviving
    // secure envelope belongs to a previous installation and must not silently
    // restore that account.
    if (marker === null && secureRaw !== null && legacyKeys.length === 0) {
      await secureRemove();
      setInstallMarker();
      envelope = {
        schema: 1,
        projectRef: options.projectRef,
        revision: 0,
        values: {},
      };
      return;
    }

    if (marker === null) setInstallMarker();

    if (secureRaw !== null) {
      const parsed = parseEnvelope(secureRaw);
      if (legacyKeys.length > 0) cleanupLegacy(legacyKeys);
      envelope = parsed;
      return;
    }

    if (legacyKeys.length === 0) return;

    const migrated: AuthEnvelope = {
      schema: 1,
      projectRef: options.projectRef,
      revision: 1,
      values: legacySnapshot,
    };
    await commitEnvelope(migrated);
    cleanupLegacy(legacyKeys);
    envelope = migrated;
  };

  const ready = (): Promise<void> => {
    if (!initialization) {
      initialization = storageMutex.run(initialize).catch((error) => {
        throw fail("secure-store-unavailable", error);
      });
    }
    return initialization;
  };

  const mutate = async (mutation: (values: Record<string, string>) => void): Promise<void> => {
    if (writesDisabled) throw fail("reset-required");
    await ready();
    await storageMutex.run(async () => {
      if (writesDisabled) throw fail("reset-required");
      const nextValues = { ...envelope.values };
      mutation(nextValues);
      const next: AuthEnvelope = {
        schema: 1,
        projectRef: options.projectRef,
        revision: Math.max(1, envelope.revision + 1),
        values: nextValues,
      };
      await commitEnvelope(next);
      envelope = next;
    });
  };

  const storage: SupabaseAuthStorage = {
    async getItem(key) {
      assertAllowedKey(key);
      if (writesDisabled) throw fail("reset-required");
      await ready();
      return envelope.values[key] ?? null;
    },
    async setItem(key, value) {
      assertAllowedKey(key);
      if (typeof value !== "string") throw fail("invalid-envelope");
      await mutate((values) => {
        values[key] = value;
      });
    },
    async removeItem(key) {
      assertAllowedKey(key);
      await mutate((values) => {
        delete values[key];
      });
    },
  };

  return {
    storage,
    storageKey: options.storageKey,
    envelopeKey,
    installMarkerKey,
    lock: (_name, acquireTimeout, operation) => authMutex.run(operation, acquireTimeout),
    ready,
    async clearSession() {
      await authMutex.run(async () => {
        await mutate((values) => {
          for (const key of allowedKeys) delete values[key];
        });
      });
    },
    async reset() {
      // Set this before the first await: an auth request that was already in
      // flight but did not participate in Supabase's lock must never restore a
      // session after explicit local credential deletion.
      writesDisabled = true;
      const clearedEnvelope: AuthEnvelope = {
        schema: 1,
        projectRef: options.projectRef,
        revision: Math.max(1, envelope.revision + 1),
        values: {},
      };
      envelope = clearedEnvelope;

      const resetPendingMarker = "reset-pending";
      let pendingMarkerDurable = false;
      let legacyCleared = true;
      let secureCleared = false;
      let installMarkerReady = false;

      const writeAndVerifyMarker = (value: string): boolean => {
        try {
          options.legacyStorage.setItem(installMarkerKey, value);
        } catch {
          // The readback below is authoritative: a prior durable marker may
          // already contain the requested fail-closed value.
        }
        try {
          return options.legacyStorage.getItem(installMarkerKey) === value;
        } catch {
          return false;
        }
      };

      // A durable non-ready marker prevents a partially deleted credential set
      // from being migrated back into secure storage after a process restart.
      pendingMarkerDurable = writeAndVerifyMarker(resetPendingMarker);

      // Reset participates in the same lock as Supabase Auth so an in-flight
      // refresh/sign-in cannot re-persist a session after the user explicitly
      // cleared local credentials.
      await authMutex.run(async () => {
        await storageMutex.run(async () => {
          // Each legacy target is attempted independently. A failure for one
          // token must not leave the other token classes unnecessarily exposed.
          for (const key of allowedKeys) {
            try {
              options.legacyStorage.removeItem(key);
            } catch {
              legacyCleared = false;
            }
            try {
              if (options.legacyStorage.getItem(key) !== null) legacyCleared = false;
            } catch {
              legacyCleared = false;
            }
          }

          // Prefer a verified empty envelope over deletion. It is an
          // authoritative secure-store tombstone, so a stale legacy token can
          // never be migrated back if the WebView marker is unavailable.
          try {
            await commitEnvelope(clearedEnvelope);
            secureCleared = true;
          } catch {
            secureCleared = false;
          }

          // Removing the envelope is safe only when restart is already guarded
          // by a durable pending marker or every legacy credential is gone.
          // Otherwise keep the former envelope intact and fail closed rather
          // than create a markerless legacy-session resurrection path.
          if (!secureCleared && (pendingMarkerDurable || legacyCleared)) {
            try {
              await options.secureStore.removeItem(envelopeKey);
              secureCleared = (await options.secureStore.getItem(envelopeKey)) === null;
            } catch {
              secureCleared = false;
            }
          }

          if (secureCleared && legacyCleared) {
            installMarkerReady = writeAndVerifyMarker("1");
            return;
          }

          pendingMarkerDurable =
            writeAndVerifyMarker(resetPendingMarker) || pendingMarkerDurable;
        });
      });

      const resetComplete =
        secureCleared &&
        legacyCleared &&
        installMarkerReady;
      if (!resetComplete) throw fail("reset-incomplete");
    },
  };
}

const storageFailureListeners = new Set<(error: NativeAuthStorageError) => void>();

function publishStorageFailure(error: NativeAuthStorageError): void {
  for (const listener of storageFailureListeners) listener(error);
}

export function subscribeToNativeAuthStorageFailures(
  listener: (error: NativeAuthStorageError) => void,
): () => void {
  storageFailureListeners.add(listener);
  return () => storageFailureListeners.delete(listener);
}

function createCapacitorSecureStore(): SecureStringStore {
  // Capacitor plugins are dynamic proxies: reading an arbitrary property such
  // as `then` is interpreted as a native plugin method call. Never resolve a
  // Promise with the proxy itself because Promise thenable assimilation would
  // invoke `SecureStorage.then()` on Android/iOS. The plain closure-based
  // adapter below is deliberately non-thenable.
  let pluginPromise: Promise<SecureStringStore> | undefined;

  const plugin = async () => {
    if (!pluginPromise) {
      pluginPromise = import("@aparajita/capacitor-secure-storage")
        .then(async (module) => {
          await module.SecureStorage.setSynchronize(false);
          await module.SecureStorage.setDefaultKeychainAccess(
            module.KeychainAccess.whenUnlockedThisDeviceOnly,
          );
          return {
            getItem: (key) => module.SecureStorage.getItem(key),
            setItem: (key, value) => module.SecureStorage.setItem(key, value),
            removeItem: (key) => module.SecureStorage.removeItem(key),
          } satisfies SecureStringStore;
        })
        .catch((error) => {
          pluginPromise = undefined;
          throw new NativeAuthStorageError("secure-store-unavailable", error);
        });
    }
    return pluginPromise;
  };

  return {
    async getItem(key) {
      return (await plugin()).getItem(key);
    },
    async setItem(key, value) {
      await (await plugin()).setItem(key, value);
    },
    async removeItem(key) {
      await (await plugin()).removeItem(key);
    },
  };
}

const nativeRuntime = isNativeRuntime();
const configuredProjectRef = publicRuntimeConfig.supabaseProjectRef;
const storageIdentity = configuredProjectRef
  ? buildSupabaseAuthStorageIdentity(publicRuntimeConfig.supabaseUrl, configuredProjectRef)
  : null;

if (nativeRuntime && !storageIdentity) {
  throw new NativeAuthStorageError("configuration");
}

const singletonRuntime =
  nativeRuntime && storageIdentity
    ? createNativeAuthStorageRuntime({
        projectRef: storageIdentity.projectRef,
        storageKey: storageIdentity.storageKey,
        secureStore: createCapacitorSecureStore(),
        legacyStorage: localStorage,
        onFailure: publishStorageFailure,
      })
    : null;

export const SUPABASE_AUTH_STORAGE_KEY =
  storageIdentity?.storageKey ??
  `sb-${new URL(publicRuntimeConfig.supabaseUrl).hostname.split(".")[0]}-auth-token`;

export const supabaseAuthStorage: SupabaseAuthStorage = singletonRuntime?.storage ?? localStorage;
export const supabaseAuthLock: SupabaseAuthLock | undefined = singletonRuntime?.lock;

export async function ensureSupabaseAuthStorageReady(): Promise<void> {
  await singletonRuntime?.ready();
}

/** Clears every local Supabase credential even when remote token revocation fails. */
export async function clearSupabaseLocalAuthSession(): Promise<void> {
  if (singletonRuntime) {
    await singletonRuntime.clearSession();
    return;
  }

  let failed = false;
  for (const key of [
    SUPABASE_AUTH_STORAGE_KEY,
    `${SUPABASE_AUTH_STORAGE_KEY}-code-verifier`,
    `${SUPABASE_AUTH_STORAGE_KEY}-user`,
  ]) {
    try {
      localStorage.removeItem(key);
      if (localStorage.getItem(key) !== null) failed = true;
    } catch {
      failed = true;
    }
  }
  if (failed) throw new Error("Local authentication session could not be cleared.");
}

export async function resetSupabaseNativeAuthStorage(): Promise<void> {
  if (!singletonRuntime) throw new NativeAuthStorageError("configuration");
  await singletonRuntime.reset();
}
