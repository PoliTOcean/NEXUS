#!/usr/bin/env python3
"""Publish a realistic EVA telemetry mission profile to NEXUS MQTT.

The EVA UI consumes the ``status/`` topic. This sender avoids random values and
plays a deterministic ROV-like sequence:

1. idle on deck
2. arm and enable work/torque modes
3. controlled dive to the commanded depth
4. heading sweep while hovering
5. short pitch trim correction
6. controlled ascent and disarm
"""

from __future__ import annotations

import argparse
import json
import math
import signal
import sys
import time
from dataclasses import dataclass
from typing import Iterable

import paho.mqtt.client as mqtt


TOPIC = "status/"


@dataclass(frozen=True)
class MissionPhase:
    name: str
    duration_s: float
    target_depth_m: float
    target_heading_deg: float
    target_pitch_deg: float
    armed: bool
    work_mode: bool
    torque_mode: bool
    depth_hold: str
    roll_hold: str
    pitch_hold: str


MISSION: tuple[MissionPhase, ...] = (
    MissionPhase("deck-checks", 5.0, 0.0, 92.0, 0.0, False, False, False, "OFF", "OFF", "OFF"),
    MissionPhase("arm-thrusters", 4.0, 0.0, 92.0, 0.0, True, True, True, "READY", "READY", "READY"),
    MissionPhase("controlled-dive", 18.0, 2.8, 96.0, -3.0, True, True, True, "ACTIVE", "READY", "READY"),
    MissionPhase("bottom-hover", 16.0, 3.2, 128.0, -1.0, True, True, True, "ACTIVE", "ACTIVE", "ACTIVE"),
    MissionPhase("inspection-sweep", 22.0, 3.1, 214.0, 2.5, True, True, True, "ACTIVE", "ACTIVE", "ACTIVE"),
    MissionPhase("trim-correction", 12.0, 2.6, 188.0, 0.0, True, True, True, "ACTIVE", "ACTIVE", "ACTIVE"),
    MissionPhase("controlled-ascent", 18.0, 0.4, 118.0, 4.0, True, True, True, "ACTIVE", "READY", "READY"),
    MissionPhase("surface-safe", 6.0, 0.0, 104.0, 0.0, False, False, False, "OFF", "OFF", "OFF"),
)


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def shortest_angle_delta(current: float, target: float) -> float:
    return (target - current + 180.0) % 360.0 - 180.0


def interpolate_angle(current: float, target: float, amount: float) -> float:
    return (current + shortest_angle_delta(current, target) * amount) % 360.0


def bool_status(enabled: bool) -> str:
    return "OK" if enabled else "OFF"


def phase_pairs(phases: Iterable[MissionPhase]) -> Iterable[tuple[MissionPhase, MissionPhase]]:
    phase_list = list(phases)
    for index, phase in enumerate(phase_list):
        previous = phase_list[index - 1] if index > 0 else phase
        yield previous, phase


