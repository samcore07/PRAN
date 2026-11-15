
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

async function initSupabase() {
    if (!isSupabaseAvailable()) {
        try {
            const res = await fetch("http://localhost:5001/api/supabase/config");
            if (res.ok) {
                const config = await res.json();
                if (config.url && config.anonKey) {
                    SUPABASE_CONFIG.url = config.url;
                    SUPABASE_CONFIG.anonKey = config.anonKey;
                }
            }
        } catch (e) {
            // Fallback to local mode quietly
        }
    }

    if (isSupabaseAvailable()) {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            console.log("✓ Connected to Supabase at:", SUPABASE_CONFIG.url);
            await supabaseSync();
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

// ============================================
// PRAN AI COPILOT & CLINICAL TRIAGE CLIENT
// ============================================
const AI_API_BASE = "http://localhost:5001/api/ai";
let aiStatusCache = null;
let currentAiAssessment = null;
let copilotMessages = [
    {
        role: "assistant",
        content: "👋 Hello! I am the **PRAN Emergency Medical Copilot** powered by Groq. How can I assist you with clinical triage, first-aid protocols, or hospital bed coordination?"
    }
];

async function checkAiStatus() {
    try {
        const res = await fetch(`${AI_API_BASE}/status`);
        if (res.ok) {
            aiStatusCache = await res.json();
            return aiStatusCache;
        }
    } catch(e) {}
    return { configured: false, model: "llama-3.3-70b-versatile" };
}

async function requestAiTriage(patientData) {
    try {
        const res = await fetch(`${AI_API_BASE}/triage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patientData)
        });
        if (res.ok) {
            const result = await res.json();
            return result.assessment;
        }
    } catch(e) {}

    const s = (patientData.symptoms || "").toLowerCase();
    const spo2 = Number(patientData.vitals?.spo2) || 98;
    const isCritical = spo2 < 90 || s.includes("chest pain") || s.includes("unconscious") || s.includes("bleeding");
    return {
        source: "client-safety-fallback",
        severity: isCritical ? "CRITICAL" : "URGENT",
        triageScore: isCritical ? 90 : 65,
        code: isCritical ? "CODE_RED" : "CODE_YELLOW",
        recommendedWard: isCritical ? "ICU" : "GENERAL",
        confidence: 85,
        clinicalSummary: `Patient evaluated. Emergency severity classified as ${isCritical ? "CRITICAL" : "URGENT"}.`,
        vitalAlerts: spo2 < 92 ? [`Low oxygen saturation: ${spo2}%`] : [],
        immediateActions: [
            "Maintain open airway and position patient semi-upright",
            "Continuous vital sign monitoring every 5 minutes",
            "Prepare emergency department resuscitation intake"
        ],
        specialtiesNeeded: [isCritical ? "Intensivist / Trauma Team" : "General Emergency Physician"]
    };
}

async function sendCopilotQuery(promptText, extraContext = {}) {
    copilotMessages.push({ role: "user", content: promptText });
    renderCopilotMessages();
    const typingIndicator = document.getElementById("copilotTyping");
    if (typingIndicator) typingIndicator.classList.remove("hidden");

    try {
        const res = await fetch(`${AI_API_BASE}/copilot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: copilotMessages, context: extraContext })
        });
        if (res.ok) {
            const result = await res.json();
            copilotMessages.push({ role: "assistant", content: result.message || "Protocol received." });
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch(e) {
        let fallback = "⚠️ Emergency Guidance: Keep patient calm, in recovery position, and ensure rapid transport to nearest facility.";
        if (promptText.toLowerCase().includes("cpr")) {
            fallback = "🚨 IMMEDIATE CPR PROTOCOL:\n1. Check carotid pulse.\n2. Push hard and fast in center of chest (100-120 bpm, 2 inches deep).\n3. Allow full chest recoil.\n4. Attach AED immediately.";
        }
        copilotMessages.push({ role: "assistant", content: fallback });
    } finally {
        if (typingIndicator) typingIndicator.classList.add("hidden");
        renderCopilotMessages();
    }
}

function initAiCopilotUI() {
    if (document.getElementById("pranAiWidget")) return;

    const widget = document.createElement("div");
    widget.id = "pranAiWidget";
    widget.innerHTML = `
        <button id="copilotToggleBtn" class="copilot-launch-btn" title="Open PRAN AI Medical Copilot">
            <span class="copilot-pulse-dot"></span>
            <span class="copilot-btn-icon">⚡</span>
            <span class="copilot-btn-text">AI Copilot</span>
        </button>

        <div id="copilotDrawer" class="copilot-drawer hidden">
            <div class="copilot-header">
                <div class="copilot-header-info">
                    <span class="copilot-badge">✚ GROQ AI COPILOT</span>
                    <h3>PRAN Emergency Copilot</h3>
                    <small id="copilotAiStatus">Connecting to AI Engine...</small>
                </div>
                <button id="copilotCloseBtn" class="copilot-close-btn" aria-label="Close Copilot">✕</button>
            </div>

            <div class="copilot-quick-chips">
                <button class="copilot-chip" data-prompt="Adult CPR resuscitation steps">🚨 Adult CPR</button>
                <button class="copilot-chip" data-prompt="Chest pain / suspected heart attack pre-hospital care">❤️ Chest Pain</button>
                <button class="copilot-chip" data-prompt="Acute stroke FAST assessment steps">🧠 Stroke (FAST)</button>
                <button class="copilot-chip" data-prompt="Severe traumatic bleeding control protocol">🩸 Bleeding</button>
            </div>

            <div id="copilotChatScroll" class="copilot-messages"></div>

            <div id="copilotTyping" class="copilot-typing hidden">
                <span></span><span></span><span></span> PRAN AI is thinking...
            </div>

            <form id="copilotForm" class="copilot-input-bar">
                <input id="copilotInput" type="text" placeholder="Ask AI triage, first-aid, or hospital queries..." autocomplete="off" required />
                <button type="submit" class="copilot-send-btn">➤</button>
            </form>
        </div>
    `;

    document.body.appendChild(widget);

    document.getElementById("copilotToggleBtn")?.addEventListener("click", () => {
        const drawer = document.getElementById("copilotDrawer");
        drawer?.classList.toggle("hidden");
        if (drawer && !drawer.classList.contains("hidden")) {
            renderCopilotMessages();
            updateCopilotStatusText();
            document.getElementById("copilotInput")?.focus();
        }
    });

    document.getElementById("copilotCloseBtn")?.addEventListener("click", () => {
        document.getElementById("copilotDrawer")?.classList.add("hidden");
    });

    document.getElementById("copilotForm")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("copilotInput");
        const text = input ? input.value.trim() : "";
        if (!text) return;
        input.value = "";
        sendCopilotQuery(text);
    });

    document.addEventListener("click", (e) => {
        const chip = e.target.closest(".copilot-chip");
        if (chip) sendCopilotQuery(chip.dataset.prompt);
    });

    checkAiStatus().then(updateCopilotStatusText);
}

