/**
 * Triage Logic - Non-clinical severity assessment
 * Aligned with Hospital Bed Routing System specification
 * 
 * Assesses urgency based on observable symptoms and triage responses:
 * - Consciousness
 * - Severe Bleeding
 * - Breathing Difficulty ('severe', 'mild', 'none')
 * - Chest Pain
 * - High Fever (>102°F)
 * - Severe Trauma/Injury
 * - Vulnerable Age Group ('infant', 'child', 'adult', 'elderly')
 */

const SEVERITY_LEVELS = {
  CRITICAL: 'CRITICAL',
  URGENT: 'URGENT',
  STABLE: 'STABLE'
};

/**
 * Calculate severity score based on triage responses
 * @param {Object} responses - Patient triage responses
 * @returns {Object} - Severity classification with score and confidence
 */
function calculateSeverity(responses = {}) {
  let score = 0;
  let conflictingSignals = [];
  let confidenceFactors = [];

  // Question 1: Consciousness
  if (responses.isConscious === false) {
    score += 10;
    confidenceFactors.push('high');
  } else if (responses.isConscious === true) {
    score += 0;
    confidenceFactors.push('high');
  }

  // Question 2: Severe Bleeding
  if (responses.hasSevereBleeding === true) {
    score += 9;
    confidenceFactors.push('high');
  } else if (responses.hasSevereBleeding === false) {
    confidenceFactors.push('medium');
  }

  // Question 3: Breathing Difficulty
  switch (responses.breathingDifficulty) {
    case 'severe':
      score += 8;
      confidenceFactors.push('high');
      break;
    case 'mild':
      score += 3;
      confidenceFactors.push('medium');
      break;
    case 'none':
      score += 0;
      confidenceFactors.push('high');
      break;
    default:
      if (responses.category === 'Cardiac' || responses.category === 'Accident') {
        score += 4;
      }
      confidenceFactors.push('medium');
  }

  // Question 4: Chest Pain
  if (responses.hasChestPain === true || responses.category === 'Cardiac') {
    score += 7;
    confidenceFactors.push('high');
  }

  // Question 5: High Fever (>102°F)
  if (responses.hasHighFever === true) {
    score += 2;
    confidenceFactors.push('medium');
  }

  // Question 6: Severe Injury/Trauma
  if (responses.hasSevereTrauma === true || (responses.category === 'Accident' && responses.age < 18)) {
    score += 8;
    confidenceFactors.push('high');
  }

  // Question 7: Age Group (vulnerability factor)
  const age = Number(responses.age) || 30;
  const isVulnerable = responses.ageGroup === 'infant' || responses.ageGroup === 'elderly' || age <= 5 || age >= 65;
  if (isVulnerable) {
    score += 2;
    confidenceFactors.push('medium');
  }

  // Detect conflicting signals
  if (responses.isConscious && responses.breathingDifficulty === 'severe') {
    conflictingSignals.push('Patient conscious but experiencing severe breathing difficulty');
  }

  if (responses.isConscious === false && !responses.hasSevereBleeding && !responses.hasChestPain && responses.breathingDifficulty === 'none') {
    conflictingSignals.push('Unconscious state without overt acute physical symptoms');
  }

  // Determine severity level
  let severity;
  if (score >= 15) {
    severity = SEVERITY_LEVELS.CRITICAL;
  } else if (score >= 7) {
    severity = SEVERITY_LEVELS.URGENT;
  } else {
    severity = SEVERITY_LEVELS.STABLE;
  }

  // Calculate confidence
  const highConfidenceCount = confidenceFactors.filter(f => f === 'high').length;
  const lowConfidenceCount = confidenceFactors.filter(f => f === 'low').length;
  
  let confidence;
  if (conflictingSignals.length > 0 || lowConfidenceCount > 2) {
    confidence = 'LOW';
  } else if (highConfidenceCount >= 3) {
    confidence = 'HIGH';
  } else {
    confidence = 'MEDIUM';
  }

  return {
    severity,
    score,
    confidence,
    conflictingSignals,
    requiresHumanReview: confidence === 'LOW' || conflictingSignals.length > 0
  };
}

/**
 * Get ward type recommendation based on severity
 */
function getRequiredWardType(severity) {
  switch (severity) {
    case SEVERITY_LEVELS.CRITICAL:
      return 'icu';
    case SEVERITY_LEVELS.URGENT:
      return 'oxygen';
    case SEVERITY_LEVELS.STABLE:
      return 'general';
    default:
      return 'general';
  }
}

module.exports = {
  calculateSeverity,
  getRequiredWardType,
  SEVERITY_LEVELS
};
