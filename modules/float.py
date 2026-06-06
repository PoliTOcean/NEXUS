from app import app
from flask import jsonify, request
import serial
from utils_float.float import start_communication, send, msg_status, listen, reset
import traceback
import json
import os
import math

s = serial.Serial(timeout = 2)

data = {'code': "FLOAT", 'status': 0, 'text': "" }

FLOAT_COMMAND_ACKS = {
    "GO": "GO_RECVD",
    "BALANCE": "CMD3_RECVD",
    "CLEAR_SD": "CMD4_RECVD",
    "SWITCH_AUTO_MODE": "SWITCH_AM_RECVD",
    "TRY_UPLOAD": "TRY_UPLOAD_RECVD",
    "TEST_STEPS": "TEST_STEPS_RECVD",
    "DEBUG": "DEBUG_MODE_RECVD",
    "HOME_MOTOR": "HOME_RECVD",
    "STOP": "STOP_RECVD",
    "SYRINGE_SET": "SYRINGE_SET_RECVD",
    "PID_HOLD": "PID_HOLD_RECVD",
    "PID_STEP": "PID_STEP_RECVD",
    "SURFACE_OFFSET": "SURFACE_OFF_RECVD",
}

FLOAT_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "utils_float",
    "config",
    "float.json",
)

def _load_float_config():
    with open(FLOAT_CONFIG_PATH) as config_file:
        return json.load(config_file)


def _save_float_config(next_config):
    with open(FLOAT_CONFIG_PATH, "w") as config_file:
        json.dump(next_config, config_file, indent=4)
        config_file.write("\n")


# Float body length (m); the firmware requires ascent_target_m + this < descent_target_m.
FLOAT_LENGTH_M = 0.51


def _profile_from_config(config):
    # New per-phase schema (descent/ascent). Fall back to the legacy key names so
    # a float.json that predates the rename still loads correctly.
    return {
        "profile_count": int(config.get("profile_count", 2)),
        "descent_target_m": float(config.get("descent_target_m", config.get("deep_target_m", config.get("target_depth", 2.5)))),
        "ascent_target_m": float(config.get("ascent_target_m", config.get("shallow_top_m", config.get("shallow_target_depth", 0.4)))),
        "depth_tolerance_m": float(config.get("depth_tolerance_m", config.get("max_error", 0.33))),
        "hold_s": float(config.get("hold_s", 30.0)),
        "descent_timeout_s": float(config.get("descent_timeout_s", config.get("pid_timeout_s", 180.0))),
        "ascent_timeout_s": float(config.get("ascent_timeout_s", 120.0)),
        "surface_rest_offset_m": float(config.get("surface_rest_offset_m", config.get("surface_offset_m", 0.10))),
    }


def _validate_profile(payload):
    profile = _profile_from_config(payload)
    ascent_target_bottom_m = profile["ascent_target_m"] + FLOAT_LENGTH_M

    if not 1 <= profile["profile_count"] <= 10:
        raise ValueError("profile_count must be in [1, 10]")
    for field in ("descent_target_m", "ascent_target_m", "surface_rest_offset_m"):
        if not 0.0 <= profile[field] <= 5.0:
            raise ValueError(f"{field} must be in [0.0, 5.0]")
    if not 0.005 <= profile["depth_tolerance_m"] <= 1.0:
        raise ValueError("depth_tolerance_m must be in [0.005, 1.0]")
    if not 1.0 <= profile["hold_s"] <= 600.0:
        raise ValueError("hold_s must be in [1, 600]")
    for field in ("descent_timeout_s", "ascent_timeout_s"):
        if not 5.0 <= profile[field] <= 900.0:
            raise ValueError(f"{field} must be in [5, 900]")
    if ascent_target_bottom_m >= profile["descent_target_m"]:
        raise ValueError("ascent_target_m + 0.51 must be lower than descent_target_m")

    profile["ascent_target_bottom_m"] = ascent_target_bottom_m
    return profile


