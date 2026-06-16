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
            self.__connection_type = self.__detect_connection_type()
        print(f"connected via {self.__connection_type}")

        with open(self.__path_mappings, "r") as jmaps:
            mappings = json.load(jmaps)
            if self.name in mappings:
                os_mappings = mappings[self.name]
                # The mappings file is keyed by OS (e.g. "Linux", "Darwin"). Fall
                # back to "Linux" when the current OS has no dedicated entry so the
                # controller still works on platforms not listed in the config.
                system = platform.system()
                if system not in os_mappings and "Linux" in os_mappings:
                    print(f"[JOYSTICK] No mappings for {system}, falling back to Linux")
                    system = "Linux"
                self.__mappings = os_mappings[system][self.__connection_type]
        self.active = True

    def __detect_connection_type(self):
        """Best-effort USB vs Bluetooth detection, per OS.

        Each platform uses a different USB enumeration tool; failures fall back to
        "Bluetooth" so a missing tool never crashes joystick setup.
        """
        system = platform.system()
        try:
            if system == "Linux":
                output = subprocess.check_output(["lsusb"]).decode()
                return "USB" if "Xbox" in output else "Bluetooth"
            if system == "Darwin":
                output = subprocess.check_output(
                    ["system_profiler", "SPUSBDataType"]
                ).decode()
                return "USB" if ("Xbox" in output or "Controller" in output) else "Bluetooth"
            if system == "Windows":
                output = subprocess.check_output(
                    ["powershell", "-NoProfile", "-Command",
                     "Get-PnpDevice -PresentOnly | Select-Object -ExpandProperty FriendlyName"]
                ).decode(errors="replace")
                return "USB" if "Xbox" in output else "Bluetooth"
        except Exception:
            pass
        return "Bluetooth"

    def __close(self):
        sdl2.SDL_JoystickClose(self.__joystick)
        self.active = False

    def update(self):
        # get_events() drains the SDL queue (SDL_GETEVENT), so we must read it
        # exactly once per tick and iterate the returned list. Calling it again
        # inside the loop would consume freshly-arrived events and silently drop
        # them, which made small/slow joystick motions feel unresponsive.
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


    def status(self):
        return self.active
