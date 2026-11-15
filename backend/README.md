# PRAN Backend API

RESTful API backend for the **PRAN (Patient Response & Admission Network)** emergency coordination platform.

## Features
- **Zero-dependency runtime**: Runs directly with Node.js built-in modules (`node server.js`).
- **RESTful Endpoints**: Authentication, hospital directory, bed management, patient emergency intake, and reservations.
- **CORS enabled**: Ready for integration with any web frontend or mobile client.
- **Persistent storage**: Stores live state in `data/db.json`.

---

## Getting Started

### 1. Run the Server
```bash
node server.js
```
The server will start on `http://localhost:5001`.

To specify a custom port:
```bash
PORT=8000 node server.js
```

---

## API Endpoints

### Health & Info
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` or `/api/health` | Service health status and endpoint list |

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login with email and password |
| `POST` | `/api/auth/guest` | Enter demo mode as guest user |

### Hospitals & Capacity
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/hospitals` | List all connected hospitals and bed counts |
| `GET` | `/api/hospitals/:id` | Get single hospital details |
| `PUT` | `/api/hospitals/:id/capacity` | Update general, ICU, and staff availability |

### Emergency Requests & Reservations
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/requests` | List all emergency requests |
| `POST` | `/api/requests` | Submit a new patient emergency request |
| `GET` | `/api/requests/:id` | Get details of a specific request |
| `PUT` | `/api/requests/:id/status` | Update status (`Pending`, `Accepted`, `Rejected`) or assign hospital |