def _profile_set_command(profile):
    # Field order is fixed and must match the firmware payload exactly.
    values = " ".join(
        [
            str(profile["profile_count"]),
            f"{profile['descent_target_m']:.3f}",
            f"{profile['ascent_target_m']:.3f}",
            f"{profile['depth_tolerance_m']:.3f}",
            f"{profile['hold_s']:.1f}",
            f"{profile['descent_timeout_s']:.1f}",
            f"{profile['ascent_timeout_s']:.1f}",
            f"{profile['surface_rest_offset_m']:.3f}",
        ]
    )
    return f"PROFILE_SET {values}"


def _save_profile_cache(profile):
    config = _load_float_config()
    config.update(profile)
    # Keep the legacy aliases in sync: the matplotlib plot in utils_float/float.py
    # reads target_depth/max_error/shallow_target_depth to draw the target lines.
    config["target_depth"] = profile["descent_target_m"]
    config["max_error"] = profile["depth_tolerance_m"]
    config["shallow_target_depth"] = profile["ascent_target_m"]
    _save_float_config(config)


def _pid_config_from_config(config):
    return {
        "kp": float(config.get("pid_kp", config.get("kp", 0.17))),
        "ki": float(config.get("pid_ki", config.get("ki", 0.0))),
        "kd": float(config.get("pid_kd", config.get("kd", 0.13))),
        "period_ms": int(config.get("pid_period_ms", config.get("period_ms", 50))),
        "alpha_d": float(config.get("pid_alpha_d", config.get("alpha_d", 0.25))),
        "integral_limit": float(config.get("pid_integral_limit", config.get("integral_limit", 5.0))),
        "min_retarget_frac": float(config.get("pid_min_retarget_frac", config.get("min_retarget_frac", 0.001))),
        "u_neutral": float(config.get("pid_u_neutral", config.get("u_neutral", 0.011))),
    }


def _balance_config_from_config(config):
    return {
        "hold_ms": int(config.get("balance_hold_ms", config.get("hold_ms", 5000))),
        "stop_delta_kpa": float(config.get("balance_stop_delta_kpa", config.get("stop_delta_kpa", 5.0))),
        "stop_samples": int(config.get("balance_stop_samples", config.get("stop_samples", 3))),
        "sample_period_ms": int(config.get("balance_sample_period_ms", config.get("sample_period_ms", 50))),
    }


def _motor_config_from_config(config):
    return {
        "max_speed": int(config.get("motor_max_speed", config.get("max_speed", 1800))),
        "max_accel": int(config.get("motor_max_accel", config.get("max_accel", 1800))),
        "homing_speed": int(config.get("motor_homing_speed", config.get("homing_speed", 1800))),
        "test_speed": int(config.get("motor_test_speed", config.get("test_speed", 1800))),
    }


def _finite(value, field):
    if not math.isfinite(float(value)):
        raise ValueError(f"{field} must be finite")


def _validate_pid_config(payload):
    config = _pid_config_from_config(payload)
    for field in ("kp", "ki", "kd"):
        _finite(config[field], field)
    if not 20 <= config["period_ms"] <= 500:
        raise ValueError("period_ms must be in [20, 500]")
    if not 0.05 <= config["alpha_d"] <= 1.0:
        raise ValueError("alpha_d must be in [0.05, 1.0]")
    if not math.isfinite(config["integral_limit"]) or config["integral_limit"] <= 0:
        raise ValueError("integral_limit must be > 0")
    if not math.isfinite(config["min_retarget_frac"]) or config["min_retarget_frac"] < 0:
        raise ValueError("min_retarget_frac must be >= 0")
    if not math.isfinite(config["u_neutral"]) or config["u_neutral"] < 0:
        raise ValueError("u_neutral must be >= 0")
    return config


