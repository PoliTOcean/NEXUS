#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

python3 -m venv venv
source "$ROOT_DIR/venv/bin/activate"
python -m pip install --no-warn-script-location -r requirements.txt

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
