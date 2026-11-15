/* ============================================
   LOGIN & AUTHENTICATION COMPONENT LOGIC
============================================ */

function initAuth() {
    const loginForm = document.getElementById("loginForm");
    const guestLogin = document.getElementById("guestLogin");
    const logoutFromRole = document.getElementById("logoutFromRole");

    if (loginForm) {
        loginForm.addEventListener("submit", event => {
            event.preventDefault();

            const emailInput = document.getElementById("emailInput");
            const passwordInput = document.getElementById("passwordInput");
            const error = document.getElementById("loginError");

            const email = emailInput ? emailInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value : "";

            if (error) error.textContent = "";

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                if (error) error.textContent = "Please enter a valid email address.";
                return;
            }

            if (password.length < 4) {
                if (error) error.textContent = "Please enter at least 4 characters for the demo password.";
                return;
            }

            currentUser = {
                name: email.split("@")[0],
                email,
                guest: false
            };

            showScreen("roleScreen");
        });
    }

    if (guestLogin) {
        guestLogin.addEventListener("click", () => {
            currentUser = {
                name: "Guest User",
                email: "",
                guest: true
            };

            showScreen("roleScreen");
        });
    }

    if (logoutFromRole) {
        logoutFromRole.addEventListener("click", () => {
            currentUser = null;
            showScreen("loginScreen");
        });
    }
}

// Auto-initialize if DOM is ready, or on DOMContentLoaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth);
} else {
    initAuth();
}
