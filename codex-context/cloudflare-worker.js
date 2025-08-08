export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-api-key",
        },
      });
    }

    // GET: return current scores
    if (request.method === "GET") {
      const scoresJSON = await env.YETI_SCORES.get("scores");
      const scores = scoresJSON ? JSON.parse(scoresJSON) : [];
      return jsonResponse(scores, allowedOrigin);
    }

    // POST: update scores (requires API key)
    if (request.method === "POST") {
      const apiKey = request.headers.get("x-api-key");
      if (apiKey !== env.API_KEY) {
        return jsonResponse({ error: "Unauthorized" }, allowedOrigin, 401);
      }

      try {
        const newScores = await request.json();
        await env.YETI_SCORES.put("scores", JSON.stringify(newScores));
        return jsonResponse({ ok: true, count: newScores.length }, allowedOrigin);
      } catch (err) {
        return jsonResponse({ error: err.toString() }, allowedOrigin, 400);
      }
    }

    return jsonResponse({ error: "Method not allowed" }, allowedOrigin, 405);
  },
};

function jsonResponse(data, origin, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
    },
  });
}
