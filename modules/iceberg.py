"""Flask route for the Task 2.2 iceberg threat-level calculator.

Auto-imported by `modules/__init__.py`. Exposes:
  POST /iceberg/evaluate  -> pure calculation of surface/subsea threat for the
                             4 fixed oil platforms, given an iceberg info sheet.

This is a pure calculation (no CV, no model): the route just validates the input
iceberg sheet (lat/lon/heading/keel depth) and delegates to the submodule logic.
"""

from flask import jsonify, request

from app import app
import modules.iceberg_logic as iceberg_logic


@app.route("/iceberg/evaluate", methods=["POST"])
def iceberg_evaluate():
    data = request.get_json(silent=True) or {}
    ice = data.get("iceberg", {})
    try:
        lat = float(ice["lat"])
        lon = float(ice["lon"])
        heading = float(ice["heading_deg"])
        keel = float(ice["keel_depth_m"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"ok": False, "error": "bad_input"}), 400

    forward_only = bool(ice.get("forward_only", False))

    try:
        result = iceberg_logic.evaluate(lat, lon, heading, keel, forward_only=forward_only)
    except FileNotFoundError as exc:
        # Submodule not initialised, etc.
        return jsonify({"ok": False, "error": "logic_unavailable", "detail": str(exc)}), 500

    result["iceberg"] = {
        "lat": lat,
        "lon": lon,
        "heading_deg": heading,
        "keel_depth_m": keel,
        "forward_only": forward_only,
    }
    return jsonify(result), 200
