const {
  requireNumber,
  requireString
} = require("../utils/validators");
const { httpError } = require("../utils/httpError");
const actuatorService = require("./actuatorService");
const deviceService = require("./deviceService");
const ruleRepository = require("../repositories/ruleRepository");

const VALID_OPERATORS = new Set(["<", ">", "<=", ">=", "="]);

async function updateRule(payload) {
  const deviceCode = requireString(payload.deviceCode, "deviceCode");
  const actuatorType = actuatorService.validateActuatorType(payload.actuatorType);
  const thresholdValue = requireNumber(payload.thresholdValue, "thresholdValue");
  const comparisonOperator = requireString(
    payload.comparisonOperator,
    "comparisonOperator"
  );
  const mode = actuatorService.validateMode(payload.mode);
  const description = payload.description ? String(payload.description).trim() : null;

  if (!VALID_OPERATORS.has(comparisonOperator)) {
    throw httpError(400, "comparisonOperator tidak valid.");
  }

  const device = await deviceService.getDeviceByCodeOrThrow(deviceCode);
  const updatedRule = await ruleRepository.updateRule({
    deviceId: device.id,
    actuatorType,
    thresholdValue,
    comparisonOperator,
    mode,
    description
  });

  if (!updatedRule) {
    throw httpError(404, "Rule otomatisasi tidak ditemukan.");
  }

  return updatedRule;
}

module.exports = {
  updateRule,
  listRules: ruleRepository.listRules
};
