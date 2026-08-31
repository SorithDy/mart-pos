const path = require("path");
const dotenv = require("dotenv");

// Keep one environment file for local development and Render deployments.
const envPath = path.resolve(__dirname, "..", "..", "..", ".env");
dotenv.config({ path: envPath });

module.exports = {
  envPath,
  port: Number(process.env.PORT) || 3000,
  mongoUrl: String(
    process.env.MONGO_URL || "mongodb://127.0.0.1:27017/Mart"
  ).trim()
};
