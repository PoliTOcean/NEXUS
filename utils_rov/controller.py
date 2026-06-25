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

INTERVAL = 0.03         #sec, min time between two axes payloads (~33 Hz)
# Min change (on the -32768..32767 axis scale) from the last sent value before
# we send again. Kept low so small/slow stick motions past the deadzone still
# produce updates; the deadzone (config) already filters out idle jitter.
MIN_DIFFERENCE = 10
# How often to flush the current axes state even if it sits below MIN_DIFFERENCE,
# so the final fine adjustment when the stick settles is never dropped.
SETTLE_FLUSH_INTERVAL = 0.2  # sec


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
        # `.get()` everywhere so a missing key (the two joystick configs use
        # slightly different schemas, e.g. flight has no onShiftRelease) never
        # raises and crashes the run loop. command/value always have a default.
        button = self.__joystick.commands["buttons"][id_button]
        command = None
        value = 0

        if state:
            if self.shift:
                command = button.get("onShiftPress") or button.get("onPress")
                value = button.get("onShiftValue", button.get("value"))
            else:
                command = button.get("onPress")
                value = button.get("value")
        else:
            # On release we must always emit the stop command. The shift state
            # may have flipped between press and release, and the shift release
            # entry is often empty (e.g. STOP_WRIST), so fall back to the plain
            # onRelease so the stop is never dropped -> the arm/wrist can't get
            # stuck spinning ("perdura").
            if self.shift:
                command = button.get("onShiftRelease") or button.get("onRelease")
            else:
                command = button.get("onRelease")
            value = 0

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
                    # Watchdog: if MQTT isn't healthy (broker died, tether
                    # unplugged, or client wedged in Connecting), kick a
                    # reconnect so axes resume without restarting NEXUS.
                    if mqtt_status != MQTTStatus.Connected:
                         self.__mqttClient.ensure_connected()
                    last_status_check_time = current_time

                if (current_time - self.last_send_time) >= INTERVAL:
                    should_send_axes = False
                    has_pending_diff = False
                    for axes, last_value in self.last_value_send.items():
                        if axes not in self.__joystick.axesStates:
                            continue
                        diff = abs(self.__joystick.axesStates[axes] - last_value)
                        if diff > MIN_DIFFERENCE:
                            should_send_axes = True
                            break
                        if diff > 0:
                            has_pending_diff = True

                    # Settle flush: the stick stopped moving but the last value we
                    # sent is still slightly off the current one (a sub-threshold
                    # residual). Push it after a short delay so the final fine
                    # adjustment isn't left undelivered.
                    if not should_send_axes and has_pending_diff and \
                       (current_time - self.last_send_time) >= SETTLE_FLUSH_INTERVAL:
                        should_send_axes = True

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
                # Short backoff only: a 1s sleep here froze control for a whole
                # second on any transient error, which felt like the controller
                # "stalling". Keep it small so input stays responsive.
                print(f"[Controller] Unexpected error in run loop: {e}")
                time.sleep(0.05)

        print("[Controller] Run loop finished. Disconnecting components...")
        if self.__mqttClient:
            self.__mqttClient.disconnect()
        print("[Controller] Exited.")


    def status(self):
        return self.__joystick.active
    