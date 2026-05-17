// Edge Function: ai-copilot
// AI scheduling copilot - Google Generative AI (Gemini) backend.
// Model: gemini-2.5-flash
// Context: full workspace data (members, leaves, shifts, availability, offices, skills)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_API_KEY") ?? "";

const DEFAULT_MODEL = "gemini-2.5-flash";

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

// ---------------------------------------------------------------------------
// Rich workspace context builder - loads real names, schedules, leaves, etc.
// ---------------------------------------------------------------------------
async function buildWorkspaceContext(admin: ReturnType<typeof createClient>, workspaceId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const in30d = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const in90d = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);

  const [membRes, leaveRes, shiftRes, availRes, officeRes, skillRes, memberSkillRes, violRes, openShiftRes] = await Promise.all([
    admin.from("enterprise_memberships").select("id,user_id,business_role,office_id").eq("workspace_id", workspaceId).eq("status", "active"),
    admin.from("leave_requests").select("user_id,start_date,end_date,status").eq("workspace_id", workspaceId).in("status", ["approved", "pending"]).gte("end_date", today).lte("start_date", in90d),
    admin.from("enterprise_shift_assignments").select("user_id,shift_date,office_id,business_role").eq("workspace_id", workspaceId).gte("shift_date", today).lte("shift_date", in30d),
    admin.from("enterprise_staff_availability").select("user_id,availability_date,status").eq("workspace_id", workspaceId).gte("availability_date", today).lte("availability_date", in30d).in("status", ["available", "preferred"]),
    admin.from("enterprise_offices").select("id,name,city").eq("workspace_id", workspaceId).order("name"),
    admin.from("enterprise_skills").select("id,name").eq("workspace_id", workspaceId),
    admin.from("enterprise_member_skills").select("membership_id,skill_id,level").eq("workspace_id", workspaceId),
    admin.from("compliance_violations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "open"),
    admin.from("enterprise_open_shift_requests").select("office_id,shift_date,business_role,status").eq("workspace_id", workspaceId).gte("shift_date", today).lte("shift_date", in30d).eq("status", "open"),
  ]);

  // Resolve member names
  const userIds = ((membRes.data || []) as any[]).map((m: any) => m.user_id);
  const nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profs } = await admin.from("profiles").select("user_id,display_name").in("user_id", userIds);
    ((profs || []) as any[]).forEach((p: any) => { nameMap[p.user_id] = p.display_name || p.user_id; });
  }

  const officeMap: Record<string, string> = {};
  ((officeRes.data || []) as any[]).forEach((o: any) => { officeMap[o.id] = o.city ? o.name + " (" + o.city + ")" : o.name; });

  const skillMap: Record<string, string> = {};
  ((skillRes.data || []) as any[]).forEach((s: any) => { skillMap[s.id] = s.name; });

  const skillsByMembership: Record<string, string[]> = {};
  ((memberSkillRes.data || []) as any[]).forEach((ms: any) => {
    const arr = skillsByMembership[ms.membership_id] || [];
    arr.push((skillMap[ms.skill_id] || ms.skill_id) + "(L" + ms.level + ")");
    skillsByMembership[ms.membership_id] = arr;
  });

  const memberRows = (membRes.data || []) as any[];

  const membersSection = memberRows.map((m: any) => {
    const skills = (skillsByMembership[m.id] || []).join(", ");
    const office = officeMap[m.office_id] || "-";
    const line = "  - " + (nameMap[m.user_id] || m.user_id) + " | role: " + (m.business_role || "-") + " | office: " + office + (skills ? " | skills: " + skills : "");
    return line;
  }).join("\n");

  const leavesLines = ((leaveRes.data || []) as any[]).map((l: any) =>
    "  - " + (nameMap[l.user_id] || l.user_id) + ": " + l.start_date + " to " + l.end_date + " [" + (l.status === "approved" ? "approved" : "pending") + "]"
  ).join("\n");

  const shiftsByDate: Record<string, string[]> = {};
  ((shiftRes.data || []) as any[]).forEach((s: any) => {
    const entry = (nameMap[s.user_id] || s.user_id) + "@" + (officeMap[s.office_id] || s.office_id) + (s.business_role ? "(" + s.business_role + ")" : "");
    (shiftsByDate[s.shift_date] = shiftsByDate[s.shift_date] || []).push(entry);
  });
  const shiftsLines = Object.entries(shiftsByDate).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => "  " + date + ": " + entries.join(", ")).join("\n");

  const availByDate: Record<string, string[]> = {};
  ((availRes.data || []) as any[]).forEach((a: any) => {
    const entry = (nameMap[a.user_id] || a.user_id) + "(" + (a.status === "preferred" ? "preferred" : "available") + ")";
    (availByDate[a.availability_date] = availByDate[a.availability_date] || []).push(entry);
  });
  const availLines = Object.entries(availByDate).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => "  " + date + ": " + entries.join(", ")).join("\n");

  const openShiftLines = ((openShiftRes.data || []) as any[])
    .map((r: any) => "  - " + r.shift_date + " @ " + (officeMap[r.office_id] || r.office_id) + (r.business_role ? " (" + r.business_role + ")" : ""))
    .join("\n");

  return [
    "TODAY: " + today,
    "PLANNING HORIZON: " + today + " to " + in30d,
    "OPEN COMPLIANCE ISSUES: " + (violRes.count ?? 0),
    "",
    "ACTIVE MEMBERS (" + memberRows.length + "):",
    membersSection || "  (none)",
    "",
    "LEAVES (next 90 days):",
    leavesLines || "  (no active leaves)",
    "",
    "SCHEDULED SHIFTS (next 30 days):",
    shiftsLines || "  (no shifts scheduled)",
    "",
    "SELF-MARKED AVAILABLE (next 30 days):",
    availLines || "  (nobody marked available)",
    "",
    "OPEN SHIFT BROADCASTS (next 30 days):",
    openShiftLines || "  (no open shifts posted)",
  ].join("\n");
}

