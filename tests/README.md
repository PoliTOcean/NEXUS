# Tests

## Prerequisites

Installed:
- mosquitto (already running if executed in devcontainer)
```bash
sudo apt update -y && sudo apt install mosquitto mosquitto-clients -y
```
- A `python` virtual environment with `../requirements.txt` libraries installed
- A .mp4 file named `test_video.mp4` in  `stream_video/` directory

- janus
```bash
chmod +x ./stream_video/JANUS_WEBRTC/install.sh && ./stream_video/JANUS_WEBRTC/install.sh
```
IMPORTANT:
Use Google Chrome, go to 'chrome://flags/#enable-webrtc-hide-local-ips-with-mdns' and disable: 'Anonymize local IPs exposed by WebRTC.'

## How to run tests
Run:
```bash
chmod +x ./run_tests.sh
sudo ./run_tests.sh <path_to_venv>
```
<path_to_venv> is probably ../venv

Now, you can run the GUI with
```bash
make test
```