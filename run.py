from app import app
from flaskwebgui import FlaskUI
import logging
import platform
import argparse
import os
from dotenv import load_dotenv

from utils_rov import mapping_viz

load_dotenv()



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
    
    mapping_viz.init_mapping_viz()
    
    parser = argparse.ArgumentParser(description="Run the NEXUS application.")
    parser.add_argument("--mode", choices=["debug", "production"], required=True, help="Mode to run the application in.")
    parser.add_argument("--port", type=int, default=int(os.environ.get("NEXUS_PORT", "8000")), help="Port to run the application on.")
    args = parser.parse_args()

    app.config["MODE"] = args.mode
    port = args.port
    
    # NORMAL
    if "Darwin" in platform.platform() or "macOS" in platform.platform():
        app.run(
            port=port,
        )
    else:
        FlaskUI(
            app=app,
            server="flask",
            fullscreen= False,
            server_kwargs={
                "app": app,
                "port": port,
                "host" : "0.0.0.0",
                "threaded": True,
            },
            browser_path= get_browser_path()
        ).run()

