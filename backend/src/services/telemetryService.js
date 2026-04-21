const {
  requireString,
  optionalNumber
} = require("../utils/validators");
const deviceService = require("./deviceService");
const telemetryRepository = require("../repositories/telemetryRepository");

async function ingestTelemetry(payload) {
  const deviceCode = requireString(payload.deviceCode, "deviceCode");
  const device = await deviceService.getDeviceByCodeOrThrow(deviceCode);

  return telemetryRepository.createTelemetryReading({
    deviceId: device.id,
    soilMoisture: optionalNumber(payload.soilMoisture),
    airTemperature: optionalNumber(payload.airTemperature),
    airHumidity: optionalNumber(payload.airHumidity),
    lightIntensity: optionalNumber(payload.lightIntensity),
    recordedAt: payload.recordedAt || null
  });
}

async function getTelemetryList(query) {
  const limit = query.limit || 50;
  const deviceCode = query.deviceCode || null;
  return telemetryRepository.listRecentTelemetry(
    limit,
    deviceCode,
    query.start || null,
    query.end || null
  );
}

async function exportTelemetryCsv(query) {
  const rows = await getTelemetryList({
    limit: query.limit || 500,
    deviceCode: query.deviceCode || null
  });

  const headers = [
    "device_code",
    "device_name",
    "soil_moisture",
    "air_temperature",
    "air_humidity",
    "light_intensity",
    "recorded_at"
  ];

  const escapeCsv = (value) => {
    if (value === null || value === undefined) return "";
    const stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes("\"")) {
      return `"${stringValue.replace(/"/g, "\"\"")}"`;
    }

    return stringValue;
  };

  const lines = rows.map((row) =>
    [
      row.device_code,
      row.device_name,
      row.soil_moisture,
      row.air_temperature,
      row.air_humidity,
      row.light_intensity,
      row.recorded_at
    ]
      .map(escapeCsv)
      .join(",")
  );

  return [headers.join(","), ...lines].join("\n");
}

module.exports = {
  ingestTelemetry,
  getTelemetryList,
  exportTelemetryCsv
};
