const mongoose = require("mongoose");

const KHQRGenerateSchema = new mongoose.Schema(
  {
    md5: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    qrString: {
      type: String,
      required: true
    },
    transactionId: {
      type: String,
      required: true,
      trim: true
    },
    invoiceNo: {
      type: String,
      default: "",
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      default: 0
    },
    currency: {
      type: String,
      default: "USD",
      trim: true
    },
    employeeNumber: {
      type: Number,
      default: null
    },
    items: {
      type: Array,
      default: []
    },
    status: {
      type: String,
      default: "PENDING",
      enum: ["PENDING", "SUCCESS", "FAILED", "EXPIRED"]
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    liveResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    collection: "Mart_khqrGenerate"
  }
);

module.exports = mongoose.model("KHQRGenerate", KHQRGenerateSchema);
