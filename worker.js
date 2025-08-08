export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'GET') {
      const stored = await env.YETI_SCORES.get('scores');
      return new Response(stored || '[]', {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (request.method === 'POST') {
      const apiKey = request.headers.get('x-api-key');
      if (!apiKey || apiKey !== env.ADMIN_SECRET) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      let scores;
      try {
        scores = await request.json();
        if (!Array.isArray(scores)) {
          throw new Error('Invalid scores format');
        }
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      await env.YETI_SCORES.put('scores', JSON.stringify(scores));
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders
    });
  }
};

