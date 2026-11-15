/**
 * PRAN - Direct Vercel Serverless Function: /api/ai/copilot
 */

const { handleAiRoutes } = require('../../backend/routes/ai');
const { getSupabaseHospitals } = require('../../backend/supabaseClient');

let cachedHospitals = [];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-groq-api-key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse body safely
  let body = req.body || null;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }
  if (!body && (req.method === 'POST' || req.method === 'PUT')) {
    body = await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        try { resolve(data ? JSON.parse(data) : null); } catch (e) { resolve(null); }
      });
    });
  }

  try {
    if (cachedHospitals.length === 0) {
      const h = await getSupabaseHospitals().catch(() => []);
      if (h && h.length > 0) cachedHospitals = h;
    }
  } catch (e) {}

  const result = await handleAiRoutes(req, res, '/api/ai/copilot', body, { hospitals: cachedHospitals });
  if (result) {
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.data));
  } else {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Copilot handler failed to process request' }));
  }
};
