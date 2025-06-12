#!/bin/bash

SCRIPT_DIR=$(dirname "$0")
VIDEO_FILE="${SCRIPT_DIR}/stream_video/test_video.mp4"
VIDEO_SCRIPT="${SCRIPT_DIR}/stream_video/JANUS_WEBRTC/start.sh" 
#VIDEO_SCRIPT="${SCRIPT_DIR}/stream_video/MJPEG_version/stream.py" 
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


# Check the status of the Mosquitto service
service_status=$(sudo service mosquitto status)

# Check if the service is running
if echo "$service_status" | grep -q "mosquitto is running"; then
    echo "Mosquitto is already running."
else
    echo "Mosquitto is not running. Starting the service..."
    sudo service mosquitto start
    
    # Verify if the service started successfully
    if sudo service mosquitto status | grep -q "mosquitto is running"; then
        echo "Mosquitto has been started successfully."
    else
        echo "Failed to start Mosquitto."
    fi
fi

source "$VENV_DIR/bin/activate"

# Mqtt debug
python "$MOSQUITTO_SENDER" &
echo "[✓] MQTT test sender started"
echo ""

# Stream video - check file extension to determine how to execute
if [[ "$VIDEO_SCRIPT" == *.sh ]]; then
    # Execute .sh files with bash
    chmod +x "$VIDEO_SCRIPT"
    "$VIDEO_SCRIPT"
else
    # Execute .py files with python
    python "$VIDEO_SCRIPT"
fi

exit 0