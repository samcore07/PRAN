/**
 * PRAN - Direct Vercel Serverless Function: /api/health
 */

const { isConfigured, supabase } = require('../backend/supabaseClient');
const { getAiStatus } = require('../backend/services/aiService');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'healthy',
    system: 'PRAN Emergency Coordination Backend',
    platform: 'Vercel Serverless Direct',
    supabaseConnected: isConfigured && Boolean(supabase),
    database: isConfigured ? 'supabase' : 'local_storage',
    ai: getAiStatus()
  }));
};
