export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders,
      });
    }

    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== env.ADMIN_SECRET) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let scores;
    try {
      const body = await request.json();
      if (Array.isArray(body)) {
        scores = body;
      } else if (Array.isArray(body.scores)) {
        scores = body.scores;
      } else {
        throw new Error('Invalid scores format');
      }
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    try {
      const owner = env.GITHUB_OWNER;
      const repo = env.GITHUB_REPO;
      const branch = env.GITHUB_BRANCH || 'main';
      const token = env.GITHUB_TOKEN;
      const authHeaders = {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
      };

      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/scores.json?ref=${branch}`, {
        headers: authHeaders,
      });

      let sha;
      if (getRes.status === 404) {
        // file does not exist yet
      } else if (getRes.ok) {
        const file = await getRes.json();
        sha = file.sha;
      } else {
        const errText = await getRes.text();
        console.error('Failed to fetch scores.json', getRes.status, errText);
        return new Response(
          JSON.stringify({
            success: false,
            error: `GitHub fetch failed: ${getRes.status} ${errText}`,
          }),
          {
            status: getRes.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      const encoded = btoa(JSON.stringify(scores, null, 2));
      const putBody = {
        message: 'Update scores from Yeti Scoreboard',
        content: encoded,
        sha,
        branch,
      };

      const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/scores.json`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody),
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        console.error('Failed to update scores.json', putRes.status, errText);
        return new Response(
          JSON.stringify({
            success: false,
            error: `GitHub update failed: ${putRes.status} ${errText}`,
          }),
          {
            status: putRes.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      console.error('Unexpected error while updating scores', err);
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
  },
};
