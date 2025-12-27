import { Server } from "socket.io";
import { crawlQueue } from "../queue/crawlQueue";

let io: Server;

export function setupWebSocket(socketIo: Server) {
  io = socketIo;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Listen to global queue events
  crawlQueue.on("global:completed", (jobId, resultString) => {
    try {
      console.log(`[WS] Job ${jobId} completed. Result: ${resultString}`);
      const result = JSON.parse(resultString);
      io.emit("rank_updated", {
        keywordId: parseInt(jobId),
        rank: result.rank,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("[WS] Error parsing job result:", e);
    }
  });

  crawlQueue.on("global:failed", (jobId, err) => {
      console.log(`[WS] Job ${jobId} failed: ${err}`);
      io.emit("job_failed", {
          keywordId: parseInt(jobId),
          error: err
      });
  });
}

export function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}
