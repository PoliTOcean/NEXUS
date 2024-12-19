#!/bin/bash

# Define the repository URL and the local directory name
REPO_URL="https://github.com/PoliTOcean/Oceanix.git"
LOCAL_DIR="Oceanix"
EXECUTABLE="Oceanix"

# Check if the repository is already cloned
if [ ! -d "$LOCAL_DIR" ]; then
    echo "Cloning the repository..."
    git clone "$REPO_URL"
else
    echo "Repository already cloned."
fi

# Navigate to the repository directory
cd "$LOCAL_DIR" || { echo "Failed to change directory to $LOCAL_DIR"; exit 1; }
if [ -f "build/$EXECUTABLE" ]; then
    cd ..
else
    # Check if install.sh exists
    if [ -f "install.sh" ]; then
        chmod +x ./install.sh
        ./install.sh
        echo "Oceanix compiled"
        cd ..
    else
        echo "install.sh not found or not executable."
        exit 1
    fi
fi

# Check the status of the Mosquitto service
service_status=$(sudo service mosquitto status)

# Check if the service is running
if echo "$service_status" | grep -q "mosquitto is running"; then
    echo "Mosquitto is already running."
else
    echo "Mosquitto is not running. Starting the service..."
    sudo service mosquitto start
    
    # Verify if the service started successfully
    if sudo service mosquitto status | grep -q "mosquitto is running"; then
        echo "Mosquitto has been started successfully."
    else
        echo "Failed to start Mosquitto."
    fi
fi

# Check if the executable exists in the build directory
if [ -f "$LOCAL_DIR/build/$EXECUTABLE" ]; then
    echo "Found $EXECUTABLE"
    # Rename the executable
    echo "Executing $EXECUTABLE in test mode"
    $LOCAL_DIR/build/$EXECUTABLE test
else
    echo "$EXECUTABLE not found in $LOCAL_DIR/build"
    exit 1
fi