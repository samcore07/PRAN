# PRAN Frontend Architecture

Modular frontend component architecture for the **PRAN (Patient Response & Admission Network)** emergency coordination platform.

---

## Directory Structure

```
frontend/
├── index.html                   # Modular frontend entry point
├── README.md                    # Documentation
├── html/                        # Component markup & templates
│   ├── login.html               # Authentication screen markup
│   ├── role-selection.html      # Role selection workspace markup
│   ├── app-shell.html           # Main application shell (sidebar, topbar, toast)
│   ├── overview.html            # Role dashboard overview templates
│   ├── emergency-request.html   # Patient emergency intake form template
│   ├── bed-availability.html    # Hospital directory & bed search template
│   ├── hospital-matching.html   # Smart matching recommendations template
│   ├── reservations.html        # Reservations & admission tracking template
│   ├── navigation.html          # Hospital map navigation template
│   └── bed-management.html      # Bed capacity management template
├── css/                         # Component stylesheets
│   ├── main.css                 # Global base styles, variables & buttons
│   ├── login.css                # Authentication screen styling
│   ├── role-selection.css       # Role cards and grid styling
│   ├── app-shell.css            # Sidebar, topbar, drawer & toast styling
│   ├── overview.css             # Stats grid, hero panels & quick cards
│   ├── emergency-request.css    # Form grid, field inputs & request cards
│   ├── bed-availability.css     # Hospital cards, bed badges & tags
│   ├── hospital-matching.css    # Summary boxes & match percentage badges
│   ├── reservations.css         # Reservation cards & tables
│   ├── navigation.css           # Map simulation panel & pin
│   └── bed-management.css       # Capacity controls and metrics
└── js/                          # Component controllers & logic
    ├── main.js                  # Global application state, routing & dispatcher
    ├── login.js                 # Authentication & guest login logic
    ├── role-selection.js        # Role selection & workspace switcher
    ├── app-shell.js             # Navigation menu generator & shell events
    ├── overview.js              # Role-specific dashboard view renderers
    ├── emergency-request.js     # Patient intake form submission & validation
    ├── bed-availability.js      # Bed availability filter & hospital card renderer
    ├── hospital-matching.js     # Hospital scoring & recommendation algorithm
    ├── reservations.js          # Admission reservation actions & approval logic
    ├── navigation.js            # Google Maps integration & destination selector
    └── bed-management.js        # Hospital bed capacity updater & request inbox
```

---

## Component Mapping Matrix

Every page/section is decoupled and organized across the three respective directories:

| Component / Section | HTML File (`frontend/html/`) | CSS File (`frontend/css/`) | JS File (`frontend/js/`) |
|---|---|---|---|
| **Global Base** | `index.html` (entry) | `main.css` | `main.js` |
| **Authentication** | `login.html` | `login.css` | `login.js` |
| **Role Selection** | `role-selection.html` | `role-selection.css` | `role-selection.js` |
| **App Shell & Layout**| `app-shell.html` | `app-shell.css` | `app-shell.js` |
| **Overview Dashboards**| `overview.html` | `overview.css` | `overview.js` |
| **Emergency Request** | `emergency-request.html` | `emergency-request.css` | `emergency-request.js` |
| **Bed Availability** | `bed-availability.html` | `bed-availability.css` | `bed-availability.js` |
| **Hospital Matching** | `hospital-matching.html` | `hospital-matching.css` | `hospital-matching.js` |
| **Reservations** | `reservations.html` | `reservations.css` | `reservations.js` |
| **Navigation & Map** | `navigation.html` | `navigation.css` | `navigation.js` |
| **Bed Management** | `bed-management.html` | `bed-management.css` | `bed-management.js` |

---

## Running the Frontend

You can open `frontend/index.html` directly in any web browser, or serve it using any local static server:
```bash
npx serve frontend
# or
python3 -m http.server 3000 --directory frontend
```
