FROM --platform=linux/amd64 ubuntu:22.04

# Prevent interactive prompts during installation
ARG DEBIAN_FRONTEND=noninteractive

# Install Ubuntu Desktop, VNC server, and other required packages
RUN apt-get update && apt-get install -y \
    ubuntu-desktop \
    gnome-panel \
    gnome-settings-daemon \
    metacity \
    nautilus \
    gnome-terminal \
    firefox \
    wget \
    curl \
    sudo \
    net-tools \
    xterm \
    xfce4 \
    xfce4-goodies \
    tigervnc-standalone-server \
    tigervnc-common \
    dbus-x11 \
    x11-xserver-utils \
    mesa-utils \
    openssh-server

# Install NVIDIA container toolkit dependencies
RUN apt-get install -y --no-install-recommends \
    nvidia-driver-525 \
    libglvnd0 \
    libgl1 \
    libglx0 \
    libegl1 \
    libxext6 \
    libx11-6

# Set environment variables for GPU support
ENV NVIDIA_VISIBLE_DEVICES all
ENV NVIDIA_DRIVER_CAPABILITIES graphics,utility,compute

# Download and install Splashtop Streamer
RUN mkdir -p /opt/splashtop && \
    wget -O /tmp/splashtop.deb https://download.splashtop.com/linux/Splashtop_Streamer_Ubuntu_x86_64.deb && \
    apt-get install -y /tmp/splashtop.deb || true && \
    rm /tmp/splashtop.deb

# Configure SSH for remote access
RUN mkdir -p /var/run/sshd && \
    echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config && \
    echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config

# Create a default user with sudo privileges
RUN useradd -m docker-user && \
    echo "docker-user:docker-user" | chpasswd && \
    usermod -aG sudo docker-user

# Copy startup script
COPY start-desktop.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/start-desktop.sh

# Set working directory
WORKDIR /home/docker-user

# Expose SSH, VNC and Splashtop ports
EXPOSE 22 5900 5901 6783 6784 6785

# Set the entrypoint
ENTRYPOINT ["/usr/local/bin/start-desktop.sh"] 