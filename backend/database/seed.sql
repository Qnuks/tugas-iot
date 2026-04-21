INSERT INTO devices (code, name, location, greenhouse_zone)
VALUES ('GH-001', 'SEMAI Greenhouse 1', 'Lab IoT', 'Zona A')
ON CONFLICT (code)
DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  greenhouse_zone = EXCLUDED.greenhouse_zone,
  updated_at = NOW();

INSERT INTO actuator_states (device_id, actuator_type, mode, is_on, last_source, last_reason)
SELECT id, 'pump', 'auto', FALSE, 'seed', 'Initial state'
FROM devices
WHERE code = 'GH-001'
ON CONFLICT (device_id, actuator_type) DO NOTHING;

INSERT INTO actuator_states (device_id, actuator_type, mode, is_on, last_source, last_reason)
SELECT id, 'fan', 'auto', FALSE, 'seed', 'Initial state'
FROM devices
WHERE code = 'GH-001'
ON CONFLICT (device_id, actuator_type) DO NOTHING;

INSERT INTO actuator_states (device_id, actuator_type, mode, is_on, last_source, last_reason)
SELECT id, 'lamp', 'auto', FALSE, 'seed', 'Initial state'
FROM devices
WHERE code = 'GH-001'
ON CONFLICT (device_id, actuator_type) DO NOTHING;

INSERT INTO automation_rules (device_id, actuator_type, threshold_value, comparison_operator, mode, description)
SELECT id, 'pump', 40, '<', 'auto', 'Pompa aktif saat kelembapan tanah di bawah 40%'
FROM devices
WHERE code = 'GH-001'
ON CONFLICT (device_id, actuator_type) DO NOTHING;

INSERT INTO automation_rules (device_id, actuator_type, threshold_value, comparison_operator, mode, description)
SELECT id, 'fan', 30, '>', 'auto', 'Kipas aktif saat suhu di atas 30C'
FROM devices
WHERE code = 'GH-001'
ON CONFLICT (device_id, actuator_type) DO NOTHING;

INSERT INTO automation_rules (device_id, actuator_type, threshold_value, comparison_operator, mode, description)
SELECT id, 'lamp', 50, '<', 'auto', 'Lampu aktif saat cahaya di bawah 50%'
FROM devices
WHERE code = 'GH-001'
ON CONFLICT (device_id, actuator_type) DO NOTHING;
