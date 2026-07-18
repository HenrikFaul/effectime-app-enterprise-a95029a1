// Direct creation with an administrator-chosen password is deliberately
// disabled. Confirming an arbitrary email through a privileged directory API lets a
// workspace administrator pre-claim a global identity that may later be
// invited by another tenant. New members must prove mailbox ownership through
// the tokenized invitation flow until a managed-domain/SCIM contract exists.

import { corsHeaders } from "../_shared/cors.ts";

function jsonRes(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return jsonRes({
    error: "Direct account creation is disabled; send a verified email invitation instead",
    code: "DIRECT_CREATE_DISABLED",
  }, 409);
});
