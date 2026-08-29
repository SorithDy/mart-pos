const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    collection: "Mart_products"
  }
);

module.exports = mongoose.model("Product", ProductSchema);
