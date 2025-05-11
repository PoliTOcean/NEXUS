FROM mcr.microsoft.com/devcontainers/javascript-node

# Used for iceServers in ROV.js
ENV IS_DOCKER=true 

RUN sudo apt update && sudo apt install -y python3.11-venv\
    mosquitto mosquitto-clients python3-dev gcc