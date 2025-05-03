import paho.mqtt.client as mqtt
from enum import Enum
import time

class MQTTStatus(Enum):
    Disconnected = 0
    Connecting = 1
    Connected = 2

class MQTTClient():
    def __init__(self, client_id, hostname="127.0.0.1", port="1883"):
        self.__hostname = hostname
        try:
            self.__port = int(port)
        except ValueError:
            print(f"[MQTT] Invalid port specified: {port}. Using default 1883.")
            self.__port = 1883
        self.__keepAlive = 60
        self.__cleanSession = True # Or False if persistence is needed
        self.__protocolVersion = mqtt.MQTTv311
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
        if self.__status != MQTTStatus.Disconnected:
            print("[MQTT] Disconnecting...")
            # Stop the network loop thread first
            self.__client.loop_stop()
            # Perform the disconnect
            self.__client.disconnect()

    def subscribe(self, topic, callback):
        if self.__status == MQTTStatus.Connected:
            print(f"[MQTT] Subscribing to {topic}")
            self.__callbacks[topic] = callback
            # Subscribe might fail if connection drops immediately after check
            try:
                result, mid = self.__client.subscribe(topic)
                if result != mqtt.MQTT_ERR_SUCCESS:
                    print(f"[MQTT] Failed to subscribe to {topic} (Error: {result})")
            except (mqtt.MQTTException, OSError) as e:
                 print(f"[MQTT] Error during subscribe to {topic}: {e}")
        else:
            print(f"[MQTT] Cannot subscribe to {topic}, not connected.")

    def unsubscribe(self, topic):
        # Unsubscribe even if not connected, to clean up internal state
        print(f"[MQTT] Unsubscribing from {topic}")
        try:
            self.__client.unsubscribe(topic)
        except (mqtt.MQTTException, OSError) as e:
            print(f"[MQTT] Error during unsubscribe from {topic}: {e}")
        finally:
            # Always remove the callback
            if topic in self.__callbacks.keys():
                del self.__callbacks[topic]

    def publish(self, topic, payload):
        """
        Publishes a message to a topic.

        Returns:
            bool: True if publish was attempted successfully (queued), False otherwise.
                  Note: This doesn't guarantee delivery, only that the client accepted it.
        """
        if self.__status == MQTTStatus.Connected:
            try:
                # Publish the message
                result, mid = self.__client.publish(topic, payload=payload)
                if result == mqtt.MQTT_ERR_SUCCESS:
                    return True
                else:
                    # This might happen if the queue is full, etc.
                    print(f"[MQTT] Failed to queue message {mid} to topic {topic} (Error code: {result})")
                    return False
            except (mqtt.MQTTException, OSError) as e:
                # This catches errors during the publish call itself (e.g., socket closed unexpectedly)
                print(f"[MQTT] Error during publish to {topic}: {e}")
                # Connection might be broken now, __on_disconnect should handle status update
                return False
            except Exception as e:
                 print(f"[MQTT] Unexpected error during publish to {topic}: {e}")
                 return False
        else:
            return False

    def __on_connect(self, client, userdata, flags, rc):
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
        # Set status first
        original_status = self.__status
        self.__status = MQTTStatus.Disconnected
        if rc != 0:
            # Unexpected disconnection
            print(f"[MQTT] Unexpected disconnection (rc={rc}). Will attempt to reconnect automatically.")
            # loop_start() handles the reconnection attempts. Do not call reconnect() here.
        else:
            # Planned disconnection (e.g., by calling disconnect())
            print("[MQTT] Disconnected normally.")
            # loop should have been stopped by disconnect() method

    def __on_message(self, mqttc, obj, msg):
        try:
            mstr = msg.payload.decode("utf-8")
            # Basic topic matching
            if msg.topic in self.__callbacks:
                self.__callbacks[msg.topic](mstr)
        except Exception as e:
            print(f"[MQTT] Error processing message on topic {msg.topic}: {e}")

    def __del__(self):
        self.disconnect()
