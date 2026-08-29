// ======================================================
// MART MANAGEMENT SYSTEM - SERVER
// Login + Dashboard + Products + Categories + Staff
// Sales Details + Receipt History + POS Checkout + Promotions
// + KHQR / ABA Generate + Status + Mock Paid (MongoDB)
// ======================================================

require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dns = require("dns");
const path = require("path");
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

// Use reliable DNS resolvers for MongoDB Atlas SRV records. Override with
// DNS_SERVERS when the current network requires its own DNS servers.
const dnsServers = String(process.env.DNS_SERVERS || "1.1.1.1,8.8.8.8")
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);
if (dnsServers.length) dns.setServers(dnsServers);

// ======================================================
// STATIC FILES
// ======================================================
app.use(express.static(path.join(__dirname, "..", "..", "frontend", "public")));

// ======================================================
// MODELS
// ======================================================
const Product = require("./models/Product");
const Customer = require("./models/Customer");
const Sale = require("./models/Sale");
const Employee = require("./models/Employee");
const Promotion = require("./models/Promotion");
const KHQRGenerate = require("./models/KHQRGenerate");
const Login = require("./models/Login");
const Receipt = require("./models/Receipt");
const ProductCategory = require("./models/ProductCategory");

const PORT = Number(process.env.PORT) || 3000;
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