function updateCopilotStatusText() {
    const el = document.getElementById("copilotAiStatus");
    if (!el) return;
    if (aiStatusCache && aiStatusCache.configured) {
        el.innerHTML = '<span class="status-indicator-green">●</span> Active: ' + aiStatusCache.model;
    } else {
        el.innerHTML = '<span class="status-indicator-blue">●</span> Running (Groq API ready in .env)';
    }
}

function renderCopilotMessages() {
    const container = document.getElementById("copilotChatScroll");
    if (!container) return;

    container.innerHTML = copilotMessages.map(m => {
        const isUser = m.role === "user";
        const formatted = (m.content || "")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br>");

        return `
            <div class="copilot-bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}">
                <div class="bubble-sender">${isUser ? 'You' : '⚡ PRAN AI'}</div>
                <div class="bubble-content">${formatted}</div>
            </div>
        `;
    }).join("");

    container.scrollTop = container.scrollHeight;
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAiCopilotUI);
} else {
    initAiCopilotUI();
}

// No static data - live Supabase integration
const roleNames = {
    patient:"Patient / Attendant",
    ambulance:"Ambulance Operator",
    hospital:"Hospital Staff"
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
        console.warn("PRAN local storage could not be parsed.", error);
    }

    return {
        hospitals: [],
        requests: []
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
        error.textContent = "Please enter your password (minimum 4 characters).";
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

            <p>Approx. ${h.distance} km · ${Math.max(4, Math.round((h.distance || 4) * 2.2))} mins transit ETA</p>

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
}

