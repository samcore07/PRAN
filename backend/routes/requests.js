/**
 * PRAN Emergency Request & Admission Routes
 * Integrated with Supabase and local DB fallback
 */

const {
    getSupabaseRequests,
    createSupabaseRequest,
    updateSupabaseRequestStatus,
    getSupabaseReservations,
    createSupabaseReservation
} = require("../supabaseClient");

async function handleRequestRoutes(req, res, path, body, db) {
    // GET /api/requests
    if (path === "/api/requests" && req.method === "GET") {
        const supabaseRequests = await getSupabaseRequests();
        if (supabaseRequests) {
            return { status: 200, data: supabaseRequests };
        }
        return { status: 200, data: db.requests };
    }

    // POST /api/requests (Create emergency request)
    if (path === "/api/requests" && req.method === "POST") {
        const { patientName, age, contact, category, facility, location, notes, owner } = body || {};

        if (!patientName || !category || !facility || !location) {
            return { status: 400, data: { success: false, message: "Missing required patient fields." } };
        }

        const newRequest = {
            id: Date.now(),
            patientName: String(patientName).trim(),
            age: Number(age) || 0,
            contact: String(contact).trim(),
            category,
            facility,
            location: String(location).trim(),
            notes: String(notes || "").trim(),
            status: "Matching",
            hospitalId: null,
            owner: owner || "guest",
            createdAt: new Date().toISOString()
        };

        // Insert into Supabase
        const supabaseCreated = await createSupabaseRequest(newRequest);

        // Always keep local DB synced
        db.requests.push(newRequest);

        return {
            status: 201,
            data: {
                success: true,
                request: newRequest,
                supabaseSynced: Boolean(supabaseCreated)
            }
        };
    }

    // GET /api/requests/:id
    const requestMatch = path.match(/^\/api\/requests\/(\d+)$/);
    if (requestMatch && req.method === "GET") {
        const id = Number(requestMatch[1]);
        const supabaseRequests = await getSupabaseRequests();
        if (supabaseRequests) {
            const reqItem = supabaseRequests.find(r => r.id === id);
            if (reqItem) return { status: 200, data: reqItem };
        }

        const request = db.requests.find(r => r.id === id);
        if (!request) {
            return { status: 404, data: { success: false, message: "Request not found." } };
        }
        return { status: 200, data: request };
    }

    // PUT /api/requests/:id/status (Accept / Reject / Assign Hospital)
    const statusMatch = path.match(/^\/api\/requests\/(\d+)\/status$/);
    if (statusMatch && (req.method === "PUT" || req.method === "POST")) {
        const id = Number(statusMatch[1]);
        const { status, hospitalId } = body || {};

        const supabaseUpdated = await updateSupabaseRequestStatus(id, { status, hospitalId });

        // Update local memory / file DB
        const request = db.requests.find(r => r.id === id);
        if (request) {
            if (hospitalId !== undefined) request.hospitalId = Number(hospitalId);
            if (status) {
                if (status === "Accepted" && request.hospitalId) {
                    const hospital = db.hospitals.find(h => h.id === request.hospitalId);
                    if (hospital) {
                        const bedType = request.facility === "ICU" ? "icu" : "general";
                        if (hospital[bedType] > 0) hospital[bedType] -= 1;
                    }
                }
                request.status = status;
            }
        }

        return {
            status: 200,
            data: {
                success: true,
                request: request || supabaseUpdated,
                supabaseSynced: Boolean(supabaseUpdated)
            }
        };
    }

    // GET /api/reservations
    if (path === "/api/reservations" && req.method === "GET") {
        const supabaseRes = await getSupabaseReservations();
        if (supabaseRes) {
            return { status: 200, data: supabaseRes };
        }
        const localReservations = db.requests.filter(r => r.hospitalId);
        return { status: 200, data: localReservations };
    }

    // POST /api/reservations (Create explicit reservation)
    if (path === "/api/reservations" && req.method === "POST") {
        const { requestId, hospitalId, patientName, bedType, status } = body || {};

        const reservation = {
            requestId: Number(requestId),
            hospitalId: Number(hospitalId),
            patientName: String(patientName || "").trim(),
            bedType: String(bedType || "General"),
            status: status || "Pending"
        };

        const supabaseRes = await createSupabaseReservation(reservation);

        // Update request status if in local DB
        const reqItem = db.requests.find(r => r.id === reservation.requestId);
        if (reqItem) {
            reqItem.hospitalId = reservation.hospitalId;
            reqItem.status = "Pending";
        }

        return {
            status: 201,
            data: {
                success: true,
                reservation,
                supabaseSynced: Boolean(supabaseRes)
            }
        };
    }

    return null;
}

module.exports = { handleRequestRoutes };
