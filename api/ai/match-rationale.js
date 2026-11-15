/**
 * PRAN - Direct Vercel Serverless Function: /api/ai/match-rationale
 */

const { handleAiRoutes } = require('../../backend/routes/ai');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-groq-api-key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

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

  const result = await handleAiRoutes(req, res, '/api/ai/match-rationale', body, {});
  if (result) {
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.data));
  } else {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'AI match rationale failed' }));
  }
};
