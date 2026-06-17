# NEXUS - Navigation EXploration User System

**Repository type:** Backend + frontend monorepo  
**Team:** PoliTOcean @ Politecnico di Torino  
**Role:** Operator station for EVA ROV and FLOAT missions

--------------------------------------------------------------------------

## TABLE OF CONTENTS

- [Project Overview](#project-overview)
- [System Architecture](#system-architecture)
- [Repository Layout](#repository-layout)
- [Runtime Modes and Routes](#runtime-modes-and-routes)
- [Installation](#installation)
- [Development Workflows](#development-workflows)
- [Mock Tests and Local Simulation](#mock-tests-and-local-simulation)
- [Backend API Contract](#backend-api-contract)
- [Frontend Workspace](#frontend-workspace)
- [Legacy Frontend](#legacy-frontend)
- [Troubleshooting](#troubleshooting)

--------------------------------------------------------------------------

## PROJECT OVERVIEW

NEXUS is the mission-station software used to operate PoliTOcean systems from a control computer. It contains:

- a **Flask backend** for hardware-facing services and HTTP APIs;
- an **EVA frontend** for ROV telemetry, cameras, controller state, and mission control;
- a **FLOAT frontend** for serial connection, commands, runtime profile/configuration, profile data, packages, and logs;
- **MATE task modules** — CV pipelines (Coral Garden measurement, Task 1.2; invasive crab counter, Task 2.1) plus pure calculators (Iceberg threat level, Task 2.2; eDNA frequency, Task 2.5) exposed as `/coral`, `/crab`, `/iceberg` and `/edna` backend routes and triggered from EVA;
- test utilities for MQTT, Janus/WebRTC, and mission telemetry simulation.

The task logic lives in the [`Mate_task_2026`](https://github.com/PoliTOcean/Mate_task_2026) repository, vendored here as the `external/mate_task_2026` **git submodule**. The CV tasks capture a camera frame in EVA and return measurements/counts plus an annotated image; the calculator tasks (iceberg, eDNA) take manual numeric input from an EVA dialog and return a pure result — no camera, no model.

The current repository is a monorepo. The old static Flask UI has been kept in `legacy_frontend/` for rollback, while the active React/Vite UI lives in `frontend/` and is served by Flask after build.

### Mission Responsibilities

| Area | Responsibility |
|:-----|:---------------|
| EVA ROV | Read telemetry from MQTT, display controller status, switch cameras, render Janus or debug streams. |
| FLOAT | Open/check serial communication, configure runtime profile/PID/balance/motor settings, send commands to the FLOAT bridge, fetch stored profile data, show packages/logs. |
| Backend | Expose stable HTTP routes, manage controller startup, talk to serial devices, provide runtime configuration. |
| Frontend | Provide operator-grade interfaces for EVA and FLOAT without embedding hardware logic in the browser. |

--------------------------------------------------------------------------

## SYSTEM ARCHITECTURE

### Monorepo Architecture

```mermaid
flowchart TB
    repo["NEXUS monorepo"]

    subgraph backend["Backend - Flask/Python"]
        app["app.py\nFlask app + CORS"]
        run["run.py\nentrypoint"]
        modules["modules/\nHTTP routes"]
        rov["utils_rov/\ncontroller + MQTT"]
        flt["utils_float/\nserial FLOAT bridge"]
        info["modules/info.json\nruntime endpoints"]
    end

    subgraph frontend["Frontend - React/Vite/pnpm"]
        eva["apps/eva\nEVA mission UI"]
        floatui["apps/float\nFLOAT mission UI"]
        ui["packages/ui\nshared components"]
    end

    subgraph generated["Generated build output"]
        evadist["frontend_dist/eva"]
        floatdist["frontend_dist/float"]
    end

    subgraph legacy["Rollback area"]
        oldstatic["legacy_frontend/static"]
        oldtpl["legacy_frontend/template"]
    end

    repo --> backend
    repo --> frontend
    repo --> generated
    repo --> legacy

    run --> app
    app --> modules
    modules --> rov
    modules --> flt
    modules --> info

    eva --> ui
    floatui --> ui
    eva --> evadist
    floatui --> floatdist
    modules --> evadist
    modules --> floatdist

    classDef backendFill fill:#163b65,stroke:#6ab7ff,color:#ffffff
    classDef frontendFill fill:#16563c,stroke:#67e8a5,color:#ffffff
    classDef generatedFill fill:#6b4b12,stroke:#ffd166,color:#ffffff
    classDef legacyFill fill:#5f2434,stroke:#ff8fab,color:#ffffff

    class app,run,modules,rov,flt,info backendFill
    class eva,floatui,ui frontendFill
    class evadist,floatdist generatedFill
    class oldstatic,oldtpl legacyFill
```

### Runtime Deployment

```mermaid
flowchart LR
    browser["Operator browser"]
    flask["NEXUS Flask\nhttp://host:8000"]
    eva["/eva/\nEVA SPA"]
    floatui["/float/\nFLOAT SPA"]
    api["HTTP API\n/info /FLOAT/* /CONTROLLER/*"]
    mqtt["Mosquitto MQTT\n1883 TCP / 9000 WebSocket"]
    janus["Janus Gateway\n8188 WebSocket"]
    controller["ROV Controller"]
    serial["FLOAT USB Serial"]

    browser --> flask
    flask --> eva
    flask --> floatui
    eva --> api
    floatui --> api
    api --> controller
    api --> serial
    eva -. "mqtt://...:9000" .-> mqtt
    eva -. "ws://...:8188" .-> janus
    controller -. "status + commands" .-> mqtt

    classDef station fill:#1f2937,stroke:#93c5fd,color:#fff
    classDef app fill:#064e3b,stroke:#6ee7b7,color:#fff
    classDef service fill:#78350f,stroke:#fbbf24,color:#fff
    classDef hardware fill:#581c87,stroke:#d8b4fe,color:#fff

    class browser,flask station
    class eva,floatui,api app
    class mqtt,janus service
    class controller,serial hardware
```

### Build and Serve Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Pnpm as pnpm workspace
    participant Vite as Vite builds
    participant Dist as frontend_dist
    participant Flask as Flask routes
    participant Browser as Browser

    Dev->>Pnpm: make build-ui
    Pnpm->>Vite: build @politocean/eva
    Vite->>Dist: write frontend_dist/eva
    Pnpm->>Vite: build @politocean/float
    Vite->>Dist: write frontend_dist/float
    Browser->>Flask: GET /eva/ or /float/
    Flask->>Dist: serve index.html and assets
    Browser->>Flask: call same-origin APIs
```

--------------------------------------------------------------------------

## REPOSITORY LAYOUT

```text
NEXUS/
  app.py                      Flask app setup, JSON provider, CORS
  run.py                      Main backend entrypoint
  install.sh                  Python + frontend installation script
  makefile                    Developer commands
  requirements.txt            Python dependencies

  modules/
    index.py                  Launcher, SPA serving, /info route
    joystick.py               /CONTROLLER/start_status
    float.py                  /FLOAT/* routes
    coral.py                  /coral/* routes (Task 1.2 coral garden)
    coral_cv.py               loads analyze() from the submodule (Task 1.2)
    crab.py                   /crab/* routes (Task 2.1 invasive crab counter)
    crab_cv.py                loads analyze() from the submodule (Task 2.1)
    iceberg.py                /iceberg/* route (Task 2.2 iceberg threat level)
    iceberg_logic.py          loads evaluate() from the submodule (Task 2.2)
    edna.py                   /edna/* route (Task 2.5 eDNA frequency)
    edna_logic.py             loads frequency() from the submodule (Task 2.5)
    info.json                 debug/production runtime endpoints

  external/
    mate_task_2026/           git submodule: coral/crab CV + iceberg/eDNA calculators

  utils_rov/
    controller.py             ROV controller orchestration
    mqtt_c.py                 MQTT client wrapper
    main.py                   Controller initialization entrypoint
    config/                   ROV/controller configuration

  utils_float/
    float.py                  FLOAT serial protocol helper
    config/                   FLOAT serial/config data

  frontend/
    apps/eva/                 EVA React app
    apps/float/               FLOAT React app
    packages/ui/              Shared UI/design-system package
    package.json              pnpm workspace scripts
    pnpm-workspace.yaml       Workspace package list
    turbo.json                Turbo task graph

  frontend_dist/              Generated Vite output, ignored by Git
    eva/
    float/

  captures/                   CV input/annotated images + equations.txt, ignored by Git

  legacy_frontend/            Previous HTML/CSS/JS Flask frontend
  tests/                      MQTT, EVA telemetry, Janus, FLOAT test utilities
```

`frontend_dist/` is generated by `make build-ui` or `./install.sh`. Do not edit it manually. `external/mate_task_2026` is a git submodule — populate it with `git submodule update --init --recursive` (or `make submodules`), which `./install.sh` runs automatically.

--------------------------------------------------------------------------

## RUNTIME MODES AND ROUTES

NEXUS reads the runtime mode from `run.py --mode`. The mode selects endpoints from `modules/info.json`.

Default local backend port is `8000`. This avoids the common macOS AirPlay Receiver conflict on port `5000`. Override it with `NEXUS_PORT` or `--port` when needed.

| Mode | Purpose | MQTT | Janus |
|:-----|:--------|:-----|:------|
| `debug` | Local development and UI tests | `mqtt://127.0.0.1:9000` | `ws://127.0.0.1:8188` |
| `production` | Vehicle network deployment | `mqtt://10.0.0.254:9000` | `ws://10.0.0.69:8188` |

### Main Routes

| Route | Served by | Description |
|:------|:----------|:------------|
| `/` | Flask template | Mission launcher with EVA/FLOAT links. |
| `/eva/` | `frontend_dist/eva` | EVA React app. |
| `/float/` | `frontend_dist/float` | FLOAT React app. |
| `/ROV` | redirect | Compatibility redirect to `/eva/`. |
| `/FLOAT` | redirect | Compatibility redirect to `/float/`. |
| `/CAMERAS` | redirect | Compatibility redirect to `/eva/`. |
| `/info` | Flask API | Runtime mode, MQTT, Janus, camera metadata, status list. |
| `/CONTROLLER/start_status` | Flask API | Starts/checks the ROV controller thread and joystick state. |
| `/FLOAT/*` | Flask API | FLOAT serial connection, commands, status, runtime configuration, profile data. |

--------------------------------------------------------------------------

## INSTALLATION

### Requirements

| Tool | Minimum / expected |
|:-----|:-------------------|
| Python | **3.12 (required)** — 3.13 is not supported, some native deps (numpy/matplotlib) have no 3.13 wheels |
| Node.js | 20+ |
| pnpm | 9.x, via Corepack or local install |
| Git | Required — the CV pipelines are a git submodule (`external/mate_task_2026`) |
| Disk | ~10 GB free for the venv — `ultralytics` pulls in `torch` + CUDA wheels (Task 2.1) |
| Mosquitto | Needed for EVA MQTT mock tests |
| Janus | Optional for real WebRTC stream tests |

> **Disk note:** the `ultralytics` dependency (Task 2.1 crab detector) downloads
> `torch` and the NVIDIA CUDA wheels (several GB). The install scripts use
> `pip install --no-cache-dir` so the wheel cache doesn't double the peak disk
> usage and fill a small disk during extraction. If you install deps manually,
> use the same flag. The model runs on CPU when no NVIDIA GPU is present.

### One-command Setup

**Linux / macOS:**

```bash
cd path/to/NEXUS
./install.sh
```

**Windows (PowerShell):**

```powershell
cd path\to\NEXUS
./install.ps1
```

> The install scripts create the `venv` with **Python 3.12** (`py -3.12` on Windows,
> `python3.12` on Linux/macOS). If 3.12 is missing, install it from
> [python.org](https://www.python.org/downloads/release/python-3128/) — it can be
> installed alongside other versions (e.g. 3.13), no need to uninstall.

The install script does the following:

1. initializes git submodules (`external/mate_task_2026`, the CV pipelines);
2. creates or reuses `venv` (with Python 3.12);
3. installs `requirements.txt` with `--no-cache-dir` (torch/CUDA are large);
4. enters `frontend/`;
5. enables Corepack if `pnpm` is missing and Corepack is available;
6. runs `pnpm install --frozen-lockfile`;
7. builds EVA and FLOAT into `frontend_dist/`.

> **Cloning:** use `git clone --recurse-submodules` to pull the CV submodule up
> front. If you already cloned without it, run `git submodule update --init
> --recursive` (or `make submodules`) — `./install.sh` also does this for you.

### Dev Container

The repository includes a VS Code devcontainer for a reproducible mission-station environment. It installs Python, Node/pnpm, Mosquitto, and the native build tools required by the backend dependencies.

Use it from VS Code with **Dev Containers: Reopen in Container**. On first creation it runs `./install.sh`; on every container start it launches Mosquitto with `.devcontainer/mosquitto.conf`.

Forwarded ports:

| Port | Service |
|:-----|:--------|
| `8000` | NEXUS Flask default |
| `5000` | Flask alternate |
| `1883` | MQTT TCP |
| `9000` | MQTT WebSocket |
| `8088` | Janus HTTP |
| `8188` | Janus WebSocket |

--------------------------------------------------------------------------

## DEVELOPMENT WORKFLOWS

### Make Targets

| Command | What it does | When to use |
|:--------|:-------------|:------------|
| `make install` | Runs `./install.sh`. | Fresh checkout or dependency refresh. |
| `make submodules` | `git submodule update --init --recursive`. | After a plain `git pull` to refresh the CV submodule. |
| `make build-ui` | Builds EVA/FLOAT only. | Before serving UI from Flask. |
| `make dev-backend` | Runs `python3 run.py --mode debug --port 8000`. | Local backend/API development. |
| `make dev-eva` | Runs Vite EVA with `VITE_NEXUS_BASE_URL=http://127.0.0.1:8000`. | Fast EVA UI development. |
| `make dev-float` | Runs Vite FLOAT with the local backend URL. | Fast FLOAT UI development. |
| `make nexus` | Builds UI, then starts production backend mode. | Integrated production-like run. |
| `make controller` | Runs only the ROV controller entrypoint. | Controller debugging. |
| `make test` | Alias for debug backend startup. | Historical compatibility. |

### Integrated Flask Run

Build the UI and serve it from Flask:

```bash
make build-ui
make dev-backend
```

Open:

```text
http://127.0.0.1:8000/
http://127.0.0.1:8000/eva/
http://127.0.0.1:8000/float/
```

In this mode the frontend uses same-origin API calls, so browser requests go back to the same Flask host.

### Vite Development Run

Run the backend in one terminal:

```bash
make dev-backend
```

Run one frontend app in another terminal:

```bash
make dev-eva
# or
make dev-float
```

The Vite apps use `VITE_NEXUS_BASE_URL=http://127.0.0.1:8000` so API calls still reach Flask.

--------------------------------------------------------------------------

## MOCK TESTS AND LOCAL SIMULATION

### EVA UI Without Real Janus Cameras

In debug mode, `/info` returns camera metadata. EVA uses that metadata to create debug canvas camera streams, so a local Janus instance is not required for basic UI testing.

### EVA MQTT Realistic Mission Mock

This is the recommended local smoke test for EVA telemetry.

1. Start Mosquitto with TCP and WebSocket listeners:

```bash
sudo mosquitto -v -c tests/mosquitto/mosquitto.conf
```

The config exposes:

| Listener | Purpose |
|:---------|:--------|
| `1883` | Python publishers and ordinary MQTT clients. |
| `9000` | Browser MQTT over WebSocket, consumed by EVA. |

2. Start the backend:

```bash
make dev-backend
```

3. In another terminal, publish a deterministic EVA mission profile:

```bash
source venv/bin/activate
python tests/eva/eva_realistic_mission.py --host 127.0.0.1 --port 1883 --loop
```

4. Open EVA:

```text
http://127.0.0.1:8000/eva/
```

Expected result:

- backend is online;
- MQTT connects through `mqtt://127.0.0.1:9000`;
- telemetry, attitude, depth, and mode cards update;
- camera panes show debug streams.

### EVA Random MQTT Stress Sender

For noisy/random telemetry:

```bash
source venv/bin/activate
python tests/mosquitto/test_mqtt.py
```

Use this when you want to stress UI rendering rather than replay a realistic mission.

### Optional Janus/WebRTC Stream Test

The older Janus test harness is still available under `tests/stream_video/JANUS_WEBRTC/`.

```bash
chmod +x tests/stream_video/JANUS_WEBRTC/install.sh
./tests/stream_video/JANUS_WEBRTC/install.sh
```

The combined legacy test runner expects Mosquitto, Janus, a Python venv, and a `tests/stream_video/test_video.mp4` file:

```bash
sudo tests/run_tests.sh ./venv
```

This path is useful for stream infrastructure testing. It is not required for the default EVA debug-camera workflow.

### FLOAT Smoke Test Without Hardware

Without an ESP32/FLOAT serial bridge connected, the backend should still respond predictably:

```bash
make dev-backend
curl http://127.0.0.1:8000/FLOAT/status?msg=STATUS
```

Expected response shape:

```json
{"code":"FLOAT","status":false,"text":"SERIAL NOT OPENED"}
```

This confirms Flask and the FLOAT API route are reachable. Full FLOAT command/config/profile tests require the ESPB bridge connected to ESPA.

### FLOAT Hardware / Bench Setup

The current FLOAT workflow expects the real ESPB serial bridge connected to NEXUS and ESPA running the FLOAT firmware. The historical `tests/float/float.ino` sketch is only a lightweight simulator for old UI smoke tests and does not implement the full runtime profile/config contract.

Once the bridge is connected, open:

```text
http://127.0.0.1:8000/float/
```

and use the UI to run `START`, `STATUS`, runtime settings, command, package, and stored-profile workflows.

--------------------------------------------------------------------------

## BACKEND API CONTRACT

### EVA API

| Method | Path | Owner | Purpose |
|:-------|:-----|:------|:--------|
| `GET` | `/info` | `modules/index.py` | Returns runtime configuration. |
| `GET` | `/CONTROLLER/start_status` | `modules/joystick.py` | Starts/checks ROV controller and joystick status. |

### MATE Task API

All task logic lives in the `external/mate_task_2026` submodule and is re-exported
through thin importlib wrappers (the `Task X.Y` folder names have spaces/dots, so
they aren't importable packages). The CV tasks and the pure calculators share the
backend pattern but differ in input.

**CV tasks.** Both endpoints take a captured camera frame (multipart `image`), run
the pipeline, and return JSON plus an annotated image served back from `captures/`.
A CV failure (e.g. ruler not found) returns HTTP `422` with a structured body
rather than a transport error.

| Method | Path | Owner | Purpose |
|:-------|:-----|:------|:--------|
| `POST` | `/coral/analyze` | `modules/coral.py` | Task 1.2: measure coral-garden length/height (cm) + count colored targets; writes `equations.txt` for the SolidWorks model. Returns `{ok, length_cm, height_cm, targets_count, annotated_url, ...}`. |
| `GET` | `/coral/captures/<file>` | `modules/coral.py` | Serve a saved coral input/annotated image. |
| `POST` | `/crab/analyze` | `modules/crab.py` | Task 2.1: detect and count invasive European Green crabs (YOLOv8). Returns `{ok, green_count, total_detections, annotated_url, ...}`. |
| `GET` | `/crab/captures/<file>` | `modules/crab.py` | Serve a saved crab input/annotated image. |

**Pure calculators.** These take manual numeric input as JSON (no camera, no model)
and return a pure result. A structured failure (bad input / zero total) returns
`400` or `422` with a body rather than a transport error.

| Method | Path | Owner | Purpose |
|:-------|:-----|:------|:--------|
| `POST` | `/iceberg/evaluate` | `modules/iceberg.py` | Task 2.2: given an iceberg info sheet (`lat`, `lon`, `heading_deg`, `keel_depth_m`), compute the green/yellow/red surface + subsea threat for the 4 fixed oil platforms. Returns `{ok, platforms: [{name, passing_distance_nm, water_depth_m, keel_ratio, surface_threat, subsea_threat}, ...]}`. |
| `POST` | `/edna/frequency` | `modules/edna.py` | Task 2.5: given species `counts` (dict or list), compute each species' % frequency for the judge. Returns `{ok, total, species: [{name, count, percent, percent_display}, ...]}`. |

These flows are triggered from the EVA header buttons ("Coral Garden" / "Crab
Counter" / "Iceberg" / "eDNA"). For in-browser testing of the CV tasks without
hardware, the primary debug camera can stream a sample image via
`VITE_CORAL_STUB=1` or `VITE_CRAB_STUB=1`; the calculators need no camera.

### EVA Realtime Contract

The EVA UI reads `/info`, then connects to MQTT and Janus/WebRTC.

```mermaid
sequenceDiagram
    participant UI as EVA UI
    participant Flask as NEXUS Flask
    participant MQTT as MQTT Broker
    participant Janus as Janus Gateway

    UI->>Flask: GET /info
    Flask-->>UI: mode, mqtt.ip, janus.ip, cameras
    UI->>Flask: GET /CONTROLLER/start_status
    Flask-->>UI: controller status
    UI->>MQTT: subscribe status/
    UI->>MQTT: subscribe camera_control/
    MQTT-->>UI: telemetry + camera commands
    UI->>Janus: list/watch streams
    Janus-->>UI: MediaStream tracks
```

Known EVA MQTT topics:

| Topic | Direction | Payload |
|:------|:----------|:--------|
| `status/` | Broker -> UI | JSON telemetry and controller-mode state. |
| `camera_control/` | Broker -> UI | Text containing `NEXT_CAMERA` or `PREV_CAMERA`. |

Important `status/` fields consumed by EVA include:

- `rov_armed`, `work_mode`, `torque_mode`
- `controller_state.DEPTH`, `controller_state.ROLL`, `controller_state.PITCH`
- `depth`, `reference_z`
- `roll`, `pitch`, `yaw`, `reference_pitch`

### FLOAT API

| Method | Path | Owner | Purpose |
|:-------|:-----|:------|:--------|
| `GET` | `/FLOAT/start` | `modules/float.py` | Opens/checks serial communication. |
| `GET` | `/FLOAT/status?msg=STATUS` | `modules/float.py` | Polls FLOAT status text. |
| `GET` | `/FLOAT/msg?msg=<command>` | `modules/float.py` | Sends a FLOAT command and returns success only after the expected ESPA ACK, except `LISTENING` which starts the data stream. |
| `GET` | `/FLOAT/listen` | `modules/float.py` | Reads stored profile data after `LISTENING`; returns raw arrays and generated plots. |
| `GET` / `POST` | `/FLOAT/profile` | `modules/float.py` | Gets/sets persisted mission profile values used by `GO`. |
| `GET` / `POST` | `/FLOAT/pid-config` | `modules/float.py` | Gets/sets persisted PID runtime configuration. |
| `GET` / `POST` | `/FLOAT/balance-config` | `modules/float.py` | Gets/sets persisted balance routine configuration. |
| `GET` / `POST` | `/FLOAT/motor-config` | `modules/float.py` | Gets/sets persisted motor speed/acceleration configuration. |

### FLOAT Command Flow

```mermaid
sequenceDiagram
    participant UI as FLOAT UI
    participant Flask as NEXUS Flask
    participant Serial as FLOAT Serial Bridge

    UI->>Flask: GET /FLOAT/start
    Flask->>Serial: start_communication()
    Serial-->>Flask: status + text
    Flask-->>UI: JSON response

    loop every 3 seconds
        UI->>Flask: GET /FLOAT/status?msg=STATUS
        Flask->>Serial: msg_status("STATUS")
        Serial-->>Flask: pipe-separated status text
        Flask-->>UI: JSON response
    end

    UI->>Flask: GET /FLOAT/msg?msg=GO
    Flask->>Serial: msg_status("GO")
    Serial-->>Flask: GO_RECVD
    Flask-->>UI: success JSON only if ACK matches

    UI->>Flask: GET /FLOAT/msg?msg=LISTENING
    Flask->>Serial: send("LISTENING")
    Serial-->>Flask: stored packet stream starts
    Flask-->>UI: JSON response

    loop until FINISHED
        UI->>Flask: GET /FLOAT/listen
        Flask->>Serial: read stored JSON packets until STOP_DATA
        Flask-->>UI: profile raw data + plots
    end
```

Common FLOAT commands from the UI:

One-shot commands such as `GO`, `BALANCE`, `CLEAR_SD`, `HOME_MOTOR`, `STOP`, and `TEST_STEPS` are acknowledged by ESPA before NEXUS reports success. For example, `BALANCE` must return `CMD3_RECVD`; a serial write without that ACK is reported as a failed command.

| Command | Purpose |
|:--------|:--------|
| `GO` | Run the currently configured runtime mission profile. |
| `BALANCE` | Run balance routine. |
| `CLEAR_SD` | Clear stored profile/log data on the FLOAT side. |
| `SWITCH_AUTO_MODE` | Toggle autonomous mode. |
| `SEND_PACKAGE` | Request the current live data package, including pressure/depth/syringe position. |
| `TRY_UPLOAD` | Trigger OTA/upload flow. |
| `HOME_MOTOR` | Home the motor system. |
| `STOP` | Emergency stop. |
| `TEST_STEPS <steps>` | Run test steps. |
| `PID_CONFIG_SET <kp> <ki> <kd> <period_ms> <alpha_d> <integral_limit> <min_retarget_frac> <u_neutral>` | Update persisted PID config. |
| `PID_CONFIG_GET` | Read PID config JSON. |
| `PROFILE_SET <count> <deep> <shallow_top> <tol> <hold> <pid_timeout> <ascent_timeout> <surface_offset>` | Update persisted mission profile. |
| `PROFILE_GET` | Read mission profile JSON. |
| `BALANCE_CONFIG_SET <hold_ms> <stop_delta_kpa> <stop_samples> <sample_period_ms>` | Update persisted balance config. |
| `BALANCE_CONFIG_GET` | Read balance config JSON. |
| `MOTOR_CONFIG_SET <max_speed> <max_accel> <homing_speed> <test_speed>` | Update persisted motor config. |
| `MOTOR_CONFIG_GET` | Read motor config JSON. |
| `LISTENING` | Trigger stored profile data transfer after the FLOAT has surfaced/recovered. |

Known status tokens parsed by the UI:

- `CONNECTED`
- `CONNECTED_W_DATA`
- `EXECUTING_CMD`
- `AUTO_MODE_YES` / `AUTO_MODE_NO`
- `CONN_OK` / `CONN_LOST`
- `BATTERY:<value>`
- `RSSI:<value>`
- `NO USB`
- `DISCONNECTED`
- `TIMEOUT_ON_<command>`

Profile fetch payloads expose `raw.times` / `raw.time_s`, `depth_m`, `pressure_kpa`, `syringe_u`, `profile_id`, `phase`, `sensor_depth_m`, and `company_number`. The React chart renders depth, pressure, and normalized syringe position over time; the legacy UI also accepts a third generated plot when present.

--------------------------------------------------------------------------

## FRONTEND WORKSPACE

The frontend workspace is copied from the former `politocean-ui` repository and now lives inside `frontend/`.

### Workspace Apps

| Package | Path | Description |
|:--------|:-----|:------------|
| `@politocean/eva` | `frontend/apps/eva` | EVA ROV mission control. |
| `@politocean/float` | `frontend/apps/float` | FLOAT mission control. |
| `@politocean/ui` | `frontend/packages/ui` | Shared components, primitives, styles, types. |

### Frontend Scripts

Run from `frontend/`:

| Command | Purpose |
|:--------|:--------|
| `pnpm build:apps` | Build only EVA and FLOAT into `../frontend_dist`. |
| `pnpm --filter @politocean/eva dev` | Start EVA Vite dev server. |
| `pnpm --filter @politocean/float dev` | Start FLOAT Vite dev server. |
| `pnpm build` | Turbo build for the whole workspace. |
| `pnpm lint` | Turbo lint. |
| `pnpm typecheck` | Turbo typecheck. |
| `pnpm format` | Format workspace code. |

For app development outside Flask, provide the backend URL:

```bash
VITE_NEXUS_BASE_URL=http://127.0.0.1:8000 pnpm --filter @politocean/eva dev
VITE_NEXUS_BASE_URL=http://127.0.0.1:8000 pnpm --filter @politocean/float dev
```

For production Flask serving, no frontend environment variable is needed: the UI uses same-origin API calls.

--------------------------------------------------------------------------

## LEGACY FRONTEND

The previous Flask template/static frontend has been moved to:

```text
legacy_frontend/template/
legacy_frontend/static/
```

It is kept for rollback and comparison only. Active routes use the React builds from `frontend_dist/`.

--------------------------------------------------------------------------

## TROUBLESHOOTING

### EVA shows no telemetry

Check that Mosquitto is running with both listeners:

```bash
sudo mosquitto -v -c tests/mosquitto/mosquitto.conf
```

Then confirm that a publisher is sending to TCP port `1883` and that `/info` points EVA to WebSocket port `9000` in debug mode.

### Browser calls `127.0.0.1` when served from another machine

For Flask-served production builds, the UI should call same-origin routes. Rebuild with:

```bash
make build-ui
```

Only Vite development should use `VITE_NEXUS_BASE_URL`.

### `/eva/` or `/float/` returns missing files

Build the UI first:

```bash
make build-ui
```

The generated files should exist under:

```text
frontend_dist/eva/index.html
frontend_dist/float/index.html
```

### FLOAT reports `SERIAL NOT OPENED`

This is expected without the FLOAT bridge connected. Connect the ESPB/serial bridge, confirm permissions for the serial device, then call `/FLOAT/start` or open `/float/`.
