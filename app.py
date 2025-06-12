from flask import Flask, jsonify # Add jsonify
from flask_socketio import SocketIO
from flask.json.provider import DefaultJSONProvider
from datetime import datetime, date
from flask_cors import CORS
import json # Add json
import os # Add os

# UTC Time provider
class UpdatedJSONProvider(DefaultJSONProvider):
    def default(self, o):
        if isinstance(o, date) or isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)


app = Flask(__name__, template_folder='template')
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.json = UpdatedJSONProvider(app)
cors = CORS(app)


# socketio = SocketIO(app, engineio_logger = True, logger=True, debug=True,cors_allowed_origins='*', cors_credentials=False,async_mode='eventlet')

# Example of how to add float_config to an /info endpoint
# If your /info route is defined elsewhere (e.g., utils_rov.py), apply this logic there.
@app.route('/info')
def get_app_info():
    # This is a basic example. You should merge this with your existing /info logic.
    # Ensure you are not overwriting other important data returned by /info.
    app_info_data = {
        "appName": "NEXUS Control",
        "version": "1.0.0",
        # Add other existing info data here
    }

    # Load float configuration
    try:
        float_config_path = os.path.join(os.path.dirname(__file__), 'utils_float', 'config', 'float.json')
        if os.path.exists(float_config_path):
            with open(float_config_path, 'r') as f:
                app_info_data['float_config'] = json.load(f)
        else:
            app_info_data['float_config'] = {"error": "float.json not found"}
            print(f"[WARN] float.json not found at {float_config_path}")
    except Exception as e:
        app_info_data['float_config'] = {"error": str(e)}
        print(f"[ERROR] Failed to load float_config: {e}")
    
    # Example: If you have MQTT info to add (ensure this doesn't conflict with existing info structure)
    # This is just a placeholder, adapt to your actual MQTT configuration source
    app_info_data['mqtt'] = {"ip": "mqtt://localhost:1883"} # Replace with actual MQTT broker IP/config
    app_info_data['janus'] = {"ip": "ws://localhost:8188/janus"} # Replace with actual Janus server IP/config
    app_info_data['statuses'] = ["JOYSTICK", "ARMED", "WORK", "TORQUE", "DEPTH", "ROLL", "PITCH"] # Example statuses


    return jsonify(app_info_data)


import utils_float
import utils_rov
import modules