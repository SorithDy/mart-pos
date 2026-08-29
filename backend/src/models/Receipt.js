const mongoose = require("mongoose");

const ReceiptSchema = new mongoose.Schema(
  {
    invoiceNo: {
      type: Number,
      required: true
    },
    productCode: {
      type: String,
      required: true
    },
    productName: {
      type: String,
      default: ""
    },
    quantity: {
      type: Number,
      required: true,
      default: 1
    },
    price: {
      type: Number,
      required: true,
      default: 0
    },
    subTotal: {
      type: Number,
      required: true,
      default: 0
    }
  },
  {
    collection: "Mart_saleItems"
  }
);

module.exports = mongoose.model("Receipt", ReceiptSchema);
