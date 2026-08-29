const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    collection: "Mart_employees"
  }
);

module.exports = mongoose.model("Employee", EmployeeSchema);
