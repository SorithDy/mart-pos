// ======================================================
// MART MANAGEMENT SYSTEM - SERVER
// Login + Dashboard + Products + Categories + Staff
// Sales Details + Receipt History + POS Checkout + Promotions
// + KHQR / ABA Generate + Status + Mock Paid (MongoDB)
// ======================================================

const path = require("path");
const { mongoUrl: configuredMongoUrl, port: configuredPort } = require("./config/env");

const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dns = require("dns");
const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");
const axios = require("axios");
const { BakongKHQR, khqrData, MerchantInfo } = require("bakong-khqr");
const { initRealtime, emitRealtime } = require("./services/realtime");

const app = express();
const server = http.createServer(app);

const corsOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors(
    corsOrigins.length
      ? { origin: corsOrigins, credentials: true }
      : { origin: true, credentials: true }
  )
);
app.use(express.json());

// Interactive API Gateway & Documentation Portal for browsers, protected with HTTP Basic Auth
const dashboardHtmlPath = path.join(__dirname, "views", "api-dashboard.html");
const postmanFilePath = path.join(__dirname, "..", "..", "postman", "Mart-POS.postman_collection.json");

const docsUser = process.env.DOCS_USER || "admin";
const docsPassword = process.env.DOCS_PASSWORD || "admin123";
// Option 2: Require authentication on production by default, or whenever DOCS_AUTH_REQUIRED is true.
const isProduction = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const isDocsAuthRequired = process.env.DOCS_AUTH_REQUIRED !== undefined
  ? String(process.env.DOCS_AUTH_REQUIRED).trim().toLowerCase() === "true"
  : isProduction;

function requireDocsAuth(req, res, next) {
  const wantsJson = req.query.format === "json" ||
    (req.headers.accept && req.headers.accept.includes("application/json") && !req.headers.accept.includes("text/html"));

  // Programmatic API checks (e.g. curl or monitoring) receive safe JSON without challenging Basic Auth
  if (wantsJson) {
    return res.json({
      name: "Mart POS Backend",
      status: "ok",
      api: "/api"
    });
  }

  // When authentication is required, challenge the browser with HTTP Basic Auth
  if (isDocsAuthRequired) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Mart POS API Explorer"');
      return res.status(401).send(`
        <!DOCTYPE html>
        <html>
        <head><title>401 Unauthorized</title><style>body{background:#090d16;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}div{text-align:center;padding:2rem;background:#0f172a;border-radius:12px;border:1px solid #1e293b;}</style></head>
        <body>
          <div>
            <h2>🔒 Authentication Required</h2>
            <p style="color:#94a3b8;margin-top:0.5rem;">Please log in with your Admin credentials to access the API Explorer.</p>
          </div>
        </body>
        </html>
      `);
    }

    try {
      const b64 = authHeader.slice(6).trim();
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      const colonIdx = decoded.indexOf(":");
      const username = colonIdx !== -1 ? decoded.slice(0, colonIdx) : decoded;
      const password = colonIdx !== -1 ? decoded.slice(colonIdx + 1) : "";

      if (username !== docsUser || password !== docsPassword) {
        res.setHeader("WWW-Authenticate", 'Basic realm="Mart POS API Explorer"');
        return res.status(401).send(`
          <!DOCTYPE html>
          <html>
          <head><title>401 Unauthorized</title><style>body{background:#090d16;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}div{text-align:center;padding:2rem;background:#0f172a;border-radius:12px;border:1px solid #1e293b;}</style></head>
          <body>
            <div>
              <h2 style="color:#fb7185;">⛔ Invalid Credentials</h2>
              <p style="color:#94a3b8;margin-top:0.5rem;">The username or password you entered is incorrect.</p>
            </div>
          </body>
          </html>
        `);
      }
    } catch (_) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Mart POS API Explorer"');
      return res.status(401).send("Authentication error.");
    }
  }

  next();
}

