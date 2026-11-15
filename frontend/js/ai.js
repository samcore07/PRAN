/**
 * PRAN - AI Copilot & Real-Time Clinical Triage Frontend Client
 * Integrates with PRAN Backend Groq AI Endpoints (/api/ai/*)
 */

const API_HOST = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && window.location.port !== "5001"
    ? "http://localhost:5001"
    : "";
const AI_API_BASE = `${API_HOST}/api/ai`;

let aiStatusCache = null;
let copilotMessages = [
    {
        role: "assistant",
        content: "👋 Hello! I am the **PRAN Emergency Medical Copilot** powered by Groq. How can I assist you with clinical triage, first-aid protocols, or hospital bed coordination?"
    }
];

async function checkAiStatus() {
    try {
        const res = await fetch(`${AI_API_BASE}/status`);
        if (res.ok) {
            const data = await res.json();
            aiStatusCache = data;
            return data;
        }
    } catch (e) {
        // Backend might be starting or offline
    }
    return { configured: false, model: "llama-3.3-70b-versatile", provider: "Groq" };
}

/**
 * Run Clinical AI Triage Assessment on patient vitals and symptoms
 */
async function requestAiTriage(patientData) {
    try {
        const res = await fetch(`${AI_API_BASE}/triage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patientData)
        });
        if (res.ok) {
            const result = await res.json();
            return result.assessment;
        }
    } catch (e) {
        console.warn("AI Triage API call failed, using client heuristic:", e);
    }

    // Client-side fallback if backend is unreachable
    const s = (patientData.symptoms || "").toLowerCase();
    const spo2 = Number(patientData.vitals?.spo2) || 98;
    const isCritical = spo2 < 90 || s.includes("chest pain") || s.includes("unconscious") || s.includes("bleeding");
    return {
        source: "client-safety-fallback",
        severity: isCritical ? "CRITICAL" : "URGENT",
        triageScore: isCritical ? 90 : 65,
        code: isCritical ? "CODE_RED" : "CODE_YELLOW",
        recommendedWard: isCritical ? "ICU" : "GENERAL",
        confidence: 85,
        clinicalSummary: `Patient intake evaluated. Emergency severity classified as ${isCritical ? "CRITICAL" : "URGENT"}.`,
        vitalAlerts: spo2 < 92 ? [`Low oxygen saturation: ${spo2}%`] : [],
        immediateActions: [
            "Maintain open airway and position patient comfortably",
            "Monitor vitals continuously every 5 minutes",
            "Prepare for immediate emergency department intake"
        ],
        specialtiesNeeded: [isCritical ? "Intensivist / Trauma Team" : "General Emergency Physician"]
    };
}

/**
 * Send interactive message to PRAN Emergency Medical Copilot
 */
async function sendCopilotQuery(promptText, extraContext = {}) {
    copilotMessages.push({ role: "user", content: promptText });
    renderCopilotMessages();

    const typingIndicator = document.getElementById("copilotTyping");
    if (typingIndicator) typingIndicator.classList.remove("hidden");

    try {
        const res = await fetch(`${AI_API_BASE}/copilot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: copilotMessages,
                context: extraContext
            })
        });

        if (res.ok) {
            const result = await res.json();
            copilotMessages.push({
                role: "assistant",
                content: result.message || "Protocol received. Prioritize patient airway and stability."
            });
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (e) {
        // Fallback emergency answer
        let fallback = "⚠️ Emergency Guidance: Keep the patient calm, seated or lying down in recovery position, and ensure rapid transport to the nearest emergency facility.";
        if (promptText.toLowerCase().includes("cpr")) {
            fallback = "🚨 IMMEDIATE CPR PROTOCOL:\n1. Check responsiveness and carotid pulse.\n2. Place hands on center of chest.\n3. Compress hard and fast: 100-120 beats/min, at least 2 inches deep.\n4. Allow full chest recoil.\n5. Attach AED as soon as available.";
        }
        copilotMessages.push({ role: "assistant", content: fallback });
    } finally {
        if (typingIndicator) typingIndicator.classList.add("hidden");
        renderCopilotMessages();
    }
}

/**
 * Fetch Intelligent Match Explanation for Hospital
 */
async function requestMatchRationale(patient, hospital) {
    try {
        const res = await fetch(`${AI_API_BASE}/match-rationale`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patient, hospital })
        });
        if (res.ok) {
            const data = await res.json();
            return data.rationale;
        }
    } catch (e) {
        // Silent fallback
    }
    return `${hospital.name} is selected based on active bed capacity (${hospital.icu} ICU beds) and fast travel proximity (${hospital.etaMinutes || "10"} mins).`;
}

function makeDraggable(element, handle = element) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let hasMoved = false;

    function onPointerDown(e) {
        const interactive = e.target.closest("button, input, textarea, a");
        if (interactive && interactive !== handle) {
            return;
        }

        isDragging = true;
        hasMoved = false;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        startX = clientX;
        startY = clientY;

        const rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        element.style.right = "auto";
        element.style.bottom = "auto";
        element.style.left = `${initialLeft}px`;
        element.style.top = `${initialTop}px`;

        document.addEventListener("mousemove", onPointerMove);
        document.addEventListener("mouseup", onPointerUp);
        document.addEventListener("touchmove", onPointerMove, { passive: false });
        document.addEventListener("touchend", onPointerUp);
    }

    function onPointerMove(e) {
        if (!isDragging) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
            hasMoved = true;
            if (e.cancelable) e.preventDefault();
        }

        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        const elemWidth = element.offsetWidth;
        const elemHeight = element.offsetHeight;

        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;

        newLeft = Math.max(8, Math.min(winWidth - elemWidth - 8, newLeft));
        newTop = Math.max(8, Math.min(winHeight - elemHeight - 8, newTop));

        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;
    }

    function onPointerUp() {
        if (!isDragging) return;
        isDragging = false;

        document.removeEventListener("mousemove", onPointerMove);
        document.removeEventListener("mouseup", onPointerUp);
        document.removeEventListener("touchmove", onPointerMove);
        document.removeEventListener("touchend", onPointerUp);
    }

    handle.addEventListener("mousedown", onPointerDown);
    handle.addEventListener("touchstart", onPointerDown, { passive: true });

    return {
        hasMoved: () => hasMoved
    };
}

