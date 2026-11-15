/* ============================================
   EMERGENCY REQUEST & AI TRIAGE CONTROLLER
============================================ */

let currentAiAssessment = null;

function requestPage() {
    return `
        ${heading("PATIENT INTAKE", "Create an <span>emergency request.</span>", "Enter patient vitals and symptoms for instant AI clinical triage & bed routing.")}
        <div class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 8px;">
                <h2>Patient & Vitals Information</h2>
                <button type="button" id="btnQuickAiTriage" class="btn btn-small btn-primary" style="background: linear-gradient(135deg, #153b60, #1767a5);">
                    ⚡ Analyze with PRAN AI Triage
                </button>
            </div>
            <p class="panel-subtitle">Fields marked with * are required for emergency routing.</p>

            <form id="patientRequestForm">
                <div class="form-grid">
                    <label class="field">Patient full name *
                        <input id="patientName" required maxlength="70" placeholder="e.g. Rahul Sen">
                    </label>
                    <label class="field">Age *
                        <input id="patientAge" type="number" min="0" max="120" required placeholder="e.g. 52">
                    </label>
                    <label class="field">Contact number *
                        <input id="patientContact" type="tel" maxlength="10" required placeholder="10-digit mobile number">
                    </label>
                    <label class="field">Emergency category *
                        <select id="patientCategory" required>
                            <option value="">Select category</option>
                            <option value="Cardiac">Cardiac / Chest Pain</option>
                            <option value="Accident">Trauma / Accident</option>
                            <option value="Neurological">Neurological / Stroke</option>
                            <option value="Respiratory">Severe Breathlessness / Asthma</option>
                            <option value="General">General Medical Emergency</option>
                        </select>
                    </label>

                    <!-- CLINICAL VITALS SECTION -->
                    <label class="field">Heart Rate (bpm)
                        <input id="patientHr" type="number" min="30" max="240" placeholder="e.g. 110">
                    </label>
                    <label class="field">Blood Pressure (Systolic)
                        <input id="patientBp" type="number" min="50" max="260" placeholder="e.g. 150">
                    </label>
                    <label class="field">Oxygen Saturation (SpO2 %)
                        <input id="patientSpo2" type="number" min="50" max="100" placeholder="e.g. 91">
                    </label>
                    <label class="field">Consciousness Level (AVPU)
                        <select id="patientAvpu">
                            <option value="Alert">Alert (A)</option>
                            <option value="Voice">Voice Responding (V)</option>
                            <option value="Pain">Pain Responding (P)</option>
                            <option value="Unresponsive">Unresponsive (U)</option>
                        </select>
                    </label>

                    <label class="field">Required bed type *
                        <select id="patientFacility" required>
                            <option value="">Select bed type</option>
                            <option value="ICU">ICU (Critical Care)</option>
                            <option value="General">General Ward</option>
                        </select>
                    </label>
                    <label class="field">Current location *
                        <input id="patientLocation" required placeholder="e.g. Salt Lake Sector V, Kolkata">
                    </label>

                    <label class="field full">Symptoms & Chief Complaint *
                        <textarea id="patientNotes" rows="3" required placeholder="Describe acute symptoms (e.g. crushing retrosternal chest pain radiating to left shoulder, cold sweats, breathlessness for 45 mins)"></textarea>
                    </label>
                </div>

                <!-- Live AI Assessment Preview Container -->
                <div id="aiTriagePreviewContainer"></div>

                <p id="requestError" class="form-error"></p>
                <div class="form-actions">
                    <button class="btn btn-light" type="reset">Clear</button>
                    <button class="btn btn-primary" type="submit">Find matching hospitals →</button>
                </div>
            </form>
        </div>
    `;
}

function renderAiTriageCard(assessment) {
    if (!assessment) return "";
    const isRed = assessment.code === "CODE_RED" || assessment.severity === "CRITICAL";
    const isYellow = assessment.code === "CODE_YELLOW" || assessment.severity === "URGENT";
    const badgeClass = isRed ? "ai-code-red" : (isYellow ? "ai-code-yellow" : "ai-code-green");

    return `
        <div class="ai-triage-card">
            <div class="ai-triage-header">
                <div>
                    <span style="font-size: 10px; font-weight: 800; color: var(--teal); letter-spacing: 0.8px;">⚡ PRAN AI CLINICAL TRIAGE</span>
                    <h3 style="margin: 3px 0 0; color: var(--navy);">Severity: ${safe(assessment.severity)} (${assessment.triageScore}/100)</h3>
                </div>
                <span class="ai-code-badge ${badgeClass}">${safe(assessment.code || assessment.severity)}</span>
            </div>

            <p style="font-size: 12px; line-height: 1.6; color: var(--text); margin-bottom: 8px;">
                ${safe(assessment.clinicalSummary || "Clinical intake assessed.")}
            </p>

            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
                <span class="role-chip">Recommended: <strong>${safe(assessment.recommendedWard)} Bed</strong></span>
                <span class="role-chip" style="background: rgba(36, 150, 110, 0.15); color: #24966e;">Confidence: ${assessment.confidence || 92}%</span>
                ${assessment.source ? `<span class="role-chip" style="background: rgba(23, 103, 165, 0.12); color: var(--blue);">Engine: ${safe(assessment.source)}</span>` : ""}
            </div>

            ${assessment.vitalAlerts && assessment.vitalAlerts.length ? `
                <strong style="font-size: 11px; color: #b91c1c; display: block; margin-top: 6px;">⚠️ Hemodynamic Alerts:</strong>
                <ul class="ai-vital-alerts">
                    ${assessment.vitalAlerts.map(a => `<li class="ai-vital-alert-item">${safe(a)}</li>`).join("")}
                </ul>
            ` : ""}

            ${assessment.immediateActions && assessment.immediateActions.length ? `
                <strong style="font-size: 11px; color: var(--navy); display: block; margin-top: 8px;">📋 Pre-Hospital Action Protocol:</strong>
                <ol class="ai-actions-list">
                    ${assessment.immediateActions.map(act => `<li>${safe(act)}</li>`).join("")}
                </ol>
            ` : ""}
        </div>
    `;
}

