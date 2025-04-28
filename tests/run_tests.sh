#!/bin/bash

SCRIPT_DIR=$(dirname "$0")
VIDEO_FILE="${SCRIPT_DIR}/stream_video/test_video.mp4"
VIDEO_SCRIPT="${SCRIPT_DIR}/stream_video/stream.py" 
MOSQUITTO_BROKER="${SCRIPT_DIR}/mosquitto/mosquitto_broker.sh"
MOSQUITTO_SENDER="${SCRIPT_DIR}/mosquitto/test_mqtt.py"


cleanup() {
    echo "Cleaning up... Terminating all background processes."
    # Termina tutti i processi in background
    kill $(jobs -p)
    exit 0
}

trap cleanup SIGINT


# Args parsing

if [ -z "$1" ]; then
    echo "Error: Please provide the path to your virtual environment as an argument."
    echo "Usage: $0 <path_to_venv>"
    exit 1
fi

VENV_DIR="$1"

# Is root?

if [ ! "$EUID" -eq 0 ]; then
    echo "Run this script as root"
    exit 1 
fi

# Is there mp4 file?

if [ ! -f "$VIDEO_FILE" ]; then
    echo "test_video.mp4 not found"
    exit 1
fi

# Is mosquitto installed?
if ! command -v mosquitto >/dev/null 2>&1; then
    echo "Error: 'mosquitto' is not installed on this system."
    exit 1
fi

source "$VENV_DIR/bin/activate"

# Run mosquitto_broker.sh
sudo chmod +x "$MOSQUITTO_BROKER"

"$MOSQUITTO_BROKER" &

# Mqtt debug
python "$MOSQUITTO_SENDER" &

# Stream video
python "$VIDEO_SCRIPT"

exit 0