/**
 * PRAN - Supabase Frontend Integration
 * Handles live database synchronization for:
 * - Hospitals directory & bed status
 * - Emergency patient intake requests
 * - Bed capacity updates (General, ICU, Staff)
 * - Admission reservations
 * - Supabase Realtime live subscriptions
 */

const SUPABASE_CONFIG = {
    // Replace with your project details from Supabase Dashboard -> Project Settings -> API
    url: (window.PRAN_ENV && window.PRAN_ENV.SUPABASE_URL) || "https://your-project-id.supabase.co",
    anonKey: (window.PRAN_ENV && window.PRAN_ENV.SUPABASE_ANON_KEY) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here"
};

let supabaseClient = null;

function isSupabaseAvailable() {
    return Boolean(
        window.supabase &&
        SUPABASE_CONFIG.url &&
        SUPABASE_CONFIG.anonKey &&
        !SUPABASE_CONFIG.url.includes("your-project-id") &&
        !SUPABASE_CONFIG.anonKey.includes("your-anon-key")
    );
}

function initSupabase() {
    if (isSupabaseAvailable()) {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            console.log("✓ Supabase client initialized on frontend:", SUPABASE_CONFIG.url);
            setupRealtimeSubscriptions();
            syncFromSupabase();
        } catch (e) {
            console.warn("Supabase initialization error:", e);
            supabaseClient = null;
        }
    } else {
        console.log("ℹ Supabase running in local/demo mode. To connect live Supabase, configure frontend/js/supabase.js or window.PRAN_ENV.");
    }
}

/**
 * 1. HOSPITALS & BED AVAILABILITY
 */
async function supabaseFetchHospitals() {
    if (!supabaseClient) return null;
    try {
        const { data: records, error } = await supabaseClient
            .from("hospitals")
            .select("*")
            .order("id", { ascending: true });

        if (error) throw error;
        if (records && records.length > 0) {
            data.hospitals = records.map(h => ({
                id: Number(h.id),
                name: h.name,
                area: h.area,
                distance: Number(h.distance),
                general: Number(h.general),
                icu: Number(h.icu),
                staff: Number(h.staff),
                categories: Array.isArray(h.categories) ? h.categories : [],
                facilities: Array.isArray(h.facilities) ? h.facilities : []
            }));
            saveData();
            if (typeof renderPage === "function") renderPage();
            return data.hospitals;
        }
    } catch (err) {
        console.warn("Supabase fetch hospitals failed, using local data:", err.message);
    }
    return null;
}

/**
 * 2. UPDATE HOSPITAL BED CAPACITY (General, ICU, Staff)
 */
async function supabaseUpdateCapacity(hospitalId, { general, icu, staff }) {
    if (!supabaseClient) return null;
    try {
        const { data: updated, error } = await supabaseClient
            .from("hospitals")
            .update({ general, icu, staff })
            .eq("id", hospitalId)
            .select()
            .single();

        if (error) throw error;
        console.log("✓ Supabase hospital bed capacity updated:", updated);
        return updated;
    } catch (err) {
        console.warn("Supabase update capacity error:", err.message);
        return null;
    }
}

/**
 * 3. EMERGENCY REQUESTS
 */
async function supabaseFetchRequests() {
    if (!supabaseClient) return null;
    try {
        const { data: records, error } = await supabaseClient
            .from("emergency_requests")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;
        if (records) {
            data.requests = records.map(r => ({
                id: Number(r.id),
                patientName: r.patient_name,
                age: Number(r.age),
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
            saveData();
            if (typeof renderPage === "function") renderPage();
            return data.requests;
        }
    } catch (err) {
        console.warn("Supabase fetch requests failed, using local data:", err.message);
    }
    return null;
}

/**
 * 4. CREATE EMERGENCY REQUEST
 */
async function supabaseCreateEmergencyRequest(req) {
    if (!supabaseClient) return null;
    try {
        const payload = {
            id: req.id,
            patient_name: req.patientName,
            age: req.age,
            contact: req.contact,
            category: req.category,
            facility: req.facility,
            location: req.location,
            notes: req.notes || "",
            status: req.status || "Matching",
            hospital_id: req.hospitalId || null,
            owner: req.owner || "guest"
        };

        const { data: created, error } = await supabaseClient
            .from("emergency_requests")
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        console.log("✓ Supabase emergency request created:", created);
        return created;
    } catch (err) {
        console.warn("Supabase create emergency request error:", err.message);
        return null;
    }
}

/**
 * 5. UPDATE REQUEST STATUS & BED ADJUSTMENT
 */
async function supabaseUpdateRequestStatus(requestId, status, hospitalId = null) {
    if (!supabaseClient) return null;
    try {
        const payload = { status };
        if (hospitalId) payload.hospital_id = hospitalId;

        const { data: updated, error } = await supabaseClient
            .from("emergency_requests")
            .update(payload)
            .eq("id", requestId)
            .select()
            .single();

        if (error) throw error;

        // If accepted, update bed count in Supabase hospitals table
        if (status === "Accepted" && hospitalId) {
            const req = data.requests.find(r => r.id === requestId);
            const bedType = req?.facility === "ICU" ? "icu" : "general";
            const h = hospitalById(hospitalId);
            if (h && h[bedType] > 0) {
                await supabaseUpdateCapacity(hospitalId, {
                    [bedType]: h[bedType]
                });
            }
        }

        console.log("✓ Supabase request status updated:", updated);
        return updated;
    } catch (err) {
        console.warn("Supabase update request status error:", err.message);
        return null;
    }
}

/**
 * 6. RESERVATIONS
 */
async function supabaseCreateReservation({ requestId, hospitalId, patientName, bedType, status }) {
    if (!supabaseClient) return null;
    try {
        const payload = {
            request_id: requestId,
            hospital_id: hospitalId,
            patient_name: patientName,
            bed_type: bedType,
            status: status || "Pending"
        };

        const { data: created, error } = await supabaseClient
            .from("reservations")
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        console.log("✓ Supabase reservation created:", created);
        return created;
    } catch (err) {
        console.warn("Supabase create reservation error:", err.message);
        return null;
    }
}

/**
 * 7. REALTIME LIVE UPDATES FOR HOSPITALS & REQUESTS
 */
function setupRealtimeSubscriptions() {
    if (!supabaseClient) return;

    try {
        supabaseClient
            .channel("pran-realtime-channel")
            .on("postgres_changes", { event: "*", schema: "public", table: "hospitals" }, payload => {
                console.log("⚡ Supabase Realtime Hospital Update:", payload);
                supabaseFetchHospitals();
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "emergency_requests" }, payload => {
                console.log("⚡ Supabase Realtime Emergency Request Update:", payload);
                supabaseFetchRequests();
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, payload => {
                console.log("⚡ Supabase Realtime Reservation Update:", payload);
                supabaseFetchRequests();
            })
            .subscribe();
    } catch (e) {
        console.warn("Realtime subscription failed:", e);
    }
}

async function syncFromSupabase() {
    await supabaseFetchHospitals();
    await supabaseFetchRequests();
}

// Auto-initialize when DOM and scripts are loaded
window.addEventListener("DOMContentLoaded", () => {
    initSupabase();
});