app.post("/api/upload", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    res.json({ imageUrl: "/image/" + req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// HELPERS
// ======================================================
function normalizeImage(img) {
  img = String(img || "").trim();

  if (img.startsWith("images/")) img = "/" + img;
  if (img.startsWith("/images/")) img = img.replace("/images/", "/image/");
  if (img.startsWith("image/")) img = "/" + img;

  return img;
}

async function ensureCategoryExists(categoryID, categoryName, description) {
  const id = String(categoryID || "").trim();
  if (!id) return;

  const exists = await ProductCategory.findOne({ categoryID: id }).lean();
  if (exists) return;

  await ProductCategory.create({
    categoryID: id,
    categoryName: String(categoryName || "").trim() || "New Category",
    description: String(description || "").trim() || "",
    createdAt: new Date()
  });
}

async function getNextInvoiceNo() {
  const lastSale = await Sale.findOne({}, { invoiceNo: 1 })
    .sort({ invoiceNo: -1, _id: -1 })
    .lean();

  if (!lastSale || !Number.isFinite(Number(lastSale.invoiceNo))) {
    return 40001;
  }

  return Number(lastSale.invoiceNo) + 1;
}

function makeTransactionId() {
  return "INV-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function getRequiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const normalizedPassword = String(password || "");
  const derived = crypto.pbkdf2Sync(
    normalizedPassword,
    salt,
    PASSWORD_HASH_ITERATIONS,
    PASSWORD_HASH_KEYLEN,
    PASSWORD_HASH_DIGEST
  ).toString("hex");

  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${salt}$${derived}`;
}

function isHashedPassword(value) {
  return String(value || "").startsWith(`${PASSWORD_HASH_PREFIX}$`);
}

function verifyPassword(storedPassword, candidatePassword) {
  const candidate = String(candidatePassword || "");
  const stored = String(storedPassword || "");

  if (!stored) return false;

  if (!isHashedPassword(stored)) {
    return stored === candidate;
  }

  const parts = stored.split("$");
  if (parts.length !== 4) return false;

  const [, iterationText, salt, expectedHex] = parts;
  const iterations = Number(iterationText);
  if (!Number.isFinite(iterations) || !salt || !expectedHex) return false;

  const actualHex = crypto.pbkdf2Sync(
    candidate,
    salt,
    iterations,
    expectedHex.length / 2,
    PASSWORD_HASH_DIGEST
  ).toString("hex");

  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  if (expected.length !== actual.length) return false;

  return crypto.timingSafeEqual(expected, actual);
}

async function getStaffDisplayNameForSale(employeeNumber) {
  const employeeNumberText = String(employeeNumber ?? "").trim();
  if (!employeeNumberText) return "";

  const employee = await Employee.findOne({ employeeNumber: Number(employeeNumberText) }).lean();
  const employeeName = `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim();
  if (employeeName) return employeeName;

  const loginUser = await Login.findOne({ employeeNumber: Number(employeeNumberText) }).lean();
  return String(loginUser?.fullName || "").trim();
}

async function checkBakongTransactionByMd5(md5) {
  const baseUrl = String(process.env.BAKONG_BASE_URL || "").trim();
  const token = String(process.env.BAKONG_ACCESS_TOKEN || "").trim();

  if (!baseUrl || !token) {
    throw new Error("Missing BAKONG_BASE_URL or BAKONG_ACCESS_TOKEN");
  }

  const response = await axios.post(
    `${baseUrl}/v1/check_transaction_by_md5`,
    { md5 },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}

// ======================================================
// LOGIN API
// ======================================================
app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await Login.findOne({
      username: username,
      status: "Active"
    }).lean();

    if (!user || !verifyPassword(user.password, password)) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    if (!isHashedPassword(user.password)) {
      await Login.updateOne(
        { username: user.username },
        { $set: { password: hashPassword(password) } }
      );
    }

    res.json({
      message: "Login successful",
      user: {
        username: user.username || "",
        fullName: user.fullName || "",
        role: user.role || "User",
        employeeNumber: user.employeeNumber || ""
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// DASHBOARD APIs
// ======================================================
app.get("/api/total-products", async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    res.json({ totalProducts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/total-revenue", async (req, res) => {
  try {
    const result = await Sale.aggregate([
      {
        $project: {
          revenueValue: {
            $convert: {
              input: "$totalAmount",
              to: "double",
              onError: 0,
              onNull: 0
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$revenueValue" }
        }
      }
    ]);

    res.json({
      totalRevenue: result.length ? result[0].total : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/total-employees", async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    res.json({ totalEmployees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/upload/staff", uploadStaffImage.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    res.json({ imageUrl: "/image/Staff-Image/" + req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// ACCOUNT API
// ======================================================
app.get("/api/accounts", async (req, res) => {
  try {
    const accounts = await Login.find({})
      .select("-password")
      .sort({ createdAt: -1, username: 1 })
      .lean();

    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load accounts" });
  }
});

app.post("/api/accounts", async (req, res) => {
  try {
    const rawPassword = String(req.body.password || "").trim();
    const payload = {
      username: String(req.body.username || "").trim(),
      password: hashPassword(rawPassword),
      role: String(req.body.role || "User").trim() || "User",
      employeeNumber: req.body.employeeNumber === "" || req.body.employeeNumber == null
        ? null
        : Number(req.body.employeeNumber),
      fullName: String(req.body.fullName || "").trim(),
      phoneNumber: String(req.body.phoneNumber || "").trim(),
      status: String(req.body.status || "Active").trim() || "Active",
      createdAt: new Date()
    };

    if (!payload.username || !rawPassword) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    if (payload.employeeNumber != null && !Number.isFinite(payload.employeeNumber)) {
      return res.status(400).json({ message: "Employee Number must be numeric" });
    }

    const exists = await Login.findOne({ username: payload.username }).lean();
    if (exists) {
      return res.status(409).json({ message: "Username already exists" });
    }

    await Login.create(payload);
    res.status(201).json({ message: "Account created" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create account" });
  }
});

app.put("/api/accounts/:username", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    const rawPassword = String(req.body.password || "").trim();
    const payload = {
      username: String(req.body.username || "").trim(),
      role: String(req.body.role || "User").trim() || "User",
      employeeNumber: req.body.employeeNumber === "" || req.body.employeeNumber == null
        ? null
        : Number(req.body.employeeNumber),
      fullName: String(req.body.fullName || "").trim(),
      phoneNumber: String(req.body.phoneNumber || "").trim(),
      status: String(req.body.status || "Active").trim() || "Active"
    };

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    if (!payload.username) {
      return res.status(400).json({ message: "New username is required" });
    }

    if (payload.employeeNumber != null && !Number.isFinite(payload.employeeNumber)) {
      return res.status(400).json({ message: "Employee Number must be numeric" });
    }

    if (payload.username !== username) {
      const exists = await Login.findOne({ username: payload.username }).lean();
      if (exists) {
        return res.status(409).json({ message: "Username already exists" });
      }
    }

    if (rawPassword) {
      payload.password = hashPassword(rawPassword);
    }

    const updated = await Login.findOneAndUpdate(
      { username },
      { $set: payload },
      { returnDocument: "after" }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Account not found" });
    }

    res.json({ message: "Account updated" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update account" });
  }
});

app.patch("/api/accounts/:username/password", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    const currentPassword = String(req.body.currentPassword || "").trim();
    const newPassword = String(req.body.newPassword || "").trim();

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    const account = await Login.findOne({ username }).lean();
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    if (!verifyPassword(account.password, currentPassword)) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    await Login.updateOne(
      { username },
      { $set: { password: hashPassword(newPassword) } }
    );

    res.json({ message: "Password updated" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update password" });
  }
});

app.patch("/api/accounts/:username/profile", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    const fullName = String(req.body.fullName || "").trim();
    const phoneNumber = String(req.body.phoneNumber || "").trim();

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    if (!fullName) {
      return res.status(400).json({ message: "Full name is required" });
    }

    const updated = await Login.findOneAndUpdate(
      { username },
      { $set: { fullName, phoneNumber } },
      { returnDocument: "after" }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Account not found" });
    }

    res.json({
      message: "Profile updated",
      user: {
        username: updated.username || "",
        fullName: updated.fullName || "",
        phoneNumber: updated.phoneNumber || "",
        role: updated.role || "User",
        employeeNumber: updated.employeeNumber || ""
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update profile" });
  }
});

app.delete("/api/accounts/:username", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const deleted = await Login.findOneAndDelete({ username }).lean();
    if (!deleted) {
      return res.status(404).json({ message: "Account not found" });
    }

    res.json({ message: "Account deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete account" });
  }
});

app.get("/api/recent-sales", async (req, res) => {
  try {
    const sales = await Sale.find()
      .sort({ saleDate: -1, _id: -1 })
      .limit(10)
      .lean();

    const mapped = sales.map((s) => ({
      invoiceNo: s.invoiceNo ?? s.invoice ?? s.orderId ?? String(s._id),
      saleDate: s.saleDate ?? s.date ?? s.createdAt ?? null,
      status: s.status ?? "Completed"
    }));

    res.json({ sales: mapped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// SALES DETAILS API
// ======================================================
app.get("/api/sales", async (req, res) => {
  try {
    const sales = await Sale.aggregate([
      {
        $lookup: {
          from: "Mart_employees",
          let: {
            saleEmployeeNumber: {
              $toString: { $ifNull: ["$employeeNumber", ""] }
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: { $ifNull: ["$employeeNumber", ""] } },
                    "$$saleEmployeeNumber"
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: "staff"
        }
      },
      { $unwind: { path: "$staff", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "Mart_user",
          let: {
            saleEmployeeNumber: {
              $toString: { $ifNull: ["$employeeNumber", ""] }
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: { $ifNull: ["$employeeNumber", ""] } },
                    "$$saleEmployeeNumber"
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: "loginStaff"
        }
      },
      { $unwind: { path: "$loginStaff", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          invoiceNo: 1,
          saleDate: 1,
          employeeNumber: 1,
          totalAmount: 1,
          paymentMethod: 1,
          status: 1,
          staffName: {
            $let: {
              vars: {
                joinedName: {
                  $trim: {
                    input: {
                      $concat: [
                        { $ifNull: ["$staff.firstName", ""] },
                        " ",
                        { $ifNull: ["$staff.lastName", ""] }
                      ]
                    }
                  }
                }
              },
              in: {
                $cond: [
                  { $ne: ["$$joinedName", ""] },
                  "$$joinedName",
                  {
                    $cond: [
                      { $ne: [{ $ifNull: ["$loginStaff.fullName", ""] }, ""] },
                      "$loginStaff.fullName",
                      { $ifNull: ["$staffName", ""] }
                    ]
                  }
                ]
              }
            }
          }
        }
      },
      { $sort: { saleDate: -1, _id: -1 } }
    ]);

    res.json({ sales });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// RECEIPT APIs
// ======================================================
app.get("/api/receipt/:invoiceNo", async (req, res) => {
  try {
    const invoiceNo = Number(req.params.invoiceNo);
    const items = await Receipt.find({ invoiceNo }).lean();
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/receipt-history/:invoiceNo", async (req, res) => {
  try {
    const invoiceNo = Number(req.params.invoiceNo);
    if (!Number.isFinite(invoiceNo)) {
      return res.status(400).send("Invalid invoice number");
    }

    const saleResult = await Sale.deleteMany({ invoiceNo });
    const receiptResult = await Receipt.deleteMany({ invoiceNo });

    if (!saleResult.deletedCount && !receiptResult.deletedCount) {
      return res.status(404).send("Receipt history not found");
    }

    res.json({
      message: "Receipt history deleted",
      deletedSales: saleResult.deletedCount,
      deletedReceipts: receiptResult.deletedCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/receipt-history", async (req, res) => {
  try {
    const saleResult = await Sale.deleteMany({});
    const receiptResult = await Receipt.deleteMany({});

    res.json({
      message: "All receipt history cleared",
      deletedSales: saleResult.deletedCount,
      deletedReceipts: receiptResult.deletedCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// KHQR GENERATE
// ======================================================
app.post("/api/khqr/generate", async (req, res) => {
  try {
    const {
      amount,
      currency = "USD",
      invoiceNo = "",
      employeeNumber = null,
      items = []
    } = req.body;

    const cleanAmount = Number(amount || 0);

    if (!cleanAmount || cleanAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const transactionId = invoiceNo || makeTransactionId();
    const now = new Date();
    const expiresAt = addMinutes(now, 5);
    const bakongAccount = getRequiredEnv("KHQR_BAKONG_ACCOUNT");
    const merchantName = getRequiredEnv("KHQR_MERCHANT_NAME");
    const merchantCity = getRequiredEnv("KHQR_MERCHANT_CITY");
    const merchantId = getRequiredEnv("KHQR_MERCHANT_ID");
    const acquiringBank = getRequiredEnv("KHQR_ACQUIRING_BANK");

    const optionalData = {
      currency:
        String(currency).toUpperCase() === "KHR"
          ? khqrData.currency.khr
          : khqrData.currency.usd,
      amount: cleanAmount,
      billNumber: transactionId,
      storeLabel: String(process.env.KHQR_STORE_LABEL || "Mart Dashboard").trim(),
      terminalLabel: String(process.env.KHQR_TERMINAL_LABEL || "Cashier_1").trim(),
      mobileNumber: String(process.env.KHQR_MOBILE || "").trim(),
      purposeOfTransaction: "POS Payment",
      expirationTimestamp: expiresAt.getTime(),
      merchantCategoryCode: String(
        process.env.KHQR_MERCHANT_CATEGORY_CODE || "5999"
      ).trim()
    };

    const merchantInfo = new MerchantInfo(
      bakongAccount,
      merchantName,
      merchantCity,
      merchantId,
      acquiringBank,
      optionalData
    );

    const khqr = new BakongKHQR();
    const result = khqr.generateMerchant(merchantInfo);

    const qrString =
      result?.data?.qr ||
      result?.qr ||
      "";

    const md5 =
      result?.data?.md5 ||
      result?.md5 ||
      (qrString
        ? crypto.createHash("md5").update(qrString).digest("hex")
        : "");

    if (!qrString) {
      return res.status(500).json({
        message: "Failed to generate KHQR",
        debug: result || null
      });
    }

    await KHQRGenerate.findOneAndUpdate(
      { md5 },
      {
        md5,
        qrString,
        transactionId,
        invoiceNo: transactionId,
        amount: cleanAmount,
        currency: String(currency).toUpperCase(),
        employeeNumber,
        items,
        status: "PENDING",
        createdAt: now,
        expiresAt,
        liveResponse: null
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true
      }
    );

    return res.json({
      qrString,
      md5,
      transactionId,
      invoiceNo: transactionId,
      expiresAt
    });
  } catch (err) {
    console.error("KHQR Generate Error FULL:", err);
    return res.status(500).json({
      message: err.message || "Failed to generate KHQR",
      stack: err.stack
    });
  }
});

// ======================================================
// KHQR STATUS
// ======================================================
app.get("/api/khqr/status", async (req, res) => {
  try {
    const md5 = String(req.query.md5 || "").trim();

    if (!md5) {
      return res.status(400).json({ message: "md5 is required" });
    }

    let khqrRow = await KHQRGenerate.findOne({ md5 });

    if (!khqrRow) {
      return res.status(404).json({ message: "QR not found" });
    }

    if (
      khqrRow.status === "PENDING" &&
      new Date() > new Date(khqrRow.expiresAt)
    ) {
      khqrRow.status = "EXPIRED";
      await khqrRow.save();
    }

    if (
      String(process.env.USE_BAKONG_LIVE_STATUS || "").toLowerCase() === "true" &&
      khqrRow.status === "PENDING"
    ) {
      try {
        const bakongData = await checkBakongTransactionByMd5(md5);

        const responseCode = Number(bakongData?.responseCode);
        const errorCode = Number(bakongData?.errorCode);

        if (responseCode === 0) {
          khqrRow.status = "SUCCESS";
          khqrRow.liveResponse = bakongData;
          await khqrRow.save();
        } else if (errorCode === 3) {
          khqrRow.status = "FAILED";
          khqrRow.liveResponse = bakongData;
          await khqrRow.save();
        } else if (errorCode === 1) {
          khqrRow.status = "PENDING";
          khqrRow.liveResponse = bakongData;
          await khqrRow.save();
        }
      } catch (liveErr) {
        console.error("Bakong live status error:", liveErr.message);
      }
    }

    khqrRow = await KHQRGenerate.findOne({ md5 });

    return res.json({
      status: khqrRow.status,
      md5: khqrRow.md5,
      transactionId: khqrRow.transactionId,
      expiresAt: khqrRow.expiresAt
    });
  } catch (err) {
    console.error("KHQR Status Error:", err);
    return res.status(500).json({
      message: err.message || "Failed to check KHQR status"
    });
  }
});

// ======================================================
// MOCK KHQR PAID (TEST ONLY)
// ======================================================
app.post("/api/khqr/mock-paid", async (req, res) => {
  try {
    const md5 = String(req.body.md5 || "").trim();

    if (!md5) {
      return res.status(400).json({ message: "md5 is required" });
    }

    const khqrRow = await KHQRGenerate.findOne({ md5 });

    if (!khqrRow) {
      return res.status(404).json({ message: "QR not found" });
    }

    khqrRow.status = "SUCCESS";
    await khqrRow.save();

    emitRealtime("payment:updated", {
      md5,
      status: khqrRow.status,
      updatedAt: new Date().toISOString()
    });

    return res.json({
      message: "Mock payment success",
      status: "SUCCESS",
      md5
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Mock paid failed"
    });
  }
});

// ======================================================
// POS CHECKOUT
// ======================================================
app.post("/api/checkout", async (req, res) => {
  try {
    const {
      employeeNumber = null,
      paymentMethod = "Cash",
      status = "Completed",
      items = [],
      paymentVerified = false,
      khqrMd5 = ""
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    if (String(paymentMethod).toUpperCase() === "ABA") {
      if (!paymentVerified || !khqrMd5) {
        return res.status(400).json({
          message: "ABA payment is not verified yet"
        });
      }

      const khqrRow = await KHQRGenerate.findOne({
        md5: String(khqrMd5).trim()
      }).lean();

      if (!khqrRow) {
        return res.status(404).json({
          message: "KHQR record not found"
        });
      }

      if (khqrRow.status !== "SUCCESS") {
        return res.status(400).json({
          message: "ABA payment is still pending or failed"
        });
      }
    }

    const cleanItems = items.map((item) => ({
      productCode: String(item.productCode || "").trim(),
      productName: String(item.productName || "").trim(),
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      subTotal: Number(
        item.subTotal || Number(item.quantity || 0) * Number(item.price || 0)
      )
    }));

    const invalidItem = cleanItems.find(
      (item) => !item.productCode || item.quantity <= 0 || item.price < 0
    );

    if (invalidItem) {
      return res.status(400).json({ message: "Invalid item data" });
    }

    for (const item of cleanItems) {
      const product = await Product.findOne({ productCode: item.productCode }).lean();

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productCode}` });
      }

      if (Number(product.stock || 0) < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${item.productName || item.productCode}`
        });
      }
    }

    const invoiceNo = await getNextInvoiceNo();
    const totalAmount = cleanItems.reduce((sum, item) => sum + item.subTotal, 0);
    const now = new Date();
    const staffName = await getStaffDisplayNameForSale(employeeNumber);

    await Sale.create({
      invoiceNo,
      saleDate: now,
      employeeNumber,
      staffName,
      totalAmount,
      paymentMethod,
      status,
      createdAt: now
    });

    const receiptDocs = cleanItems.map((item) => ({
      invoiceNo,
      productCode: item.productCode,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
      subTotal: item.subTotal
    }));

    await Receipt.insertMany(receiptDocs);

    for (const item of cleanItems) {
      await Product.updateOne(
        { productCode: item.productCode },
        { $inc: { stock: -item.quantity }, $set: { updatedAt: now } }
      );
    }

    emitRealtime("order:created", {
      invoiceNo,
      employeeNumber,
      paymentMethod,
      status,
      totalAmount,
      itemCount: cleanItems.length,
      createdAt: now.toISOString()
    });

    emitRealtime("stock:updated", {
      invoiceNo,
      items: cleanItems.map((item) => ({
        productCode: item.productCode,
        quantity: item.quantity
      })),
      updatedAt: now.toISOString()
    });

    res.status(201).json({
      message: "Checkout successful",
      invoiceNo,
      totalAmount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// PRODUCTS
// ======================================================
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.aggregate([
      {
        $lookup: {
          from: "Mart_productCategory",
          localField: "categoryID",
          foreignField: "categoryID",
          as: "cat"
        }
      },
      { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productCode: 1,
          productName: 1,
          categoryID: 1,
          categoryName: { $ifNull: ["$cat.categoryName", ""] },
          description: { $ifNull: ["$description", ""] },
          image: 1,
          stock: 1,
          buyPrice: 1,
          salePrice: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      { $sort: { _id: -1 } }
    ]);

    const normalized = products.map((p) => ({
      ...p,
      image: normalizeImage(p.image) || ""
    }));

    res.json({ products: normalized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/low-stock", async (req, res) => {
  try {
    const products = await Product.aggregate([
      { $match: { stock: { $lt: 20 } } },
      {
        $lookup: {
          from: "Mart_productCategory",
          localField: "categoryID",
          foreignField: "categoryID",
          as: "cat"
        }
      },
      { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productCode: 1,
          productName: 1,
          categoryID: 1,
          categoryName: { $ifNull: ["$cat.categoryName", ""] },
          description: { $ifNull: ["$description", ""] },
          image: 1,
          stock: 1,
          buyPrice: 1,
          salePrice: 1
        }
      },
      { $sort: { stock: 1, _id: -1 } }
    ]);

    const normalized = products.map((p) => ({
      ...p,
      image: normalizeImage(p.image) || ""
    }));

    res.json({ products: normalized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const code = String(req.body.productCode || "").trim();
    if (!code) {
      return res.status(400).json({ message: "productCode required" });
    }

    const exists = await Product.findOne({ productCode: code });
    if (exists) {
      return res.status(409).json({ message: "Product already exists" });
    }

    await ensureCategoryExists(
      req.body.categoryID,
      req.body.categoryName,
      req.body.categoryDesc
    );

    const saved = await Product.create({
      productCode: code,
      productName: req.body.productName || "",
      categoryID: req.body.categoryID || "",
      description: req.body.description || "",
      image: normalizeImage(req.body.image) || "",
      stock: Number(req.body.stock || 0),
      buyPrice: Number(req.body.buyPrice || 0),
      salePrice: Number(req.body.salePrice || 0),
      createdAt: new Date()
    });

    emitRealtime("products:changed", {
      action: "created",
      productCode: saved.productCode,
      updatedAt: new Date().toISOString()
    });

    res.status(201).json({ message: "Saved", product: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/products/:code", async (req, res) => {
  try {
    const currentCode = String(req.params.code || "").trim();
    const nextCode = String(req.body.productCode || "").trim();

    if (!currentCode || !nextCode) {
      return res.status(400).json({ message: "productCode required" });
    }

    await ensureCategoryExists(
      req.body.categoryID,
      req.body.categoryName,
      req.body.categoryDesc
    );

    if (nextCode !== currentCode) {
      const exists = await Product.findOne({ productCode: nextCode }).lean();
      if (exists) {
        return res.status(409).json({ message: "Product already exists" });
      }
    }

    const updated = await Product.findOneAndUpdate(
      { productCode: currentCode },
      {
        productCode: nextCode,
        productName: req.body.productName || "",
        categoryID: req.body.categoryID || "",
        description: req.body.description || "",
        image: normalizeImage(req.body.image) || "",
        stock: Number(req.body.stock || 0),
        buyPrice: Number(req.body.buyPrice || 0),
        salePrice: Number(req.body.salePrice || 0),
        updatedAt: new Date()
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      return res.status(404).json({ message: "Not found" });
    }

    emitRealtime("products:changed", {
      action: "updated",
      productCode: updated.productCode,
      updatedAt: new Date().toISOString()
    });

    res.json({ message: "Updated", product: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/products/:code", async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({ productCode: req.params.code });

    if (!deleted) {
      return res.status(404).json({ message: "Not found" });
    }

    emitRealtime("products:changed", {
      action: "deleted",
      productCode: deleted.productCode,
      updatedAt: new Date().toISOString()
    });

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// CATEGORY CRUD
// ======================================================
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await ProductCategory.find().sort({ _id: -1 }).lean();

    const normalized = categories.map((c) => ({
      ...c,
      categoryID: c.categoryID ?? "",
      categoryName: c.categoryName ?? "",
      description: c.description ?? ""
    }));

    res.json({ categories: normalized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const id = String(req.body.categoryID || "").trim();
    const name = String(req.body.categoryName || "").trim();

    if (!id || !name) {
      return res.status(400).json({
        message: "categoryID and categoryName required"
      });
    }

    const exists = await ProductCategory.findOne({ categoryID: id });
    if (exists) {
      return res.status(409).json({
        message: "Category already exists (duplicate in DB)"
      });
    }

    const saved = await ProductCategory.create({
      categoryID: id,
      categoryName: name,
      description: req.body.description || "",
      createdAt: new Date()
    });

    res.status(201).json({ message: "Category saved", category: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  try {
    const updated = await ProductCategory.findOneAndUpdate(
      { categoryID: req.params.id },
      {
        categoryName: String(req.body.categoryName || "").trim(),
        description: req.body.description || "",
        updatedAt: new Date()
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({ message: "Updated", category: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    const result = await ProductCategory.deleteMany({ categoryID: req.params.id });

    res.json({
      message: "Deleted",
      deletedCount: result.deletedCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// PROMOTIONS CRUD
// ======================================================
app.get("/api/promotions", async (req, res) => {
  try {
    const promotions = await Promotion.find().sort({ _id: -1 }).lean();
    res.json({ promotions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function getNextPromotionID() {
  const promotions = await Promotion.find({}, { promotionID: 1, _id: 0 }).lean();
  const maxNumber = promotions.reduce((max, promotion) => {
    const match = String(promotion.promotionID || "").match(/^PR(\d+)$/i);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  return `PR${String(maxNumber + 1).padStart(3, "0")}`;
}

app.get("/api/promotions/next-id", async (req, res) => {
  try {
    const promotionID = await getNextPromotionID();
    res.json({ promotionID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/promotions", async (req, res) => {
  try {
    const manualID = String(req.body.promotionID || "").trim();
    const id = manualID || await getNextPromotionID();

    const exists = await Promotion.findOne({ promotionID: id }).lean();
    if (exists) {
      return res.status(409).json({ message: "Promotion already exists" });
    }

    const saved = await Promotion.create({
      promotionID: id,
      productCode: String(req.body.productCode || "").trim(),
      productName: String(req.body.productName || "").trim(),
      discountType: req.body.discountType || "percent",
      discountValue: Number(req.body.discountValue || 0),
      startDate: req.body.startDate || "",
      endDate: req.body.endDate || "",
      status: req.body.status || "Active",
      createdAt: new Date()
    });

    res.status(201).json({ message: "Promotion saved", promotion: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/promotions/:id", async (req, res) => {
  try {
    const updated = await Promotion.findOneAndUpdate(
      { promotionID: req.params.id },
      {
        productCode: String(req.body.productCode || "").trim(),
        productName: String(req.body.productName || "").trim(),
        discountType: req.body.discountType || "percent",
        discountValue: Number(req.body.discountValue || 0),
        startDate: req.body.startDate || "",
        endDate: req.body.endDate || "",
        status: req.body.status || "Active",
        updatedAt: new Date()
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      return res.status(404).json({ message: "Promotion not found" });
    }

    res.json({ message: "Promotion updated", promotion: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/promotions/:id", async (req, res) => {
  try {
    const deleted = await Promotion.findOneAndDelete({ promotionID: req.params.id });

    if (!deleted) {
      return res.status(404).json({ message: "Promotion not found" });
    }

    res.json({ message: "Promotion deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// EMPLOYEES
// ======================================================
app.get("/api/employees", async (req, res) => {
  try {
    const employees = await Employee.find()
      .sort({ employeeNumber: 1 })
      .lean();

    res.json({ employees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/employees", async (req, res) => {
  try {
    const {
      employeeNumber,
      firstName = "",
      lastName = "",
      extension = "",
      image = "",
      phoneNumber = "",
      officeCode = "",
      reportsTo = "",
      jobTitle = ""
    } = req.body || {};

    const empNo = Number(employeeNumber);
    if (!Number.isInteger(empNo)) {
      return res.status(400).send("Employee Number must be a valid integer");
    }

    if (!String(firstName).trim() || !String(lastName).trim()) {
      return res.status(400).send("First Name and Last Name are required");
    }

    const exists = await Employee.findOne({ employeeNumber: empNo }).lean();
    if (exists) {
      return res.status(409).send("Employee Number already exists");
    }

    const employee = await Employee.create({
      employeeNumber: empNo,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      extension: String(extension || "").trim(),
      image: normalizeImage(image) || "",
      phoneNumber: String(phoneNumber || "").trim(),
      officeCode: String(officeCode || "").trim(),
      reportsTo: String(reportsTo || "").trim(),
      jobTitle: String(jobTitle || "").trim()
    });

    res.status(201).json({ message: "Employee created", employee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/employees/:employeeNumber", async (req, res) => {
  try {
    const currentEmpNo = Number(req.params.employeeNumber);
    const {
      employeeNumber,
      firstName = "",
      lastName = "",
      extension = "",
      image = "",
      phoneNumber = "",
      officeCode = "",
      reportsTo = "",
      jobTitle = ""
    } = req.body || {};
    const nextEmpNo = Number(employeeNumber);

    if (!Number.isInteger(currentEmpNo) || !Number.isInteger(nextEmpNo)) {
      return res.status(400).send("Employee Number must be a valid integer");
    }

    if (!String(firstName).trim() || !String(lastName).trim()) {
      return res.status(400).send("First Name and Last Name are required");
    }

    if (nextEmpNo !== currentEmpNo) {
      const exists = await Employee.findOne({ employeeNumber: nextEmpNo }).lean();
      if (exists) {
        return res.status(409).send("Employee Number already exists");
      }
    }

    const updated = await Employee.findOneAndUpdate(
      { employeeNumber: currentEmpNo },
        {
          $set: {
            employeeNumber: nextEmpNo,
            firstName: String(firstName).trim(),
            lastName: String(lastName).trim(),
            extension: String(extension || "").trim(),
            image: normalizeImage(image) || "",
            phoneNumber: String(phoneNumber || "").trim(),
            officeCode: String(officeCode || "").trim(),
            reportsTo: String(reportsTo || "").trim(),
            jobTitle: String(jobTitle || "").trim()
          }
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      return res.status(404).send("Employee not found");
    }

    res.json({ message: "Employee updated", employee: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/employees/:employeeNumber", async (req, res) => {
  try {
    const empNo = Number(req.params.employeeNumber);
    if (!Number.isInteger(empNo)) {
      return res.status(400).send("Employee Number must be a valid integer");
    }

    const deleted = await Employee.findOneAndDelete({ employeeNumber: empNo });
    if (!deleted) {
      return res.status(404).send("Employee not found");
    }

    res.json({ message: "Employee deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// CONNECT DB AND START SERVER
// ======================================================
const mongoUrl = String(
  process.env.MONGO_URL || "mongodb://127.0.0.1:27017/Mart"
).trim();

if (/<[^>]+>/.test(mongoUrl)) {
  console.error(
    "MongoDB Error: Replace the placeholders in MONGO_URL with your real MongoDB Atlas connection string."
  );
  process.exit(1);
}

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
