/**
 * PRAN - Supabase Client & Database Services
 * Provides direct connection to Supabase with seamless local fallback
 */

const path = require("path");
const fs = require("fs");

// Load .env from backend/ or root
require("dotenv").config({ path: path.join(__dirname, ".env") });
if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("your-project-id")) {
    require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
}

let createClient = null;
try {
    const supabasePkg = require("@supabase/supabase-js");
    createClient = supabasePkg.createClient;
} catch (e) {
    console.warn("Notice: @supabase/supabase-js is not installed yet. Running in local fallback mode.");
}

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const isConfigured = Boolean(
    createClient &&
    SUPABASE_URL &&
    SUPABASE_KEY &&
    !SUPABASE_URL.includes("your-project-id") &&
    !SUPABASE_KEY.includes("your-anon-key") &&
    !SUPABASE_KEY.includes("your-service-role")
);

let supabase = null;
if (isConfigured) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: false }
        });
        console.log("✓ Connected to Supabase Database successfully at:", SUPABASE_URL);
    } catch (err) {
        console.error("Failed to initialize Supabase client:", err.message);
        supabase = null;
    }
} else {
    console.log("ℹ Supabase credentials not set or using placeholders in .env.");
    console.log("  Backend is operating in local persistence mode (data/db.json).");
    console.log("  Add your SUPABASE_URL and SUPABASE_ANON_KEY to .env to connect to Supabase.");
}

// ============================================
// SUPABASE REPOSITORY SERVICES
// ============================================

/**
 * Fetch all hospitals from Supabase
 */
async function getSupabaseHospitals() {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from("hospitals")
            .select("*")
            .order("id", { ascending: true });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error("Supabase getHospitals error:", err.message);
        return null;
    }
}

/**
 * Update hospital bed capacity in Supabase
 */
async function updateSupabaseHospitalCapacity(id, { general, icu, staff }) {
    if (!supabase) return null;
    try {
        const updatePayload = {};
        if (typeof general === "number") updatePayload.general = general;
        if (typeof icu === "number") updatePayload.icu = icu;
        if (typeof staff === "number") updatePayload.staff = staff;

        const { data, error } = await supabase
            .from("hospitals")
            .update(updatePayload)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error("Supabase updateHospitalCapacity error:", err.message);
        return null;
    }
}

/**
 * Fetch all emergency requests from Supabase
 */
async function getSupabaseRequests() {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from("emergency_requests")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Map snake_case to frontend format if needed
        return data.map(r => ({
            id: Number(r.id),
            patientName: r.patient_name,
            age: r.age,
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
    } catch (err) {
        console.error("Supabase getRequests error:", err.message);
        return null;
    }
}

/**
 * Insert new emergency request into Supabase
 */
async function createSupabaseRequest(request) {
    if (!supabase) return null;
    try {
        const payload = {
            id: request.id,
            patient_name: request.patientName,
            age: request.age,
            contact: request.contact,
            category: request.category,
            facility: request.facility,
            location: request.location,
            notes: request.notes || "",
            status: request.status || "Matching",
            hospital_id: request.hospitalId || null,
            owner: request.owner || "guest"
        };

        const { data, error } = await supabase
            .from("emergency_requests")
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error("Supabase createRequest error:", err.message);
        return null;
    }
}

/**
 * Update request status & hospital assignment in Supabase
 */
async function updateSupabaseRequestStatus(id, { status, hospitalId }) {
    if (!supabase) return null;
    try {
        const payload = {};
        if (status) payload.status = status;
        if (hospitalId !== undefined) payload.hospital_id = hospitalId;

        const { data, error } = await supabase
            .from("emergency_requests")
            .update(payload)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        // If accepted and assigned, decrement bed in Supabase hospitals table
        if (status === "Accepted" && hospitalId) {
            const { data: reqData } = await supabase
                .from("emergency_requests")
                .select("facility")
                .eq("id", id)
                .single();

            const bedColumn = reqData?.facility === "ICU" ? "icu" : "general";
            const { data: hosp } = await supabase
                .from("hospitals")
                .select(bedColumn)
                .eq("id", hospitalId)
                .single();

            if (hosp && hosp[bedColumn] > 0) {
                await supabase
                    .from("hospitals")
                    .update({ [bedColumn]: hosp[bedColumn] - 1 })
                    .eq("id", hospitalId);
            }
        }

        return data;
    } catch (err) {
        console.error("Supabase updateRequestStatus error:", err.message);
        return null;
    }
}

/**
 * Fetch all reservations from Supabase
 */
async function getSupabaseReservations() {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from("reservations")
            .select("*, hospitals(name, area)")
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error("Supabase getReservations error:", err.message);
        return null;
    }
}

/**
 * Create a reservation record in Supabase
 */
async function createSupabaseReservation(reservation) {
    if (!supabase) return null;
    try {
        const payload = {
            request_id: reservation.requestId,
            hospital_id: reservation.hospitalId,
            patient_name: reservation.patientName,
            bed_type: reservation.bedType,
            status: reservation.status || "Pending"
        };

        const { data, error } = await supabase
            .from("reservations")
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error("Supabase createReservation error:", err.message);
        return null;
    }
}

module.exports = {
    supabase,
    isConfigured,
    getSupabaseHospitals,
    updateSupabaseHospitalCapacity,
    getSupabaseRequests,
    createSupabaseRequest,
    updateSupabaseRequestStatus,
    getSupabaseReservations,
    createSupabaseReservation
};
