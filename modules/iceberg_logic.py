"""Thin wrapper that exposes the Task 2.2 iceberg threat-level logic from the submodule.

The implementation lives in the `Mate_task_2026` git submodule at
`external/mate_task_2026/Task 2.2/iceberg.py`. That folder name ("Task 2.2") has a
space and a dot, so it is not a valid Python package and can't be imported normally.
We load it via importlib and re-export `evaluate`.

Auto-imported (indirectly, via iceberg.py) by `modules/__init__.py`; importing must
have no side effects — the submodule's CLI demo is guarded behind
`if __name__ == "__main__"`, so loading it is safe. The calculation is pure (no CV,
no model), so this stays cheap.
"""

import importlib.util
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
_ICEBERG_PY = _REPO_ROOT / "external" / "mate_task_2026" / "Task 2.2" / "iceberg.py"

_logic_module = None


def _load_logic_module():
    """Load (and cache) the submodule's iceberg.py as a module object."""
    global _logic_module
    if _logic_module is not None:
        return _logic_module

    if not _ICEBERG_PY.is_file():
        raise FileNotFoundError(
            f"Iceberg logic script not found at {_ICEBERG_PY}. "
            "Did you run `git submodule update --init --recursive`?"
        )

    spec = importlib.util.spec_from_file_location("iceberg_task", str(_ICEBERG_PY))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _logic_module = module
    return module


def evaluate(ice_lat, ice_lon, heading_deg, keel_depth_m, forward_only=False):
    """Evaluate the iceberg threat level for each of the 4 fixed platforms.

    Delegates to the submodule's `evaluate`. Returns a dict:
      {ok, platforms: [{name, passing_distance_nm, water_depth_m, keel_ratio,
                        surface_threat, subsea_threat}, ...]}
    """
    return _load_logic_module().evaluate(
        ice_lat, ice_lon, heading_deg, keel_depth_m, forward_only=forward_only
    )