function requestCard(r, showActions = true) {
    const h = r.hospitalId ? hospitalById(r.hospitalId) : null;
    const triage = r.aiAssessment;
    const isRed = triage && (triage.code === "CODE_RED" || triage.severity === "CRITICAL");
    const isYellow = triage && (triage.code === "CODE_YELLOW" || triage.severity === "URGENT");
    const codeBadge = isRed ? '<span class="ai-code-badge ai-code-red" style="font-size: 9px; padding: 3px 8px;">🚨 CODE RED</span>' :
                      (isYellow ? '<span class="ai-code-badge ai-code-yellow" style="font-size: 9px; padding: 3px 8px;">⚡ CODE YELLOW</span>' : '');

    return `
        <article class="request-card">
            <div class="card-top">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <h3>${safe(r.patientName)}</h3>
                        ${codeBadge}
                    </div>
                    <p>Request #${String(r.id).slice(-6)} · ${safe(r.category)} · <strong>${safe(r.facility)} bed</strong></p>
                    <p>Location: ${safe(r.location)}</p>
                    <p>Destination: <strong>${h ? safe(h.name) : "Matching with network..."}</strong></p>
                    ${r.vitals && r.vitals.spo2 ? `
                        <p style="font-size: 10px; color: var(--muted); margin-top: 4px;">
                            Vitals: HR ${r.vitals.heartRate || '--'} bpm | BP ${r.vitals.systolicBP || '--'} mmHg | SpO2 ${r.vitals.spo2}%
                        </p>
                    ` : ""}
                </div>
                <span class="status status-${r.status.toLowerCase()}">${safe(r.status)}</span>
            </div>

            ${triage && triage.vitalAlerts && triage.vitalAlerts.length ? `
                <div style="margin: 8px 0; font-size: 10px; color: #b91c1c; background: rgba(239, 68, 68, 0.1); padding: 5px 8px; border-radius: 6px;">
                    ⚠️ ${safe(triage.vitalAlerts[0])}
                </div>
            ` : ""}

            ${showActions ? `
                <div class="card-actions">
                    ${r.status === "Pending" && currentRole === "hospital" ? `
                        <button class="btn-small btn-success" data-accept="${r.id}">✓ Admit Patient</button>
                        <button class="btn-small btn-danger" data-reject="${r.id}">Divert / Reject</button>
                    ` : ""}
                    ${h ? `<button class="btn-small btn-light" data-map="${h.id}">➤ Live Navigation</button>` : ""}
                    ${triage ? `<button class="btn-small btn-light" data-view-triage="${r.id}">⚡ Triage Details</button>` : ""}
                </div>
            ` : ""}
        </article>
    `;
}

function ambulanceRequests() {
    return `
        ${heading("RESPONSE COORDINATION", "Emergency <span>requests.</span>", "Review live triage emergency requests across the network.")}
        <div class="card-grid">
            ${data.requests.length ? data.requests.slice().reverse().map(r => requestCard(r, true)).join("") : emptyState("No emergency requests have been submitted yet.")}
        </div>
    `;
}

