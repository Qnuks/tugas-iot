const express = require("express");
const cors = require("cors");
const config = require("./config");
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const telemetryRoutes = require("./routes/telemetryRoutes");
const actuatorRoutes = require("./routes/actuatorRoutes");
const ruleRoutes = require("./routes/ruleRoutes");
const systemRoutes = require("./routes/systemRoutes");

const app = express();
const allowAllOrigins =
  config.corsOrigins.length === 1 && config.corsOrigins[0] === "*";

app.use(
  cors({
    origin(origin, callback) {
      if (allowAllOrigins || !origin || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} tidak diizinkan oleh CORS.`));
    }
  })
);
app.use(express.json());

app.use("/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/actuators", actuatorRoutes);
app.use("/api/rules", ruleRoutes);
app.use("/api/system", systemRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} tidak ditemukan.`
  });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    success: false,
    message: error.message || "Terjadi kesalahan pada server."
  });
});

module.exports = app;
