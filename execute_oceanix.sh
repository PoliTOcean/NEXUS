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

# Ensure Mosquitto is running. Prefer the system service (Linux), otherwise fall
# back to launching the broker directly (works on Linux and macOS/Homebrew).
if pgrep -x mosquitto >/dev/null 2>&1; then
    echo "Mosquitto is already running."
elif command -v service >/dev/null 2>&1 && sudo service mosquitto start >/dev/null 2>&1; then
    echo "Mosquitto started via service."
elif command -v mosquitto >/dev/null 2>&1; then
    echo "Starting Mosquitto directly..."
    mosquitto -d
    echo "Mosquitto started."
else
    echo "Mosquitto not found. Please install it (e.g. apt install mosquitto / brew install mosquitto)."
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