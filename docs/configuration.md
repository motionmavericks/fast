# Configuration Guide

This document provides detailed information about configuring the Motion Mavericks Fast application.

## Environment Variables

The application requires several environment variables to be set in `.env.local`:

### Core Application

```
# MongoDB Connection
MONGODB_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_secure_jwt_secret

# Upload Configuration
MAX_UPLOAD_SIZE=20971520000  # 20GB in bytes
ALLOWED_FILE_TYPES=video/mp4,video/quicktime,image/jpeg,image/png,application/pdf
```

### Email Notifications (SendGrid)

```
# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key
SENDER_EMAIL=uploads@yourdomain.com
ADMIN_EMAILS=admin1@example.com,admin2@example.com

# Email Templates
EMAIL_TEMPLATE_SUCCESS=success_template_id  # Optional SendGrid template ID
EMAIL_TEMPLATE_ADMIN=admin_template_id      # Optional SendGrid template ID
```

### Storage Configuration

```
# Wasabi Storage (S3-compatible)
WASABI_ACCESS_KEY_ID=your_wasabi_access_key_id
WASABI_SECRET_ACCESS_KEY=your_wasabi_secret_access_key
WASABI_BUCKET_NAME=your_wasabi_bucket_name
WASABI_REGION=your_wasabi_region
WASABI_ENDPOINT=your_wasabi_endpoint

# Cloudflare R2 Storage
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_r2_bucket_name
R2_ENDPOINT=your_r2_endpoint_url
R2_PUBLIC_DOMAIN=your_r2_public_domain  # Optional
```

### Video Processing

```
# Cloudflare Worker
CLOUDFLARE_WORKER_URL=https://video.yourdomain.com
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_SECRET=your_api_secret

# Digital Ocean
DIGITAL_OCEAN_TOKEN=your_digital_ocean_api_token
DO_SSH_KEY_IDS=1234567,7654321  # Comma-separated SSH key IDs
```

### LucidLink Integration (Optional)

```
# LucidLink Configuration
LUCIDLINK_ENABLED=true
LUCIDLINK_SERVER_URL=https://lucid.yourdomain.com
LUCIDLINK_API_TOKEN=your_lucidlink_api_token
LUCIDLINK_BASE_PATH=/mnt/lucidlink/motionmavericks
```

### Security and Webhooks

```
# API Security
API_SECRET=your_api_secret
WEBHOOK_SECRET=your_webhook_secret
CRON_SECRET=your_cron_secret
```

## Cloudflare Worker Configuration

### wrangler.toml

Create a `wrangler.toml` file in the project root:

```toml
name = "fast-video-processor"
main = "scripts/cloudflare-video-worker.js"
compatibility_date = "2023-11-02"

# Custom domain configuration
routes = [
  { pattern = "video.yourdomain.com", custom_domain = true }
]

# KV Namespace for cache and tracking
[[kv_namespaces]]
binding = "KV_NAMESPACE"
id = "your_kv_namespace_id"

# R2 bucket for storage
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your_r2_bucket_name"
preview_bucket_name = "your_preview_bucket_name"

# Environment variables
[vars]
API_BASE_URL = "https://app.yourdomain.com/api"
R2_ENDPOINT = "https://your_r2_endpoint_url"
R2_BUCKET_NAME = "your_r2_bucket_name"

# Cron triggers for maintenance
[triggers]
crons = ["0 0 * * *"]  # Daily at midnight UTC
```

### Worker Secrets

Set up secrets required by the Worker:

```bash
wrangler secret put API_SECRET
wrangler secret put DO_API_TOKEN
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put DO_SSH_KEY_IDS
```

## Configuration through Setup Wizard

The application includes a setup wizard that guides you through the configuration process. Access it at `/setup` when first running the application, or if the database connection or application configuration is missing.

The setup wizard helps you:

1. Create the initial admin user
2. Configure and test the MongoDB connection
3. Set up and validate Wasabi storage
4. Configure email notifications
5. Set up the Cloudflare Worker integration

## Configuration Validation

The application validates configurations before saving them:

- **Database**: Tests the connection to MongoDB
- **Storage**: Validates credentials with test uploads and downloads
- **Email**: Verifies SendGrid API key and sends a test email
- **Worker**: Checks connection to the Cloudflare Worker and validates API credentials

## Manual Configuration Methods

Besides the setup wizard, you can use these alternative methods:

### Using Initialization Script

Run the initialization script to set up an admin user with default settings:

```bash
npm run init-admin
```

### Using Admin Creation Script

Create an admin user directly with custom credentials:

```bash
npm run create-admin -- --mongo="mongodb://your-connection-string" --email="admin@example.com" --password="secure-password"
```

## Deployment Considerations

When deploying to production:

1. Ensure all environment variables are properly set
2. Configure secure HTTPS connections
3. Set appropriate CORS headers if needed
4. Configure production MongoDB with authentication
5. Use secure, randomly generated secrets for all authentication tokens
6. Set up monitoring for the Cloudflare Worker 