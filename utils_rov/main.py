from .controller import ROVController
import sys

if '--controller' in sys.argv:
    # Only run controller and joystick
    contr = ROVController()
    contr.run()
else:
    # Start flask app
    contr = ROVController()