// Handler for Live Quick AI Triage Button
document.addEventListener("click", async event => {
    if (event.target.id === "btnQuickAiTriage") {
        const btn = event.target;
        const name = document.getElementById("patientName")?.value.trim() || "Patient";
        const age = Number(document.getElementById("patientAge")?.value) || 45;
        const notes = document.getElementById("patientNotes")?.value.trim() || "";
        const hr = Number(document.getElementById("patientHr")?.value) || 80;
        const bp = Number(document.getElementById("patientBp")?.value) || 120;
        const spo2 = Number(document.getElementById("patientSpo2")?.value) || 98;
        const avpu = document.getElementById("patientAvpu")?.value || "Alert";

        if (!notes) {
            if (typeof toast === "function") toast("Please enter symptoms in Additional Information first.");
            document.getElementById("patientNotes")?.focus();
            return;
        }

        btn.disabled = true;
        btn.textContent = "⚡ Analyzing with Groq AI...";

        const assessment = await requestAiTriage({
            name,
            age,
            symptoms: notes,
            vitals: { heartRate: hr, systolicBP: bp, spo2, consciousness: avpu }
        });

        currentAiAssessment = assessment;
        btn.disabled = false;
        btn.textContent = "⚡ Re-analyze with AI";

        const preview = document.getElementById("aiTriagePreviewContainer");
        if (preview) {
            preview.innerHTML = renderAiTriageCard(assessment);
        }

        // Auto-recommend ward in form
        const facilitySelect = document.getElementById("patientFacility");
        if (facilitySelect && assessment.recommendedWard) {
            facilitySelect.value = assessment.recommendedWard === "ICU" ? "ICU" : "General";
        }

        if (typeof toast === "function") {
            toast(`AI Triage Complete: ${assessment.severity} (${assessment.recommendedWard} Ward)`);
        }
    }

    // Modal view for Triage Details
    const viewTriageBtn = event.target.closest("[data-view-triage]");
    if (viewTriageBtn) {
        const reqId = Number(viewTriageBtn.dataset.viewTriage);
        const req = data.requests.find(r => r.id === reqId);
        if (req && req.aiAssessment) {
            const modalHTML = `
                <div id="triageModal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2000; display: grid; place-items: center; padding: 16px; backdrop-filter: blur(4px);">
                    <div style="background: var(--white); border: 1px solid var(--border); border-radius: 16px; max-width: 520px; width: 100%; padding: 24px; box-shadow: var(--shadow);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                            <h3 style="color: var(--navy); margin: 0;">Clinical Triage Summary: ${safe(req.patientName)}</h3>
                            <button id="closeTriageModalBtn" style="border: 0; background: transparent; font-size: 18px; cursor: pointer; color: var(--muted);">✕</button>
                        </div>
                        ${renderAiTriageCard(req.aiAssessment)}
                        <div style="margin-top: 16px; text-align: right;">
                            <button id="closeTriageModalBtn2" class="btn btn-primary">Close</button>
                        </div>
                    </div>
                </div>
            `;
            const div = document.createElement("div");
            div.id = "triageModalWrapper";
            div.innerHTML = modalHTML;
            document.body.appendChild(div);

            const close = () => div.remove();
            document.getElementById("closeTriageModalBtn")?.addEventListener("click", close);
            document.getElementById("closeTriageModalBtn2")?.addEventListener("click", close);
        }
    }
});

// Patient Form Submission
document.addEventListener("submit", async event => {
    if (event.target.id !== "patientRequestForm") return;

    event.preventDefault();

    const age = Number(document.getElementById("patientAge").value);
    const contact = document.getElementById("patientContact").value.trim();
    const error = document.getElementById("requestError");

    if (error) error.textContent = "";

    if (!Number.isInteger(age) || age < 0 || age > 120) {
        if (error) error.textContent = "Please enter a valid age.";
        return;
    }

    if (!/^[6-9]\d{9}$/.test(contact)) {
        if (error) error.textContent = "Enter a valid 10-digit Indian mobile number.";
        return;
    }

    const patientName = document.getElementById("patientName").value.trim();
    const category = document.getElementById("patientCategory").value;
    const facility = document.getElementById("patientFacility").value;
    const location = document.getElementById("patientLocation").value.trim();
    const notes = document.getElementById("patientNotes").value.trim();

    const hr = Number(document.getElementById("patientHr")?.value) || null;
    const bp = Number(document.getElementById("patientBp")?.value) || null;
    const spo2 = Number(document.getElementById("patientSpo2")?.value) || null;
    const avpu = document.getElementById("patientAvpu")?.value || "Alert";

    if (!patientName || !location || !category || !facility) {
        if (error) error.textContent = "Please complete all required fields.";
        return;
    }

    // If AI triage was not run manually, run it automatically on submission
    let finalAssessment = currentAiAssessment;
    if (!finalAssessment) {
        finalAssessment = await requestAiTriage({
            name: patientName,
            age,
            symptoms: notes,
            vitals: { heartRate: hr, systolicBP: bp, spo2, consciousness: avpu }
        });
    }

    const request = {
        id: Date.now(),
        patientName,
        age,
        contact,
        category,
        facility: finalAssessment?.recommendedWard === "ICU" ? "ICU" : facility,
        location,
        notes,
        vitals: { heartRate: hr, systolicBP: bp, spo2, consciousness: avpu },
        aiAssessment: finalAssessment,
        status: "Matching",
        hospitalId: null,
        owner: currentUser?.email || "guest",
        createdAt: new Date().toLocaleString("en-IN")
    };

    data.requests.push(request);
    saveData();

    // Sync to Supabase
    if (typeof supabaseCreateEmergencyRequest === "function") {
        supabaseCreateEmergencyRequest(request);
    }

    currentAiAssessment = null;

    if (typeof toast === "function") {
        toast(`Emergency request submitted: ${finalAssessment?.severity || 'Standard'} Priority`);
    }
    if (typeof openPage === "function") openPage("matches");
});
