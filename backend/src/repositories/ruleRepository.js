const db = require("../db");

async function seedDefaultRules(deviceId) {
  const defaults = [
    ["pump", 40, "<", "auto", "Aktif jika kelembapan tanah di bawah 40 persen"],
    ["fan", 30, ">", "auto", "Aktif jika suhu udara di atas 30 derajat Celsius"],
    ["lamp", 50, "<", "auto", "Aktif jika intensitas cahaya di bawah 50 persen"]
  ];

  for (const rule of defaults) {
    await db.query(
      `
        INSERT INTO automation_rules (
          device_id,
          actuator_type,
          threshold_value,
          comparison_operator,
          mode,
          description
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (device_id, actuator_type)
        DO NOTHING;
      `,
      [deviceId, rule[0], rule[1], rule[2], rule[3], rule[4]]
    );
  }
}

async function listRules(deviceCode = null) {
  if (deviceCode) {
    const result = await db.query(
      `
        SELECT
          r.*,
          d.code AS device_code,
          d.name AS device_name
        FROM automation_rules r
        JOIN devices d ON d.id = r.device_id
        WHERE d.code = $1
        ORDER BY r.actuator_type ASC;
      `,
      [deviceCode]
    );

    return result.rows;
  }

  const result = await db.query(
    `
      SELECT
        r.*,
        d.code AS device_code,
        d.name AS device_name
      FROM automation_rules r
      JOIN devices d ON d.id = r.device_id
      ORDER BY d.code ASC, r.actuator_type ASC;
    `
  );

  return result.rows;
}

async function updateRule({ deviceId, actuatorType, thresholdValue, comparisonOperator, mode, description }) {
  const result = await db.query(
    `
      UPDATE automation_rules
      SET
        threshold_value = $3,
        comparison_operator = $4,
        mode = $5,
        description = $6,
        updated_at = NOW()
      WHERE device_id = $1 AND actuator_type = $2
      RETURNING *;
    `,
    [deviceId, actuatorType, thresholdValue, comparisonOperator, mode, description]
  );

  return result.rows[0] || null;
}

module.exports = {
  seedDefaultRules,
  listRules,
  updateRule
};
