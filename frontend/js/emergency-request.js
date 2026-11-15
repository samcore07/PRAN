/* ============================================
   EMERGENCY REQUEST COMPONENT CONTROLLER
============================================ */

function requestPage() {
    return `
        ${heading("PATIENT INTAKE", "Create an <span>emergency request.</span>", "Enter the patient's details and required support.")}
        <div class="panel">
            <h2>Patient information</h2>
            <p class="panel-subtitle">Fields marked with * are required.</p>
            <form id="patientRequestForm">
                <div class="form-grid">
                    <label class="field">Patient full name *
                        <input id="patientName" required maxlength="70" placeholder="Patient's name">
                    </label>
                    <label class="field">Age *
                        <input id="patientAge" type="number" min="0" max="120" required placeholder="Age">
                    </label>
                    <label class="field">Contact number *
                        <input id="patientContact" type="tel" maxlength="10" required placeholder="10-digit mobile number">
                    </label>
                    <label class="field">Emergency category *
                        <select id="patientCategory" required>
                            <option value="">Select category</option>
                            <option>Accident</option>
                            <option>Cardiac</option>
                            <option>Neurological</option>
                            <option>General</option>
                        </select>
                    </label>
                    <label class="field">Required bed type *
                        <select id="patientFacility" required>
                            <option value="">Select bed type</option>
                            <option>General</option>
                            <option>ICU</option>
                        </select>
                    </label>
                    <label class="field">Current location *
                        <input id="patientLocation" required placeholder="e.g. Salt Lake, Kolkata">
                    </label>
                    <label class="field full">Additional information
                        <textarea id="patientNotes" rows="3" placeholder="Optional information"></textarea>
                    </label>
                </div>
                <p id="requestError" class="form-error"></p>
                <div class="form-actions">
                    <button class="btn btn-light" type="reset">Clear</button>
                    <button class="btn btn-primary" type="submit">Find matching hospitals →</button>
                </div>
            </form>
        </div>
    `;
}

function requestCard(r, showActions = true) {
    const h = r.hospitalId ? hospitalById(r.hospitalId) : null;

    return `
        <article class="request-card">
            <div class="card-top">
                <div>
                    <h3>${safe(r.patientName)}</h3>
                    <p>Request #${String(r.id).slice(-6)} · ${safe(r.category)} · ${safe(r.facility)} bed</p>
                    <p>Location: ${safe(r.location)}</p>
                    <p>Hospital: ${h ? safe(h.name) : "Not assigned"}</p>
                </div>
                <span class="status status-${r.status.toLowerCase()}">${safe(r.status)}</span>
            </div>
            ${showActions ? `
                <div class="card-actions">
                    ${r.status === "Pending" && currentRole === "hospital" ? `
                        <button class="btn-small btn-success" data-accept="${r.id}">Accept</button>
                        <button class="btn-small btn-danger" data-reject="${r.id}">Reject</button>
                    ` : ""}
                    ${h ? `<button class="btn-small btn-light" data-map="${h.id}">View map</button>` : ""}
                </div>
            ` : ""}
        </article>
    `;
}

function ambulanceRequests() {
    return `
        ${heading("RESPONSE COORDINATION", "Emergency <span>requests.</span>", "Review patient requests submitted through the PRAN demo.")}
        <div class="card-grid">
            ${data.requests.length ? data.requests.slice().reverse().map(r => requestCard(r, false)).join("") : emptyState("No emergency requests have been submitted yet.")}
        </div>
    `;
}

function allRequestsPage() {
    return `
        ${heading("NETWORK MONITORING", "All emergency <span>requests.</span>", "Monitor requests across the sample PRAN network.")}
        <div class="card-grid">
            ${data.requests.length ? data.requests.slice().reverse().map(r => requestCard(r, false)).join("") : emptyState("No requests in the network yet.")}
        </div>
    `;
}

document.addEventListener("submit", event => {
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

    if (!patientName || !location || !category || !facility) {
        if (error) error.textContent = "Please complete all required fields.";
        return;
    }

    const request = {
        id: Date.now(),
        patientName,
        age,
        contact,
        category,
        facility,
        location,
        notes,
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

    if (typeof toast === "function") toast("Request created successfully.");
    if (typeof openPage === "function") openPage("matches");
});
