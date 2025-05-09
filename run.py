from app import app
from flaskwebgui import FlaskUI
import logging
import platform
import argparse
import os

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

def get_browser_path():
    possible_paths = [
        "/snap/bin/chromium",
        "/usr/bin/chromium"
    ]

    for path in possible_paths:
        if os.path.exists(path):
            return path

    return None


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
            fullscreen= False,
            server_kwargs={
                "app": app,
                "port": 5000,
                "threaded": True,
            },
            browser_path= get_browser_path()
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
