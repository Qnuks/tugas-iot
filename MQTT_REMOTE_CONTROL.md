# Alur Kendali Jarak Jauh via MQTT

Dokumen ini menjelaskan alur lengkap remote control untuk proyek SEMAI.

## Tujuan

Ketika user menekan tombol di dashboard web, relay fisik di ESP32 harus berubah.

## Arsitektur

1. User membuka frontend di Vercel.
2. Frontend mengirim request ke backend di Render.
3. Backend menyimpan status actuator ke PostgreSQL cloud.
4. Backend publish command ke MQTT broker.
5. ESP32 subscribe topic kontrol sesuai `deviceCode`.
6. ESP32 mengubah relay pump, fan, atau lamp.

## Topic yang dipakai

### Topic telemetry

```text
smartfarm/telemetry
```

ESP32 bisa publish data sensor ke sini.

### Topic control

```text
smartfarm/control/GH-001
```

Backend akan publish command control ke topic ini jika `deviceCode` adalah `GH-001`.

## Payload control dari backend ke ESP32

### Fan

```json
{
  "kipas": true
}
```

### Pump

```json
{
  "pompa": true
}
```

### Lamp

```json
{
  "lampu": false
}
```

Payload ini sudah cocok dengan callback di file [rumahijo.ino](C:/Users/ibnua/Documents/tugas2/tugas%20iot/rumahijo.ino).

## Endpoint web yang memicu publish MQTT

`POST /api/actuators`

Contoh:

```json
{
  "deviceCode": "GH-001",
  "actuatorType": "pump",
  "mode": "manual",
  "isOn": true,
  "source": "frontend",
  "reason": "Manual override dari web"
}
```

## Yang harus dikerjakan teman ESP32

1. Pastikan ESP32 subscribe topic:

```text
smartfarm/control/GH-001
```

2. Pastikan firmware memakai format JSON:

```json
{
  "kipas": true
}
```

atau

```json
{
  "pompa": false
}
```

atau

```json
{
  "lampu": true
}
```

3. Pastikan broker, username, password MQTT sama dengan yang dipakai backend Render.
