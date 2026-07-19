import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_LEAVE_OVERRIDE_OUTBOX_TTL_MS,
  AdminLeaveOverrideOutboxError,
  createAdminLeaveOverrideOutbox,
  sha256AdminLeaveOverridePayload,
  type AdminLeaveOverrideOutboxStorage,
} from '@/lib/adminLeaveOverrideOutbox';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherActorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const firstKey = '10000000-0000-4000-8000-000000000001';
const secondKey = '20000000-0000-4000-8000-000000000002';
const thirdKey = '30000000-0000-4000-8000-000000000003';
const digestA = 'a'.repeat(64);
const digestB = 'b'.repeat(64);
const digestC = 'c'.repeat(64);
const initialTime = 1_800_000_000_000;

beforeEach(() => {
  vi.stubGlobal('navigator', {
    locks: {
      request: vi.fn((
        _name: string,
        _options: LockOptions,
        operation: () => unknown,
      ) => Promise.resolve(operation())),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

class MemoryStorage implements AdminLeaveOverrideOutboxStorage {
  protected readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  entries(): Array<[string, string]> {
    return Array.from(this.values.entries());
  }
}

function digestPayload(payload: string): Promise<string> {
  if (payload === 'payload-a') return Promise.resolve(digestA);
  if (payload === 'payload-b') return Promise.resolve(digestB);
  if (payload === 'payload-c') return Promise.resolve(digestC);
  throw new Error('Unexpected test payload');
}

function expectOutboxError(
  error: unknown,
  code: AdminLeaveOverrideOutboxError['code'],
): boolean {
  expect(error).toBeInstanceOf(AdminLeaveOverrideOutboxError);
  expect((error as AdminLeaveOverrideOutboxError).code).toBe(code);
  return true;
}

describe('admin leave override crash-safe outbox', () => {
  it('fails closed before key generation when origin-wide coordination is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const storage = new MemoryStorage();
    const keyFactory = vi.fn(() => firstKey);
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory,
      digestPayload,
      now: () => initialTime,
    });

    await expect(outbox.getOrCreate({ workspaceId, actorId }, 'payload-a'))
      .rejects.toSatisfy(error => expectOutboxError(error, 'coordination-unavailable'));
    expect(keyFactory).not.toHaveBeenCalled();
    expect(storage.length).toBe(0);
  });

  it('computes the standard SHA-256 digest without persisting or logging the payload', async () => {
    await expect(sha256AdminLeaveOverridePayload(
      'abc',
      webcrypto as unknown as Crypto,
    )).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

    await expect(sha256AdminLeaveOverridePayload(
      'sensitive justification and comment',
      { subtle: undefined as unknown as SubtleCrypto },
    )).rejects.toSatisfy(error => expectOutboxError(error, 'crypto-unavailable'));
  });

  it('persists only version, scope, digest, UUID key and creation time', async () => {
    const storage = new MemoryStorage();
    const rawPayload = JSON.stringify([
      workspaceId,
      'target-user',
      'private justification sentinel',
      'private comment sentinel',
    ]);
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory: () => firstKey,
      digestPayload: async value => sha256AdminLeaveOverridePayload(
        value,
        webcrypto as unknown as Crypto,
      ),
      now: () => initialTime,
    });

    const entry = await outbox.getOrCreate({ workspaceId, actorId }, rawPayload);
    expect(entry.key).toBe(firstKey);
    expect(storage.length).toBe(1);

    const [[storageKey, serialized]] = storage.entries();
    expect(storageKey).not.toContain('private justification sentinel');
    expect(serialized).not.toContain('private justification sentinel');
    expect(serialized).not.toContain('private comment sentinel');
    expect(Object.keys(JSON.parse(serialized)).sort()).toEqual([
      'createdAt',
      'key',
      'payloadDigest',
      'scope',
      'version',
    ]);
    expect(Object.keys(JSON.parse(serialized).scope).sort()).toEqual(['actorId', 'workspaceId']);
  });

  it('restores the exact key after restart and blocks a divergent payload until completion', async () => {
    const storage = new MemoryStorage();
    const keyFactory = vi.fn()
      .mockReturnValueOnce(firstKey)
      .mockReturnValueOnce(secondKey)
      .mockReturnValueOnce(thirdKey);
    const options = {
      storage,
      keyFactory,
      digestPayload,
      now: () => initialTime,
    };

    const firstRuntime = createAdminLeaveOverrideOutbox(options);
    const firstA = await firstRuntime.getOrCreate({ workspaceId, actorId }, 'payload-a');
    await expect(firstRuntime.getOrCreate({ workspaceId, actorId }, 'payload-b'))
      .rejects.toSatisfy(error => expectOutboxError(error, 'unresolved-operation'));

    const restartedRuntime = createAdminLeaveOverrideOutbox(options);
    const restoredA = await restartedRuntime.getOrCreate({ workspaceId, actorId }, 'payload-a');
    await restartedRuntime.complete(restoredA);
    const firstB = await restartedRuntime.getOrCreate({ workspaceId, actorId }, 'payload-b');

    expect(firstA.key).toBe(firstKey);
    expect(firstB.key).toBe(secondKey);
    expect(restoredA).toEqual(firstA);
    expect(keyFactory).toHaveBeenCalledTimes(2);
    expect(storage.length).toBe(1);
  });

  it('isolates identical payloads by workspace and authenticated actor scope', async () => {
    const storage = new MemoryStorage();
    const keyFactory = vi.fn()
      .mockReturnValueOnce(firstKey)
      .mockReturnValueOnce(secondKey)
      .mockReturnValueOnce(thirdKey);
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory,
      digestPayload,
      now: () => initialTime,
    });

    const base = await outbox.getOrCreate({ workspaceId, actorId }, 'payload-a');
    const otherActor = await outbox.getOrCreate(
      { workspaceId, actorId: otherActorId },
      'payload-a',
    );
    const otherWorkspace = await outbox.getOrCreate(
      { workspaceId: otherWorkspaceId, actorId },
      'payload-a',
    );

    expect(new Set([base.key, otherActor.key, otherWorkspace.key]).size).toBe(3);
    expect(storage.length).toBe(3);
  });

  it('completes only the exact entry and leaves unresolved evidence in other scopes untouched', async () => {
    const storage = new MemoryStorage();
    const keyFactory = vi.fn()
      .mockReturnValueOnce(firstKey)
      .mockReturnValueOnce(secondKey)
      .mockReturnValueOnce(thirdKey);
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory,
      digestPayload,
      now: () => initialTime,
    });

    const base = await outbox.getOrCreate({ workspaceId, actorId }, 'payload-a');
    const otherScope = await outbox.getOrCreate(
      { workspaceId: otherWorkspaceId, actorId },
      'payload-a',
    );

    await expect(outbox.complete(base)).resolves.toBe(true);
    const replacement = await outbox.getOrCreate({ workspaceId, actorId }, 'payload-b');
    await expect(outbox.getOrCreate(
      { workspaceId: otherWorkspaceId, actorId },
      'payload-b',
    )).rejects.toSatisfy(error => expectOutboxError(error, 'unresolved-operation'));
    await expect(outbox.getOrCreate(
      { workspaceId: otherWorkspaceId, actorId },
      'payload-a',
    )).resolves.toEqual(otherScope);

    expect(replacement.key).toBe(thirdKey);
    expect(keyFactory).toHaveBeenCalledTimes(3);
    expect(storage.length).toBe(2);
  });

  it('serializes same-runtime contenders and creates only one durable key', async () => {
    const storage = new MemoryStorage();
    const keyFactory = vi.fn(() => firstKey);
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory,
      digestPayload: async () => {
        await Promise.resolve();
        return digestA;
      },
      now: () => initialTime,
    });

    const [first, second, third] = await Promise.all([
      outbox.getOrCreate({ workspaceId, actorId }, 'payload-a'),
      outbox.getOrCreate({ workspaceId, actorId }, 'payload-a'),
      outbox.getOrCreate({ workspaceId, actorId }, 'payload-a'),
    ]);

    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(keyFactory).toHaveBeenCalledOnce();
    expect(storage.length).toBe(1);
  });

  it('removes an acknowledged attempt only when its UUID still matches', async () => {
    const storage = new MemoryStorage();
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory: () => firstKey,
      digestPayload,
      now: () => initialTime,
    });
    const entry = await outbox.getOrCreate({ workspaceId, actorId }, 'payload-a');

    await expect(outbox.complete({ ...entry, key: secondKey })).resolves.toBe(false);
    expect(storage.length).toBe(1);
    await expect(outbox.complete(entry)).resolves.toBe(true);
    expect(storage.length).toBe(0);
    await expect(outbox.complete(entry)).resolves.toBe(false);
  });

  it('retains an expired attempt as reconciliation evidence and never generates a replacement key', async () => {
    const storage = new MemoryStorage();
    let observedAt = initialTime;
    const keyFactory = vi.fn()
      .mockReturnValueOnce(firstKey)
      .mockReturnValueOnce(secondKey);
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory,
      digestPayload,
      now: () => observedAt,
    });
    await outbox.getOrCreate({ workspaceId, actorId }, 'payload-a');
    observedAt += ADMIN_LEAVE_OVERRIDE_OUTBOX_TTL_MS;

    await expect(outbox.getOrCreate({ workspaceId, actorId }, 'payload-a'))
      .rejects.toSatisfy(error => expectOutboxError(error, 'expired-entry'));
    await expect(outbox.getOrCreate({ workspaceId, actorId }, 'payload-b'))
      .rejects.toSatisfy(error => expectOutboxError(error, 'unresolved-operation'));
    expect(storage.length).toBe(1);
    expect(keyFactory).toHaveBeenCalledOnce();
  });

  it.each([
    ['invalid JSON', '{'],
    ['unexpected persisted field', JSON.stringify({ rawJustification: 'must-not-survive' })],
  ])('retains %s as reconciliation evidence without generating another key', async (_label, corruptValue) => {
    const storage = new MemoryStorage();
    const keyFactory = vi.fn(() => firstKey);
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory,
      digestPayload,
      now: () => initialTime,
    });
    await outbox.getOrCreate({ workspaceId, actorId }, 'payload-a');
    const [[storageKey]] = storage.entries();
    storage.setItem(storageKey, corruptValue);
    keyFactory.mockClear();

    await expect(outbox.getOrCreate({ workspaceId, actorId }, 'payload-a'))
      .rejects.toSatisfy(error => expectOutboxError(error, 'corrupted-entry'));
    await expect(outbox.getOrCreate({ workspaceId, actorId }, 'payload-b'))
      .rejects.toSatisfy(error => expectOutboxError(error, 'unresolved-operation'));
    expect(storage.getItem(storageKey)).toBe(corruptValue);
    expect(keyFactory).not.toHaveBeenCalled();
  });

  it('treats a far-future timestamp as corruption without deleting evidence', async () => {
    const storage = new MemoryStorage();
    const keyFactory = vi.fn(() => firstKey);
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory,
      digestPayload,
      now: () => initialTime,
    });
    await outbox.getOrCreate({ workspaceId, actorId }, 'payload-a');
    const [[storageKey, serialized]] = storage.entries();
    const record = JSON.parse(serialized);
    record.createdAt = initialTime + 10 * 60 * 1000;
    storage.setItem(storageKey, JSON.stringify(record));
    keyFactory.mockClear();

    await expect(outbox.getOrCreate({ workspaceId, actorId }, 'payload-a'))
      .rejects.toSatisfy(error => expectOutboxError(error, 'corrupted-entry'));
    await expect(outbox.getOrCreate({ workspaceId, actorId }, 'payload-b'))
      .rejects.toSatisfy(error => expectOutboxError(error, 'unresolved-operation'));
    expect(storage.length).toBe(1);
    expect(storage.getItem(storageKey)).toBe(JSON.stringify(record));
    expect(keyFactory).not.toHaveBeenCalled();
  });

  it('retains corrupt evidence when exact completion cannot be verified', async () => {
    const storage = new MemoryStorage();
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory: () => firstKey,
      digestPayload,
      now: () => initialTime,
    });
    const entry = await outbox.getOrCreate({ workspaceId, actorId }, 'payload-a');
    const [[storageKey]] = storage.entries();
    storage.setItem(storageKey, '{');

    await expect(outbox.complete(entry))
      .rejects.toSatisfy(error => expectOutboxError(error, 'corrupted-entry'));
    expect(storage.getItem(storageKey)).toBe('{');
  });

  it('lets corrupt evidence block a divergent payload and preserves unrelated storage', async () => {
    const storage = new MemoryStorage();
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory: () => firstKey,
      digestPayload,
      now: () => initialTime,
    });
    await outbox.getOrCreate({ workspaceId, actorId }, 'payload-a');
    const [[storageKey]] = storage.entries();
    storage.setItem(storageKey, 'not-json');
    storage.setItem('unrelated.application.state', 'preserve-me');

    await expect(outbox.getOrCreate({ workspaceId, actorId }, 'payload-b'))
      .rejects.toSatisfy(error => expectOutboxError(error, 'unresolved-operation'));
    expect(storage.getItem(storageKey)).toBe('not-json');
    expect(storage.getItem('unrelated.application.state')).toBe('preserve-me');
  });

  it('fails closed when persistence cannot be read back byte-for-byte', async () => {
    class UnverifiableStorage extends MemoryStorage {
      override setItem(key: string, value: string): void {
        super.setItem(key, `${value}tampered`);
      }
    }

    const storage = new UnverifiableStorage();
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory: () => firstKey,
      digestPayload,
      now: () => initialTime,
    });

    await expect(outbox.getOrCreate({ workspaceId, actorId }, 'payload-a'))
      .rejects.toSatisfy(error => expectOutboxError(error, 'write-verification'));
  });

  it('never exposes raw scope, key, payload or storage diagnostics in public errors', async () => {
    const storage = new MemoryStorage();
    const privatePayload = 'private-justification private-comment';
    const outbox = createAdminLeaveOverrideOutbox({
      storage,
      keyFactory: () => firstKey,
      digestPayload: async () => digestA,
      now: () => initialTime,
    });
    await outbox.getOrCreate({ workspaceId, actorId }, privatePayload);
    const [[storageKey]] = storage.entries();
    storage.setItem(storageKey, '{');

    let error: AdminLeaveOverrideOutboxError | undefined;
    try {
      await outbox.getOrCreate({ workspaceId, actorId }, privatePayload);
    } catch (reason) {
      error = reason as AdminLeaveOverrideOutboxError;
    }
    expect(error).toBeInstanceOf(AdminLeaveOverrideOutboxError);
    if (!error) {
      throw new Error('Expected the corrupted outbox read to fail.');
    }
    expect(error.message).not.toContain(privatePayload);
    expect(error.message).not.toContain(workspaceId);
    expect(error.message).not.toContain(actorId);
    expect(error.message).not.toContain(firstKey);
    expect(error.message).not.toContain(storageKey);
  });
});
