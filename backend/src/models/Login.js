const mongoose = require("mongoose");

const LoginSchema = new mongoose.Schema(
  {
    username: String,
    password: String,
    role: String,
    employeeNumber: Number,
    fullName: String,
    phoneNumber: String,
    image: String,
    status: String,
    createdAt: Date
  },
  {
    collection: "Mart_user"
  }
);

module.exports = mongoose.model("Login", LoginSchema);
