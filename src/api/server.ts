import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import keywordsRouter from "./routes/keywords";
import rankingsRouter from "./routes/rankings";
import jobsRouter from "./routes/jobs";
import schedulerRouter from "./routes/scheduler";
import { setupWebSocket } from "./websocket";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/keywords", keywordsRouter);
app.use("/api/rankings", rankingsRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/scheduler", schedulerRouter);

// WebSocket
setupWebSocket(io);

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});
