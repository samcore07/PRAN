/**
 * PRAN Authentication Routes
 */

function handleAuthRoutes(req, res, path, body) {
    if (path === "/api/auth/login" && req.method === "POST") {
        const { email, password } = body || {};
        if (!email || !password) {
            return { status: 400, data: { success: false, message: "Email and password are required." } };
        }
        return {
            status: 200,
            data: {
                success: true,
                user: {
                    name: email.split("@")[0],
                    email,
                    guest: false
                }
            }
        };
    }

    if (path === "/api/auth/guest" && req.method === "POST") {
        return {
            status: 200,
            data: {
                success: true,
                user: {
                    name: "Guest User",
                    email: "",
                    guest: true
                }
            }
        };
    }

    return null;
}

module.exports = { handleAuthRoutes };
