const { registerControllers } = require("../controllers");

function registerApiRoutes(app, deps) {
  registerControllers(app, deps);
}

module.exports = { registerApiRoutes };
