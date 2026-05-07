// Genisys Help Regenerator
// Triggered by GitHub release webhook OR manual POST.
// Reads CHANGELOG.md + versioning/*.md from the GitHub repo, asks Gemini to
// produce structured EN+HU help articles, and upserts them into help_articles.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-github-event",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GH_SECRET = Deno.env.get("GITHUB_RELEASE_WEBHOOK_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// ── HMAC verify (sha256=...) ────────────────────────────────────────────────
async function verifyGitHubSig(rawBody: string, sigHeader: string | null) {
  if (!GH_SECRET) return true; // allow if no secret configured
  if (!sigHeader?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(GH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expected = `sha256=${hex}`;
  // constant-time compare
  if (expected.length !== sigHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sigHeader.charCodeAt(i);
  }
  return diff === 0;
}

// ── GitHub fetcher (raw) ────────────────────────────────────────────────────
async function ghFetchRaw(repo: string, ref: string, path: string) {
  const url = `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return await r.text();
}

async function ghListVersioning(
  repo: string,
  ref: string,
): Promise<string[]> {
  const url = `https://api.github.com/repos/${repo}/contents/versioning?ref=${ref}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "genisys-help-bot" },
  });
  if (!r.ok) return [];
  const arr = (await r.json()) as Array<{ name: string; type: string }>;
  return arr.filter((x) => x.type === "file" && x.name.endsWith(".md")).map(
    (x) => x.name,
  );
}

// ── Gemini call (structured JSON via responseSchema) ────────────────────────
async function callGemini(systemPrompt: string, userPrompt: string) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const text: string = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  try {
    return JSON.parse(text);
  } catch {
    // Strip markdown fences if any
    const cleaned = text.replace(/^```json\s*|```$/g, "").trim();
    return JSON.parse(cleaned);
  }
}

const SYSTEM_PROMPT = `You are a senior product writer for Genisys, an enterprise workspace app.
Convert repository changelog + versioning notes into end-user help articles.
Write for normal app users, NOT engineers. Be concrete, friendly, and concise.
Always produce BOTH English and Hungarian variants for every topic.

For each topic produce an article object with this exact shape:
{
  "topic_key": "kebab-case-stable-id",          // stable across releases
  "anchor_id": "home.overview" | null,           // matches useHelpAnchor IDs when known
  "route": "/app" | null,
  "taxonomy": "page" | "feature" | "widget" | "workflow" | "action" | "setting" | "report",
  "tags": ["..."],
  "synonyms": ["..."],
  "related_topics": ["other-topic-key"],
  "variants": {
    "en": { "title": "...", "summary": "one-sentence purpose", "body_md": "## Where to find it\\n...\\n## What it does\\n...\\n## Common actions\\n- ..." },
    "hu": { "title": "...", "summary": "...", "body_md": "..." }
  }
}

Return a single JSON array of such objects. No prose, no markdown fences.`;

// ── Main regenerate flow ────────────────────────────────────────────────────
type Payload = {
  repo?: string;
  ref?: string;
  version_tag?: string;
  commit_sha?: string;
  triggered_by?: string;
};

async function regenerate(payload: Payload) {
  const repo = payload.repo || "lovable-app/genisys"; // overridable
  const ref = payload.ref || "main";
  const versionTag = payload.version_tag || ref;

  // 1) Open release row
  const { data: rel, error: relErr } = await supabase
    .from("help_releases")
    .insert({
      version_tag: versionTag,
      commit_sha: payload.commit_sha ?? null,
      status: "running",
      triggered_by: payload.triggered_by ?? "webhook",
    })
    .select()
    .single();
  if (relErr) {
    // possibly duplicate; reuse existing
    const { data: existing } = await supabase
      .from("help_releases")
      .select()
      .eq("version_tag", versionTag)
      .single();
    if (!existing) throw relErr;
  }
  const releaseId = rel?.id;

  try {
    // 2) Pull source documents
    const changelog = await ghFetchRaw(repo, ref, "CHANGELOG.md");
    const versioningFiles = await ghListVersioning(repo, ref);
    const versioningDocs: string[] = [];
    for (const f of versioningFiles.slice(-10)) {
      const txt = await ghFetchRaw(repo, ref, `versioning/${f}`);
      if (txt) versioningDocs.push(`### ${f}\n${txt}`);
    }

    const userPrompt = [
      `Release tag: ${versionTag}`,
      `Repository: ${repo}@${ref}`,
      `\n--- CHANGELOG.md (truncated to 20k chars) ---\n${
        (changelog || "").slice(0, 20000)
      }`,
      `\n--- versioning/*.md (latest, truncated) ---\n${
        versioningDocs.join("\n\n").slice(0, 30000)
      }`,
      `\nGenerate help articles for the user-facing features mentioned. Cover at minimum: home.overview, workspace.members, workspace.calendar, workspace.approvals, workspace.organization, settings.localization, agile.boards (kanban/scrum/gantt), jira.integration. Add more if the changelog reveals them.`,
    ].join("\n");

    const articles = await callGemini(SYSTEM_PROMPT, userPrompt);
    if (!Array.isArray(articles)) throw new Error("Gemini did not return array");

    // 3) Upsert articles
    const rows: any[] = [];
    for (const a of articles) {
      for (const locale of ["en", "hu"] as const) {
        const v = a?.variants?.[locale];
        if (!v?.title || !v?.body_md) continue;
        const hash = await sha256(`${a.topic_key}|${locale}|${v.body_md}`);
        rows.push({
          topic_key: a.topic_key,
          locale,
          title: v.title,
          summary: v.summary ?? null,
          body_md: v.body_md,
          route: a.route ?? null,
          anchor_id: a.anchor_id ?? null,
          taxonomy: a.taxonomy ?? "page",
          tags: a.tags ?? [],
          synonyms: a.synonyms ?? [],
          related_topics: a.related_topics ?? [],
          release_id: releaseId,
          source_release_tag: versionTag,
          content_hash: hash,
          is_system_generated: true,
          last_generated_at: new Date().toISOString(),
        });
      }
    }

    const { error: upErr } = await supabase
      .from("help_articles")
      .upsert(rows, { onConflict: "topic_key,locale" });
    if (upErr) throw upErr;

    await supabase.from("help_releases").update({
      status: "succeeded",
      summary: `Generated ${rows.length} article rows across ${articles.length} topics`,
      changed_files: { count: versioningDocs.length + (changelog ? 1 : 0) },
      completed_at: new Date().toISOString(),
    }).eq("version_tag", versionTag);

    return { ok: true, articles: articles.length, rows: rows.length };
  } catch (e) {
    await supabase.from("help_releases").update({
      status: "failed",
      error: String(e),
      completed_at: new Date().toISOString(),
    }).eq("version_tag", versionTag);
    throw e;
  }
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── HTTP entry ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const raw = await req.text();
    const sig = req.headers.get("x-hub-signature-256");
    const ghEvent = req.headers.get("x-github-event");

    if (sig && !(await verifyGitHubSig(raw, sig))) {
      return new Response("invalid signature", { status: 401, headers: corsHeaders });
    }

    let payload: Payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }

    // GitHub release webhook shape
    if (ghEvent === "release") {
      const gh = payload as any;
      payload = {
        repo: gh?.repository?.full_name,
        ref: gh?.release?.tag_name || gh?.release?.target_commitish || "main",
        version_tag: gh?.release?.tag_name,
        commit_sha: gh?.release?.target_commitish,
        triggered_by: `github:${gh?.sender?.login || "release"}`,
      };
    }

    const result = await regenerate(payload);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
