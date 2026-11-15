/**
 * PRAN Hospital & Bed Capacity Routes
 * Integrated with Supabase and aligned with Hospital Bed Routing System specification
 */

const {
    getSupabaseHospitals,
    updateSupabaseHospitalCapacity
} = require("../supabaseClient");
const { calculateLoadScore } = require("../services/routingLogic");

async function handleHospitalRoutes(req, res, path, body, db) {
    // 1. GET /api/hospitals
    if (path === "/api/hospitals" && req.method === "GET") {
        const supabaseData = await getSupabaseHospitals();
        if (supabaseData && supabaseData.length > 0) {
            return {
                status: 200,
                data: supabaseData.map(h => ({
                    ...h,
                    loadScore: calculateLoadScore(h)
                }))
            };
        }
        return { status: 200, data: db.hospitals };
    }

    // 2. GET /api/admin/dashboard (Aggregate network occupancy & critical load metrics)
    if (path === "/api/admin/dashboard" && req.method === "GET") {
        let hospitals = await getSupabaseHospitals();
        if (!hospitals || hospitals.length === 0) hospitals = db.hospitals;

        const stats = {
            totalHospitals: hospitals.length,
            totalBeds: {
                icu: { available: 0, total: 0 },
                oxygen: { available: 0, total: 0 },
                general: { available: 0, total: 0 }
            },
            hospitalsByLoad: [],
            criticalCapacityHospitals: []
        };

        hospitals.forEach(hospital => {
            const icuAvail = Number(hospital.icu || 0);
            const icuTot = Number(hospital.icu_total || Math.max(icuAvail, 10));

            const genAvail = Number(hospital.general || 0);
            const genTot = Number(hospital.general_total || Math.max(genAvail, 30));

            const oxyAvail = Number(hospital.oxygen || Math.floor(genAvail * 0.4));
            const oxyTot = Number(hospital.oxygen_total || Math.max(oxyAvail, 15));

            stats.totalBeds.icu.available += icuAvail;
            stats.totalBeds.icu.total += icuTot;
            stats.totalBeds.oxygen.available += oxyAvail;
            stats.totalBeds.oxygen.total += oxyTot;
            stats.totalBeds.general.available += genAvail;
            stats.totalBeds.general.total += genTot;

            const icuOccupancy = Number(((icuTot - icuAvail) / icuTot * 100).toFixed(1));
            const oxyOccupancy = Number(((oxyTot - oxyAvail) / oxyTot * 100).toFixed(1));
            const genOccupancy = Number(((genTot - genAvail) / genTot * 100).toFixed(1));
            const overallOccupancy = Number(((icuOccupancy + oxyOccupancy + genOccupancy) / 3).toFixed(1));

            stats.hospitalsByLoad.push({
                id: hospital.id,
                name: hospital.name,
                icuOccupancy,
                oxygenOccupancy: oxyOccupancy,
                generalOccupancy: genOccupancy,
                overallOccupancy,
                loadScore: calculateLoadScore(hospital)
            });

            // Flag critical capacity (ICU occupancy > 85% or overall > 80%)
            if (icuOccupancy >= 85 || overallOccupancy >= 80) {
                stats.criticalCapacityHospitals.push({
                    id: hospital.id,
                    name: hospital.name,
                    icuAvailable: icuAvail,
                    generalAvailable: genAvail,
                    overallOccupancy
                });
            }
        });

        // Sort descending by load
        stats.hospitalsByLoad.sort((a, b) => b.overallOccupancy - a.overallOccupancy);

        return {
            status: 200,
            data: stats
        };
    }

    // 3. GET /api/hospitals/:id
    const hospitalMatch = path.match(/^\/api\/hospitals\/(\d+)$/);
    if (hospitalMatch && req.method === "GET") {
        const id = Number(hospitalMatch[1]);
        const supabaseData = await getSupabaseHospitals();
        if (supabaseData) {
            const h = supabaseData.find(item => item.id === id);
            if (h) return { status: 200, data: { ...h, loadScore: calculateLoadScore(h) } };
        }

        const hospital = db.hospitals.find(h => h.id === id);
        if (!hospital) {
            return { status: 404, data: { success: false, message: "Hospital not found." } };
        }
        return { status: 200, data: hospital };
    }

    // 4. PUT /api/hospitals/:id/capacity OR PUT /api/admin/hospitals/:id/beds
    const capacityMatch = path.match(/^\/api\/(?:admin\/)?hospitals\/(\d+)\/(?:capacity|beds)$/);
    if (capacityMatch && (req.method === "PUT" || req.method === "POST")) {
        const id = Number(capacityMatch[1]);
        const { general, icu, staff, bedType, available } = body || {};

        const updatePayload = {};
        if (bedType && typeof available === "number") {
            if (bedType === "icu") updatePayload.icu = available;
            else if (bedType === "general") updatePayload.general = available;
            else if (bedType === "oxygen") updatePayload.oxygen = available;
        } else {
            if (typeof general === "number" && general >= 0) updatePayload.general = general;
            if (typeof icu === "number" && icu >= 0) updatePayload.icu = icu;
            if (typeof staff === "number" && staff >= 0) updatePayload.staff = staff;
        }

        // Live update in Supabase
        const updatedSupabase = await updateSupabaseHospitalCapacity(id, updatePayload);

        // Keep local cache synced
        const hospital = db.hospitals.find(h => h.id === id);
        if (hospital) {
            Object.assign(hospital, updatePayload);
        }

        return {
            status: 200,
            data: {
                success: true,
                data: updatedSupabase || hospital,
                hospital: updatedSupabase || hospital,
                source: updatedSupabase ? "supabase" : "local_storage"
            }
        };
    }

    return null;
}

module.exports = { handleHospitalRoutes };
