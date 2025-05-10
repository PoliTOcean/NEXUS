#!/bin/bash

SCRIPT_DIR=$(dirname "$0")
VIDEO="${SCRIPT_DIR}/../test_video.mp4"

echo "[+] Building and starting Janus container..."
docker-compose up --build -d

echo "[+] Waiting 5 seconds for Janus to initialize..."
sleep 5

if [ ! -f "$VIDEO" ]; then
  echo "[!] Missing video file at: $VIDEO"
  exit 1
fi

# Stream definitions: (name port)
STREAMS=(
  "camera1 5004"
  "camera2 5005"
  "camera3 5006"
  "camera4 5007"
)

for STREAM in "${STREAMS[@]}"; do
  set -- $STREAM
  NAME=$1
  PORT=$2

  echo "[+] Launching $NAME on port $PORT"

  ffmpeg -stream_loop -1 -re -i "$VIDEO" \
    -vf "scale=854:480" -an \
    -vcodec libx264 -preset ultrafast -tune zerolatency -crf 32 \
    -f rtp "rtp://127.0.0.1:$PORT" > /dev/null 2>&1 &
done

echo "[✓] All 4 streams launched"
