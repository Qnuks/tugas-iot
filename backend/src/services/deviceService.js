const { httpError } = require("../utils/httpError");
const {
  requireString
} = require("../utils/validators");
const deviceRepository = require("../repositories/deviceRepository");
const ruleRepository = require("../repositories/ruleRepository");

async function registerDevice(payload) {
  const code = requireString(payload.code, "code");
  const name = requireString(payload.name, "name");
  const location = payload.location ? String(payload.location).trim() : null;
  const greenhouseZone = payload.greenhouseZone
    ? String(payload.greenhouseZone).trim()
    : null;

  const device = await deviceRepository.createOrUpdateDevice({
    code,
    name,
    location,
    greenhouseZone
  });

  await ruleRepository.seedDefaultRules(device.id);
  return device;
}

async function getDeviceByCodeOrThrow(code) {
  const device = await deviceRepository.findDeviceByCode(code);

  if (!device) {
    throw httpError(404, `Device dengan code ${code} tidak ditemukan.`);
  }

  return device;
}

module.exports = {
  registerDevice,
  getDeviceByCodeOrThrow,
  listDevices: deviceRepository.listDevices
};
