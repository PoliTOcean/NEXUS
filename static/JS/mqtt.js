
// const mqtt_c = mqtt.connect("mqtt://10.0.0.254:9000");


// ! [DEBUG]
const mqtt_c = mqtt.connect("mqtt://127.0.0.1:8080");

mqtt_c.on("connect", () => {
    console.info("[MQTT] Ready");
    mqtt_c.subscribe("status/", (err) => {
        if (err) {
            console.error("[MQTT] Subscription error:", err);
        } else {
            console.log("[MQTT] Successfully subscribed to status/");
        }
    });
});

mqtt_c.on('message', function (topic, message) {
    let text = message.toString()
    console.log(`[DEBUG] Message received on topic ${topic}:`, text)
    switch (topic) {
        case "status/":
          const debugData = JSON.parse(text);
          console.log(`[DEBUG] Parsed debug data:`, debugData);
          
          updateStatusesROV({
            "ARMED": debugData["rov_armed"],
            "CONTROLLER_STATE": debugData["controller_state"]
          });
          updateIMU({
              "PITCH": debugData["pitch"],
              "ROLL": debugData["roll"],
              "YAW": debugData["yaw"]            
          });
          updateSensors({
              "depth": debugData["depth"],
              "temperature": debugData["temperature"],
              "force_z": debugData["force_z"],
              "force_roll": debugData["force_roll"],
              "force_pitch": debugData["force_pitch"],
              "reference_z": debugData["reference_z"],
              "reference_roll": debugData["reference_roll"],
              "reference_pitch": debugData["reference_pitch"]
          });
          break;

          default:
            console.warn(`[MQTT] Unknown topic: ${topic}`);
            break;
    }
}

,mqtt_c.on('error', (error) => {
  try {
    console.error('MQTT Error:', error);
  } catch (err) {
    console.error('Error in error handler:', err);
  }
}));
