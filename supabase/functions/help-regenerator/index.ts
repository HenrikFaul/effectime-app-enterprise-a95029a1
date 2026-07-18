// Effectime Help Regenerator v2
// Triggered by GitHub release webhook OR manual POST.
// Reads CHANGELOG.md + versioning/*.md from the GitHub repo, asks Gemini to
// produce structured EN+HU help articles, upserts them (archiving previous
// versions by setting archived_at) and tracks each run in help_releases.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { getBearerToken, verifyHmacSha256 } from "../_shared/request-security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-github-event",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GH_SECRET = Deno.env.get("GITHUB_RELEASE_WEBHOOK_SECRET") || "";

// Canonical repo — updated to match the actual effectime repository.
const DEFAULT_REPO = "henrikfaul/effectime-app-enterprise-a95029a1";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// ── GitHub fetchers ────────────────────────────────────────────────────────
async function ghFetchRaw(repo: string, ref: string, path: string) {
  const url = `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return await r.text();
}

async function ghListDir(
  repo: string,
  ref: string,
  dir: string,
): Promise<string[]> {
  const url =
    `https://api.github.com/repos/${repo}/contents/${dir}?ref=${ref}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "effectime-help-bot" },
  });
  if (!r.ok) return [];
  const arr = (await r.json()) as Array<{ name: string; type: string }>;
  return arr
    .filter((x) => x.type === "file" && x.name.endsWith(".md"))
    .map((x) => x.name);
}

// ── Gemini call ────────────────────────────────────────────────────────────
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
    const cleaned = text.replace(/^```json\s*|```$/g, "").trim();
    return JSON.parse(cleaned);
  }
}

const SYSTEM_PROMPT = `You are a senior product writer for Effectime, an enterprise workforce management app.
Convert repository changelog + versioning notes into end-user help articles.
Write for normal app users, NOT engineers. Be concrete, friendly, and concise.
Always produce BOTH English (en) and Hungarian (hu) variants for every topic.

For each topic produce an article object with this exact shape:
{
  "topic_key": "kebab-case-stable-id",
  "anchor_id": "home.overview" | "workspace.members" | "workspace.organization" | "workspace.calendar" | "workspace.approvals" | "workspace.workflows" | "workspace.resources" | "workspace.reports" | "workspace.settings" | "workspace.agile" | null,
  "route": "/enterprise" | null,
  "taxonomy": "page" | "feature" | "widget" | "workflow" | "action" | "setting" | "report",
  "tags": ["..."],
  "synonyms": ["..."],
  "related_topics": ["other-topic-key"],
  "variants": {
    "en": {
      "title": "Short descriptive title",
      "summary": "One or two sentences in plain user language",
      "body_md": "## Where to find it\\n...\\n## What it does\\n...\\n## How to use it\\n1. ...\\n## Common actions\\n- **Button name** — what it does\\n## Troubleshooting\\n- ...\\n## Related\\n- ..."
    },
    "hu": {
      "title": "...",
      "summary": "...",
      "body_md": "..."
    }
  }
}

Mandatory anchors to cover (create one article per anchor):
home.overview, workspace.members, workspace.organization, workspace.calendar,
workspace.approvals, workspace.requests, workspace.workflows, workspace.resources,
workspace.reports, workspace.settings, workspace.agile,
time-entry, leave-request, approval-flow, onboarding-template,
access-request, capacity-dna, org-chart, role-permissions,
localization-settings, integration-health, decision-memory, command-center,
agile-kanban, agile-scrum, agile-gantt, jira-integration,
export-center, audit-log, quota-manager, holiday-manager, coverage-planner.

Return a single JSON array of article objects. No prose, no markdown fences.`;

