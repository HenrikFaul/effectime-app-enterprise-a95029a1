import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { createBoundedFetch } from "./bounded-fetch.ts";
import {
  type CleanupTempUsersDependencies,
  createCleanupTempUsersHandler,
} from "./handler.ts";

const handler = createCleanupTempUsersHandler({
  loadConfig: () => ({
    supabaseUrl: Deno.env.get("SUPABASE_URL"),
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  }),
  createDependencies: ({ config, deadlineAt, operationTimeoutMs }) => {
    const admin = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: createBoundedFetch({ deadlineAt, operationTimeoutMs }),
      },
    });
    const dependencies: CleanupTempUsersDependencies = {
      claimEligibleProfiles: async (limit) =>
        await admin.rpc("claim_eligible_temporary_profiles_v1", {
          p_limit: limit,
        }),
      prepareProfileCleanup: async (userId, leaseToken) =>
        await admin.rpc("prepare_temporary_profile_cleanup_v1", {
          p_user_id: userId,
          p_lease_token: leaseToken,
        }),
      completeProfileCleanup: async (userId, leaseToken) =>
        await admin.rpc("complete_temporary_profile_cleanup_v1", {
          p_user_id: userId,
          p_lease_token: leaseToken,
        }),
      getAuthUser: (userId) => admin.auth.admin.getUserById(userId),
      deleteAuthUser: (userId) => admin.auth.admin.deleteUser(userId),
    };
    return dependencies;
  },
});

Deno.serve(handler);
