/**
 * PRAN - Emergency Hospital Coordination System
 * Backend Server (REST API)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const { isConfigured, supabase, getSupabaseHospitals, getSupabaseRequests } = require("./supabaseClient");
const { handleAuthRoutes } = require("./routes/auth");
const { handleHospitalRoutes } = require("./routes/hospitals");
const { handleRequestRoutes } = require("./routes/requests");
const { handleTriageRoutes } = require("./routes/triage");
const { handleAiRoutes } = require("./routes/ai");

const PORT = process.env.PORT || 5001;
const DB_FILE = path.join(__dirname, "data", "db.json");

// Dynamic in-memory cache synchronized with live Supabase database
let db = { hospitals: [], requests: [] };

async function syncWithDatabase() {
    if (isConfigured && supabase) {
        try {
            const liveHospitals = await getSupabaseHospitals();
            if (liveHospitals && liveHospitals.length > 0) {
                db.hospitals = liveHospitals;
                console.log(`✓ Loaded ${liveHospitals.length} hospitals from Supabase.`);
            }
            const liveRequests = await getSupabaseRequests();
            if (liveRequests) {
                db.requests = liveRequests;
                console.log(`✓ Loaded ${liveRequests.length} emergency requests from Supabase.`);
            }
            saveDB();
        } catch (e) {
            console.warn("Notice: Initial Supabase sync skipped:", e.message);
        }
    } else if (fs.existsSync(DB_FILE)) {
        try {
            const fileContent = fs.readFileSync(DB_FILE, "utf-8");
            db = JSON.parse(fileContent);
        } catch (err) {
            console.error("Error reading db.json cache:", err);
        }
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    } catch (err) {
        console.error("Error saving db.json:", err);
    }
}

// CORS helper
function setCorsHeaders(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const server = http.createServer((req, res) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;

    let rawBody = "";
    req.on("data", chunk => {
        rawBody += chunk;
    });

    req.on("end", async () => {
        let body = null;
        if (rawBody) {
            try {
                body = JSON.parse(rawBody);
            } catch (e) {
                // Ignore json parse error or treat as empty
            }
        }

        // Base health & info routes
        if (pathname === "/" || pathname === "/api/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                status: "healthy",
                system: "PRAN Emergency Coordination Backend",
                version: "2.0.0",
                alignedWith: "Hospital Bed Routing System",
                supabaseConnected: isConfigured && Boolean(supabase),
                database: isConfigured ? "supabase" : "local_storage",
                endpoints: [
                    "GET  /api/health",
                    "GET  /api/supabase/status",
                    "GET  /api/supabase/config",
                    "GET  /api/ai/status",
                    "POST /api/ai/triage",
                    "POST /api/ai/copilot",
                    "POST /api/ai/match-rationale",
                    "POST /api/auth/login",
                    "POST /api/auth/guest",
                    "GET  /api/hospitals",
                    "GET  /api/hospitals/:id",
                    "PUT  /api/hospitals/:id/capacity",
                    "PUT  /api/admin/hospitals/:id/beds",
                    "GET  /api/admin/dashboard",
                    "POST /api/triage",
                    "GET  /api/requests",
                    "POST /api/requests",
                    "GET  /api/requests/:id",
                    "PUT  /api/requests/:id/status",
                    "GET  /api/reservations",
                    "POST /api/reservations"
                ]
            }));
            return;
        }

        if (pathname === "/api/supabase/status" || pathname === "/api/supabase/config") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                configured: isConfigured,
                connected: Boolean(supabase),
                url: process.env.SUPABASE_URL || "",
                anonKey: process.env.SUPABASE_ANON_KEY || ""
            }));
            return;
        }

        // Dispatch routes
        const aiResult = await handleAiRoutes(req, res, pathname, body, db);
        if (aiResult) {
            res.writeHead(aiResult.status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(aiResult.data));
            return;
        }

        const authResult = handleAuthRoutes(req, res, pathname, body);
        if (authResult) {
            res.writeHead(authResult.status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(authResult.data));
            return;
        }

        const triageResult = await handleTriageRoutes(req, res, pathname, body, db);
        if (triageResult) {
            res.writeHead(triageResult.status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(triageResult.data));
            return;
        }

        const hospitalResult = await handleHospitalRoutes(req, res, pathname, body, db);
        if (hospitalResult) {
            saveDB();
            res.writeHead(hospitalResult.status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(hospitalResult.data));
            return;
        }

        const requestResult = await handleRequestRoutes(req, res, pathname, body, db);
        if (requestResult) {
            saveDB();
            res.writeHead(requestResult.status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(requestResult.data));
            return;
        }

        // 404 Route Not Found
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: `Endpoint ${pathname} not found.` }));
    });
});

server.listen(PORT, async () => {
    console.log(`PRAN Backend Server running on http://localhost:${PORT}`);
    await syncWithDatabase();
});

module.exports = server;
