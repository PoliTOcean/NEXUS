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

# Load configuration for target_depth and max_error
FLOAT_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config/float.json")
with open(FLOAT_CONFIG_PATH) as f:
    float_config = json.load(f)
TARGET_DEPTH = float_config.get("target_depth", 2.5)
MAX_ERROR = float_config.get("max_error", 0.45)


def plot_pressure_time(data, arg, ylabel):
    y_values = data[arg]
    time_ms = data['times'] # Assuming times are in milliseconds from ESPA

    # Convert time from milliseconds to seconds for the plot
    time_seconds = [t / 1000.0 for t in time_ms]

    plt.figure(figsize=(10, 6))
    plt.plot(time_seconds, y_values, linestyle='-', marker='o', label=ylabel)
    
    if arg == 'depth':
        plt.axhline(y=TARGET_DEPTH, color='r', linestyle='--', label=f'Target Depth ({TARGET_DEPTH}m)')
        plt.axhline(y=TARGET_DEPTH + MAX_ERROR, color='orange', linestyle=':', label=f'Target + Error ({TARGET_DEPTH + MAX_ERROR:.2f}m)')
        plt.axhline(y=TARGET_DEPTH - MAX_ERROR, color='orange', linestyle=':', label=f'Target - Error ({TARGET_DEPTH - MAX_ERROR:.2f}m)')
        plt.legend()

    plt.ylabel(ylabel)
    plt.xlabel('Time (seconds)')
    plt.grid(True)
    plt.title(f'{ylabel} vs. Time')

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
        
        # Wait for a response with timeout
        start_time = time.time()
        while s.in_waiting == 0:
            if time.time() - start_time > 1.0:  # 1 second timeout
                print(f"[FLOAT] Timeout waiting for response to {msg}")
                if msg == 'SEND_PACKAGE':
                    return {
                        'text': '{"company_number":"Timeout","times":0,"pressure":"0","depth":0}',
                        'status': 1
                    }
                return {
                    'text': f"TIMEOUT_ON_{msg}",
                    'status': 1
                }
            time.sleep(0.01)
            
        line = s.readline().strip().decode('utf-8', errors='replace') # Added errors='replace'
        print(f"[FLOAT] Received: {line}")
        
        # For STATUS, the response can be multi-part
        # e.g., "CONNECTED | AUTO_MODE_YES | CONN_OK | BATTERY: 12345 | RSSI: -50"
        # We return the raw string, frontend will parse.
        
        if msg == 'SEND_PACKAGE':
            try:
                # Try to parse as JSON directly to validate it
                json_obj = json.loads(line)
                
                # Ensure all required fields exist with proper defaults
                if 'company_number' not in json_obj and 'company_number' not in json_obj:
                    json_obj['company_number'] = 'Unknown'
                
                if 'mseconds' not in json_obj and 'times' not in json_obj:
                    json_obj['mseconds'] = 0
                    
                if 'depth' not in json_obj:
                    json_obj['depth'] = 0.0
                    
                if 'pressure' not in json_obj:
                    json_obj['pressure'] = '0'
                
                # Convert back to a properly formatted JSON string
                formatted_json = json.dumps(json_obj)
                print(f"[FLOAT] Valid JSON package: {formatted_json}")
                
                return {
                    'text': formatted_json,  # Return the properly formatted JSON string
                    'status': 1
                }
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                print(f"[FLOAT] Error parsing package: {str(e)}")
                return {
                    'text': '{"company_number":"Error","mseconds":0,"pressure":"0","depth":0}',
                    'status': 1
                }

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
    
    try:
        img_data = {
            'text': "LOADING",
            'status': 1,
            'data': "", # Initially empty, will be populated
        }
        
        print("[FLOAT] Starting data upload sequence (listening for data from ESP)")
        
        times = []
        depth = []
        pressure = []
        cn = ''
        error_count = 0
        max_errors = 10  # Allow a reasonable number of errors before giving up
        
        # Convert times from string datetime to milliseconds if necessary, or ensure they are numeric
        processed_times = []

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
                    
                decoded = line_data.decode('utf-8', errors='replace') # Added errors='replace'
                print(f"[FLOAT] Received data: {decoded}")
                
                # Skip data corruption marker lines
                if "DATA CORRUPTED FOR ERROR HANDLING" in decoded:
                    print("[FLOAT] Skipping corrupted data marker")
                    continue
                    
                try:
                    float_data = json.loads(decoded)
                    depth_val = float(float_data.get('depth', 0))
                    time_val = int(float_data.get('mseconds', 0)) # ESPA sends mseconds
                    pressure_val = float_data.get('pressure', '0')
                    
                    depth.append(depth_val)
                    processed_times.append(time_val) # Store as numeric milliseconds
                    pressure.append(pressure_val)
                    if cn == '':
                        cn = float_data.get("company_number", "Unknown")
                    
                    print(f"[FLOAT] Parsed data point: time={time_val}, depth={depth_val}")
                except (json.JSONDecodeError, KeyError, ValueError) as e:
                    print(f"[FLOAT] Data parsing error: {str(e)} - Line: '{decoded}'") # Log the problematic line
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
        # Replace original times with processed_times for plotting
        if processed_times:
            json_complete = {"times": processed_times, "depth": depth, "pressure": pressure, "company_number": cn}
            try:
                plot_depth_img = plot_pressure_time(json_complete, 'depth', 'Depth (m)')
                plot_pressure_img = plot_pressure_time(json_complete, 'pressure', 'Pressure (Pa)')
                data_plots = [plot_depth_img, plot_pressure_img]
            except Exception as e:
                print(f"[FLOAT] Error generating plots: {str(e)}")
                data_plots = "NO_DATA"
            raw_data_payload = {"times": processed_times, "depth": depth, "pressure": pressure, "company_number": cn} if processed_times and depth else {}
        else:
            data_plots = "NO_DATA"
            raw_data_payload = {}
            
        img_data = {
            'text': "FINISHED",
            'status': 1,
            'data': {
                'img': data_plots,
                'raw': raw_data_payload
            }
        }
        print("[FLOAT] Thread finished")
    except Exception as e:
        print(f"[FLOAT] Error in handle_upload_data: {str(e)}")
        img_data = {
            'text': "ERROR",
            'status': 0,
            'data': {"error_message": str(e), "img": "NO_DATA", "raw": {}}, # Consistent data structure
        }
    finally:
        thread_active = False
        print("[FLOAT] handle_upload_data finally block: thread_active set to False")



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
        
        # Add a small delay to ensure command is sent
        time.sleep(0.05)
        
        # Read any immediate response (optional)
        if s.in_waiting > 0:
            response = s.readline().strip().decode()
            print(f"[FLOAT] Immediate response to {msg}: {response}")
            
        return True
    except Exception as e:
        print(f"[FLOAT] Error sending command: {str(e)}")
        return False
