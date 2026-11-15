/* ============================================
   BED AVAILABILITY COMPONENT CONTROLLER
============================================ */

function bedStatus(h) {
    const total = h.general + h.icu;
    if (!total) return ["Unavailable", "status-unavailable"];
    if (total <= 3) return ["Limited", "status-limited"];
    return ["Available", "status-available"];
}

function hospitalCard(h, showMatch = false, score = 0) {
    const status = bedStatus(h);

    return `
        <article class="hospital-card">
            <div class="card-top">
                <div style="display:flex;gap:10px">
                    <div class="hospital-symbol">✚</div>
                    <div>
                        <h3>${safe(h.name)}</h3>
                        <p>⌖ ${safe(h.area)}</p>
                    </div>
                </div>
                ${showMatch
                    ? `<span class="status status-matching">${score}% match</span>`
                    : `<span class="status ${status[1]}">${status[0]}</span>`
                }
            </div>

            <div class="bed-row">
                <div class="bed-stat"><small>General beds</small><strong>${h.general}</strong></div>
                <div class="bed-stat"><small>ICU beds</small><strong>${h.icu}</strong></div>
                <div class="bed-stat"><small>Medical staff</small><strong>${h.staff}</strong></div>
            </div>

            <div class="tags">
                ${h.facilities.map(f => `<span class="tag">${safe(f)}</span>`).join("")}
            </div>

            <p>Approx. ${h.distance} km · Sample distance</p>

            <div class="card-actions">
                <button class="btn-small btn-light" data-map="${h.id}">View map</button>
                ${currentRole === "patient"
                    ? `<button class="btn-small btn-success" data-book="${h.id}">Request admission</button>`
                    : ""
                }
                ${currentRole === "ambulance"
                    ? `<button class="btn-small btn-success" data-assign="${h.id}">Select hospital</button>`
                    : ""
                }
            </div>
        </article>
    `;
}

function bedsPage() {
    const t = totals();

    if (data.hospitals.length === 0 && typeof syncFromDatabase === "function") {
        syncFromDatabase();
    }

    return `
        ${heading("HOSPITAL NETWORK", "Bed <span>availability.</span>", "Review live hospital capacity, bed availability and load status.")}
        ${statsHTML([
            stat("▦", "General beds", t.general, "blue"),
            stat("✚", "ICU beds", t.icu, "red"),
            stat("♙", "Medical staff", t.staff, "green"),
            stat("⌂", "Hospitals", data.hospitals.length, "purple")
        ])}
        <div class="toolbar">
            <h2>Connected hospitals</h2>
            <input class="search-input" id="bedSearch" placeholder="Search hospital or area...">
        </div>
        <div class="card-grid" id="bedCards">
            ${data.hospitals.length > 0
                ? data.hospitals.map(h => hospitalCard(h)).join("")
                : emptyState('Connecting to database... <br><br><button class="btn btn-primary" onclick="syncFromDatabase()">Load Live Hospitals</button>')}
        </div>
    `;
}

document.addEventListener("input", event => {
    if (event.target.id === "bedSearch") {
        const query = event.target.value.toLowerCase();

        const filtered = data.hospitals.filter(h =>
            h.name.toLowerCase().includes(query) ||
            h.area.toLowerCase().includes(query)
        );

        const container = document.getElementById("bedCards");
        if (container) {
            container.innerHTML = filtered.length
                ? filtered.map(h => hospitalCard(h)).join("")
                : emptyState("No matching hospitals found.");
        }
    }
});
