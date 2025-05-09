// ! This is a test script, made for checking Float page integrity

#define LED 23
#define GO "GO"
#define MAXS 50
#define STATUS "STATUS"
#define UPLOAD_DATA "UPLOAD_DATA"
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
  if (strcmp(str, GO) == 0 && !run) {
    digitalWrite(LED, HIGH);
    run = 1;
  }
  else if (strcmp(str, STATUS) == 0) {
    if (upd) {
      Serial.println(UPLOAD_DATA);
    } else if (run) {
      Serial.println("IMMERSION");
    } else {
      int battery = random(9000, 12001);
      Serial.print("CONNECTED&READY | BATTERY: ");
      Serial.println(battery);
    }
  }
  else if (strcmp(str, "LISTENING") == 0) {
    list = 1;
  }
  else if (strcmp(str, "PARAMS") == 0) {
    param_mode = 1;
    param_count = 0;
    Serial.println("SEND PARAMS: Kp, Kd, Ki (one per line)");
  }
  else if (param_mode) {
    float val = atof(str);
    if (param_count == 0) {
      Kp = val;
      Serial.print("Kp set to "); Serial.println(Kp);
    } else if (param_count == 1) {
      Kd = val;
      Serial.print("Kd set to "); Serial.println(Kd);
    } else if (param_count == 2) {
      Ki = val;
      Serial.print("Ki set to "); Serial.println(Ki);
      param_mode = 0;
      Serial.println("All parameters set.");
    }
    param_count++;
  }
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

      int year = 2024;
      int month = random(0, 11);
      int day = random(1, 29);
      int hour = random(0, 23);
      int minute = random(0, 59);
      int second = random(0, 59);
      double depth;
      int f = 0;

      while (f < 100) {
        depth = sin(f);
        int pressure = random(90000, 120000); // in Pascal, esempio

        String jsonString = "{\"company_number\": \"EX_01\",  \"depth\":" + String(depth, 3) + 
                            ", \"pressure\":" + String(pressure) + 
                            ", \"year\":\"" + String(year) + 
                            "\", \"month\": \"" + String(month) + 
                            "\", \"day\": \"" + String(day) + 
                            "\", \"hour\": \"" + String(hour) + 
                            "\",  \"minute\": \"" + String(minute) + 
                            "\",  \"second\": \"" + String(second) + "\" }";

        Serial.println(" DATO MERDOSO ");
        Serial.println(jsonString);

        second++;
        if (second >= 60) {
          second = 0;
          minute++;
          if (minute >= 60) {
            minute = 0;
            hour++;
            if (hour >= 24) {
              hour = 0;
              day++;
              if (day > 30) {
                day = 1;
                month++;
                if (month > 12) {
                  month = 1;
                  year++;
                }
              }
            }
          }
        }

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
