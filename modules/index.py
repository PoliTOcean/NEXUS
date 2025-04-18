from app import app
from flask import render_template, send_file, jsonify
import os,json


@app.route("/")
def main():
    return render_template('GUI.html')

@app.route("/ROV")
def gui():
    return render_template("ROV.html")

@app.route("/FLOAT")
def float():
    return render_template("FLOAT.html")

    
@app.route("/CAMERAS")
def cameras():
    return render_template("CAMERAS.html")

@app.route("/info", methods=["GET"])
def get_info():
    info_path = os.path.join(os.path.dirname(__file__), "info.json")
    
    if os.path.exists(info_path):
        with open(info_path, "r") as file:
            info_data = json.load(file)
    else:
        info_data = {}

    MODE = app.config.get("MODE", "normal")
    
    statuses_data = info_data['statuses']
    
    info_data = info_data['modes'][MODE]
    info_data["mode"] = MODE
    info_data['statuses'] = statuses_data
    
    return jsonify(info_data)

@app.route("/flaskwebgui-keep-server-alive", methods=["GET"])
def responde():
    return '{"content": "Nothing"}'
