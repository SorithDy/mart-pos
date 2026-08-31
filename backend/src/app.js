// Express application entry point. Routes are being migrated from server.js
// into domain modules incrementally without changing their public API.
module.exports = require("./server").app;
