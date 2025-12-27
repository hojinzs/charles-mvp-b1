import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import keywordsRouter from "./routes/keywords";
import rankingsRouter from "./routes/rankings";
import jobsRouter from "./routes/jobs";
import swaggerUi from "swagger-ui-express";
import specs from "./swagger";
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

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// WebSocket
setupWebSocket(io);

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

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});
