
/* ============================================
   PRAN - ROLE BASED EMERGENCY COORDINATION
   Frontend demo - HTML, CSS and JavaScript
============================================ */

const STORAGE = "PRAN_ROLE_DEMO_V1";

// ============================================
// SUPABASE DATABASE INTEGRATION
// ============================================
const SUPABASE_CONFIG = {
    url: (window.PRAN_ENV && window.PRAN_ENV.SUPABASE_URL) || "https://your-project-id.supabase.co",
    anonKey: (window.PRAN_ENV && window.PRAN_ENV.SUPABASE_ANON_KEY) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here"
};

let supabaseClient = null;

function isSupabaseAvailable() {
    return Boolean(
        window.supabase &&
        SUPABASE_CONFIG.url &&
        SUPABASE_CONFIG.anonKey &&
        !SUPABASE_CONFIG.url.includes("your-project-id") &&
        !SUPABASE_CONFIG.anonKey.includes("your-anon-key")
    );
}

function initSupabase() {
    if (isSupabaseAvailable()) {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            console.log("✓ Connected to Supabase at:", SUPABASE_CONFIG.url);
            supabaseSync();
        } catch (e) {
            console.warn("Supabase initialization error:", e);
        }
    } else {
        console.log("ℹ Running in local demo mode. Configure .env and frontend config to connect to Supabase.");
    }
}

async function supabaseSync() {
    if (!supabaseClient) return;
    try {
        const { data: hosp } = await supabaseClient.from("hospitals").select("*").order("id");
        if (hosp && hosp.length > 0) {
            data.hospitals = hosp.map(h => ({
                id: Number(h.id),
                name: h.name,
                area: h.area,
                distance: Number(h.distance),
                general: Number(h.general),
                icu: Number(h.icu),
                staff: Number(h.staff),
                categories: Array.isArray(h.categories) ? h.categories : [],
                facilities: Array.isArray(h.facilities) ? h.facilities : []
            }));
            saveData();
            renderPage();
        }

        const { data: reqs } = await supabaseClient.from("emergency_requests").select("*").order("created_at", { ascending: false });
        if (reqs) {
            data.requests = reqs.map(r => ({
                id: Number(r.id),
                patientName: r.patient_name,
                age: Number(r.age),
                contact: r.contact,
                category: r.category,
                facility: r.facility,
                location: r.location,
                notes: r.notes || "",
                status: r.status,
                hospitalId: r.hospital_id ? Number(r.hospital_id) : null,
                owner: r.owner || "guest",
                createdAt: r.created_at
            }));
            saveData();
            renderPage();
        }
    } catch (e) {
        console.warn("Supabase sync warning:", e);
    }
}

async function supabaseUpdateBeds(hospitalId, { general, icu, staff }) {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from("hospitals").update({ general, icu, staff }).eq("id", hospitalId);
    } catch (e) {
        console.warn("Supabase update beds error:", e);
    }
}

async function supabaseCreateRequest(req) {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from("emergency_requests").insert([{
            id: req.id,
            patient_name: req.patientName,
            age: req.age,
            contact: req.contact,
            category: req.category,
            facility: req.facility,
            location: req.location,
            notes: req.notes || "",
            status: req.status || "Matching",
            hospital_id: req.hospitalId || null,
            owner: req.owner || "guest"
        }]);
    } catch (e) {
        console.warn("Supabase create request error:", e);
    }
}

async function supabaseUpdateRequest(requestId, status, hospitalId = null) {
    if (!supabaseClient) return;
    try {
        const payload = { status };
        if (hospitalId) payload.hospital_id = hospitalId;
        await supabaseClient.from("emergency_requests").update(payload).eq("id", requestId);
    } catch (e) {
        console.warn("Supabase update request error:", e);
    }
}

async function supabaseAddReservation(reservation) {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from("reservations").insert([{
            request_id: reservation.requestId,
            hospital_id: reservation.hospitalId,
            patient_name: reservation.patientName,
            bed_type: reservation.bedType,
            status: reservation.status || "Pending"
        }]);
    } catch (e) {
        console.warn("Supabase reservation error:", e);
    }
}

