from app import app
from flask import jsonify, redirect, render_template, send_from_directory
import os
import json
from pathlib import Path

FRONTEND_DIST_DIR = Path(__file__).resolve().parent.parent / "frontend_dist"


@app.route('/utils_rov/<path:filename>')
def utils_rov(filename):
    return send_from_directory('utils_rov', filename)


@app.route("/test")
def test():
    return redirect("/")


@app.route("/")
def main():
    return render_template('launcher.html')


@app.route("/ROV")
def legacy_rov_redirect():
    return redirect("/eva/")


@app.route("/FLOAT")
def legacy_float_redirect():
    return redirect("/float/")


@app.route("/CAMERAS")
def legacy_cameras_redirect():
    return redirect("/eva/")


def serve_frontend_app(app_name, requested_path=""):
    app_dir = FRONTEND_DIST_DIR / app_name
    if requested_path:
        candidate = app_dir / requested_path
        if candidate.is_file():
            return send_from_directory(app_dir, requested_path)

    return send_from_directory(app_dir, "index.html")


@app.route("/eva")
def eva_redirect():
    return redirect("/eva/")


@app.route("/eva/")
@app.route("/eva/<path:requested_path>")
def eva_app(requested_path=""):
    return serve_frontend_app("eva", requested_path)


@app.route("/float")
def float_redirect():
    return redirect("/float/")


@app.route("/float/")
@app.route("/float/<path:requested_path>")
def float_app(requested_path=""):
    return serve_frontend_app("float", requested_path)


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
