# Cloudflare Video Worker

## Overview

The Cloudflare Video Worker serves as a central orchestration point for video processing in the Motion Mavericks Fast system. It replaces the previous Frame.io integration with a custom solution that leverages Digital Ocean GPU instances for on-demand video transcoding and R2 storage for edge-optimized delivery.

## Key Features

- **On-demand GPU Transcoding**: Automatically spins up Digital Ocean GPU instances for efficient video transcoding
- **Multiple Quality Levels**: Generates various proxy qualities (360p, 540p, 720p, 1080p, 2160p)
- **Adaptive Delivery**: Serves appropriate quality based on client connection and device capabilities
- **Edge-optimized Distribution**: Uses Cloudflare R2 for global edge delivery with no egress fees
- **Intelligent Lifecycle Management**: Automatically manages proxy storage based on access patterns
- **Cost Optimization**: Only stores frequently accessed proxies at the edge, with all files archived in Wasabi

## Architecture

### Component Diagram

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │  Digital Ocean  │
│  Next.js API    │◄────►│   Cloudflare    │◄────►│  GPU Droplets   │
│                 │      │  Video Worker   │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │  │
                         ┌──────┘  └──────┐
                         ▼                ▼
                ┌─────────────────┐  ┌─────────────────┐
                │   Cloudflare    │  │      Wasabi     │
                │   R2 Storage    │  │     Storage     │
                └─────────────────┘  └─────────────────┘
