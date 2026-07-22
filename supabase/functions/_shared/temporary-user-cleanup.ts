export type AuthAdminUserResult = {
  data: {
    user: {
      id: string;
    } | null;
  } | null;
  error: unknown;
};

export type TemporaryUserCleanupResult =
  | { ok: true }
  | {
    ok: false;
    reason:
      | "auth_lookup_failed"
      | "auth_delete_failed"
      | "database_cleanup_failed";
  };

function isAuthoritativeMissingUser(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; status?: unknown };
  return candidate.code === "user_not_found" && candidate.status === 404;
}

function authUserState(
  result: AuthAdminUserResult,
  expectedUserId: string,
): "present" | "missing" | "unknown" {
  if (!result.error && result.data?.user?.id === expectedUserId) {
    return "present";
  }
  if (!result.data?.user && isAuthoritativeMissingUser(result.error)) {
    return "missing";
  }
  return "unknown";
}

async function readAuthUserState(
  expectedUserId: string,
  getAuthUser: () => Promise<AuthAdminUserResult>,
): Promise<"present" | "missing" | "unknown"> {
  try {
    return authUserState(await getAuthUser(), expectedUserId);
  } catch {
    return "unknown";
  }
}

/**
 * Removes one exact Auth identity and proves absence before database cleanup.
 * A delete response alone is not authoritative: the post-delete lookup is the
 * commit proof, and an already-absent identity makes retries idempotent.
 */
async function deleteTemporaryAuthIdentityVerified(options: {
  expectedUserId: string;
  getAuthUser: () => Promise<AuthAdminUserResult>;
  deleteAuthUser: () => Promise<AuthAdminUserResult>;
}): Promise<Exclude<TemporaryUserCleanupResult, { ok: true }> | { ok: true }> {
  let state = await readAuthUserState(
    options.expectedUserId,
    options.getAuthUser,
  );
  if (state === "missing") return { ok: true };
  if (state === "unknown") {
    return { ok: false, reason: "auth_lookup_failed" };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await options.deleteAuthUser();
    } catch {
      // An interrupted request may still have committed remotely. The exact-ID
      // lookup below determines whether database cleanup is safe to continue.
    }

    state = await readAuthUserState(
      options.expectedUserId,
      options.getAuthUser,
    );
    if (state === "missing") return { ok: true };
    if (state === "unknown") {
      return { ok: false, reason: "auth_lookup_failed" };
    }
  }

  return { ok: false, reason: "auth_delete_failed" };
}

export async function cleanupTemporaryUserAuthFirst(options: {
  expectedUserId: string;
  getAuthUser: () => Promise<AuthAdminUserResult>;
  deleteAuthUser: () => Promise<AuthAdminUserResult>;
  deleteDatabaseRows: readonly (() => Promise<boolean>)[];
}): Promise<TemporaryUserCleanupResult> {
  const authCleanup = await deleteTemporaryAuthIdentityVerified(options);
  if (!authCleanup.ok) return authCleanup;

  for (const deleteRows of options.deleteDatabaseRows) {
    try {
      if (!(await deleteRows())) {
        return { ok: false, reason: "database_cleanup_failed" };
      }
    } catch {
      return { ok: false, reason: "database_cleanup_failed" };
    }
  }

  return { ok: true };
}
