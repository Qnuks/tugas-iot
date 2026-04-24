# SEMAI Backend

Backend ini dibuat berdasarkan proposal `SEMAI (Sistem Elektronik Monitoring dan Automasi Irigasi)` untuk kebutuhan web backend, database cloud, dan kendali jarak jauh via MQTT.

## Stack yang dipakai

- Node.js + Express untuk REST API
- PostgreSQL cloud untuk database
- `pg` sebagai database driver
- Siap dihubungkan ke MQTT Broker, ESP32, Node-RED, dan frontend dashboard
- Bisa bertindak sebagai MQTT bridge untuk manual control dari web ke ESP32

## Kenapa PostgreSQL cloud

Struktur data proyek SEMAI bersifat relasional:

- satu device greenhouse memiliki banyak data telemetry
- satu device memiliki beberapa actuator
- satu device memiliki aturan otomatisasi
- histori kontrol actuator perlu disimpan rapi

Cloud PostgreSQL cocok untuk ini. Kamu bisa pakai salah satu:

- Supabase
- Neon
- Railway PostgreSQL
- Render PostgreSQL

Yang penting, nanti isi `DATABASE_URL`.

## Struktur folder

```text
backend/
  database/
    schema.sql
    seed.sql
  src/
    repositories/
    routes/
    services/
    utils/
    app.js
    config.js
    db.js
    server.js
```

## Cara menjalankan

1. Install dependency:

```bash
npm install
```

2. Copy file environment:

```bash
cp .env.example .env
```

Di Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Isi `DATABASE_URL` dengan database cloud kamu.

Contoh:

```env
DATABASE_URL=postgresql://postgres:password@db-host:5432/semai_db?sslmode=require
```

4. Jalankan schema database dengan SQL editor dari provider cloud atau tool seperti DBeaver / psql:

- jalankan isi file `database/schema.sql`
- lalu opsional jalankan `database/seed.sql`

5. Isi environment MQTT jika ingin kendali jarak jauh:

```env
MQTT_ENABLED=true
MQTT_BROKER_URL=mqtts://your-cluster.s1.eu.hivemq.cloud:8883
MQTT_USERNAME=your-mqtt-username
MQTT_PASSWORD=your-mqtt-password
MQTT_CONTROL_TOPIC_MODE=per_device
MQTT_CONTROL_TOPIC_PREFIX=smartfarm/control
MQTT_TELEMETRY_TOPIC=smartfarm/telemetry
```

6. Jalankan server:

```bash
npm run dev
```

## Desain tabel

### `devices`

Menyimpan data perangkat greenhouse atau node ESP32.

Kolom utama:

- `code`
- `name`
- `location`
- `greenhouse_zone`

### `telemetry_readings`

Menyimpan data sensor historis:

- `soil_moisture`
- `air_temperature`
- `air_humidity`
- `light_intensity`
- `recorded_at`

### `actuator_states`

Menyimpan status terakhir tiap aktuator:

- `pump`
- `fan`
- `lamp`

### `actuator_logs`

Menyimpan histori perubahan kontrol aktuator.

### `automation_rules`

Menyimpan threshold otomatisasi sesuai proposal:

- pompa aktif jika `soil_moisture < 40`
- kipas aktif jika `air_temperature > 30`
- lampu aktif jika `light_intensity < 50`

## Endpoint API

### Health check

`GET /health`

### System Status

`GET /api/system/status`

Untuk mengecek apakah backend Render sudah tersambung ke MQTT broker.

### Login

`POST /api/auth/login`

Contoh body:

```json
{
  "email": "admin@semai.com",
  "password": "admin123"
}
```

### Devices

`GET /api/devices`

`POST /api/devices`

Contoh body:

```json
{
  "code": "GH-001",
  "name": "SEMAI Greenhouse 1",
  "location": "Lab IoT",
  "greenhouseZone": "Zona A"
}
```

### Telemetry

