/* ============================================
   HOSPITAL MATCHING & AI RATIONALE CONTROLLER
============================================ */

function matchScore(h, r) {
    const facilityLower = String(r.facility || "general").toLowerCase();
    let bed = h.general;
    if (facilityLower === "icu") bed = h.icu;
    else if (facilityLower === "oxygen") bed = h.oxygen || Math.floor((h.general || 0) * 0.4);

    let score = 0;

    // Category & facility capability match
    const categories = Array.isArray(h.categories) ? h.categories : [];
    const facilities = Array.isArray(h.facilities) ? h.facilities : [];

    if (categories.includes(r.category)) score += 30;
    if (facilities.includes("Emergency")) score += 20;
    if (bed > 0) score += 25;
    if (h.staff > 0) score += 10;

    // Distance & Travel Time factor (Closer is ranked higher)
    const dist = Number(h.distance || 5);
    if (dist <= 5) score += 15;
    else if (dist <= 10) score += 10;
    else score += 5;

    // Load score factor (less loaded is better)
    const icuAvail = Number(h.icu || 0);
    const genAvail = Number(h.general || 0);
    const isUnderHeavyLoad = icuAvail === 0 && genAvail < 3;
    if (!isUnderHeavyLoad) score += 10;

    const travelTime = Math.max(3, Math.ceil((dist / 30) * 60));

    return {
        score: Math.min(100, Math.round(score)),
        eligible: bed > 0 && categories.includes(r.category),
        travelTime
    };
}

function matchesPage() {
    const request = [...data.requests].reverse().find(r =>
        r.owner === (currentUser?.email || "guest")
    );

    if (!request) {
        return `
            ${heading("SMART MATCHING", "Hospital <span>matching.</span>", "Explore suitable hospitals based on live emergency triage requirements.")}
            ${emptyState('Create an emergency request first. <br><br><button class="btn btn-primary" data-go="request">Create emergency request →</button>')}
        `;
    }

    const triage = request.aiAssessment;
    const isRed = triage && (triage.code === "CODE_RED" || triage.severity === "CRITICAL");

    const results = data.hospitals.map(h => ({
        hospital: h,
        ...matchScore(h, request)
    })).filter(x => x.eligible).sort((a, b) => b.score - a.score);

    return `
        ${heading("SMART MATCHING", "Your hospital <span>matches.</span>", "Real-time AI matching based on bed availability, road proximity, and clinical triage.")}
        
        <div class="summary-box" style="position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                <div>
                    <small>PATIENT INTAKE SUMMARY</small>
                    <strong style="font-size: 14px;">${safe(request.patientName)} (${request.age || '--'} yrs) · ${safe(request.category)}</strong>
                    <p style="margin-top: 4px; font-size: 11px;">Origin: <strong>${safe(request.location)}</strong> | Bed Needed: <strong>${safe(request.facility)}</strong></p>
                </div>
                ${triage ? `
                    <span class="ai-code-badge ${isRed ? 'ai-code-red' : 'ai-code-yellow'}" style="font-size: 10px;">
                        ${safe(triage.code || triage.severity)} (${triage.triageScore}/100)
                    </span>
                ` : ""}
            </div>
            ${triage && triage.clinicalSummary ? `
                <p style="margin-top: 8px; font-size: 11px; color: var(--navy); background: rgba(255,255,255,0.7); padding: 8px 12px; border-radius: 6px;">
                    ⚡ <strong>AI Triage Assessment:</strong> ${safe(triage.clinicalSummary)}
                </p>
            ` : ""}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin: 18px 0 12px;">
            <strong style="color: var(--navy); font-size: 13px;">Ranked Destinations (${results.length} Eligible Hospitals)</strong>
            <button class="btn-small btn-light" data-go="navigation">🗺️ Open Interactive Map</button>
        </div>

        <div class="card-grid">
            ${results.length ? results.map((x, idx) => `
                <article class="hospital-card" style="${idx === 0 ? 'border: 2px solid var(--blue); position: relative;' : ''}">
                    ${idx === 0 ? `<div style="position: absolute; top: -10px; right: 14px; background: var(--blue); color: white; padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 800; letter-spacing: 0.5px;">RECOMMENDED DESTINATION</div>` : ''}
                    <div class="card-top">
                        <div style="display: flex; gap: 10px;">
                            <div class="hospital-symbol">✚</div>
                            <div>
                                <h3>${safe(x.hospital.name)}</h3>
                                <p>⌖ ${safe(x.hospital.area)} · <strong>${x.hospital.distance || 4} km (${x.travelTime} min ETA)</strong></p>
                            </div>
                        </div>
                        <span class="status status-matching" style="font-size: 10px; font-weight: 800;">${x.score}% Match</span>
                    </div>

                    <div class="bed-row">
                        <div class="bed-stat"><small>General Beds</small><strong>${x.hospital.general}</strong></div>
                        <div class="bed-stat"><small>ICU Beds</small><strong style="color: var(--red);">${x.hospital.icu}</strong></div>
                        <div class="bed-stat"><small>Medical Staff</small><strong style="color: var(--green);">${x.hospital.staff}</strong></div>
                    </div>

                    <!-- AI Match Justification Rationale -->
                    <div class="ai-rationale-badge">
                        <span>✨</span>
                        <div>
                            <strong>PRAN AI Routing Rationale:</strong>
                            <p style="margin-top: 2px; font-size: 10px; line-height: 1.4;">
                                ${x.hospital.name} has ${x.hospital.icu} verified ICU beds ready, located within ${x.travelTime} mins travel time from ${safe(request.location)}, equipped for acute ${safe(request.category)} triage care.
                            </p>
                        </div>
                    </div>

                    <div class="tags" style="margin-top: 10px;">
                        ${x.hospital.facilities.map(f => `<span class="tag">${safe(f)}</span>`).join("")}
                    </div>

                    <div class="card-actions">
                        <button class="btn-small btn-light" data-map="${x.hospital.id}">➤ Map & Route</button>
                        ${currentRole === "patient" ? `<button class="btn-small btn-success" data-book="${x.hospital.id}">Request Instant Admission</button>` : ""}
                        ${currentRole === "ambulance" ? `<button class="btn-small btn-success" data-assign="${x.hospital.id}">Assign Destination</button>` : ""}
                    </div>
                </article>
            `).join("") : emptyState("No matching hospitals meeting the exact bed & facility criteria at this time.")}
        </div>
    `;
}
