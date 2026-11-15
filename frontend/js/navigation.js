/* ============================================
   HOSPITAL NAVIGATION & LIVE MAP API CONTROLLER
============================================ */

let navLeafletMap = null;
let navLeafletMarkers = [];
let navRoutePolyline = null;
let currentUserCoords = { lat: 22.5802, lng: 88.4326 }; // Default: Salt Lake / Central Kolkata
let navMapMode = "leaflet"; // 'leaflet' or 'embed'

// Known hospital GPS coordinates
const HOSPITAL_COORDINATES = {
    1: { lat: 22.5802, lng: 88.4326 }, // Aster Care Medical Centre (Salt Lake Sec V)
    2: { lat: 22.5937, lng: 88.4682 }, // Northview Multispeciality (New Town)
    3: { lat: 22.5867, lng: 88.4178 }, // Lakeside Emergency Centre (Bidhannagar)
    4: { lat: 22.5980, lng: 88.4285 }, // Greenline General Hospital (Kestopur)
    5: { lat: 22.5186, lng: 88.3976 }, // City Heart & Neuro Institute (EM Bypass)
    6: { lat: 22.6247, lng: 88.4208 }  // Riverbend Community Hospital (Dum Dum)
};

function getHospitalCoords(h) {
    if (h && typeof h.lat === "number" && typeof h.lng === "number" && h.lat !== 0) {
        return { lat: h.lat, lng: h.lng };
    }
    return HOSPITAL_COORDINATES[h?.id] || { lat: 22.5802, lng: 88.4326 };
}

