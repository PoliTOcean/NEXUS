async function initializeMQTT() {
  // Wait for the info variable to be populated
  while (typeof info === "undefined" || !info.mqtt) {
      console.log("[MQTT] Waiting for info to be populated...");
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms
  }

  const mqttIp = info.mqtt.ip;
  console.log(`[MQTT] Connecting to broker at ${mqttIp}`);

  const mqtt_c = mqtt.connect(mqttIp);

  mqtt_c.on("connect", () => {
      console.info("[MQTT] Ready");
      mqtt_c.subscribe("status/", (err) => {
          if (err) {
              console.error("[MQTT] Subscription error:", err);
          } else {
              console.log("[MQTT] Successfully subscribed to status/");
          }
      });
      // Subscribe to camera_control topic
      mqtt_c.subscribe("camera_control/", (err) => {
          if (err) {
              console.error("[MQTT] Subscription error for camera_control:", err);
          } else {
              console.log("[MQTT] Subscribed to camera_control/");
          }
      });
  });

  mqtt_c.on("message", function (topic, message) {
      let text = message.toString();
      // console.log(`[DEBUG] Message received on topic ${topic}:`, text);
      switch (topic) {
          case "status/":
              const debugData = JSON.parse(text);
              // console.log(`[DEBUG] Parsed debug data:`, debugData);

              updateStatusesROV({
                  "ARMED": debugData["rov_armed"],
                  "CONTROLLER_STATE": debugData["controller_state"],
                  "WORK": debugData["work_mode"],
                  "TORQUE": debugData["torque_mode"],
              });
              updateIMU({
                  "PITCH": debugData["pitch"],
                  "ROLL": debugData["roll"],
                  "YAW": debugData["yaw"],
              });
              updateSensors({
                  "depth": debugData["depth"],
                  "temperature": debugData["temperature"],
                  "force_z": debugData["force_z"],
                  "force_roll": debugData["force_roll"],
                  "force_pitch": debugData["force_pitch"],
                  "pitch" : debugData["pitch"],
                  "reference_z": debugData["reference_z"],
                  "reference_roll": debugData["reference_roll"],
                  "reference_pitch": debugData["reference_pitch"],
              });
              break;
          case "camera_control/":
              if (text.includes("NEXT_CAMERA")) {
                    console.log("[MQTT] NEXT_CAMERA message received");
                    switching("next");
              } else if (text.includes("PREV_CAMERA")) {

                    console.log("[MQTT] PREV_CAMERA message received");
                    switching("previous");
              } else {
                  console.warn(`[MQTT] Unknown camera_control message: ${text}`);
              }
              break;
          default:
              console.warn(`[MQTT] Unknown topic: ${topic}`);
              break;
      }
  });

  mqtt_c.on("error", (error) => {
      try {
          console.error("[MQTT] Error:", error);
      } catch (err) {
          console.error("[MQTT] Error in error handler:", err);
      }
  });
}