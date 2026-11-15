/**
 * Hospital Routing & Recommendation Engine
 * Aligned with Hospital Bed Routing System specification
 * 
 * Matches patient severity with real-time hospital bed capacity,
 * Haversine proximity, travel time, and load scores.
 */

// Geographic reference coordinates for Kolkata areas
const KNOWN_COORDINATES = {
  'salt lake': { lat: 22.5802, lng: 88.4326 },
  'sector v': { lat: 22.5802, lng: 88.4326 },
  'new town': { lat: 22.5937, lng: 88.4682 },
  'bidhannagar': { lat: 22.5867, lng: 88.4178 },
  'kestopur': { lat: 22.5980, lng: 88.4285 },
  'em bypass': { lat: 22.5186, lng: 88.3976 },
  'dum dum': { lat: 22.6247, lng: 88.4208 },
  'park street': { lat: 22.5535, lng: 88.3519 },
  'howrah': { lat: 22.5958, lng: 88.2636 },
  'default': { lat: 22.5726, lng: 88.3639 }
};

/**
 * Resolve text location or object to { lat, lng }
 */
function resolveCoordinates(loc) {
  if (loc && typeof loc === 'object' && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    return loc;
  }

  const str = String(loc || '').toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_COORDINATES)) {
    if (str.includes(key)) {
      return coords;
    }
  }

  return KNOWN_COORDINATES['default'];
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Object} coord1 - {lat, lng}
 * @param {Object} coord2 - {lat, lng}
 * @returns {number} - Distance in kilometers
 */
