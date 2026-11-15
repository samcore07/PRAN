/* ============================================
   PRAN - MAIN APPLICATION CONTROLLER & STATE
============================================ */

const STORAGE = "PRAN_ROLE_DEMO_V1";

// No static hospital data - live database integration
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
        console.warn("PRAN local cache could not be read.", error);
    }

    return {
        hospitals: [],
        requests: []
    };
}

async function syncFromDatabase() {
    // 1. Try Supabase direct sync
    if (typeof supabaseFetchHospitals === "function") {
        const supHosp = await supabaseFetchHospitals();
        if (supHosp && supHosp.length > 0) return;
    }

    // 2. Try Backend API sync
    try {
        const res = await fetch("http://localhost:5001/api/hospitals");
        if (res.ok) {
            const result = await res.json();
            const list = Array.isArray(result) ? result : result.data;
            if (Array.isArray(list) && list.length > 0) {
                data.hospitals = list;
                saveData();
                if (typeof renderPage === "function") renderPage();
            }
        }
    } catch (err) {
        // Backend offline or unreachable
    }
}

function saveData() {
    localStorage.setItem(STORAGE, JSON.stringify(data));
}

function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[c]);
}

function hospitalById(id) {
    return data.hospitals.find(h => h.id === Number(id));
}

function requestById(id) {
    return data.requests.find(r => r.id === Number(id));
}

function totals() {
    return data.hospitals.reduce((t, h) => {
        t.general += h.general;
        t.icu += h.icu;
        t.staff += h.staff;
        return t;
    }, { general: 0, icu: 0, staff: 0 });
}

/* ============================================
   PAGE ROUTER & DISPATCHER
============================================ */

function renderPage() {
    const root = document.getElementById("pageContent");
    if (!root) return;

    if (currentRole === "patient") {
        if (currentPage === "overview" && typeof patientHome === "function") root.innerHTML = patientHome();
        if (currentPage === "request" && typeof requestPage === "function") root.innerHTML = requestPage();
        if (currentPage === "beds" && typeof bedsPage === "function") root.innerHTML = bedsPage();
        if (currentPage === "matches" && typeof matchesPage === "function") root.innerHTML = matchesPage();
        if (currentPage === "reservations" && typeof reservationsPage === "function") root.innerHTML = reservationsPage();
        if (currentPage === "navigation" && typeof navigationPage === "function") root.innerHTML = navigationPage();
    }

    if (currentRole === "ambulance") {
        if (currentPage === "overview" && typeof ambulanceHome === "function") root.innerHTML = ambulanceHome();
        if (currentPage === "requests" && typeof ambulanceRequests === "function") root.innerHTML = ambulanceRequests();
        if (currentPage === "beds" && typeof bedsPage === "function") root.innerHTML = bedsPage();
        if (currentPage === "matches" && typeof matchesPage === "function") root.innerHTML = matchesPage();
        if (currentPage === "navigation" && typeof navigationPage === "function") root.innerHTML = navigationPage();
    }

    if (currentRole === "hospital") {
        if (currentPage === "overview" && typeof hospitalHome === "function") root.innerHTML = hospitalHome();
        if (currentPage === "capacity" && typeof capacityPage === "function") root.innerHTML = capacityPage();
        if (currentPage === "requests" && typeof hospitalRequests === "function") root.innerHTML = hospitalRequests();
        if (currentPage === "reservations" && typeof hospitalReservations === "function") root.innerHTML = hospitalReservations();
    }
}

/* ============================================
   GLOBAL CLICK ACTIONS
============================================ */

document.addEventListener("click", event => {
    const go = event.target.closest("[data-go]");
    const map = event.target.closest("[data-map]");
    const book = event.target.closest("[data-book]");
    const assign = event.target.closest("[data-assign]");
    const accept = event.target.closest("[data-accept]");
    const reject = event.target.closest("[data-reject]");
    const openMap = event.target.closest("[data-open-map]");

    if (go && typeof openPage === "function") openPage(go.dataset.go);

    if (map) {
        selectedNavigationHospital = Number(map.dataset.map);
        if (typeof openPage === "function") openPage("navigation");
    }

    if (openMap) {
        const h = hospitalById(openMap.dataset.openMap);
        if (h) {
            const query = encodeURIComponent(h.name + ", " + h.area);
            window.open("https://www.google.com/maps/search/?api=1&query=" + query, "_blank", "noopener,noreferrer");
        }
    }

    if (book && typeof createPatientReservation === "function") createPatientReservation(Number(book.dataset.book));
    if (assign && typeof assignAmbulanceHospital === "function") assignAmbulanceHospital(Number(assign.dataset.assign));
    if (accept && typeof updateRequestStatus === "function") updateRequestStatus(Number(accept.dataset.accept), "Accepted");
    if (reject && typeof updateRequestStatus === "function") updateRequestStatus(Number(reject.dataset.reject), "Rejected");
});

function initialise() {
    if (typeof showScreen === "function") {
        showScreen("loginScreen");
    }
    syncFromDatabase();
    console.log("PRAN role-based frontend initialized with live database.");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise);
} else {
    initialise();
}
