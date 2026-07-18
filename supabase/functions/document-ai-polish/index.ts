// Edge Function: document-ai-polish
// Optionally polishes a generated_documents row using Claude.
// Returns the original HTML unchanged when ANTHROPIC_API_KEY is not set,
// so the feature degrades gracefully in environments without AI keys.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkWorkspaceFeature } from "../_shared/feature-entitlement.ts";

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY           = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY  = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MAX_INSTRUCTION_LENGTH = 2_000;
const MAX_DOCUMENT_HTML_LENGTH = 100_000;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

    const { document_id, instruction } = await req.json().catch(() => ({}));
    if (typeof document_id !== "string" || !document_id) {
      return jsonRes({ error: "document_id is required" }, 400);
    }
    if (instruction !== undefined && (
      typeof instruction !== "string" || instruction.length > MAX_INSTRUCTION_LENGTH
    )) {
      return jsonRes({ error: "instruction is invalid or too long" }, 400);
    }

    // Fetch the document
    const { data: doc, error: docErr } = await admin
      .from("generated_documents")
      .select("id, workspace_id, content_html, doc_type, generated_by, status")
      .eq("id", document_id)
      .maybeSingle();

    if (docErr) {
      console.error("[document-ai-polish] document lookup failed:", docErr.message);
      return jsonRes({ error: "Service unavailable" }, 503);
    }
    if (!doc) return jsonRes({ error: "Document not found" }, 404);
    if (doc.status !== "draft") {
      return jsonRes({ error: "Only draft documents can be polished" }, 409);
    }

    // The creator may edit their own document. Workspace owners and resource
    // assistants may edit any document, including legacy rows without an owner.
    const { data: membership, error: membershipError } = await admin
      .from("enterprise_memberships")
      .select("id, role")
      .eq("workspace_id", doc.workspace_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      console.error("[document-ai-polish] membership lookup failed:", membershipError.message);
      return jsonRes({ error: "Service unavailable" }, 503);
    }
    if (!membership) return jsonRes({ error: "Forbidden" }, 403);

    const workspaceId = doc.workspace_id as string;
    const generatedBy = doc.generated_by as string | null;
    const role = membership.role as string;
    const canEdit = generatedBy === user.id || ["owner", "resourceAssistant"].includes(role);
    if (!canEdit) return jsonRes({ error: "Forbidden" }, 403);

    const entitlement = await checkWorkspaceFeature(admin, workspaceId, "document_generator");
    if (!entitlement.enabled) {
      if (entitlement.reason === "lookup_error") {
        console.error(
          `[document-ai-polish] entitlement lookup failed workspace=${workspaceId} feature=document_generator step=${entitlement.step}: ${entitlement.error}`,
        );
        return jsonRes({ error: "Feature entitlement is temporarily unavailable" }, 503);
      }
      console.warn(
        `[document-ai-polish] feature denied workspace=${workspaceId} feature=document_generator reason=${entitlement.reason}`,
      );
      return jsonRes({ error: "Forbidden" }, 403);
    }

    const originalHtml = doc.content_html as string;
    const docType = doc.doc_type as string;
    if (typeof originalHtml !== "string" || originalHtml.length > MAX_DOCUMENT_HTML_LENGTH) {
      return jsonRes({ error: "Document is too large for AI polishing" }, 413);
    }

    // No AI key — return unchanged with a hint
    if (!ANTHROPIC_API_KEY) {
      return jsonRes({
        ok: true,
        ai_available: false,
        polished_html: originalHtml,
        hint: "Configure ANTHROPIC_API_KEY in Supabase secrets to enable AI document polishing.",
      });
    }

    const systemPrompt =
      "You are a professional HR document editor. Polish the provided HTML document to be clear, professional, and well-structured. " +
      "Return ONLY the polished HTML — no markdown fences, no commentary, no explanations. " +
      "Preserve all template variables in {{double_braces}} format exactly as written.";

    const userContent = instruction
      ? `Polish this document with the following instruction: ${instruction}\n\nDocument HTML:\n${originalHtml}`
      : `Polish this ${docType} document to be more professional and clear:\n\n${originalHtml}`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[document-ai-polish] Anthropic API error:", errText);
      return jsonRes(
        { ok: false, ai_available: true, polished_html: originalHtml, error: "AI request failed" },
        502,
      );
    }

    const aiResult = await aiResp.json();
    const polishedHtml = (aiResult.content?.[0]?.text as string | undefined) ?? originalHtml;
    const model = (aiResult.model as string | undefined) ?? "claude-haiku-4-5-20251001";

    // Persist the polished version
    const { data: updatedDoc, error: updateErr } = await admin
      .from("generated_documents")
      .update({ content_html: polishedHtml })
      .eq("id", document_id)
      .eq("workspace_id", workspaceId)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (updateErr) {
      console.error("[document-ai-polish] DB update failed:", updateErr.message);
      return jsonRes({ error: "Failed to persist polished document" }, 503);
    }
    if (!updatedDoc) {
      return jsonRes({ error: "Document is no longer an editable draft" }, 409);
    }

    return jsonRes({ ok: true, ai_available: true, polished_html: polishedHtml, model });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[document-ai-polish] unhandled error:", msg);
    return jsonRes({ error: "Document polishing failed" }, 500);
  }
});
