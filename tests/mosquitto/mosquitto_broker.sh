#!/bin/bash

SCRIPT_DIR=$(dirname "$0")

sudo mkdir -p /var/run/mosquitto
sudo chown mosquitto:mosquitto /var/run/mosquitto

# Start mosquitto with the local configuration file
echo "Starting mosquitto using ./mosquitto.conf..."
sudo mosquitto -v -c "$SCRIPT_DIR/mosquitto.conf"