import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import homeRoutes from "./routes/homeRoutes.js";
import { requireAuth } from "./middleware/auth.js";
import { getLagosDateTime } from "./utils/time.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 8000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  })
);

app.use(express.json());

/**
 * Health check
 * No authentication required.
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: getLagosDateTime(),
  });
});

/**
 * All home/dashboard endpoints require authentication.
 */
app.use("/homes", requireAuth, homeRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "Route not found",
    statusCode: 404,
  });
});

app.listen(PORT, () => {
  console.log(
    `Light Tracker backend running on http://localhost:${PORT}`
  );
});