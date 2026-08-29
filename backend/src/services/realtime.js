const { Server } = require("socket.io");

let io = null;

function initRealtime(httpServer) {
  if (io) return io;

  const corsOrigins = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: corsOrigins.length
      ? {
          origin: corsOrigins,
          credentials: true
        }
      : {
          origin: "*"
        }
  });

  io.on("connection", (socket) => {
    socket.emit("server:ready", {
      connectedAt: new Date().toISOString()
    });
  });

  return io;
}

function emitRealtime(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

module.exports = {
  initRealtime,
  emitRealtime
};
