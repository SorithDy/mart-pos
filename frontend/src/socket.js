import { io } from "socket.io-client";

const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
const runtime = typeof window !== "undefined" ? window.MART_CONFIG : undefined;
const socketURL = String(
  env?.VITE_SOCKET_URL ||
  env?.VITE_API_URL?.replace(/\/api\/?$/, "") ||
    runtime?.SOCKET_URL ||
    "http://localhost:3000"
).trim();

export const socket = io(socketURL, {
  withCredentials: true,
  transports: ["websocket", "polling"]
});

export default socket;
