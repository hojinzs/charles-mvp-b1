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

      // Check for rank alert
      if (result.targetRank && result.rank && result.rank > result.targetRank) {
         console.log(`[WS] Rank Alert for Job ${jobId}: Rank ${result.rank} > Target ${result.targetRank}`);
         io.emit("rank_alert", {
             keywordId: parseInt(jobId),
             keyword: "Check Client", // Optimization: Pass keyword in result to avoid DB query here? 
             // Or rely on client to know the keyword details by ID. 
             // To be safe, let's just send ID and Rank info.
             rank: result.rank,
             targetRank: result.targetRank,
             message: `순위 하락 알림: ${result.rank}위 (목표: ${result.targetRank}위)`
         });
      }
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
