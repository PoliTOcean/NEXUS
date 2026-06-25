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
        # Previous-state caches so polling only fires callbacks on real changes.
        self.__last_axes = {}
        self.__last_buttons = {}
        self.__last_hat = -1
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
        # If a joystick is already connected (e.g. plugged in before NEXUS
        # started), SDL may never deliver the initial SDL_JOYDEVICEADDED event
        # in a headless/joystick-only setup, so __open() would never run and no
        # axes would ever be read. Open it proactively here when one is present
        # but not yet active.
        if not self.active and sdl2.SDL_NumJoysticks() > 0:
            self.__open()
            print("[JOYSTICK] Joystick opened (already connected at startup)")
        if not self.active:
            return

        # NOTE: we poll the joystick state directly instead of using the SDL
        # event queue (sdl2.ext.get_events()). SDL only pumps events on the
        # thread that called SDL_Init; NEXUS runs update() on the controller
        # thread while SDL_Init ran on the main/import thread, so the event
        # queue stays empty there and no axis motion was ever delivered.
        # SDL_JoystickUpdate() + Get*() work from any thread.
        sdl2.SDL_JoystickUpdate()

        for axis, command in enumerate(self.__mappings["axes"]):
            value = sdl2.SDL_JoystickGetAxis(self.__joystick, axis)
            if value != self.__last_axes.get(axis):
                self.__last_axes[axis] = value
                self.__on_axis_changed(command, value)

        for button, command in enumerate(self.__mappings["buttons"]):
            state = sdl2.SDL_JoystickGetButton(self.__joystick, button)
            if state != self.__last_buttons.get(button):
                self.__last_buttons[button] = state
                self.__on_button_changed(command, state)

        # D-pad / hat: map the same value codes the event path used.
        hat = sdl2.SDL_JoystickGetHat(self.__joystick, 0)
        if hat != self.__last_hat:
            self.__last_hat = hat
            if hat == 0:
                self.__on_button_changed(self.__mappings["joyhat"][self.__last_pressed], 0)
            elif hat == 1:
                self.__on_button_changed(self.__mappings["joyhat"][0], 1)
                self.__last_pressed = 0
            elif hat == 4:
                self.__on_button_changed(self.__mappings["joyhat"][1], 1)
                self.__last_pressed = 1
            elif hat == 8:
                self.__on_button_changed(self.__mappings["joyhat"][2], 1)
                self.__last_pressed = 2
            elif hat == 2:
                self.__on_button_changed(self.__mappings["joyhat"][3], 1)
                self.__last_pressed = 3


    def status(self):
        return self.active
