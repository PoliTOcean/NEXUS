"""Flask routes for the Task 1.2 coral-garden CV analysis.

Auto-imported by `modules/__init__.py`. Exposes:
  POST /coral/analyze            -> run the CV pipeline on an uploaded frame
  GET  /coral/captures/<file>    -> serve a saved input/annotated image
"""

import os
from datetime import datetime, timezone
from pathlib import Path

from flask import jsonify, request, send_from_directory

from app import app
import modules.coral_cv as coral_cv

_REPO_ROOT = Path(__file__).resolve().parent.parent
CAPTURE_DIR = _REPO_ROOT / "captures" / "coral"

# Stable path SolidWorks can watch; overridable so the CAD station can point it
# at a shared/synced location.
EQUATIONS_PATH = Path(
    os.environ.get("CORAL_EQUATIONS_PATH", CAPTURE_DIR / "equations.txt")
)


@app.route("/coral/analyze", methods=["POST"])
def coral_analyze():
    CAPTURE_DIR.mkdir(parents=True, exist_ok=True)

    file = request.files.get("image")
    if file is None:
        return jsonify({"ok": False, "error": "no_image"}), 400

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    input_path = CAPTURE_DIR / f"{ts}_input.jpg"
    file.save(str(input_path))

    try:
        result = coral_cv.analyze(
            str(input_path), str(CAPTURE_DIR), str(EQUATIONS_PATH)
        )
    except FileNotFoundError as exc:
        # Submodule not initialised, etc.
        return jsonify({"ok": False, "error": "cv_unavailable", "detail": str(exc)}), 500

    annotated_url = None
    if result.get("annotated_path"):
        annotated_url = f"/coral/captures/{Path(result['annotated_path']).name}"

    payload = {
        "ok": result["ok"],
        "length_cm": result["length_cm"],
        "height_cm": result["height_cm"],
        "targets_count": result["targets_count"],
        "annotated_url": annotated_url,
        "captured_at": ts,
        "error": result["error"],
    }

    # A failed analysis (e.g. ruler not found) is a valid, structured response,
    # not a transport error -> 422 so the client can show a friendly message.
    return jsonify(payload), (200 if result["ok"] else 422)


@app.route("/coral/captures/<path:filename>", methods=["GET"])
def coral_capture_file(filename):
    return send_from_directory(CAPTURE_DIR, filename)
