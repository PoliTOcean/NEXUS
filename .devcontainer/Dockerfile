FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    MPLCONFIGDIR=/tmp/matplotlib

RUN apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-venv \
        python3-dev \
        python3-pip \
        build-essential \
        pkg-config \
        mosquitto \
        mosquitto-clients \
        ffmpeg \
    && mkdir -p /tmp/matplotlib /tmp/nexus-mosquitto \
    && chown -R node:node /tmp/matplotlib /tmp/nexus-mosquitto \
    && corepack enable \
    && corepack prepare pnpm@9.15.9 --activate \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
