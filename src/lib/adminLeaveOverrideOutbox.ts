export const ADMIN_LEAVE_OVERRIDE_OUTBOX_VERSION = 1 as const;
export const ADMIN_LEAVE_OVERRIDE_OUTBOX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const OUTBOX_STORAGE_PREFIX = 'effectime.admin-leave-override.outbox.v1:';
const OUTBOX_LOCK_NAME = 'effectime-admin-leave-override-outbox-v1';
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

export type AdminLeaveOverrideOutboxErrorCode =
  | 'configuration'
  | 'coordination-unavailable'
  | 'crypto-unavailable'
  | 'corrupted-entry'
  | 'expired-entry'
  | 'unresolved-operation'
  | 'storage-unavailable'
  | 'write-verification';

const ERROR_MESSAGES: Record<AdminLeaveOverrideOutboxErrorCode, string> = {
  configuration: 'Admin leave override retry storage is not configured safely.',
  'coordination-unavailable': 'Secure cross-context admin leave override coordination is unavailable.',
  'crypto-unavailable': 'Secure admin leave override payload hashing is unavailable.',
  'corrupted-entry': 'Admin leave override retry storage contains invalid data and requires reconciliation.',
  'expired-entry': 'The pending admin leave override retry expired and requires reconciliation.',
  'unresolved-operation': 'An unresolved admin leave override must be reconciled before another can be created.',
  'storage-unavailable': 'Admin leave override retry storage is unavailable.',
  'write-verification': 'Admin leave override retry storage could not verify a write.',
};

/**
 * Public errors never include a storage key, actor/workspace identifier,
 * idempotency key, payload digest, justification or comment.
 */
export class AdminLeaveOverrideOutboxError extends Error {
  readonly code: AdminLeaveOverrideOutboxErrorCode;

  constructor(code: AdminLeaveOverrideOutboxErrorCode, _cause?: unknown) {
    super(ERROR_MESSAGES[code]);
    this.name = 'AdminLeaveOverrideOutboxError';
    this.code = code;
  }
}

export interface AdminLeaveOverrideOutboxScope {
  workspaceId: string;
  actorId: string;
}

export interface AdminLeaveOverrideOutboxEntry {
  version: typeof ADMIN_LEAVE_OVERRIDE_OUTBOX_VERSION;
  scope: AdminLeaveOverrideOutboxScope;
  payloadDigest: string;
  key: string;
  createdAt: number;
}

export interface AdminLeaveOverrideOutboxStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AdminLeaveOverrideOutboxLock {
  run<Result>(operation: () => Result | Promise<Result>): Promise<Result>;
}

export interface AdminLeaveOverrideOutbox {
  getOrCreate(
    scope: AdminLeaveOverrideOutboxScope,
    canonicalPayload: string,
  ): Promise<AdminLeaveOverrideOutboxEntry>;
  complete(entry: AdminLeaveOverrideOutboxEntry): Promise<boolean>;
}

export interface CreateAdminLeaveOverrideOutboxOptions {
  keyFactory: () => string;
  storage?: AdminLeaveOverrideOutboxStorage | (() => AdminLeaveOverrideOutboxStorage);
  digestPayload?: (canonicalPayload: string) => Promise<string>;
  lock?: AdminLeaveOverrideOutboxLock;
  now?: () => number;
  ttlMs?: number;
}

class InProcessMutex implements AdminLeaveOverrideOutboxLock {
  private tail: Promise<void> = Promise.resolve();

