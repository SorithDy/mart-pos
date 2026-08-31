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
  "/low-stock": "/LowStock.html"
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

server.listen(port, "0.0.0.0", () => {
  console.log(`Frontend running at http://localhost:${port}`);
});