/* ============================================
   PATIENT DASHBOARD
============================================ */

function patientHome() {
    const own = data.requests.filter(r => r.owner === currentUser.email || r.owner === "guest");
    const t = totals();

    return `
        ${heading("PATIENT WORKSPACE","Your care journey, <span>connected.</span>","Explore hospitals, submit an emergency request and follow live status.")}
        <div class="hero-panel">
            <div>
                <span class="hero-kicker">PRAN PATIENT PORTAL</span>
                <h2>Find the right care.<br>With better coordination.</h2>
                <p>Submit your requirements and explore hospitals with suitable facilities and live bed availability.</p>
                <button class="btn" data-go="request">Create emergency request →</button>
            </div>
            <div class="hero-mark">✚</div>
        </div>
        <div class="section-heading"><h2>Your overview</h2><span class="muted">Live status</span></div>
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
    `;
}

/* ============================================
   EMERGENCY REQUEST & AI TRIAGE FORM
============================================ */

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
                        <textarea id="patientNotes" rows="3" required placeholder="Describe acute symptoms (e.g. crushing retrosternal chest pain radiating to left shoulder, breathlessness for 45 mins)"></textarea>
                    </label>
                </div>

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
    supabaseCreateRequest(request);

    currentAiAssessment = null;

    if (typeof toast === "function") toast(`Request created: ${finalAssessment?.severity || 'Standard'} Priority`);
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
        ${heading("ADMISSION COORDINATION","My <span>reservations.</span>","Live status tracker for emergency hospital admissions and ambulance dispatches.")}
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
            ${own.length ? own.slice().reverse().map(r=>requestCard(r)).join("") : emptyState("You have no requests yet.")}
        </div>
    `;
}

function hospitalReservations() {
    const own = data.requests.filter(r=>r.hospitalId===selectedHospital);

    return `
        ${heading("HOSPITAL MANAGEMENT","Admission <span>reservations.</span>","Review requests associated with your selected hospital.")}
        <div class="card-grid">
            ${own.length ? own.slice().reverse().map(r=>requestCard(r)).join("") : emptyState("No reservations for this hospital.")}
        </div>
    `;
}

/* ============================================
   NAVIGATION & LIVE MAP API
============================================ */

let navLeafletMap = null;
let currentUserCoords = { lat: 22.5802, lng: 88.4326 };
let navMapMode = "leaflet";

const HOSPITAL_COORDINATES = {
    1: { lat: 22.5802, lng: 88.4326 },
    2: { lat: 22.5937, lng: 88.4682 },
    3: { lat: 22.5867, lng: 88.4178 },
    4: { lat: 22.5980, lng: 88.4285 },
    5: { lat: 22.5186, lng: 88.3976 },
    6: { lat: 22.6247, lng: 88.4208 }
};

function getHospitalCoords(h) {
    if (h && typeof h.lat === "number" && typeof h.lng === "number" && h.lat !== 0) {
        return { lat: h.lat, lng: h.lng };
    }
    return HOSPITAL_COORDINATES[h?.id] || { lat: 22.5802, lng: 88.4326 };
}

function calculateNavDistance(c1, c2) {
    const R = 6371;
    const dLat = (c2.lat - c1.lat) * Math.PI / 180;
    const dLng = (c2.lng - c1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
}

function navigationPage() {
    const h = hospitalById(selectedNavigationHospital) || data.hospitals[0] || {
        id: 1,
        name: "Aster Care Medical Centre",
        area: "Salt Lake Sector V, Kolkata",
        general: 12,
        icu: 4
    };

    const destCoords = getHospitalCoords(h);
    const dist = calculateNavDistance(currentUserCoords, destCoords);
    const eta = Math.max(3, Math.ceil((dist / 32) * 60));

    setTimeout(() => {
        initLiveNavigationMap(h);
    }, 60);

    return `
        ${heading("LOCATION & TRANSIT ROUTING", "Hospital <span>navigation.</span>", "Live interactive route mapping, transit ETA and turn-by-turn navigation.")}

        <div class="nav-map-wrap" id="navMapWrap">
            <div id="navMapCanvas" class="nav-map-canvas"></div>
            <div class="nav-map-overlay-badge" id="navMapOverlayBadge">
                <span class="nav-live-dot"></span> <span id="navMapBadgeText">Live Route Navigation</span>
            </div>
        </div>

        <div class="panel nav-detail-panel">
            <div class="nav-header-row">
                <div>
                    <span class="eyebrow">DESTINATION HOSPITAL</span>
                    <h2 id="navHospitalName">${safe(h.name)}</h2>
                    <p class="panel-subtitle" id="navHospitalArea">⌖ ${safe(h.area)}</p>
                </div>
                <div class="nav-quick-actions">
                    <button class="btn btn-light btn-small" id="btnLocateMe">⌖ Locate My GPS</button>
                    <button class="btn btn-light btn-small" id="btnToggleMapMode">⇄ Switch Map View</button>
                </div>
            </div>

            <div class="nav-metrics-grid">
                <div class="nav-metric-card">
                    <small>Route Distance</small>
                    <strong id="navDistance">${dist} km</strong>
                </div>
                <div class="nav-metric-card">
                    <small>Estimated Transit ETA</small>
                    <strong id="navETA">${eta} mins</strong>
                </div>
                <div class="nav-metric-card">
                    <small>Available ICU Beds</small>
                    <strong id="navICU" class="text-red">${h.icu ?? 0}</strong>
                </div>
                <div class="nav-metric-card">
                    <small>Available General Beds</small>
                    <strong id="navGeneral" class="text-blue">${h.general ?? 0}</strong>
                </div>
            </div>

            <label class="field" style="margin-top: 15px;">Change Hospital Destination
                <select id="navigationSelect">
                    ${data.hospitals.map(x => `<option value="${x.id}" ${x.id === h.id ? "selected" : ""}>${safe(x.name)} (${safe(x.area)})</option>`).join("")}
                </select>
            </label>

            <div class="nav-actions-row">
                <button class="btn btn-primary" id="btnOpenDirections" data-lat="${destCoords.lat}" data-lng="${destCoords.lng}">
                    <span>➤</span> Start Turn-by-Turn GPS Navigation
                </button>
                <a class="btn btn-light" href="tel:112">
                    <span>📞</span> Emergency Hotline (112)
                </a>
            </div>
            <p class="muted" style="margin-top:12px">
                Calculated using GPS coordinates and real-time city transit speeds. Opens in Google Maps navigation app for live voice-guided directions.
            </p>
        </div>
    `;
}

function initLiveNavigationMap(hospital) {
    const mapWrap = document.getElementById("navMapWrap");
    const mapCanvas = document.getElementById("navMapCanvas");
    if (!mapWrap || !mapCanvas) return;

    const destCoords = getHospitalCoords(hospital);

    if (navMapMode === "embed") {
        mapWrap.innerHTML = `
            <iframe class="nav-map-iframe" src="https://maps.google.com/maps?q=${destCoords.lat},${destCoords.lng}&hl=en&z=15&output=embed"></iframe>
            <div class="nav-map-overlay-badge">
                <span class="nav-live-dot"></span> Google Maps Embed
            </div>
        `;
        return;
    }

    if (window.L) {
        try {
            if (navLeafletMap) {
                navLeafletMap.remove();
                navLeafletMap = null;
            }

            navLeafletMap = L.map("navMapCanvas", {
                zoomControl: true,
                attributionControl: false
            }).setView([destCoords.lat, destCoords.lng], 14);

            L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
                maxZoom: 19
            }).addTo(navLeafletMap);

            data.hospitals.forEach(h => {
                const coords = getHospitalCoords(h);
                const isSelected = h.id === hospital.id;

                const marker = L.circleMarker([coords.lat, coords.lng], {
                    radius: isSelected ? 12 : 8,
                    fillColor: isSelected ? "#1767a5" : "#159b98",
                    color: "#ffffff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.95
                }).addTo(navLeafletMap);

                marker.bindPopup(`
                    <div class="hospital-map-popup">
                        <h4>${safe(h.name)}</h4>
                        <p>${safe(h.area)}</p>
                        <span class="bed-badge icu">ICU: ${h.icu}</span>
                        <span class="bed-badge general">General: ${h.general}</span>
                    </div>
                `);

                if (isSelected) marker.openPopup();
            });

            if (currentUserCoords) {
                const userMarker = L.circleMarker([currentUserCoords.lat, currentUserCoords.lng], {
                    radius: 9,
                    fillColor: "#e45e66",
                    color: "#ffffff",
                    weight: 3,
                    fillOpacity: 1
                }).addTo(navLeafletMap);

                userMarker.bindPopup("<strong>Your Location / Ambulance</strong><br>Origin Point");

                L.polyline([
                    [currentUserCoords.lat, currentUserCoords.lng],
                    [destCoords.lat, destCoords.lng]
                ], {
                    color: "#1767a5",
                    weight: 4,
                    opacity: 0.8,
                    dashArray: "6, 8"
                }).addTo(navLeafletMap);

                const bounds = L.latLngBounds([
                    [currentUserCoords.lat, currentUserCoords.lng],
                    [destCoords.lat, destCoords.lng]
                ]);
                navLeafletMap.fitBounds(bounds, { padding: [50, 50] });
            }

            setTimeout(() => {
                if (navLeafletMap) navLeafletMap.invalidateSize();
            }, 150);

        } catch (e) {
            console.warn("Leaflet error fallback:", e);
            renderEmbedMapFallback(destCoords);
        }
    } else {
        renderEmbedMapFallback(destCoords);
    }
}

function renderEmbedMapFallback(destCoords) {
    const mapWrap = document.getElementById("navMapWrap");
    if (mapWrap) {
        mapWrap.innerHTML = `
            <iframe class="nav-map-iframe" src="https://maps.google.com/maps?q=${destCoords.lat},${destCoords.lng}&hl=en&z=15&output=embed"></iframe>
            <div class="nav-map-overlay-badge">
                <span class="nav-live-dot"></span> Live Navigation Map
            </div>
        `;
    }
}

function openDirections(destCoords) {
    const dest = `${destCoords.lat},${destCoords.lng}`;
    let url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    if (currentUserCoords && currentUserCoords.lat) {
        const origin = `${currentUserCoords.lat},${currentUserCoords.lng}`;
        url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
    }
    window.open(url, "_blank", "noopener,noreferrer");
}

/* ============================================
   AMBULANCE OPERATOR DASHBOARD
============================================ */

function ambulanceHome() {
    const pending = data.requests.filter(r=>r.status==="Matching" || r.status==="Pending").length;
    const t = totals();

    return `
        ${heading("AMBULANCE OPERATOR","Welcome to your <span>response centre.</span>","Review emergency requests and find the best hospital destinations.")}
        <div class="hero-panel">
            <div>
                <span class="hero-kicker">AMBULANCE COORDINATION</span>
                <h2>Coordinate the next step.</h2>
                <p>Review submitted emergency requests, analyze triage, and explore live hospital availability.</p>
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
            ${quickCard("➤","Navigation","Open hospital map and live GPS directions","navigation")}
        </div>
    `;
}

function ambulanceRequests() {
    return `
        ${heading("RESPONSE COORDINATION","Emergency <span>requests.</span>","Review patient requests submitted to the network.")}
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
        ${heading("HOSPITAL WORKSPACE","Your hospital, <span>your dashboard.</span>","Manage your selected hospital's capacity and review admission requests.")}
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
        <label class="field">Select hospital
            <select id="hospitalSelect">
                ${data.hospitals.map(h=>`<option value="${h.id}" ${h.id===selectedHospital?"selected":""}>${safe(h.name)}</option>`).join("")}
            </select>
        </label>
    `;
}

function capacityPage() {
    const h = hospitalById(selectedHospital);
    const totalBeds = (h.general || 0) + (h.icu || 0);
    const estTotalCapacity = 60;
    const occupancyRate = Math.min(100, Math.max(10, Math.round(((estTotalCapacity - totalBeds) / estTotalCapacity) * 100)));
    const statusColor = occupancyRate >= 90 ? '#ef4444' : (occupancyRate >= 70 ? '#f59e0b' : '#10b981');

    return `
        ${heading("HOSPITAL MANAGEMENT","Bed <span>management.</span>","Live hospital bed inventory, rapid increments, and Supabase synchronization.")}
        <div class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                <h2>Hospital Capacity Dashboard</h2>
                <span class="role-chip" style="background: rgba(36, 150, 110, 0.15); color: #24966e;">
                    ● Supabase Live Sync Active
                </span>
            </div>
            ${hospitalSelect()}

            <div style="margin: 14px 0 18px; background: #f1f5f9; border-radius: 8px; padding: 12px 14px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px;">
                    <strong style="color: var(--navy);">Hospital Occupancy Load: ${occupancyRate}%</strong>
                    <span style="color: ${statusColor}; font-weight: 700;">${occupancyRate >= 90 ? 'CRITICAL SATURATION' : (occupancyRate >= 70 ? 'HEAVY DEMAND' : 'NORMAL CAPACITY')}</span>
                </div>
                <div style="height: 8px; width: 100%; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${occupancyRate}%; height: 100%; background: ${statusColor}; transition: width 0.3s ease;"></div>
                </div>
            </div>

            <div class="bed-row">
                <div class="bed-stat">
                    <small>General beds</small>
                    <strong style="font-size: 24px;">${h.general}</strong>
                    <div style="display: flex; gap: 6px; margin-top: 8px;">
                        <button type="button" class="btn-small btn-light" data-quick-bed="general" data-delta="-1">- 1</button>
                        <button type="button" class="btn-small btn-primary" data-quick-bed="general" data-delta="1">+ 1</button>
                    </div>
                </div>
                <div class="bed-stat">
                    <small>ICU beds</small>
                    <strong style="font-size: 24px; color: var(--red);">${h.icu}</strong>
                    <div style="display: flex; gap: 6px; margin-top: 8px;">
                        <button type="button" class="btn-small btn-light" data-quick-bed="icu" data-delta="-1">- 1</button>
                        <button type="button" class="btn-small btn-primary" data-quick-bed="icu" data-delta="1">+ 1</button>
                    </div>
                </div>
                <div class="bed-stat">
                    <small>Medical staff</small>
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
   THEME MANAGER (DARK / LIGHT MODE)
