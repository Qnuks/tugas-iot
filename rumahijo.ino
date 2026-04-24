/*
 * ESP32 Smart Farm IoT System - SEMAI Integration
 *
 * Pin mapping:
 * DHT22      : GPIO 23
 * LDR        : GPIO 36
 * Soil       : GPIO 39
 * Relay pump : GPIO 32
 * Relay fan  : GPIO 33
 * Relay lamp : GPIO 25
 *
 * Library yang dibutuhkan:
 * - PubSubClient
 * - DHT sensor library
 * - ArduinoJson
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

// ─────────────────────────────────────────────
//  KONFIGURASI
// ─────────────────────────────────────────────

// WiFi
const char* WIFI_SSID = "PASTE_WIFI_SSID";
const char* WIFI_PASSWORD = "PASTE_WIFI_PASSWORD";

// Device identity
const char* DEVICE_CODE = "GH-001";
const char* DEVICE_NAME = "SEMAI Greenhouse 1";

// MQTT broker (HiveMQ Cloud)

const char* MQTT_SERVER = "24b895516e3c41819461709cadb10f17.s1.eu.hivemq.cloud";
const int MQTT_PORT = 8883;
const char* MQTT_CLIENT_ID = "semai-gh-001";
const char* MQTT_USER = "hivemq.webclient.1776926566936";
const char* MQTT_PASSWORD = "BYfP3h29>6Diy&cT*S#b";

// MQTT topics
const char* TOPIC_TELEMETRY = "smartfarm/telemetry";
const char* TOPIC_CONTROL = "smartfarm/control/GH-001";


// Backend API
const char* API_BASE_URL = "https://allowed-draws-vault-impression.trycloudflare.com";
const char* API_DEVICE_PATH = "/api/devices";
const char* API_TELEMETRY_PATH = "/api/telemetry";

// Telegram (opsional)
// Jangan hardcode token/chat id di file yang dibagikan. Kalau tidak dipakai, biarkan placeholder.
const char* TG_TOKEN = "8610550586:AAFvo3WEyFyWFYkCbKoa-LClKdjyjEx3uck";
const char* TG_CHAT_ID = "-5005126586";

// ─────────────────────────────────────────────
//  PIN DEFINITIONS
// ─────────────────────────────────────────────
#define DHTPIN 23
#define DHTTYPE DHT22
#define LDR_PIN 36
#define SOIL_PIN 39
#define RELAY_POMPA 32
#define RELAY_KIPAS 33
#define RELAY_LAMPU 25

// ─────────────────────────────────────────────
//  THRESHOLD
// ─────────────────────────────────────────────
#define SUHU_THRESHOLD 30.0   // °C  — kipas ON jika suhu > nilai ini
#define SOIL_THRESHOLD 40.0   // %   — pompa ON jika tanah < nilai ini
#define CAHAYA_THRESHOLD 50.0 // %   — lampu ON jika cahaya < nilai ini

// ─────────────────────────────────────────────
//  KALIBRASI ADC
// ─────────────────────────────────────────────
#define SOIL_KERING 3200
#define SOIL_BASAH 1100
#define LDR_GELAP 4095
#define LDR_TERANG 0

// ─────────────────────────────────────────────
//  TIMER (dalam milidetik)
// ─────────────────────────────────────────────
const unsigned long INTERVAL_BACA = 5000;       // baca sensor setiap 5 detik
const unsigned long DURASI_TRIGGER   = 10000;   // kondisi harus bertahan 10 detik → relay ON
const unsigned long DURASI_ON_POMPA  = 15000;   // pompa menyala minimal 15 detik
const unsigned long DURASI_ON_KIPAS  = 45000;   // kipas menyala minimal 45 detik
const unsigned long DURASI_ON_LAMPU  = 60000;   // lampu menyala minimal 60 detik
const unsigned long DURASI_COOLDOWN  = 120000;  // cooldown 120 detik setelah relay mati
const unsigned long INTERVAL_REGISTER_BACKEND = 15000;

// ─────────────────────────────────────────────
//  STATE MESIN UNTUK SETIAP RELAY
// ─────────────────────────────────────────────
enum RelayState {
  STATE_IDLE,      // normal, memantau kondisi
  STATE_TRIGGERED, // kondisi terpenuhi, menghitung waktu trigger
  STATE_ON,        // relay menyala, menghitung durasi ON
  STATE_COOLDOWN   // relay baru mati, dalam masa cooldown
};

// ─────────────────────────────────────────────
//  STRUCT: Data satu relay
// ─────────────────────────────────────────────
struct RelayControl {
  RelayState    state;
  unsigned long timerMulai;   // kapan state ini dimulai
  unsigned long durasiOn;     // durasi minimal ON (berbeda tiap relay)
  bool          statusOn;     // apakah relay sedang HIGH
};

// ─────────────────────────────────────────────
//  OBJEK
// ─────────────────────────────────────────────
DHT dht(DHTPIN, DHTTYPE);
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

// ─────────────────────────────────────────────
//  DATA RELAY
// ─────────────────────────────────────────────
RelayControl rcPompa = { STATE_IDLE, 0, DURASI_ON_POMPA, false };
RelayControl rcKipas = { STATE_IDLE, 0, DURASI_ON_KIPAS, false };
RelayControl rcLampu = { STATE_IDLE, 0, DURASI_ON_LAMPU, false };

// ─────────────────────────────────────────────
//  VARIABEL SENSOR & STATUS
// ─────────────────────────────────────────────
float suhu = 0;
float humUdara = 0;
float tanah = 0;
float cahaya = 0;

bool overrideKipas = false;
bool overridePompa = false;
bool overrideLampu = false;

bool statusKipas = false;
bool statusPompa = false;
bool statusLampu = false;

// Anti-spam Telegram — hanya kirim notif saat state berubah ON
bool notifKipas = false;
bool notifPompa = false;
bool notifLampu = false;

bool deviceRegistered = false;

unsigned long lastBaca = 0;
unsigned long lastRegisterAttempt = 0;

int postJson(const String& url, const String& jsonBody, const char* label) {
  if (WiFi.status() != WL_CONNECTED) return -1;

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(jsonBody);
  String response = http.getString();

  Serial.printf("[%s] HTTP %d\n", label, code);
  if (response.length() > 0) {
    Serial.printf("[%s] Response: %s\n", label, response.c_str());
  }

  http.end();
  return code;
}

// ═══════════════════════════════════════════════════════
//  TELEGRAM — Kirim notifikasi via HTTPClient
// ═══════════════════════════════════════════════════════
void kirimTelegram(String pesan) {
  if (WiFi.status() != WL_CONNECTED) return;
  if (String(TG_TOKEN).length() == 0 || String(TG_CHAT_ID).length() == 0) return;
  if (String(TG_TOKEN) == "PASTE_TELEGRAM_BOT_TOKEN") return;

  HTTPClient http;
  String url = "https://api.telegram.org/bot";
  url += TG_TOKEN;
  url += "/sendMessage?chat_id=";
  url += TG_CHAT_ID;
  url += "&text=";

  // Encode spasi dan karakter khusus
  pesan.replace(" ", "%20");
  pesan.replace("\n", "%0A");
  url += pesan;

  http.begin(url);
  int code = http.GET();
  Serial.printf("[Telegram] HTTP %d\n", code);
  http.end();
}

// ═══════════════════════════════════════════════════════
//  WIFI — Koneksi & reconnect
// ═══════════════════════════════════════════════════════
void registerDeviceToBackend() {
  if (WiFi.status() != WL_CONNECTED) return;

  StaticJsonDocument<192> doc;
  doc["code"] = DEVICE_CODE;
  doc["name"] = DEVICE_NAME;
  doc["location"] = "Lab IoT";
  doc["greenhouseZone"] = "Zona A";

  String body;
  serializeJson(doc, body);

  String url = String(API_BASE_URL) + API_DEVICE_PATH;
  int code = postJson(url, body, "API-DEVICE");
  deviceRegistered = code >= 200 && code < 300;
}

void kirimTelemetryKeBackend() {
  if (WiFi.status() != WL_CONNECTED) return;

  StaticJsonDocument<256> doc;
  doc["deviceCode"] = DEVICE_CODE;
  doc["soilMoisture"] = serialized(String(tanah, 1));
  doc["airTemperature"] = serialized(String(suhu, 1));
  doc["airHumidity"] = serialized(String(humUdara, 1));
  doc["lightIntensity"] = serialized(String(cahaya, 1));

  String body;
  serializeJson(doc, body);

  String url = String(API_BASE_URL) + API_TELEMETRY_PATH;
  postJson(url, body, "API-TELEMETRY");
}

void koneksiWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("\n[WiFi] Menghubungkan ke: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.printf("\n[WiFi] Terhubung. IP: %s\n", WiFi.localIP().toString().c_str());
}

// ═══════════════════════════════════════════════════════
//  MQTT CALLBACK — terima perintah override dari dashboard
//  Payload JSON: {"kipas":true} / {"pompa":false} / dll
// ═══════════════════════════════════════════════════════
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String pesan = "";
  for (unsigned int i = 0; i < length; i++) {
    pesan += (char)payload[i];
  }

  Serial.printf("[MQTT] Terima | %s | %s\n", topic, pesan.c_str());

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, pesan);
  if (err) {
    Serial.printf("[MQTT] JSON error: %s\n", err.c_str());
    return;
  }

  // Override langsung nyalakan/matikan relay, abaikan timer
  if (doc.containsKey("kipas")) {
    overrideKipas = doc["kipas"].as<bool>();
    if (overrideKipas) {
      digitalWrite(RELAY_KIPAS, HIGH);
      rcKipas.statusOn = true;
      rcKipas.state = STATE_ON;
      rcKipas.timerMulai = millis();
      Serial.println("[Override] Kipas manual ON");
    } else {
      digitalWrite(RELAY_KIPAS, LOW);
      rcKipas.statusOn = false;
      rcKipas.state = STATE_COOLDOWN;
      rcKipas.timerMulai = millis();
      Serial.println("[Override] Kipas manual OFF -> cooldown");
    }
  }

  if (doc.containsKey("pompa")) {
    overridePompa = doc["pompa"].as<bool>();
    if (overridePompa) {
      digitalWrite(RELAY_POMPA, HIGH);
      rcPompa.statusOn = true;
      rcPompa.state = STATE_ON;
      rcPompa.timerMulai = millis();
      Serial.println("[Override] Pompa manual ON");
    } else {
      digitalWrite(RELAY_POMPA, LOW);
      rcPompa.statusOn = false;
      rcPompa.state = STATE_COOLDOWN;
      rcPompa.timerMulai = millis();
      Serial.println("[Override] Pompa manual OFF -> cooldown");
    }
  }

  if (doc.containsKey("lampu")) {
    overrideLampu = doc["lampu"].as<bool>();
    if (overrideLampu) {
      digitalWrite(RELAY_LAMPU, HIGH);
      rcLampu.statusOn = true;
      rcLampu.state = STATE_ON;
      rcLampu.timerMulai = millis();
      Serial.println("[Override] Lampu manual ON");
    } else {
      digitalWrite(RELAY_LAMPU, LOW);
      rcLampu.statusOn = false;
      rcLampu.state = STATE_COOLDOWN;
      rcLampu.timerMulai = millis();
      Serial.println("[Override] Lampu manual OFF -> cooldown");
    }
  }
}

// ═══════════════════════════════════════════════════════
//  MQTT — Koneksi & reconnect + subscribe
// ═══════════════════════════════════════════════════════
void koneksiMQTT() {
  while (!mqttClient.connected()) {
    Serial.printf("[MQTT] Konek ke %s...\n", MQTT_SERVER);
    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD)) {
      Serial.println("[MQTT] Terhubung");
      mqttClient.subscribe(TOPIC_CONTROL);
      Serial.printf("[MQTT] Subscribe: %s\n", TOPIC_CONTROL);
    } else {
      Serial.printf("[MQTT] Gagal rc=%d, coba lagi 3 detik...\n", mqttClient.state());
      delay(3000);
    }
  }
}

// ═══════════════════════════════════════════════════════
//  BACA SENSOR
// ═══════════════════════════════════════════════════════
void bacaSensor() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (!isnan(t)) suhu = t;
  if (!isnan(h)) humUdara = h;

  int rawSoil = analogRead(SOIL_PIN);
  tanah = constrain(map(rawSoil, SOIL_KERING, SOIL_BASAH, 0, 100), 0, 100);

  int rawLDR = analogRead(LDR_PIN);
  cahaya = constrain(map(rawLDR, LDR_GELAP, LDR_TERANG, 0, 100), 0, 100);

  Serial.printf("[Sensor] Suhu: %.1f C | Hum: %.1f %% | Tanah: %.1f %% | Cahaya: %.1f %%\n",
                suhu, humUdara, tanah, cahaya);
}

// ═══════════════════════════════════════════════════════
//  STATE MACHINE — Update satu relay
//
//  Alur state:
//
//  IDLE ──(kondisi terpenuhi)──► TRIGGERED
//    └─(kondisi tidak terpenuhi, reset)──► IDLE
//
//  TRIGGERED ──(sudah 10 detik terus-menerus)──► ON (relay HIGH)
//    └─(kondisi sempat normal, reset)──► IDLE
//
//  ON ──(durasi minimal tercapai DAN kondisi sudah normal)──► COOLDOWN (relay LOW)
//    └─(durasi minimal belum tercapai)──► tetap ON
//
//  COOLDOWN ──(120 detik selesai)──► IDLE
// ═══════════════════════════════════════════════════════
void updateRelay(RelayControl &rc, int pin, bool kondisiTerpenuhi,
                 bool overrideOn, bool &notifFlag,
                 const char* namaRelay, String pesanNotif) {

  unsigned long now = millis();
  
  // ── Override aktif: bypass semua state machine ──────
  // (relay sudah di-handle langsung di callback MQTT)
  if (overrideOn) return;

  switch (rc.state) {
    // ── IDLE: pantau apakah kondisi mulai terpenuhi ──
    case STATE_IDLE:
      if (kondisiTerpenuhi) {
        rc.state = STATE_TRIGGERED;
        rc.timerMulai = now;
        Serial.printf("[%s] Kondisi terpenuhi, mulai hitung trigger\n", namaRelay);
      }
      break;
    // ── TRIGGERED: hitung apakah kondisi bertahan 10 detik ──
    case STATE_TRIGGERED:
      if (!kondisiTerpenuhi) {
        rc.state = STATE_IDLE;
        Serial.printf("[%s] Kondisi tidak bertahan, reset ke IDLE\n", namaRelay);
      } else if (now - rc.timerMulai >= DURASI_TRIGGER) {
        digitalWrite(pin, HIGH);
        rc.statusOn = true;
        rc.state = STATE_ON;
        rc.timerMulai = now;
        Serial.printf("[%s] Trigger terpenuhi -> relay ON\n", namaRelay);

        if (!notifFlag) {
          kirimTelegram(pesanNotif);
          notifFlag = true;
        }
      }
      break;
    // ── ON: relay menyala, tunggu durasi minimal selesai ──  
    case STATE_ON:
      if (now - rc.timerMulai >= rc.durasiOn) {
        if (!kondisiTerpenuhi) {
          digitalWrite(pin, LOW);
          rc.statusOn = false;
          rc.state = STATE_COOLDOWN;
          rc.timerMulai = now;
          notifFlag = false;
          Serial.printf("[%s] Kondisi normal -> relay OFF -> cooldown\n", namaRelay);
        }
      }
      break;

    case STATE_COOLDOWN:
      if (now - rc.timerMulai >= DURASI_COOLDOWN) {
        rc.state = STATE_IDLE;
        Serial.printf("[%s] Cooldown selesai -> kembali IDLE\n", namaRelay);
      }
      break;
  }
}

// ═══════════════════════════════════════════════════════
//  KONTROL SEMUA RELAY
// ═══════════════════════════════════════════════════════
void kontrolRelay() {
  updateRelay(
    rcKipas,
    RELAY_KIPAS,
    suhu > SUHU_THRESHOLD,
    overrideKipas,
    notifKipas,
    "KIPAS",
    "Kipas ON\nAlasan: Suhu " + String(suhu, 1) + "C > " + String(SUHU_THRESHOLD, 0) + "C selama 10 detik"
  );
  // Pompa — kondisi: tanah < 40%
  updateRelay(
    rcPompa,
    RELAY_POMPA,
    tanah < SOIL_THRESHOLD,
    overridePompa,
    notifPompa,
    "POMPA",
    "Pompa ON\nAlasan: Tanah " + String(tanah, 1) + "% < " + String(SOIL_THRESHOLD, 0) + "% selama 10 detik"
  );
  // Lampu — kondisi: cahaya < 50%
  updateRelay(
    rcLampu,
    RELAY_LAMPU,
    cahaya < CAHAYA_THRESHOLD,
    overrideLampu,
    notifLampu,
    "LAMPU",
    "Lampu ON\nAlasan: Cahaya " + String(cahaya, 1) + "% < " + String(CAHAYA_THRESHOLD, 0) + "% selama 10 detik"
  );
}

// ═══════════════════════════════════════════════════════
//  PUBLISH DATA KE MQTT
// ═══════════════════════════════════════════════════════
void publishData() {
  const char* stateLabel[] = { "IDLE", "TRIGGERED", "ON", "COOLDOWN" };

  StaticJsonDocument<512> doc;
  doc["deviceCode"] = DEVICE_CODE;
  doc["deviceName"] = DEVICE_NAME;
  doc["airTemperature"] = serialized(String(suhu, 1));
  doc["airHumidity"] = serialized(String(humUdara, 1));
  doc["soilMoisture"] = serialized(String(tanah, 1));
  doc["lightIntensity"] = serialized(String(cahaya, 1));
  doc["fanStatus"] = rcKipas.statusOn;
  doc["pumpStatus"] = rcPompa.statusOn;
  doc["lampStatus"] = rcLampu.statusOn;
  doc["fanState"] = stateLabel[rcKipas.state];
  doc["pumpState"] = stateLabel[rcPompa.state];
  doc["lampState"] = stateLabel[rcLampu.state];
  doc["overrideFan"] = overrideKipas;
  doc["overridePump"] = overridePompa;
  doc["overrideLamp"] = overrideLampu;

  char buffer[512];
  serializeJson(doc, buffer);

  bool ok = mqttClient.publish(TOPIC_TELEMETRY, buffer);
  Serial.printf("[MQTT] Publish %s -> %s\n", ok ? "OK" : "GAGAL", buffer);

  kirimTelemetryKeBackend();
}

// ═══════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 Smart Farm - SEMAI ===");

  pinMode(RELAY_POMPA, OUTPUT);
  pinMode(RELAY_KIPAS, OUTPUT);
  pinMode(RELAY_LAMPU, OUTPUT);
  digitalWrite(RELAY_POMPA, LOW);
  digitalWrite(RELAY_KIPAS, LOW);
  digitalWrite(RELAY_LAMPU, LOW);

  dht.begin();

  koneksiWiFi();

  espClient.setInsecure();
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  koneksiMQTT();

  registerDeviceToBackend();

  Serial.println("[System] Siap");
}
// ═══════════════════════════════════════════════════════
//  LOOP UTAMA — tanpa delay(), pakai millis()
// ═══════════════════════════════════════════════════════
void loop() {
  koneksiWiFi();

  if (!mqttClient.connected()) {
    koneksiMQTT();
  }
  mqttClient.loop();

  unsigned long now = millis();

  if (!deviceRegistered && now - lastRegisterAttempt >= INTERVAL_REGISTER_BACKEND) {
    lastRegisterAttempt = now;
    registerDeviceToBackend();
  }

  if (now - lastBaca >= INTERVAL_BACA) {
    lastBaca = now;
    bacaSensor();
  }
  // kontrolRelay dipanggil setiap loop (bukan hanya setiap 5 detik)
  // agar state machine timer tetap akurat
  kontrolRelay();

  static unsigned long lastPublish = 0;
  if (now - lastPublish >= INTERVAL_BACA) {
    lastPublish = now;
    publishData();
  }
}
