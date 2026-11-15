/* ============================================
   PRAN - MAIN APPLICATION CONTROLLER & STATE
============================================ */

const STORAGE = "PRAN_ROLE_DEMO_V1";

const hospitalsDefault = [
    { id: 1, name: "Aster Care Medical Centre", area: "Salt Lake Sector V, Kolkata", distance: 3.2, general: 12, icu: 4, staff: 8, categories: ["Accident", "Cardiac", "Neurological", "General"], facilities: ["Emergency", "ICU", "Trauma Care", "Cardiac Care"] },
    { id: 2, name: "Northview Multispeciality Hospital", area: "New Town, Kolkata", distance: 5.6, general: 8, icu: 2, staff: 6, categories: ["Accident", "Cardiac", "General"], facilities: ["Emergency", "ICU", "Trauma Care"] },
    { id: 3, name: "Lakeside Emergency Centre", area: "Bidhannagar, Kolkata", distance: 6.8, general: 5, icu: 3, staff: 5, categories: ["Cardiac", "Neurological", "General"], facilities: ["Emergency", "ICU", "Cardiac Care", "Neuro Care"] },
    { id: 4, name: "Greenline General Hospital", area: "Kestopur, Kolkata", distance: 8.1, general: 18, icu: 0, staff: 4, categories: ["Accident", "General"], facilities: ["Emergency", "Trauma Care"] },
    { id: 5, name: "City Heart & Neuro Institute", area: "EM Bypass, Kolkata", distance: 10.4, general: 6, icu: 5, staff: 9, categories: ["Cardiac", "Neurological", "General"], facilities: ["Emergency", "ICU", "Cardiac Care", "Neuro Care"] },
    { id: 6, name: "Riverbend Community Hospital", area: "Dum Dum, Kolkata", distance: 11.7, general: 10, icu: 1, staff: 3, categories: ["Accident", "General"], facilities: ["Emergency", "Trauma Care"] }
];

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
            categories: [...h.categories],
            facilities: [...h.facilities]
        })),
        requests: []
    };
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

    if (currentRole === "admin") {
        if (currentPage === "overview" && typeof adminHome === "function") root.innerHTML = adminHome();
        if (currentPage === "beds" && typeof bedsPage === "function") root.innerHTML = bedsPage();
        if (currentPage === "requests" && typeof allRequestsPage === "function") root.innerHTML = allRequestsPage();
        if (currentPage === "reservations" && typeof allReservationsPage === "function") root.innerHTML = allReservationsPage();
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
    console.log("PRAN role-based frontend initialized.");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise);
} else {
    initialise();
}
