const {
  requireBoolean,
  requireString
} = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const deviceService = require("./deviceService");
const actuatorRepository = require("../repositories/actuatorRepository");
const mqttService = require("./mqttService");

const VALID_ACTUATORS = new Set(["pump", "fan", "lamp"]);
const VALID_MODES = new Set(["manual", "auto"]);

function validateActuatorType(actuatorType) {
  const value = requireString(actuatorType, "actuatorType").toLowerCase();
  if (!VALID_ACTUATORS.has(value)) {
    throw httpError(400, "actuatorType harus salah satu dari: pump, fan, lamp.");
  }

  return value;
}

function validateMode(mode) {
  const value = requireString(mode, "mode").toLowerCase();
  if (!VALID_MODES.has(value)) {
    throw httpError(400, "mode harus salah satu dari: manual, auto.");
  }

  return value;
}

async function setActuatorState(payload) {
  const deviceCode = requireString(payload.deviceCode, "deviceCode");
  const actuatorType = validateActuatorType(payload.actuatorType);
  const mode = validateMode(payload.mode);
  const isOn = requireBoolean(payload.isOn, "isOn");
  const source = payload.source ? String(payload.source).trim() : "dashboard";
  const reason = payload.reason ? String(payload.reason).trim() : null;

  const device = await deviceService.getDeviceByCodeOrThrow(deviceCode);
  const actuator = await actuatorRepository.upsertActuatorState({
    deviceId: device.id,
    actuatorType,
    mode,
    isOn,
    source,
    reason
  });

  await actuatorRepository.createActuatorLog({
    actuatorStateId: actuator.id,
    requestedState: isOn,
    source,
    reason
  });

  const mqtt = await mqttService.publishActuatorCommand({
    deviceCode,
    actuatorType,
    isOn
  });

  return {
    ...actuator,
    mqtt
  };
}

module.exports = {
  setActuatorState,
  listActuatorStates: actuatorRepository.listActuatorStates,
  validateActuatorType,
  validateMode
};
