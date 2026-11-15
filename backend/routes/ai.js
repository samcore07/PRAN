/**
 * PRAN AI Routes
 * Exposes Groq-powered clinical triage, emergency copilot, and hospital routing explanations.
 */

const { isAiConfigured, getAiStatus, analyzeEmergencyTriage, copilotChat, explainHospitalMatch } = require('../services/aiService');

async function handleAiRoutes(req, res, path, body, db) {
  const customKey = req.headers?.['x-groq-api-key'] || body?.apiKey || '';

  // 1. AI System Health & Configuration Status
  if (path === '/api/ai/status' && req.method === 'GET') {
    return {
      status: 200,
      data: {
        success: true,
        ...getAiStatus(customKey)
      }
    };
  }

  // 2. Comprehensive AI Emergency Triage Assessment
  if (path === '/api/ai/triage' && req.method === 'POST') {
    try {
      const patientData = body || {};
      const assessment = await analyzeEmergencyTriage(patientData, customKey);
      return {
        status: 200,
        data: {
          success: true,
          assessment,
          timestamp: new Date().toISOString()
        }
      };
    } catch (err) {
      console.error('AI triage route error:', err);
      return {
        status: 500,
        data: {
          success: false,
          error: 'AI Triage processing failed: ' + err.message
        }
      };
    }
  }

  // 3. Interactive Emergency Medical Copilot Chatbot
  if (path === '/api/ai/copilot' && req.method === 'POST') {
    try {
      const { messages = [], context = {} } = body || {};
      
      // Augment context with live network stats
      const liveContext = {
        hospitalCount: db?.hospitals ? db.hospitals.length : 15,
        generalBeds: db?.hospitals ? db.hospitals.reduce((acc, h) => acc + (Number(h.general) || 0), 0) : 0,
        icuBeds: db?.hospitals ? db.hospitals.reduce((acc, h) => acc + (Number(h.icu) || 0), 0) : 0,
        ...context
      };

      const result = await copilotChat(messages, liveContext, customKey);
      return {
        status: 200,
        data: {
          success: true,
          ...result,
          timestamp: new Date().toISOString()
        }
      };
    } catch (err) {
      console.error('AI copilot route error:', err);
      return {
        status: 500,
        data: {
          success: false,
          error: 'Emergency copilot error: ' + err.message
        }
      };
    }
  }

  // 4. Clinical Match Rationale
  if (path === '/api/ai/match-rationale' && req.method === 'POST') {
    try {
      const { patient = {}, hospital = {}, routingScore } = body || {};
      const explanation = await explainHospitalMatch(patient, hospital, routingScore, customKey);
      return {
        status: 200,
        data: {
          success: true,
          rationale: explanation,
          timestamp: new Date().toISOString()
        }
      };
    } catch (err) {
      return {
        status: 500,
        data: {
          success: false,
          error: 'Match rationale failed: ' + err.message
        }
      };
    }
  }

  return null;
}

module.exports = { handleAiRoutes };
