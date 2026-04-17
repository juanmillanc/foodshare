import express from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";

dotenv.config();

const app = express();

app.use(
  helmet({
    // Permite que el frontend (puerto distinto) visualice PDFs servidos por /uploads.
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  "/uploads",
  (_req, res, next) => {
    // Permite incrustar PDFs en iframe desde el frontend.
    res.removeHeader("X-Frame-Options");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; frame-ancestors 'self' ${process.env.FRONTEND_URL || "http://localhost:5173"}`
    );
    next();
  },
  express.static("uploads")
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

app.use((err, _req, res, _next) => {
  res.status(500).json({
    message: "Error inesperado en el servidor.",
    error: err.message
  });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`FoodShare backend ejecutándose en http://localhost:${port}`);
});
