const db = require("../db");

async function createOrUpdateDevice({ code, name, location, greenhouseZone }) {
  const query = `
    INSERT INTO devices (code, name, location, greenhouse_zone)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (code)
    DO UPDATE SET
      name = EXCLUDED.name,
      location = EXCLUDED.location,
      greenhouse_zone = EXCLUDED.greenhouse_zone,
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [code, name, location, greenhouseZone];
  const result = await db.query(query, values);
  return result.rows[0];
}

async function findDeviceByCode(code) {
  const result = await db.query(
    "SELECT * FROM devices WHERE code = $1 LIMIT 1",
    [code]
  );

  return result.rows[0] || null;
}

async function listDevices() {
  const result = await db.query(
    "SELECT * FROM devices ORDER BY created_at DESC"
  );

  return result.rows;
}

module.exports = {
  createOrUpdateDevice,
  findDeviceByCode,
  listDevices
};