  async run<Result>(operation: () => Result | Promise<Result>): Promise<Result> {
    const previous = this.tail;
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tail = previous.then(() => current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

const sharedInProcessMutex = new InProcessMutex();

function wrapError(
  code: AdminLeaveOverrideOutboxErrorCode,
  error?: unknown,
): AdminLeaveOverrideOutboxError {
  return error instanceof AdminLeaveOverrideOutboxError
    ? error
    : new AdminLeaveOverrideOutboxError(code, error);
}

function defaultStorage(): AdminLeaveOverrideOutboxStorage {
  try {
    if (typeof localStorage === 'undefined') {
      throw new AdminLeaveOverrideOutboxError('storage-unavailable');
    }
    return localStorage;
  } catch (error) {
    throw wrapError('storage-unavailable', error);
  }
}

function createDefaultLock(): AdminLeaveOverrideOutboxLock {
  return {
    async run<Result>(operation: () => Result | Promise<Result>): Promise<Result> {
      let lockManager: LockManager | undefined;
      try {
        lockManager = typeof navigator === 'undefined' ? undefined : navigator.locks;
      } catch (error) {
        throw wrapError('storage-unavailable', error);
      }

      // A realm-local mutex cannot prevent two tabs or WebViews from observing
      // an empty scope and minting different UUIDs. This security-sensitive
      // operation therefore requires the origin-wide Web Locks primitive; old
      // WebViews and privacy modes that disable it fail closed before storage
      // is read or a request can be sent.
      if (!lockManager) {
        throw new AdminLeaveOverrideOutboxError('coordination-unavailable');
      }

      try {
        return await lockManager.request(
          OUTBOX_LOCK_NAME,
          { mode: 'exclusive' },
          () => sharedInProcessMutex.run(operation),
        );
      } catch (error) {
        throw wrapError('storage-unavailable', error);
      }
    },
  };
}

function normalizeUuid(value: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new AdminLeaveOverrideOutboxError('configuration');
  }
  return value.toLowerCase();
}

function normalizeScope(scope: AdminLeaveOverrideOutboxScope): AdminLeaveOverrideOutboxScope {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new AdminLeaveOverrideOutboxError('configuration');
  }
  return {
    workspaceId: normalizeUuid(scope.workspaceId),
    actorId: normalizeUuid(scope.actorId),
  };
}

function normalizeDigest(value: string): string {
  if (typeof value !== 'string') {
    throw new AdminLeaveOverrideOutboxError('crypto-unavailable');
  }
  const normalized = value.toLowerCase();
  if (!SHA256_HEX_PATTERN.test(normalized)) {
    throw new AdminLeaveOverrideOutboxError('crypto-unavailable');
  }
  return normalized;
}

function normalizeIdempotencyKey(value: string): string {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new AdminLeaveOverrideOutboxError('configuration');
  }
  return value.toLowerCase();
}

function assertExactKeys(record: Record<string, unknown>, keys: string[]): void {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new AdminLeaveOverrideOutboxError('corrupted-entry');
  }
}

function buildStorageKey(scope: AdminLeaveOverrideOutboxScope, payloadDigest: string): string {
  return `${OUTBOX_STORAGE_PREFIX}${scope.workspaceId}:${scope.actorId}:${payloadDigest}`;
}

function buildScopeStoragePrefix(scope: AdminLeaveOverrideOutboxScope): string {
  return `${OUTBOX_STORAGE_PREFIX}${scope.workspaceId}:${scope.actorId}:`;
}

function findScopeStorageKeys(
  storage: AdminLeaveOverrideOutboxStorage,
  scope: AdminLeaveOverrideOutboxScope,
): string[] {
  const scopePrefix = buildScopeStoragePrefix(scope);
  const storageKeys: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const storageKey = storage.key(index);
      if (storageKey?.startsWith(scopePrefix)) storageKeys.push(storageKey);
    }
  } catch (error) {
    throw wrapError('storage-unavailable', error);
  }
  return storageKeys;
}

