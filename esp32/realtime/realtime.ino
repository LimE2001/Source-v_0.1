#include <DHTesp.h>
#include <PubSubClient.h>
#include <Arduino_JSON.h>
#include <WiFi.h>
#include <WebServer.h>
#include <EEPROM.h>
#include <math.h>

DHTesp dht;
WiFiClient espClient;
PubSubClient client(espClient);
WebServer server(80);

struct settings {
  char ssid[30];
  char password[30];
} user_wifi = {};

#define subConnect "connectSuccess"
#define sub2 "RESET"
#define sub15 "AUTO"
#define sub4 "DEV1"
#define sub17 "DEV2"
#define sub18 "DEV3"
#define sub21 "DEV4"
#define sub22 "DEV5"
#define sub23 "DEV6"
#define DHTPIN 5  // GPIO5
#define DHTTYPE DHTesp::DHT11

#define RESETWIFI 2
#define AUTO 15
#define DEV1 4
#define DEV2 17
#define DEV3 18
#define DEV4 21
#define DEV5 22
#define DEV6 23


const char* mqtt_server = "net-radio.vov.link";
const int mqttPort = 1883;
int cout = 0;
int timeLoop = 1000;
int timeMQTT = 1000;
int state_auto, state_0, state_1, state_2, state_3, state_4, state_5, state_6, state_7;
int temperature;
int humidity;
int light;
int soil1;
int soil2;
int uv;
const uint32_t boardId = ESP.getEfuseMac();

unsigned long previousMillisLoop = 0;
const unsigned long intervalLoop = 100;

unsigned long previousMillisDataPin = 0;
const unsigned long intervalDataPin = 500;

unsigned long previousMillisDataSensor = 0;
const unsigned long intervalDataSensor = 3000;

void setup() {
  Serial.begin(115200);

  pinMode(RESETWIFI, OUTPUT);
  pinMode(AUTO, OUTPUT);
  pinMode(DEV1, OUTPUT);
  pinMode(DEV2, OUTPUT);
  pinMode(DEV3, OUTPUT);
  pinMode(DEV4, OUTPUT);
  pinMode(DEV5, OUTPUT);
  pinMode(DEV6, OUTPUT);

  setupWifi();

  client.setServer(mqtt_server, 1883);
  client.setCallback(callBackMqtt);

  dht.setup(DHTPIN, DHTTYPE);
}

void loop() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillisLoop >= intervalLoop) {

    server.handleClient();

    client.loop();

    if (WiFi.status() == WL_CONNECTED) {
      if (!client.connected()) {
        JSONVar connectDevice;
        Serial.print("Connect Wifi OK\n");
        digitalWrite(RESETWIFI, LOW);
        reconnectMQTT();
        Serial.print("Connect MQTT OK\n");
        connectDevice["boardId"] = boardId;
        connectDevice["name"] = "The smart device";
        String device = JSON.stringify(connectDevice);
        client.publish("connectDevice", device.c_str());
      } else {
        if (currentMillis - previousMillisDataPin >= intervalDataPin) {
          handledDataPin();
          previousMillisDataPin = currentMillis;
        }
        if (currentMillis - previousMillisDataSensor >= intervalDataSensor) {
          handledDataSensor();
          previousMillisDataSensor = currentMillis;
        }
      }
    } else {
      resetWifi();
    }
    previousMillisLoop = currentMillis;
  }
}

void setupWifi() {
  EEPROM.begin(sizeof(struct settings));
  EEPROM.get(0, user_wifi);

  WiFi.mode(WIFI_STA);
  WiFi.begin(user_wifi.ssid, user_wifi.password);

  byte tries = 0;
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(RESETWIFI, HIGH);
    delay(500);
    Serial.print("Connect Wifi!!!\n");
    digitalWrite(RESETWIFI, LOW);
    delay(500);

    if (tries++ > 20) {
      Serial.print("Connect Wifi Faill!!!");
      resetWifi();
      break;
    }
  }
  server.on("/", handlePortal);
  server.begin();
}

void resetWifi() {

  digitalWrite(RESETWIFI, HIGH);

  WiFi.mode(WIFI_AP);
  WiFi.softAP("LimE-PTIT", "password");
}

