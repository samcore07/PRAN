/* ============================================
   HOSPITAL NAVIGATION COMPONENT CONTROLLER
============================================ */

function navigationPage() {
    const h = hospitalById(selectedNavigationHospital) || data.hospitals[0];

    return `
        ${heading("LOCATION SUPPORT", "Hospital <span>navigation.</span>", "Open the selected hospital's location in Google Maps.")}
        <div class="map-panel"><div class="map-pin">✚</div></div>
        <div class="panel">
            <h2>${safe(h.name)}</h2>
            <p class="panel-subtitle">${safe(h.area)} · Approx. ${h.distance} km (sample distance)</p>
            <label class="field">Select destination
                <select id="navigationSelect">
                    ${data.hospitals.map(x => `<option value="${x.id}" ${x.id === h.id ? "selected" : ""}>${safe(x.name)}</option>`).join("")}
                </select>
            </label>
            <button class="btn btn-primary" data-open-map="${h.id}">Open Google Maps →</button>
            <p class="muted" style="margin-top:12px">Map search only. No live ambulance tracking or ETA is provided.</p>
        </div>
    `;
}

function assignAmbulanceHospital(hospitalId) {
    const h = hospitalById(hospitalId);

    const request = [...data.requests].reverse().find(r =>
        r.status === "Matching" || r.status === "Pending"
    );

    if (!h || !request) {
        if (typeof toast === "function") toast("No active request is available.");
        return;
    }

    const result = typeof matchScore === "function" ? matchScore(h, request) : { eligible: true };

    if (!result.eligible) {
        if (typeof toast === "function") toast("This hospital does not meet the demo requirements.");
        return;
    }

    request.hospitalId = h.id;
    request.status = "Pending";

    saveData();

    // Sync to Supabase
    if (typeof supabaseUpdateRequestStatus === "function") {
        supabaseUpdateRequestStatus(request.id, "Pending", h.id);
    }

    if (typeof toast === "function") toast("Hospital selected.");
    selectedNavigationHospital = h.id;
    if (typeof openPage === "function") openPage("navigation");
}

document.addEventListener("change", event => {
    if (event.target.id === "navigationSelect") {
        selectedNavigationHospital = Number(event.target.value);
        if (typeof renderPage === "function") renderPage();
    }
});
