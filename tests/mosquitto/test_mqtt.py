import time
import json
import math
import random
import paho.mqtt.client as mqtt

client = mqtt.Client()
client.connect("127.0.0.1", 1883, 60)

roll_range = 5
pitch_range = 10
yaw_range = 30
frequency = 0.1

while True:
    current_time = time.time()
    roll = roll_range * math.sin(2 * math.pi * frequency * current_time)
    pitch = pitch_range * math.sin(2 * math.pi * frequency * current_time)
    yaw = yaw_range * math.sin(2 * math.pi * frequency * current_time)
    
    pidState = random.randint(0, 2) 
    armed = random.randint(0, 1)  
    
    depth_state = random.choice(["ACTIVE", "READY", "OFF"])
    roll_state = random.choice(["ACTIVE", "READY", "OFF"])
    pitch_state = random.choice(["ACTIVE", "READY", "OFF"])
    
    force_z = random.uniform(0, 100)
    force_roll = random.uniform(0, 100)
    force_pitch = random.uniform(0, 100)
    
    reference_z = random.uniform(0, 100)  
    reference_roll = random.uniform(-180, 180)  
    reference_pitch = random.uniform(-180, 180)  
    
    depth = random.uniform(0, 100) 
    roll = roll
    pitch = pitch
    yaw = yaw
    
    imu_state = random.choice(["OK", "OFF"])
    bar_state = random.choice(["OK", "OFF"])
    
    motor_thrust_max_xy = random.uniform(0, 50)   
    motor_thrust_max_z = random.uniform(0, 50)  
    
    motor_thrust = {
        "FSX": random.uniform(0, motor_thrust_max_xy),
        "FDX": random.uniform(0, motor_thrust_max_xy),
        "RSX": random.uniform(0, motor_thrust_max_xy),
        "RDX": random.uniform(0, motor_thrust_max_xy),
        "UPFSX": random.uniform(0, motor_thrust_max_z),
        "UPFDX": random.uniform(0, motor_thrust_max_z),
        "UPRSX": random.uniform(0, motor_thrust_max_z),
        "UPRDX": random.uniform(0, motor_thrust_max_z)
    }
    
    pwm = {
        "FSX": random.uniform(0, 255),
        "FDX": random.uniform(0, 255),
        "RSX": random.uniform(0, 255),
        "RDX": random.uniform(0, 255),
        "UPFSX": random.uniform(0, 255),
        "UPFDX": random.uniform(0, 255),
        "UPRSX": random.uniform(0, 255),
        "UPRDX": random.uniform(0, 255)
    }
    
    payload = {
        "rov_armed": ["OK", "OFF"][armed],  
        "controller_state": {
            "DEPTH": depth_state,
            "ROLL": roll_state,
            "PITCH": pitch_state
        },
        "force_z": force_z,
        "force_roll": force_roll,
        "force_pitch": force_pitch,
        "reference_z": reference_z,
        "reference_roll": reference_roll,
        "reference_pitch": reference_pitch,
        "depth": depth,
        "roll": roll,
        "pitch": pitch,
        "yaw": yaw,
        "imu_state": imu_state,
        "bar_state": bar_state,
        "motor_thrust_max_xy": motor_thrust_max_xy,
        "motor_thrust_max_z": motor_thrust_max_z,
        "motor_thrust": motor_thrust,
        "pwm": pwm
    }
    
    client.publish("status/", json.dumps(payload))
    
    time.sleep(0.1)  # Sleep for 100ms to control the frequency of the messages
