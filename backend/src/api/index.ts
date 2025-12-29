import { Router } from "express";
import keywordsRouter from "./routes/keywords";
import rankingsRouter from "./routes/rankings";
import jobsRouter from "./routes/jobs";
import swaggerUi from "swagger-ui-express";
import specs from "./swagger";

const rootRouer = Router();

// Routes
rootRouer.use("/api/keywords", keywordsRouter);
rootRouer.use("/api/rankings", rankingsRouter);
rootRouer.use("/api/jobs", jobsRouter);

// Swagger UI
rootRouer.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

export default rootRouer;