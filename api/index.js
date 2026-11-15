/**
 * PRAN - Vercel Serverless Function Handler
 * Routes all /api/* requests on Vercel deployment
 */

const fs = require('fs');
const path = require('path');
const { isConfigured, supabase, getSupabaseHospitals, getSupabaseRequests } = require('../backend/supabaseClient');
const { handleAuthRoutes } = require('../backend/routes/auth');
const { handleHospitalRoutes } = require('../backend/routes/hospitals');
const { handleRequestRoutes } = require('../backend/routes/requests');
const { handleTriageRoutes } = require('../backend/routes/triage');
const { handleAiRoutes } = require('../backend/routes/ai');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function serveStatic(pathname, res) {
  const rootDir = path.resolve(__dirname, '..');
  let cleanPath = pathname;
  if (cleanPath === '/' || cleanPath === '') {
    cleanPath = '/index.html';
  }

  const safePath = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(rootDir, safePath);

  // If not found in root, check in frontend/
  if (!fs.existsSync(filePath) || (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory())) {
    const frontendPath = path.join(rootDir, 'frontend', safePath);
    if (fs.existsSync(frontendPath) && !fs.statSync(frontendPath).isDirectory()) {
      filePath = frontendPath;
    }
  }

  // Handle directory index
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const indexInDir = path.join(filePath, 'index.html');
    if (fs.existsSync(indexInDir)) {
      filePath = indexInDir;
    }
  }

  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
    });
    res.end(content);
    return true;
  }

  return false;
}

// In-memory cache for serverless invocation
let db = { hospitals: [], requests: [] };

async function syncDB() {
  if (isConfigured && supabase) {
    try {
      const h = await getSupabaseHospitals();
      if (h && h.length > 0) db.hospitals = h;
      const r = await getSupabaseRequests();
      if (r) db.requests = r;
    } catch (e) {
      // Fallback
    }
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse body safely
  let body = req.body || null;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {}
  }
  if (!body && (req.method === 'POST' || req.method === 'PUT')) {
    body = await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : null);
        } catch (e) {
          resolve(null);
        }
      });
    });
  }

  const parsedUrl = new URL(req.url, `https://${req.headers.host || 'pran.vercel.app'}`);
  const pathname = parsedUrl.pathname;

  // Serve static frontend assets for non-API routes (supports Vercel Node runtime)
  if (!pathname.startsWith('/api')) {
    const served = serveStatic(pathname, res);
    if (served) return;
  }

  // Sync DB on cold start
  if (db.hospitals.length === 0) {
    await syncDB();
  }

  // Health check
  if (pathname === '/api' || pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      system: 'PRAN Emergency Coordination Backend',
      platform: 'Vercel Serverless',
      supabaseConnected: isConfigured && Boolean(supabase),
      database: isConfigured ? 'supabase' : 'local_storage',
      endpoints: [
        'GET  /api/health',
        'GET  /api/supabase/status',
        'GET  /api/supabase/config',
        'GET  /api/ai/status',
        'POST /api/ai/triage',
        'POST /api/ai/copilot',
        'POST /api/ai/match-rationale',
        'POST /api/auth/login',
        'GET  /api/hospitals',
        'GET  /api/hospitals/:id',
        'PUT  /api/hospitals/:id/capacity',
        'POST /api/triage',
        'GET  /api/requests',
        'POST /api/requests',
        'GET  /api/reservations'
      ]
    }));
    return;
  }

  if (pathname === '/api/supabase/status' || pathname === '/api/supabase/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      configured: isConfigured,
      connected: Boolean(supabase),
      url: process.env.SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY || ''
    }));
    return;
  }

  // Dispatch AI routes
  const aiResult = await handleAiRoutes(req, res, pathname, body, db);
  if (aiResult) {
    res.writeHead(aiResult.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(aiResult.data));
    return;
  }

  // Dispatch Auth routes
  const authResult = handleAuthRoutes(req, res, pathname, body);
  if (authResult) {
    res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(authResult.data));
    return;
  }

  // Dispatch Triage routes
  const triageResult = await handleTriageRoutes(req, res, pathname, body, db);
  if (triageResult) {
    res.writeHead(triageResult.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(triageResult.data));
    return;
  }

  // Dispatch Hospital routes
  const hospitalResult = await handleHospitalRoutes(req, res, pathname, body, db);
  if (hospitalResult) {
    res.writeHead(hospitalResult.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(hospitalResult.data));
    return;
  }

  // Dispatch Request routes
  const requestResult = await handleRequestRoutes(req, res, pathname, body, db);
  if (requestResult) {
    res.writeHead(requestResult.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(requestResult.data));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found', path: pathname }));
};
