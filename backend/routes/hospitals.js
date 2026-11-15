/**
 * PRAN Hospital & Bed Capacity Routes
 * Integrated with Supabase and local DB fallback
 */

const {
    getSupabaseHospitals,
    updateSupabaseHospitalCapacity
} = require("../supabaseClient");

async function handleHospitalRoutes(req, res, path, body, db) {
    // GET /api/hospitals
    if (path === "/api/hospitals" && req.method === "GET") {
        const supabaseData = await getSupabaseHospitals();
        if (supabaseData && supabaseData.length > 0) {
            return { status: 200, data: supabaseData };
        }
        return { status: 200, data: db.hospitals };
    }

    // GET /api/hospitals/:id
    const hospitalMatch = path.match(/^\/api\/hospitals\/(\d+)$/);
    if (hospitalMatch && req.method === "GET") {
        const id = Number(hospitalMatch[1]);
        const supabaseData = await getSupabaseHospitals();
        if (supabaseData) {
            const h = supabaseData.find(item => item.id === id);
            if (h) return { status: 200, data: h };
        }

        const hospital = db.hospitals.find(h => h.id === id);
        if (!hospital) {
            return { status: 404, data: { success: false, message: "Hospital not found." } };
        }
        return { status: 200, data: hospital };
    }

    // PUT /api/hospitals/:id/capacity
    const capacityMatch = path.match(/^\/api\/hospitals\/(\d+)\/capacity$/);
    if (capacityMatch && (req.method === "PUT" || req.method === "POST")) {
        const id = Number(capacityMatch[1]);
        const { general, icu, staff } = body || {};

        // Update in Supabase
        const updatedSupabase = await updateSupabaseHospitalCapacity(id, { general, icu, staff });

        // Also update local db for offline/fallback consistency
        const hospital = db.hospitals.find(h => h.id === id);
        if (hospital) {
            if (typeof general === "number" && general >= 0) hospital.general = general;
            if (typeof icu === "number" && icu >= 0) hospital.icu = icu;
            if (typeof staff === "number" && staff >= 0) hospital.staff = staff;
        }

        return {
            status: 200,
            data: {
                success: true,
                hospital: updatedSupabase || hospital,
                source: updatedSupabase ? "supabase" : "local_storage"
            }
        };
    }

    return null;
}

module.exports = { handleHospitalRoutes };
