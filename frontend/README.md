# Frontend

The frontend owns the UI and client-side integrations. The current UI is static HTML/CSS/JavaScript under `public/`; `src/` contains reusable API helpers for a future Vite/React migration.

```text
frontend/
  public/
    *.html
    css/
    image/
  src/
    api/axios.js
    socket.js
```

Use `src/api/axios.js` for REST calls such as `/products`, `/categories`, and `/checkout`. Use `src/socket.js` for live notifications.

The static frontend can be deployed separately. Edit `public/runtime-config.js` before deployment:

```js
window.__MART_CONFIG__ = {
  BACKEND_URL: "https://your-backend.example.com",
  API_URL: "https://your-backend.example.com/api",
  SOCKET_URL: "https://your-backend.example.com"
};
```

The runtime config routes `/api` requests and `/image` assets to the backend. The current static UI is still served by the backend at `http://localhost:3000` when `BACKEND_URL` is empty.

For Render, the root `render.yaml` creates both services. The frontend build uses `BACKEND_URL` to generate `public/runtime-config.js` automatically.
