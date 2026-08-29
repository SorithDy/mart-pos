const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    collection: "Mart_payments"
  }
);

module.exports = mongoose.model("Payment", PaymentSchema);
