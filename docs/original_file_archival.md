# Original File Archival in Motion Mavericks Fast

This document explains how Motion Mavericks Fast handles original file archival using a multi-tier storage approach.

## Overview

Original files (the full-resolution source files uploaded by clients) follow a different path than proxy files in our multi-tier storage architecture:

1. Original files are **never** stored in Cloudflare R2 (edge storage)
2. Original files are initially uploaded to and stored in Frame.io
3. Original files are then archived to Wasabi for long-term storage
4. Original file metadata is tracked in the MongoDB database

## Workflow

### 1. Upload Phase
- Client uploads original file to Frame.io via authenticated link
- Frame.io sends an `asset.ready` webhook when upload is complete
- The Cloudflare Worker processes this webhook and identifies it as an original file upload

### 2. Automatic Archival Process
- When the Cloudflare Worker receives the `asset.ready` event:
  - It requests file metadata from the web app API
  - It triggers the `archiveOriginalToWasabi` function
  - This function calls the `/api/storage/wasabi/archive-original` endpoint

### 3. Wasabi Archival
- The API endpoint:
  - Generates a download URL from Frame.io for the original file
  - Streams the file directly from Frame.io to Wasabi
  - Updates the database with the Wasabi storage key
  - Records the archival timestamp

### 4. Access Phase
- Original files are accessed via Wasabi when needed for:
  - Downloads by authorized users
  - Retrieval for post-production
  - Any operation requiring the full-resolution source

## Render Access Workflow

Motion Mavericks Fast implements an efficient approach for accessing original files during the final render process:

### 1. Direct Wasabi Access
- Since Wasabi has no egress fees, original files are accessed directly from Wasabi during final renders
- This approach avoids additional storage costs of maintaining originals in other tiers

### 2. Render Process Optimization
- Render engine requests original files from Wasabi via direct HTTP requests
- Only the required segments of each file are transferred (byte-range requests)
- Parallel processing enables efficient access to multiple segments simultaneously
- No need to pre-download entire files before starting the render

### 3. Automated Media Relink
- Database maps relationships between proxy files and original files
- When sending to render, the system automatically substitutes proxy paths with original Wasabi paths
- Render farms can access files directly through Wasabi's APIs

### 4. Render Queue Management
- Jobs are optimized to reduce thrashing between different files
- Similar clips are batched together for efficient processing
- Smart pre-fetching based on the edit timeline improves performance

### 5. Cost Efficiency
- No egress fees from Wasabi means render costs stay predictable
- No additional storage tier required specifically for renders
- Direct access reduces complexity and maintenance overhead

## Implementation Components

### Cloudflare Worker
- Handles Frame.io webhooks and triggers archival process
- Implements logic to distinguish between proxies and original files
- Contains safeguards to prevent original files from being stored in R2

```javascript
// In Cloudflare Worker
if (assetData.status === 'complete') {
  try {
    // Get file info from the application API (MongoDB)
    const fileInfo = await getFileInfo(assetData.id, env);
    if (fileInfo && fileInfo.fileId) {
      // Schedule the original file to be archived to Wasabi
      await archiveOriginalToWasabi(assetId, fileInfo.fileId, env);
    }
  } catch (archiveError) {
    console.error("Error archiving original file:", archiveError);
  }
}
```

### R2 Storage Protection
The worker explicitly prevents original files from being stored in R2:

```javascript
// Skip original files - they should never go to R2, only to Wasabi
if (quality === ORIGINAL_FILE_MARKER) {
  console.log(`Skipping original file upload to R2 for fileId ${fileId}`);
  return {
    success: false,
    reason: "Original files are not stored in R2"
  };
}
```

### API Endpoint
The web application includes a specific endpoint for archiving original files:

```typescript
// app/api/storage/wasabi/archive-original/route.ts
export async function POST(request: NextRequest) {
  // Authenticate and validate request
  // Get download URL from Frame.io
  // Stream file to Wasabi
  // Update database record with storage key
}
```

### Render Access API
For render access, the application provides efficient APIs to retrieve original file information:

```typescript
// app/api/files/render-access/route.ts
export async function GET(request: NextRequest) {
  // Authenticate render farm request
  // Get file ID from request
  // Return signed URL for direct Wasabi access
  // Log access for monitoring
}
```

## Benefits

1. **Cost Efficiency**: Original files (which can be very large) are only stored in Wasabi, which has lower storage costs than R2 and no egress fees
2. **Storage Optimization**: R2 edge storage is reserved only for frequently accessed proxy files
3. **Efficient Workflow**: Automatic archival triggers ensure all originals are properly stored
4. **Redundancy**: Original files are stored in both Frame.io and Wasabi for a period
5. **Render-Ready**: Original files can be efficiently accessed for final renders directly from Wasabi

## Technical Notes

- Original file archival occurs asynchronously after upload completion
- Database status tracking ensures files aren't archived multiple times
- Error handling ensures failed archival attempts are properly logged and can be retried
- File paths in Wasabi follow a structured format: `originals/{clientName}/{projectName}/{fileId}/{fileName}`
- Render access is optimized for partial file retrieval rather than full downloads 