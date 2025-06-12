from app import app
from flask import jsonify, request
import serial
from utils_float.float import start_communication, send, msg_status, listen, reset
import traceback

s = serial.Serial(timeout = 2)

data = {'code': "FLOAT", 'status': 0, 'text': "" }

@app.route('/FLOAT/msg')
def float_msg():
    print(f"[FLOAT_SERVER] Received message request: {request.args.get('msg')}")
    if (not s.is_open):
        print("[FLOAT_SERVER] Serial port not open")
        data['status'] = False
        data['text'] = "SERIAL NOT OPENED"
        return jsonify(data), 400
    msg_param = request.args.get('msg')
    
    # Handle commands with parameters
    if msg_param.startswith("PARAMS"):
        parts = msg_param.split()
        if len(parts) == 4: # PARAMS Kp Kd Ki
            # msg will be "PARAMS Kp_val Kd_val Ki_val"
            pass # msg is already correctly formatted as msg_param
        else:
            data['status'] = False
            data['text'] = "INVALID PARAMS FORMAT"
            return jsonify(data), 400
    elif msg_param.startswith("TEST_FREQ"):
        parts = msg_param.split()
        if len(parts) == 2: # TEST_FREQ freq_val
            pass # msg is already correctly formatted as msg_param
        else:
            data['status'] = False
            data['text'] = "INVALID TEST_FREQ FORMAT"
            return jsonify(data), 400
    elif msg_param.startswith("TEST_STEPS"):
        parts = msg_param.split()
        if len(parts) == 2: # TEST_STEPS steps_val
            pass # msg is already correctly formatted as msg_param
        else:
            data['status'] = False
            data['text'] = "INVALID TEST_STEPS FORMAT"
            return jsonify(data), 400

    try:
        if msg_param == 'SEND_PACKAGE':
            # For SEND_PACKAGE, msg_status returns the package data in 'text'
            result_struct = msg_status(s, msg_param)
            data['status'] = result_struct.get('status', False) # Default to False if status key is missing
            data['text'] = result_struct.get('text', 'Error retrieving package') # Default error text
            if not data['status']: # If msg_status indicated an error
                 return jsonify(data), 400 # Or appropriate error code
            print(f"[FLOAT_SERVER] Package data retrieved: {data['text']}")
        else:
            # For other commands, send() just confirms if the command was sent
            result_success = send(s, msg_param) 
            if not result_success:
                raise Exception("Failed to send message")
            data['status'] = True
            data['text'] = 'SUCCESS' # Generic success for non-data-returning commands
        
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