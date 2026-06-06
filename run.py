from app import app
from flaskwebgui import FlaskUI
import logging
import platform
import argparse
import os
import shutil
import tempfile
from dotenv import load_dotenv

from utils_rov import mapping_viz

load_dotenv()

# matplotlib writes its cache/config here; default to the platform temp dir so it
# works on Linux, macOS and Windows without a hardcoded /tmp.
os.environ.setdefault("MPLCONFIGDIR", os.path.join(tempfile.gettempdir(), "matplotlib"))



log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

def get_browser_path():
    # Per-OS install locations for Chrome/Chromium/Edge, then a PATH lookup so a
    # browser installed anywhere on PATH is still found.
    possible_paths = {
        "Linux": [
            "/snap/bin/chromium",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/google-chrome",
        ],
        "Darwin": [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ],
        "Windows": [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        ],
    }.get(platform.system(), [])

    for path in possible_paths:
        if os.path.exists(path):
            return path

    for name in ("chromium", "chromium-browser", "google-chrome", "chrome", "msedge"):
        found = shutil.which(name)
        if found:
            return found

    return None



if __name__ == "__main__":
    
    mapping_viz.init_mapping_viz()
    
    parser = argparse.ArgumentParser(description="Run the NEXUS application.")
    parser.add_argument("--mode", choices=["debug", "production"], required=True, help="Mode to run the application in.")
    parser.add_argument("--port", type=int, default=int(os.environ.get("NEXUS_PORT", "8000")), help="Port to run the application on.")
    args = parser.parse_args()

    app.config["MODE"] = args.mode
    port = args.port

    is_macos = "Darwin" in platform.platform() or "macOS" in platform.platform()
    browser_path = get_browser_path()

    # FlaskUI opens a Chromium-family browser in app mode. On macOS we bypass it,
    # and when no supported browser is found we fall back to a plain Flask server
    # (the UI is still reachable in any browser at http://localhost:<port>).
    if is_macos or browser_path is None:
        if browser_path is None and not is_macos:
            print(f"[NEXUS] No Chrome/Chromium/Edge found. Open http://localhost:{port} in a browser.")
        app.run(
            host="0.0.0.0",
            port=port,
            threaded=True,
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
            browser_path= browser_path
        ).run()

