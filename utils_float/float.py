from serial import Serial, SerialException
import json
import time
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib
from datetime import datetime
import os
from io import BytesIO
import base64
import pytz
import threading

matplotlib.use("Agg")

def plot_pressure_time(data, arg, ylabel):
    depth = data[arg]
    time = data['times']

    is_datetime = False
    try:
        time = [datetime.strptime(t, '%Y-%m-%dT%H:%M:%SZ') for t in time]
        is_datetime = True
    except Exception:
        time = [float(t) for t in time]

    plt.figure()
    plt.plot(time, depth, linestyle='-', marker='o')
    plt.ylabel(ylabel)
    plt.grid()

    if is_datetime:
        plt.xlabel('Time (UTC)')
        plt.gcf().autofmt_xdate()
        myFmt = mdates.DateFormatter('%Y-%m-%d %H:%M:%S')
        plt.gca().xaxis.set_major_formatter(myFmt)
        plt.gca().xaxis.set_major_locator(mdates.AutoDateLocator())
    else:
        plt.xlabel('Time (ms)')

    buffer = BytesIO()
    plt.savefig(buffer, format='png')
    buffer.seek(0)
    base64_img = base64.b64encode(buffer.getvalue()).decode('utf-8')
    plt.close()
    return base64_img
    
def start_communication(s: Serial):
    # This property is buggy, it does not understand if the serial is interrupted
    # But if you arrived here it means that serial does not reply anymore
    if (s.is_open):
        s.close()  

    # Try to open serial communication      
    with open(os.path.dirname(os.path.abspath(__file__)) + "/config/float.json") as jmaps:
        conf = json.load(jmaps)
        s.baudrate = conf['baudrate']
        for i in range(0, 5):
            try:
                s.port = f"{conf['port']}{i}"
                s.open()
                print(f"[FLOAT] Attempting connection on {s.port}")
                val = msg_status(s, 'STATUS')
                if val['status'] == 1:
                    print(f"[FLOAT] Successfully connected on {s.port}")
                return val
            except SerialException as e:
                print(f"[FLOAT] Connection failed on {s.port}: {str(e)}")
                continue
        print("[FLOAT] No available ports found")
        return {
            'text': "NO USB",
            'status': 0
        }
     

def msg_status(s: Serial, msg: str):
    try:
        print(f"[FLOAT] Sending command: {msg}")
        s.reset_output_buffer()
        s.reset_input_buffer()
        s.write(f'{msg}\n'.encode('utf-8'))
        time.sleep(0.03)
        line = s.readline().strip().decode()
        print(f"[FLOAT] Received: {line}")
        
        if msg == 'SEND_PACKAGE':
            try:
                float_data = json.loads(line)
                times = int(float_data.get('mseconds', 0))
                depth = float(float_data.get('depth', 0.0))
                pressure = float_data.get('pressure', '0')
                cn = float_data.get('company_number', 'Unknown')
                line = {"times": times, "depth": depth, "pressure": pressure, "company_name": cn}
                print(f"[FLOAT] Parsed package: {line}")
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                print(f"[FLOAT] Error parsing package: {str(e)}")
                line = "INVALID_DATA"

        return {
            'text': line,
            'status': 1
        }
    except SerialException as e:
        print(f"[FLOAT] Serial exception: {str(e)}")
        s.close()
        return {
            'text': "DISCONNECTED",
            'status': 0
        }
    except TimeoutError as e:
        print(f"[FLOAT] Timeout: {str(e)}")
        s.close()
        return {
            'text': "ESP DOESN'T ANSWER",
            'status': 0
        }
    except Exception as e:
        print(f"[FLOAT] Unexpected error: {str(e)}")
        try:
            s.close()
        except:
            pass
        return {
            'text': "ERROR",
            'status': 0
        }


img_data = {
    'text': "LOADING",
    'status': 1,
    'data': "",
}
thread_active = False


