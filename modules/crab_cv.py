"""Thin wrapper exposing the Task 2.1 crab-counting CV pipeline from the submodule.

The implementation lives in the `Mate_task_2026` git submodule at
`external/mate_task_2026/Task 2.1/crab_counter.py`. That folder name ("Task 2.1")
has a space and a dot, so it is not a valid Python package and can't be imported
normally. We load it via importlib and re-export `analyze`.

Auto-imported by `modules/__init__.py`; importing must have no side effects. The
YOLO model is loaded lazily inside the submodule's analyze(), so import stays cheap.
"""

import importlib.util
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
_CRAB_PY = _REPO_ROOT / "external" / "mate_task_2026" / "Task 2.1" / "crab_counter.py"

_cv_module = None


def _load_cv_module():
    global _cv_module
    if _cv_module is not None:
        return _cv_module

    if not _CRAB_PY.is_file():
        raise FileNotFoundError(
            f"Crab counter script not found at {_CRAB_PY}. "
            "Did you run `git submodule update --init --recursive`?"
        )

    spec = importlib.util.spec_from_file_location("crab_counter", str(_CRAB_PY))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _cv_module = module
    return module


def analyze(image_path, output_dir, conf=0.5):
    """Run the crab detector on a single image.

    Returns a dict:
      {ok, green_count, total_detections, annotated_path, error}
    """
    return _load_cv_module().analyze(image_path, output_dir, conf=conf)