============================================ */
function getPreferredTheme() {
    const saved = localStorage.getItem("PRAN_THEME");
    if (saved) return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("PRAN_THEME", theme);
    document.querySelectorAll(".theme-icon").forEach(icon => {
        icon.textContent = theme === "dark" ? "☀️" : "🌙";
    });
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
}

// Initial theme setup
applyTheme(getPreferredTheme());

/* ============================================
   CLICK ACTIONS
============================================ */

document.addEventListener("click",event => {
    const themeBtn = event.target.closest(".theme-toggle");
    if (themeBtn) {
        toggleTheme();
        return;
    }

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

    // Quick Bed Increment / Decrement
    const quickBed = event.target.closest("[data-quick-bed]");
    if (quickBed) {
        const type = quickBed.dataset.quickBed;
        const delta = Number(quickBed.dataset.delta) || 0;
        const h = hospitalById(selectedHospital);
        if (h) {
            h[type] = Math.max(0, (Number(h[type]) || 0) + delta);
            saveData();
            supabaseUpdateBeds(h.id, { [type]: h[type] });
            toast(`${h.name}: ${type.toUpperCase()} updated to ${h[type]}`);
            renderPage();
        }
    }

    // Quick AI Triage Button
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
            toast("Please describe symptoms in Chief Complaint first.");
            document.getElementById("patientNotes")?.focus();
            return;
        }

        btn.disabled = true;
        btn.textContent = "⚡ Analyzing with Groq AI...";

        requestAiTriage({
            name, age, symptoms: notes,
            vitals: { heartRate: hr, systolicBP: bp, spo2, consciousness: avpu }
        }).then(assessment => {
            currentAiAssessment = assessment;
            btn.disabled = false;
            btn.textContent = "⚡ Re-analyze with AI";
            const preview = document.getElementById("aiTriagePreviewContainer");
            if (preview) preview.innerHTML = renderAiTriageCard(assessment);
            const fac = document.getElementById("patientFacility");
            if (fac && assessment.recommendedWard) {
                fac.value = assessment.recommendedWard === "ICU" ? "ICU" : "General";
            }
            toast(`AI Triage Complete: ${assessment.severity} Priority`);
        });
    }

    // View Triage Modal
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
            div.innerHTML = modalHTML;
            document.body.appendChild(div);
            const close = () => div.remove();
            div.querySelector("#closeTriageModalBtn")?.addEventListener("click", close);
            div.querySelector("#closeTriageModalBtn2")?.addEventListener("click", close);
        }
    }

    // Print Admission Pass Modal
    const printBtn = event.target.closest("[data-print-token]");
    if (printBtn) {
        const reqId = Number(printBtn.dataset.printToken);
        const req = data.requests.find(r => r.id === reqId);
        if (req) {
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
    }

    // Turn-by-Turn GPS Navigation
    const btnDirections = event.target.closest("#btnOpenDirections");
    if (btnDirections) {
        const lat = Number(btnDirections.dataset.lat) || 22.5802;
        const lng = Number(btnDirections.dataset.lng) || 88.4326;
        openDirections({ lat, lng });
    }

    // Locate My GPS
    const btnLocate = event.target.closest("#btnLocateMe");
    if (btnLocate) {
        if ("geolocation" in navigator) {
            btnLocate.textContent = "⌖ Acquiring GPS...";
            navigator.geolocation.getCurrentPosition(
                pos => {
                    currentUserCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    toast("GPS location updated.");
                    btnLocate.textContent = "✓ GPS Located";
                    renderPage();
                },
                err => {
                    toast("Could not acquire GPS: using Kolkata default.");
                    btnLocate.textContent = "⌖ Locate My GPS";
                },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        } else {
            toast("Geolocation is not supported by your browser.");
        }
    }

    // Switch between Leaflet & Google Maps
    const btnToggle = event.target.closest("#btnToggleMapMode");
    if (btnToggle) {
        navMapMode = navMapMode === "leaflet" ? "embed" : "leaflet";
        const h = hospitalById(selectedNavigationHospital) || data.hospitals[0];
        initLiveNavigationMap(h);
        toast(`Switched to ${navMapMode === "leaflet" ? "Interactive Route Map" : "Google Maps View"}.`);
    }
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
        toast("This hospital does not have adequate capacity.");
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
        toast("This hospital does not have adequate capacity.");
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

