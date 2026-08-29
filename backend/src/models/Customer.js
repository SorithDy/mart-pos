const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    collection: "Mart_customers"
  }
);

module.exports = mongoose.model("Customer", CustomerSchema);