def _validate_balance_config(payload):
    config = _balance_config_from_config(payload)
    if not 0 <= config["hold_ms"] <= 60000:
        raise ValueError("hold_ms must be in [0, 60000]")
    if not 0.1 <= config["stop_delta_kpa"] <= 50.0:
        raise ValueError("stop_delta_kpa must be in [0.1, 50]")
    if not 1 <= config["stop_samples"] <= 20:
        raise ValueError("stop_samples must be in [1, 20]")
    if not 20 <= config["sample_period_ms"] <= 1000:
        raise ValueError("sample_period_ms must be in [20, 1000]")
    return config


def _validate_motor_config(payload):
    config = _motor_config_from_config(payload)
    for field in ("max_speed", "homing_speed", "test_speed"):
        if not 10 <= config[field] <= 5000:
            raise ValueError(f"{field} must be in [10, 5000]")
    if not 10 <= config["max_accel"] <= 10000:
        raise ValueError("max_accel must be in [10, 10000]")
    return config


def _pid_config_set_command(config):
    return (
        "PID_CONFIG_SET "
        f"{config['kp']:.6f} {config['ki']:.6f} {config['kd']:.6f} "
        f"{config['period_ms']} {config['alpha_d']:.6f} "
        f"{config['integral_limit']:.6f} {config['min_retarget_frac']:.6f} "
        f"{config['u_neutral']:.6f}"
    )


def _balance_config_set_command(config):
    return (
        "BALANCE_CONFIG_SET "
        f"{config['hold_ms']} {config['stop_delta_kpa']:.6f} "
        f"{config['stop_samples']} {config['sample_period_ms']}"
    )


def _motor_config_set_command(config):
    return (
        "MOTOR_CONFIG_SET "
        f"{config['max_speed']} {config['max_accel']} "
        f"{config['homing_speed']} {config['test_speed']}"
    )


def _save_pid_config_cache(config):
    current = _load_float_config()
    current.update({
        "pid_kp": config["kp"],
        "pid_ki": config["ki"],
        "pid_kd": config["kd"],
        "pid_period_ms": config["period_ms"],
        "pid_alpha_d": config["alpha_d"],
        "pid_integral_limit": config["integral_limit"],
        "pid_min_retarget_frac": config["min_retarget_frac"],
        "pid_u_neutral": config["u_neutral"],
    })
    _save_float_config(current)


def _save_balance_config_cache(config):
    current = _load_float_config()
    current.update({
        "balance_hold_ms": config["hold_ms"],
        "balance_stop_delta_kpa": config["stop_delta_kpa"],
        "balance_stop_samples": config["stop_samples"],
        "balance_sample_period_ms": config["sample_period_ms"],
    })
    _save_float_config(current)


def _save_motor_config_cache(config):
    current = _load_float_config()
    current.update({
        "motor_max_speed": config["max_speed"],
        "motor_max_accel": config["max_accel"],
        "motor_homing_speed": config["homing_speed"],
        "motor_test_speed": config["test_speed"],
    })
    _save_float_config(current)


def _runtime_config_get(get_command, from_cache, save_cache, ok_text):
    cached_config = from_cache(_load_float_config())
    if not s.is_open:
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': 'SERIAL NOT OPENED',
            'data': cached_config,
        }), 200

    result = msg_status(s, get_command)
    if not result.get('status'):
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': result.get('text', f'{get_command}_FAILED'),
            'data': cached_config,
        }), 400

    try:
        firmware_config = json.loads(result.get('text', '{}'))
    except json.JSONDecodeError:
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': result.get('text', f'{get_command}_INVALID_JSON'),
            'data': cached_config,
        }), 200

    merged = from_cache({**cached_config, **firmware_config})
    save_cache(merged)
    return jsonify({
        'code': data['code'],
        'status': True,
        'text': ok_text,
        'data': merged,
    }), 200


def _runtime_config_set(payload, validate, command_builder, save_cache, ack_text):
    config = validate(payload)

    if not s.is_open:
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': 'SERIAL NOT OPENED',
            'data': config,
        }), 400

    result = msg_status(s, command_builder(config))
    response_text = result.get('text', '')
    if not result.get('status') or response_text != ack_text:
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': response_text or f'{ack_text}_FAILED',
            'data': config,
        }), 400

    save_cache(config)
    return jsonify({
        'code': data['code'],
        'status': True,
        'text': response_text,
        'data': config,
    }), 200