app.get(["/", "/docs", "/api-docs"], requireDocsAuth, (req, res) => {
  if (fs.existsSync(dashboardHtmlPath)) {
    return res.sendFile(dashboardHtmlPath);
  }

  res.json({
    name: "Mart POS Backend",
    status: "ok",
    api: "/api"
  });
});

app.get("/api/docs/postman", requireDocsAuth, (req, res) => {
  if (fs.existsSync(postmanFilePath)) {
    return res.download(postmanFilePath, "Mart-POS.postman_collection.json");
  }
  res.status(404).json({ message: "Not found" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Use reliable DNS resolvers for MongoDB Atlas SRV records. Override with
// DNS_SERVERS when the current network requires its own DNS servers.
const dnsServers = String(process.env.DNS_SERVERS || "1.1.1.1,8.8.8.8")
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);
if (dnsServers.length) dns.setServers(dnsServers);

// Keep uploaded product images available when the frontend runs separately.
app.use(
  "/image",
  express.static(path.join(__dirname, "..", "..", "frontend", "public", "image"))
);

// ======================================================
// MODELS
// ======================================================
const repositories = require("./repositories");
const {
  Product,
  Customer,
  Sale,
  Employee,
  Promotion,
  KHQRGenerate,
  Login,
  Receipt,
  ProductCategory
} = repositories;

const PORT = configuredPort;
const PASSWORD_HASH_PREFIX = "pbkdf2";
const PASSWORD_HASH_ITERATIONS = Number(process.env.PASSWORD_HASH_ITERATIONS) || 120000;
const PASSWORD_HASH_KEYLEN = 64;
const PASSWORD_HASH_DIGEST = "sha512";

// ======================================================
// IMAGE UPLOAD
// ======================================================
const imageDir = path.join(__dirname, "..", "..", "frontend", "public", "image");
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir, { recursive: true });
}
const staffImageDir = path.join(imageDir, "Staff-Image");
if (!fs.existsSync(staffImageDir)) {
  fs.mkdirSync(staffImageDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imageDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "-");
    cb(null, Date.now() + "-" + safe);
  }
});

const upload = multer({ storage });
const staffImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, staffImageDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "-");
    cb(null, Date.now() + "-" + safe);
  }
});
const uploadStaffImage = multer({ storage: staffImageStorage });

const { registerApiRoutes } = require("./routes");

registerApiRoutes(app, {
  repositories,
  Product,
  Customer,
  Sale,
  Employee,
  Promotion,
  KHQRGenerate,
  Login,
  Receipt,
  ProductCategory,
  upload,
  uploadStaffImage,
  imageDir,
  staffImageDir,
  fs,
  path,
  crypto,
  axios,
  BakongKHQR,
  khqrData,
  MerchantInfo,
  emitRealtime,
  PASSWORD_HASH_PREFIX,
  PASSWORD_HASH_ITERATIONS,
  PASSWORD_HASH_KEYLEN,
  PASSWORD_HASH_DIGEST
});

// ======================================================
// CONNECT DB AND START SERVER
// ======================================================
const mongoUrl = configuredMongoUrl;

if (/<[^>]+>/.test(mongoUrl)) {
  console.error(
    "MongoDB Error: Replace the placeholders in MONGO_URL with your real MongoDB Atlas connection string."
  );
  process.exit(1);
}

if (require.main === module || process.env.START_SERVER === "true") {
mongoose
  .connect(mongoUrl)
  .then(async () => {
    console.log("✅ MongoDB Connected");

    await Product.collection.createIndex(
      { productCode: 1 },
      { unique: true }
    );

    await Promotion.collection.createIndex(
      { promotionID: 1 },
      { unique: true }
    );

    await KHQRGenerate.collection.createIndex(
      { md5: 1 },
      { unique: true }
    );

    initRealtime(server);

    server.listen(PORT, "0.0.0.0", () => {
      console.log("🚀 Server running at http://localhost:3000");
    });
  })
  .catch((err) => console.log("❌ MongoDB Error:", err.message));
}

module.exports = { app, server };
