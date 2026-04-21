const db = require("../db");

async function createTelemetryReading({
  deviceId,
  soilMoisture,
  airTemperature,
  airHumidity,
  lightIntensity,
  recordedAt
}) {
  const query = `
    INSERT INTO telemetry_readings (
      device_id,
      soil_moisture,
      air_temperature,
      air_humidity,
      light_intensity,
      recorded_at
    )
    VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))
    RETURNING *;
  `;

  const values = [
    deviceId,
    soilMoisture,
    airTemperature,
    airHumidity,
    lightIntensity,
    recordedAt || null
  ];

  const result = await db.query(query, values);
  return result.rows[0];
}

async function listRecentTelemetry(limit = 50, deviceCode = null, start = null, end = null) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const filters = [];
  const params = [];

  if (deviceCode) {
    params.push(deviceCode);
    filters.push(`d.code = $${params.length}`);
  }

  if (start) {
    params.push(start);
    filters.push(`tr.recorded_at >= $${params.length}`);
  }

  if (end) {
    params.push(`${end}T23:59:59.999Z`);
    filters.push(`tr.recorded_at <= $${params.length}`);
  }

  params.push(safeLimit);
  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const result = await db.query(
    `
      SELECT
        tr.*,
        d.code AS device_code,
        d.name AS device_name
      FROM telemetry_readings tr
      JOIN devices d ON d.id = tr.device_id
      ${whereClause}
      ORDER BY tr.recorded_at DESC
      LIMIT $${params.length};
    `,
    params
  );

  return result.rows;
}

module.exports = {
  createTelemetryReading,
  listRecentTelemetry
};
