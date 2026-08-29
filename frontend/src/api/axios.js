import axios from "axios";

const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
const runtime = typeof window !== "undefined" ? window.MART_CONFIG : undefined;
const baseURL = String(
  env?.VITE_API_URL || runtime?.API_URL || "http://localhost:3000/api"
).trim();

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json"
  },
  withCredentials: true
});

export default api;
