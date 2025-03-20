import os
import sys
import yaml
import json
import time
from yamlinclude import YamlIncludeConstructor

from .mqtt_c import MQTTClient
from .joystick import Joystick


__CONFIG_FILENAME__ = "config.yaml"
__CONFIG_JOYSTICK_KEY__ = "joystick"
__CONFIG_JOYSTICK_FLIGHT_KEY__ = "joystick_flight"
__CONFIG_MQTT_KEY__ = "mqtt"

AXES_DEADZONE = 2000    #should always be > MIN_DIFFERENCE
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
            if id_axes == 'LT':
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

        if command in self.__joystick.axesStates.keys():
            self.__joystick.axesStates[command] = value
        elif command: #and self.__joystick.commands["buttons"][id_button]["onRelease"]: #if no Release property is a state comman
            topic = self.__joystick.commands["buttons"][id_button]["topic"]
            if not topic:
                print(f"NO TOPIC for command: {command}")
                return
            data = {command: value}
            json_string = json.dumps(data)
            self.__mqttClient.publish(topic, json_string)
            if self.debug:
                print(f"sent: {json_string} to topic: {topic}")


    def __on_mqttStatusChanged(self, status):
       pass

    def run(self):
        self.is_running = True
        while True:
            self.__joystick.update()
            #timed loop
            if (time.time() - self.last_send_time)>=INTERVAL:
                for axes, last_value in self.last_value_send.items():
                    if abs(self.__joystick.axesStates[axes] - last_value) > MIN_DIFFERENCE: #soglia oltre la quale mando il comando
                        self.to_send = 1
                        break
                if self.to_send:
                    print(json.dumps(self.__joystick.axesStates))
                    self.__mqttClient.publish('axes/', json.dumps(self.__joystick.axesStates))
                    self.last_send_time = time.time()
                    for key, value in self.__joystick.axesStates.items():
                        self.last_value_send[key] = value
                    self.to_send = 0
                        

    def status(self):
        return self.__joystick.active