async function getConversationHistory(admin: ReturnType<typeof createClient>, conversationId: string, limit = 12) {
  const { data } = await admin.from("ai_copilot_messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as { role: string; content: string }[]).reverse();
}

async function storeMessage(admin: ReturnType<typeof createClient>, conversationId: string, role: string, content: string, structuredPlan: unknown, model: string | null, inputTokens: number | null, outputTokens: number | null) {
  const { error } = await admin.from("ai_copilot_messages").insert({ conversation_id: conversationId, role, content, structured_plan: structuredPlan ?? null, model, input_tokens: inputTokens, output_tokens: outputTokens });
  if (error) console.warn("[ai-copilot] message insert failed:", error.message);
}

const SYSTEM_PROMPT_BASE = [
  "You are an expert workforce planning and scheduling assistant for Effectime.",
  "You help managers with leave planning, capacity analysis, shift scheduling, and compliance.",
  "",
  "IMPORTANT: The data below is REAL workspace data fetched live from the database.",
  "Use this data to give concrete, actionable answers with real names, dates, and offices.",
  "When asked who to schedule for a date: look at who is NOT in shifts for that day AND NOT on leave.",
  "If someone is on leave or already scheduled at another office that day, say so explicitly.",
  "Always reply in the same language the manager uses (Hungarian or English).",
  "",
  "Respond ONLY in this exact JSON shape:",
  '{ "analysis": "...", "recommendations": ["..."], "warnings": ["..."], "requires_human_review": false, "confidence": 0.9 }',
].join("\n");

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

    const [workspaceContext, history] = await Promise.all([
      buildWorkspaceContext(admin, workspace_id),
      getConversationHistory(admin, conversation_id),
    ]);

    await storeMessage(admin, conversation_id, "user", instruction, null, null, null, null);

    if (!GOOGLE_AI_KEY) {
      const fallbackContent = "AI analysis is not configured. Add GOOGLE_AI_API_KEY to Supabase secrets to enable Gemini-powered scheduling insights.";
      const fallbackPlan = { ai_available: false, analysis: fallbackContent, recommendations: [], warnings: [], confidence: 0 };
      await storeMessage(admin, conversation_id, "assistant", fallbackContent, fallbackPlan, null, null, null);
      return jsonRes({ ok: true, ai_available: false, content: fallbackContent, structured_plan: fallbackPlan, hint: "Set GOOGLE_AI_API_KEY in Supabase secrets." });
    }

    const model = requestedModel ?? DEFAULT_MODEL;
    const systemPrompt = SYSTEM_PROMPT_BASE + "\n\n=== LIVE WORKSPACE DATA ===\n" + workspaceContext + "\n=== END DATA ===";

    const contents = [
      ...history.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: instruction }] },
    ];

    const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + GOOGLE_AI_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[ai-copilot] Google AI error:", errText);
      let errDetail = "";
      try { errDetail = JSON.parse(errText)?.error?.message ?? ""; } catch { /* ignore */ }
      const errContent = errDetail ? "AI request failed: " + errDetail : "AI request failed. Please try again.";
      const errPlan = { ai_available: true, error: errContent, analysis: errContent };
      await storeMessage(admin, conversation_id, "assistant", errContent, errPlan, model, null, null);
      return jsonRes({ ok: false, ai_available: true, content: errContent, structured_plan: errPlan });
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

    return jsonRes({ ok: true, ai_available: true, model, content, structured_plan: structuredPlan, usage: { input_tokens: inputTokens, output_tokens: outputTokens } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai-copilot] unhandled error:", msg);
    return jsonRes({ error: msg }, 500);
  }
});
