#!/bin/bash

SCRIPT_DIR=$(dirname "$0")
VIDEO="${SCRIPT_DIR}/../test_video.mp4"

if [ ! -f "$VIDEO" ]; then
  echo "[!] Missing video file at: $VIDEO"
  exit 1
fi

# Array to store ffmpeg process IDs
FFMPEG_PIDS=()

# Cleanup function to kill all ffmpeg processes
cleanup() {
  echo
  echo "[!] Received interrupt signal, shutting down..."
  
  # Kill all ffmpeg processes we started
  if [ ${#FFMPEG_PIDS[@]} -gt 0 ]; then
    echo "[+] Stopping ${#FFMPEG_PIDS[@]} ffmpeg streams..."
    for PID in "${FFMPEG_PIDS[@]}"; do
      if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo "  - Stopped process $PID"
      fi
    done
  fi
  
  echo "[✓] Cleanup complete"
  exit 0
}

# Set trap for Ctrl+C and other termination signals
trap cleanup SIGINT SIGTERM SIGHUP

# Stream definitions: (name port)
STREAMS=(
  "camera1 5001"
  "camera2 5002"
  "camera3 5003"
  "camera4 5004"
  "camera5 5005"
)

for STREAM in "${STREAMS[@]}"; do
  set -- $STREAM
  NAME=$1
  PORT=$2

  echo "[+] Launching $NAME on port $PORT"

  ffmpeg -stream_loop -1 -re -i "$VIDEO" \
    -an \
    -vcodec libx264 -preset ultrafast -tune zerolatency -crf 32 \
    -f rtp "rtp://127.0.0.1:$PORT" > /dev/null 2>&1 &
  
  # Store the PID of the last background process (ffmpeg)
  FFMPEG_PIDS+=($!)
  echo "  - Started with PID: $!"
done

echo "[✓] All 4 streams launched"

JANUS_INSTALL_PREFIX="/opt/janus"
JANUS_CONFIG_DIR="${JANUS_INSTALL_PREFIX}/etc/janus"

# Run Janus without exec so we can clean up properly when it terminates
# Using exec would replace this shell process with Janus,
# preventing our trap handler from running on Ctrl+C
echo "[+] Starting Janus server..."
${JANUS_INSTALL_PREFIX}/bin/janus -F ${JANUS_CONFIG_DIR}

# If Janus exits naturally, also perform cleanup
cleanup