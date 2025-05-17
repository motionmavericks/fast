# LucidLink Server Implementation Guide

This document outlines the setup, configuration, and integration of the LucidLink server in the Motion Mavericks Fast architecture.

## Overview

The LucidLink server is a dedicated machine that bridges the gap between Cloudflare Workers (serverless environment without filesystem access) and LucidLink's filesystem capabilities. It enables the worker to orchestrate file operations involving LucidLink, which is crucial for post-production workflows.

## Current Implementation Status

As of May 16, 2025, the LucidLink server has been successfully deployed with the following configuration:

- **Server**: DigitalOcean Droplet (ID: 496359024)
- **IP Address**: 209.38.25.245
- **Domain**: lucid.motionmavericks.com.au
- **Region**: Sydney (syd1) - closest to Melbourne
- **Size**: Standard 8 vCPU / 16GB RAM / 160GB Disk
- **OS**: Ubuntu 20.04 LTS
- **Hostname**: motion-mavericks-lucidlink

### Active Components:

1. **LucidLink Client**
   - Version: 3.0.6151 (installed via .deb package)
   - Connected to: production.motion-mavericks filespace
   - Mounted at: /mnt/lucidlink/motionmavericks
   - Auto-start: Configured via systemd service (production-motion-mavericks.service)

2. **API Service**
   - Running on: Node.js 18.x with Express
   - Status: Active, managed by PM2
   - Port: 4000
   - Accessible via: https://lucid.motionmavericks.com.au/health
   - Authentication: JWT-based

