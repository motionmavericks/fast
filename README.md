# Ubuntu Desktop Docker Container with Splashtop and GPU Passthrough

This Docker setup creates an Ubuntu Desktop environment with Splashtop remote connectivity, host drive mounting, and GPU passthrough capabilities.

## Prerequisites

- Docker and Docker Compose installed
- NVIDIA Container Toolkit installed (for GPU passthrough)
- NVIDIA GPU with compatible drivers

### Installing NVIDIA Container Toolkit

```bash
# Add the package repositories
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# Install the toolkit
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Restart Docker
sudo systemctl restart docker
```

## Setup

1. Clone this repository or copy the files to your local machine.

2. Modify the `docker-compose.yml` file to specify your host directories for mounting:
   
   ```yaml
   volumes:
     - C:/path/to/host/data:/mnt/data
     - C:/path/to/host/media:/mnt/media
   ```

3. Build and run the container:

   ```bash
   docker-compose up -d
   ```

   If you encounter a "no matching manifest for windows/amd64" error, ensure the platform is properly specified in your docker-compose.yml file.

## Accessing the Desktop

You have three options to connect to the desktop:

### Using SSH (Initial Setup)

The container exposes SSH for easy initial connection:

1. Connect via SSH client:
   ```bash
   ssh docker-user@localhost -p 2222
   ```
   Password: `docker-user`

2. Once connected via SSH, you can configure Splashtop manually if needed:
   ```bash
   /opt/splashtop/bin/splashtop-streamer --register --username your_email@example.com --password your_password
   ```

### Using Splashtop

1. After the container starts, Splashtop Streamer will be configured with the provided credentials.
2. Connect to the container using the Splashtop client with the account provided during setup.
3. If you need to reconfigure Splashtop, connect via SSH first.

### Using VNC (Fallback Method)

The container also runs a VNC server as a fallback:

1. Use a VNC client to connect to `localhost:5901`
2. Password: `docker-user`

## Customization

### Container User

The default user is:
- Username: `docker-user`
- Password: `docker-user`

You can modify this in the Dockerfile if needed.

### GPU Configuration

The container is set up to use all available GPUs. If you want to limit this, modify the `NVIDIA_VISIBLE_DEVICES` environment variable in docker-compose.yml.

## Troubleshooting

### Windows Platform Issues

If you're running on Windows and encounter platform compatibility issues:

1. Make sure the platform is explicitly specified in both Dockerfile and docker-compose.yml:
   ```
   # In Dockerfile
   FROM --platform=linux/amd64 ubuntu:22.04
   
   # In docker-compose.yml
   build:
     platforms:
       - "linux/amd64"
   ```

2. Ensure Docker Desktop is configured to use WSL 2 backend.

3. Try enabling "Use the WSL 2 based engine" in Docker Desktop settings.

### GPU Passthrough Issues

If you encounter GPU issues:

1. Verify NVIDIA drivers are installed on the host:
   ```bash
   nvidia-smi
   ```

2. Make sure the NVIDIA Container Toolkit is properly installed:
   ```bash
   sudo apt install nvidia-container-toolkit
   sudo systemctl restart docker
   ```

3. Test the NVIDIA runtime:
   ```bash
   docker run --rm --gpus all nvidia/cuda:11.6.2-base-ubuntu20.04 nvidia-smi
   ```

### Drive Mounting Issues

If mounted drives aren't visible:

1. Check the container logs:
   ```bash
   docker logs ubuntu-desktop
   ```

2. Make sure the host paths exist and have appropriate permissions.

3. You can manually mount additional drives while the container is running:
   ```bash
   docker exec -it ubuntu-desktop bash -c "mkdir -p /mnt/new_mount && ln -sf /mnt/new_mount /home/docker-user/new_mount"
   ```
   Then use Docker's volume mount feature to make the host directory available to the container.

### Splashtop Connection Issues

If Splashtop doesn't connect:

1. Check if Splashtop is running in the container:
   ```bash
   docker exec -it ubuntu-desktop ps aux | grep splashtop
   ```

2. If needed, manually register Splashtop via SSH:
   ```bash
   docker exec -it ubuntu-desktop /opt/splashtop/bin/splashtop-streamer --register --username your_email@example.com --password your_password
   ```

## Security Considerations

This container runs in privileged mode, which has security implications. Only use this in trusted environments and networks.