function calculateDistance(coord1, coord2) {
  const c1 = resolveCoordinates(coord1);
  const c2 = resolveCoordinates(coord2);

  const R = 6371; // Earth's radius in km
  const dLat = toRad(c2.lat - c1.lat);
  const dLng = toRad(c2.lng - c1.lng);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(c1.lat)) * Math.cos(toRad(c2.lat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Estimate travel time based on distance (city traffic speed: 30 km/h)
 * @param {number} distance - Distance in km
 * @returns {number} - Travel time in minutes
 */
function estimateTravelTime(distance) {
  const averageSpeed = 30; // km/h
  return Math.max(3, Math.ceil((distance / averageSpeed) * 60));
}

/**
 * Calculate hospital load score (0-100, lower is better)
 */
function calculateLoadScore(hospital) {
  const icuAvailable = Number(hospital.icu ?? hospital.beds?.icu?.available ?? 0);
  const icuTotal = Number(hospital.icu_total ?? hospital.beds?.icu?.total ?? Math.max(icuAvailable, 10));

  const generalAvailable = Number(hospital.general ?? hospital.beds?.general?.available ?? 0);
  const generalTotal = Number(hospital.general_total ?? hospital.beds?.general?.total ?? Math.max(generalAvailable, 30));

  const oxygenAvailable = Number(hospital.oxygen ?? hospital.beds?.oxygen?.available ?? Math.floor(generalAvailable * 0.4));
  const oxygenTotal = Number(hospital.oxygen_total ?? hospital.beds?.oxygen?.total ?? Math.max(oxygenAvailable, 15));

  const icuLoad = (icuTotal - icuAvailable) / icuTotal;
  const oxygenLoad = (oxygenTotal - oxygenAvailable) / oxygenTotal;
  const generalLoad = (generalTotal - generalAvailable) / generalTotal;

  // Weighted average: ICU is most critical (50%), Oxygen (30%), General (20%)
  const loadScore = Math.round((icuLoad * 0.5 + oxygenLoad * 0.3 + generalLoad * 0.2) * 100);
  return Math.min(100, Math.max(0, loadScore));
}

/**
 * Find best hospital matches for patient based on required ward and severity
 * @param {string} requiredWard - 'icu', 'oxygen', or 'general'
 * @param {Object|string} patientLocation - Coordinates or location text
 * @param {Array} hospitals - List of hospitals from database
 * @param {string} severity - 'CRITICAL', 'URGENT', or 'STABLE'
 * @returns {Object} - Recommended hospital with ranked alternatives
 */
function findBestHospitals(requiredWard = 'general', patientLocation, hospitals = [], severity = 'STABLE') {
  const wardKey = String(requiredWard).toLowerCase();

  const hospitalsWithCapacity = hospitals
    .map(hospital => {
      const hospitalCoords = hospital.location || resolveCoordinates(hospital.area || hospital.name);
      const distance = calculateDistance(patientLocation, hospitalCoords);
      const travelTime = estimateTravelTime(distance);
      const loadScore = calculateLoadScore(hospital);

      // Determine available beds for requested ward
      let availableBeds = 0;
      if (wardKey === 'icu') {
        availableBeds = Number(hospital.icu ?? hospital.beds?.icu?.available ?? 0);
      } else if (wardKey === 'oxygen') {
        availableBeds = Number(hospital.oxygen ?? hospital.beds?.oxygen?.available ?? Math.floor((hospital.general || 0) * 0.4));
      } else {
        availableBeds = Number(hospital.general ?? hospital.beds?.general?.available ?? 0);
      }

      return {
        ...hospital,
        distance,
        travelTime,
        loadScore,
        availableBeds,
        requiredWardType: wardKey
      };
    })
    .filter(h => h.availableBeds > 0);

  // Multi-factor ranking
  const rankedHospitals = hospitalsWithCapacity.map(hospital => {
    let score = 0;

    // 1. Distance factor (0-5km: 30pts, 5-10km: 20pts, 10-15km: 10pts, >15km: 5pts)
    if (hospital.distance <= 5) score += 30;
    else if (hospital.distance <= 10) score += 20;
    else if (hospital.distance <= 15) score += 10;
    else score += 5;

    // 2. Bed availability factor (max 30 pts)
    score += Math.min(hospital.availableBeds * 5, 30);

    // 3. Hospital load factor (less loaded is better, up to 20 pts)
    score += (100 - hospital.loadScore) / 5;

    // 4. Critical response bonus (nearby hospitals with travel time <= 15 mins)
    if (severity === 'CRITICAL' && hospital.travelTime <= 15) {
      score += 20;
    }

    return {
      ...hospital,
      rankingScore: Math.round(score)
    };
  });

  // Sort descending by rankingScore
  rankedHospitals.sort((a, b) => b.rankingScore - a.rankingScore);

  const result = {
    hasCapacity: rankedHospitals.length > 0,
    recommended: rankedHospitals[0] || null,
    fallbacks: rankedHospitals.slice(1, 3),
    totalHospitalsChecked: hospitals.length,
    hospitalsWithCapacity: rankedHospitals.length
  };

  // If no capacity in required ward, provide alternative ward options
  if (!result.hasCapacity) {
    result.alternativeOptions = findAlternativeWards(wardKey, patientLocation, hospitals);
  }

  return result;
}

/**
 * Find alternative ward options if primary requested ward is saturated
 */
function findAlternativeWards(requiredWard, patientLocation, hospitals = []) {
  const alternatives = [];

  // If ICU is full, find hospitals with Oxygen or General beds
  if (requiredWard === 'icu') {
    const oxygenHospitals = hospitals
      .map(h => {
        const dist = calculateDistance(patientLocation, h.location || h.area);
        const beds = Number(h.oxygen ?? h.beds?.oxygen?.available ?? Math.floor((h.general || 0) * 0.4));
        return {
          ...h,
          distance: dist,
          travelTime: estimateTravelTime(dist),
          availableBeds: beds,
          wardType: 'oxygen',
          note: 'ICU ward saturated - Oxygen bed alternative available for stabilization'
        };
      })
      .filter(h => h.availableBeds > 0)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);

    alternatives.push(...oxygenHospitals);
  }

  // If oxygen or general full
  if (alternatives.length === 0) {
    const generalHospitals = hospitals
      .map(h => {
        const dist = calculateDistance(patientLocation, h.location || h.area);
        const beds = Number(h.general ?? h.beds?.general?.available ?? 0);
        return {
          ...h,
          distance: dist,
          travelTime: estimateTravelTime(dist),
          availableBeds: beds,
          wardType: 'general',
          note: 'General ward alternative (monitoring required)'
        };
      })
      .filter(h => h.availableBeds > 0)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);

    alternatives.push(...generalHospitals);
  }

  return alternatives;
}

module.exports = {
  findBestHospitals,
  calculateDistance,
  estimateTravelTime,
  calculateLoadScore,
  resolveCoordinates
};
