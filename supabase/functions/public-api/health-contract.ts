import {
  EFFECTIME_RELEASE_EXPOSE_HEADERS,
  effectimeReleaseResponseHeaders,
} from "../_shared/release-http-contract.ts";
import type { EffectimeReleaseIdentity } from "../_shared/release-identity.ts";

export const PUBLIC_API_EXPOSE_HEADERS =
  `X-Request-Id, X-RateLimit-Remaining, ${EFFECTIME_RELEASE_EXPOSE_HEADERS}`;

export function buildPublicApiHealthContract(input: {
  keyName: string | null;
  release: EffectimeReleaseIdentity;
  requestId: string;
  workspaceId: string;
}) {
  return {
    body: {
      data: {
        ok: true,
        workspace_id: input.workspaceId,
        key_name: input.keyName,
        release: input.release,
      },
      meta: { request_id: input.requestId },
    },
    headers: effectimeReleaseResponseHeaders(
      input.release,
      PUBLIC_API_EXPOSE_HEADERS,
    ),
  } as const;
}