/**
 * UI Renderer for Floating AI Copilot Widget
 */
function initAiCopilotUI() {
    if (document.getElementById("pranAiWidget")) return;

    const widget = document.createElement("div");
    widget.id = "pranAiWidget";
    widget.innerHTML = `
        <!-- Floating Copilot Launch Button -->
        <button id="copilotToggleBtn" class="copilot-launch-btn" title="Open PRAN AI Medical Copilot (Draggable)">
            <span class="copilot-pulse-dot"></span>
            <span class="copilot-btn-icon">⚡</span>
            <span class="copilot-btn-text">AI Copilot</span>
        </button>

        <!-- Slide-out Copilot Panel -->
        <div id="copilotDrawer" class="copilot-drawer hidden">
            <div class="copilot-header" title="Click and drag to reposition copilot">
                <div class="copilot-header-info" style="display:flex;align-items:center;">
                    <span class="copilot-drag-grip" title="Drag to reposition">⋮⋮</span>
                    <div>
                        <span class="copilot-badge">✚ GROQ AI COPILOT</span>
                        <h3>PRAN Emergency Copilot</h3>
                        <small id="copilotAiStatus">Connecting to AI Engine...</small>
                    </div>
                </div>
                <button id="copilotCloseBtn" class="copilot-close-btn" aria-label="Close Copilot">✕</button>
            </div>

            <div class="copilot-quick-chips">
                <button class="copilot-chip" data-prompt="Adult CPR resuscitation steps">🚨 Adult CPR</button>
                <button class="copilot-chip" data-prompt="Chest pain / suspected heart attack pre-hospital care">❤️ Chest Pain</button>
                <button class="copilot-chip" data-prompt="Acute stroke FAST assessment steps">🧠 Stroke (FAST)</button>
                <button class="copilot-chip" data-prompt="Severe traumatic bleeding control protocol">🩸 Bleeding</button>
            </div>

            <div id="copilotChatScroll" class="copilot-messages"></div>

            <div id="copilotTyping" class="copilot-typing hidden">
                <span></span><span></span><span></span> PRAN AI is thinking...
            </div>

            <form id="copilotForm" class="copilot-input-bar">
                <input id="copilotInput" type="text" placeholder="Ask AI triage, first-aid, or hospital queries..." autocomplete="off" required />
                <button type="submit" class="copilot-send-btn">➤</button>
            </form>
        </div>
    `;

    document.body.appendChild(widget);

    // Event listeners
    const toggleBtn = document.getElementById("copilotToggleBtn");
    const closeBtn = document.getElementById("copilotCloseBtn");
    const drawer = document.getElementById("copilotDrawer");
    const header = drawer?.querySelector(".copilot-header");
    const form = document.getElementById("copilotForm");
    const input = document.getElementById("copilotInput");

    if (drawer && header) {
        makeDraggable(drawer, header);
    }

    if (toggleBtn) {
        const btnDrag = makeDraggable(toggleBtn, toggleBtn);
        toggleBtn.addEventListener("click", (e) => {
            if (btnDrag.hasMoved()) {
                e.stopImmediatePropagation();
                return;
            }
            drawer.classList.toggle("hidden");
            if (!drawer.classList.contains("hidden")) {
                renderCopilotMessages();
                updateCopilotStatusText();
                input?.focus();
            }
        });
    }

    closeBtn?.addEventListener("click", () => {
        drawer.classList.add("hidden");
    });

    form?.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        sendCopilotQuery(text);
    });

    document.addEventListener("click", (e) => {
        const chip = e.target.closest(".copilot-chip");
        if (chip) {
            const prompt = chip.dataset.prompt;
            sendCopilotQuery(prompt);
        }
    });

    checkAiStatus().then(updateCopilotStatusText);
}

function updateCopilotStatusText() {
    const el = document.getElementById("copilotAiStatus");
    if (!el) return;
    if (aiStatusCache && aiStatusCache.configured) {
        el.innerHTML = `<span class="status-indicator-green">●</span> Active: ${aiStatusCache.model}`;
    } else {
        el.innerHTML = `<span class="status-indicator-blue">●</span> Running (Groq API ready in .env)`;
    }
}

function renderCopilotMessages() {
    const container = document.getElementById("copilotChatScroll");
    if (!container) return;

    container.innerHTML = copilotMessages.map(m => {
        const isUser = m.role === "user";
        const formatted = (m.content || "")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br>");

        return `
            <div class="copilot-bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}">
                <div class="bubble-sender">${isUser ? 'You' : '⚡ PRAN AI'}</div>
                <div class="bubble-content">${formatted}</div>
            </div>
        `;
    }).join("");

    container.scrollTop = container.scrollHeight;
}

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAiCopilotUI);
} else {
    initAiCopilotUI();
}
