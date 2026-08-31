// Central model access layer. Controllers receive these repositories through
// dependency injection, so database access can be replaced or tested later.
module.exports = {
  Product: require("../models/Product"),
  Customer: require("../models/Customer"),
  Sale: require("../models/Sale"),
  Employee: require("../models/Employee"),
  Promotion: require("../models/Promotion"),
  KHQRGenerate: require("../models/KHQRGenerate"),
  Login: require("../models/Login"),
  Receipt: require("../models/Receipt"),
  ProductCategory: require("../models/ProductCategory")
};