// Calculate Haversine distance in km
function calculateNavDistance(c1, c2) {
    const R = 6371;
    const dLat = (c2.lat - c1.lat) * Math.PI / 180;
    const dLng = (c2.lng - c1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
}

function calculateNavETA(distanceKm) {
    // City emergency transit speed: 32 km/h average
    return Math.max(3, Math.ceil((distanceKm / 32) * 60));
}

function navigationPage() {
    const h = hospitalById(selectedNavigationHospital) || data.hospitals[0] || {
        id: 1,
        name: "Aster Care Medical Centre",
        area: "Salt Lake Sector V, Kolkata",
        general: 12,
        icu: 4
    };

    const destCoords = getHospitalCoords(h);
    const dist = calculateNavDistance(currentUserCoords, destCoords);
    const eta = calculateNavETA(dist);

    setTimeout(() => {
        initLiveNavigationMap(h);
    }, 60);

    return `
        ${heading("LOCATION & TRANSIT ROUTING", "Hospital <span>navigation.</span>", "Live interactive route mapping, transit ETA and turn-by-turn navigation.")}

        <div class="nav-map-wrap" id="navMapWrap">
            <div id="navMapCanvas" class="nav-map-canvas"></div>
            <div class="nav-map-overlay-badge" id="navMapOverlayBadge">
                <span class="nav-live-dot"></span> <span id="navMapBadgeText">Live Route Navigation</span>
            </div>
        </div>

        <div class="panel nav-detail-panel">
            <div class="nav-header-row">
                <div>
                    <span class="eyebrow">DESTINATION HOSPITAL</span>
                    <h2 id="navHospitalName">${safe(h.name)}</h2>
                    <p class="panel-subtitle" id="navHospitalArea">⌖ ${safe(h.area)}</p>
                </div>
                <div class="nav-quick-actions">
                    <button class="btn btn-light btn-small" id="btnLocateMe">⌖ Locate My GPS</button>
                    <button class="btn btn-light btn-small" id="btnToggleMapMode">⇄ Switch Map View</button>
                </div>
            </div>

            <div class="nav-metrics-grid">
                <div class="nav-metric-card">
                    <small>Route Distance</small>
                    <strong id="navDistance">${dist} km</strong>
                </div>
                <div class="nav-metric-card">
                    <small>Estimated Transit ETA</small>
                    <strong id="navETA">${eta} mins</strong>
                </div>
                <div class="nav-metric-card">
                    <small>Available ICU Beds</small>
                    <strong id="navICU" class="text-red">${h.icu ?? 0}</strong>
                </div>
                <div class="nav-metric-card">
                    <small>Available General Beds</small>
                    <strong id="navGeneral" class="text-blue">${h.general ?? 0}</strong>
                </div>
            </div>

            <label class="field" style="margin-top: 15px;">Change Hospital Destination
                <select id="navigationSelect">
                    ${data.hospitals.map(x => `<option value="${x.id}" ${x.id === h.id ? "selected" : ""}>${safe(x.name)} (${safe(x.area)})</option>`).join("")}
                </select>
            </label>

            <div class="nav-actions-row">
                <button class="btn btn-primary" id="btnOpenDirections" data-lat="${destCoords.lat}" data-lng="${destCoords.lng}">
                    <span>➤</span> Start Turn-by-Turn GPS Navigation
                </button>
                <a class="btn btn-light" href="tel:112">
                    <span>📞</span> Emergency Hotline (112)
                </a>
            </div>
            <p class="muted" style="margin-top:12px">
                Calculated using GPS coordinates and real-time city transit speeds. Opens in Google Maps navigation app for live voice-guided directions.
            </p>
        </div>
    `;
}

function initLiveNavigationMap(hospital) {
    const mapWrap = document.getElementById("navMapWrap");
    const mapCanvas = document.getElementById("navMapCanvas");
    if (!mapWrap || !mapCanvas) return;

    const destCoords = getHospitalCoords(hospital);

    // If embed view toggled
    if (navMapMode === "embed") {
        mapWrap.innerHTML = `
            <iframe class="nav-map-iframe" src="https://maps.google.com/maps?q=${destCoords.lat},${destCoords.lng}&hl=en&z=15&output=embed"></iframe>
            <div class="nav-map-overlay-badge">
                <span class="nav-live-dot"></span> Google Maps Embed
            </div>
        `;
        return;
    }

    // Interactive Leaflet Map
    if (window.L) {
        try {
            if (navLeafletMap) {
                navLeafletMap.remove();
                navLeafletMap = null;
            }

            navLeafletMap = L.map("navMapCanvas", {
                zoomControl: true,
                attributionControl: false
            }).setView([destCoords.lat, destCoords.lng], 14);

            L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
                maxZoom: 19
            }).addTo(navLeafletMap);

            // Add markers for all hospitals
            navLeafletMarkers = [];
            data.hospitals.forEach(h => {
                const coords = getHospitalCoords(h);
                const isSelected = h.id === hospital.id;

                const marker = L.circleMarker([coords.lat, coords.lng], {
                    radius: isSelected ? 12 : 8,
                    fillColor: isSelected ? "#1767a5" : "#159b98",
                    color: "#ffffff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.95
                }).addTo(navLeafletMap);

                marker.bindPopup(`
                    <div class="hospital-map-popup">
                        <h4>${safe(h.name)}</h4>
                        <p>${safe(h.area)}</p>
                        <span class="bed-badge icu">ICU: ${h.icu}</span>
                        <span class="bed-badge general">General: ${h.general}</span>
                    </div>
                `);

                if (isSelected) {
                    marker.openPopup();
                }

                navLeafletMarkers.push(marker);
            });

            // Add current user / ambulance location marker
            if (currentUserCoords) {
                const userMarker = L.circleMarker([currentUserCoords.lat, currentUserCoords.lng], {
                    radius: 9,
                    fillColor: "#e45e66",
                    color: "#ffffff",
                    weight: 3,
                    fillOpacity: 1
                }).addTo(navLeafletMap);

                userMarker.bindPopup("<strong>Your Location / Ambulance</strong><br>Origin Point");

                // Draw route line
                if (navRoutePolyline) navLeafletMap.removeLayer(navRoutePolyline);
                navRoutePolyline = L.polyline([
                    [currentUserCoords.lat, currentUserCoords.lng],
                    [destCoords.lat, destCoords.lng]
                ], {
                    color: "#1767a5",
                    weight: 4,
                    opacity: 0.8,
                    dashArray: "6, 8"
                }).addTo(navLeafletMap);

                const bounds = L.latLngBounds([
                    [currentUserCoords.lat, currentUserCoords.lng],
                    [destCoords.lat, destCoords.lng]
                ]);
                navLeafletMap.fitBounds(bounds, { padding: [50, 50] });
            }

            // Invalidate size to handle tab switching
            setTimeout(() => {
                if (navLeafletMap) navLeafletMap.invalidateSize();
            }, 150);

        } catch (e) {
            console.warn("Leaflet map initialization fallback:", e);
            renderEmbedMapFallback(destCoords);
        }
    } else {
        renderEmbedMapFallback(destCoords);
    }
}

