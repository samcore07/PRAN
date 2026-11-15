/* ============================================
   APPLICATION SHELL & NAVIGATION CONTROLLER
============================================ */

const roleMenus = {
    patient: [
        ["overview", "⌂", "Overview"],
        ["request", "＋", "Emergency Request"],
        ["beds", "▦", "Bed Availability"],
        ["matches", "⌕", "Hospital Matching"],
        ["reservations", "▤", "My Reservations"],
        ["navigation", "➤", "Navigation"]
    ],
    ambulance: [
        ["overview", "⌂", "Overview"],
        ["requests", "＋", "Emergency Requests"],
        ["beds", "▦", "Bed Availability"],
        ["matches", "⌕", "Hospital Matching"],
        ["navigation", "➤", "Navigation"]
    ],
    hospital: [
        ["overview", "⌂", "Overview"],
        ["capacity", "▦", "Bed Management"],
        ["requests", "▤", "Incoming Requests"],
        ["reservations", "✓", "Reservations"]
    ]
};

function toast(message) {
    const box = document.getElementById("toast");
    if (!box) return;
    box.textContent = message;
    box.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => box.classList.remove("show"), 2600);
}

function showScreen(id) {
    ["loginScreen", "roleScreen", "appScreen"].forEach(screen => {
        const el = document.getElementById(screen);
        if (el) el.classList.add("hidden");
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove("hidden");
}

function buildNavigation() {
    const nav = document.getElementById("sidebarNav");
    if (!nav || !currentRole || !roleMenus[currentRole]) return;

    nav.innerHTML = roleMenus[currentRole].map(item => `
        <button class="nav-link" data-page="${item[0]}">
            <span class="nav-icon">${item[1]}</span>
            ${item[2]}
        </button>
    `).join("");
}

function openPage(page) {
    if (!currentRole || !roleMenus[currentRole]) return;
    const allowed = roleMenus[currentRole].some(item => item[0] === page);
    if (!allowed) return;

    currentPage = page;

    const item = roleMenus[currentRole].find(i => i[0] === page);
    const pageTitle = document.getElementById("pageTitle");
    if (pageTitle) pageTitle.textContent = item ? item[2] : "Overview";

    document.querySelectorAll("#sidebarNav .nav-link").forEach(button => {
        button.classList.toggle("active", button.dataset.page === page);
    });

    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("open");

    if (typeof renderPage === "function") {
        renderPage();
    }
}

function initShell() {
    const sidebarNav = document.getElementById("sidebarNav");
    const menuToggle = document.getElementById("menuToggle");
    const switchRole = document.getElementById("switchRole");
    const logoutBtn = document.getElementById("logoutButton");

    if (sidebarNav) {
        sidebarNav.addEventListener("click", event => {
            const button = event.target.closest("[data-page]");
            if (button) openPage(button.dataset.page);
        });
    }

    if (menuToggle) {
        menuToggle.addEventListener("click", () => {
            const sidebar = document.getElementById("sidebar");
            if (sidebar) sidebar.classList.toggle("open");
        });
    }

    if (switchRole) {
        switchRole.addEventListener("click", () => {
            if (typeof buildNavigation === "function") buildNavigation();
            showScreen("roleScreen");
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            currentUser = null;
            currentRole = null;
            const loginForm = document.getElementById("loginForm");
            if (loginForm) loginForm.reset();
            showScreen("loginScreen");
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShell);
} else {
    initShell();
}
