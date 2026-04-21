CREATE TABLE IF NOT EXISTS devices (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  location VARCHAR(120),
  greenhouse_zone VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telemetry_readings (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  soil_moisture NUMERIC(5, 2),
  air_temperature NUMERIC(5, 2),
  air_humidity NUMERIC(5, 2),
  light_intensity NUMERIC(5, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_device_recorded_at
  ON telemetry_readings(device_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS actuator_states (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  actuator_type VARCHAR(20) NOT NULL CHECK (actuator_type IN ('pump', 'fan', 'lamp')),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('manual', 'auto')),
  is_on BOOLEAN NOT NULL DEFAULT FALSE,
  last_source VARCHAR(50),
  last_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_id, actuator_type)
);

CREATE TABLE IF NOT EXISTS actuator_logs (
  id BIGSERIAL PRIMARY KEY,
  actuator_state_id BIGINT NOT NULL REFERENCES actuator_states(id) ON DELETE CASCADE,
  requested_state BOOLEAN NOT NULL,
  source VARCHAR(50) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actuator_logs_state_created
  ON actuator_logs(actuator_state_id, created_at DESC);

CREATE TABLE IF NOT EXISTS automation_rules (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  actuator_type VARCHAR(20) NOT NULL CHECK (actuator_type IN ('pump', 'fan', 'lamp')),
  threshold_value NUMERIC(8, 2) NOT NULL,
  comparison_operator VARCHAR(5) NOT NULL CHECK (comparison_operator IN ('<', '>', '<=', '>=', '=')),
  mode VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (mode IN ('manual', 'auto')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_id, actuator_type)
);