// ── Content hash ───────────────────────────────────────────────────────────
async function sha256(s: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Archive previous active articles ──────────────────────────────────────
// Sets archived_at on any active row whose content_hash differs from the
// incoming hash, ensuring the old version is preserved and queryable.
async function archiveStaleArticles(
  topicKey: string,
  locale: string,
  newHash: string,
) {
  await (supabase as any)
    .from("help_articles")
    .update({ is_active: false, archived_at: new Date().toISOString() })
    .eq("topic_key", topicKey)
    .eq("locale", locale)
    .eq("is_active", true)
    .neq("content_hash", newHash);
}

// ── Main regenerate flow ───────────────────────────────────────────────────
type Payload = {
  repo?: string;
  ref?: string;
  version_tag?: string;
  commit_sha?: string;
  triggered_by?: string;
  workspace_id?: string;
};

async function regenerate(payload: Payload) {
  const repo = payload.repo || DEFAULT_REPO;
  const ref = payload.ref || "main";
  const versionTag = payload.version_tag || ref;

  // 1) Open release tracking row
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
    const versioningFiles = await ghListDir(repo, ref, "versioning");
    const docsRootFiles = await ghListDir(repo, ref, "docs");
    const helpEnFiles = await ghListDir(repo, ref, "docs/help/en");

    const versioningDocs: string[] = [];
    for (const f of versioningFiles.slice(-12)) {
      const txt = await ghFetchRaw(repo, ref, `versioning/${f}`);
      if (txt) versioningDocs.push(`### versioning/${f}\n${txt}`);
    }

    // docs root-level .md files (e.g. help-reference.md)
    const docsRootDocs: string[] = [];
    for (const f of docsRootFiles.slice(-4)) {
      const txt = await ghFetchRaw(repo, ref, `docs/${f}`);
      if (txt) docsRootDocs.push(`### docs/${f}\n${txt}`);
    }

    // docs/help/en articles — structured user-facing documentation
    const helpEnDocs: string[] = [];
    for (const f of helpEnFiles.slice(-8)) {
      const txt = await ghFetchRaw(repo, ref, `docs/help/en/${f}`);
      if (txt) helpEnDocs.push(`### docs/help/en/${f}\n${txt}`);
    }

    const userPrompt = [
      `Release tag: ${versionTag}`,
      `Repository: ${repo}@${ref}`,
      `\n--- CHANGELOG.md (truncated to 20k chars) ---\n${
        (changelog || "").slice(0, 20_000)
      }`,
      `\n--- versioning/*.md (latest 12, truncated) ---\n${
        versioningDocs.join("\n\n").slice(0, 20_000)
      }`,
      `\n--- docs/*.md (root level, truncated) ---\n${
        docsRootDocs.join("\n\n").slice(0, 15_000)
      }`,
      `\n--- docs/help/en/*.md (structured help articles, truncated) ---\n${
        helpEnDocs.join("\n\n").slice(0, 20_000)
      }`,
      `\nGenerate help articles for ALL user-facing features mentioned above. ` +
        `Make sure to cover every mandatory anchor listed in the system prompt. ` +
        `Use the changelog, versioning docs, and the existing help/en articles as ` +
        `context for accurate, consistent feature descriptions. Mirror the style ` +
        `and structure of the existing help/en articles.`,
    ].join("\n");

    const articles = await callGemini(SYSTEM_PROMPT, userPrompt);
    if (!Array.isArray(articles)) throw new Error("Gemini did not return array");

    // 3) Archive stale + upsert fresh articles
    const rows: any[] = [];
    for (const a of articles) {
      for (const locale of ["en", "hu"] as const) {
        const v = a?.variants?.[locale];
        if (!v?.title || !v?.body_md) continue;
        const hash = await sha256(`${a.topic_key}|${locale}|${v.body_md}`);

        // Archive any active article with a different hash before upserting
        await archiveStaleArticles(a.topic_key, locale, hash);

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
          is_active: true,
          archived_at: null,
          last_generated_at: new Date().toISOString(),
        });
      }
    }

    const { error: upErr } = await (supabase as any)
      .from("help_articles")
      .upsert(rows, { onConflict: "topic_key,locale" });
    if (upErr) throw upErr;

    await supabase
      .from("help_releases")
      .update({
        status: "succeeded",
        summary: `Generated ${rows.length} article rows across ${articles.length} topics`,
        changed_files: {
          count: versioningDocs.length + docsRootDocs.length + helpEnDocs.length + (changelog ? 1 : 0),
        },
        completed_at: new Date().toISOString(),
      })
      .eq("version_tag", versionTag);

    return { ok: true, articles: articles.length, rows: rows.length };
  } catch (e) {
    await supabase
      .from("help_releases")
      .update({
        status: "failed",
        error: String(e),
        completed_at: new Date().toISOString(),
      })
      .eq("version_tag", versionTag);
    throw e;
  }
}

// ── HTTP entry ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const raw = await req.text();
    const sig = req.headers.get("x-hub-signature-256");
    const ghEvent = req.headers.get("x-github-event");

    let payload: Payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    if (ghEvent) {
      if (ghEvent !== "release") {
        return new Response("unsupported event", { status: 400, headers: corsHeaders });
      }
      if (!GH_SECRET) {
        console.error("help-regenerator: GitHub webhook secret is not configured");
        return new Response("webhook not configured", { status: 503, headers: corsHeaders });
      }
      if (!(await verifyHmacSha256(raw, sig, GH_SECRET))) {
        return new Response("invalid signature", { status: 401, headers: corsHeaders });
      }

      // GitHub release webhook shape. Only the canonical repository is allowed
      // to provide model input; arbitrary repositories are a prompt-injection
      // and content-poisoning boundary.
      const gh = payload as any;
      const repo = String(gh?.repository?.full_name || "").toLowerCase();
      if (repo !== DEFAULT_REPO) {
        return new Response("repository not allowed", { status: 403, headers: corsHeaders });
      }
      payload = {
        repo: DEFAULT_REPO,
        ref: gh?.release?.tag_name || gh?.release?.target_commitish || "main",
        version_tag: gh?.release?.tag_name,
        commit_sha: gh?.release?.target_commitish,
        triggered_by: `github:${gh?.sender?.login || "release"}`,
      };
    } else {
      const token = getBearerToken(req);
      if (!token || !ANON_KEY) {
        return new Response("unauthorized", { status: 401, headers: corsHeaders });
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData.user) {
        return new Response("unauthorized", { status: 401, headers: corsHeaders });
      }

      // Help articles are global platform content, so a workspace-level role is
      // not a sufficient authorization boundary for a manual regeneration.
      const { data: platformAdmin, error: roleError } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (roleError || !platformAdmin) {
        return new Response("forbidden", { status: 403, headers: corsHeaders });
      }

      payload = {
        repo: DEFAULT_REPO,
        ref: "main",
        version_tag: `manual-${new Date().toISOString().slice(0, 10)}`,
        triggered_by: `user:${userData.user.id}`,
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
