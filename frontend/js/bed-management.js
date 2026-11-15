/* ============================================
   BED MANAGEMENT COMPONENT CONTROLLER
============================================ */

function hospitalSelect() {
    return `
        <label class="field">Select your demo hospital
            <select id="hospitalSelect">
                ${data.hospitals.map(h => `<option value="${h.id}" ${h.id === selectedHospital ? "selected" : ""}>${safe(h.name)}</option>`).join("")}
            </select>
        </label>
    `;
}

function capacityPage() {
    const h = hospitalById(selectedHospital) || data.hospitals[0];

    return `
        ${heading("HOSPITAL MANAGEMENT", "Bed <span>management.</span>", "Update the sample availability for your selected hospital.")}
        <div class="panel">
            <h2>Hospital profile</h2>
            ${hospitalSelect()}
            <div class="bed-row">
                <div class="bed-stat"><small>General beds</small><strong>${h.general}</strong></div>
                <div class="bed-stat"><small>ICU beds</small><strong>${h.icu}</strong></div>
                <div class="bed-stat"><small>Medical staff</small><strong>${h.staff}</strong></div>
            </div>
            <form id="capacityForm">
                <div class="form-grid">
                    <label class="field">General beds
                        <input type="number" id="editGeneral" min="0" max="500" value="${h.general}" required>
                    </label>
                    <label class="field">ICU beds
                        <input type="number" id="editICU" min="0" max="200" value="${h.icu}" required>
                    </label>
                    <label class="field">Medical staff
                        <input type="number" id="editStaff" min="0" max="500" value="${h.staff}" required>
                    </label>
                </div>
                <p id="capacityError" class="form-error"></p>
                <div class="form-actions">
                    <button class="btn btn-primary" type="submit">Save capacity</button>
                </div>
            </form>
        </div>
    `;
}

function hospitalRequests() {
    const incoming = data.requests.filter(r => r.hospitalId === selectedHospital);

    return `
        ${heading("HOSPITAL MANAGEMENT", "Incoming <span>requests.</span>", "Review and respond to admission requests assigned to your hospital.")}
        <div class="panel">
            ${hospitalSelect()}
        </div>
        <div class="card-grid">
            ${incoming.length ? incoming.slice().reverse().map(r => requestCard(r)).join("") : emptyState("No requests have been assigned to this hospital yet.")}
        </div>
    `;
}

document.addEventListener("change", event => {
    if (event.target.id === "hospitalSelect") {
        selectedHospital = Number(event.target.value);
        if (typeof renderPage === "function") renderPage();
    }
});

document.addEventListener("submit", event => {
    if (event.target.id !== "capacityForm") return;

    event.preventDefault();

    const h = hospitalById(selectedHospital);
    if (!h) return;

    const general = Number(document.getElementById("editGeneral").value);
    const icu = Number(document.getElementById("editICU").value);
    const staff = Number(document.getElementById("editStaff").value);
    const err = document.getElementById("capacityError");

    if (
        !Number.isInteger(general) || general < 0 || general > 500 ||
        !Number.isInteger(icu) || icu < 0 || icu > 200 ||
        !Number.isInteger(staff) || staff < 0 || staff > 500
    ) {
        if (err) err.textContent = "Please enter valid non-negative whole numbers.";
        return;
    }

    h.general = general;
    h.icu = icu;
    h.staff = staff;

    saveData();

    // Sync to Supabase
    if (typeof supabaseUpdateCapacity === "function") {
        supabaseUpdateCapacity(selectedHospital, { general, icu, staff });
    }

    if (typeof toast === "function") toast("Hospital capacity updated.");
    if (typeof renderPage === "function") renderPage();
});
