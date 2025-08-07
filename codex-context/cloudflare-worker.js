// Yeti Scoreboard → Cloudflare Worker -> GitHub scores.json updater
// Expects POST { scores: [{name, score, timestamp?}], mode?: "merge"|"overwrite" }

export default {
  async fetch(req, env, ctx) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-api-key",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    if (req.method !== "POST") {
      return respond(405, { error: "Method not allowed" }, allowedOrigin);
    }

    // Simple admin auth
    const apiKey = req.headers.get("x-api-key") || "";
    if (!env.API_KEY || apiKey !== env.API_KEY) {
      return respond(401, { error: "Unauthorized" }, allowedOrigin);
    }

    // Parse body
    let body;
    try {
      body = await req.json();
    } catch {
      return respond(400, { error: "Invalid JSON" }, allowedOrigin);
    }
    const incoming = Array.isArray(body.scores) ? body.scores : [];
    const mode = body.mode === "overwrite" ? "overwrite" : "merge";

    // GitHub repo info from env
    const owner = env.REPO_OWNER;
    const repo = env.REPO_NAME;
    const branch = env.REPO_BRANCH || "main";
    const filePath = "scores.json";

    const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const ghHeaders = {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "yeti-sync-worker",
    };

    // 1) Get current file to read existing scores + sha
    let currentSha = undefined;
    let existing = [];
    try {
      const res = await fetch(`${baseUrl}?ref=${encodeURIComponent(branch)}`, { headers: ghHeaders });
      if (res.ok) {
        const data = await res.json();
        currentSha = data.sha;
        const decoded = JSON.parse(atob(data.content.replace(/\n/g, "")));
        if (Array.isArray(decoded)) existing = decoded;
      } else if (res.status !== 404) {
        const text = await res.text();
        return respond(res.status, { error: "Failed to fetch scores.json", detail: text }, allowedOrigin);
      }
    } catch (e) {
      return respond(500, { error: "GitHub GET failed", detail: String(e) }, allowedOrigin);
    }

    // 2) Merge or overwrite
    let updated = [];
    if (mode === "overwrite") {
      updated = incoming;
    } else {
      // merge: keep highest score per name, newest timestamp
      const map = new Map();
      for (const s of [...existing, ...incoming]) {
        if (!s || typeof s.name !== "string" || typeof s.score !== "number") continue;
        const key = s.name.trim();
        const prev = map.get(key);
        if (!prev || s.score > prev.score) {
          map.set(key, { name: key, score: s.score, timestamp: s.timestamp || new Date().toISOString() });
        }
      }
      updated = [...map.values()].sort((a, b) => b.score - a.score);
    }

    // 3) PUT updated file
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(updated, null, 2))));
    const payload = {
      message: `Update scores.json from Yeti Scoreboard (${mode})`,
      content,
      branch,
      ...(currentSha ? { sha: currentSha } : {}),
    };

    try {
      const put = await fetch(baseUrl, {
        method: "PUT",
        headers: { ...ghHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!put.ok) {
        const text = await put.text();
        return respond(put.status, { error: "GitHub PUT failed", detail: text }, allowedOrigin);
      }
      const result = await put.json();
      return respond(200, { ok: true, commit: result.commit?.sha, count: updated.length }, allowedOrigin);
    } catch (e) {
      return respond(500, { error: "GitHub PUT exception", detail: String(e) }, allowedOrigin);
    }
  }
};

function respond(status, data, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
    },
  });
}
