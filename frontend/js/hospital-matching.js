/* ============================================
   HOSPITAL MATCHING COMPONENT CONTROLLER
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

    return {
        score: Math.min(100, Math.round(score)),
        eligible: bed > 0 && categories.includes(r.category),
        travelTime: Math.max(3, Math.ceil((dist / 30) * 60))
    };
}

function matchesPage() {
    const request = [...data.requests].reverse().find(r =>
        r.owner === (currentUser?.email || "guest")
    );

    if (!request) {
        return `
            ${heading("SMART MATCHING", "Hospital <span>matching.</span>", "Explore suitable sample hospitals based on emergency requirements.")}
            ${emptyState('Create an emergency request first. <br><br><button class="btn btn-primary" data-go="request">Create request</button>')}
        `;
    }

    const results = data.hospitals.map(h => ({
        hospital: h,
        ...matchScore(h, request)
    })).filter(x => x.eligible).sort((a, b) => b.score - a.score);

    return `
        ${heading("SMART MATCHING", "Your hospital <span>matches.</span>", "Compare the sample hospitals that meet the selected requirements.")}
        <div class="summary-box">
            <small>YOUR REQUEST</small>
            <strong>${safe(request.patientName)} · ${safe(request.category)} · ${safe(request.facility)} bed</strong>
            <p>${safe(request.location)}</p>
        </div>
        <p class="muted" style="margin-bottom:13px">Illustrative ranking only. It is not a clinically validated recommendation.</p>
        <div class="card-grid">
            ${results.length ? results.map(x => hospitalCard(x.hospital, true, x.score)).join("") : emptyState("No matching sample hospital found. Check the bed availability page.")}
        </div>
    `;
}
