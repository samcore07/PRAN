/* ============================================
   HOSPITAL MATCHING COMPONENT CONTROLLER
============================================ */

function matchScore(h, r) {
    const bed = r.facility === "ICU" ? h.icu : h.general;
    let score = 0;

    if (h.categories.includes(r.category)) score += 25;
    if (h.facilities.includes("Emergency")) score += 20;
    if (bed > 0) score += 30;
    if (h.staff > 0) score += 15;

    score += Math.max(0, 10 - h.distance / 2);

    return {
        score: Math.round(score),
        eligible: bed > 0 && h.categories.includes(r.category) && h.facilities.includes("Emergency") && h.staff > 0
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
