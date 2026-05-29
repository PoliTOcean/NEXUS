# Tests


## Test ROV page

### Prerequisites
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
### How to run tests
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

## Test FLOAT page

For current end-to-end FLOAT testing, flash the real `Float_2025` firmware to ESPA/ESPB and connect the ESPB serial bridge to NEXUS. The legacy `/float/float.ino` sketch is only a minimal simulator for old page smoke tests and does not cover runtime profile/PID/balance/motor configuration or stored profile replay.