void handlePortal() {

  if (server.method() == HTTP_POST) {

    strncpy(user_wifi.ssid, server.arg("ssid").c_str(), sizeof(user_wifi.ssid));
    strncpy(user_wifi.password, server.arg("password").c_str(), sizeof(user_wifi.password));
    user_wifi.ssid[server.arg("ssid").length()] = user_wifi.password[server.arg("password").length()] = '\0';
    EEPROM.put(0, user_wifi);
    EEPROM.commit();

    server.send(200, "text/html", "<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'><title>Wifi Setup</title> <style>body{font-family: Verdana;line-height:1.5;color:#212529;background: linear-gradient(to right, #e2e2e2, #c9d6ff);display: flex;align-items: center;justify-content: center;}h1{margin: 0px;text-align: center;}.setup h1{margin-top:-100px;margin-bottom: 20px;}p{font-size: 14px;margin: 20px;text-align: center;}.form-signin{border-radius: 30px;width:800px;height: 450px;margin-top:100px;background-color: #fff;display: flex;}.hello{width: 50%;color: #fff;border-radius: 150px 30px 30px 100px;background: linear-gradient(to right, #5c6bc0, #512da8);display: flex;flex-direction: column;align-items: center;justify-content: center;}.setup{width: 50%;display: flex;flex-direction: column;align-items: center;justify-content: center;}.button{cursor: pointer;text-align: center;text-decoration: none;border:1px solid transparent;color:#fff;background-color:#512da8;border-color:#1f0068;padding:.5rem 1rem;font-size:1.25rem;line-height:1.5;border-radius:1rem;width:30%;}.button:hover{background-color: #4013ac;}</style></head> <body><main class='form-signin'><div class='setup'> <h1 class=''>WIFI SETUP</h1><br/><br/><p>Successful wifi setup - press the reset button on the device!!!</p><a href='https://www.facebook.com/NGUYENTHANHLIEM.1512' style='color: #fff' class='button'><strong>OKK!!!</strong></a></div><div class='hello'><h1>SEE YOU AGAIN!!!</h1><p>Thank you for using LimE's services</p><a href='https://www.facebook.com/NGUYENTHANHLIEM.1512' style='color: #fff'><strong>&copy;LimE-PTIT</strong></a></div></main></body></html>");
  } else {
    server.send(200, "text/html", "<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'><title>Wifi Setup</title><style>*,::after,::before{box-sizing:border-box;}body{font-family: Verdana;line-height:1.5;color:#212529;background: linear-gradient(to right, #e2e2e2, #c9d6ff);display: flex;align-items: center;justify-content: center;}h1{margin: 0px;}p{font-size: 14px;margin: 20px;text-align: center;}.form-signin{border-radius: 30px;width:800px;height: 450px;margin-top:100px;background-color: #fff;display: flex;}.hello{width: 50%;color: #fff;border-radius: 30px 150px 100px 30px;background: linear-gradient(to right, #5c6bc0, #512da8);display: flex;flex-direction: column;align-items: center;justify-content: center;}.setup{width: 50%;display: flex;flex-direction: column;align-items: center;justify-content: center;}input{background-color: #eee;display:block;width: 80%;font-size: 15px;height:calc(1.5em + .75rem + 2px);border:1px solid #ced4da;border-radius:0.5rem;padding: 20px 15px;}button{cursor: pointer;border:1px solid transparent;color:#fff;background-color:#512da8;border-color:#1f0068;padding:.5rem 1rem;font-size:1.25rem;line-height:1.5;border-radius:1rem;width:50%;}button:hover{background-color: #4013ac;}</style></head><body><main class='form-signin'> <div class='hello'><h1>Hello-PTIT!!!</h1><p>Please fill in the values to set up wifi<br/>for your system</p><a href='https://www.facebook.com/NGUYENTHANHLIEM.1512' style='color: #fff'><strong>&copy;LimE-PTIT</strong></a></div><form action='/' method='post' class='setup'><h1 class=''>WIFI SETUP</h1><br/><br/><br/><input type='text' name='ssid' placeholder='SSID'><br/><input type='password' name='password' placeholder='Password'></div><br/><button type='submit'>Save</button></form></main> </body></html>");
  }
}

void reconnectMQTT() {
  while (!client.connected()) {
    Serial.println("MQTT connectting...");

    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);

    if (client.connect(clientId.c_str())) {
      client.subscribe(subConnect);
      client.subscribe(sub2);
      client.subscribe(sub15);
      client.subscribe(sub4);
      client.subscribe(sub17);
      client.subscribe(sub18);
      client.subscribe(sub21);
      client.subscribe(sub22);
      client.subscribe(sub23);
    } else {
      digitalWrite(AUTO, HIGH);
      Serial.println("MQTT CONNECT FAILL, Try again in 1 seconds");
      delay(500);
      digitalWrite(AUTO, LOW);
      delay(500);
    }
  }
}

void handledDataPin() {
  JSONVar dataPin;
  state_auto = digitalRead(15);
  state_0 = digitalRead(2);
  state_1 = digitalRead(4);
  state_2 = digitalRead(17);
  state_3 = digitalRead(18);
  state_4 = digitalRead(21);
  state_5 = digitalRead(22);
  state_6 = digitalRead(23);

  dataPin["state_auto"] = state_auto;
  dataPin["state_1"] = state_1;
  dataPin["state_2"] = state_2;
  dataPin["state_3"] = state_3;
  dataPin["state_4"] = state_4;
  dataPin["state_5"] = state_5;
  dataPin["state_6"] = state_6;

  Serial.println(dataPin);
  String jsonString1 = JSON.stringify(dataPin);
  client.publish("dataPin", jsonString1.c_str());
  // delay(500);
}

