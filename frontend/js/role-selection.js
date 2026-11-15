/* ============================================
   ROLE SELECTION COMPONENT LOGIC
============================================ */

const roleNames = {
    patient: "Patient / Attendant",
    ambulance: "Ambulance Operator",
    hospital: "Hospital Staff"
};

function initRoleSelection() {
    const roleButtons = document.querySelectorAll("[data-role]");

    roleButtons.forEach(button => {
        button.addEventListener("click", () => {
            currentRole = button.dataset.role;
            selectedHospital = 1;

            if (!currentUser) {
                showScreen("loginScreen");
                return;
            }

            startWorkspace();
        });
    });
}

function startWorkspace() {
    showScreen("appScreen");

    const displayName = currentUser ? currentUser.name : "Guest User";

    const sidebarUser = document.getElementById("sidebarUser");
    const sidebarRole = document.getElementById("sidebarRole");
    const userAvatar = document.getElementById("userAvatar");
    const topUser = document.getElementById("topUser");

    if (sidebarUser) sidebarUser.textContent = displayName;
    if (sidebarRole) sidebarRole.textContent = roleNames[currentRole] || "User";
    if (userAvatar) userAvatar.textContent = displayName.charAt(0).toUpperCase();
    if (topUser) topUser.textContent = displayName.charAt(0).toUpperCase();

    if (typeof buildNavigation === "function") buildNavigation();
    if (typeof openPage === "function") openPage("overview");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRoleSelection);
} else {
    initRoleSelection();
}
