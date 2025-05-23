import json
import time
import os
import sdl2
import sdl2.ext
import platform
import subprocess

__COMMAND_CONFIG_FILE__ = "joystick_Move.yaml"

class Joystick():
    def __init__(self, commands_xbox, commands_flight, on_axis_changed, on_button_changed):
        self.__commands_flight = commands_flight
        self.__commands_xbox = commands_xbox
        self.__on_axis_changed = on_axis_changed
        self.__on_button_changed = on_button_changed
        self.__last_pressed = 0
        self.__connection_type = "USB"
        self.__axesStates = {
                                "X" : 0,
                                "Y": 0,
                                "YAW" : 0,
                                "Z" : 0,
                                "ROLL": 0,
                                "PITCH": 0
                                }
        self.active = False
        sdl2.SDL_Init(sdl2.SDL_INIT_JOYSTICK)
        self.__path_mappings = os.path.join(os.path.dirname(__file__), "config/XboxOneController.json")

    @property
    def axesStates(self):
        return self.__axesStates

    @property
    def name(self):
        return sdl2.SDL_JoystickName(self.__joystick).decode("utf-8")

    @property
    def commands(self):
        if "X52" in self.name:
           return self.__commands_flight
        elif "Xbox" in self.name:
            return self.__commands_xbox

    @property
    def mappings(self):
        return self.__mappings
    
    def __open(self):
        self.__joystick = sdl2.SDL_JoystickOpen(0)
        print("[...] Loading mappings")
        print(f"controller name: {self.name}")
        
        if "Xbox" in self.name:
            # Attempt to determine USB/Bluetooth via lsusb output
            try:
                lsusb_output = subprocess.check_output(["lsusb"]).decode()
                if "Xbox" in lsusb_output:
                    self.__connection_type = "USB"
                else:
                    self.__connection_type = "Bluetooth"
            except Exception:
                self.__connection_type = "Bluetooth"
        print(f"connected via {self.__connection_type}")

        with open(self.__path_mappings, "r") as jmaps:
            mappings = json.load(jmaps)
            if self.name in mappings:
                self.__mappings = mappings[self.name][platform.system()][self.__connection_type]
        self.active = True

    def __close(self):
        sdl2.SDL_JoystickClose(self.__joystick)
        self.active = False

    def update(self):
        for event in sdl2.ext.get_events():
            if event.type == sdl2.SDL_JOYAXISMOTION:
                self.__on_axis_changed(self.__mappings["axes"][event.jaxis.axis], event.jaxis.value)
            elif event.type == sdl2.SDL_JOYDEVICEADDED:
                self.__open()
                print("[JOYSTICK] Joystick added")
            elif event.type == sdl2.SDL_JOYDEVICEREMOVED:
                self.__close()
                print("[JOYSTICK] Joystick removed")
            elif event.type == sdl2.SDL_JOYBUTTONDOWN or event.type == sdl2.SDL_JOYBUTTONUP:
                #print(event.jbutton.button)
                self.__on_button_changed(self.__mappings["buttons"][event.jbutton.button], event.jbutton.state)
            elif event.type == sdl2.SDL_JOYHATMOTION:
                if event.jhat.value == 0:
                    self.__on_button_changed(self.__mappings["joyhat"][self.__last_pressed], 0)
                elif event.jhat.value == 1:
                    self.__on_button_changed(self.__mappings["joyhat"][0], 1)
                    self.__last_pressed = 0
                elif event.jhat.value == 4:
                    self.__on_button_changed(self.__mappings["joyhat"][1], 1)
                    self.__last_pressed = 1
                elif event.jhat.value == 8:
                    self.__on_button_changed(self.__mappings["joyhat"][2], 1)
                    self.__last_pressed = 2    
                elif event.jhat.value == 2:
                    self.__on_button_changed(self.__mappings["joyhat"][3], 1)
                    self.__last_pressed = 3

            sdl2.ext.get_events().clear()


    def status(self):
        return self.active