void handledDataSensor() {
  JSONVar dataSensor;
  temperature = dht.getTemperature();
  humidity = dht.getHumidity();
  uv = analogRead(A0);
  light = ((4200.0 - analogRead(A6)) / 4200.0) * 100.0;
  light = roundf(light * 10) / 10.0;

  soil1 = ((2600.0 - analogRead(A3)) / 2600.0) * 100.0;
  soil1 = roundf(soil1 * 10) / 10.0;

  soil2 = ((2600.0 - analogRead(A7)) / 2600.0) * 100.0;
  soil2 = roundf(soil2 * 10) / 10.0;

  dataSensor["temperature"] = temperature;
  dataSensor["humidity"] = humidity;
  dataSensor["light"] = light;
  dataSensor["uv"] = uv;
  dataSensor["soil1"] = soil1;
  dataSensor["soil2"] = soil2;

  Serial.println(dataSensor);
  String jsonString = JSON.stringify(dataSensor);
  client.publish("dataSensor", jsonString.c_str());
  // delay(3000);
}

void callBackMqtt(char* topic, byte* payload, unsigned int length) {
  Serial.print(topic);
  if (strstr(topic, subConnect)) {
    for (int i = 0; i < length; i++) {
      Serial.print((char)payload[i]);
    }
    Serial.println();
    if ((char)payload[0] == '1') {
      Serial.print("Connected server");
      digitalWrite(AUTO, HIGH);
      digitalWrite(RESETWIFI, HIGH);
      digitalWrite(DEV1, HIGH);
      digitalWrite(DEV2, HIGH);
      digitalWrite(DEV3, HIGH);
      digitalWrite(DEV4, HIGH);
      digitalWrite(DEV5, HIGH);
      digitalWrite(DEV6, HIGH);
      delay(1000);
      digitalWrite(AUTO, LOW);
      digitalWrite(RESETWIFI, LOW);
      digitalWrite(DEV1, LOW);
      digitalWrite(DEV2, LOW);
      digitalWrite(DEV3, LOW);
      digitalWrite(DEV4, LOW);
      digitalWrite(DEV5, LOW);
      digitalWrite(DEV6, LOW);
    }
  } else if (strstr(topic, sub2)) {
    for (int i = 0; i < length; i++) {
      Serial.print((char)payload[i]);
    }
    Serial.println();
    if ((char)payload[0] == '1') {

      Serial.print("Reseted Wifi!!!");
      resetWifi();
    }
  } else if (strstr(topic, sub15)) {
    for (int i = 0; i < length; i++) {
      Serial.print((char)payload[i]);
    }
    if ((char)payload[0] == '0') {
      digitalWrite(AUTO, LOW);
    } else {
      digitalWrite(AUTO, HIGH);
    }
  } else if (strstr(topic, sub4)) {
    for (int i = 0; i < length; i++) {
      Serial.print((char)payload[i]);
    }
    if ((char)payload[0] == '0') {
      digitalWrite(DEV1, LOW);
    } else {
      digitalWrite(DEV1, HIGH);
    }
  } else if (strstr(topic, sub17)) {
    for (int i = 0; i < length; i++) {
      Serial.print((char)payload[i]);
    }
    if ((char)payload[0] == '0') {
      digitalWrite(DEV2, LOW);
    } else {
      digitalWrite(DEV2, HIGH);
    }
  } else if (strstr(topic, sub18)) {
    for (int i = 0; i < length; i++) {
      Serial.print((char)payload[i]);
    }
    if ((char)payload[0] == '0') {
      digitalWrite(DEV3, LOW);
    } else {
      digitalWrite(DEV3, HIGH);
    }
  } else if (strstr(topic, sub21)) {
    for (int i = 0; i < length; i++) {
      Serial.print((char)payload[i]);
    }
    if ((char)payload[0] == '0') {
      digitalWrite(DEV4, LOW);
    } else {
      digitalWrite(DEV4, HIGH);
    }
  } else if (strstr(topic, sub22)) {
    for (int i = 0; i < length; i++) {
      Serial.print((char)payload[i]);
    }
    if ((char)payload[0] == '0') {
      digitalWrite(DEV5, LOW);
    } else {
      digitalWrite(DEV5, HIGH);
    }
  } else if (strstr(topic, sub23)) {
    for (int i = 0; i < length; i++) {
      Serial.print((char)payload[i]);
    }
    if ((char)payload[0] == '0') {
      digitalWrite(DEV6, LOW);
    } else {
      digitalWrite(DEV6, HIGH);
    }
  }
}
