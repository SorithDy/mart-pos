# Mart POS

Point-of-sale and mart management dashboard built with Node.js, Express, MongoDB Atlas, Axios, Socket.io, and static HTML/CSS/JavaScript.

## Standard Layout

```text
Mart POS/
  backend/
    src/
      models/
      services/
      server.js
  frontend/
    public/              # HTML pages, CSS, and images
    server.js            # Frontend HTTP static server
  run.js                 # Unified startup runner with auto-browser launch
  server.js              # Root startup entry point (runs run.js)
  package.json
```

## Setup & Running

```powershell
npm install
Copy-Item .env.example .env
```

### 🚀 Run Everything (Single Command & Auto-Open Chrome):

```powershell
npm start
```
*(or `npm run dev`)*

This single command starts both the **Backend** and **Frontend**, displays all local & network addresses, and **automatically opens Google Chrome**.

### 🌐 Access Addresses:

| Service | Address | Description |
| :--- | :--- | :--- |
| **Frontend (Local)** | `http://localhost:5173` | Main web application (opens automatically) |
| **Frontend (Network)** | `http://<your-ip>:5173` | Accessible from phones, tablets & other PCs on the same Wi-Fi |
| **Backend REST API** | `http://localhost:3000` | Express API endpoints (`/api/...`) & Socket.io |

#### Direct Page Addresses:
- **POS Terminal**: `http://localhost:5173/POS.html`
- **Login Page**: `http://localhost:5173/login.html`
- **Dashboard**: `http://localhost:5173/Dashboard-page.html`
- **Product Management**: `http://localhost:5173/Product.html`
- **Branch Management**: `http://localhost:5173/Branch.html`

---

### 💻 Or Run in Separate Terminals (Optional):

If you prefer running services independently:

1. **Backend Server**:
   ```powershell
   npm run start:backend
   ```
   Runs at `http://localhost:3000`.

2. **Frontend Server (Auto-opens Chrome)**:
   ```powershell
   npm run start:frontend
   ```
   Runs at `http://localhost:5173` (and network IP).

---

## Configuration & Checks

- Set `MONGO_URL` in `.env` to your MongoDB Atlas connection string.
- `CORS_ORIGIN` supports comma-separated origins for external frontends.
- Run syntax checks anytime with:
  ```powershell
  npm run check
  ```

## Realtime Events

Socket.io emits `server:ready`, `order:created`, `stock:updated`, `products:changed`, and `payment:updated`.

## Postman

Import `postman/Mart-POS.postman_collection.json` and set `baseUrl` to `http://localhost:3000`.
