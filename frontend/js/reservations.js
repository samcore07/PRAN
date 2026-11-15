/* ============================================
   RESERVATIONS & ADMISSION COORDINATION CONTROLLER
============================================ */

function renderCareTimeline(status) {
    const steps = [
        { label: "Intake Submitted", done: true },
        { label: "AI Clinical Triage", done: true },
        { label: "Hospital Routing", done: status === "Pending" || status === "Accepted" },
        { label: "ER Admission Confirmed", done: status === "Accepted" }
    ];

    return `
        <div style="margin: 14px 0 10px; background: #f8fafc; border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px;">
            <small style="font-size: 9px; font-weight: 800; color: var(--muted); letter-spacing: 0.8px; display: block; margin-bottom: 8px;">EMERGENCY CARE LIFECYCLE</small>
            <div style="display: flex; justify-content: space-between; position: relative;">
                ${steps.map((st, i) => `
                    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; flex: 1;">
                        <div style="width: 22px; height: 22px; border-radius: 50%; background: ${st.done ? '#24966e' : '#cbd5e1'}; color: white; display: grid; place-items: center; font-size: 11px; font-weight: 800; margin-bottom: 4px;">
                            ${st.done ? '✓' : (i + 1)}
                        </div>
                        <span style="font-size: 9px; font-weight: ${st.done ? '700' : '500'}; color: ${st.done ? 'var(--navy)' : 'var(--muted)'};">${st.label}</span>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

function reservationsPage() {
    const own = data.requests.filter(r => r.owner === (currentUser?.email || "guest"));

    return `
        ${heading("ADMISSION COORDINATION", "My <span>reservations.</span>", "Live status tracker for emergency hospital admissions and ambulance dispatches.")}
        
        ${own.length ? `
            <div class="panel" style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <h3 style="margin: 0; color: var(--navy);">Active Patient Intake: ${safe(own[own.length - 1].patientName)}</h3>
                    <button class="btn-small btn-primary" data-print-token="${own[own.length - 1].id}">📄 View Admission Pass</button>
                </div>
                ${renderCareTimeline(own[own.length - 1].status)}
            </div>
        ` : ""}

        <div class="card-grid">
            ${own.length ? own.slice().reverse().map(r => requestCard(r)).join("") : emptyState("You have no active emergency reservations yet. Create a request to match with available hospitals.")}
        </div>
    `;
}

function hospitalReservations() {
    const own = data.requests.filter(r => r.hospitalId === selectedHospital);

    return `
        ${heading("HOSPITAL MANAGEMENT", "Admission <span>reservations.</span>", "Confirmed admissions and ambulance intake for your facility.")}
        <div class="card-grid">
            ${own.length ? own.slice().reverse().map(r => requestCard(r)).join("") : emptyState("No hospital reservations have been confirmed for this facility.")}
        </div>
    `;
}

function createPatientReservation(hospitalId) {
    const h = hospitalById(hospitalId);

    const request = [...data.requests].reverse().find(r =>
        r.owner === (currentUser?.email || "guest") &&
        (r.status === "Matching" || r.status === "Pending")
    );

    if (!request || !h) {
        if (typeof toast === "function") toast("Create a new emergency request first.");
        return;
    }

    const result = typeof matchScore === "function" ? matchScore(h, request) : { eligible: true };

    if (!result.eligible) {
        if (typeof toast === "function") toast("This hospital does not have adequate capacity.");
        return;
    }

    request.hospitalId = h.id;
    request.status = "Pending";

    saveData();

    // Supabase synchronization
    if (typeof supabaseCreateReservation === "function") {
        supabaseCreateReservation({
            requestId: request.id,
            hospitalId: h.id,
            patientName: request.patientName,
            facility: request.facility,
            status: "Pending"
        });
    }

    if (typeof toast === "function") toast(`Admission requested at ${h.name}. Emergency team notified.`);
    if (typeof openPage === "function") openPage("reservations");
}

function assignAmbulanceHospital(hospitalId) {
    const h = hospitalById(hospitalId);
    const request = [...data.requests].reverse().find(r => r.status === "Matching" || r.status === "Pending");

    if (!request || !h) {
        if (typeof toast === "function") toast("Select an emergency request to assign.");
        return;
    }

    request.hospitalId = h.id;
    request.status = "Pending";

    saveData();

    // Update in Supabase
    if (typeof supabaseUpdateEmergencyRequestStatus === "function") {
        supabaseUpdateEmergencyRequestStatus(request.id, "Pending");
    }

    if (typeof toast === "function") toast(`Ambulance route locked to ${h.name}. Ready for navigation.`);
    selectedNavigationHospital = h.id;
    if (typeof openPage === "function") openPage("navigation");
}

function updateRequestStatus(id, newStatus) {
    const request = data.requests.find(r => r.id === id);
    if (!request) return;

    request.status = newStatus;

    // Deduct bed if accepted
    if (newStatus === "Accepted" && request.hospitalId) {
        const h = hospitalById(request.hospitalId);
        if (h) {
            const wardType = String(request.facility).toLowerCase() === "icu" ? "icu" : "general";
            if (h[wardType] > 0) {
                h[wardType] -= 1;
                if (typeof supabaseUpdateBedCapacity === "function") {
                    supabaseUpdateBedCapacity(h.id, { [wardType]: h[wardType] });
                }
            }
        }
    }

    saveData();

    // Sync to Supabase
    if (typeof supabaseUpdateEmergencyRequestStatus === "function") {
        supabaseUpdateEmergencyRequestStatus(id, newStatus);
    }

    if (typeof toast === "function") toast(`Request status updated: ${newStatus}`);
    if (typeof renderPage === "function") renderPage();
}

// Print / View Admission Pass Modal
document.addEventListener("click", event => {
    const printBtn = event.target.closest("[data-print-token]");
    if (printBtn) {
        const reqId = Number(printBtn.dataset.printToken);
        const req = data.requests.find(r => r.id === reqId);
        if (!req) return;
        const h = req.hospitalId ? hospitalById(req.hospitalId) : null;

        const passHTML = `
            <div id="passModalWrapper" style="position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 2000; display: grid; place-items: center; padding: 16px; backdrop-filter: blur(4px);">
                <div style="background: var(--white); border: 2px solid var(--blue); border-radius: 16px; max-width: 500px; width: 100%; padding: 28px; box-shadow: var(--shadow);">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px dashed var(--border); padding-bottom: 14px; margin-bottom: 16px;">
                        <div>
                            <span style="font-size: 10px; font-weight: 800; color: var(--teal); letter-spacing: 1px;">PRAN EMERGENCY HEALTH NETWORK</span>
                            <h2 style="color: var(--navy); margin: 4px 0 0; font-size: 20px;">Emergency Admission Pass</h2>
                        </div>
                        <button id="closePassModal" style="border: 0; background: transparent; font-size: 20px; cursor: pointer; color: var(--muted);">✕</button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; margin-bottom: 16px;">
                        <div><small style="color: var(--muted);">Patient Name:</small><br><strong>${safe(req.patientName)}</strong></div>
                        <div><small style="color: var(--muted);">Intake Token:</small><br><strong style="color: var(--blue);">#PRAN-${String(req.id).slice(-6)}</strong></div>
                        <div><small style="color: var(--muted);">Emergency Category:</small><br><strong>${safe(req.category)}</strong></div>
                        <div><small style="color: var(--muted);">Allocated Ward:</small><br><strong style="color: var(--red);">${safe(req.facility)} Bed</strong></div>
                        <div><small style="color: var(--muted);">Destination Hospital:</small><br><strong>${h ? safe(h.name) : "Matching..."}</strong></div>
                        <div><small style="color: var(--muted);">Status:</small><br><span class="status status-${req.status.toLowerCase()}">${safe(req.status)}</span></div>
                    </div>

                    <div style="background: #f1f5f9; padding: 10px; border-radius: 8px; font-size: 10px; color: var(--text); line-height: 1.5; margin-bottom: 18px;">
                        <strong>Hospital Address:</strong> ${h ? safe(h.area + ", Kolkata") : "Dispatched to nearest network tertiary unit"}<br>
                        <strong>Instructions:</strong> Present this pass at Emergency Reception / Triage Desk. The triage team has received patient vitals.
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="btn btn-light" id="closePassModal2">Close</button>
                        <button class="btn btn-primary" onclick="window.print()">🖨️ Print Pass</button>
                    </div>
                </div>
            </div>
        `;

        const div = document.createElement("div");
        div.innerHTML = passHTML;
        document.body.appendChild(div);

        const close = () => div.remove();
        div.querySelector("#closePassModal")?.addEventListener("click", close);
        div.querySelector("#closePassModal2")?.addEventListener("click", close);
    }
});
