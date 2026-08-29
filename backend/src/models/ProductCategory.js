const mongoose = require("mongoose");

const ProductCategorySchema = new mongoose.Schema(
  {
    categoryID: {
      type: String,
      required: true
    },
    categoryName: {
      type: String,
      required: true
    },
    description: {
      type: String
    }
  },
  {
    collection: "Mart_productCategory"
  }
);

module.exports = mongoose.model("ProductCategory", ProductCategorySchema);
