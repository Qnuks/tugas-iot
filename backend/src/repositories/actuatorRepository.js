const db = require("../db");

async function upsertActuatorState({
  deviceId,
  actuatorType,
  mode,
  isOn,
  source,
  reason
}) {
  const query = `
    INSERT INTO actuator_states (
      device_id,
      actuator_type,
      mode,
      is_on,
      last_source,
      last_reason
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (device_id, actuator_type)
    DO UPDATE SET
      mode = EXCLUDED.mode,
      is_on = EXCLUDED.is_on,
      last_source = EXCLUDED.last_source,
      last_reason = EXCLUDED.last_reason,
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [deviceId, actuatorType, mode, isOn, source, reason];
  const result = await db.query(query, values);
  return result.rows[0];
}

async function listActuatorStates(deviceCode = null) {
  if (deviceCode) {
    const result = await db.query(
      `
        SELECT
          a.*,
          d.code AS device_code,
          d.name AS device_name
        FROM actuator_states a
        JOIN devices d ON d.id = a.device_id
        WHERE d.code = $1
        ORDER BY a.actuator_type ASC;
      `,
      [deviceCode]
    );

    return result.rows;
  }

  const result = await db.query(
    `
      SELECT
        a.*,
        d.code AS device_code,
        d.name AS device_name
      FROM actuator_states a
      JOIN devices d ON d.id = a.device_id
      ORDER BY d.code ASC, a.actuator_type ASC;
    `
  );

  return result.rows;
}

async function createActuatorLog({
  actuatorStateId,
  requestedState,
  source,
  reason
}) {
  const result = await db.query(
    `
      INSERT INTO actuator_logs (
        actuator_state_id,
        requested_state,
        source,
        reason
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `,
    [actuatorStateId, requestedState, source, reason]
  );

  return result.rows[0];
}

module.exports = {
  upsertActuatorState,
  listActuatorStates,
  createActuatorLog
};
