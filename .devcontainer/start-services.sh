#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOSQUITTO_CONF="$ROOT_DIR/.devcontainer/mosquitto.conf"
MOSQUITTO_LOG="${TMPDIR:-/tmp}/nexus-mosquitto/mosquitto.log"

mkdir -p "${TMPDIR:-/tmp}/nexus-mosquitto"

if pgrep -f "mosquitto.*${MOSQUITTO_CONF}" >/dev/null 2>&1; then
  echo "Mosquitto is already running for NEXUS."
  exit 0
fi

mosquitto -c "$MOSQUITTO_CONF" -d
sleep 0.3

echo "Mosquitto started with ${MOSQUITTO_CONF}. Logs: ${MOSQUITTO_LOG}"
