import paho.mqtt.client as mqtt
from enum import Enum

class MQTTStatus(Enum):
    Disconnected = 0
    Connecting = 1
    Connected = 2

class MQTTClient():
    def __init__(self, client_id, hostname="127.0.0.1", port="1883"):
        self.__hostname = hostname
        self.__port = port
        self.__keepAlive = 60
        self.__cleanSession = False
        self.__protocolVersion = mqtt.MQTTv31
        self.__status = MQTTStatus.Disconnected
        self.__callbacks = dict()

        self.__client = mqtt.Client(client_id=client_id, clean_session=self.__cleanSession, protocol=self.__protocolVersion)
        self.__client.on_connect = self.__on_connect
        self.__client.on_message = self.__on_message
        self.__client.on_disconnect = self.__on_disconnect

    @property
    def status(self):
        return self.__status
    
    def connect(self):
        if self.__hostname:
            if self.__status == MQTTStatus.Disconnected:
                self.__status = MQTTStatus.Connecting
                print("[MQTT] Connecting...")
                self.__client.connect_async(self.__hostname, port=self.__port,
                    keepalive=self.__keepAlive)
                self.__client.loop_start() # Starts a thread to handle network traffic
            else:
                print(f"[MQTT] Already connected or connecting (status: {self.__status}).")
        else:
            print("[MQTT] Hostname not set.")
    
        if self.__status != MQTTStatus.Connected:
            print(f"[MQTT] Attempting to connect to {self.__hostname}:{self.__port}...")
            self.__status = MQTTStatus.Connecting
            try:
                self.__client.connect_async(self.__hostname, port=self.__port, keepalive=self.__keepAlive)
                # loop_start handles reconnections in the background (also if host is unreachable)
                self.__client.loop_start()
            except (OSError, Exception) as e:
                print(f"[MQTT] Connection initiation failed: {e}")
                self.__status = MQTTStatus.Disconnected
                # loop_start() wasn't called, so no auto-reconnect yet

    def disconnect(self):
        if self.__client:
            self.__client.loop_stop() # Stop the network loop
            self.__client.disconnect()
            # __on_disconnect will be called, which sets status to Disconnected
        if self.__status != MQTTStatus.Disconnected:
            print("[MQTT] Disconnecting...")
            # Stop the network loop thread first
            self.__client.loop_stop()
            # Perform the disconnect
            self.__client.disconnect()

    def subscribe(self, topic, callback):
        if self.__status == MQTTStatus.Connected:
            self.__callbacks[topic] = callback
            self.__client.subscribe(topic)
    
    def unsubscribe(self, topic):
        self.__client.unsubscribe(topic)
        if topic in self.__callbacks.keys():
            del self.__callbacks[topic]
    
    def publish(self, topic, payload):
        if self.__status == MQTTStatus.Connected:
            self.__client.publish(topic, payload=payload)
   
    def __on_connect(self, client, userdata, flags, rc):
        connack_str = mqtt.connack_string(rc)
        print(f"[MQTT] Connection attempt result: {connack_str}")
        if rc == 0:  # Successful connection
            self.__status = MQTTStatus.Connected
            print("[MQTT] Connected. Resubscribing to topics...")
            # Resubscribe to all stored topics
            for topic in self.__callbacks.keys():
                self.__client.subscribe(topic)
                # print(f"[MQTT] Resubscribed to {topic}") # Optional: verbose logging
        else:
            print(f"[MQTT] Connection failed: {connack_str}.")
            # If connection failed, status should reflect that.
            # Depending on the flow, it might go back to Disconnected or stay Connecting
            # For simplicity, if on_connect is called with rc != 0, it means a connect attempt failed.
            self.__status = MQTTStatus.Disconnected
    
        connack_str = mqtt.connack_string(rc)
        if rc == 0:
            print(f"[MQTT] Connected successfully: {connack_str}")
            self.__status = MQTTStatus.Connected
            print("[MQTT] Resubscribing to topics...")
            # Resubscribe upon connection/reconnection
            for topic in list(self.__callbacks.keys()): # Iterate over a copy of keys
                self.subscribe(topic, self.__callbacks[topic]) # Use subscribe method to handle potential errors
        else:
            print(f"[MQTT] Connection failed: {connack_str}. Will retry automatically.")
            # Keep status as Connecting or set to Disconnected? Disconnected is clearer.
            self.__status = MQTTStatus.Disconnected
            # loop_start() handles the retry mechanism

    def __on_disconnect(self, client, userdata, rc):
        # Set status to disconnected immediately.
        # If a reconnect attempt (explicit or background) succeeds, __on_connect will set it back to Connected.
        self.__status = MQTTStatus.Disconnected # Corrected: use __status

        # Set status first
        original_status = self.__status
        self.__status = MQTTStatus.Disconnected
        if rc != 0:
            print(f"[MQTT] Unexpected disconnection. Error code: {rc}.")
            # The client's loop (started by loop_start()) should automatically attempt to reconnect.
            # An explicit call to self.__client.reconnect() can be made here for an immediate attempt,
            # but it's blocking and might raise exceptions if the server is unavailable.
            # The user's request was to handle exceptions from this specific call.
            print("[MQTT] Attempting immediate reconnect...")
            try:
                self.__client.reconnect() 
                # If reconnect() is successful, __on_connect will be called.
                # If it fails, an exception is raised.
            except (ConnectionRefusedError, OSError) as e:
                # OSError is a base for ConnectionRefusedError and other socket errors
                print(f"[MQTT] Immediate reconnect failed: {e}. Background reconnection will continue if loop is active.")
            # No 'else' needed here for successful reconnect(), as __on_connect handles status update.
        else:
            print("[MQTT] Disconnected cleanly.")
   
            # Unexpected disconnection
            print(f"[MQTT] Unexpected disconnection (rc={rc}). Will attempt to reconnect automatically.")
            # loop_start() handles the reconnection attempts. Do not call reconnect() here.
        else:
            # Planned disconnection (e.g., by calling disconnect())
            print("[MQTT] Disconnected normally.")
            # loop should have been stopped by disconnect() method

    def __on_message(self, mqttc, obj, msg):
        mstr = msg.payload.decode("utf-8")
        if msg.topic in self.__callbacks:
            self.__callbacks[msg.topic](mstr)

    def __del__(self):
        self.disconnect()
