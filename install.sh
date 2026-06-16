#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Fetch git submodules (e.g. external/mate_task_2026, which provides the coral
# and crab CV pipelines used by the /coral and /crab backend routes). Without
# this those modules fail to import.
if [ -f "$ROOT_DIR/.gitmodules" ]; then
  git submodule update --init --recursive
fi

# Python 3.12 is required: some native dependencies (numpy/contourpy/matplotlib)
# ship wheels only up to 3.12. Prefer python3.12 if available; otherwise fall back
# to python3 with a warning (on Linux the source build usually succeeds).
PYTHON=""
for candidate in python3.12 python3; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "No python3 interpreter found. Install Python 3.12." >&2
  exit 1
fi
if ! "$PYTHON" -c 'import sys; sys.exit(0 if sys.version_info[:2] == (3, 12) else 1)'; then
  echo "Warning: $PYTHON is not Python 3.12. Some dependencies (numpy/matplotlib) only ship wheels up to 3.12; install python3.12 if the build fails." >&2
fi

"$PYTHON" -m venv venv
source "$ROOT_DIR/venv/bin/activate"
# --no-cache-dir keeps the pip wheel cache from doubling peak disk usage. This
# matters because ultralytics (Task 2.1 crab detector) pulls in torch + CUDA
# wheels (several GB); caching them can fill a small disk during extraction.
python -m pip install --no-cache-dir --no-warn-script-location -r requirements.txt

cd "$ROOT_DIR/frontend"
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
  else
    echo "pnpm is required but was not found. Install pnpm or enable corepack." >&2
    exit 1
  fi
fi
pnpm install --frozen-lockfile
pnpm build:apps
