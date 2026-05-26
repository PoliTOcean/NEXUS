#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p /tmp/matplotlib /tmp/nexus-mosquitto
chmod +x install.sh .devcontainer/start-services.sh

./install.sh