function decodeEntry(raw: string, expectedStorageKey: string): AdminLeaveOverrideOutboxEntry {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch (error) {
    throw new AdminLeaveOverrideOutboxError('corrupted-entry', error);
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new AdminLeaveOverrideOutboxError('corrupted-entry');
  }

  const record = candidate as Record<string, unknown>;
  assertExactKeys(record, ['version', 'scope', 'payloadDigest', 'key', 'createdAt']);
  if (!record.scope || typeof record.scope !== 'object' || Array.isArray(record.scope)) {
    throw new AdminLeaveOverrideOutboxError('corrupted-entry');
  }

  const scopeRecord = record.scope as Record<string, unknown>;
  assertExactKeys(scopeRecord, ['workspaceId', 'actorId']);
  if (
    record.version !== ADMIN_LEAVE_OVERRIDE_OUTBOX_VERSION
    || typeof scopeRecord.workspaceId !== 'string'
    || typeof scopeRecord.actorId !== 'string'
    || typeof record.payloadDigest !== 'string'
    || typeof record.key !== 'string'
    || !Number.isSafeInteger(record.createdAt)
    || (record.createdAt as number) <= 0
  ) {
    throw new AdminLeaveOverrideOutboxError('corrupted-entry');
  }

  let scope: AdminLeaveOverrideOutboxScope;
  let payloadDigest: string;
  let key: string;
  try {
    scope = normalizeScope({
      workspaceId: scopeRecord.workspaceId,
      actorId: scopeRecord.actorId,
    });
    payloadDigest = normalizeDigest(record.payloadDigest);
    key = normalizeIdempotencyKey(record.key);
  } catch (error) {
    throw new AdminLeaveOverrideOutboxError('corrupted-entry', error);
  }

  if (
    scope.workspaceId !== scopeRecord.workspaceId
    || scope.actorId !== scopeRecord.actorId
    || payloadDigest !== record.payloadDigest
    || key !== record.key
    || buildStorageKey(scope, payloadDigest) !== expectedStorageKey
  ) {
    throw new AdminLeaveOverrideOutboxError('corrupted-entry');
  }

  return {
    version: ADMIN_LEAVE_OVERRIDE_OUTBOX_VERSION,
    scope,
    payloadDigest,
    key,
    createdAt: record.createdAt as number,
  };
}

function currentTime(now: () => number): number {
  const value = now();
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AdminLeaveOverrideOutboxError('configuration');
  }
  return value;
}

function classifyEntryTime(
  entry: AdminLeaveOverrideOutboxEntry,
  now: number,
  ttlMs: number,
): 'valid' | 'expired' | 'corrupted' {
  if (entry.createdAt > now + MAX_FUTURE_CLOCK_SKEW_MS) return 'corrupted';
  return now - entry.createdAt >= ttlMs ? 'expired' : 'valid';
}

function storageGet(storage: AdminLeaveOverrideOutboxStorage, storageKey: string): string | null {
  try {
    return storage.getItem(storageKey);
  } catch (error) {
    throw wrapError('storage-unavailable', error);
  }
}

function removeAndVerify(
  storage: AdminLeaveOverrideOutboxStorage,
  storageKey: string,
): void {
  try {
    storage.removeItem(storageKey);
    if (storage.getItem(storageKey) !== null) {
      throw new AdminLeaveOverrideOutboxError('write-verification');
    }
  } catch (error) {
    throw wrapError(
      error instanceof AdminLeaveOverrideOutboxError
        ? error.code
        : 'storage-unavailable',
      error,
    );
  }
}

function writeAndVerify(
  storage: AdminLeaveOverrideOutboxStorage,
  storageKey: string,
  serialized: string,
): void {
  try {
    storage.setItem(storageKey, serialized);
    if (storage.getItem(storageKey) !== serialized) {
      throw new AdminLeaveOverrideOutboxError('write-verification');
    }
  } catch (error) {
    throw wrapError(
      error instanceof AdminLeaveOverrideOutboxError
        ? error.code
        : 'storage-unavailable',
      error,
    );
  }
}

export async function sha256AdminLeaveOverridePayload(
  canonicalPayload: string,
  cryptoApi?: Pick<Crypto, 'subtle'>,
): Promise<string> {
  if (typeof canonicalPayload !== 'string') {
    throw new AdminLeaveOverrideOutboxError('configuration');
  }

  let resolvedCrypto = cryptoApi;
  if (!resolvedCrypto) {
    try {
      resolvedCrypto = globalThis.crypto;
    } catch (error) {
      throw new AdminLeaveOverrideOutboxError('crypto-unavailable', error);
    }
  }
  if (!resolvedCrypto?.subtle || typeof resolvedCrypto.subtle.digest !== 'function') {
    throw new AdminLeaveOverrideOutboxError('crypto-unavailable');
  }

  try {
    const bytes = new TextEncoder().encode(canonicalPayload);
    const digest = await resolvedCrypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    throw new AdminLeaveOverrideOutboxError('crypto-unavailable', error);
  }
}

