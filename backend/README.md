# Backend

The backend owns the Express REST API, MongoDB models, file uploads, and Socket.io server.

```text
backend/
  src/
    models/
    services/
    server.js
```

REST endpoints use the `/api` prefix and can be tested with the collection in `postman/`.

Configuration is loaded from the root `.env` file: `MONGO_URL` for MongoDB Atlas, `CORS_ORIGIN` for frontend origins, and `PORT` for the server port.

Socket.io events currently include `order:created`, `stock:updated`, `products:changed`, and `payment:updated`.

Start from the project root with `npm start` or `npm run start:backend`.
