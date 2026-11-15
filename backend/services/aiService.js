/**
 * PRAN AI Emergency Service
 * Powered by Groq Ultra-Low Latency Inference (LLaMA 3.3 70B / 3.1 8B)
 * 
 * Provides:
 * 1. Clinical Emergency Triage Severity Assessment & Ward Recommendation
 * 2. Pre-hospital Immediate Life Support Instructions & Vital Sign Alerts
 * 3. AI Emergency Medical Copilot (Interactive assistant for Attendants and EMTs)
 * 4. Intelligent Hospital Match Clinical Justification
 * 
 * Includes automatic clinical heuristic fallback if GROQ_API_KEY is not yet supplied.
 */

const https = require('https');
const http = require('http');

function getGroqKey(customKey) {
  let key = '';
  if (customKey && typeof customKey === 'string' && customKey.trim().length > 5) {
    key = customKey.trim();
  } else {
    key = (process.env.GROQ_API_KEY || '').trim();
  }
  // Strip accidental enclosing quotes from environment variables
  return key.replace(/^["']|["']$/g, '').trim();
}

function getGroqModel() {
  let raw = (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim();
  raw = raw.replace(/^["']|["']$/g, '').trim();

  // Auto-upgrade any deprecated or legacy model names to active Groq production models
  const aliasMap = {
    'llama-3.1-70b-versatile': 'llama-3.3-70b-versatile',
    'llama3-70b-8192': 'llama-3.3-70b-versatile',
    'llama3-8b-8192': 'llama-3.1-8b-instant',
    'llama-3-70b': 'llama-3.3-70b-versatile',
    'llama-3-8b': 'llama-3.1-8b-instant'
  };
  return aliasMap[raw] || raw || 'llama-3.3-70b-versatile';
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

function isAiConfigured(customKey) {
  const key = getGroqKey(customKey);
  return Boolean(key && key.length > 5 && !key.includes('your_groq_api_key'));
}

function getAiStatus(customKey) {
  return {
    configured: isAiConfigured(customKey),
    provider: 'Groq',
    model: getGroqModel(),
    capabilities: [
      'Clinical Triage Scoring (0-100)',
      'Pre-Hospital First-Aid Protocol',
      'Vital Signs Hemodynamic Alerting',
      'Specialized Ward Recommendation',
      'Emergency Medical Copilot Assistant'
    ]
  };
}

/**
 * Perform an HTTP POST request to Groq API using native fetch (or https.request fallback)
 */
async function callGroqApi(messages, options = {}) {
  const key = getGroqKey(options.apiKey);
  if (!key || key.includes('your_groq_api_key')) {
    throw new Error('GROQ_API_KEY is not configured in Vercel environment variables');
  }

  const activeModel = options.model || getGroqModel();
  const payload = {
    model: activeModel,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens ?? 1024
  };
  if (options.json) {
    payload.response_format = { type: 'json_object' };
  }

  // Modern Node 18+ and Vercel serverless native fetch
  if (typeof fetch === 'function') {
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API returned HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || '';
  }

  // Fallback to https.request
  return new Promise((resolve, reject) => {
    const payloadStr = JSON.stringify(payload);
    const url = new URL(GROQ_ENDPOINT);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'Content-Length': Buffer.byteLength(payloadStr)
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.choices?.[0]?.message?.content || '');
          } catch(e) {
            reject(new Error('Failed to parse Groq response: ' + e.message));
          }
        } else {
          reject(new Error(`Groq API returned HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Groq API request timed out'));
    });
    req.write(payloadStr);
    req.end();
  });
}

/**
 * Heuristic clinical fallback engine if Groq is not configured or offline
 */
function heuristicTriage(patient) {
  const symptoms = (patient.symptoms || patient.chiefComplaint || '').toLowerCase();
  const vitals = patient.vitals || {};
  const hr = Number(vitals.heartRate) || 80;
  const bpSys = Number(vitals.systolicBP || vitals.bpSys) || 120;
  const spo2 = Number(vitals.spo2) || 98;
  const pain = Number(vitals.painScale) || (patient.painLevel === 'Severe' ? 9 : 4);
  const avpu = (vitals.consciousness || patient.consciousness || 'Alert').toUpperCase();

  const isCritical = 
    spo2 < 90 || 
    hr > 135 || hr < 45 || 
    bpSys < 85 || bpSys > 195 || 
    avpu === 'UNRESPONSIVE' || avpu === 'PAIN' || 
    symptoms.includes('unconscious') || symptoms.includes('stroke') || symptoms.includes('cardiac arrest') ||
    symptoms.includes('chest pain') || symptoms.includes('heart attack') || symptoms.includes('severe bleeding') ||
    symptoms.includes('not breathing') || symptoms.includes('cyanosis');

  const isUrgent = 
    !isCritical && (
      spo2 <= 93 || 
      hr >= 110 || hr <= 55 || 
      bpSys >= 155 || bpSys <= 95 || 
      pain >= 7 || 
      symptoms.includes('fracture') || symptoms.includes('asthma') || symptoms.includes('burn') || 
      symptoms.includes('vomiting blood') || symptoms.includes('seizure') || symptoms.includes('breathless')
    );

  const severity = isCritical ? 'CRITICAL' : (isUrgent ? 'URGENT' : 'STABLE');
  const triageScore = isCritical ? Math.min(100, 85 + Math.round((100 - spo2) / 2)) : (isUrgent ? 65 : 30);
  const recommendedWard = isCritical ? 'ICU' : 'GENERAL';

  const vitalAlerts = [];
  if (spo2 < 92) vitalAlerts.push(`Critical Hypoxia detected (SpO2: ${spo2}%)`);
  if (bpSys > 180) vitalAlerts.push(`Severe Hypertensive Crisis (Systolic BP: ${bpSys} mmHg)`);
  if (bpSys < 90) vitalAlerts.push(`Severe Hypotension / Shock (Systolic BP: ${bpSys} mmHg)`);
  if (hr > 120) vitalAlerts.push(`Tachycardia Alert (Heart Rate: ${hr} bpm)`);
  if (hr < 50) vitalAlerts.push(`Bradycardia Alert (Heart Rate: ${hr} bpm)`);
  if (avpu !== 'ALERT' && avpu !== 'A') vitalAlerts.push(`Depressed Mental Status (${avpu})`);

  const immediateActions = [];
  if (isCritical) {
    immediateActions.push('Ensure open airway, position patient semi-upright or left-lateral if vomiting');
    immediateActions.push('Administer high-flow supplemental oxygen (10-15 L/min via non-rebreather mask)');
    immediateActions.push('Establish wide-bore IV access (18G) and initiate continuous cardiac/pulse oximetry monitoring');
    immediateActions.push('Alert incoming emergency trauma/cardiac resuscitation team prior to ambulance arrival');
  } else if (isUrgent) {
    immediateActions.push('Keep patient calm, comfortable, and resting; avoid unnecessary exertion');
    immediateActions.push('Monitor vital signs every 5-10 minutes and record any deterioration');
    immediateActions.push('Keep NPO (nothing by mouth) in case emergency surgery or sedation is needed');
    immediateActions.push('Prepare patient medical records, current medications, and known allergies');
  } else {
    immediateActions.push('Maintain patient in a safe, quiet observation area');
    immediateActions.push('Record baseline vital signs and monitor for sudden symptom escalation');
    immediateActions.push('Prepare identification, insurance, and emergency contact details for intake');
  }

  return {
    source: 'clinical-heuristic-engine',
    severity,
    triageScore,
    code: isCritical ? 'CODE_RED' : (isUrgent ? 'CODE_YELLOW' : 'CODE_GREEN'),
    recommendedWard,
    confidence: 88,
    clinicalSummary: `Patient (${patient.name || 'Anonymous'}, ${patient.age || 'Age N/A'}) presents with: ${patient.symptoms || 'Non-specific emergency symptoms'}. Triage severity classified as ${severity} based on clinical hemodynamics and acute presentation.`,
    vitalAlerts,
    immediateActions,
    specialtiesNeeded: isCritical ? ['Emergency Medicine Specialist', 'Intensivist', 'Critical Care Nursing'] : ['General Emergency Care']
  };
}

/**
 * Analyze emergency intake using Groq AI
 */
async function analyzeEmergencyTriage(patient, customKey) {
  if (!isAiConfigured(customKey)) {
    return heuristicTriage(patient);
  }

  const prompt = `You are the PRAN AI Emergency Medicine Clinical Triage Officer.
Analyze the following emergency patient intake data with maximum clinical rigor.
Return ONLY a valid JSON object matching the requested schema.

PATIENT DATA:
- Name: ${patient.name || 'Not provided'}
- Age: ${patient.age || 'Not provided'}
- Gender: ${patient.gender || 'Not specified'}
- Chief Complaint & Symptoms: ${patient.symptoms || patient.chiefComplaint || 'None provided'}
- Vitals:
  * Heart Rate: ${patient.vitals?.heartRate || 'Not recorded'} bpm
  * Blood Pressure: ${patient.vitals?.systolicBP || patient.vitals?.bpSys || 'Not recorded'}/${patient.vitals?.diastolicBP || patient.vitals?.bpDia || 'Not recorded'} mmHg
  * Oxygen Saturation (SpO2): ${patient.vitals?.spo2 || 'Not recorded'} %
  * Respiratory Rate: ${patient.vitals?.respiratoryRate || 'Not recorded'} /min
  * Consciousness (AVPU): ${patient.vitals?.consciousness || patient.consciousness || 'Alert'}
  * Pain Scale (0-10): ${patient.vitals?.painScale || patient.painLevel || 'Not recorded'}
- Known Conditions: ${patient.medicalHistory || patient.conditions || 'None stated'}

OUTPUT JSON SCHEMA:
{
  "severity": "CRITICAL" | "URGENT" | "STABLE",
  "triageScore": number (0 to 100),
  "code": "CODE_RED" | "CODE_YELLOW" | "CODE_GREEN",
  "recommendedWard": "ICU" | "GENERAL" | "CARDIOLOGY" | "TRAUMA" | "PEDIATRIC" | "NEUROLOGY",
  "confidence": number (80 to 99),
  "clinicalSummary": "Concise 2-sentence clinical assessment",
  "vitalAlerts": ["list of any abnormal/concerning vital signs or red flags"],
  "immediateActions": ["3-5 prioritized pre-hospital first-aid/EMS action points"],
  "specialtiesNeeded": ["list of medical specialties required on arrival"]
}`;

  try {
    const raw = await callGroqApi([
      { role: 'system', content: 'You are an emergency triage medical AI. Output pure JSON without markdown code fences.' },
      { role: 'user', content: prompt }
    ], { json: true, temperature: 0.1, apiKey: customKey });

    const parsed = JSON.parse(raw);
    const activeModel = getGroqModel();
    return {
      source: `groq-${activeModel}`,
      severity: parsed.severity || 'URGENT',
      triageScore: Number(parsed.triageScore) || 70,
      code: parsed.code || 'CODE_YELLOW',
      recommendedWard: parsed.recommendedWard || 'ICU',
      confidence: Number(parsed.confidence) || 95,
      clinicalSummary: parsed.clinicalSummary || '',
      vitalAlerts: Array.isArray(parsed.vitalAlerts) ? parsed.vitalAlerts : [],
      immediateActions: Array.isArray(parsed.immediateActions) ? parsed.immediateActions : [],
      specialtiesNeeded: Array.isArray(parsed.specialtiesNeeded) ? parsed.specialtiesNeeded : []
    };
  } catch (err) {
    console.warn('Groq AI triage call failed, falling back to heuristic engine:', err.message);
    const fallback = heuristicTriage(patient);
    fallback.note = `AI offline (${err.message}). Evaluated by PRAN Clinical Safety Engine.`;
    return fallback;
  }
}

/**
 * Interactive Emergency Copilot Chatbot
 */
async function copilotChat(messages, context = {}, customKey) {
  const activeModel = getGroqModel();
  const systemPrompt = `You are PRAN Emergency Copilot, an ultra-fast AI assistant for patients, attendants, and ambulance operators.
You provide instant, calm, actionable medical guidance, CPR instructions, emergency first-aid advice, and hospital triage navigation.
Always prioritize patient safety. Remind users for immediate life threats to follow live emergency dispatch.
Keep answers structured, concise, and easy to read during high-stress emergencies.

CURRENT ACTIVE CONTEXT:
- Connected Hospitals: ${context.hospitalCount || 15}
- Available General Beds: ${context.generalBeds || 'N/A'}
- Available ICU Beds: ${context.icuBeds || 'N/A'}
- User Role: ${context.role || 'Guest / Attendant'}`;

  if (!isAiConfigured(customKey)) {
    const lastMsg = (messages[messages.length - 1]?.content || '').toLowerCase();
    let reply = "Hello! I am the PRAN Emergency Assistant. ";
    if (lastMsg.includes('cpr') || lastMsg.includes('unconscious') || lastMsg.includes('not breathing')) {
      reply += "🚨 EMERGENCY CPR PROTOCOL:\n1. Check responsiveness & pulse for max 10 seconds.\n2. Call for an ambulance immediately.\n3. Begin chest compressions: Push hard and fast in the center of the chest (100-120 bpm, 2 inches deep).\n4. If trained, deliver 2 rescue breaths after every 30 compressions.\n5. Attach an AED as soon as available.";
    } else if (lastMsg.includes('chest pain') || lastMsg.includes('heart attack')) {
      reply += "⚠️ CHEST PAIN EMERGENCY ADVICE:\n1. Have patient sit upright in a comfortable position.\n2. Loosen tight clothing.\n3. If prescribed, assist with sublingual nitroglycerin.\n4. Administer Aspirin (325 mg, chewed) if not allergic.\n5. Keep patient calm and dispatch ambulance immediately.";
    } else if (lastMsg.includes('bed') || lastMsg.includes('icu') || lastMsg.includes('hospital')) {
      reply += `🏥 HOSPITAL NETWORK STATUS:\nWe currently have connected hospitals in Kolkata with active ICU and General emergency beds. Use the 'Bed Availability' or 'Hospital Matching' tab to route directly with live GPS.`;
    } else {
      reply += `I am ready to assist you with emergency triage, first aid steps, or hospital routing. To enable live Groq AI reasoning, ensure GROQ_API_KEY is configured in your Vercel Environment Variables.`;
    }
    return {
      message: reply,
      source: 'offline-safety-rules',
      model: 'heuristic'
    };
  }

  try {
    const cleanHistory = (Array.isArray(messages) ? messages : [])
      .filter(m => m && typeof m.content === 'string' && m.content.trim())
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content).trim()
      }))
      .slice(-8);

    const conversation = [
      { role: 'system', content: systemPrompt },
      ...cleanHistory
    ];

    const reply = await callGroqApi(conversation, { temperature: 0.3, max_tokens: 600, apiKey: customKey });
    return {
      message: reply,
      source: `groq-${activeModel}`,
      model: activeModel
    };
  } catch (err) {
    return {
      message: `Emergency response protocol: Keep patient stable and calm. (Groq API notice: ${err.message})`,
      source: 'fallback',
      error: err.message
    };
  }
}

/**
 * Intelligent Match Rationale Generator
 */
async function explainHospitalMatch(patient, hospital, routingScore, customKey) {
  if (!isAiConfigured(customKey)) {
    return `${hospital.name} is recommended because it is within ${hospital.distance || 'optimal'} km (${hospital.etaMinutes || '12'} mins ETA) and has ${hospital.icu || 0} ICU beds and ${hospital.general || 0} General beds available.`;
  }

  const prompt = `In 2 sentences, explain why ${hospital.name} in ${hospital.area} is the optimal choice for a patient presenting with: "${patient.symptoms || 'acute condition'}".
Hospital features: ${hospital.icu} ICU beds, ${hospital.general} General beds, estimated travel time ${hospital.etaMinutes || '10'} minutes.`;

  try {
    const rationale = await callGroqApi([
      { role: 'system', content: 'You are a healthcare logistics expert. Be concise and professional.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.2, max_tokens: 120, apiKey: customKey });
    return rationale.trim();
  } catch (e) {
    return `${hospital.name} is selected based on real-time bed capacity (${hospital.icu} ICU beds) and fast proximity (${hospital.etaMinutes || '12'} mins travel time).`;
  }
}

module.exports = {
  isAiConfigured,
  getAiStatus,
  analyzeEmergencyTriage,
  copilotChat,
  explainHospitalMatch
};
