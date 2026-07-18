import { describe, expect, it, vi } from "vitest";
import {
  NativeAuthStorageError,
  buildSupabaseAuthStorageIdentity,
  createNativeAuthStorageRuntime,
  type LegacyAuthStorage,
  type SecureStringStore,
} from "@/lib/platform/nativeAuthStorage";

class MemoryLegacyStorage implements LegacyAuthStorage {
  readonly values = new Map<string, string>();
  readonly removed: string[] = [];
  readonly failRemoveKeys = new Set<string>();
  readonly failSetKeys = new Set<string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failSetKeys.has(key)) throw new Error("simulated legacy set failure");
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.removed.push(key);
    if (this.failRemoveKeys.has(key)) throw new Error("simulated legacy remove failure");
    this.values.delete(key);
  }
}

class MemorySecureStore implements SecureStringStore {
  readonly values = new Map<string, string>();
  readonly writes: Array<{ key: string; value: string }> = [];
  failWrite = false;
  failRemove = false;
  corruptReadback = false;

  async getItem(key: string): Promise<string | null> {
    const value = this.values.get(key) ?? null;
    return this.corruptReadback && value !== null ? `${value}-corrupt` : value;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.failWrite) throw new Error("simulated secure write failure");
    this.writes.push({ key, value });
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.failRemove) throw new Error("simulated secure remove failure");
    this.values.delete(key);
  }
}

const PROJECT_REF = "project-ref";
const identity = buildSupabaseAuthStorageIdentity(
  "https://project-ref.supabase.co",
  PROJECT_REF,
);

function runtime(
  secureStore = new MemorySecureStore(),
  legacyStorage = new MemoryLegacyStorage(),
) {
  return {
    secureStore,
    legacyStorage,
    runtime: createNativeAuthStorageRuntime({
      projectRef: PROJECT_REF,
      storageKey: identity.storageKey,
      secureStore,
      legacyStorage,
    }),
  };
}

