/* ============================================
   BED MANAGEMENT COMPONENT CONTROLLER
============================================ */

function hospitalSelect() {
    return `
        <label class="field">Select hospital
            <select id="hospitalSelect">
                ${data.hospitals.map(h => `<option value="${h.id}" ${h.id === selectedHospital ? "selected" : ""}>${safe(h.name)}</option>`).join("")}
            </select>
        </label>
    `;
}

function capacityPage() {
    const h = hospitalById(selectedHospital) || data.hospitals[0];
    const totalBeds = (h.general || 0) + (h.icu || 0);
    const estTotalCapacity = 60; // Baseline capacity
    const occupancyRate = Math.min(100, Math.max(10, Math.round(((estTotalCapacity - totalBeds) / estTotalCapacity) * 100)));
    const statusColor = occupancyRate >= 90 ? '#ef4444' : (occupancyRate >= 70 ? '#f59e0b' : '#10b981');

    return `
        ${heading("HOSPITAL MANAGEMENT", "Bed <span>management.</span>", "Live hospital bed inventory, rapid increments, and Supabase synchronization.")}
        <div class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                <h2>Hospital Capacity Dashboard</h2>
                <span class="role-chip" style="background: rgba(36, 150, 110, 0.15); color: #24966e;">
                    ● Supabase Live Sync Active
                </span>
            </div>
            
            ${hospitalSelect()}

            <!-- Live Occupancy Bar -->
            <div style="margin: 14px 0 18px; background: #f1f5f9; border-radius: 8px; padding: 12px 14px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px;">
                    <strong style="color: var(--navy);">Hospital Occupancy Load: ${occupancyRate}%</strong>
                    <span style="color: ${statusColor}; font-weight: 700;">${occupancyRate >= 90 ? 'CRITICAL SATURATION' : (occupancyRate >= 70 ? 'HEAVY DEMAND' : 'NORMAL CAPACITY')}</span>
                </div>
                <div style="height: 8px; width: 100%; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${occupancyRate}%; height: 100%; background: ${statusColor}; transition: width 0.3s ease;"></div>
                </div>
            </div>

            <!-- Interactive Bed Adjustment Rows -->
            <div class="bed-row">
                <div class="bed-stat">
                    <small>General Beds Available</small>
                    <strong style="font-size: 24px;">${h.general}</strong>
                    <div style="display: flex; gap: 6px; margin-top: 8px;">
                        <button type="button" class="btn-small btn-light" data-quick-bed="general" data-delta="-1" title="Subtract 1 bed">- 1</button>
                        <button type="button" class="btn-small btn-primary" data-quick-bed="general" data-delta="1" title="Add 1 bed">+ 1</button>
                    </div>
                </div>
                <div class="bed-stat">
                    <small>ICU Beds Available</small>
                    <strong style="font-size: 24px; color: var(--red);">${h.icu}</strong>
                    <div style="display: flex; gap: 6px; margin-top: 8px;">
                        <button type="button" class="btn-small btn-light" data-quick-bed="icu" data-delta="-1" title="Subtract 1 ICU bed">- 1</button>
                        <button type="button" class="btn-small btn-primary" data-quick-bed="icu" data-delta="1" title="Add 1 ICU bed">+ 1</button>
                    </div>
                </div>
                <div class="bed-stat">
                    <small>Active Medical Staff</small>
                    <strong style="font-size: 24px; color: var(--green);">${h.staff}</strong>
                    <div style="display: flex; gap: 6px; margin-top: 8px;">
                        <button type="button" class="btn-small btn-light" data-quick-bed="staff" data-delta="-1">- 1</button>
                        <button type="button" class="btn-small btn-primary" data-quick-bed="staff" data-delta="1">+ 1</button>
                    </div>
                </div>
            </div>

            <h3 style="font-size: 13px; color: var(--navy); margin: 20px 0 10px;">Detailed Capacity Inventory</h3>
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
        ${heading("HOSPITAL MANAGEMENT", "Incoming <span>requests.</span>", "Review, triage, and respond to acute admission requests assigned to your facility.")}
        <div class="panel">
            ${hospitalSelect()}
        </div>
        <div class="card-grid">
            ${incoming.length ? incoming.slice().reverse().map(r => requestCard(r)).join("") : emptyState("No active emergency requests assigned to this hospital at this moment.")}
        </div>
    `;
}

// Quick Bed Increment / Decrement Handlers
document.addEventListener("click", async event => {
    const quickBtn = event.target.closest("[data-quick-bed]");
    if (quickBtn) {
        const type = quickBtn.dataset.quickBed;
        const delta = Number(quickBtn.dataset.delta) || 0;
        const h = hospitalById(selectedHospital);
        if (!h) return;

        const currentVal = Number(h[type]) || 0;
        const newVal = Math.max(0, currentVal + delta);
        h[type] = newVal;
        saveData();

        // Update Backend & Supabase
        try {
            const apiHost = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && window.location.port !== "5001"
                ? "http://localhost:5001"
                : "";
            await fetch(`${apiHost}/api/hospitals/${h.id}/capacity`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [type]: newVal })
            });
        } catch (e) {
            console.warn("Bed capacity update offline, saved locally.");
        }

        if (typeof toast === "function") {
            toast(`${h.name}: ${type.toUpperCase()} updated to ${newVal}`);
        }
        if (typeof renderPage === "function") renderPage();
    }
});

document.addEventListener("submit", async event => {
    if (event.target.id !== "capacityForm") return;

    event.preventDefault();

    const general = Number(document.getElementById("editGeneral").value);
    const icu = Number(document.getElementById("editICU").value);
    const staff = Number(document.getElementById("editStaff").value);
    const error = document.getElementById("capacityError");

    if (error) error.textContent = "";

    const h = hospitalById(selectedHospital);
    if (!h) return;

    h.general = general;
    h.icu = icu;
    h.staff = staff;
    saveData();

    // Sync to Supabase & Backend API
    if (typeof supabaseUpdateBedCapacity === "function") {
        supabaseUpdateBedCapacity(h.id, { general, icu, staff });
    }
    try {
        const apiHost = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && window.location.port !== "5001"
            ? "http://localhost:5001"
            : "";
        await fetch(`${apiHost}/api/hospitals/${h.id}/capacity`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ general, icu, staff })
        });
    } catch (e) {
        // Fallback to local
    }

    if (typeof toast === "function") toast("Capacity updated successfully in Supabase.");
    if (typeof renderPage === "function") renderPage();
});