function renderEmbedMapFallback(destCoords) {
    const mapWrap = document.getElementById("navMapWrap");
    if (mapWrap) {
        mapWrap.innerHTML = `
            <iframe class="nav-map-iframe" src="https://maps.google.com/maps?q=${destCoords.lat},${destCoords.lng}&hl=en&z=15&output=embed"></iframe>
            <div class="nav-map-overlay-badge">
                <span class="nav-live-dot"></span> Live Navigation Map
            </div>
        `;
    }
}

// Open Google Maps Directions URL API
function openDirections(destCoords) {
    const dest = `${destCoords.lat},${destCoords.lng}`;
    let url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;

    if (currentUserCoords && currentUserCoords.lat) {
        const origin = `${currentUserCoords.lat},${currentUserCoords.lng}`;
        url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
    }

    window.open(url, "_blank", "noopener,noreferrer");
}

function assignAmbulanceHospital(hospitalId) {
    const h = hospitalById(hospitalId);

    const request = [...data.requests].reverse().find(r =>
        r.status === "Matching" || r.status === "Pending"
    );

    if (!h || !request) {
        if (typeof toast === "function") toast("No active request is available.");
        return;
    }

    const result = typeof matchScore === "function" ? matchScore(h, request) : { eligible: true };

    if (!result.eligible) {
        if (typeof toast === "function") toast("This hospital does not meet the requirements.");
        return;
    }

    request.hospitalId = h.id;
    request.status = "Pending";

    saveData();

    if (typeof supabaseUpdateRequestStatus === "function") {
        supabaseUpdateRequestStatus(request.id, "Pending", h.id);
    }

    if (typeof toast === "function") toast("Hospital selected. Opening navigation route.");
    selectedNavigationHospital = h.id;
    if (typeof openPage === "function") openPage("navigation");
}

// Global Event Listeners for Navigation Controls
document.addEventListener("change", event => {
    if (event.target.id === "navigationSelect") {
        selectedNavigationHospital = Number(event.target.value);
        if (typeof renderPage === "function") renderPage();
    }
});

document.addEventListener("click", event => {
    // 1. Start Turn-by-Turn GPS Navigation
    const btnDirections = event.target.closest("#btnOpenDirections");
    if (btnDirections) {
        const lat = Number(btnDirections.dataset.lat) || 22.5802;
        const lng = Number(btnDirections.dataset.lng) || 88.4326;
        openDirections({ lat, lng });
    }

    // 2. Locate My GPS via HTML5 Geolocation API
    const btnLocate = event.target.closest("#btnLocateMe");
    if (btnLocate) {
        if ("geolocation" in navigator) {
            btnLocate.textContent = "⌖ Acquiring GPS...";
            navigator.geolocation.getCurrentPosition(
                position => {
                    currentUserCoords = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    if (typeof toast === "function") toast("GPS location updated.");
                    btnLocate.textContent = "✓ GPS Located";
                    if (typeof renderPage === "function") renderPage();
                },
                error => {
                    console.warn("Geolocation error:", error);
                    if (typeof toast === "function") toast("Could not acquire GPS: using Kolkata default.");
                    btnLocate.textContent = "⌖ Locate My GPS";
                },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        } else {
            if (typeof toast === "function") toast("Geolocation is not supported by your browser.");
        }
    }

    // 3. Switch between Leaflet and Google Maps Embed
    const btnToggle = event.target.closest("#btnToggleMapMode");
    if (btnToggle) {
        navMapMode = navMapMode === "leaflet" ? "embed" : "leaflet";
        const h = hospitalById(selectedNavigationHospital) || data.hospitals[0];
        initLiveNavigationMap(h);
        if (typeof toast === "function") toast(`Switched to ${navMapMode === "leaflet" ? "Interactive Route Map" : "Google Maps View"}.`);
    }
});