def handle_upload_data(s: Serial):
    global img_data, thread_active
    
    thread_active = True
    
    img_data = {
        'text': "LOADING",
        'status': 1,
        'data': "",
    }
    
    print("[FLOAT] Starting data upload sequence")
    s.write(b"LISTENING\n")
    print("[FLOAT] Sent LISTENING command")
    
    times = []
    depth = []
    pressure = []
    cn = ''
    error_count = 0
    max_errors = 10  # Allow a reasonable number of errors before giving up
    
    while True:
        try:
            line_data = s.readline().strip()
            if not line_data:
                error_count += 1
                if error_count > max_errors:
                    print("[FLOAT] Too many empty lines, stopping data collection")
                    break
                continue
                
            if line_data == b'STOP_DATA':
                print("[FLOAT] Received STOP_DATA command")
                break
                
            decoded = line_data.decode()
            print(f"[FLOAT] Received data: {decoded}")
            
            # Skip data corruption marker lines
            if "DATA CORRUPTED FOR ERROR HANDLING" in decoded:
                print("[FLOAT] Skipping corrupted data marker")
                continue
                
            try:
                float_data = json.loads(decoded)
                depth_val = float(float_data.get('depth', 0))
                time_val = int(float_data.get('mseconds', 0))
                pressure_val = float_data.get('pressure', '0')
                
                depth.append(depth_val)
                times.append(time_val)
                pressure.append(pressure_val)
                if cn == '':
                    cn = float_data.get("company_number", "Unknown")
                
                print(f"[FLOAT] Parsed data point: time={time_val}, depth={depth_val}")
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                print(f"[FLOAT] Data parsing error: {str(e)} - Line: {decoded}")
                error_count += 1
                if error_count > max_errors:
                    print("[FLOAT] Too many parsing errors, stopping data collection")
                    break
                continue
        except (SerialException, TimeoutError) as e:
            print(f"[FLOAT] Serial error during data collection: {str(e)}")
            break
        except Exception as e:
            print(f"[FLOAT] Unexpected error during data collection: {str(e)}")
            error_count += 1
            if error_count > max_errors:
                break
            continue
    
    print("[FLOAT] Data collection complete")
    try:
        s.write(b"DATA_RECEIVED\n")
        print("[FLOAT] Sent DATA_RECEIVED confirmation")
    except Exception as e:
        print(f"[FLOAT] Error sending confirmation: {str(e)}")
    
    if times and depth:
        json_complete = {"times": times, "depth": depth, "pressure": pressure, "company_name": cn}
        try:
            data = [plot_pressure_time(json_complete, 'depth', 'Depth (m)'), 
                   plot_pressure_time(json_complete, 'pressure', 'Pressure (Pa)')]
        except Exception as e:
            print(f"[FLOAT] Error generating plots: {str(e)}")
            data = "NO_DATA"
    else:
        data = "NO_DATA"
        
    img_data = {
        'text': "FINISHED",
        'status': 1,
        'data': {
            'img': data,
            'raw': {"times": times, "depth": depth, "pressure": pressure, "company_name": cn} if times and depth else {}
        }
    }
    print("[FLOAT] Thread finished")
    thread_active = False



def listen(s: Serial):
    global thread_active
    if not thread_active and img_data['text'] == "LOADING":
        print("[FLOAT] Starting data listener thread")
        threading.Thread(target=handle_upload_data, args=(s, )).start()
    else:
        print(f"[FLOAT] Listener status: active={thread_active}, data_status={img_data['text']}")

    return img_data


def reset():
    global img_data
    print("[FLOAT] Resetting image data")
    img_data = {
        'text': "LOADING",
        'status': 1,
        'data': "",
    }

def send(s: Serial, msg: str):
    try:
        print(f"[FLOAT] Sending command: {msg}")
        s.reset_output_buffer()
        s.reset_input_buffer()
        s.write(f'{msg}\n'.encode('utf-8'))
        return True
    except Exception as e:
        print(f"[FLOAT] Error sending command: {str(e)}")
        return False
