"""Flask route for the Task 2.5 eDNA frequency calculator.

Auto-imported by `modules/__init__.py`. Exposes:
  POST /edna/frequency  -> pure arithmetic % frequency of each of the species
                           counts provided by the judge after sensor recovery.

This is a pure calculation (no CV, no model): the route validates that counts
were provided and delegates to the submodule logic.
"""

from flask import jsonify, request

from app import app
import modules.edna_logic as edna_logic


@app.route("/edna/frequency", methods=["POST"])
def edna_frequency():
    data = request.get_json(silent=True) or {}
    counts = data.get("counts")
    if counts is None:
        return jsonify({"ok": False, "error": "no_counts"}), 400

    try:
        result = edna_logic.frequency(counts)
    except FileNotFoundError as exc:
        # Submodule not initialised, etc.
        return jsonify({"ok": False, "error": "logic_unavailable", "detail": str(exc)}), 500
    except (KeyError, TypeError, ValueError):
        # Malformed counts payload (e.g. missing name/count, non-numeric).
        return jsonify({"ok": False, "error": "bad_input"}), 400

    return jsonify(result), (200 if result["ok"] else 422)
