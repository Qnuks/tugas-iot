const mqtt = require("mqtt");
const config = require("../config");

let client = null;

const state = {
  enabled: config.mqttEnabled,
  connected: false,
  lastError: null,
  brokerUrl: config.mqttBrokerUrl || null,
  controlTopicPrefix: config.mqttControlTopicPrefix
};

function buildControlTopic(deviceCode) {
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
}

function publishActuatorCommand({ deviceCode, actuatorType, isOn }) {
  if (!config.mqttEnabled) {
    return {
      published: false,
      reason: "MQTT bridge nonaktif"
    };
  }

  if (!client || !state.connected) {
    return {
      published: false,
      reason: state.lastError || "MQTT bridge belum terkoneksi"
    };
  }

  const topic = buildControlTopic(deviceCode);
  const payload = normalizeActuatorPayload(actuatorType, isOn);

  client.publish(topic, payload, { qos: 1 }, (error) => {
    if (error) {
      state.lastError = error.message;
      console.error("[MQTT] Publish gagal:", error.message);
    }
  });

  return {
    published: true,
    topic,
    payload
  };
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
