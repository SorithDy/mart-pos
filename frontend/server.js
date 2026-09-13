const fs = require("fs");
const http = require("http");
const path = require("path");

const publicDir = path.join(__dirname, "public");
const port = Number(process.env.FRONTEND_PORT) || 5173;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const pageRoutes = {
  "/login": "/login.html",
  "/Dashboard-page": "/Dashboard-page.html",
  "/dashboard": "/Dashboard-page.html",
  "/products": "/Product.html",
  "/categories": "/ProductCategory.html",
  "/staff": "/Staff.html",
  "/pos": "/POS.html",
  "/sales": "/SalesDetails.html",
  "/receipts": "/ReceiptHistory.html",
  "/promotions": "/Promotions.html",
  "/profile": "/Profile.html",
  "/account": "/Account.html",
  "/low-stock": "/LowStock.html",
  "/branch": "/Branch.html",
  "/branches": "/Branch.html"
};

const server = http.createServer((req, res) => {
  const requestedPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const requestPath = pageRoutes[requestedPath] || requestedPath;
  const relativePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.resolve(publicDir, `.${relativePath}`);

  if (!filePath.startsWith(`${publicDir}${path.sep}`)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

const { exec } = require("child_process");

function openInChrome(url) {
  if (process.env.NO_AUTO_OPEN === "true") return;

  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";

  const cmd = isWin
    ? `start chrome "${url}"`
    : isMac
    ? `open -a "Google Chrome" "${url}"`
    : `google-chrome "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      const fallback = isWin
        ? `start "" "${url}"`
        : isMac
        ? `open "${url}"`
        : `xdg-open "${url}"`;
      exec(fallback, () => {});
    }
  });
}

const os = require("os");

function getNetworkIp() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      if (name.toLowerCase().includes("vmnet") || name.toLowerCase().includes("virtual") || name.toLowerCase().includes("wsl")) continue;
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
  } catch (_) {}
  return "localhost";
}

server.listen(port, "0.0.0.0", () => {
  const localUrl = `http://localhost:${port}`;
  const networkIp = getNetworkIp();
  const networkUrl = `http://${networkIp}:${port}`;

  console.log(`\x1b[32m✔ Frontend Server running:\x1b[0m`);
  console.log(`  ➜ Local:   \x1b[36m${localUrl}\x1b[0m`);
  if (networkIp !== "localhost") {
    console.log(`  ➜ Network: \x1b[36m${networkUrl}\x1b[0m`);
  }
  openInChrome(localUrl);
});
