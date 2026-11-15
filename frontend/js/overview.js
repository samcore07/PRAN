/* ============================================
   OVERVIEW & DASHBOARD COMPONENT CONTROLLER
============================================ */

function heading(kicker, title, description) {
    return `
        <div class="page-heading">
            <span class="eyebrow">${kicker}</span>
            <h1>${title}</h1>
            <p>${description}</p>
        </div>
    `;
}

function stat(icon, label, value, color = "blue") {
    return `
        <div class="stat-card">
            <div class="stat-icon ${color}">${icon}</div>
            <small>${label}</small>
            <strong>${value}</strong>
        </div>
    `;
}

function statsHTML(items) {
    return `<div class="stats-grid">${items.join("")}</div>`;
}

function quickCard(icon, title, description, page) {
    return `
        <button class="quick-card" data-go="${page}">
            <span class="quick-icon">${icon}</span>
            <strong>${title}</strong>
            <small>${description}</small>
        </button>
    `;
}

function patientHome() {
    const own = data.requests.filter(r => r.owner === (currentUser?.email || "guest"));
    const t = totals();

    return `
        ${heading("PATIENT WORKSPACE", "Your care journey, <span>connected.</span>", "Explore hospitals, submit an emergency request and follow its demo status.")}
        <div class="hero-panel">
            <div>
                <span class="hero-kicker">PRAN PATIENT PORTAL</span>
                <h2>Find the right care.<br>With better coordination.</h2>
                <p>Submit your requirements and explore sample hospitals with suitable facilities and bed availability.</p>
                <button class="btn" data-go="request">Create emergency request →</button>
            </div>
            <div class="hero-mark">✚</div>
        </div>
        <div class="section-heading"><h2>Your overview</h2><span class="muted">Demo information</span></div>
        ${statsHTML([
            stat("▦", "Available general beds", t.general, "blue"),
            stat("✚", "Available ICU beds", t.icu, "red"),
            stat("▤", "Your requests", own.length, "purple"),
            stat("⌂", "Connected hospitals", data.hospitals.length, "green")
        ])}
        <div class="section-heading"><h2>Quick actions</h2></div>
        <div class="quick-grid">
            ${quickCard("＋", "Emergency request", "Submit patient information", "request")}
            ${quickCard("▦", "Bed availability", "Explore connected hospitals", "beds")}
            ${quickCard("▤", "My reservations", "Track your request status", "reservations")}
        </div>
        <div class="notice">Demo prototype only. This platform does not contact emergency services or provide real-time medical availability. In India, call 112 for a real emergency.</div>
    `;
}

function ambulanceHome() {
    const pending = data.requests.filter(r => r.status === "Matching" || r.status === "Pending").length;
    const t = totals();

    return `
        ${heading("AMBULANCE OPERATOR", "Welcome to your <span>response centre.</span>", "Review emergency requests and explore suitable sample hospital destinations.")}
        <div class="hero-panel">
            <div>
                <span class="hero-kicker">AMBULANCE COORDINATION</span>
                <h2>Coordinate the next step.</h2>
                <p>Review submitted emergency requests and explore hospital availability.</p>
                <button class="btn" data-go="requests">View emergency requests →</button>
            </div>
            <div class="hero-mark">＋</div>
        </div>
        ${statsHTML([
            stat("＋", "Active requests", pending, "red"),
            stat("⌂", "Connected hospitals", data.hospitals.length, "blue"),
            stat("▦", "General beds", t.general, "green"),
            stat("✚", "ICU beds", t.icu, "purple")
        ])}
        <div class="section-heading"><h2>Operator tools</h2></div>
        <div class="quick-grid">
            ${quickCard("＋", "Emergency requests", "Review submitted requests", "requests")}
            ${quickCard("⌕", "Hospital matching", "Compare suitable destinations", "matches")}
            ${quickCard("➤", "Navigation", "Open hospital map links", "navigation")}
        </div>
        <div class="notice">This demo does not dispatch ambulances, track GPS locations or provide real-time routing.</div>
    `;
}

function hospitalHome() {
    const h = hospitalById(selectedHospital) || data.hospitals[0];
    const incoming = data.requests.filter(r => r.hospitalId === h.id);
    const pending = incoming.filter(r => r.status === "Pending").length;

    return `
        ${heading("HOSPITAL WORKSPACE", "Your hospital, <span>your dashboard.</span>", "Manage your selected hospital's sample capacity and review admission requests.")}
        <div class="hero-panel">
            <div>
                <span class="hero-kicker">HOSPITAL CONTROL CENTRE</span>
                <h2>${safe(h.name)}</h2>
                <p>${safe(h.area)}</p>
                <button class="btn" data-go="capacity">Manage bed availability →</button>
            </div>
            <div class="hero-mark">⌂</div>
        </div>
        ${statsHTML([
            stat("▦", "General beds", h.general, "blue"),
            stat("✚", "ICU beds", h.icu, "red"),
            stat("♙", "Medical staff", h.staff, "green"),
            stat("▤", "Pending requests", pending, "purple")
        ])}
        <div class="section-heading"><h2>Hospital tools</h2></div>
        <div class="quick-grid">
            ${quickCard("▦", "Manage capacity", "Update bed availability", "capacity")}
            ${quickCard("▤", "Incoming requests", "Review admission requests", "requests")}
            ${quickCard("✓", "Reservations", "Track admission decisions", "reservations")}
        </div>
    `;
}

function adminHome() {
    const t = totals();
    const pending = data.requests.filter(r => r.status === "Pending" || r.status === "Matching").length;
    const accepted = data.requests.filter(r => r.status === "Accepted").length;

    return `
        ${heading("SYSTEM ADMINISTRATION", "Network <span>overview.</span>", "Monitor the sample hospital network and platform requests.")}
        <div class="hero-panel">
            <div>
                <span class="hero-kicker">PRAN NETWORK ADMINISTRATION</span>
                <h2>One connected network.</h2>
                <p>Review hospital capacity and monitor emergency coordination activity.</p>
                <button class="btn" data-go="beds">View hospital network →</button>
            </div>
            <div class="hero-mark">▣</div>
        </div>
        ${statsHTML([
            stat("⌂", "Connected hospitals", data.hospitals.length, "blue"),
            stat("▦", "General beds", t.general, "green"),
            stat("✚", "ICU beds", t.icu, "red"),
            stat("▤", "Active requests", pending, "purple")
        ])}
        <div class="section-heading"><h2>Request overview</h2></div>
        <div class="panel">
            <div class="bed-row">
                <div class="bed-stat"><small>Total requests</small><strong>${data.requests.length}</strong></div>
                <div class="bed-stat"><small>Accepted</small><strong>${accepted}</strong></div>
                <div class="bed-stat"><small>Pending / matching</small><strong>${pending}</strong></div>
            </div>
            <div class="card-actions">
                <button class="btn btn-primary" data-go="requests">View all requests</button>
                <button class="btn btn-light" data-go="reservations">View reservations</button>
            </div>
        </div>
    `;
}