@app.route('/FLOAT/profile', methods=['GET'])
def float_profile_get():
    try:
        cached_profile = _profile_from_config(_load_float_config())

        if not s.is_open:
            return jsonify({
                'code': data['code'],
                'status': False,
                'text': 'SERIAL NOT OPENED',
                'data': cached_profile,
            }), 200

        result = msg_status(s, 'PROFILE_GET')
        if not result.get('status'):
            return jsonify({
                'code': data['code'],
                'status': False,
                'text': result.get('text', 'PROFILE_GET_FAILED'),
                'data': cached_profile,
            }), 400

        try:
            firmware_profile = json.loads(result.get('text', '{}'))
        except json.JSONDecodeError:
            return jsonify({
                'code': data['code'],
                'status': False,
                'text': result.get('text', 'PROFILE_GET_INVALID_JSON'),
                'data': cached_profile,
            }), 200

        profile = _profile_from_config({**cached_profile, **firmware_profile})
        profile['ascent_target_bottom_m'] = float(
            firmware_profile.get('ascent_target_bottom_m', profile['ascent_target_m'] + FLOAT_LENGTH_M)
        )
        _save_profile_cache(profile)
        return jsonify({
            'code': data['code'],
            'status': True,
            'text': 'PROFILE_GET_OK',
            'data': profile,
        }), 200
    except Exception as e:
        print(f"[FLOAT_SERVER] Error getting profile: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': 'PROFILE_GET_ERROR',
            'data': _profile_from_config(_load_float_config()),
        }), 500


@app.route('/FLOAT/profile', methods=['POST'])
def float_profile_set():
    try:
        payload = request.get_json(silent=True) or {}
        profile = _validate_profile(payload)

        if not s.is_open:
            return jsonify({
                'code': data['code'],
                'status': False,
                'text': 'SERIAL NOT OPENED',
                'data': profile,
            }), 400

        result = msg_status(s, _profile_set_command(profile))
        response_text = result.get('text', '')
        if not result.get('status') or response_text != 'PROFILE_SET_RECVD':
            return jsonify({
                'code': data['code'],
                'status': False,
                'text': response_text or 'PROFILE_SET_FAILED',
                'data': profile,
            }), 400

        _save_profile_cache(profile)
        return jsonify({
            'code': data['code'],
            'status': True,
            'text': response_text,
            'data': profile,
        }), 200
    except ValueError as e:
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': str(e),
            'data': request.get_json(silent=True) or {},
        }), 400
    except Exception as e:
        print(f"[FLOAT_SERVER] Error setting profile: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': 'PROFILE_SET_ERROR',
            'data': request.get_json(silent=True) or {},
        }), 500


@app.route('/FLOAT/pid-config', methods=['GET'])
def float_pid_config_get():
    try:
        return _runtime_config_get(
            'PID_CONFIG_GET',
            _pid_config_from_config,
            _save_pid_config_cache,
            'PID_CONFIG_GET_OK',
        )
    except Exception as e:
        print(f"[FLOAT_SERVER] Error getting PID config: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': 'PID_CONFIG_GET_ERROR',
            'data': _pid_config_from_config(_load_float_config()),
        }), 500


@app.route('/FLOAT/pid-config', methods=['POST'])
def float_pid_config_set():
    payload = request.get_json(silent=True) or {}
    try:
        return _runtime_config_set(
            payload,
            _validate_pid_config,
            _pid_config_set_command,
            _save_pid_config_cache,
            'PID_CONFIG_SET_RECVD',
        )
    except ValueError as e:
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': str(e),
            'data': payload,
        }), 400
    except Exception as e:
        print(f"[FLOAT_SERVER] Error setting PID config: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': 'PID_CONFIG_SET_ERROR',
            'data': payload,
        }), 500


