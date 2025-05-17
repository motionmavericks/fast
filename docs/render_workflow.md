# Render Workflow with Wasabi

This document outlines the render workflow for accessing original files directly from Wasabi storage in Motion Mavericks Fast.

## Overview

Motion Mavericks Fast implements an optimized workflow for accessing original files during the rendering process. Since Wasabi does not charge egress fees, the system leverages direct access to original files stored in Wasabi rather than requiring an additional storage tier for render operations.

## Architecture

### Workflow Components

1. **Wasabi Cloud Storage**
   - Stores all original files permanently
   - Provides direct HTTP access to originals
   - No egress fees for data transfer
   - Global availability for render farms

2. **Web Application API**
   - Provides metadata about file locations
   - Generates authorized URLs for render access
   - Maps edit decision lists to original file locations
   - Tracks render access patterns for optimization

3. **Render Farms/Workstations**
   - Request original file access via API
   - Stream required segments directly from Wasabi
   - Process only needed frames/segments
   - Implement intelligent caching for efficiency

### Data Flow

```
Edit Decision List → Web App API → Wasabi Signed URLs → Render Engine → Direct Wasabi Access → Completed Render
```

## Implementation

### 1. API Endpoints

The web application exposes these endpoints for render processes:

#### Get Original File URL

```typescript
// app/api/files/render-access/[fileId]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    // Authenticate request
    const apiKey = request.headers.get('X-Render-API-Key');
    if (!apiKey || apiKey !== process.env.RENDER_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get file information
    const fileId = params.fileId;
    const file = await File.findById(fileId);
    
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Ensure original file is archived in Wasabi
    if (!file.wasabiData?.originalKey) {
      return NextResponse.json(
        { error: 'Original file not available in archival storage' },
        { status: 400 }
      );
    }
    
    // Generate signed URL with long expiration
    const wasabi = new WasabiStorage();
    const signedUrl = await wasabi.getSignedReadUrl(
      file.wasabiData.originalKey,
      43200, // 12 hours
      false // Not forcing download
    );
    
    // Log render access for analytics
    await logRenderAccess(fileId);
    
    return NextResponse.json({
      fileId: file._id.toString(),
      fileName: file.fileName,
      fileSize: file.fileSize,
      fileType: file.fileType,
      url: signedUrl,
      expiresIn: '12 hours'
    });
  } catch (error: any) {
    console.error('Error getting render access:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### Batch URL Generation

For projects requiring multiple files:

```typescript
// app/api/files/render-batch/route.ts
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const apiKey = request.headers.get('X-Render-API-Key');
    if (!apiKey || apiKey !== process.env.RENDER_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get batch of file IDs
    const { fileIds } = await request.json();
    
    if (!fileIds || !Array.isArray(fileIds)) {
      return NextResponse.json(
        { error: 'File IDs array is required' },
        { status: 400 }
      );
    }
    
    // Generate URLs in parallel
    const wasabi = new WasabiStorage();
    const results = await Promise.all(
      fileIds.map(async (fileId) => {
        try {
          const file = await File.findById(fileId);
          
          if (!file || !file.wasabiData?.originalKey) {
            return {
              fileId,
              error: 'File not found or not archived',
              success: false
            };
          }
          
          const signedUrl = await wasabi.getSignedReadUrl(
            file.wasabiData.originalKey,
            43200, // 12 hours
            false
          );
          
          // Log render access
          await logRenderAccess(fileId);
          
          return {
            fileId: file._id.toString(),
            fileName: file.fileName,
            url: signedUrl,
            success: true
          };
        } catch (error) {
          return {
            fileId,
            error: 'Failed to generate URL',
            success: false
          };
        }
      })
    );
    
    return NextResponse.json({
      results,
      totalRequested: fileIds.length,
      totalSuccessful: results.filter(r => r.success).length
    });
  } catch (error: any) {
    console.error('Error processing batch render request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 2. Render Client Integration

Render farms and workstations can access original files efficiently with this pattern:

```javascript
// Example render client code
async function fetchOriginalForRender(fileId, apiKey) {
  try {
    const response = await fetch(`https://your-api-domain.com/api/files/render-access/${fileId}`, {
      headers: {
        'X-Render-API-Key': apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Process render with direct Wasabi URL
    return data.url;
  } catch (error) {
    console.error('Error fetching original file:', error);
    throw error;
  }
}
```

### 3. Byte Range Requests

For efficient frame-by-frame rendering, implement byte range requests:

```javascript
async function fetchFrameRange(fileUrl, startByte, endByte) {
  const response = await fetch(fileUrl, {
    headers: {
      'Range': `bytes=${startByte}-${endByte}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch range: ${response.statusText}`);
  }
  
  return response.arrayBuffer();
}
```

## Optimization Techniques

### 1. Parallel Downloads

For multi-threaded render processes:

```javascript
async function parallelRangeDownload(fileUrl, ranges) {
  return Promise.all(
    ranges.map(range => 
      fetchFrameRange(fileUrl, range.start, range.end)
    )
  );
}
```

### 2. Predictive Pre-fetching

Based on edit decision list (EDL) information:

```javascript
function calculatePrefetchRanges(edl, currentFrame, prefetchFrameCount) {
  // Analyze EDL to find upcoming frames that will be needed
  // Calculate byte ranges for those frames
  // Return array of ranges to prefetch
}
```

### 3. Local Caching

Implementing a local cache to avoid re-fetching the same segments:

```javascript
class FrameCache {
  constructor(maxSizeBytes) {
    this.cache = new Map();
    this.maxSize = maxSizeBytes;
    this.currentSize = 0;
  }
  
  // Store frame data
  store(key, data) {
    const size = data.byteLength;
    
    // Evict if needed
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      const oldData = this.cache.get(oldestKey);
      this.currentSize -= oldData.byteLength;
      this.cache.delete(oldestKey);
    }
    
    // Store new data
    this.cache.set(key, data);
    this.currentSize += size;
  }
  
  // Retrieve frame data
  get(key) {
    return this.cache.get(key);
  }
}
```

## Performance Considerations

### 1. Concurrent Connections

Wasabi performance can be optimized by using the appropriate number of concurrent connections:

```javascript
const OPTIMAL_CONNECTIONS = 8; // Adjust based on testing

function createConnectionPool() {
  return new Array(OPTIMAL_CONNECTIONS).fill(null).map(() => {
    return {
      busy: false,
      fetch: async function(url, options) {
        this.busy = true;
        try {
          return await fetch(url, options);
        } finally {
          this.busy = false;
        }
      }
    };
  });
}
```

### 2. Chunking Strategy

Break files into optimal chunk sizes:

```javascript
const OPTIMAL_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

function calculateChunks(fileSize) {
  const chunks = [];
  for (let i = 0; i < fileSize; i += OPTIMAL_CHUNK_SIZE) {
    chunks.push({
      start: i,
      end: Math.min(i + OPTIMAL_CHUNK_SIZE - 1, fileSize - 1)
    });
  }
  return chunks;
}
```

### 3. Render Queue Optimization

Group renders that use the same source files:

```javascript
function optimizeRenderQueue(jobs) {
  // Group jobs by file IDs they use
  const fileGroups = new Map();
  
  jobs.forEach(job => {
    job.fileIds.forEach(fileId => {
      if (!fileGroups.has(fileId)) {
        fileGroups.set(fileId, []);
      }
      fileGroups.get(fileId).push(job);
    });
  });
  
  // Create batches that minimize file switching
  // Return optimized job sequence
}
```

## API Security

### 1. API Key Management

```typescript
// Generate a secure render API key
function generateRenderApiKey() {
  return crypto.randomBytes(32).toString('hex');
}
```

### 2. IP Whitelisting

Restrict render access to known render farm IPs:

```typescript
const ALLOWED_RENDER_IPS = [
  '192.168.1.100',
  '10.0.0.50'
];

function validateRenderRequest(ip: string): boolean {
  return ALLOWED_RENDER_IPS.includes(ip);
}
```

### 3. Usage Limits

Prevent abuse with rate limiting:

```typescript
// Implement rate limiting middleware
function rateLimitRenderRequests(req, res, next) {
  // Check if client has exceeded rate limits
  // If not, allow the request
  // If yes, return 429 Too Many Requests
}
```

## Workflow Integration

### 1. Edit Decision List (EDL) Processing

```typescript
interface EditDecision {
  sourceFileId: string;
  sourceIn: number;  // Frame number
  sourceOut: number; // Frame number
  timeline: number;  // Position in timeline
}

async function processEdl(edl: EditDecision[]) {
  // Group by source files
  const fileGroups = edl.reduce((groups, item) => {
    if (!groups[item.sourceFileId]) {
      groups[item.sourceFileId] = [];
    }
    groups[item.sourceFileId].push(item);
    return groups;
  }, {});
  
  // Generate URLs for all needed files
  const fileUrls = await fetchBatchRenderUrls(Object.keys(fileGroups));
  
  // Return the processed EDL with file URLs
  return {
    decisions: edl,
    fileUrls
  };
}
```

### 2. NLE Integration

For integration with editing software:

```javascript
function generateRenderScript(project, edl, outputPath) {
  // Generate script for After Effects, Premiere, Resolve, etc.
  // Include direct Wasabi URLs in render instructions
  // Output appropriate script format
}
```

## Monitoring and Metrics

Track render performance and costs:

```typescript
interface RenderMetrics {
  fileId: string;
  fileSize: number;
  bytesTransferred: number;
  renderTime: number;
  startTime: Date;
  endTime: Date;
  renderNode: string;
}

async function recordRenderMetrics(metrics: RenderMetrics) {
  // Store metrics in database
  // Update aggregated statistics
  // Flag any performance issues
}
```

## Conclusion

This direct Wasabi access approach for rendering offers significant advantages:

1. **Cost Efficiency**: No egress fees means unlimited render access without additional costs
2. **Simplicity**: No need for an additional storage tier just for render operations
3. **Performance**: Direct access with byte-range requests minimizes unnecessary data transfer
4. **Scalability**: Works with both local workstations and distributed render farms
5. **Reliability**: Wasabi's durability ensures render assets are always available

By implementing these patterns, Motion Mavericks Fast provides an efficient, cost-effective rendering pipeline that leverages Wasabi's strengths while maintaining high performance. 