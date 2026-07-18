import { effectimeReleaseResponseHeaders } from "../_shared/release-http-contract.ts";
import type { EffectimeReleaseIdentity } from "../_shared/release-identity.ts";

export function buildPlatformVersionContract(input: {
  knownFunctions: readonly string[];
  release: EffectimeReleaseIdentity;
  supabaseProjectUrl: string | null;
  timestamp: string;
}) {
  return {
    body: {
      timestamp: input.timestamp,
      supabase_url: input.supabaseProjectUrl,
      release: input.release,
      function_count: input.knownFunctions.length,
      functions: [...input.knownFunctions],
      runtime: "Deno (Supabase Edge Runtime)",
      note:
        "CHANGELOG not available from edge function — read from versioning files",
    },
    headers: effectimeReleaseResponseHeaders(input.release),
  } as const;
}
