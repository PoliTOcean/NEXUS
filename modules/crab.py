"""Flask routes for the Task 2.1 invasive-crab counter.

Auto-imported by `modules/__init__.py`. Exposes:
  POST /crab/analyze          -> run YOLOv8 detection on an uploaded frame
  GET  /crab/captures/<file>  -> serve a saved input/annotated image
"""

from datetime import datetime, timezone
from pathlib import Path

from flask import jsonify, request, send_from_directory

from app import app
import modules.crab_cv as crab_cv

_REPO_ROOT = Path(__file__).resolve().parent.parent
CAPTURE_DIR = _REPO_ROOT / "captures" / "crab"


@app.route("/crab/analyze", methods=["POST"])
def crab_analyze():
    CAPTURE_DIR.mkdir(parents=True, exist_ok=True)

    file = request.files.get("image")
    if file is None:
        return jsonify({"ok": False, "error": "no_image"}), 400

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    input_path = CAPTURE_DIR / f"{ts}_input.jpg"
    file.save(str(input_path))

    try:
        result = crab_cv.analyze(str(input_path), str(CAPTURE_DIR))
    except FileNotFoundError as exc:
        return jsonify({"ok": False, "error": "cv_unavailable", "detail": str(exc)}), 500

    annotated_url = None
    if result.get("annotated_path"):
        annotated_url = f"/crab/captures/{Path(result['annotated_path']).name}"

    payload = {
        "ok": result["ok"],
        "green_count": result["green_count"],
        "total_detections": result["total_detections"],
        "annotated_url": annotated_url,
        "captured_at": ts,
        "error": result["error"],
    }

    return jsonify(payload), (200 if result["ok"] else 422)


@app.route("/crab/captures/<path:filename>", methods=["GET"])
def crab_capture_file(filename):
    return send_from_directory(CAPTURE_DIR, filename)
