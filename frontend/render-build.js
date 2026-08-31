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

// Prevent browsers and the CDN from reusing a runtime config from an older deploy.
const cacheVersion = Date.now().toString();
for (const fileName of fs.readdirSync(path.join(__dirname, "public"))) {
  if (!fileName.toLowerCase().endsWith(".html")) continue;

  const filePath = path.join(__dirname, "public", fileName);
  const html = fs.readFileSync(filePath, "utf8");
  const updatedHtml = html.replace(
    /runtime-config\.js(?:\?v=[^\"']*)?/g,
    `runtime-config.js?v=${cacheVersion}`
  );

  if (updatedHtml !== html) {
    fs.writeFileSync(filePath, updatedHtml, "utf8");
  }
}

console.log(`Frontend configured for ${backendUrl || "same-origin API"}`);