const hospitalsDefault = [
    {id:1,name:"Aster Care Medical Centre",area:"Salt Lake Sector V, Kolkata",distance:3.2,general:12,icu:4,staff:8,categories:["Accident","Cardiac","Neurological","General"],facilities:["Emergency","ICU","Trauma Care","Cardiac Care"]},
    {id:2,name:"Northview Multispeciality Hospital",area:"New Town, Kolkata",distance:5.6,general:8,icu:2,staff:6,categories:["Accident","Cardiac","General"],facilities:["Emergency","ICU","Trauma Care"]},
    {id:3,name:"Lakeside Emergency Centre",area:"Bidhannagar, Kolkata",distance:6.8,general:5,icu:3,staff:5,categories:["Cardiac","Neurological","General"],facilities:["Emergency","ICU","Cardiac Care","Neuro Care"]},
    {id:4,name:"Greenline General Hospital",area:"Kestopur, Kolkata",distance:8.1,general:18,icu:0,staff:4,categories:["Accident","General"],facilities:["Emergency","Trauma Care"]},
    {id:5,name:"City Heart & Neuro Institute",area:"EM Bypass, Kolkata",distance:10.4,general:6,icu:5,staff:9,categories:["Cardiac","Neurological","General"],facilities:["Emergency","ICU","Cardiac Care","Neuro Care"]},
    {id:6,name:"Riverbend Community Hospital",area:"Dum Dum, Kolkata",distance:11.7,general:10,icu:1,staff:3,categories:["Accident","General"],facilities:["Emergency","Trauma Care"]}
];

const roleNames = {
    patient:"Patient / Attendant",
    ambulance:"Ambulance Operator",
    hospital:"Hospital",
    admin:"System Administrator"
};

const roleMenus = {
    patient:[
        ["overview","⌂","Overview"],
        ["request","＋","Emergency Request"],
        ["beds","▦","Bed Availability"],
        ["matches","⌕","Hospital Matching"],
        ["reservations","▤","My Reservations"],
        ["navigation","➤","Navigation"]
    ],
    ambulance:[
        ["overview","⌂","Overview"],
        ["requests","＋","Emergency Requests"],
        ["beds","▦","Bed Availability"],
        ["matches","⌕","Hospital Matching"],
        ["navigation","➤","Navigation"]
    ],
    hospital:[
        ["overview","⌂","Overview"],
        ["capacity","▦","Bed Management"],
        ["requests","▤","Incoming Requests"],
        ["reservations","✓","Reservations"]
    ],
    admin:[
        ["overview","⌂","Network Overview"],
        ["beds","▦","Hospital Network"],
        ["requests","▤","All Requests"],
        ["reservations","✓","Reservations"]
    ]
};

let data = loadData();
let currentUser = null;
let currentRole = null;
let currentPage = "overview";
let selectedHospital = 1;
let selectedNavigationHospital = 1;

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.hospitals) && Array.isArray(parsed.requests)) {
                return parsed;
            }
        }
    } catch (error) {
        console.warn("PRAN data could not be loaded.", error);
    }

    return {
        hospitals: hospitalsDefault.map(h => ({
            ...h,
            categories:[...h.categories],
            facilities:[...h.facilities]
        })),
        requests:[]
    };
}

function saveData() {
    localStorage.setItem(STORAGE, JSON.stringify(data));
}

function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#039;"
    })[c]);
}

function hospitalById(id) {
    return data.hospitals.find(h => h.id === Number(id));
}

function requestById(id) {
    return data.requests.find(r => r.id === Number(id));
}

function totals() {
    return data.hospitals.reduce((t,h) => {
        t.general += h.general;
        t.icu += h.icu;
        t.staff += h.staff;
        return t;
    },{general:0,icu:0,staff:0});
}

function toast(message) {
    const box = document.getElementById("toast");
    box.textContent = message;
    box.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => box.classList.remove("show"),2600);
}

