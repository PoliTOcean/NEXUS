#define LED 23
#define GO "GO"
#define MAXS 50
#define STATUS "STATUS"
#define UPLOAD_DATA "CONNECTED_W_DATA"
#define STOP_DATA "STOP_DATA"
#include <string.h>

int list = 0;
int run = 0;
int upd = 0;
int param_mode = 0;  // modalità ricezione parametri
int param_count = 0; // contatore parametri ricevuti
float Kp = 0.0, Ki = 0.0, Kd = 0.0;
unsigned long time_immersion = 0;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(115200);
  Serial.onReceive(handler);
  pinMode(0, INPUT);
  randomSeed(analogRead(0));  // inizializza random per batteria e pressione
}

void processInput(char str[MAXS]) {
  Serial.print("Received command: ");
  Serial.println(str);
  
  if (strncmp(str, "PARAMS", 6) == 0) {
    float kp_val, kd_val, ki_val;
    // prova a leggere i 3 float dalla stringa dopo "PARAMS"
    if (sscanf(str + 6, "%f %f %f", &kp_val, &kd_val, &ki_val) == 3) {
      Kp = kp_val;
      Kd = kd_val;
      Ki = ki_val;
      Serial.print("Received PID values: Kp=");
      Serial.print(Kp);
      Serial.print(", Ki=");
      Serial.print(Ki);
      Serial.print(", Kd=");
      Serial.println(Kd);
    }
  }
  else if (strcmp(str, "SEND_PACKAGE") == 0) {
      String jsonString = "{\"company_number\": \"EX_01\", \"depth\":" + String(30.5, 3) + 
                          ", \"mseconds\":" + String(10)  +
                          ", \"pressure\":\"" + String(100) + "\" }";
      Serial.println(jsonString);
      return;
  }
  else if (strcmp(str, "SWITCH_AUTO_MODE") == 0) {
      Serial.println("AUTO_MODE changed");
      return;
  }
  else if (strcmp(str, "TRY_UPLOAD") == 0) {
      Serial.println("Upload initiated");
      return;
  }
  else if (strcmp(str, "BALANCE") == 0) {
      Serial.println("Balance operation started");
      return;
  }
  else if (strcmp(str, "CLEAR_SD") == 0) {
      Serial.println("SD card cleared");
      return;
  }
  else if (strcmp(str, "HOME_MOTOR") == 0) {
      Serial.println("Motor homed");
      return;
  }
  else if (strcmp(str, GO) == 0 && !run) {
    digitalWrite(LED, HIGH);
    run = 1;
    Serial.println("GO command received");
    return;
  }
  else if (strcmp(str, STATUS) == 0) {
    if (upd) {
      Serial.println(UPLOAD_DATA);
    } else if (run) {
      Serial.println("EXECUTING_CMD");
      return;
    } else {
      Serial.print("CONNECTED");
    }
  }
  else if (strcmp(str, "LISTENING") == 0) {
    list = 1;
    Serial.println("LISTENING mode activated");
    return;
  }
  
  Serial.print("| CONN_OK ");
  
  Serial.print("| ");
  int battery = random(11500, 12601);
  Serial.print("BATTERY: ");
  Serial.println(battery);
}


void handler() {
  char buffer[MAXS];
  int bufferIndex = 0;
  while (Serial.available() != 0) {
    char c = Serial.read();
    while (c != '\n' && Serial.available() != 0){
      buffer[bufferIndex++] = c;
      c = Serial.read();
    }
    buffer[bufferIndex] = '\0';
    bufferIndex = 0;
    processInput(buffer);
  }
}

void loop() {
  if (run) {
    time_immersion = (time_immersion == 0) ? millis() : time_immersion;
    if (millis() > 5000 + time_immersion) {
      digitalWrite(LED, LOW);
      upd = 1;
      while (!list) delay(10);

      double depth;
      int pressure;
      int f = 0;
      int msec = 0;

      while (f < 100) {
        depth = sin(f * 0.1);
        pressure = random(11500, 12600);
        msec = f * 1000;  // oppure: millis() - time_immersion;

        String jsonString = "{\"company_number\": \"EX_01\",  \"depth\":" + String(depth, 3) + 
                            ", \"mseconds\":" + String(msec)  +
                            ", \"pressure\":\"" + String(pressure) + "\" }";

        // Send only every 5th point a corrupted data for testing
        if (f % 5 == 0) {
          Serial.println("DATA CORRUPTED FOR ERROR HANDLING::");
        }
        
        Serial.println(jsonString);

        f++;
        delay(50);
      }

      Serial.println(STOP_DATA);
      time_immersion = 0;
      run = 0;
      upd = 0;
      list = 0;
    }
  }
}