@app.route('/FLOAT/balance-config', methods=['GET'])
def float_balance_config_get():
    try:
        return _runtime_config_get(
            'BALANCE_CONFIG_GET',
            _balance_config_from_config,
            _save_balance_config_cache,
            'BALANCE_CONFIG_GET_OK',
        )
    except Exception as e:
        print(f"[FLOAT_SERVER] Error getting balance config: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': 'BALANCE_CONFIG_GET_ERROR',
            'data': _balance_config_from_config(_load_float_config()),
        }), 500


@app.route('/FLOAT/balance-config', methods=['POST'])
def float_balance_config_set():
    payload = request.get_json(silent=True) or {}
    try:
        return _runtime_config_set(
            payload,
            _validate_balance_config,
            _balance_config_set_command,
            _save_balance_config_cache,
            'BALANCE_CONFIG_SET_RECVD',
        )
    except ValueError as e:
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': str(e),
            'data': payload,
        }), 400
    except Exception as e:
        print(f"[FLOAT_SERVER] Error setting balance config: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': 'BALANCE_CONFIG_SET_ERROR',
            'data': payload,
        }), 500


@app.route('/FLOAT/motor-config', methods=['GET'])
def float_motor_config_get():
    try:
        return _runtime_config_get(
            'MOTOR_CONFIG_GET',
            _motor_config_from_config,
            _save_motor_config_cache,
            'MOTOR_CONFIG_GET_OK',
        )
    except Exception as e:
        print(f"[FLOAT_SERVER] Error getting motor config: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': 'MOTOR_CONFIG_GET_ERROR',
            'data': _motor_config_from_config(_load_float_config()),
        }), 500


@app.route('/FLOAT/motor-config', methods=['POST'])
def float_motor_config_set():
    payload = request.get_json(silent=True) or {}
    try:
        return _runtime_config_set(
            payload,
            _validate_motor_config,
            _motor_config_set_command,
            _save_motor_config_cache,
            'MOTOR_CONFIG_SET_RECVD',
        )
    except ValueError as e:
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': str(e),
            'data': payload,
        }), 400
    except Exception as e:
        print(f"[FLOAT_SERVER] Error setting motor config: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'code': data['code'],
            'status': False,
            'text': 'MOTOR_CONFIG_SET_ERROR',
            'data': payload,
        }), 500

