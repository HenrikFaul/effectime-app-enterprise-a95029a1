// Edge Function: ai-copilot
// AI scheduling copilot — Google Generative AI (Gemini) backend.
// Model: gemini-1.5-flash (broadly available on AI Studio free tier).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_API_KEY") ?? "";

const DEFAULT_MODEL = "gemini-2.0-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function buildContextSummary(admin: ReturnType<typeof createClient>, workspaceId: string) {
  const now = new Date();
  const in90d = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);
  const [membRes, leaveRes, shiftRes, violRes] = await Promise.all([
    admin.from("enterprise_memberships").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "active"),
    admin.from("leave_requests").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "pending"),
    admin.from("enterprise_shift_assignments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("shift_date", now.toISOString().slice(0, 10)).lte("shift_date", in90d),
    admin.from("compliance_violations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "open"),
  ]);
  return { member_count: membRes.count ?? 0, open_leave_requests: leaveRes.count ?? 0, shifts_next_90d: shiftRes.count ?? 0, open_violations: violRes.count ?? 0 };
}

async function getConversationHistory(admin: ReturnType<typeof createClient>, conversationId: string, limit = 10) {
  const { data } = await admin.from("ai_copilot_messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as { role: string; content: string }[]).reverse();
}

async function storeMessage(admin: ReturnType<typeof createClient>, conversationId: string, role: string, content: string, structuredPlan: unknown, model: string | null, inputTokens: number | null, outputTokens: number | null) {
  const { error } = await admin.from("ai_copilot_messages").insert({ conversation_id: conversationId, role, content, structured_plan: structuredPlan ?? null, model, input_tokens: inputTokens, output_tokens: outputTokens });
  if (error) console.warn("[ai-copilot] message insert failed:", error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

    const { workspace_id, conversation_id, instruction, model: requestedModel } = await req.json().catch(() => ({}));
    if (!workspace_id) return jsonRes({ error: "workspace_id is required" }, 400);
    if (!conversation_id) return jsonRes({ error: "conversation_id is required" }, 400);
    if (!instruction) return jsonRes({ error: "instruction is required" }, 400);

    const { data: membership } = await admin.from("enterprise_memberships").select("id").eq("workspace_id", workspace_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership) return jsonRes({ error: "Forbidden" }, 403);

    const [contextSummary, history] = await Promise.all([buildContextSummary(admin, workspace_id), getConversationHistory(admin, conversation_id)]);
    await storeMessage(admin, conversation_id, "user", instruction, null, null, null, null);

    if (!GOOGLE_AI_KEY) {
      const fallbackContent = "AI analysis is not configured. Add GOOGLE_AI_API_KEY to Supabase secrets to enable Gemini-powered scheduling insights.";
      const fallbackPlan = { ai_available: false, analysis: fallbackContent, recommendations: [], warnings: [], confidence: 0 };
      await storeMessage(admin, conversation_id, "assistant", fallbackContent, fallbackPlan, null, null, null);
      return jsonRes({ ok: true, ai_available: false, content: fallbackContent, structured_plan: fallbackPlan, context_summary: contextSummary, hint: "Set GOOGLE_AI_API_KEY in Supabase secrets." });
    }

    const model = requestedModel ?? DEFAULT_MODEL;
    const systemPrompt = [
      "You are an expert workforce planning and scheduling assistant for Effectime.",
      "You help managers with leave planning, capacity analysis, shift scheduling, and compliance.",
      `Current workspace context: ${contextSummary.member_count} active members, ${contextSummary.open_leave_requests} pending leave requests, ${contextSummary.shifts_next_90d} upcoming shifts (90 days), ${contextSummary.open_violations} open compliance violations.`,
      "",
      "Respond in JSON with this exact shape:",
      '{ "analysis": "...", "recommendations": ["..."], "warnings": ["..."], "requires_human_review": false, "confidence": 0.9 }',
      "Keep recommendations actionable and concise. Use the user's language (Hungarian or English).",
    ].join("\n");

    const contents = [
      ...history.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      { role: "user", parts: [{ text: instruction }] },
    ];

    const aiResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_AI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig: { maxOutputTokens: 1024 } }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[ai-copilot] Google AI error:", errText);
      let errDetail = "";
      try { errDetail = JSON.parse(errText)?.error?.message ?? ""; } catch { /* ignore */ }
      const errContent = errDetail ? `AI request failed: ${errDetail}` : "AI request failed. Please try again.";
      const errPlan = { ai_available: true, error: errContent, analysis: errContent };
      await storeMessage(admin, conversation_id, "assistant", errContent, errPlan, model, null, null);
      return jsonRes({ ok: false, ai_available: true, content: errContent, structured_plan: errPlan, context_summary: contextSummary });
    }

    const aiResult = await aiResp.json();
    const rawContent   = (aiResult.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined) ?? "";
    const inputTokens  = (aiResult.usageMetadata?.promptTokenCount     as number | undefined) ?? null;
    const outputTokens = (aiResult.usageMetadata?.candidatesTokenCount as number | undefined) ?? null;

    let structuredPlan: Record<string, unknown> | null = null;
    try {
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)```/) ?? rawContent.match(/^\s*(\{[\s\S]*\})\s*$/);
      structuredPlan = JSON.parse(jsonMatch ? jsonMatch[1] : rawContent);
    } catch {
      structuredPlan = { raw: rawContent, parse_failed: true, ai_available: true };
    }

    const content = (structuredPlan?.analysis as string | undefined) ?? rawContent;
    await storeMessage(admin, conversation_id, "assistant", content, structuredPlan, model, inputTokens, outputTokens);

    return jsonRes({ ok: true, ai_available: true, model, content, structured_plan: structuredPlan, usage: { input_tokens: inputTokens, output_tokens: outputTokens }, context_summary: contextSummary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai-copilot] unhandled error:", msg);
    return jsonRes({ error: msg }, 500);
  }
});
