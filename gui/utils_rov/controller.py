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
__CONFIG_MQTT_KEY__ = "mqtt"

AXES_DEADZONE = 4000    #should always be > MIN_DIFFERENCE
INTERVAL = 0.03         #sec
MIN_DIFFERENCE = 500    #difference from last command sendt in order to send


class ROVController():
    def __init__(self):
        path = os.path.join(os.path.dirname(__file__), "config")

        self.__configured = False
        self.is_running = False
        self.last_send_time = 0
        self.last_value_send = {
                                "X" : 0,
                                "Y": 0,
                                "YAW" : 0,
                                "Z" : 0
                                }
        
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
            self.__joystick = self.__init_joystick(config[__CONFIG_JOYSTICK_KEY__])

            self.__configured = True

    def __init_joystick(self, config):
        joystick = Joystick(config, self.__on_axisChanged, self.__on_buttonChanged)
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
        # print(id_axes, value)
        #mando direttamente i due grilletti
        print(f"axes: {id_axes}, value: {value}")
        if id_axes in ['LT', 'RT']:
            value = (value + 32767)//2
            if self.__joystick.commands['axes'][id_axes] == 'Z_UP':
                value = value*-1
            if abs(value) < AXES_DEADZONE:
                value=0
            self.__joystick.axesStates["Z"] = value
        #gli altri assi vengono solo salvati e poi inviati nel loop        
        elif id_axes in ['LSB-X', 'LSB-Y','RSB-X']:
            if(abs(value) < AXES_DEADZONE): #zona morta x/y
                value = 0
                
            self.__joystick.axesStates[self.__joystick.commands['axes'][id_axes]] = value
    
    # Handle button press/release and map them to JSON messages for MQTT 
    def __on_buttonChanged(self, id_button, state):

        button_config = self.__joystick.commands["buttons"].get(id_button)
        if not button_config: return

        command = None
        value = None
        shift = 0

        if button_config == "SHIFT" and state:
            shift = 1

        if shift and button_config.get("onShift"):
            command = button_config.get("onShift")
            value = button_config.get("valueShift")
        elif state:
            command = button_config.get("onPress")
            value = button_config.get("value")
        elif not state:
            command = button_config.get("onRelease")
            value = button_config.get("value")

        message = {
            "command": command,
            "value": value if value is not None else 0  # Use default 0 if no value is set
        }

        json_message = json.dumps(message)

        if command and button_config["onRelease"]: #if no Release property is a state command
            self.__mqttClient.publish("arm_commands/", command)
            print(command)

        elif command:
            self.__mqttClient.publish("state_commands/", command)
            print(f"state: {command}")

    def __on_mqttStatusChanged(self, status):
       pass

    def run(self):
        self.is_running = True
        to_send = 0             #if 1 send json
        while True:
            self.__joystick.update()
            
            #timed loop
            if (time.time() - self.last_send_time)>=INTERVAL:
                for axes, last_value in self.last_value_send.items():
                    if abs(self.__joystick.axesStates[axes] - last_value) > MIN_DIFFERENCE: #soglia oltre la quale mando il comando
                        to_send = 1
                        break
                if to_send:
                    print(json.dumps(self.__joystick.axesStates))
                    self.__mqttClient.publish('axes/', json.dumps(self.__joystick.axesStates))
                    self.last_send_time = time.time()
                for key, value in self.__joystick.axesStates.items():
                    self.last_value_send[key] = value
                to_send = 0
                        

    def status(self):
        return self.__joystick.active
