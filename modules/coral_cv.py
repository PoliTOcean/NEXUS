"""Thin wrapper that exposes the coral-garden CV pipeline from the submodule.

The actual implementation lives in the `Mate_task_2026` git submodule at
`external/mate_task_2026/Task 1.2/final.py`. That folder name ("Task 1.2") has a
space and a dot, so it is not a valid Python package and cannot be imported with
a normal `import`. We load it explicitly via importlib and re-export `analyze`.

This file lives under `modules/` and is therefore auto-imported by
`modules/__init__.py`; loading it must have no side effects (the submodule's
demo run is guarded behind `if __name__ == "__main__"`, so importing it is safe).
"""

import importlib.util
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
_FINAL_PY = _REPO_ROOT / "external" / "mate_task_2026" / "Task 1.2" / "final.py"

_cv_module = None


def _load_cv_module():
    """Load (and cache) the submodule's final.py as a module object."""
    global _cv_module
    if _cv_module is not None:
        return _cv_module

    if not _FINAL_PY.is_file():
        raise FileNotFoundError(
            f"Coral CV script not found at {_FINAL_PY}. "
            "Did you run `git submodule update --init --recursive`?"
        )

    spec = importlib.util.spec_from_file_location("coral_final", str(_FINAL_PY))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _cv_module = module
    return module


def analyze(image_path, output_dir, equations_path=None):
    """Run the coral-garden analysis on a single image.

    Delegates to the submodule's `analyze`. Returns a dict:
      {ok, length_cm, height_cm, targets_count, annotated_path, error}
    """
    return _load_cv_module().analyze(image_path, output_dir, equations_path)


def reconstruct(front_path, back_path, output_dir, equations_path=None):
    """Reconstruct the coral garden from a FRONT + BACK photo pair.

    Delegates to the submodule's `reconstruct`, which must accept the two image
    paths and return the same dict shape as `analyze`:
      {ok, length_cm, height_cm, targets_count, annotated_path, error}

    The submodule function does not exist yet (it's the CV team's work); until it
    is added the attribute lookup raises AttributeError, which the Flask route
    surfaces as `cv_unavailable`.
    """
    return _load_cv_module().reconstruct(
        front_path, back_path, output_dir, equations_path
    )
