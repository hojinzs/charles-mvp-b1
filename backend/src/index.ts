import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import routers from "./api";
import { setupWebSocket } from "./api/websocket";
import { startProcessor } from "./worker/processor";
import { runScheduler } from "./scheduler/scheduler";
import { getProcessType } from "./process";
import { register } from "./metrics";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const processTypes = getProcessType();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes
if(processTypes.includes("api") || processTypes.includes("all")) {
  app.use(cors());
  app.use(routers); 
}

// WebSocket
if(processTypes.includes("ws") || processTypes.includes("all")) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });
  setupWebSocket(io); 
}

// Scheduler
if(processTypes.includes("scheduler") || processTypes.includes("all")) {
  runScheduler();
}

// Worker
if(processTypes.includes("worker") || processTypes.includes("all")) {
  startProcessor();
}

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 */
// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: Welcome endpoint
 *     responses:
 *       200:
 *         description: Welcome message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the API" });
});

// Metrics Endpoint
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (e) {
    res.status(500).end(e);
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}, process types: ${processTypes.join(", ")}`);
});
