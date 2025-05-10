FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt update && apt install -y \
    git cmake build-essential libmicrohttpd-dev libjansson-dev libssl-dev \
    libsrtp2-dev libsofia-sip-ua-dev libglib2.0-dev libopus-dev libogg-dev \
    libini-config-dev libcollection-dev libconfig-dev libwebsockets-dev \
    libnice-dev libavutil-dev libavcodec-dev libavformat-dev libvpx-dev \
    libx264-dev ffmpeg libtool automake gengetopt pkg-config wget curl nano python3 python3-pip

RUN git clone https://github.com/meetecho/janus-gateway.git && \
    cd janus-gateway && \
    sh autogen.sh && \
    ./configure --prefix=/opt/janus --enable-plugin-streaming && \
    make -j$(nproc) && \
    make install && \
    make configs

EXPOSE 8188 8088 5004/udp 5005/udp 5006/udp 5007/udp
CMD /opt/janus/bin/janus
