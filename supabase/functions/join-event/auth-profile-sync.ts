export type AuthAdminUpdateResult = {
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

function isAuthUserNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; status?: unknown };
  return candidate.code === "user_not_found" && candidate.status === 404;
}

function authUserState(
  result: AuthAdminUpdateResult,
  expectedUserId: string,
): "present" | "missing" | "unknown" {
  if (!result.error && result.data?.user?.id === expectedUserId) {
    return "present";
  }
  if (!result.data?.user && isAuthUserNotFound(result.error)) return "missing";
  return "unknown";
}

export async function verifyAuthAdminUpdate(
  expectedUserId: string,
  updateAuth: () => Promise<AuthAdminUpdateResult>,
): Promise<boolean> {
  try {
    const result = await updateAuth();
    return !result.error && result.data?.user?.id === expectedUserId;
  } catch {
    return false;
  }
}

export async function cleanupTemporaryUserAuthFirst(options: {
  expectedUserId: string;
  getAuthUser: () => Promise<AuthAdminUpdateResult>;
  deleteAuthUser: () => Promise<AuthAdminUpdateResult>;
  deleteDatabaseRows: readonly (() => Promise<boolean>)[];
}): Promise<TemporaryUserCleanupResult> {
  let initialAuthState: "present" | "missing" | "unknown";
  try {
    initialAuthState = authUserState(
      await options.getAuthUser(),
      options.expectedUserId,
    );
  } catch {
    initialAuthState = "unknown";
  }
  if (initialAuthState === "unknown") {
    return { ok: false, reason: "auth_lookup_failed" };
  }

  if (initialAuthState === "present") {
    const authDeleted = await verifyAuthAdminUpdate(
      options.expectedUserId,
      options.deleteAuthUser,
    );
    if (!authDeleted) {
      let postDeleteAuthState: "present" | "missing" | "unknown";
      try {
        postDeleteAuthState = authUserState(
          await options.getAuthUser(),
          options.expectedUserId,
        );
      } catch {
        postDeleteAuthState = "unknown";
      }
      if (postDeleteAuthState !== "missing") {
        return { ok: false, reason: "auth_delete_failed" };
      }
    }
  }

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
