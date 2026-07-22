import type { AuthAdminUserResult } from "../_shared/temporary-user-cleanup.ts";

export {
  cleanupTemporaryUserAuthFirst,
  type TemporaryUserCleanupResult,
} from "../_shared/temporary-user-cleanup.ts";

export type AuthAdminUpdateResult = AuthAdminUserResult;

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
