# PRAN - Patient Routing & Admission Network
> **Real-time Emergency Healthcare Coordination, Multi-Factor Hospital Bed Routing, and AI-Powered Clinical Triage**

[![Vercel Deployment](https://img.shields.io/badge/Deployment-Vercel%20Serverless-black?logo=vercel)](https://vercel.com)
[![Leaflet GIS](https://img.shields.io/badge/Maps-Leaflet%20OSM-199900?logo=openstreetmap)](https://leafletjs.com)
[![Database](https://img.shields.io/badge/Database-Supabase%20Postgres-3ECF8E?logo=supabase)](https://supabase.com)
[![AI Engine](https://img.shields.io/badge/AI%20Inference-Groq%20Cloud-f55036)](https://groq.com)

---

## 📌 Overview

**PRAN** is an emergency healthcare operating system designed to eliminate the "Golden-Hour" bottlenecks during medical emergencies. It provides real-time visibility into ICU and general bed availability, automated clinical triage, live ambulance cockpit telemetry, and geospatial hospital routing.

---

## 🚀 Key Features

### 1. 🗺️ Interactive GIS Mapping & Navigation
- Powered by **Leaflet.js** and **OpenStreetMap (OSM)** tiles.
- Geodesic distance and urban ETA calculations via the **Haversine formula**.
- Dynamic polyline route plotting, color-coded hospital capacity badges, and automated bounding-box zoom (`fitBounds`).

### 2. 🏥 Multi-Factor Hospital Matching Algorithm
Computes an objective suitability score ($0 - 100$) for every hospital in the network:
$$\text{Score} = S_{\text{distance}} (30) + S_{\text{bed}} (30) + S_{\text{load}} (20) + S_{\text{critical}} (20)$$
- **Distance Factor:** Favors facilities within $5\text{ km}$ to minimize transit time.
- **Bed Availability Factor:** Dynamically checks real-time ICU/General bed availability.
- **Hospital Load Factor:** Balances admissions to prevent emergency department overcrowding.
- **Golden-Hour Critical Bonus:** Immediate 20-point boost for life-threatening emergencies with ETA $\le 15\text{ mins}$.

### 3. 🧠 Clinical AI Emergency Triage
- Powered by **Groq Ultra-Low Latency Inference** (`openai/gpt-oss-20b` / `openai/gpt-oss-120b`).
- Instantaneous assessment (<0.2s) of vitals (SpO2, heart rate, BP, AVPU) into `CODE_RED`, `CODE_YELLOW`, or `CODE_GREEN`.
- **Failsafe Offline Engine:** Built-in deterministic clinical heuristics ensure patient safety even if network connectivity is lost.

### 4. 💬 Draggable AI Emergency Copilot
- Mobile-responsive floating assistant with quick emergency protocol chips (*Adult CPR*, *Chest Pain*, *Stroke FAST*, *Severe Bleeding*).
- Real-time clinical guidance for EMTs, paramedics, attendants, and emergency callers.

### 5. 🚑 Ambulance Driver Cockpit Simulator
- **Live Telemetry HUD:** Fuel level, oxygen tank pressure ($1,850\text{ PSI}$), AED defibrillator readiness, and climate control.
- **Web Audio Siren:** Hardware-accelerated dual-tone emergency siren synthesis using native browser `AudioContext` (no external audio files required).
- **4-Stage Mission Lifecycle:** `Available` &rarr; `Dispatched` &rarr; `On-Scene` &rarr; `In-Transit` &rarr; `ER Handover & Bed Deduction` with automated token generation (`PRAN-ER-XXXX`).

### 6. ⚡ Real-Time Database Sync
- Backed by **Supabase PostgreSQL** with an offline-first browser `LocalStorage` fallback cache.

---

## 🛠️ Architecture & Tech Stack

```
+---------------------------------------------------------------------------------+
|                                 CLIENT TIER                                     |
|  [Responsive Single-Page App - HTML5, CSS3, Vanilla ES6+, Web Audio API]        |
|  - Leaflet.js GIS Mapping + OpenStreetMap Raster Tiles                          |
|  - Draggable AI Copilot Widget + Markdown Formatter                             |
|  - Ambulance Driver Cockpit Simulator (Telemetry HUD & Mission FSM)             |
|  - Offline-First LocalStorage Sync Cache (pran_hospitals, pran_requests)        |
+---------------------------------------------------------------------------------+
                                      |
                     RESTful JSON API | Vercel Rewrite
                                      v
+---------------------------------------------------------------------------------+
|                           SERVERLESS BACKEND TIER                               |
|                     [Node.js 18+ on Vercel Serverless]                          |
|  - /api/health              : System health and DB connectivity                 |
|  - /api/ai/copilot          : Interactive emergency copilot chat               |
|  - /api/ai/triage           : Structured clinical triage assessment             |
|  - /api/ai/status           : Groq model and diagnostic status                  |
|  - /api/ai/match-rationale  : Clinical routing explanations                     |
|  - /api/index.js            : Hospital & reservation CRUD master router         |
+---------------------------------------------------------------------------------+
                     |                                       |
                     v                                       v
+-----------------------------------------+   +-----------------------------------+
|              DATABASE                   |   |             AI ENGINE             |
|        [Supabase PostgreSQL]            |   |         [Groq Cloud API]          |
|  - Hospitals & Bed Capacity             |   |  - openai/gpt-oss-20b             |
|  - Emergency Intake Requests            |   |  - Multi-model cascading fallback |
+-----------------------------------------+   +-----------------------------------+
```

---

## ⚙️ Environment Variables

Configure the following variables in your local `.env` or Vercel Project Settings:

| Variable | Description | Recommended Default |
|---|---|---|
| `GROQ_API_KEY` | Your Groq Cloud API Key | `gsk_...` |
| `GROQ_MODEL` | Active production model ID | `openai/gpt-oss-20b` |
| `SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase public anonymous API key | `eyJhbGci...` |

---

## 🚦 Local Development

```bash
# 1. Clone the repository
git clone https://github.com/samcore07/PRAN.git
cd PRAN

# 2. Install dependencies
npm install
cd backend && npm install && cd ..

# 3. Start local development server
npm start
```
The app will be accessible at `http://localhost:5001`.

---

## 📄 License
MIT License. Built for emergency healthcare logistics and rapid pre-hospital clinical response.