@app.route('/FLOAT/msg')
def float_msg():
    print(f"[FLOAT_SERVER] Received message request: {request.args.get('msg')}")
    if (not s.is_open):
        print("[FLOAT_SERVER] Serial port not open")
        data['status'] = False
        data['text'] = "SERIAL NOT OPENED"
        return jsonify(data), 400
    msg_param = request.args.get('msg')
    if not msg_param:
        data['status'] = False
        data['text'] = "MISSING COMMAND"
        return jsonify(data), 400
    
    # Handle one-shot commands with parameters. Persistent runtime settings use
    # the dedicated /FLOAT/*-config endpoints.
    if msg_param.startswith("TEST_STEPS"):
        parts = msg_param.split()
        if len(parts) == 2: # TEST_STEPS steps_val
            pass # msg is already correctly formatted as msg_param
        else:
            data['status'] = False
            data['text'] = "INVALID TEST_STEPS FORMAT"
            return jsonify(data), 400

    try:
        command_name = msg_param.split()[0] if msg_param else ""
        if msg_param == 'SEND_PACKAGE':
            # For SEND_PACKAGE, msg_status returns the package data in 'text'
            result_struct = msg_status(s, msg_param)
            data['status'] = result_struct.get('status', False) # Default to False if status key is missing
            data['text'] = result_struct.get('text', 'Error retrieving package') # Default error text
            if not data['status']: # If msg_status indicated an error
                 return jsonify(data), 400 # Or appropriate error code
            print(f"[FLOAT_SERVER] Package data retrieved: {data['text']}")
        elif command_name in FLOAT_COMMAND_ACKS:
            expected_ack = FLOAT_COMMAND_ACKS[command_name]
            result_struct = msg_status(s, msg_param)
            response_text = result_struct.get('text', '')
            ack_ok = bool(result_struct.get('status')) and response_text == expected_ack

            data['status'] = ack_ok
            data['text'] = response_text or f"NO_ACK_ON_{command_name}"
            if not ack_ok:
                print(
                    f"[FLOAT_SERVER] Command '{msg_param}' failed ACK check: "
                    f"expected '{expected_ack}', got '{data['text']}'"
                )
                return jsonify(data), 400
            print(f"[FLOAT_SERVER] Command '{msg_param}' acknowledged by ESPA: {response_text}")
        elif command_name == 'LISTENING':
            # LISTENING starts the stored-data stream; /FLOAT/listen consumes the packets.
            result_success = send(s, msg_param) 
            if not result_success:
                raise Exception("Failed to send message")
            data['status'] = True
            data['text'] = 'SUCCESS'
        else:
            data['status'] = False
            data['text'] = f"UNKNOWN_OR_UNACKED_COMMAND: {command_name}"
            return jsonify(data), 400
        
        print(f"[FLOAT_SERVER] Command '{msg_param}' processed successfully.")
        return jsonify(data), 201 # Use 200 OK for successful GET that returns data, 201 for creation (less applicable here)

    except Exception as e:
        print(f"[FLOAT_SERVER] Error processing message '{msg_param}': {str(e)}")
        print(traceback.format_exc())
        data['status'] = False
        data['text'] = "SERIAL INTERRUPTED OR COMMAND FAILED"
        return jsonify(data), 400
    

@app.route('/FLOAT/start')
def float_start():
    print("[FLOAT_SERVER] Starting float communication")
    try:
        status = start_communication(s)
        data['status'] = status['status']
        data['text'] = status['text']
        print(f"[FLOAT_SERVER] Connection status: {status['text']}")
        return jsonify(data), 201
    except Exception as e:
        print(f"[FLOAT_SERVER] Error starting communication: {str(e)}")
        print(traceback.format_exc())
        data['status'] = False
        data['text'] = "ERROR STARTING COMMUNICATION"
        return jsonify(data), 500


@app.route('/FLOAT/status')
def float_status():
    msg = request.args.get('msg', 'STATUS')
    print(f"[FLOAT_SERVER] Received status request with message: {msg}")
    if (not s.is_open):
        print("[FLOAT_SERVER] Serial port not open")
        data['status'] = False
        data['text'] = 'SERIAL NOT OPENED'
        return jsonify(data), 200
    
    try:
        sts = msg_status(s, msg)
    except Exception as e:
        print(f"[FLOAT_SERVER] Error getting status: {str(e)}")
        print(traceback.format_exc())
        data['status'] = False
        data['text'] = "SERIAL INTERRUPTED"
        return jsonify(data), 400
    
    data['status'] = sts['status']
    data['text'] = sts['text']
    print(f"[FLOAT_SERVER] Status response: {sts['text']}")
    return jsonify(data), 201

@app.route('/FLOAT/listen')
def float_listen():
    print("[FLOAT_SERVER] Received listen request")
    try:
        sts = listen(s)
        imgdata = {
                'code': data['code'],
                'status': sts['status'],
                'data': sts['data'],
                'text': sts['text']   
            }
        print(f"[FLOAT_SERVER] Listen status: {sts['text']}")
        if sts['text'] == "FINISHED":
            print("[FLOAT_SERVER] Data collection finished, resetting")
            reset()
        return jsonify(imgdata), 201
    except Exception as e:
        print(f"[FLOAT_SERVER] Error in listen: {str(e)}")
        print(traceback.format_exc())
        error_data = {
            'code': data['code'],
            'status': 0,
            'data': "",
            'text': "ERROR"
        }
        return jsonify(error_data), 500