function showScreen(id) {
    ["loginScreen","roleScreen","appScreen"].forEach(screen => {
        document.getElementById(screen).classList.add("hidden");
    });
    document.getElementById(id).classList.remove("hidden");
}

/* ============================================
   LOGIN AND GUEST ACCESS
============================================ */

document.getElementById("loginForm").addEventListener("submit",event => {
    event.preventDefault();

    const email = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passwordInput").value;
    const error = document.getElementById("loginError");

    error.textContent = "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        error.textContent = "Please enter a valid email address.";
        return;
    }

    if (password.length < 4) {
        error.textContent = "Please enter at least 4 characters for the demo password.";
        return;
    }

    currentUser = {
        name: email.split("@")[0],
        email,
        guest:false
    };

    showScreen("roleScreen");
});

document.getElementById("guestLogin").addEventListener("click",() => {
    currentUser = {
        name:"Guest User",
        email:"",
        guest:true
    };

    showScreen("roleScreen");
});

document.getElementById("logoutFromRole").addEventListener("click",() => {
    currentUser = null;
    showScreen("loginScreen");
});

/* ============================================
   ROLE SELECTION
============================================ */

document.querySelectorAll("[data-role]").forEach(button => {
    button.addEventListener("click",() => {
        currentRole = button.dataset.role;
        selectedHospital = 1;

        if (!currentUser) {
            showScreen("loginScreen");
            return;
        }

        startWorkspace();
    });
});

function startWorkspace() {
    showScreen("appScreen");

    const displayName = currentUser.name;

    document.getElementById("sidebarUser").textContent = displayName;
    document.getElementById("sidebarRole").textContent = roleNames[currentRole];
    document.getElementById("userAvatar").textContent = displayName.charAt(0).toUpperCase();
    document.getElementById("topUser").textContent = displayName.charAt(0).toUpperCase();

    buildNavigation();
    openPage("overview");
}

function buildNavigation() {
    const nav = document.getElementById("sidebarNav");

    nav.innerHTML = roleMenus[currentRole].map(item => `
        <button class="nav-link" data-page="${item[0]}">
            <span class="nav-icon">${item[1]}</span>
            ${item[2]}
        </button>
    `).join("");
}

/* ============================================
   ROLE-BASED PAGE ROUTING
============================================ */

function openPage(page) {
    const allowed = roleMenus[currentRole].some(item => item[0] === page);

    if (!allowed) return;

    currentPage = page;

    const item = roleMenus[currentRole].find(i => i[0] === page);
    document.getElementById("pageTitle").textContent = item ? item[2] : "Overview";

    document.querySelectorAll("#sidebarNav .nav-link").forEach(button => {
        button.classList.toggle("active",button.dataset.page === page);
    });

    document.getElementById("sidebar").classList.remove("open");

    renderPage();
}

document.getElementById("sidebarNav").addEventListener("click",event => {
    const button = event.target.closest("[data-page]");
    if (button) openPage(button.dataset.page);
});

document.getElementById("menuToggle").addEventListener("click",() => {
    document.getElementById("sidebar").classList.toggle("open");
});

document.getElementById("switchRole").addEventListener("click",() => {
    buildNavigation();
    showScreen("roleScreen");
});

document.getElementById("logoutButton").addEventListener("click",() => {
    currentUser = null;
    currentRole = null;
    document.getElementById("loginForm").reset();
    showScreen("loginScreen");
});

/* ============================================
   COMMON UI HELPERS
============================================ */

function heading(kicker,title,description) {
    return `
        <div class="page-heading">
            <span class="eyebrow">${kicker}</span>
            <h1>${title}</h1>
            <p>${description}</p>
        </div>
    `;
}

