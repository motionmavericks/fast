# Troubleshooting Guide

This document provides solutions for common issues you might encounter when running the Motion Mavericks Fast application.

## Setup Issues

### Database Connection Failures

**Symptoms:**
- "Failed to connect to database" error during setup
- Application redirects to setup page repeatedly
- MongoDB connection errors in console

**Solutions:**
1. Verify your MongoDB connection string is correctly formatted
2. Ensure the MongoDB user has appropriate permissions (readWrite)
3. Check network connectivity to MongoDB host
4. For MongoDB Atlas, verify IP whitelist includes your server IP
5. Check for MongoDB version compatibility issues

**Fix:**
```bash
# Test connection directly
npx mongodb-connection-tester mongodb+srv://username:password@cluster.mongodb.net/motionmavericks
```

### Storage Configuration Issues

**Symptoms:**
- "Failed to connect to Wasabi" error
- File uploads fail with S3 errors
- Storage tests fail during setup

**Solutions:**
1. Verify access key and secret key are correct
2. Check that bucket exists in the specified region
3. Ensure bucket permissions allow your application to read/write
4. Verify the endpoint URL matches your region
5. Check network connectivity to the storage service

**Fix:**
```bash
# Test with AWS CLI
aws s3 ls --endpoint-url=https://s3.ap-southeast-2.wasabisys.com s3://your-bucket-name --profile wasabi
```

## Video Processing Issues

### Transcoding Failures

**Symptoms:**
- Videos fail to transcode
- Error in worker logs: "Failed to create Digital Ocean droplet"
- Transcoding job starts but never completes

**Solutions:**
1. Verify Digital Ocean API token has appropriate permissions
2. Check SSH key IDs are correctly set in environment variables
3. Verify Cloudflare Worker has proper secrets configured
4. Check source file URL is accessible from Digital Ocean
5. Check Digital Ocean account limits for droplet creation

**Fix:**
```bash
# Test Digital Ocean API token
curl -X GET -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_API_TOKEN" "https://api.digitalocean.com/v2/account"
```

### Proxy Playback Issues

**Symptoms:**
- "Proxy not found" error when trying to play videos
- Video player loads but video doesn't play
- Missing quality options in video player

**Solutions:**
1. Check if transcoding job completed successfully
2. Verify R2 storage configuration in Worker
3. Check access patterns in KV store
4. Verify CORS configuration allows video playback
5. Check for errors in browser console

**Fix:**
```bash
# Check proxy existence directly
curl -I https://your-worker-domain.com/proxy/your-file-id/720p.mp4
```

## Upload Issues

### Chunked Upload Failures

**Symptoms:**
- Large uploads fail at random percentages
- Uploads appear to complete but file is corrupted
- Resumable uploads get stuck at a certain percentage

**Solutions:**
1. Check maximum upload size configuration
2. Verify Wasabi bucket permissions
3. Check for network interruptions during upload
4. Verify temporary chunk storage has sufficient space
5. Check browser console for CORS errors

**Fix:**
```bash
# Increase Next.js API route body size limit
# In next.config.ts:
experimental: {
  serverActions: {
    bodySizeLimit: '20mb', // Increase as needed
  },
}
```

### Upload Link Issues

**Symptoms:**
- "Link not found" or "Link expired" errors
- Clients cannot access upload pages
- Upload link generator fails

**Solutions:**
1. Verify link ID is correct in URL
2. Check if link has expired in database
3. Verify link is active in admin dashboard
4. Check MongoDB for link records
5. Verify client name and project name are correctly set

**Fix:**
```bash
# Manually check link status in database
db.uploadlinks.findOne({linkId: "your-link-id"})
```

## Cloudflare Worker Issues

### Worker Deployment Failures

**Symptoms:**
- "Failed to deploy worker" error with Wrangler
- Worker doesn't respond to requests
- Worker API endpoints return 500 errors

**Solutions:**
1. Check Cloudflare account permissions
2. Verify wrangler.toml configuration
3. Check for syntax errors in worker code
4. Verify R2 bucket and KV namespace bindings
5. Check Cloudflare dashboard for worker errors

**Fix:**
```bash
# Test wrangler configuration
wrangler dev

# Check for JavaScript errors
npx eslint scripts/cloudflare-video-worker.js
```

### Worker Health Check Failures

**Symptoms:**
- `/api/health` endpoint returns unhealthy status
- Services show "error" or "not_configured" status
- Worker cannot connect to R2 or KV

**Solutions:**
1. Verify all secrets are correctly set in worker
2. Check R2 bucket permissions
3. Verify KV namespace is correctly bound
4. Check Digital Ocean API token permissions
5. Verify environment variables are correctly set

**Fix:**
```bash
# Check worker health directly
curl -X GET https://your-worker-domain.com/api/health
```

## Lifecycle Management Issues

### Orphaned Droplet Cleanup Failures

**Symptoms:**
- Digital Ocean droplets remain active after transcoding
- Daily maintenance job fails
- Droplets accumulate over time

**Solutions:**
1. Verify cron trigger is correctly configured
2. Check Digital Ocean API token permissions
3. Verify droplet tags match expected values
4. Check the cleanup script for logic errors
5. Manually review and terminate orphaned droplets

**Fix:**
```bash
# Manually trigger lifecycle management
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_API_SECRET" https://your-worker-domain.com/api/lifecycle
```

### R2 Proxy Lifecycle Issues

**Symptoms:**
- R2 storage continues to grow without cleanup
- Old proxies are not being removed
- Access timestamps not updating correctly

**Solutions:**
1. Verify daily maintenance job is running
2. Check KV storage for access patterns
3. Verify retention policy configuration
4. Check R2 permissions for deleting objects
5. Manually review R2 bucket contents

**Fix:**
```bash
# Check proxy object metadata
wrangler r2 object get your-bucket-name proxies/your-job-id/720p.mp4 --json
```

## Email Notification Issues

**Symptoms:**
- Email notifications not being sent
- SendGrid API errors
- Clients don't receive upload confirmations

**Solutions:**
1. Verify SendGrid API key is correct
2. Check sender email is verified in SendGrid
3. Verify recipient emails are correctly formatted
4. Check SendGrid activity logs for delivery issues
5. Test email sending functionality directly

**Fix:**
```bash
# Test SendGrid directly
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer YOUR_SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"personalizations":[{"to":[{"email":"test@example.com"}]}],"from":{"email":"sender@yourdomain.com"},"subject":"Test Email","content":[{"type":"text/plain","value":"This is a test email."}]}'
```

## Authentication Issues

**Symptoms:**
- Admin cannot log in
- JWT validation errors
- Session expires prematurely

**Solutions:**
1. Verify admin credentials in database
2. Check JWT_SECRET environment variable
3. Verify JWT expiration time configuration
4. Check for clock synchronization issues
5. Clear browser cookies and cache

**Fix:**
```bash
# Reset admin password
npm run reset-admin-password -- --email="admin@example.com" --password="new-secure-password"
```

## LucidLink Integration Issues

**Symptoms:**
- LucidLink files not accessible
- "Failed to connect to LucidLink server" error
- High-quality proxies not available for editing

**Solutions:**
1. Verify LucidLink server is running
2. Check LUCIDLINK_ENABLED is set to true
3. Verify API token is correct
4. Check network connectivity to LucidLink server
5. Verify file system permissions

**Fix:**
```bash
# Test LucidLink API directly
curl -X GET -H "Authorization: Bearer YOUR_LUCIDLINK_API_TOKEN" https://your-lucidlink-server.com/api/health
``` 