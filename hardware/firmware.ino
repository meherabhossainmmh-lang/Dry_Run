/*
 * Team Straw Hat — 7-servo robotic-arm firmware (ESP32 + Wi-Fi, Wokwi PoC)
 *
 * Phase 5 electrical PoC: a servo-driven arm REMOTELY CONTROLLED OVER WI-FI.
 * The ESP32 joins Wi-Fi and runs a TCP server on :8080 that accepts the joint
 * vector (radians) — the same q[] the web app prints — so the browser pipeline
 * can drive the physical arm over the network. Until a client sends a pose, the
 * arm runs a slow demo sweep so the servos visibly move.
 *
 * Joint order mirrors src/core/chain.ts exactly:
 *   1 base yaw · 2 shoulder · 3 elbow · 4 forearm roll · 5 wrist pitch ·
 *   6 tool roll · 7 stylus pitch
 */
#include <WiFi.h>
#include <ESP32Servo.h>

const int NJ = 7;
// PWM-capable GPIOs on the ESP32 DevKit (one per joint).
const int PINS[NJ] = { 13, 12, 14, 27, 26, 25, 33 };

// Joint limits (radians) — transcribed from src/core/chain.ts.
const float LOWER[NJ] = { -3.1416f, -2.0944f, -2.6180f, -3.1416f, -2.0944f, -3.1416f, -2.0944f };
const float UPPER[NJ] = {  3.1416f,  2.0944f,  2.6180f,  3.1416f,  2.0944f,  3.1416f,  2.0944f };
const char* LABEL[NJ] = { "base", "shoulder", "elbow", "forearm", "wrist", "tool", "stylus" };

Servo servos[NJ];
float q[NJ] = { 0, 0, 0, 0, 0, 0, 0 };
bool haveTarget = false;

WiFiServer server(8080);

// Map a joint angle (rad) within its limits onto a 0-180 servo command.
int toServoDeg(int j, float rad) {
  float v = rad;
  if (v < LOWER[j]) v = LOWER[j];
  if (v > UPPER[j]) v = UPPER[j];
  return (int)((v - LOWER[j]) / (UPPER[j] - LOWER[j]) * 180.0f + 0.5f);
}

void applyQ() {
  for (int j = 0; j < NJ; j++) servos[j].write(toServoDeg(j, q[j]));
}

// Parse "[a, b, c, d, e, f, g]" (radians) into q[]. Returns true on 7 values.
bool parseVector(const String& line) {
  int idx = 0, i = 0, n = line.length();
  while (i < n && idx < NJ) {
    while (i < n && !(isDigit(line[i]) || line[i] == '-' || line[i] == '+' || line[i] == '.')) i++;
    if (i >= n) break;
    int start = i;
    while (i < n && (isDigit(line[i]) || line[i] == '-' || line[i] == '+' ||
                     line[i] == '.' || line[i] == 'e' || line[i] == 'E')) i++;
    q[idx++] = line.substring(start, i).toFloat();
  }
  return idx == NJ;
}

void setup() {
  Serial.begin(115200);
  for (int j = 0; j < NJ; j++) servos[j].attach(PINS[j]);
  applyQ();

  Serial.print(F("Connecting to Wi-Fi"));
  WiFi.begin("Wokwi-GUEST", "");
  while (WiFi.status() != WL_CONNECTED) { delay(250); Serial.print('.'); }
  Serial.println();
  Serial.print(F("Straw Hat arm online over Wi-Fi @ "));
  Serial.println(WiFi.localIP());
  Serial.println(F("Send [j1..j7] radians to TCP :8080, or watch the sweep."));
  server.begin();
}

unsigned long lastMove = 0;
float phase = 0;

void loop() {
  // Wi-Fi command path: a client sends the joint vector over the network.
  WiFiClient client = server.available();
  if (client) {
    String line = client.readStringUntil('\n');
    if (parseVector(line)) {
      haveTarget = true;
      applyQ();
      client.print(F("set:"));
      for (int j = 0; j < NJ; j++) {
        client.print(' '); client.print(LABEL[j]);
        client.print('='); client.print(toServoDeg(j, q[j]));
      }
      client.println();
    } else {
      client.println(F("parse error — expected 7 numbers, e.g. [0,1.15,0.75,0,0.95,0,0.45]"));
    }
    client.stop();
  }

  // Idle demo sweep until a Wi-Fi pose arrives.
  if (!haveTarget && millis() - lastMove > 20) {
    lastMove = millis();
    phase += 0.02f;
    for (int j = 0; j < NJ; j++) {
      float mid = (LOWER[j] + UPPER[j]) * 0.5f;
      float amp = (UPPER[j] - LOWER[j]) * 0.35f;
      q[j] = mid + amp * sin(phase + j * 0.6f);
    }
    applyQ();
  }
}
