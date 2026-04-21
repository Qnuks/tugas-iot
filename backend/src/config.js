const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const backendRoot = path.resolve(__dirname, "..");
const defaultEnvPath = path.join(backendRoot, ".env");
const supabaseEnvPath = path.join(backendRoot, ".env.supabase");

if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath });
} else if (fs.existsSync(supabaseEnvPath)) {
  dotenv.config({ path: supabaseEnvPath });
} else {
  dotenv.config();
}

const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || "",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  corsOrigins:
    (process.env.CORS_ORIGIN || "*")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  adminEmail: process.env.ADMIN_EMAIL || "admin@semai.com",
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
  mqttEnabled: String(process.env.MQTT_ENABLED || "false").toLowerCase() === "true",
  mqttBrokerUrl: process.env.MQTT_BROKER_URL || "",
  mqttUsername: process.env.MQTT_USERNAME || "",
  mqttPassword: process.env.MQTT_PASSWORD || "",
  mqttControlTopicPrefix: process.env.MQTT_CONTROL_TOPIC_PREFIX || "smartfarm/control",
  mqttTelemetryTopic: process.env.MQTT_TELEMETRY_TOPIC || "smartfarm/telemetry"
};

module.exports = config;
