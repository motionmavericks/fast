#!/bin/bash
set -e

# Start dbus
mkdir -p /var/run/dbus
dbus-daemon --system --fork

# Start SSH service for initial access
service ssh start
echo "SSH server started on port 22"

# Set up VNC server (as fallback access method)
mkdir -p /home/docker-user/.vnc
echo "docker-user" | vncpasswd -f > /home/docker-user/.vnc/passwd
chown -R docker-user:docker-user /home/docker-user/.vnc
chmod 600 /home/docker-user/.vnc/passwd

# Start VNC server
su - docker-user -c "vncserver :1 -geometry 1920x1080 -depth 24"
echo "VNC server started on port 5901"

# Configure and start Splashtop Streamer with provided credentials
if [ -f /opt/splashtop/splashtopd ]; then
    # Install Splashtop CLI if available
    if [ -f /opt/splashtop/bin/splashtop-streamer ]; then
        echo "Configuring Splashtop with provided credentials"
        /opt/splashtop/bin/splashtop-streamer --register --username oweninnes@motionmavericks.com.au --password MKTGStudio00
    fi
    
    # Start Splashtop service
    /opt/splashtop/splashtopd &
    echo "Splashtop service started"
fi

# Handle host mounts
for mount in /mnt/*/; do
    if [ -d "$mount" ]; then
        echo "Found mount at $mount"
        # Create symbolic link in user's home directory
        ln -sf "$mount" "/home/docker-user/$(basename "$mount")"
    fi
done

echo "Container setup complete. You can now connect via:"
echo "1. SSH: ssh docker-user@localhost -p 22 (password: docker-user)"
echo "2. VNC: Connect to localhost:5901 (password: docker-user)"
echo "3. Splashtop: Use the Splashtop client with account oweninnes@motionmavericks.com.au"

# Keep container running
tail -f /dev/null 