describe("native Supabase auth storage", () => {
  it("uses an explicit stable key and an exact three-key allowlist", () => {
    expect(identity).toEqual({
      projectRef: PROJECT_REF,
      storageKey: "sb-project-ref-auth-token",
      sessionKey: "sb-project-ref-auth-token",
      verifierKey: "sb-project-ref-auth-token-code-verifier",
      userKey: "sb-project-ref-auth-token-user",
    });
    expect(() =>
      buildSupabaseAuthStorageIdentity("https://other.supabase.co", PROJECT_REF),
    ).toThrow(NativeAuthStorageError);
  });

  it("never serializes a native plugin cause into a public storage error", () => {
    const error = new NativeAuthStorageError("secure-store-unavailable", {
      accessToken: "must-not-reach-logs",
      osStatus: -34018,
    });

    expect(error).not.toHaveProperty("originalCause");
    expect(JSON.stringify(error)).not.toContain("must-not-reach-logs");
    expect(JSON.stringify(error)).not.toContain("-34018");
  });

  it("migrates all raw Supabase values only after a verified secure commit", async () => {
    const { secureStore, legacyStorage, runtime: authRuntime } = runtime();
    const values = {
      [identity.sessionKey]: '{"access_token":"access","refresh_token":"refresh"}',
      [identity.verifierKey]: '"verifier/PASSWORD_RECOVERY"',
      [identity.userKey]: '{"user":{"id":"user-id"}}',
    };
    Object.entries(values).forEach(([key, value]) => legacyStorage.values.set(key, value));

    await authRuntime.ready();

    await expect(authRuntime.storage.getItem(identity.sessionKey)).resolves.toBe(
      values[identity.sessionKey],
    );
    await expect(authRuntime.storage.getItem(identity.verifierKey)).resolves.toBe(
      values[identity.verifierKey],
    );
    await expect(authRuntime.storage.getItem(identity.userKey)).resolves.toBe(
      values[identity.userKey],
    );
    expect(legacyStorage.removed).toEqual(expect.arrayContaining(Object.keys(values)));
    expect(secureStore.writes).toHaveLength(1);
    expect(JSON.parse(secureStore.writes[0].value)).toMatchObject({
      schema: 1,
      projectRef: PROJECT_REF,
      values,
    });
  });

  it("never deletes legacy values when secure write or readback verification fails", async () => {
    for (const failure of ["write", "readback"] as const) {
      const secureStore = new MemorySecureStore();
      const legacyStorage = new MemoryLegacyStorage();
      legacyStorage.values.set(identity.sessionKey, "legacy-session");
      if (failure === "write") secureStore.failWrite = true;
      else secureStore.corruptReadback = true;

      const authRuntime = createNativeAuthStorageRuntime({
        projectRef: PROJECT_REF,
        storageKey: identity.storageKey,
        secureStore,
        legacyStorage,
      });

      await expect(authRuntime.ready()).rejects.toBeInstanceOf(NativeAuthStorageError);
      expect(legacyStorage.values.get(identity.sessionKey)).toBe("legacy-session");
      expect(legacyStorage.removed).not.toContain(identity.sessionKey);
    }
  });

  it("treats a valid secure envelope as authoritative and cleans stale legacy copies", async () => {
    const first = runtime();
    first.legacyStorage.values.set(identity.sessionKey, "secure-session");
    await first.runtime.ready();

    const secondLegacy = new MemoryLegacyStorage();
    secondLegacy.values.set(first.runtime.installMarkerKey, "1");
    secondLegacy.values.set(identity.sessionKey, "stale-legacy-session");
    const second = createNativeAuthStorageRuntime({
      projectRef: PROJECT_REF,
      storageKey: identity.storageKey,
      secureStore: first.secureStore,
      legacyStorage: secondLegacy,
    });

    await second.ready();

    await expect(second.storage.getItem(identity.sessionKey)).resolves.toBe("secure-session");
    expect(secondLegacy.values.has(identity.sessionKey)).toBe(false);
  });

  it("clears an iOS-style surviving keychain session when the install marker is gone", async () => {
    const first = runtime();
    first.legacyStorage.values.set(identity.sessionKey, "previous-install-session");
    await first.runtime.ready();

    const freshSandbox = new MemoryLegacyStorage();
    const reinstalled = createNativeAuthStorageRuntime({
      projectRef: PROJECT_REF,
      storageKey: identity.storageKey,
      secureStore: first.secureStore,
      legacyStorage: freshSandbox,
    });

    await reinstalled.ready();

    await expect(reinstalled.storage.getItem(identity.sessionKey)).resolves.toBeNull();
    expect(freshSandbox.values.get(reinstalled.installMarkerKey)).toBe("1");
  });

  it("rejects corrupt/cross-project envelopes and unknown keys without fallback", async () => {
    for (const envelope of [
      "not-json",
      JSON.stringify({ schema: 1, projectRef: "other", revision: 1, values: {} }),
      JSON.stringify({
        schema: 1,
        projectRef: PROJECT_REF,
        revision: 1,
        values: { unexpected: "secret" },
      }),
    ]) {
      const { secureStore, legacyStorage, runtime: authRuntime } = runtime();
      secureStore.values.set(authRuntime.envelopeKey, envelope);
      legacyStorage.values.set(authRuntime.installMarkerKey, "1");
      await expect(authRuntime.ready()).rejects.toBeInstanceOf(NativeAuthStorageError);
    }

    const { runtime: authRuntime } = runtime();
    await authRuntime.ready();
    await expect(authRuntime.storage.getItem("untrusted-key")).rejects.toMatchObject({
      code: "unsupported-key",
    });
  });

  it("linearizes concurrent mutations and keeps the last verified state", async () => {
    const { runtime: authRuntime } = runtime();
    await authRuntime.ready();

    await Promise.all([
      authRuntime.storage.setItem(identity.sessionKey, "session"),
      authRuntime.storage.setItem(identity.verifierKey, "verifier"),
      authRuntime.storage.setItem(identity.userKey, "user"),
    ]);
    await authRuntime.storage.removeItem(identity.verifierKey);

    await expect(authRuntime.storage.getItem(identity.sessionKey)).resolves.toBe("session");
    await expect(authRuntime.storage.getItem(identity.userKey)).resolves.toBe("user");
    await expect(authRuntime.storage.getItem(identity.verifierKey)).resolves.toBeNull();
  });

  it("clears all three local Supabase credentials in one verified mutation", async () => {
    const { secureStore, runtime: authRuntime } = runtime();
    await authRuntime.ready();
    await authRuntime.storage.setItem(identity.sessionKey, "session");
    await authRuntime.storage.setItem(identity.verifierKey, "verifier");
    await authRuntime.storage.setItem(identity.userKey, "user");
    const writesBeforeClear = secureStore.writes.length;

    await authRuntime.clearSession();

    expect(secureStore.writes).toHaveLength(writesBeforeClear + 1);
    await expect(authRuntime.storage.getItem(identity.sessionKey)).resolves.toBeNull();
    await expect(authRuntime.storage.getItem(identity.verifierKey)).resolves.toBeNull();
    await expect(authRuntime.storage.getItem(identity.userKey)).resolves.toBeNull();
  });

  it("does not mutate its in-memory cache after a failed secure write", async () => {
    const { secureStore, runtime: authRuntime } = runtime();
    await authRuntime.ready();
    await authRuntime.storage.setItem(identity.sessionKey, "before");

    secureStore.failWrite = true;
    await expect(authRuntime.storage.setItem(identity.sessionKey, "after")).rejects.toBeInstanceOf(
      NativeAuthStorageError,
    );
    secureStore.failWrite = false;

    await expect(authRuntime.storage.getItem(identity.sessionKey)).resolves.toBe("before");
  });

  it("serializes the Supabase auth lock", async () => {
    const { runtime: authRuntime } = runtime();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = authRuntime.lock("auth", -1, async () => {
      events.push("first-start");
      await firstCanFinish;
      events.push("first-end");
    });
    const second = authRuntime.lock("auth", -1, async () => {
      events.push("second");
    });

    await vi.waitFor(() => expect(events).toEqual(["first-start"]));
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["first-start", "first-end", "second"]);
  });

  it("marks a non-blocking lock miss with the Supabase acquire-timeout contract", async () => {
    const { runtime: authRuntime } = runtime();
    let releaseFirst!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = authRuntime.lock("auth", -1, () => firstCanFinish);
    await expect(authRuntime.lock("auth", 0, async () => undefined)).rejects.toMatchObject({
      code: "lock-timeout",
      isAcquireTimeout: true,
    });

    releaseFirst();
    await first;
  });

  it("blocks an auth write that arrives after an explicit reset has started", async () => {
    const { runtime: authRuntime } = runtime();
    const events: string[] = [];
    let finishNetworkRequest!: () => void;
    const networkRequest = new Promise<void>((resolve) => {
      finishNetworkRequest = resolve;
    });

    // Supabase signInWithPassword performs its network request without the
    // configured auth lock and persists the returned session afterwards.
    const inFlightLogin = (async () => {
      events.push("network-start");
      await networkRequest;
      await authRuntime.storage.setItem(identity.sessionKey, "late-session");
      events.push("session-written");
    })();
    await vi.waitFor(() => expect(events).toEqual(["network-start"]));

    await authRuntime.reset();
    events.push("reset");
    finishNetworkRequest();

    await expect(inFlightLogin).rejects.toMatchObject({ code: "reset-required" });
    expect(events).toEqual(["network-start", "reset"]);
    await expect(authRuntime.storage.getItem(identity.sessionKey)).rejects.toMatchObject({
      code: "reset-required",
    });
  });

  it("clears every legacy auth value even when secure deletion fails", async () => {
    const { secureStore, legacyStorage, runtime: authRuntime } = runtime();
    legacyStorage.values.set(identity.sessionKey, "legacy-session");
    legacyStorage.values.set(identity.verifierKey, "legacy-verifier");
    legacyStorage.values.set(identity.userKey, "legacy-user");
    secureStore.failWrite = true;
    secureStore.failRemove = true;

    await expect(authRuntime.reset()).rejects.toMatchObject({ code: "reset-incomplete" });

    expect(legacyStorage.values.has(identity.sessionKey)).toBe(false);
    expect(legacyStorage.values.has(identity.verifierKey)).toBe(false);
    expect(legacyStorage.values.has(identity.userKey)).toBe(false);
    expect(legacyStorage.values.get(authRuntime.installMarkerKey)).toBe("reset-pending");
  });

  it("attempts every legacy credential deletion after an individual remove failure", async () => {
    const { legacyStorage, runtime: authRuntime } = runtime();
    for (const key of [identity.sessionKey, identity.verifierKey, identity.userKey]) {
      legacyStorage.values.set(key, `value:${key}`);
    }
    legacyStorage.failRemoveKeys.add(identity.sessionKey);

    await expect(authRuntime.reset()).rejects.toMatchObject({ code: "reset-incomplete" });

    expect(legacyStorage.removed).toEqual(
      expect.arrayContaining([identity.sessionKey, identity.verifierKey, identity.userKey]),
    );
    expect(legacyStorage.values.has(identity.verifierKey)).toBe(false);
    expect(legacyStorage.values.has(identity.userKey)).toBe(false);
    expect(legacyStorage.values.get(authRuntime.installMarkerKey)).toBe("reset-pending");
  });

  it("keeps an empty secure tombstone when the reset marker and a legacy delete fail", async () => {
    const { secureStore, legacyStorage, runtime: authRuntime } = runtime();
    await authRuntime.ready();
    await authRuntime.storage.setItem(identity.sessionKey, "secure-session");
    legacyStorage.values.set(identity.sessionKey, "stale-legacy-session");
    legacyStorage.failSetKeys.add(authRuntime.installMarkerKey);
    legacyStorage.failRemoveKeys.add(identity.sessionKey);

    await expect(authRuntime.reset()).rejects.toMatchObject({ code: "reset-incomplete" });

    const tombstone = JSON.parse(secureStore.values.get(authRuntime.envelopeKey) ?? "null");
    expect(tombstone).toMatchObject({
      schema: 1,
      projectRef: PROJECT_REF,
      values: {},
    });

    legacyStorage.failSetKeys.clear();
    legacyStorage.failRemoveKeys.clear();
    const restarted = createNativeAuthStorageRuntime({
      projectRef: PROJECT_REF,
      storageKey: identity.storageKey,
      secureStore,
      legacyStorage,
    });
    await restarted.ready();
    await expect(restarted.storage.getItem(identity.sessionKey)).resolves.toBeNull();
    expect(legacyStorage.values.has(identity.sessionKey)).toBe(false);
  });

  it("does not delete the former secure envelope when no durable reset guard can be written", async () => {
    const { secureStore, legacyStorage, runtime: authRuntime } = runtime();
    await authRuntime.ready();
    await authRuntime.storage.setItem(identity.sessionKey, "secure-session");
    const previousEnvelope = secureStore.values.get(authRuntime.envelopeKey);
    legacyStorage.values.set(identity.sessionKey, "stale-legacy-session");
    legacyStorage.failSetKeys.add(authRuntime.installMarkerKey);
    legacyStorage.failRemoveKeys.add(identity.sessionKey);
    secureStore.failWrite = true;

    await expect(authRuntime.reset()).rejects.toMatchObject({ code: "reset-incomplete" });

    expect(secureStore.values.get(authRuntime.envelopeKey)).toBe(previousEnvelope);
    expect(legacyStorage.values.get(identity.sessionKey)).toBe("stale-legacy-session");
  });
});
