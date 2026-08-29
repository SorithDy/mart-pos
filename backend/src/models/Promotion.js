const mongoose = require("mongoose");

const PromotionSchema = new mongoose.Schema(
  {
    promotionID: {
      type: String,
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
    discountType: {
      type: String,
      enum: ["percent", "amount"],
      default: "percent"
    },
    discountValue: {
      type: Number,
      default: 0
    },
    startDate: {
      type: String,
      default: ""
    },
    endDate: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      default: "Active"
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: null
    }
  },
  {
    collection: "Mart_promotions"
  }
);

module.exports = mongoose.model("Promotion", PromotionSchema);