```

### Workflow

1. **Upload Phase**:
   - File is uploaded to Wasabi via Next.js API
   - For video files, Next.js initiates transcoding request to Cloudflare Worker

2. **Transcoding Phase**:
   - Worker creates a Digital Ocean GPU droplet for transcoding
   - Droplet downloads source file, transcodes to multiple qualities
   - Transcoded files are uploaded to R2 (proxies) and Wasabi (all files)
   - Droplet notifies Worker via webhook and self-terminates

3. **Delivery Phase**:
   - Client requests video via Next.js playback API
   - Next.js routes request to Worker proxy endpoint
   - Worker serves appropriate quality from R2
   - If higher quality is needed, Worker fetches it from Wasabi to R2 in the background
   - Access patterns are tracked for lifecycle management

4. **Maintenance Phase**:
   - Daily scheduled task runs at midnight UTC
   - Removes lesser-used proxies based on configurable thresholds
   - Ensures R2 storage is optimally utilized

## API Endpoints

### Transcoding

#### `POST /api/transcode`

Initiates video transcoding for a file.

**Request:**
```json
{
  "fileId": "string",
  "sourceUrl": "string",
  "qualities": ["360p", "720p", "1080p"],
  "webhookUrl": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "string",
  "message": "Transcoding job started"
}
```

#### `GET /api/status/:jobId`

Checks the status of a transcoding job.

**Response:**
```json
{
  "jobId": "string",
  "fileId": "string",
  "status": "processing|completed|failed",
  "progress": 75,
  "completedQualities": ["360p", "720p"],
  "createdAt": "ISO date",
  "updatedAt": "ISO date",
  "completedAt": "ISO date (if completed)"
}
```

### Video Delivery

#### `GET /proxy/:fileId/:quality.mp4`

Serves a video proxy with the specified quality.

- If requested quality doesn't exist, automatically serves the closest available quality
- Updates access timestamp for lifecycle management
- Intelligently fetches higher quality proxies in the background when needed

### Webhook Processing

#### `POST /api/webhook`

Processes webhooks from transcoding droplets.

**Request:**
```json
{
  "jobId": "string",
  "status": "completed|failed",
  "qualities": ["360p", "720p", "1080p"],
  "error": "string (if failed)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

### Lifecycle Management

#### `POST /api/lifecycle`

Triggers lifecycle management to clean up unused proxies.

**Headers:**
- `Authorization: Bearer <API_SECRET>`

**Response:**
```json
{
  "success": true,
  "stats": {
    "scanned": 150,
    "deleted": 25,
    "retained": 125,
    "errors": 0
  }
}
```

## Deployment

The Cloudflare Worker is deployed using Wrangler CLI:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Log in to Cloudflare
wrangler login

# Set up secrets
wrangler secret put API_SECRET
wrangler secret put DO_API_TOKEN
wrangler secret put R2_ACCESS_KEY_ID 
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put DO_SSH_KEY_IDS

# Deploy
wrangler deploy
```

## Configuration

### Wrangler.toml

```toml
name = "fast-video-processor"
main = "scripts/cloudflare-video-worker.js"
compatibility_date = "2023-11-02"

# Custom domain configuration
routes = [
  { pattern = "video.motionmavericks.com.au", custom_domain = true }
]

# KV Namespace for cache and tracking
[[kv_namespaces]]
binding = "KV_NAMESPACE"
id = "b10c6ec07b994142a7e703abe994a2b4"

# R2 bucket for storage
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "mavericks"
preview_bucket_name = "mavericks-preview"

# Environment variables
[vars]
API_BASE_URL = "https://app.motionmavericks.com.au/api"
R2_ENDPOINT = "https://f8bb59f64efa1103bf1d76951a1cd323.r2.cloudflarestorage.com"
R2_BUCKET_NAME = "mavericks"

# Cron triggers for maintenance
[triggers]
crons = ["0 0 * * *"]
```

### Environment Variables

The Worker requires the following environment secrets:

- `API_SECRET`: Shared secret for API authentication
- `DO_API_TOKEN`: Digital Ocean API token for creating GPU instances
- `R2_ACCESS_KEY_ID`: Access key for R2 storage
- `R2_SECRET_ACCESS_KEY`: Secret key for R2 storage
- `DO_SSH_KEY_IDS`: Comma-separated list of SSH key IDs for Digital Ocean

### Digital Ocean Configuration

- **Droplet Size**: g-2vcpu-8gb (General Purpose GPU droplet)
- **Region**: nyc1 (or your preferred region)
- **Image**: ubuntu-22-04-x64
- **Tags**: fast-transcoder, auto-delete

## Quality Settings

The Worker supports the following quality profiles by default:

- **360p**: height=360, bitrate=800k, preset=fast
- **540p**: height=540, bitrate=1500k, preset=fast
- **720p**: height=720, bitrate=2500k, preset=medium
- **1080p**: height=1080, bitrate=5000k, preset=medium
- **2160p**: height=2160, bitrate=15000k, preset=slow

## Retention Policies

The Worker implements intelligent retention policies for R2 storage:

- **Low Quality** (360p, 540p): 30 days without access
- **Medium Quality** (720p): 14 days without access
- **High Quality** (1080p, 2160p): 7 days without access

## Integration with Next.js

The Next.js application integrates with the Cloudflare Worker through several API endpoints:

### `/api/files/[fileId]/transcode`

Initiates video transcoding for a specific file.

### `/api/files/[fileId]/transcode/webhook`

Receives webhook notifications about transcoding status.

### `/api/files/playback`

Provides adaptive video playback with intelligent quality selection based on client capabilities.

## Security Considerations

- All API endpoints are secured with token-based authentication
- Digital Ocean instances use SSH key authentication
- Instances automatically terminate after transcoding is complete
- All storage access is secured with proper credentials
- A daily cleanup job ensures no orphaned instances remain

## Monitoring and Troubleshooting

- Worker logs are available in the Cloudflare Workers Dashboard
- Transcoding job statuses are stored in KV and R2
- Digital Ocean droplets are tagged for easy identification
- The `/api/health` endpoint provides a quick way to check worker status

## Error Handling

The Worker implements robust error handling:

- Failed transcoding jobs are properly reported
- Transcoding retries are automatically scheduled for transient failures
- Orphaned instances are automatically cleaned up
- Storage errors are logged and reported

## Cost Optimization

This architecture optimizes costs through:

1. **On-demand GPU instances**: Only running when transcoding is needed
2. **Intelligent proxy storage**: Only keeping frequently accessed proxies in R2
3. **Automatic cleanup**: Removing unused proxies based on access patterns
4. **Edge delivery**: Using Cloudflare's network for global distribution with no egress fees 