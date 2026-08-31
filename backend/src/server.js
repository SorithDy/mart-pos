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

// Simple browser-friendly checks for the API service.
app.get("/", (req, res) => {
  res.json({
    name: "Mart POS Backend",
    status: "ok",
    api: "/api"
  });
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
