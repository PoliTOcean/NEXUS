from app import app
from flaskwebgui import FlaskUI
import logging
import platform
import argparse

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

if __name__ == "__main__":
    
    parser = argparse.ArgumentParser(description="Run the NEXUS application.")
    parser.add_argument("--mode", choices=["debug", "production"], required=True, help="Mode to run the application in.")
    args = parser.parse_args()

    app.config["MODE"] = args.mode
    
    # NORMAL
    if "Darwin" in platform.platform() or "macOS" in platform.platform():
        app.run(
            port=5000,
            
        )
    else:
        FlaskUI(
            app=app,
            server="flask",
            fullscreen= True,
            port=5000,
        ).run()
    

    # DEBUG SOCKET
    #socketio.run(app,port=5000)
    # SOCKET (Maybe in future will be useful)    
    # FlaskUI(
        # app=app,
        # socketio=socketio,
        # server="flask_socketio",
        # fullscreen= True,
        # port=5000
    # ).run()
