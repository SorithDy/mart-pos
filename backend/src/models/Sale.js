const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    collection: "Mart_sales"
  }
);

module.exports = mongoose.model("Sale", SaleSchema);
