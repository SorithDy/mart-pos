const { spawn } = require("child_process");
const path = require("path");
const os = require("os");

function getNetworkIp() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      if (name.toLowerCase().includes("vmnet") || name.toLowerCase().includes("virtual") || name.toLowerCase().includes("wsl")) continue;
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
  } catch (_) {}
  return "localhost";
}

const networkIp = getNetworkIp();

console.log("\x1b[36m%s\x1b[0m", "==================================================");
console.log("\x1b[32m%s\x1b[0m", "  🚀 Starting Mart POS System...");
console.log("\x1b[36m%s\x1b[0m", "==================================================");
console.log("  ➜ Local:    \x1b[36mhttp://localhost:5173\x1b[0m");
if (networkIp !== "localhost") {
  console.log(`  ➜ Network:  \x1b[36mhttp://${networkIp}:5173\x1b[0m`);
}
console.log("  ➜ Backend:  \x1b[35mhttp://localhost:3000\x1b[0m");
console.log("  🌐 Automatically opening in Google Chrome...");
console.log("\x1b[36m%s\x1b[0m", "==================================================");

// 1. Start Backend on port 3000
const backend = spawn(process.execPath, [path.join(__dirname, "backend", "src", "bootstrap.js")], {
  stdio: "inherit",
  env: process.env
});

// 2. Start Frontend on port 5173 (which auto-opens Chrome)
const frontend = spawn(process.execPath, [path.join(__dirname, "frontend", "server.js")], {
  stdio: "inherit",
  env: process.env
});

function shutdown() {
  console.log("\nStopping all services...");
  try { backend.kill(); } catch (_) {}
  try { frontend.kill(); } catch (_) {}
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
backend.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Backend process exited with code ${code}`);
  }
});
frontend.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Frontend process exited with code ${code}`);
  }
});
