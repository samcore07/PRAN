/**
 * PRAN Triage & Smart Hospital Routing Route
 * Aligned with Hospital Bed Routing System specification
 * 
 * Integrates:
 * - Non-clinical symptom severity assessment
 * - Supabase live hospital capacity queries
 * - Haversine distance, travel time, and load-score hospital matching
 */

const { calculateSeverity, getRequiredWardType } = require('../services/triageLogic');
const { findBestHospitals } = require('../services/routingLogic');
const { getSupabaseHospitals } = require('../supabaseClient');

async function handleTriageRoutes(req, res, path, body, db) {
  if (path === '/api/triage' && req.method === 'POST') {
    try {
      const { responses = {}, patientLocation, category, facility, location } = body || {};

      const triageResponses = {
        category,
        facility,
        ...responses
      };

      const triageResult = calculateSeverity(triageResponses);
      const requiredWard = facility ? String(facility).toLowerCase() : getRequiredWardType(triageResult.severity);

      // Fetch live hospitals from Supabase
      let hospitals = await getSupabaseHospitals();
      if (!hospitals || hospitals.length === 0) {
        hospitals = db.hospitals;
      }

      const loc = patientLocation || location || 'Kolkata';

      // Find best hospital matches
      const routingResult = findBestHospitals(
        requiredWard,
        loc,
        hospitals,
        triageResult.severity
      );

      return {
        status: 200,
        data: {
          success: true,
          triage: triageResult,
          requiredWard,
          routing: routingResult,
          timestamp: new Date().toISOString()
        }
      };
    } catch (err) {
      console.error('Triage route error:', err);
      return {
        status: 500,
        data: {
          success: false,
          error: 'Failed to process triage assessment: ' + err.message
        }
      };
    }
  }

  return null;
}

module.exports = { handleTriageRoutes };
