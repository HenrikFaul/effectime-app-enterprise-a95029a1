// Edge Function: ai-copilot
// AI scheduling copilot for workforce planning.
// Optional Claude integration: when ANTHROPIC_API_KEY is set, returns AI-generated
// analysis and recommendations. Otherwise returns a friendly fallback so the UI
// never breaks.
//
// Action: POST { workspace_id, conversation_id, instruction, model? }
// Response: CopilotResponse (see useAiCopilot.ts for shape)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY          = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const DEFAULT_MODEL = "claude-sonnet-4-6";

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Build a plain-text context summary from live workspace data.
async function buildContextSummary(admin: ReturnType<typeof createClient>, workspaceId: string) {
  const now = new Date();
  const in90d = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);

  const [membRes, leaveRes, shiftRes, violRes] = await Promise.all([
    admin.from("enterprise_memberships")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId).eq("status", "active"),
    admin.from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId).eq("status", "pending"),
    admin.from("enterprise_shift_assignments")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("shift_date", now.toISOString().slice(0, 10))
      .lte("shift_date", in90d),
    admin.from("compliance_violations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId).eq("status", "open"),
  ]);

  return {
    member_count:          membRes.count  ?? 0,
    open_leave_requests:   leaveRes.count ?? 0,
    shifts_next_90d:       shiftRes.count ?? 0,
    open_violations:       violRes.count  ?? 0,
  };
}

// Fetch recent conversation messages to include as context.
async function getConversationHistory(
  admin: ReturnType<typeof createClient>,
  conversationId: string,
  limit = 10,
) {
  const { data } = await admin
    .from("ai_copilot_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as { role: string; content: string }[]).reverse();
}

// Store a message row (non-blocking on failure).
async function storeMessage(
  admin: ReturnType<typeof createClient>,
  conversationId: string,
  role: string,
  content: string,
  structuredPlan: unknown,
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null,
) {
  const { error } = await admin.from("ai_copilot_messages").insert({
    conversation_id: conversationId,
    role,
    content,
    structured_plan: structuredPlan ?? null,
    model,
    input_tokens:  inputTokens,
    output_tokens: outputTokens,
  });
  if (error) console.warn("[ai-copilot] message insert failed:", error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { workspace_id, conversation_id, instruction, model: requestedModel } =
      await req.json().catch(() => ({}));

    if (!workspace_id)    return jsonRes({ error: "workspace_id is required" }, 400);
    if (!conversation_id) return jsonRes({ error: "conversation_id is required" }, 400);
    if (!instruction)     return jsonRes({ error: "instruction is required" }, 400);

    // Verify workspace membership
    const { data: membership } = await admin
      .from("enterprise_memberships")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) return jsonRes({ error: "Forbidden" }, 403);

    // Build workspace context (parallel)
    const [contextSummary, history] = await Promise.all([
      buildContextSummary(admin, workspace_id),
      getConversationHistory(admin, conversation_id),
    ]);

    // Store user message
    await storeMessage(admin, conversation_id, "user", instruction, null, null, null, null);

    // No API key — return a friendly non-AI fallback
    if (!ANTHROPIC_API_KEY) {
      const fallbackContent =
        "AI analysis is not configured for this installation. " +
        "To enable AI-powered scheduling insights, add ANTHROPIC_API_KEY to your Supabase secrets.";
      const fallbackPlan = {
        ai_available: false,
        analysis: fallbackContent,
        recommendations: [],
        warnings: [],
        confidence: 0,
      };
      await storeMessage(admin, conversation_id, "assistant", fallbackContent, fallbackPlan, null, null, null);
      return jsonRes({
        ok: true,
        ai_available: false,
        content: fallbackContent,
        structured_plan: fallbackPlan,
        context_summary: contextSummary,
        hint: "Set ANTHROPIC_API_KEY in Supabase secrets to enable AI copilot.",
      });
    }

    const model = requestedModel ?? DEFAULT_MODEL;

    const systemPrompt = [
      "You are an expert workforce planning and scheduling assistant for Effectime.",
      "You help managers with leave planning, capacity analysis, shift scheduling, and compliance.",
      `Current workspace context: ${contextSummary.member_count} active members, ` +
        `${contextSummary.open_leave_requests} pending leave requests, ` +
        `${contextSummary.shifts_next_90d} upcoming shifts (90 days), ` +
        `${contextSummary.open_violations} open compliance violations.`,
      "",
      "Respond in JSON with this exact shape:",
      '{ "analysis": "...", "recommendations": ["..."], "warnings": ["..."], "requires_human_review": false, "confidence": 0.9 }',
      "Keep recommendations actionable and concise. Use the user\'s language (Hungarian or English).",
    ].join("\n");

    // Build messages array: history + new user message
    const messages = [
      ...history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: instruction },
    ];

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 1024, system: systemPrompt, messages }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[ai-copilot] Anthropic API error:", errText);
      const errContent = "AI request failed. Please try again.";
      const errPlan = { ai_available: true, error: "API request failed", analysis: errContent };
      await storeMessage(admin, conversation_id, "assistant", errContent, errPlan, model, null, null);
      return jsonRes({
        ok: false, ai_available: true, content: errContent,
        structured_plan: errPlan, context_summary: contextSummary,
      });
    }

    const aiResult = await aiResp.json();
    const rawContent = (aiResult.content?.[0]?.text as string | undefined) ?? "";
    const inputTokens  = (aiResult.usage?.input_tokens  as number | undefined) ?? null;
    const outputTokens = (aiResult.usage?.output_tokens as number | undefined) ?? null;

    // Try to parse structured JSON from the response
    let structuredPlan: Record<string, unknown> | null = null;
    try {
      // Handle markdown code fences if Claude wraps the JSON
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)```/) ??
                        rawContent.match(/^\s*(\{[\s\S]*\})\s*$/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
      structuredPlan = JSON.parse(jsonStr);
    } catch {
      structuredPlan = { raw: rawContent, parse_failed: true, ai_available: true };
    }

    const content = (structuredPlan?.analysis as string | undefined) ?? rawContent;

    await storeMessage(admin, conversation_id, "assistant", content, structuredPlan, model, inputTokens, outputTokens);

    return jsonRes({
      ok: true,
      ai_available: true,
      model,
      content,
      structured_plan: structuredPlan,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      context_summary: contextSummary,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai-copilot] unhandled error:", msg);
    return jsonRes({ error: msg }, 500);
  }
});
