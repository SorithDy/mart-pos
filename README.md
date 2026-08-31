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
    public/              # Current HTML, CSS, and images
    src/
      api/axios.js
      socket.js
  postman/
    Mart-POS.postman_collection.json
  server.js              # Root startup entry point
  package.json
```

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Run the backend in one terminal:

```powershell
npm run start:backend
```

Run the frontend in a second terminal:

```powershell
npm run start:frontend
```

Open `http://localhost:5173`. The backend runs at `http://localhost:3000` and REST endpoints use the `/api` prefix.

Set `MONGO_URL` in `.env` to your MongoDB Atlas connection string. `CORS_ORIGIN` supports comma-separated origins for a separately running frontend.

Run syntax checks with `npm run check`.

## Realtime Events

Socket.io emits `server:ready`, `order:created`, `stock:updated`, `products:changed`, and `payment:updated`.

## Postman

Import `postman/Mart-POS.postman_collection.json` and set `baseUrl` to your backend URL.