function stat(icon,label,value,color="blue") {
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

function quickCard(icon,title,description,page) {
    return `
        <button class="quick-card" data-go="${page}">
            <span class="quick-icon">${icon}</span>
            <strong>${title}</strong>
            <small>${description}</small>
        </button>
    `;
}

function emptyState(message) {
    return `<div class="empty-state">${message}</div>`;
}

function bedStatus(h) {
    const total = h.general + h.icu;
    if (!total) return ["Unavailable","status-unavailable"];
    if (total <= 3) return ["Limited","status-limited"];
    return ["Available","status-available"];
}

function hospitalCard(h,showMatch=false,score=0) {
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
                ${h.facilities.map(f=>`<span class="tag">${safe(f)}</span>`).join("")}
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

function requestCard(r,showActions=true) {
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

/* ============================================
   PAGE RENDERER
============================================ */

function renderPage() {
    const root = document.getElementById("pageContent");

    if (currentRole === "patient") {
        if (currentPage === "overview") root.innerHTML = patientHome();
        if (currentPage === "request") root.innerHTML = requestPage();
        if (currentPage === "beds") root.innerHTML = bedsPage();
        if (currentPage === "matches") root.innerHTML = matchesPage();
        if (currentPage === "reservations") root.innerHTML = reservationsPage();
        if (currentPage === "navigation") root.innerHTML = navigationPage();
    }

    if (currentRole === "ambulance") {
        if (currentPage === "overview") root.innerHTML = ambulanceHome();
        if (currentPage === "requests") root.innerHTML = ambulanceRequests();
        if (currentPage === "beds") root.innerHTML = bedsPage();
        if (currentPage === "matches") root.innerHTML = matchesPage();
        if (currentPage === "navigation") root.innerHTML = navigationPage();
    }

    if (currentRole === "hospital") {
        if (currentPage === "overview") root.innerHTML = hospitalHome();
        if (currentPage === "capacity") root.innerHTML = capacityPage();
        if (currentPage === "requests") root.innerHTML = hospitalRequests();
        if (currentPage === "reservations") root.innerHTML = hospitalReservations();
    }

    if (currentRole === "admin") {
        if (currentPage === "overview") root.innerHTML = adminHome();
        if (currentPage === "beds") root.innerHTML = bedsPage();
        if (currentPage === "requests") root.innerHTML = allRequestsPage();
        if (currentPage === "reservations") root.innerHTML = allReservationsPage();
    }
}

/* ============================================
   PATIENT DASHBOARD
============================================ */

function patientHome() {
    const own = data.requests.filter(r => r.owner === currentUser.email || r.owner === "guest");
    const t = totals();

    return `
        ${heading("PATIENT WORKSPACE","Your care journey, <span>connected.</span>","Explore hospitals, submit an emergency request and follow its demo status.")}
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
            stat("▦","Available general beds",t.general,"blue"),
            stat("✚","Available ICU beds",t.icu,"red"),
            stat("▤","Your requests",own.length,"purple"),
            stat("⌂","Connected hospitals",data.hospitals.length,"green")
        ])}
        <div class="section-heading"><h2>Quick actions</h2></div>
        <div class="quick-grid">
            ${quickCard("＋","Emergency request","Submit patient information","request")}
            ${quickCard("▦","Bed availability","Explore connected hospitals","beds")}
            ${quickCard("▤","My reservations","Track your request status","reservations")}
        </div>
        <div class="notice">Demo prototype only. This platform does not contact emergency services or provide real-time medical availability. In India, call 112 for a real emergency.</div>
    `;
}

/* ============================================
   EMERGENCY REQUEST FORM
============================================ */

function requestPage() {
    return `
        ${heading("PATIENT INTAKE","Create an <span>emergency request.</span>","Enter the patient's details and required support.")}
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

document.addEventListener("submit",event => {
    if (event.target.id !== "patientRequestForm") return;

    event.preventDefault();

    const age = Number(document.getElementById("patientAge").value);
    const contact = document.getElementById("patientContact").value.trim();
    const error = document.getElementById("requestError");

    error.textContent = "";

    if (!Number.isInteger(age) || age < 0 || age > 120) {
        error.textContent = "Please enter a valid age.";
        return;
    }

    if (!/^[6-9]\d{9}$/.test(contact)) {
        error.textContent = "Enter a valid 10-digit Indian mobile number.";
        return;
    }

    const request = {
        id:Date.now(),
        patientName:document.getElementById("patientName").value.trim(),
        age,
        contact,
        category:document.getElementById("patientCategory").value,
        facility:document.getElementById("patientFacility").value,
        location:document.getElementById("patientLocation").value.trim(),
        notes:document.getElementById("patientNotes").value.trim(),
        status:"Matching",
        hospitalId:null,
        owner:currentUser.email || "guest",
        createdAt:new Date().toLocaleString("en-IN")
    };

    if (!request.patientName || !request.location || !request.category || !request.facility) {
        error.textContent = "Please complete all required fields.";
        return;
    }

    data.requests.push(request);
    saveData();
    supabaseCreateRequest(request);
    toast("Request created successfully.");
    openPage("matches");
});

/* ============================================
   MATCHING
============================================ */

function matchScore(h,r) {
    const bed = r.facility === "ICU" ? h.icu : h.general;
    let score = 0;

    if (h.categories.includes(r.category)) score += 25;
    if (h.facilities.includes("Emergency")) score += 20;
    if (bed > 0) score += 30;
    if (h.staff > 0) score += 15;

    score += Math.max(0,10-h.distance/2);

    return {
        score:Math.round(score),
        eligible:bed > 0 && h.categories.includes(r.category) && h.facilities.includes("Emergency") && h.staff > 0
    };
}

function matchesPage() {
    const request = [...data.requests].reverse().find(r =>
        r.owner === (currentUser.email || "guest")
    );

    if (!request) {
        return `
            ${heading("SMART MATCHING","Hospital <span>matching.</span>","Explore suitable sample hospitals based on emergency requirements.")}
            ${emptyState('Create an emergency request first. <br><br><button class="btn btn-primary" data-go="request">Create request</button>')}
        `;
    }

    const results = data.hospitals.map(h => ({
        hospital:h,
        ...matchScore(h,request)
    })).filter(x=>x.eligible).sort((a,b)=>b.score-a.score);

    return `
        ${heading("SMART MATCHING","Your hospital <span>matches.</span>","Compare the sample hospitals that meet the selected requirements.")}
        <div class="summary-box">
            <small>YOUR REQUEST</small>
            <strong>${safe(request.patientName)} · ${safe(request.category)} · ${safe(request.facility)} bed</strong>
            <p>${safe(request.location)}</p>
        </div>
        <p class="muted" style="margin-bottom:13px">Illustrative ranking only. It is not a clinically validated recommendation.</p>
        <div class="card-grid">
            ${results.length ? results.map(x=>hospitalCard(x.hospital,true,x.score)).join("") : emptyState("No matching sample hospital found. Check the bed availability page.")}
        </div>
    `;
}

/* ============================================
   BED AVAILABILITY
============================================ */

function bedsPage() {
    const t = totals();

    return `
        ${heading("HOSPITAL NETWORK","Bed <span>availability.</span>","Review sample hospital capacity and available facilities.")}
        ${statsHTML([
            stat("▦","General beds",t.general,"blue"),
            stat("✚","ICU beds",t.icu,"red"),
            stat("♙","Medical staff",t.staff,"green"),
            stat("⌂","Hospitals",data.hospitals.length,"purple")
        ])}
        <div class="toolbar">
            <h2>Connected hospitals</h2>
            <input class="search-input" id="bedSearch" placeholder="Search hospital or area...">
        </div>
        <div class="card-grid" id="bedCards">
            ${data.hospitals.map(h=>hospitalCard(h)).join("")}
        </div>
    `;
}

/* ============================================
   RESERVATIONS
============================================ */

function reservationsPage() {
    const own = data.requests.filter(r => r.owner === (currentUser.email || "guest"));

    return `
        ${heading("ADMISSION COORDINATION","My <span>reservations.</span>","Follow the status of your demo admission requests.")}
        <div class="card-grid">
            ${own.length ? own.slice().reverse().map(r=>requestCard(r)).join("") : emptyState("You have no requests yet.")}
        </div>
    `;
}

function hospitalReservations() {
    const own = data.requests.filter(r=>r.hospitalId===selectedHospital);

    return `
        ${heading("HOSPITAL MANAGEMENT","Admission <span>reservations.</span>","Review requests associated with your selected demo hospital.")}
        <div class="card-grid">
            ${own.length ? own.slice().reverse().map(r=>requestCard(r)).join("") : emptyState("No reservations for this hospital.")}
        </div>
    `;
}

/* ============================================
   NAVIGATION
============================================ */

function navigationPage() {
    const h = hospitalById(selectedNavigationHospital) || data.hospitals[0];

    return `
        ${heading("LOCATION SUPPORT","Hospital <span>navigation.</span>","Open the selected hospital's location in Google Maps.")}
        <div class="map-panel"><div class="map-pin">✚</div></div>
        <div class="panel">
            <h2>${safe(h.name)}</h2>
            <p class="panel-subtitle">${safe(h.area)} · Approx. ${h.distance} km (sample distance)</p>
            <label class="field">Select destination
                <select id="navigationSelect">
                    ${data.hospitals.map(x=>`<option value="${x.id}" ${x.id===h.id?"selected":""}>${safe(x.name)}</option>`).join("")}
                </select>
            </label>
            <button class="btn btn-primary" data-open-map="${h.id}">Open Google Maps →</button>
            <p class="muted" style="margin-top:12px">Map search only. No live ambulance tracking or ETA is provided.</p>
        </div>
    `;
}

/* ============================================
   AMBULANCE OPERATOR DASHBOARD
============================================ */

function ambulanceHome() {
    const pending = data.requests.filter(r=>r.status==="Matching" || r.status==="Pending").length;
    const t = totals();

    return `
        ${heading("AMBULANCE OPERATOR","Welcome to your <span>response centre.</span>","Review emergency requests and explore suitable sample hospital destinations.")}
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
            stat("＋","Active requests",pending,"red"),
            stat("⌂","Connected hospitals",data.hospitals.length,"blue"),
            stat("▦","General beds",t.general,"green"),
            stat("✚","ICU beds",t.icu,"purple")
        ])}
        <div class="section-heading"><h2>Operator tools</h2></div>
        <div class="quick-grid">
            ${quickCard("＋","Emergency requests","Review submitted requests","requests")}
            ${quickCard("⌕","Hospital matching","Compare suitable destinations","matches")}
            ${quickCard("➤","Navigation","Open hospital map links","navigation")}
        </div>
        <div class="notice">This demo does not dispatch ambulances, track GPS locations or provide real-time routing.</div>
    `;
}

function ambulanceRequests() {
    return `
        ${heading("RESPONSE COORDINATION","Emergency <span>requests.</span>","Review patient requests submitted through the PRAN demo.")}
        <div class="card-grid">
            ${data.requests.length ? data.requests.slice().reverse().map(r=>requestCard(r,false)).join("") : emptyState("No emergency requests have been submitted yet.")}
        </div>
    `;
}

/* ============================================
   HOSPITAL DASHBOARD
============================================ */

function hospitalHome() {
    const h = hospitalById(selectedHospital);
    const incoming = data.requests.filter(r=>r.hospitalId===h.id);
    const pending = incoming.filter(r=>r.status==="Pending").length;

    return `
        ${heading("HOSPITAL WORKSPACE","Your hospital, <span>your dashboard.</span>","Manage your selected hospital's sample capacity and review admission requests.")}
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
            stat("▦","General beds",h.general,"blue"),
            stat("✚","ICU beds",h.icu,"red"),
            stat("♙","Medical staff",h.staff,"green"),
            stat("▤","Pending requests",pending,"purple")
        ])}
        <div class="section-heading"><h2>Hospital tools</h2></div>
        <div class="quick-grid">
            ${quickCard("▦","Manage capacity","Update bed availability","capacity")}
            ${quickCard("▤","Incoming requests","Review admission requests","requests")}
            ${quickCard("✓","Reservations","Track admission decisions","reservations")}
        </div>
    `;
}

function hospitalSelect() {
    return `
        <label class="field">Select your demo hospital
            <select id="hospitalSelect">
                ${data.hospitals.map(h=>`<option value="${h.id}" ${h.id===selectedHospital?"selected":""}>${safe(h.name)}</option>`).join("")}
            </select>
        </label>
    `;
}

function capacityPage() {
    const h = hospitalById(selectedHospital);

    return `
        ${heading("HOSPITAL MANAGEMENT","Bed <span>management.</span>","Update the sample availability for your selected hospital.")}
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
    const incoming = data.requests.filter(r=>r.hospitalId===selectedHospital);

    return `
        ${heading("HOSPITAL MANAGEMENT","Incoming <span>requests.</span>","Review and respond to admission requests assigned to your hospital.")}
        <div class="panel">
            ${hospitalSelect()}
        </div>
        <div class="card-grid">
            ${incoming.length ? incoming.slice().reverse().map(r=>requestCard(r)).join("") : emptyState("No requests have been assigned to this hospital yet.")}
        </div>
    `;
}

