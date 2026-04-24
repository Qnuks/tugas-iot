const mqtt = require("mqtt");
const config = require("../config");
const telemetryService = require("./telemetryService");

let client = null;

const state = {
  enabled: config.mqttEnabled,
  connected: false,
  lastError: null,
  brokerUrl: config.mqttBrokerUrl || null,
  controlTopicPrefix: config.mqttControlTopicPrefix,
  telemetry: {
    ingestEnabled: config.mqttTelemetryIngest,
    topic: config.mqttTelemetryTopic,
    lastMessageAt: null,
    lastIngestAt: null,
    lastIngestError: null,
    lastPayloadPreview: null
  }
};

function buildControlTopic(deviceCode) {
  if (config.mqttControlTopicMode === "single") {
    return config.mqttControlTopicPrefix;
  }

  return `${config.mqttControlTopicPrefix}/${deviceCode}`;
}

function normalizeActuatorPayload(actuatorType, isOn) {
  const mapping = {
    fan: "kipas",
    pump: "pompa",
    lamp: "lampu"
  };

  const key = mapping[actuatorType] || actuatorType;
  return JSON.stringify({ [key]: isOn });
}

function connectMqtt() {
  if (!config.mqttEnabled || !config.mqttBrokerUrl) {
    state.connected = false;
    state.lastError = config.mqttEnabled
      ? "MQTT_BROKER_URL belum diisi."
      : "MQTT bridge dinonaktifkan.";
    return;
  }

  client = mqtt.connect(config.mqttBrokerUrl, {
    username: config.mqttUsername || undefined,
    password: config.mqttPassword || undefined,
    reconnectPeriod: 3000
  });

  client.on("connect", () => {
    state.connected = true;
    state.lastError = null;
    console.log("[MQTT] Bridge terhubung ke broker.");

    if (config.mqttTelemetryIngest) {
      client.subscribe(config.mqttTelemetryTopic, { qos: 0 }, (error) => {
        if (error) {
          console.error("[MQTT] Subscribe telemetry gagal:", error.message);
        } else {
          console.log(`[MQTT] Subscribe telemetry: ${config.mqttTelemetryTopic}`);
        }
      });
    }
  });

  client.on("reconnect", () => {
    state.connected = false;
    console.log("[MQTT] Bridge mencoba reconnect...");
  });

  client.on("error", (error) => {
    state.connected = false;
    state.lastError = error.message;
    console.error("[MQTT] Error:", error.message);
  });

  client.on("close", () => {
    state.connected = false;
    console.log("[MQTT] Bridge terputus.");
  });

  client.on("message", async (topic, message) => {
    if (!config.mqttTelemetryIngest) return;
    if (topic !== config.mqttTelemetryTopic) return;

    try {
      const text = message.toString("utf8");
      state.telemetry.lastMessageAt = new Date().toISOString();
      state.telemetry.lastPayloadPreview = text.length > 500 ? `${text.slice(0, 500)}...` : text;
      const doc = JSON.parse(text);

      const deviceCode = String(doc.deviceCode || config.mqttDefaultDeviceCode);

      // Support payload dari temanmu: suhu, kelembapan_udara, tanah, cahaya
      // Support payload dari firmware kita: airTemperature, airHumidity, soilMoisture, lightIntensity
      const soilMoisture = doc.soilMoisture ?? doc.tanah ?? null;
      const airTemperature = doc.airTemperature ?? doc.suhu ?? null;
      const airHumidity = doc.airHumidity ?? doc.kelembapan_udara ?? null;
      const lightIntensity = doc.lightIntensity ?? doc.cahaya ?? null;

      const toNumberOrNull = (value) => {
        if (value === null || value === undefined || value === "") return null;
        const parsed = Number(value);
        return Number.isNaN(parsed) ? null : parsed;
      };

      await telemetryService.ingestTelemetry({
        deviceCode,
        soilMoisture: toNumberOrNull(soilMoisture),
        airTemperature: toNumberOrNull(airTemperature),
        airHumidity: toNumberOrNull(airHumidity),
        lightIntensity: toNumberOrNull(lightIntensity)
      });
      state.telemetry.lastIngestAt = new Date().toISOString();
      state.telemetry.lastIngestError = null;
    } catch (error) {
      state.telemetry.lastIngestError = error.message;
      console.error("[MQTT] Telemetry ingest error:", error.message);
    }
  });
}

function publishWithClient(activeClient, topic, payload) {
  return new Promise((resolve, reject) => {
    activeClient.publish(topic, payload, { qos: 1 }, (error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

function waitForConnect(activeClient, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("MQTT connect timeout"));
    }, timeoutMs);

    activeClient.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });

    activeClient.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function publishActuatorCommand({ deviceCode, actuatorType, isOn }) {
  if (!config.mqttEnabled) {
    return {
      published: false,
      reason: "MQTT bridge nonaktif"
    };
  }

  const topic = buildControlTopic(deviceCode);
  const payload = normalizeActuatorPayload(actuatorType, isOn);

  if (client && state.connected) {
    try {
      await publishWithClient(client, topic, payload);
      return { published: true, topic, payload, mode: "persistent" };
    } catch (error) {
      state.lastError = error.message;
      return { published: false, reason: error.message, topic, payload };
    }
  }

  // Serverless-friendly: connect, publish, disconnect (no long-lived socket required)
  if (!config.mqttBrokerUrl) {
    return { published: false, reason: "MQTT_BROKER_URL belum diisi.", topic, payload };
  }

  const tempClient = mqtt.connect(config.mqttBrokerUrl, {
    username: config.mqttUsername || undefined,
    password: config.mqttPassword || undefined,
    reconnectPeriod: 0
  });

  try {
    await waitForConnect(tempClient, 6000);
    await publishWithClient(tempClient, topic, payload);
    tempClient.end(true);
    return { published: true, topic, payload, mode: "on_demand" };
  } catch (error) {
    state.lastError = error.message;
    try {
      tempClient.end(true);
    } catch (_e) {
      // ignore
    }
    return { published: false, reason: error.message, topic, payload };
  }
}

function getMqttState() {
  return { ...state };
}

module.exports = {
  connectMqtt,
  publishActuatorCommand,
  getMqttState,
  buildControlTopic
};