def build_payload(
    previous: MissionPhase,
    phase: MissionPhase,
    elapsed_in_phase_s: float,
    mission_elapsed_s: float,
) -> dict[str, object]:
    progress = smoothstep(elapsed_in_phase_s / phase.duration_s)
    reference_z = previous.target_depth_m + (phase.target_depth_m - previous.target_depth_m) * progress
    reference_pitch = previous.target_pitch_deg + (phase.target_pitch_deg - previous.target_pitch_deg) * progress
    reference_heading = interpolate_angle(previous.target_heading_deg, phase.target_heading_deg, progress)

    # Small deterministic motion around the reference values. The amplitudes are
    # intentionally realistic for a stable ROV in water rather than UI stress data.
    heave_lag = 0.10 * math.sin(mission_elapsed_s * 0.65)
    roll = 1.8 * math.sin(mission_elapsed_s * 0.38) + 0.4 * math.sin(mission_elapsed_s * 1.3)
    pitch = reference_pitch + 0.9 * math.sin(mission_elapsed_s * 0.44 + 0.8)
    yaw = (reference_heading + 2.2 * math.sin(mission_elapsed_s * 0.22)) % 360.0
    depth = max(0.0, reference_z + heave_lag)

    vertical_effort = min(1.0, abs(phase.target_depth_m - previous.target_depth_m) / 2.8)
    yaw_effort = min(1.0, abs(shortest_angle_delta(previous.target_heading_deg, phase.target_heading_deg)) / 120.0)
    pitch_effort = min(1.0, abs(phase.target_pitch_deg - previous.target_pitch_deg) / 8.0)

    motor_thrust = {
        "FSX": round(18.0 + yaw_effort * 7.0 + math.sin(mission_elapsed_s * 0.8) * 1.5, 2),
        "FDX": round(18.0 - yaw_effort * 5.5 + math.cos(mission_elapsed_s * 0.7) * 1.3, 2),
        "RSX": round(17.5 - yaw_effort * 6.0 + math.sin(mission_elapsed_s * 0.6) * 1.4, 2),
        "RDX": round(17.5 + yaw_effort * 6.5 + math.cos(mission_elapsed_s * 0.9) * 1.2, 2),
        "UPFSX": round(14.0 + vertical_effort * 8.0 + pitch_effort * 2.0, 2),
        "UPFDX": round(14.0 + vertical_effort * 8.0 - pitch_effort * 1.5, 2),
        "UPRSX": round(14.0 + vertical_effort * 7.0 + pitch_effort * 1.3, 2),
        "UPRDX": round(14.0 + vertical_effort * 7.0 - pitch_effort * 1.8, 2),
    }

    pwm = {name: round(1500.0 + thrust * 8.0, 1) for name, thrust in motor_thrust.items()}

    return {
        "mission_phase": phase.name,
        "rov_armed": bool_status(phase.armed),
        "work_mode": bool_status(phase.work_mode),
        "torque_mode": bool_status(phase.torque_mode),
        "controller_state": {
            "DEPTH": phase.depth_hold,
            "ROLL": phase.roll_hold,
            "PITCH": phase.pitch_hold,
        },
        "force_z": round((reference_z - depth) * 12.0, 2),
        "force_roll": round(-roll * 1.8, 2),
        "force_pitch": round((reference_pitch - pitch) * 2.1, 2),
        "reference_z": round(reference_z, 2),
        "reference_roll": 0.0,
        "reference_pitch": round(reference_pitch, 2),
        "depth": round(depth, 2),
        "roll": round(roll, 2),
        "pitch": round(pitch, 2),
        "yaw": round(yaw, 2),
        "imu_state": "OK",
        "bar_state": "OK",
        "motor_thrust_max_xy": 42.0,
        "motor_thrust_max_z": 48.0,
        "motor_thrust": motor_thrust,
        "pwm": pwm,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Publish a realistic EVA MQTT mission profile.")
    parser.add_argument("--host", default="127.0.0.1", help="MQTT broker host.")
    parser.add_argument("--port", type=int, default=1883, help="MQTT broker TCP port.")
    parser.add_argument("--topic", default=TOPIC, help="MQTT topic consumed by EVA.")
    parser.add_argument("--rate", type=float, default=5.0, help="Messages per second.")
    parser.add_argument("--loop", action="store_true", help="Repeat the mission until interrupted.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    delay_s = 1.0 / max(args.rate, 0.1)
    running = True

    def stop(_signum: int, _frame: object) -> None:
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    client = mqtt.Client(client_id="eva-realistic-mission")
    client.connect(args.host, args.port, 60)
    client.loop_start()

    print(f"Publishing EVA realistic mission to mqtt://{args.host}:{args.port}/{args.topic}")

    try:
        while running:
            mission_elapsed_s = 0.0
            for previous, phase in phase_pairs(MISSION):
                phase_start = time.monotonic()
                print(f"phase: {phase.name}")
                while running:
                    elapsed_in_phase_s = time.monotonic() - phase_start
                    if elapsed_in_phase_s > phase.duration_s:
                        mission_elapsed_s += phase.duration_s
                        break

                    payload = build_payload(
                        previous,
                        phase,
                        elapsed_in_phase_s,
                        mission_elapsed_s + elapsed_in_phase_s,
                    )
                    result = client.publish(args.topic, json.dumps(payload), qos=0)
                    if result.rc != mqtt.MQTT_ERR_SUCCESS:
                        print(f"publish failed with rc={result.rc}", file=sys.stderr)
                    time.sleep(delay_s)

            if not args.loop:
                break
    finally:
        client.loop_stop()
        client.disconnect()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