export function createAdminLeaveOverrideOutbox(
  options: CreateAdminLeaveOverrideOutboxOptions,
): AdminLeaveOverrideOutbox {
  if (!options || typeof options.keyFactory !== 'function') {
    throw new AdminLeaveOverrideOutboxError('configuration');
  }

  const ttlMs = options.ttlMs ?? ADMIN_LEAVE_OVERRIDE_OUTBOX_TTL_MS;
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new AdminLeaveOverrideOutboxError('configuration');
  }

  const now = options.now ?? Date.now;
  const digestPayload = options.digestPayload ?? sha256AdminLeaveOverridePayload;
  const lock = options.lock ?? createDefaultLock();

  const resolveStorage = (): AdminLeaveOverrideOutboxStorage => {
    try {
      const storage = typeof options.storage === 'function'
        ? options.storage()
        : options.storage ?? defaultStorage();
      if (
        !storage
        || typeof storage.getItem !== 'function'
        || typeof storage.setItem !== 'function'
        || typeof storage.removeItem !== 'function'
        || typeof storage.key !== 'function'
      ) {
        throw new AdminLeaveOverrideOutboxError('configuration');
      }
      return storage;
    } catch (error) {
      throw wrapError('storage-unavailable', error);
    }
  };

  return {
    async getOrCreate(scopeInput, canonicalPayload) {
      const scope = normalizeScope(scopeInput);
      const payloadDigest = normalizeDigest(await digestPayload(canonicalPayload));
      const storageKey = buildStorageKey(scope, payloadDigest);

      return lock.run(() => {
        const storage = resolveStorage();
        const observedAt = currentTime(now);
        const raw = storageGet(storage, storageKey);
        if (raw !== null) {
          let entry: AdminLeaveOverrideOutboxEntry;
          try {
            entry = decodeEntry(raw, storageKey);
          } catch (error) {
            throw new AdminLeaveOverrideOutboxError('corrupted-entry', error);
          }

          const timeState = classifyEntryTime(entry, observedAt, ttlMs);
          if (timeState === 'corrupted') {
            throw new AdminLeaveOverrideOutboxError('corrupted-entry');
          }
          if (timeState === 'expired') {
            throw new AdminLeaveOverrideOutboxError('expired-entry');
          }
          return entry;
        }

        // A transport failure can leave a committed server operation whose
        // receipt never reached this client. Until that exact persisted key is
        // acknowledged, a different payload in the same actor/workspace scope
        // must not mint another key and duplicate business side effects.
        if (findScopeStorageKeys(storage, scope).length > 0) {
          throw new AdminLeaveOverrideOutboxError('unresolved-operation');
        }

        let key: string;
        try {
          key = normalizeIdempotencyKey(options.keyFactory());
        } catch (error) {
          throw wrapError('configuration', error);
        }
        const entry: AdminLeaveOverrideOutboxEntry = {
          version: ADMIN_LEAVE_OVERRIDE_OUTBOX_VERSION,
          scope,
          payloadDigest,
          key,
          createdAt: observedAt,
        };
        writeAndVerify(storage, storageKey, JSON.stringify(entry));
        return entry;
      });
    },

    async complete(entryInput) {
      const scope = normalizeScope(entryInput.scope);
      const payloadDigest = normalizeDigest(entryInput.payloadDigest);
      const expectedKey = normalizeIdempotencyKey(entryInput.key);
      const storageKey = buildStorageKey(scope, payloadDigest);

      return lock.run(() => {
        const storage = resolveStorage();
        const raw = storageGet(storage, storageKey);
        if (raw === null) return false;

        let persisted: AdminLeaveOverrideOutboxEntry;
        try {
          persisted = decodeEntry(raw, storageKey);
        } catch (error) {
          throw new AdminLeaveOverrideOutboxError('corrupted-entry', error);
        }
        if (persisted.key !== expectedKey) return false;

        removeAndVerify(storage, storageKey);
        return true;
      });
    },
  };
}
