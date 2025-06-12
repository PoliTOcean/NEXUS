#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.
set -u # Treat unset variables as an error.

SCRIPT_DIR=$(dirname "$0")

# --- Configuration ---
JANUS_GIT_URL="https://github.com/meetecho/janus-gateway.git"
JANUS_VERSION="master" # Or a specific tag like "v1.x.x". If using a tag, adjust git pull logic below.
JANUS_INSTALL_PREFIX="/opt/janus"
JANUS_CONFIG_DIR="${JANUS_INSTALL_PREFIX}/etc/janus"
JANUS_PLUGIN_DIR="${JANUS_INSTALL_PREFIX}/lib/janus/plugins"
CUSTOM_STREAMING_CONFIG_SOURCE="${SCRIPT_DIR}/janus.plugin.streaming.jcfg"
CUSTOM_STREAMING_CONFIG_DEST="${JANUS_CONFIG_DIR}/janus.plugin.streaming.jcfg"

# --- Script Start ---
echo "Starting Janus Gateway installation and setup script..."
echo "Janus will be installed to: ${JANUS_INSTALL_PREFIX}"
echo "Configuration files will be in: ${JANUS_CONFIG_DIR}"

# 1. Install System Dependencies
echo "Updating package list and installing dependencies..."
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
    git \
    libmicrohttpd-dev \
    libjansson-dev \
    libssl-dev \
    libsofia-sip-ua-dev \
    libglib2.0-dev \
    libopus-dev \
    libogg-dev \
    libcurl4-openssl-dev \
    liblua5.3-dev \
    libconfig-dev \
    pkg-config \
    gengetopt \
    libtool \
    automake \
    build-essential \
    cmake \
    ninja-build \
    libnice-dev \
    libsrtp2-dev \
    libwebsockets-dev \
    libavutil-dev \
    libavcodec-dev \
    libavformat-dev \
    ffmpeg
    # Add doxygen and graphviz if docs are needed (and --disable-docs is removed from ./configure)
    # doxygen graphviz

# 2. Clone and Build Janus Gateway
echo "Cloning/updating Janus Gateway repository..."
# The script assumes it's run from a directory where 'janus-gateway' can be cloned.
# For example, if install.sh is in /workspaces/NEXUS/tests/stream_video/JANUS/,
# janus-gateway will be cloned to /workspaces/NEXUS/tests/stream_video/JANUS/janus-gateway/
if [ -d "janus-gateway" ]; then
    echo "Janus gateway directory exists. Changing to it and pulling latest changes for branch/tag '${JANUS_VERSION}'..."
    cd janus-gateway
    # If JANUS_VERSION is a specific tag, 'git pull' might not be what you want.
    # You might need: git fetch origin && git checkout ${JANUS_VERSION}
    git pull origin ${JANUS_VERSION}
else
    echo "Cloning Janus Gateway (branch/tag: ${JANUS_VERSION})..."
    git clone --branch ${JANUS_VERSION} ${JANUS_GIT_URL}
    cd janus-gateway
fi

echo "Configuring Janus Gateway..."
./autogen.sh
./configure --prefix=${JANUS_INSTALL_PREFIX} \
            --enable-plugin-streaming \
            --enable-websockets \
            --disable-data-channels \
            --disable-rabbitmq \
            --disable-mqtt \
            --disable-docs \
            --disable-turn-rest-api \
            --enable-post-processing \
            # Add other --enable-plugin-* or --disable-plugin-* flags as needed.
            # For example, to enable WebSockets: --enable-websockets (requires libwebsockets-dev)
            # To enable DataChannels: --enable-data-channels (requires libusrsctp-dev)

echo "Building Janus Gateway (this may take a while)..."
make -j$(nproc)
echo "Installing Janus Gateway..."
sudo make install
echo "Installing default Janus configurations..."
sudo make configs # Copies default .cfg files to ${JANUS_CONFIG_DIR}

# 4. Finalize Configuration (Optional)
# At this point, Janus is installed, and default configs are in ${JANUS_CONFIG_DIR}.
# You can add sed/awk commands here to modify janus.cfg or plugin-specific .jcfg files if needed.
# For example, to enable specific features in janus.plugin.streaming.jcfg.

cd ..
# Copy custom janus.plugin.streaming.jcfg if it exists in the script's directory
if [ -f "${CUSTOM_STREAMING_CONFIG_SOURCE}" ]; then
    echo "Found custom streaming plugin configuration at '${CUSTOM_STREAMING_CONFIG_SOURCE}'."
    echo "Copying to '${CUSTOM_STREAMING_CONFIG_DEST}'..."
    sudo cp "${CUSTOM_STREAMING_CONFIG_SOURCE}" "${CUSTOM_STREAMING_CONFIG_DEST}"
    echo "Custom streaming plugin configuration copied."
else
    echo "ERROR: Custom streaming plugin configuration not found. Please ensure the file exists at '${CUSTOM_STREAMING_CONFIG_SOURCE}'."
    echo "Streaming will not work without this configuration."
    echo "Please check the path and try again."
    echo "Exiting..."
    exit 1
fi

sudo tee "${JANUS_CONFIG_DIR}/janus.jcfg" > /dev/null <<EOF
general: {
    configs_folder = "${JANUS_CONFIG_DIR}"
    plugins_folder = "${JANUS_PLUGIN_DIR}"
    transports_folder = "${JANUS_INSTALL_PREFIX}/lib/janus/transports"
    events_folder = "${JANUS_INSTALL_PREFIX}/lib/janus/events"
    interface = "0.0.0.0"
}

media: {
    ipv6 = false
    ice_enforce_list = "127.0.0.1"
    ice_ignore_list = "vmnet,vboxnet,docker"
    ice_lite = true
    ice_tcp = false
    ignore_mdns = true
    rtp_port_range = "20000-40000"
}

nat: {
    ice_enforce_list = "127.0.0.1"
    nice_debug = false
    full_trickle = false
}
EOF


echo "Janus installation and configuration steps completed."
echo "Default Janus configuration files are in: ${JANUS_CONFIG_DIR}"
echo "Janus plugins (including janus_streaming.so if enabled) are in: ${JANUS_PLUGIN_DIR}"
echo " "
echo "[✓] All done! Janus Gateway is installed and configured."