/* ============================================
   ADMIN DASHBOARD
============================================ */

function adminHome() {
    const t = totals();
    const pending = data.requests.filter(r=>r.status==="Pending" || r.status==="Matching").length;
    const accepted = data.requests.filter(r=>r.status==="Accepted").length;

    return `
        ${heading("SYSTEM ADMINISTRATION","Network <span>overview.</span>","Monitor the sample hospital network and platform requests.")}
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
            stat("⌂","Connected hospitals",data.hospitals.length,"blue"),
            stat("▦","General beds",t.general,"green"),
            stat("✚","ICU beds",t.icu,"red"),
            stat("▤","Active requests",pending,"purple")
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

function allRequestsPage() {
    return `
        ${heading("NETWORK MONITORING","All emergency <span>requests.</span>","Monitor requests across the sample PRAN network.")}
        <div class="card-grid">
            ${data.requests.length ? data.requests.slice().reverse().map(r=>requestCard(r,false)).join("") : emptyState("No requests in the network yet.")}
        </div>
    `;
}

function allReservationsPage() {
    const reservations = data.requests.filter(r=>r.hospitalId);

    return `
        ${heading("NETWORK MONITORING","All <span>reservations.</span>","Review hospital admission responses across the demo network.")}
        <div class="card-grid">
            ${reservations.length ? reservations.slice().reverse().map(r=>requestCard(r,false)).join("") : emptyState("No hospital reservations have been created.")}
        </div>
    `;
}

/* ============================================
   FORM AND CONTROL EVENTS
============================================ */

document.addEventListener("change",event => {
    if (event.target.id === "hospitalSelect") {
        selectedHospital = Number(event.target.value);
        renderPage();
    }

    if (event.target.id === "navigationSelect") {
        selectedNavigationHospital = Number(event.target.value);
        renderPage();
    }
});

document.addEventListener("input",event => {
    if (event.target.id === "bedSearch") {
        const query = event.target.value.toLowerCase();

        const filtered = data.hospitals.filter(h =>
            h.name.toLowerCase().includes(query) ||
            h.area.toLowerCase().includes(query)
        );

        document.getElementById("bedCards").innerHTML = filtered.length
            ? filtered.map(h=>hospitalCard(h)).join("")
            : emptyState("No matching hospitals found.");
    }
});

document.addEventListener("submit",event => {
    if (event.target.id !== "capacityForm") return;

    event.preventDefault();

    const h = hospitalById(selectedHospital);
    const general = Number(document.getElementById("editGeneral").value);
    const icu = Number(document.getElementById("editICU").value);
    const staff = Number(document.getElementById("editStaff").value);

    if (
        !Number.isInteger(general) || general < 0 || general > 500 ||
        !Number.isInteger(icu) || icu < 0 || icu > 200 ||
        !Number.isInteger(staff) || staff < 0 || staff > 500
    ) {
        document.getElementById("capacityError").textContent =
            "Please enter valid non-negative whole numbers.";
        return;
    }

    h.general = general;
    h.icu = icu;
    h.staff = staff;

    saveData();
    supabaseUpdateBeds(selectedHospital, { general, icu, staff });
    toast("Hospital capacity updated.");
    renderPage();
});

/* ============================================
   CLICK ACTIONS
============================================ */

document.addEventListener("click",event => {
    const go = event.target.closest("[data-go]");
    const map = event.target.closest("[data-map]");
    const book = event.target.closest("[data-book]");
    const assign = event.target.closest("[data-assign]");
    const accept = event.target.closest("[data-accept]");
    const reject = event.target.closest("[data-reject]");
    const openMap = event.target.closest("[data-open-map]");

    if (go) openPage(go.dataset.go);

    if (map) {
        selectedNavigationHospital = Number(map.dataset.map);
        openPage("navigation");
    }

    if (openMap) {
        const h = hospitalById(openMap.dataset.openMap);
        if (h) {
            const query = encodeURIComponent(h.name + ", " + h.area);
            window.open("https://www.google.com/maps/search/?api=1&query="+query,"_blank","noopener,noreferrer");
        }
    }

    if (book) createPatientReservation(Number(book.dataset.book));
    if (assign) assignAmbulanceHospital(Number(assign.dataset.assign));
    if (accept) updateRequestStatus(Number(accept.dataset.accept),"Accepted");
    if (reject) updateRequestStatus(Number(reject.dataset.reject),"Rejected");
});

/* ============================================
   PATIENT RESERVATION
============================================ */

function createPatientReservation(hospitalId) {
    const h = hospitalById(hospitalId);

    const request = [...data.requests].reverse().find(r =>
        r.owner === (currentUser.email || "guest") &&
        r.status === "Matching"
    );

    if (!request || !h) {
        toast("Create a new emergency request first.");
        return;
    }

    const result = matchScore(h,request);

    if (!result.eligible) {
        toast("This hospital does not meet the demo requirements.");
        return;
    }

    request.hospitalId = h.id;
    request.status = "Pending";

    saveData();
    supabaseUpdateRequest(request.id, "Pending", h.id);
    supabaseAddReservation({
        requestId: request.id,
        hospitalId: h.id,
        patientName: request.patientName,
        bedType: request.facility,
        status: "Pending"
    });
    toast("Admission request sent.");
    openPage("reservations");
}

/* ============================================
   AMBULANCE HOSPITAL ASSIGNMENT
============================================ */

function assignAmbulanceHospital(hospitalId) {
    const h = hospitalById(hospitalId);

    const request = [...data.requests].reverse().find(r =>
        r.status === "Matching" || r.status === "Pending"
    );

    if (!h || !request) {
        toast("No active request is available.");
        return;
    }

    const result = matchScore(h,request);

    if (!result.eligible) {
        toast("This hospital does not meet the demo requirements.");
        return;
    }

    request.hospitalId = h.id;
    request.status = "Pending";

    saveData();
    supabaseUpdateRequest(request.id, "Pending", h.id);
    toast("Hospital selected.");
    selectedNavigationHospital = h.id;
    openPage("navigation");
}

/* ============================================
   HOSPITAL ACCEPT / REJECT
============================================ */

function updateRequestStatus(id,status) {
    const request = requestById(id);

    if (!request || request.status !== "Pending") {
        toast("This request is no longer pending.");
        return;
    }

    if (status === "Accepted") {
        const h = hospitalById(request.hospitalId);

        if (!h) {
            toast("Hospital record not found.");
            return;
        }

        const key = request.facility === "ICU" ? "icu" : "general";

        if (h[key] <= 0) {
            toast("No sample bed is available.");
            return;
        }

        h[key] -= 1;
    }

    request.status = status;
    saveData();
    supabaseUpdateRequest(id, status, request.hospitalId);
    toast("Request " + status.toLowerCase() + ".");
    renderPage();
}

/* ============================================
   INITIALISE
============================================ */

function initialise() {
    showScreen("loginScreen");
    initSupabase();
    console.log("PRAN role-based system is ready.");
}

initialise();