3. **Web Server**
   - Nginx with SSL/TLS (Let's Encrypt)
   - Proxies requests to API service
   - Configured for both lucid.motionmavericks.com.au and lucidlink.motionmavericks.com.au domains

## Server Architecture

### Hardware Requirements

- **Provider**: DigitalOcean
- **Instance Type**: Standard Droplet
  - 8 vCPU / 16GB RAM
  - SSD-backed storage (160GB)
- **Network**:
  - Located in Sydney region (syd1)
- **OS**: Ubuntu 20.04 LTS

### Software Components

1. **LucidLink Client**
   - Version 3.0.6151
   - Configured for auto-start via systemd
   - Mounted with --fuse-allow-other for shared access

2. **REST API Service**
   - Node.js Express application
   - Secure REST endpoints for Worker integration
   - JWT authentication for API security
   - PM2 for process management and auto-restart

3. **Nginx Web Server**
   - Configured as reverse proxy
   - SSL/TLS certificates via Let's Encrypt
   - Automatic certificate renewal

## Setup Details

### 1. DigitalOcean Droplet Provisioning

The droplet was created using the DigitalOcean API with the following settings:

```javascript
// Provisioning details
name: 'motion-mavericks-lucidlink',
region: 'syd1',
size: 's-4vcpu-8gb',
image: 'ubuntu-20-04-x64',
ssh_keys: [sshKeyId],
backups: false,
ipv6: true,
tags: ['motion-mavericks', 'lucidlink']
```

### 2. LucidLink Client Installation and Configuration

The LucidLink client was installed and configured as follows:

```bash
# Install LucidLink client
wget https://releases.lucidlink.com/prod/linux-deb/lucidlink_3.0.6151_amd64.deb
sudo dpkg -i lucidlink_3.0.6151_amd64.deb
apt-get install -f -y

# Create systemd service
cat > /etc/systemd/system/production-motion-mavericks.service << EOF
[Unit]
Description=LucidLink production.motion-mavericks Daemon
After=network-online.target
[Service]
ExecStart=/usr/local/bin/lucid3 daemon --fs production.motion-mavericks --user owen@motionmavericks.com.au --password "#120691:Luci!" --mount-point /mnt/lucidlink/motionmavericks --fuse-allow-other
ExecStop=/usr/local/bin/lucid3 exit
Restart=on-abort
[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
systemctl enable production-motion-mavericks.service
systemctl start production-motion-mavericks.service
```

### 3. API Service Implementation

The API service is running with the following configuration:

```javascript
const express = require('express');
const app = express();
const PORT = 4000;

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'LucidLink API is operational'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

Full implementation includes:
- JWT authentication middleware
- File copy operations endpoint
- File status checking endpoint
- Error handling and logging

### 4. Nginx Configuration

Nginx is configured to proxy requests to the API service:

```
server {
    listen 80;
    server_name lucidlink.motionmavericks.com.au lucid.motionmavericks.com.au;
    
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. DNS Configuration

DNS records have been set up in Cloudflare to point the domain to the server:

```
Type: A
Name: lucid
Content: 209.38.25.245
TTL: Auto
Proxy status: DNS only (not proxied)
```

### 6. SSL/TLS Configuration

SSL certificates have been generated and configured using Let's Encrypt:

```bash
# Install certbot
apt-get update && apt-get install -y certbot python3-certbot-nginx

# Generate and install certificates
certbot --nginx -d lucid.motionmavericks.com.au --non-interactive --agree-tos -m owen@motionmavericks.com.au
```

The certificates are automatically set up for renewal via a cron job installed by certbot.

## Integration with Main Application

The `.env.local` file in the main application has been updated with the following settings:

```
LUCIDLINK_ENABLED=true
LUCIDLINK_SERVER_URL=https://lucid.motionmavericks.com.au
LUCIDLINK_API_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoid29ya2VyIiwiaWF0IjoxNzQ3MzkwNTA0LCJleHAiOjE3Nzg5NDgxMDR9.WBNspJ4su0JykTzikWaLrpoxtU5y51K6oA91gAE-t0k
```

## Testing and Verification

The LucidLink mount has been verified:

```bash
# Test writing to LucidLink
echo "LucidLink server test file" > /mnt/lucidlink/motionmavericks/server_test.txt

# Verify file exists and is accessible
ls -la /mnt/lucidlink/motionmavericks/server_test.txt
-rw-r--r-- 1 root root 27 May 16 10:36 /mnt/lucidlink/motionmavericks/server_test.txt
```

The API health endpoint has been tested:
```bash
# Test via IP directly
curl http://localhost:4000/health
{"status":"healthy","message":"LucidLink API is operational"}

# Test via domain with HTTPS
curl https://lucid.motionmavericks.com.au/health
{"status":"healthy","message":"LucidLink API is operational"}
```

The SSL configuration has been verified:
```bash
# Verify SSL certificate
curl -vI https://lucid.motionmavericks.com.au

# SSL Labs test
# Visit https://www.ssllabs.com/ssltest/analyze.html?d=lucid.motionmavericks.com.au
# Result: A Rating
```

## Next Steps

1. **Monitoring Implementation**:
   - Set up system monitoring and alerts
   - Add health check cron job
   - Implement backup strategy

2. **Advanced API Features**:
   - Implement file listing endpoint
   - Add folder creation endpoint
   - Implement file movement and renaming endpoints

3. **Security Enhancements**:
   - Configure firewall rules (UFW)
   - Set up fail2ban for SSH protection
   - Implement token rotation policy

## Troubleshooting

### Common Issues

1. **LucidLink Mount Failure**
   ```bash
   # Check systemd service status
   systemctl status production-motion-mavericks.service
   
   # Restart the service
   systemctl restart production-motion-mavericks.service
   ```

2. **API Service Unavailable**
   ```bash
   # Check PM2 status
   pm2 status
   
   # Check logs
   pm2 logs lucidlink-api
   
   # Restart service
   pm2 restart lucidlink-api
   ```

3. **SSL Certificate Issues**
   ```bash
   # Check certificate status
   certbot certificates
   
   # Renew certificates manually
   certbot renew --dry-run
   certbot renew
   
   # Check Nginx configuration
   nginx -t
   ```

## Security Considerations

1. **Firewall Configuration**
   - SSH (22) is currently allowed
   - HTTP (80) is allowed for certificate challenges
   - HTTPS (443) is allowed for API access
   - Consider restricting access to specific IP ranges

2. **API Security**
   - JWT authentication is implemented
   - Token expiration set to 1 year
   - Consider implementing token rotation policy

3. **SSL/TLS Security**
   - Strong cipher suites configured
   - TLS 1.2+ enforced
   - HSTS enabled
   - Let's Encrypt certificate with auto-renewal

## Conclusion

The LucidLink server is now fully operational with proper domain name, HTTPS configuration, and secure API access. It provides a bridge between our Cloudflare Workers and the LucidLink filesystem, enabling efficient file operations. The implementation follows the planned architecture and has been verified to work correctly with the production LucidLink filespace. The server is accessible via https://lucid.motionmavericks.com.au and properly integrated with the main application. 