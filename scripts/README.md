# Motion Mavericks Fast Scripts

This directory contains utility scripts and the Cloudflare Worker code for the Motion Mavericks Fast platform.

## Main Components

### Video Processing Worker

- `cloudflare-video-worker.js` - Primary Cloudflare Worker that handles video transcoding with Digital Ocean GPU instances
- `wrangler.toml` - Configuration file for Cloudflare Worker deployment

### Testing Utilities

- `test_video_worker.js` - Script for testing the Cloudflare Video Worker functionality
- `test-r2.js` - Script for testing R2 storage connectivity
- `test-wasabi.js` - Script for testing Wasabi storage connectivity 
- `test-digital-ocean.js` - Script for testing Digital Ocean API connectivity
- `test-cloudflare-token.js` - Script for testing Cloudflare API token
- `test-worker.js` - Script for testing general worker functionality

### System Administration

- `create-admin.js` - Script to create a new admin user
- `init-admin.js` - Script to initialize the system with a default admin
- `update-env.js` - Utility for updating environment variables

### DNS and Server Configuration

- `add-dns-direct.js` - DNS configuration utility
- `add-dns-record.js` - DNS configuration utility
- `create-dns-record.js` - DNS configuration utility
- `update-nginx.sh` - Nginx configuration utility

### LucidLink Integration

- `create-lucidlink-droplet.js` - Script to create a LucidLink server on Digital Ocean
- `lucidlink-server-setup.sh` - Shell script for setting up a LucidLink server
- `lucidlink-server.js` - LucidLink server implementation
- `lucidlink-package.json` - Package file for LucidLink server

### Utilities

- `seed-project-data.js` - Script for seeding test project data
- `integration-status.js` - Script for checking integration status
- `env.example` - Example environment file

## Deployment Instructions

### Deploying the Video Worker

1. Ensure you have Wrangler CLI installed: `npm install -g wrangler`
2. Login to Cloudflare: `wrangler login`
3. Set required secrets:
   ```
   wrangler secret put API_SECRET
   wrangler secret put DO_API_TOKEN
   wrangler secret put R2_ACCESS_KEY_ID
   wrangler secret put R2_SECRET_ACCESS_KEY
   wrangler secret put DO_SSH_KEY_IDS
   ```
4. Deploy the worker: `wrangler deploy`

### Testing Services

Run the following scripts to test connectivity to different services:

```bash
# Test Digital Ocean API connectivity
node scripts/test-digital-ocean.js

# Test R2 storage connectivity
node scripts/test-r2.js

# Test Wasabi storage connectivity
node scripts/test-wasabi.js

# Test the video worker functionality
node scripts/test_video_worker.js
```

## Archived Scripts

Deprecated and legacy scripts have been moved to the `archived` subfolder. These files are no longer used in the current implementation but are kept for reference. 