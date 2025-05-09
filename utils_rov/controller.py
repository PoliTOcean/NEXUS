import os
import sys
import yaml
import json
import time
from yamlinclude import YamlIncludeConstructor

from .mqtt_c import MQTTClient, MQTTStatus
from .joystick import Joystick


__CONFIG_FILENAME__ = "config.yaml"
__CONFIG_JOYSTICK_KEY__ = "joystick"
__CONFIG_JOYSTICK_FLIGHT_KEY__ = "joystick_flight"
__CONFIG_MQTT_KEY__ = "mqtt"

INTERVAL = 0.03         #sec
MIN_DIFFERENCE = 50    #difference from last command sendt in order to send


class ROVController():
    def __init__(self):
        path = os.path.join(os.path.dirname(__file__), "config")

        self.debug = True

        self.__configured = False
        self.is_running = False
        self.last_send_time = 0
        self.last_value_send = {
                                "X" : 0,
                                "Y": 0,
                                "YAW" : 0,
                                "Z" : 0,
                                "ROLL": 0,
                                "PITCH": 0
                                }
        self.shift=0
        self.angle_control=1
        self.z_up=0
        self.z_down=0
        self.z_value=0
        self.to_send = 0             #if 1 send json axes
        
        YamlIncludeConstructor.add_to_loader_class(
            loader_class=yaml.FullLoader, base_dir=path)

        if not os.path.isdir(path):
            sys.exit("[!] Config path must be a directory")
       
        configFilePath = os.path.join(path, __CONFIG_FILENAME__)
        if not os.path.isfile(configFilePath):
           sys.exit("[!] Config directory must contain config.yaml")

        with open(configFilePath, "r") as yconfig:
            config = yaml.load(yconfig, Loader=yaml.FullLoader)
            
            self.__mqttClient = self.__init_mqttClient(config[__CONFIG_MQTT_KEY__])
            self.__joystick = self.__init_joystick(config[__CONFIG_JOYSTICK_KEY__], config[__CONFIG_JOYSTICK_FLIGHT_KEY__])

            self.__configured = True

    def __init_joystick(self, config, config_flight):
        joystick = Joystick(config, config_flight, self.__on_axisChanged, self.__on_buttonChanged)
        return joystick

    def __init_mqttClient(self, config):
        mqttClient = MQTTClient(config["id"], config["address"], config["port"])
        mqttClient.connect()
         
        return mqttClient
   
    @property
    def configured(self):
        return self.__configured

    def mqttClient(self):
        return self.__mqttClient if self.__configured else None
    
    def joystick(self):
        return self.__joystick if self.__configured else None


    def __on_axisChanged(self, id_axes, value):
        if id_axes in ['LSB-Y', 'RSB-Y']:
            value = value*-1
        
        if self.debug:
            print(f"axes: {id_axes}, value: {value}, command: {self.__joystick.commands['axes'][id_axes]['command']}")
        
        if abs(value) < self.__joystick.commands["axes"][id_axes]["deadzone"]:
                value=0

        if id_axes in ['LT', 'RT']:
            value = (value + 32767)//2
            if id_axes == 'RT':
                value = value*-1
        elif id_axes=='throttle':
            value=value*-1
            value = (value + 32767)//2
            self.z_value = value*-1
            if self.z_up:
                self.__joystick.axesStates["Z"] = self.z_value
            if self.z_down:
                self.__joystick.axesStates["Z"] = self.z_value*-1
            return
        
        
        if not self.angle_control and self.__joystick.commands['axes'][id_axes]["command"]=="PITCH":
            value=0


        self.__joystick.axesStates[self.__joystick.commands['axes'][id_axes]["command"]] = value

    
    def __on_buttonChanged(self, id_button, state):
        if state and self.shift == 0:
            command = self.__joystick.commands["buttons"][id_button]["onPress"]
            value = self.__joystick.commands["buttons"][id_button]["value"]
        elif state and self:
            command = self.__joystick.commands["buttons"][id_button]["onShiftPress"]
            value = self.__joystick.commands["buttons"][id_button]["onShiftValue"]
        elif state == 0 and self.shift == 0:
            command = self.__joystick.commands["buttons"][id_button]["onRelease"]
            value=0
        elif state == 0 and self.shift == 1:
            command = self.__joystick.commands["buttons"][id_button]["onShiftRelease"]
            value=0

        if self.debug:
            print(f"button: {id_button}, state: {state}, command: {command}, value:{value}")

        
        #flight controller 
        if command=="Z_UP":
            self.z_up = state
            self.to_send = 1
            if state:
                self.__joystick.axesStates["Z"] = self.z_value
            else:
                self.__joystick.axesStates["Z"] = 0
            return
        elif command=="Z_DOWN":
            self.z_down = state
            self.to_send = 1
            if state:
                self.__joystick.axesStates["Z"] = self.z_value*-1
            else:
                self.__joystick.axesStates["Z"] = 0
            return
        
        if command == "SHIFT":
            self.shift=1
            return
        elif command == "noSHIFT":
            self.shift=0
            return
        
        if command == "ABLE_ANGLE_CTL":
            self.angle_control=1
            return
        elif command == "DISABLE_ANGLE_CTL":
            self.angle_control=0
            return

        if command in self.__joystick.axesStates.keys():
            self.__joystick.axesStates[command] = value
            self.to_send = 1
        elif command:
            topic = self.__joystick.commands["buttons"][id_button].get("topic")
            if not topic:
                return

            if self.__mqttClient.status == MQTTStatus.Connected:
                data = {command: value}
                json_string = json.dumps(data)
                success = self.__mqttClient.publish(topic, json_string)
                if success:
                    if self.debug:
                        print(f"[Controller] Sent button command: {json_string} to topic: {topic}")
                else:
                    if self.debug:
                        print(f"[Controller] Failed to send button command: {json_string} to topic: {topic}. MQTT Status: {self.__mqttClient.status}")
            else:
                if self.debug:
                    print(f"[Controller] MQTT not connected. Button command '{command}' not sent.")


    def run(self):
        if not self.configured:
            print("[Controller] Cannot run, not configured.")
            return

        self.is_running = True
        print("[Controller] Starting run loop...")
        last_status_check_time = 0
        status_check_interval = 5

        while self.is_running:
            try:
                current_time = time.time()

                self.__joystick.update()

                if current_time - last_status_check_time > status_check_interval:
                    mqtt_status = self.__mqttClient.status
                    if self.debug and mqtt_status != MQTTStatus.Connected:
                         print(f"[Controller] MQTT Status Check: {mqtt_status}")
                    if mqtt_status == MQTTStatus.Disconnected:
                         pass
                    last_status_check_time = current_time

                if (current_time - self.last_send_time) >= INTERVAL:
                    should_send_axes = False
                    for axes, last_value in self.last_value_send.items():
                        if axes in self.__joystick.axesStates and \
                           abs(self.__joystick.axesStates[axes] - last_value) > MIN_DIFFERENCE:
                            should_send_axes = True
                            break

                    if should_send_axes or self.to_send:
                        if self.__mqttClient.status == MQTTStatus.Connected:
                            axes_payload = json.dumps(self.__joystick.axesStates)
                            if self.debug:
                                print(f"[Controller] Preparing to send axes: {axes_payload}")

                            success = self.__mqttClient.publish('axes/', axes_payload)

                            if success:
                                self.last_send_time = current_time
                                for key, value in self.__joystick.axesStates.items():
                                     if key in self.last_value_send:
                                         self.last_value_send[key] = value
                                self.to_send = 0
                                if self.debug:
                                    print(f"[Controller] Axes data sent successfully.")
                            else:
                                if self.debug:
                                    print(f"[Controller] Failed to send axes data. MQTT Status: {self.__mqttClient.status}")
                                self.to_send = 1
                        else:
                            if self.debug:
                                print(f"[Controller] MQTT not connected (Status: {self.__mqttClient.status}). Axes data not sent, marked for retry.")
                            self.to_send = 1

                time.sleep(0.002)  # Sleep to prevent busy waiting

            except KeyboardInterrupt:
                print("\n[Controller] KeyboardInterrupt received. Stopping...")
                self.is_running = False
            except Exception as e:
                print(f"[Controller] Unexpected error in run loop: {e}")
                time.sleep(1)

        print("[Controller] Run loop finished. Disconnecting components...")
        if self.__mqttClient:
            self.__mqttClient.disconnect()
        print("[Controller] Exited.")


    def status(self):
        return self.__joystick.active
    