# Frontend SEMAI

Frontend ini dibuat mengikuti referensi tampilan login dan dashboard yang kamu kirim.

## Fitur

- halaman login
- dashboard monitoring sensor
- manual override untuk kipas, pompa, dan lampu
- status MQTT online/offline sederhana
- export data CSV

## API yang dipakai

- `POST /api/auth/login`
- `GET /api/telemetry`
- `GET /api/telemetry/export.csv`
- `GET /api/actuators`
- `POST /api/actuators`

## Cara pakai

Karena frontend ini berbentuk HTML/CSS/JS sederhana, kamu bisa menjalankannya dengan server statis apa pun.

Contoh paling mudah dari folder `frontend`:

```powershell
python -m http.server 5173
```

Lalu buka:

`http://localhost:5173`

## Konfigurasi backend

Kalau backend tidak jalan di `http://localhost:3000`, ubah nilai `API_BASE_URL` di file:

- [frontend/config.js](C:/Users/ibnua/Documents/tugas2/tugas%20iot/frontend/config.js)

Contoh untuk backend Render:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://semai-backend.onrender.com"
};
```

## Login default

- email: `admin@semai.com`
- password: `admin123`

Kredensial ini bisa kamu ganti dari backend `.env`.
