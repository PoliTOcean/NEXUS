
// const mqtt_c = mqtt.connect("mqtt://10.0.0.254:9000");


// ! [DEBUG]
const mqtt_c = mqtt.connect("mqtt://127.0.0.1:8080");

mqtt_c.on("connect", () => {
    console.info("[MQTT] Ready");
    mqtt_c.subscribe("debug/");
});

mqtt_c.on('message', function (topic, message) {
    let text = message.toString()
    switch (topic) {
        case "debug/":
          const debugData = JSON.parse(text);
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