`GET /api/telemetry?deviceCode=GH-001&limit=20`

`GET /api/telemetry/export.csv?deviceCode=GH-001&limit=500`

`POST /api/telemetry`

Contoh body:

```json
{
  "deviceCode": "GH-001",
  "soilMoisture": 36.4,
  "airTemperature": 31.2,
  "airHumidity": 72.1,
  "lightIntensity": 44.7,
  "recordedAt": "2026-04-14T08:30:00.000Z"
}
```

Endpoint ini cocok dipakai oleh:

- Node-RED setelah subscribe dari MQTT
- service bridge MQTT ke HTTP
- simulator ESP32

### Actuator

`GET /api/actuators?deviceCode=GH-001`

`POST /api/actuators`

Contoh body:

```json
{
  "deviceCode": "GH-001",
  "actuatorType": "pump",
  "mode": "manual",
  "isOn": true,
  "source": "dashboard",
  "reason": "Manual override dari web"
}
```

Jika MQTT bridge aktif, endpoint ini juga akan publish command ke topic:

- Mode default (`MQTT_CONTROL_TOPIC_MODE=per_device`): `smartfarm/control/<deviceCode>`
- Mode single topic (`MQTT_CONTROL_TOPIC_MODE=single`): `smartfarm/control`

### Rules

`GET /api/rules?deviceCode=GH-001`

`PUT /api/rules`

Contoh body:

```json
{
  "deviceCode": "GH-001",
  "actuatorType": "fan",
  "thresholdValue": 30,
  "comparisonOperator": ">",
  "mode": "auto",
  "description": "Kipas aktif jika suhu lebih dari 30C"
}
```

## Mapping ke proposal

Backend ini sudah menyesuaikan bagian proposal:

- monitoring real-time data sensor
- histori data untuk grafik harian, mingguan, bulanan
- kontrol manual aktuator
- mode otomatis berbasis threshold
- data logging terstruktur di cloud database

## Saran integrasi arsitektur

Alur yang paling rapi untuk tugas ini:

1. ESP32 publish data sensor ke MQTT Broker atau langsung ke backend HTTP
2. Backend menyimpan telemetry ke PostgreSQL cloud
3. Frontend Vercel membaca data dari backend Render
4. User klik tombol manual di dashboard
5. Frontend kirim `POST /api/actuators`
6. Backend simpan status aktuator ke database
7. Backend publish command ke topic MQTT `smartfarm/control/<deviceCode>`
8. ESP32 subscribe topic itu lalu menyalakan atau mematikan relay

## Deploy online

### Render

File [render.yaml](C:/Users/ibnua/Documents/tugas2/tugas%20iot/render.yaml) sudah disiapkan.

Environment variable yang harus diisi di Render:

- `DATABASE_URL`
- `CORS_ORIGIN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `MQTT_ENABLED`
- `MQTT_BROKER_URL`
- `MQTT_USERNAME`
- `MQTT_PASSWORD`
- `MQTT_CONTROL_TOPIC_PREFIX`

Contoh `CORS_ORIGIN`:

```env
CORS_ORIGIN=http://localhost:5173,https://nama-app-kamu.vercel.app
```

### Vercel

Frontend ada di folder [frontend](C:/Users/ibnua/Documents/tugas2/tugas%20iot/frontend).

Sebelum deploy ke Vercel, ubah file [frontend/config.js](C:/Users/ibnua/Documents/tugas2/tugas%20iot/frontend/config.js) menjadi URL backend Render kamu:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://semai-backend.onrender.com"
};
```

## Langkah berikutnya

Kalau kamu mau, saya bisa lanjut bantu salah satu berikut:

1. buatkan endpoint autentikasi admin/login
2. buatkan file koleksi Postman
3. buatkan frontend dashboard React
4. buatkan flow Node-RED yang connect MQTT ke API ini
5. buatkan ERD dan penjelasan buat laporan tugas
