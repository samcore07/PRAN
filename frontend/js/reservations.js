/* ============================================
   RESERVATIONS COMPONENT CONTROLLER
============================================ */

function reservationsPage() {
    const own = data.requests.filter(r => r.owner === (currentUser?.email || "guest"));

    return `
        ${heading("ADMISSION COORDINATION", "My <span>reservations.</span>", "Follow the status of your admission requests.")}
        <div class="card-grid">
            ${own.length ? own.slice().reverse().map(r => requestCard(r)).join("") : emptyState("You have no requests yet.")}
        </div>
    `;
}

function hospitalReservations() {
    const own = data.requests.filter(r => r.hospitalId === selectedHospital);

    return `
        ${heading("HOSPITAL MANAGEMENT", "Admission <span>reservations.</span>", "Review requests associated with your selected hospital.")}
        <div class="card-grid">
            ${own.length ? own.slice().reverse().map(r => requestCard(r)).join("") : emptyState("No reservations for this hospital.")}
        </div>
    `;
}

function createPatientReservation(hospitalId) {
    const h = hospitalById(hospitalId);

    const request = [...data.requests].reverse().find(r =>
        r.owner === (currentUser?.email || "guest") &&
        r.status === "Matching"
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

    // Sync to Supabase
    if (typeof supabaseUpdateRequestStatus === "function") {
        supabaseUpdateRequestStatus(request.id, "Pending", h.id);
    }
    if (typeof supabaseCreateReservation === "function") {
        supabaseCreateReservation({
            requestId: request.id,
            hospitalId: h.id,
            patientName: request.patientName,
            bedType: request.facility,
            status: "Pending"
        });
    }

    if (typeof toast === "function") toast("Admission request sent.");
    if (typeof openPage === "function") openPage("reservations");
}

function updateRequestStatus(id, status) {
    const request = requestById(id);

    if (!request || request.status !== "Pending") {
        if (typeof toast === "function") toast("This request is no longer pending.");
        return;
    }

    if (status === "Accepted") {
        const h = hospitalById(request.hospitalId);

        if (!h) {
            if (typeof toast === "function") toast("Hospital record not found.");
            return;
        }

        const key = request.facility === "ICU" ? "icu" : "general";

        if (h[key] <= 0) {
            if (typeof toast === "function") toast("No sample bed is available.");
            return;
        }

        h[key] -= 1;
    }

    request.status = status;
    saveData();

    // Sync to Supabase
    if (typeof supabaseUpdateRequestStatus === "function") {
        supabaseUpdateRequestStatus(id, status, request.hospitalId);
    }

    if (typeof toast === "function") toast("Request " + status.toLowerCase() + ".");
    if (typeof renderPage === "function") renderPage();
}
