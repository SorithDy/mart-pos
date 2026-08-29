const fs = require("fs");
const path = require("path");

const backendUrl = String(process.env.BACKEND_URL || "").trim().replace(/\/+$/, "");
const config = `window.__MART_CONFIG__ = {
  BACKEND_URL: ${JSON.stringify(backendUrl)},
  API_URL: ${JSON.stringify(backendUrl ? backendUrl + "/api" : "")},
  SOCKET_URL: ${JSON.stringify(backendUrl)}
};
`;

fs.writeFileSync(path.join(__dirname, "public", "runtime-config.js"), config, "utf8");
console.log(`Frontend configured for ${backendUrl || "same-origin API"}`);
