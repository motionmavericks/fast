/**
 * Fast Video Processing Worker
 * Central orchestration point for video processing using Digital Ocean GPU instances and R2 storage
 * 
 * Routes:
 * - /api/transcode: Start transcoding process
 * - /api/status/:jobId: Check transcoding status
 * - /proxy/:fileId/:quality: Serve video proxy with quality selection
 * - /api/upload: Generate pre-signed upload URLs
 * - /api/webhook: Handle transcoding completion webhooks
 * - /api/lifecycle: Run lifecycle maintenance (purge unused proxies)
 */

// Configuration
const CONFIG = {
  // Worker Environment Variables
  API_SECRET: "", // Set via wrangler secret
  DO_API_TOKEN: "", // Set via wrangler secret
  R2_BUCKET: null, // Binding from wrangler.toml
  
  // Digital Ocean GPU Configuration
  DO_API_BASE: "https://api.digitalocean.com/v2",
  GPU_CONFIG: {
    DROPLET_SIZE: "g-2vcpu-8gb", // General purpose GPU droplet
    REGION: "nyc1",
    IMAGE: "ubuntu-22-04-x64", // Base image, we'll install FFMPEG
    SSH_KEYS: [], // Will be loaded from environment
    TAGS: ["fast-transcoder", "auto-delete"]
  },
  
  // Video Encoding Profiles
  VIDEO_QUALITIES: {
    "360p": { height: 360, bitrate: "800k", preset: "fast" },
    "540p": { height: 540, bitrate: "1500k", preset: "fast" },
    "720p": { height: 720, bitrate: "2500k", preset: "medium" },
    "1080p": { height: 1080, bitrate: "5000k", preset: "medium" },
    "2160p": { height: 2160, bitrate: "15000k", preset: "slow" }
  },
  
  // Default Proxies to Create
  DEFAULT_QUALITIES: ["360p", "720p"],
  
  // Digital Ocean SSH Keys (will be replaced with actual IDs from environment)
  SSH_KEY_IDS: [],
  
  // Lifecycle Configuration
  RETENTION_DAYS: {
    LOW: 30,    // 360p, 540p
    MEDIUM: 14, // 720p
    HIGH: 7     // 1080p, 2160p
  },
  
  // Quality groups
  LOW_QUALITY_PROFILES: ["360p", "540p"],
  MID_QUALITY_PROFILES: ["720p"],
  HIGH_QUALITY_PROFILES: ["1080p", "2160p"],
  
  // Base API URL for webhooks
  API_BASE_URL: "https://your-api-domain.com/api", // Will be replaced with actual URL
  
  // Database KV (if available)
  KV_NAMESPACE: null, // Will be bound in wrangler.toml
};

/**
 * Main worker handler
 */
export default {
  async fetch(request, env, ctx) {
    // Set up configuration with environment variables
    initializeConfig(env);
    
    // Parse request URL
    const url = new URL(request.url);
    const path = url.pathname;
    
    // API secret validation for secured endpoints
    if (path.startsWith("/api/") && !path.startsWith("/api/status")) {
      const authHeader = request.headers.get("Authorization");
      const apiKey = authHeader ? authHeader.replace("Bearer ", "") : "";
      
      if (apiKey !== CONFIG.API_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    
    // Route handling
    try {
      if (path.startsWith("/api/transcode") && request.method === "POST") {
        return handleTranscodeRequest(request, env);
      } else if (path.startsWith("/api/status/") && request.method === "GET") {
        const jobId = path.split("/").pop();
        return handleStatusRequest(jobId, env);
      } else if (path.startsWith("/proxy/") && request.method === "GET") {
        return handleProxyRequest(request, path, env, ctx);
      } else if (path.startsWith("/api/upload") && request.method === "POST") {
        return handleUploadRequest(request, env);
      } else if (path.startsWith("/api/webhook") && request.method === "POST") {
        return handleWebhookRequest(request, env);
      } else if (path.startsWith("/api/lifecycle") && request.method === "POST") {
        return handleLifecycleRequest(request, env);
      } else if (path === "/api/health") {
        return handleHealthCheck(request, env);
      }
      
      // Default response for unknown routes
      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error(`Error handling request to ${path}:`, error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  },
  
  // Handle scheduled events (e.g., cleanup tasks)
  async scheduled(event, env, ctx) {
    initializeConfig(env);
    
    // Run maintenance tasks
    ctx.waitUntil(handleScheduledMaintenance(env));
  }
};

/**
 * Initialize configuration with environment variables
 */
function initializeConfig(env) {
  // Set API secret
  CONFIG.API_SECRET = env.API_SECRET || CONFIG.API_SECRET || '';
  
  // Set Digital Ocean API token
  CONFIG.DO_API_TOKEN = env.DO_API_TOKEN || CONFIG.DO_API_TOKEN || '';
  
  // Set R2 bucket and credentials
  CONFIG.R2_BUCKET = env.R2_BUCKET;
  CONFIG.R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID || '';
  CONFIG.R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY || '';
  CONFIG.R2_BUCKET_NAME = env.R2_BUCKET_NAME || '';
  CONFIG.R2_ENDPOINT = env.R2_ENDPOINT || '';
  
  // Set KV namespace if available
  CONFIG.KV_NAMESPACE = env.KV_NAMESPACE;
  
  // Set SSH keys - handle both string and array formats
  if (env.DO_SSH_KEY_IDS) {
    if (typeof env.DO_SSH_KEY_IDS === 'string') {
      CONFIG.SSH_KEY_IDS = env.DO_SSH_KEY_IDS.split(',').map(id => id.trim());
    } else {
      CONFIG.SSH_KEY_IDS = Array.isArray(env.DO_SSH_KEY_IDS) ? env.DO_SSH_KEY_IDS : CONFIG.SSH_KEY_IDS;
    }
  }
  
  // Set API base URL for webhooks
  if (env.API_BASE_URL) {
    CONFIG.API_BASE_URL = env.API_BASE_URL;
  } else if (env.WORKER_URL) {
    CONFIG.API_BASE_URL = env.WORKER_URL.replace(/\/$/, '');
  }
  
  // Log configuration (excluding sensitive data)
  console.log('Worker configuration initialized:');
  console.log({
    hasApiSecret: !!CONFIG.API_SECRET,
    hasDoToken: !!CONFIG.DO_API_TOKEN,
    hasSshKeys: CONFIG.SSH_KEY_IDS?.length > 0,
    hasR2Bucket: !!CONFIG.R2_BUCKET,
    hasKv: !!CONFIG.KV_NAMESPACE,
    apiBaseUrl: CONFIG.API_BASE_URL
  });
}

/**
 * Handle transcode request
 * POST /api/transcode
 * {
 *   fileId: string,
 *   sourceUrl: string,
 *   qualities?: string[],
 *   webhookUrl?: string
 * }
 */
async function handleTranscodeRequest(request, env) {
  try {
    // Parse request body
    const body = await request.json();
    const { fileId, sourceUrl, qualities = CONFIG.DEFAULT_QUALITIES, webhookUrl } = body;
    
    // Validate required parameters
    if (!fileId) {
      return new Response(JSON.stringify({ 
        error: "Missing required parameter", 
        message: "fileId is required" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    if (!sourceUrl) {
      return new Response(JSON.stringify({ 
        error: "Missing required parameter", 
        message: "sourceUrl is required" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Validate sourceUrl is accessible
    try {
      const urlTest = new URL(sourceUrl);
      // Only support http and https protocols
      if (urlTest.protocol !== 'http:' && urlTest.protocol !== 'https:') {
        return new Response(JSON.stringify({ 
          error: "Invalid sourceUrl", 
          message: "Source URL must use http or https protocol" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: "Invalid sourceUrl", 
        message: "Source URL is not a valid URL" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Validate qualities
    if (!Array.isArray(qualities) || qualities.length === 0) {
      return new Response(JSON.stringify({ 
        error: "Invalid qualities", 
        message: "qualities must be an array of quality identifiers" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Ensure all requested qualities are supported
    const invalidQualities = qualities.filter(q => !CONFIG.VIDEO_QUALITIES[q]);
    if (invalidQualities.length > 0) {
      return new Response(JSON.stringify({ 
        error: "Invalid qualities", 
        message: `Unsupported quality profiles: ${invalidQualities.join(', ')}`, 
        validQualities: Object.keys(CONFIG.VIDEO_QUALITIES)
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    console.log(`Starting transcoding job for file ${fileId}, qualities: ${qualities.join(', ')}`);
    
    // Generate a unique job ID
    const jobId = `transcode-${fileId}-${Date.now()}`;
    
    // Create startup script for the droplet
    const userData = generateUserData(jobId, sourceUrl, qualities, request.url, webhookUrl);
    
    // Create job data object first
    const jobData = {
      jobId,
      fileId,
      sourceUrl,
      qualities,
      status: "initializing",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store job information to track the job immediately
    await storeTranscodingJob(jobData, env);
    
    // Create droplet for transcoding
    try {
      const droplet = await createTranscodeDroplet(jobId, fileId, userData);
      
      // Update job with droplet information
      jobData.dropletId = droplet.id;
      jobData.dropletName = droplet.name;
      jobData.status = "processing";
      
      // Update job information with droplet details
      await updateJobStatus(jobId, jobData, env);
      
      return new Response(JSON.stringify({
        success: true,
        jobId,
        message: "Transcoding job started"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      // Update job status to failed
      jobData.status = "failed";
      jobData.error = error.message;
      jobData.updatedAt = new Date().toISOString();
      
      await updateJobStatus(jobId, jobData, env);
      
      throw error; // Re-throw to return the appropriate error response
    }
  } catch (error) {
    console.error("Error starting transcoding job:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to start transcoding job", 
      message: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Create a Digital Ocean droplet for transcoding
 */
async function createTranscodeDroplet(jobId, fileId, userData) {
  // Validate required configuration
  if (!CONFIG.DO_API_TOKEN) {
    throw new Error('Digital Ocean API token is missing');
  }
  
  if (!CONFIG.SSH_KEY_IDS || CONFIG.SSH_KEY_IDS.length === 0) {
    throw new Error('SSH key IDs are required for droplet creation');
  }
  
  // Create payload for Digital Ocean API
  const payload = {
    name: `transcode-${fileId.substr(0, 8)}`,
    region: CONFIG.GPU_CONFIG.REGION,
    size: CONFIG.GPU_CONFIG.DROPLET_SIZE,
    image: CONFIG.GPU_CONFIG.IMAGE,
    ssh_keys: CONFIG.SSH_KEY_IDS,
    backups: false,
    ipv6: false,
    user_data: userData,
    tags: [...CONFIG.GPU_CONFIG.TAGS, `job:${jobId}`, `file:${fileId}`]
  };
  
  console.log(`Creating droplet for job ${jobId} with SSH keys: ${CONFIG.SSH_KEY_IDS.join(', ')}`);
  
  // Create droplet using Digital Ocean API
  try {
    const response = await fetch(`${CONFIG.DO_API_BASE}/droplets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CONFIG.DO_API_TOKEN}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      let errorText = await response.text();
      try {
        // Try to parse error as JSON for more details
        const errorData = JSON.parse(errorText);
        throw new Error(`Digital Ocean API error: ${JSON.stringify(errorData)}`);
      } catch (e) {
        // Fall back to text error if not JSON
        throw new Error(`Failed to create Digital Ocean droplet: ${errorText}`);
      }
    }
    
    const data = await response.json();
    if (!data.droplet || !data.droplet.id) {
      throw new Error('Digital Ocean response missing droplet data');
    }
    
    console.log(`Successfully created droplet ID: ${data.droplet.id} for job ${jobId}`);
    
    return {
      id: data.droplet.id,
      name: data.droplet.name
    };
  } catch (error) {
    console.error(`Error creating transcoding droplet: ${error.message}`);
    throw error; // Re-throw to handle in calling function
  }
}

/**
 * Generate user data script for droplet initialization
 */
function generateUserData(jobId, sourceUrl, qualities, callbackUrl, webhookUrl) {
  // Create the user data script
  const script = `#!/bin/bash
# Install required dependencies
apt-get update
apt-get install -y ffmpeg wget curl awscli jq

# Configure AWS CLI for R2
mkdir -p ~/.aws
cat > ~/.aws/credentials << EOF
[default]
aws_access_key_id=${CONFIG.R2_ACCESS_KEY_ID}
aws_secret_access_key=${CONFIG.R2_SECRET_ACCESS_KEY}
EOF

# Configure AWS CLI for R2 endpoints
cat > ~/.aws/config << EOF
[default]
region=auto
endpoint_url=${CONFIG.R2_ENDPOINT}
EOF

# Setup environment
mkdir -p /tmp/transcoding/${jobId}
cd /tmp/transcoding/${jobId}

# Download source file
wget "${sourceUrl}" -O source.mp4 || curl -L "${sourceUrl}" -o source.mp4

# Transcode to each quality
${qualities.map(quality => {
  const profile = CONFIG.VIDEO_QUALITIES[quality];
  return `
# Transcode to ${quality}
echo "Starting transcoding of ${quality}..."
ffmpeg -i source.mp4 -c:v h264 -preset ${profile.preset} -b:v ${profile.bitrate} -maxrate ${profile.bitrate} -bufsize ${profile.bitrate} -vf "scale=-2:${profile.height}" -c:a aac -b:a 128k -movflags +faststart ${quality}.mp4

# Upload to R2
echo "Uploading ${quality}.mp4 to R2..."
aws s3 cp ${quality}.mp4 s3://${CONFIG.R2_BUCKET_NAME}/proxies/${jobId}/${quality}.mp4
echo "${quality} complete."`;
}).join('\n')}

# Notify worker of completion
echo "Notifying worker of completion..."
curl -X POST "${callbackUrl.replace('/api/transcode', '/api/webhook')}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${CONFIG.API_SECRET}" \\
  -d '{"jobId":"${jobId}","status":"completed","qualities":${JSON.stringify(qualities)}}'

# Notify external webhook if provided
${webhookUrl ? `echo "Notifying external webhook..."
curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"jobId":"${jobId}","status":"completed","qualities":${JSON.stringify(qualities)}}'` : '# No external webhook URL provided'}

# Shutdown instance after completion
echo "Transcoding complete. Shutting down..."
shutdown -h now
`;

  // Use TextEncoder instead of Buffer for Cloudflare Workers
  const encoder = new TextEncoder();
  const scriptBytes = encoder.encode(script);
  return btoa(String.fromCharCode.apply(null, new Uint8Array(scriptBytes)));
}

/**
 * Store transcoding job information
 */
async function storeTranscodingJob(jobData, env) {
  // Store in KV if available
  if (CONFIG.KV_NAMESPACE) {
    await env.KV_NAMESPACE.put(`job:${jobData.jobId}`, JSON.stringify(jobData), {
      expirationTtl: 86400 * 7 // 7 days
    });
  }
  
  // Also store in R2 for persistence
  await env.R2_BUCKET.put(`jobs/${jobData.jobId}.json`, JSON.stringify(jobData), {
    customMetadata: {
      fileId: jobData.fileId,
      status: jobData.status
    }
  });
  
  return jobData;
}

/**
 * Handle status request
 * GET /api/status/:jobId
 */
async function handleStatusRequest(jobId, env) {
  try {
    // Get job status
    const status = await getTranscodingStatus(jobId, env);
    
    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(`Error getting status for job ${jobId}:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Get transcoding job status
 */
async function getTranscodingStatus(jobId, env) {
  // Try to get from KV first
  let jobData;
  
  if (CONFIG.KV_NAMESPACE) {
    const cachedData = await env.KV_NAMESPACE.get(`job:${jobId}`, "json");
    if (cachedData) {
      jobData = cachedData;
    }
  }
  
  // If not in KV, try to get from R2
  if (!jobData) {
    try {
      const r2Object = await env.R2_BUCKET.get(`jobs/${jobId}.json`);
      if (r2Object) {
        const data = await r2Object.json();
        jobData = data;
      }
    } catch (error) {
      console.error(`Error getting job data from R2 for ${jobId}:`, error);
    }
  }
  
  // If we have job data, return it
  if (jobData) {
    // If job is already completed or failed, return the status
    if (jobData.status === "completed" || jobData.status === "failed") {
      return jobData;
    }
    
    // Otherwise, check if the proxies exist in R2
    try {
      const qualities = jobData.qualities || CONFIG.DEFAULT_QUALITIES;
      const completedQualities = [];
      
      // Check if proxies for each quality exist
      for (const quality of qualities) {
        const proxyExists = await checkProxyExists(jobId, quality, env);
        if (proxyExists) {
          completedQualities.push(quality);
        }
      }
      
      // If all qualities are complete, update job status
      if (completedQualities.length === qualities.length) {
        jobData.status = "completed";
        jobData.completedAt = new Date().toISOString();
        jobData.updatedAt = new Date().toISOString();
        
        // Update in KV and R2
        await updateJobStatus(jobId, jobData, env);
      } else if (completedQualities.length > 0) {
        // Some qualities are complete
        jobData.progress = Math.round((completedQualities.length / qualities.length) * 100);
        jobData.completedQualities = completedQualities;
        jobData.updatedAt = new Date().toISOString();
      }
    } catch (error) {
      console.error(`Error checking proxy existence for ${jobId}:`, error);
    }
    
    return jobData;
  }
  
  // If job data not found, return error
  return {
    status: "not_found",
    error: "Transcoding job not found"
  };
}

/**
 * Check if a proxy exists in R2
 */
async function checkProxyExists(jobId, quality, env) {
  try {
    const proxyKey = `proxies/${jobId}/${quality}.mp4`;
    const headObject = await env.R2_BUCKET.head(proxyKey);
    return !!headObject;
  } catch (error) {
    return false;
  }
}

/**
 * Update job status
 */
async function updateJobStatus(jobId, jobData, env) {
  // Update in KV if available
  if (CONFIG.KV_NAMESPACE) {
    await env.KV_NAMESPACE.put(`job:${jobId}`, JSON.stringify(jobData), {
      expirationTtl: 86400 * 7 // 7 days
    });
  }
  
  // Update in R2
  await env.R2_BUCKET.put(`jobs/${jobId}.json`, JSON.stringify(jobData), {
    customMetadata: {
      fileId: jobData.fileId,
      status: jobData.status
    }
  });
}

/**
 * Handle proxy request
 * GET /proxy/:fileId/:quality.mp4
 */
async function handleProxyRequest(request, path, env, ctx) {
  try {
    // Parse request path
    const parts = path.split("/");
    if (parts.length < 4) {
      return new Response("Invalid proxy path", { status: 400 });
    }
    
    const fileId = parts[2];
    const qualityRequested = parts[3].replace(".mp4", "");
    
    console.log(`Proxy request for file ${fileId}, quality ${qualityRequested}`);
    
    // Get the job ID for this file
    const jobId = await getJobIdForFile(fileId, env);
    if (!jobId) {
      console.error(`No job ID found for file ${fileId}`);
      return new Response(JSON.stringify({
        error: "File not found", 
        message: "No transcoding job found for this file ID"
      }), { 
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    console.log(`Found job ID ${jobId} for file ${fileId}`);
    
    // Try to get the requested quality
    const proxyKey = `proxies/${jobId}/${qualityRequested}.mp4`;
    let object = null;
    
    try {
      object = await env.R2_BUCKET.get(proxyKey);
    } catch (error) {
      console.error(`Error fetching ${proxyKey} from R2:`, error);
    }
    
    // If requested quality doesn't exist, try to find an available quality
    if (!object) {
      console.log(`Quality ${qualityRequested} not found for ${jobId}, looking for alternatives`);
      
      let alternativeFound = false;
      
      // Try to find a lower quality if high quality was requested
      if (CONFIG.HIGH_QUALITY_PROFILES.includes(qualityRequested) || 
          CONFIG.MID_QUALITY_PROFILES.includes(qualityRequested)) {
        
        // Try mid quality first
        if (CONFIG.HIGH_QUALITY_PROFILES.includes(qualityRequested)) {
          for (const quality of CONFIG.MID_QUALITY_PROFILES) {
            try {
              object = await env.R2_BUCKET.get(`proxies/${jobId}/${quality}.mp4`);
              if (object) {
                console.log(`Found alternative mid quality: ${quality}`);
                alternativeFound = true;
                break;
              }
            } catch (error) {
              console.error(`Error fetching mid quality alternative:`, error);
            }
          }
        }
        
        // If still not found, try low quality
        if (!object) {
          for (const quality of CONFIG.LOW_QUALITY_PROFILES) {
            try {
              object = await env.R2_BUCKET.get(`proxies/${jobId}/${quality}.mp4`);
              if (object) {
                console.log(`Found alternative low quality: ${quality}`);
                alternativeFound = true;
                break;
              }
            } catch (error) {
              console.error(`Error fetching low quality alternative:`, error);
            }
          }
        }
        
        // Trigger higher quality fetch in background if we had to downgrade
        if (object && alternativeFound) {
          ctx.waitUntil(fetchHigherQuality(jobId, fileId, qualityRequested, env));
        }
      }
    } else {
      // The requested quality exists, update access timestamp
      ctx.waitUntil(updateAccessTimestamp(proxyKey, env));
    }
    
    // If no proxy found at all, return 404
    if (!object) {
      console.error(`No proxy found for file ${fileId} (job ${jobId})`);
      return new Response(JSON.stringify({
        error: "Proxy not found",
        message: "No transcoded proxy found for this file. Transcoding may be in progress or failed."
      }), { 
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Return the object with appropriate headers
    return new Response(object.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": object.size,
        "Cache-Control": "public, max-age=31536000",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Error handling proxy request:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error", 
      message: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Get the job ID for a file
 */
async function getJobIdForFile(fileId, env) {
  // Try to get from KV first
  if (CONFIG.KV_NAMESPACE) {
    const jobId = await env.KV_NAMESPACE.get(`file:${fileId}`);
    if (jobId) return jobId;
  }
  
  // If not in KV, list objects in R2 with the file ID in metadata
  try {
    const objects = await env.R2_BUCKET.list({
      prefix: "jobs/",
      delimiter: "/"
    });
    
    for (const object of objects.objects) {
      if (object.customMetadata?.fileId === fileId) {
        const jobId = object.key.replace("jobs/", "").replace(".json", "");
        
        // Cache in KV for future requests
        if (CONFIG.KV_NAMESPACE) {
          await env.KV_NAMESPACE.put(`file:${fileId}`, jobId, {
            expirationTtl: 86400 * 30 // 30 days
          });
        }
        
        return jobId;
      }
    }
  } catch (error) {
    console.error(`Error finding job ID for file ${fileId}:`, error);
  }
  
  return null;
}

/**
 * Update access timestamp for lifecycle management
 */
async function updateAccessTimestamp(key, env) {
  try {
    // Get the object to read its metadata
    const object = await env.R2_BUCKET.head(key);
    if (!object) return;
    
    // Determine quality from key
    const quality = key.split('/').pop().replace(".mp4", "");
    
    // Determine retention period based on quality
    let retentionDays = CONFIG.RETENTION_DAYS.LOW;
    if (CONFIG.HIGH_QUALITY_PROFILES.includes(quality)) {
      retentionDays = CONFIG.RETENTION_DAYS.HIGH;
    } else if (CONFIG.MID_QUALITY_PROFILES.includes(quality)) {
      retentionDays = CONFIG.RETENTION_DAYS.MEDIUM;
    }
    
    // Update metadata
    const metadata = object.customMetadata || {};
    metadata.lastAccessed = new Date().toISOString();
    metadata.expiresAt = new Date(Date.now() + (retentionDays * 86400 * 1000)).toISOString();
    
    // Need to copy the object to update metadata (R2 limitation)
    const existingObject = await env.R2_BUCKET.get(key);
    await env.R2_BUCKET.put(key, existingObject.body, {
      customMetadata: metadata
    });
  } catch (error) {
    console.error(`Error updating access timestamp for ${key}:`, error);
  }
}

/**
 * Fetch higher quality in background
 */
async function fetchHigherQuality(jobId, fileId, requestedQuality, env) {
  try {
    // Get job status
    const jobStatus = await getTranscodingStatus(jobId, env);
    
    // If job is not completed, or doesn't have the requested quality, start transcoding
    if (jobStatus.status === "completed" && 
        jobStatus.completedQualities && 
        !jobStatus.completedQualities.includes(requestedQuality)) {
      
      console.log(`Fetching higher quality ${requestedQuality} for job ${jobId}, file ${fileId}`);
      
      // Get the source URL from job data
      const sourceUrl = jobStatus.sourceUrl;
      if (!sourceUrl) {
        console.warn(`No source URL found for job ${jobId}, can't fetch higher quality`);
        return;
      }
      
      // Create a temporary jobId for just this quality
      const upgradeJobId = `upgrade-${jobId}-${requestedQuality}-${Date.now()}`;
      
      // Create job data
      const jobData = {
        jobId: upgradeJobId,
        fileId,
        sourceUrl,
        originalJobId: jobId,
        qualities: [requestedQuality],
        status: "initializing",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isUpgrade: true
      };
      
      // Store job information
      await storeTranscodingJob(jobData, env);
      
      // Create startup script for the droplet with just this quality
      const callbackUrl = CONFIG.API_BASE_URL 
        ? `${CONFIG.API_BASE_URL}/webhook` 
        : `${new URL(self.location.href).origin}/api/webhook`;
        
      const userData = generateUserData(
        upgradeJobId, 
        sourceUrl, 
        [requestedQuality], 
        callbackUrl
      );
      
      // Create the upgrade droplet
      try {
        const droplet = await createTranscodeDroplet(upgradeJobId, fileId, userData);
        
        // Update job with droplet information
        jobData.dropletId = droplet.id;
        jobData.dropletName = droplet.name;
        jobData.status = "processing";
        
        await updateJobStatus(upgradeJobId, jobData, env);
        
        console.log(`Started upgrade job ${upgradeJobId} for quality ${requestedQuality}`);
      } catch (error) {
        // Update job status to failed
        jobData.status = "failed";
        jobData.error = error.message;
        jobData.updatedAt = new Date().toISOString();
        
        await updateJobStatus(upgradeJobId, jobData, env);
        
        console.error(`Failed to create upgrade droplet: ${error.message}`);
      }
    } else {
      console.log(`Not starting upgrade job for ${requestedQuality}: job status=${jobStatus.status}, already has quality=${jobStatus.completedQualities?.includes(requestedQuality)}`);
    }
  } catch (error) {
    console.error(`Error fetching higher quality for job ${jobId}:`, error);
  }
}

/**
 * Handle upload request
 * POST /api/upload
 * {
 *   fileId: string,
 *   fileName: string,
 *   fileSize: number,
 *   contentType: string
 * }
 */
async function handleUploadRequest(request, env) {
  try {
    // Parse request body
    const { fileId, fileName, fileSize, contentType } = await request.json();
    
    // Validate required parameters
    if (!fileId || !fileName || !fileSize || !contentType) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Generate a pre-signed upload URL
    const key = `uploads/${fileId}/${fileName}`;
    const uploadUrl = await generatePresignedUploadUrl(key, contentType, env);
    
    // Store upload information
    await storeUploadInfo(fileId, fileName, fileSize, contentType, key, env);
    
    return new Response(JSON.stringify({
      success: true,
      uploadUrl,
      key
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error generating pre-signed upload URL:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Generate pre-signed upload URL for R2
 */
async function generatePresignedUploadUrl(key, contentType, env) {
  // For this example, assume the Worker can generate pre-signed URLs
  // In practice, you might need to use an external service or the Cloudflare API
  // since Workers don't have native support for generating pre-signed URLs
  
  // Mock implementation for now
  return `https://worker.example.com/presigned-upload/${key}?token=mock-token`;
}

/**
 * Store upload information
 */
async function storeUploadInfo(fileId, fileName, fileSize, contentType, key, env) {
  // Create upload info
  const uploadInfo = {
    fileId,
    fileName,
    fileSize,
    contentType,
    key,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  
  // Store in R2
  await env.R2_BUCKET.put(`uploads/${fileId}/info.json`, JSON.stringify(uploadInfo), {
    customMetadata: {
      fileId,
      status: "pending"
    }
  });
  
  // Store in KV if available
  if (CONFIG.KV_NAMESPACE) {
    await env.KV_NAMESPACE.put(`upload:${fileId}`, JSON.stringify(uploadInfo), {
      expirationTtl: 86400 // 1 day
    });
  }
}

/**
 * Handle webhook request from transcoding droplet
 * POST /api/webhook
 * {
 *   jobId: string,
 *   status: string,
 *   qualities: string[]
 * }
 */
async function handleWebhookRequest(request, env) {
  try {
    // Parse request body
    const { jobId, status, qualities, error } = await request.json();
    
    // Validate required parameters
    if (!jobId || !status) {
      return new Response(JSON.stringify({ 
        error: "Missing required parameters",
        message: "jobId and status are required"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    console.log(`Webhook received for job ${jobId}, status: ${status}, qualities: ${qualities?.join(', ')}`);
    
    // Get current job status
    const jobData = await getTranscodingStatus(jobId, env);
    if (!jobData || jobData.status === "not_found") {
      return new Response(JSON.stringify({ 
        error: "Job not found",
        message: `No job found with ID ${jobId}`
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Update job status
    jobData.status = status;
    jobData.updatedAt = new Date().toISOString();
    
    if (status === "completed") {
      jobData.completedAt = new Date().toISOString();
      jobData.completedQualities = qualities || jobData.qualities;
      
      // If this is an upgrade job, update the original job's completedQualities
      if (jobData.isUpgrade && jobData.originalJobId) {
        try {
          console.log(`Updating original job ${jobData.originalJobId} with new quality ${qualities?.join(', ')}`);
          
          const originalJob = await getTranscodingStatus(jobData.originalJobId, env);
          if (originalJob && originalJob.status !== "not_found") {
            // Add the new quality to the original job's completed qualities
            originalJob.completedQualities = [
              ...(originalJob.completedQualities || []),
              ...(qualities || [])
            ];
            
            // Remove duplicates
            originalJob.completedQualities = [...new Set(originalJob.completedQualities)];
            
            originalJob.updatedAt = new Date().toISOString();
            
            // Update the original job
            await updateJobStatus(jobData.originalJobId, originalJob, env);
          }
        } catch (error) {
          console.error(`Error updating original job: ${error.message}`);
        }
      }
      
      // Delete the droplet when done
      try {
        if (jobData.dropletId) {
          await deleteDroplet(jobData.dropletId);
          console.log(`Deleted droplet ${jobData.dropletId} for completed job ${jobId}`);
        }
      } catch (error) {
        console.error(`Error deleting droplet for job ${jobId}:`, error);
      }
    } else if (status === "failed") {
      jobData.error = error || "Unknown error";
      jobData.failedAt = new Date().toISOString();
      
      // Also try to delete the droplet on failure
      try {
        if (jobData.dropletId) {
          await deleteDroplet(jobData.dropletId);
          console.log(`Deleted droplet ${jobData.dropletId} for failed job ${jobId}`);
        }
      } catch (error) {
        console.error(`Error deleting droplet for failed job ${jobId}:`, error);
      }
    }
    
    // Update in KV and R2
    await updateJobStatus(jobId, jobData, env);
    
    // Update file:jobId mapping to ensure lookup works for both original and upgrade jobs
    if (CONFIG.KV_NAMESPACE && jobData.fileId) {
      try {
        // For upgrade jobs, make sure they point to the original job for proxy lookups
        if (jobData.isUpgrade && jobData.originalJobId) {
          await env.KV_NAMESPACE.put(`file:${jobData.fileId}`, jobData.originalJobId, {
            expirationTtl: 86400 * 30 // 30 days
          });
        } else {
          // For regular jobs, store mapping as usual
          await env.KV_NAMESPACE.put(`file:${jobData.fileId}`, jobId, {
            expirationTtl: 86400 * 30 // 30 days
          });
        }
      } catch (error) {
        console.error(`Error updating file:jobId mapping: ${error.message}`);
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: "Webhook processed",
      jobId,
      status
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to process webhook",
      message: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Delete a Digital Ocean droplet
 */
async function deleteDroplet(dropletId) {
  // Call DO API to delete the droplet
  const response = await fetch(`${CONFIG.DO_API_BASE}/droplets/${dropletId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${CONFIG.DO_API_TOKEN}`
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete droplet: ${error}`);
  }
  
  return true;
}

/**
 * Handle lifecycle request
 * POST /api/lifecycle
 */
async function handleLifecycleRequest(request, env) {
  try {
    // Authenticate
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${CONFIG.API_SECRET}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Run lifecycle maintenance
    const result = await runLifecycleMaintenance(env);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error running lifecycle maintenance:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Clean up orphaned droplets
 */
async function cleanupOrphanedDroplets() {
  try {
    console.log('Starting orphaned droplet cleanup');
    
    // Get all droplets with the transcoder tag
    const response = await fetch(`${CONFIG.DO_API_BASE}/droplets?tag_name=fast-transcoder`, {
      headers: {
        "Authorization": `Bearer ${CONFIG.DO_API_TOKEN}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get droplets: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    const droplets = data.droplets || [];
    
    console.log(`Found ${droplets.length} transcoder droplets`);
    
    if (droplets.length === 0) {
      return { deletedCount: 0, keptCount: 0, errors: 0 }; // Nothing to clean up
    }
    
    // Check each droplet's creation time
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000; // Absolute maximum time for any droplet
    const now = new Date();
    let deletedCount = 0;
    let keptCount = 0;
    let errorCount = 0;
    
    for (const droplet of droplets) {
      try {
        const createdAt = new Date(droplet.created_at);
        const ageMs = now.getTime() - createdAt.getTime();
        
        // Extract job ID and file ID from tags
        const jobTag = droplet.tags.find(tag => tag.startsWith('job:'));
        const fileTag = droplet.tags.find(tag => tag.startsWith('file:'));
        const jobId = jobTag ? jobTag.replace('job:', '') : null;
        const fileId = fileTag ? fileTag.replace('file:', '') : null;
        
        // Additional logging for monitoring
        console.log(`Inspecting droplet ${droplet.id} (${droplet.name}): age=${Math.round(ageMs / 60000)}min, jobId=${jobId}, fileId=${fileId}`);
        
        // If droplet is older than the absolute timeout, delete it regardless
        if (ageMs > FOUR_HOURS_MS) {
          console.log(`Deleting droplet ${droplet.id} (${droplet.name}) - exceeded absolute maximum age of 4 hours`);
          await deleteDroplet(droplet.id);
          deletedCount++;
          
          // Mark job as failed if we have a job ID
          if (jobId) {
            await markJobAsFailed(jobId, 'Transcoding exceeded maximum 4-hour timeout');
          }
          continue;
        }
        
        // If droplet is older than the standard timeout (2 hours), check if it's actually working
        if (ageMs > TWO_HOURS_MS) {
          // For droplets in the 2-4 hour range, we should check if they're active by checking CPU
          // Here we would normally check DO's monitoring API, but that's complex for this example
          // Instead, we'll just delete droplets older than 2 hours as a simplification
          console.log(`Deleting droplet ${droplet.id} (${droplet.name}) created ${createdAt.toISOString()} - ${Math.round(ageMs / 60000)} minutes old`);
          
          // Mark job as failed if we can find it
          if (jobId) {
            await markJobAsFailed(jobId, 'Transcoding timed out after 2 hours');
          }
          
          await deleteDroplet(droplet.id);
          deletedCount++;
        } else {
          console.log(`Keeping recent droplet ${droplet.id} (${droplet.name}) - ${Math.round(ageMs / 60000)} minutes old`);
          keptCount++;
        }
      } catch (error) {
        console.error(`Error processing droplet ${droplet.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Cleanup complete. Deleted ${deletedCount} droplets, kept ${keptCount}, errors: ${errorCount}`);
    return { deletedCount, keptCount, errorCount };
  } catch (error) {
    console.error("Error cleaning up orphaned droplets:", error);
    throw error;
  }
}

/**
 * Mark a job as failed with the given error message
 */
async function markJobAsFailed(jobId, errorMessage, env) {
  try {
    // Get current job data if possible
    let jobData;
    
    if (env && env.R2_BUCKET) {
      try {
        const r2Object = await env.R2_BUCKET.get(`jobs/${jobId}.json`);
        if (r2Object) {
          jobData = await r2Object.json();
        }
      } catch (e) {
        console.warn(`Could not fetch existing job data for ${jobId}: ${e.message}`);
      }
    }
    
    // Create basic job data if we couldn't get the original
    if (!jobData) {
      jobData = {
        jobId,
        status: 'unknown',
        updatedAt: new Date().toISOString()
      };
    }
    
    // Update with failed status
    jobData.status = 'failed';
    jobData.error = errorMessage;
    jobData.failedAt = new Date().toISOString();
    jobData.updatedAt = new Date().toISOString();
    
    // Store updated job status
    await updateJobStatus(jobId, jobData, env);
    console.log(`Updated job ${jobId} status to failed: ${errorMessage}`);
    
    return true;
  } catch (error) {
    console.error(`Error marking job ${jobId} as failed: ${error.message}`);
    return false;
  }
}

/**
 * Run lifecycle maintenance (clean up expired proxies)
 */
async function runLifecycleMaintenance(env) {
  console.log('Starting lifecycle maintenance');
  
  // Track stats
  const stats = {
    scanned: 0,
    deleted: 0,
    retained: 0,
    errors: 0,
    metadataUpdated: 0
  };
  
  const deletedObjects = [];
  const errors = [];
  
  // Get current time
  const now = new Date();
  
  try {
    // Step 1: Clean up expired proxies
    console.log('Checking for expired proxies...');
    
    // List objects in proxies directory
    let cursor;
    let truncated = true;
    
    while (truncated) {
      const listed = await env.R2_BUCKET.list({
        prefix: "proxies/",
        cursor,
        limit: 1000
      });
      
      cursor = listed.cursor;
      truncated = listed.truncated;
      
      // Process objects
      for (const object of listed.objects) {
        stats.scanned++;
        
        try {
          // Check if object has expired
          const metadata = object.customMetadata || {};
          
          if (metadata.expiresAt) {
            const expiresAt = new Date(metadata.expiresAt);
            
            if (expiresAt <= now) {
              // Check if we should keep this quality (always keep at least one quality per file)
              const shouldDelete = await shouldDeleteProxy(object.key, env);
              
              if (shouldDelete) {
                // Delete expired object
                await env.R2_BUCKET.delete(object.key);
                deletedObjects.push(object.key);
                stats.deleted++;
                console.log(`Deleted expired proxy: ${object.key}`);
              } else {
                // Reset expiration to keep this quality
                stats.retained++;
                console.log(`Retained essential proxy despite expiration: ${object.key}`);
                
                // Refresh the metadata to extend retention
                await refreshProxyMetadata(object.key, metadata, env);
                stats.metadataUpdated++;
              }
            } else {
              stats.retained++;
            }
          } else {
            // No expiration set, set one based on quality
            await refreshProxyMetadata(object.key, metadata, env);
            stats.metadataUpdated++;
            stats.retained++;
          }
        } catch (error) {
          console.error(`Error processing object ${object.key}:`, error);
          errors.push({ key: object.key, error: error.message });
          stats.errors++;
        }
      }
    }
    
    // Step 2: Clean up orphaned droplets
    console.log('Checking for orphaned droplets...');
    const dropletCleanupResult = await cleanupOrphanedDroplets();
    
    return {
      success: true,
      stats,
      dropletsDeleted: dropletCleanupResult.deletedCount,
      dropletsKept: dropletCleanupResult.keptCount,
      dropletErrors: dropletCleanupResult.errorCount,
      deletedObjects: deletedObjects.slice(0, 50), // Limit the response size
      errors: errors.slice(0, 10)
    };
  } catch (error) {
    console.error('Error in lifecycle maintenance:', error);
    return {
      success: false,
      error: error.message,
      stats
    };
  }
}

/**
 * Determine if a proxy should be deleted based on quality and existing alternatives
 */
async function shouldDeleteProxy(proxyKey, env) {
  // Extract job ID and quality from the key
  // Format: proxies/{jobId}/{quality}.mp4
  const parts = proxyKey.split('/');
  if (parts.length < 3) return true; // Invalid key format, safe to delete
  
  const jobId = parts[1];
  const quality = parts[2].replace('.mp4', '');
  
  // Always keep at least the lowest quality version if possible
  if (CONFIG.LOW_QUALITY_PROFILES.includes(quality)) {
    // Before deleting low quality, check if it's the only one left
    // If it's the only quality left, we should keep it regardless of expiration
    try {
      // List all qualities for this job
      const listed = await env.R2_BUCKET.list({
        prefix: `proxies/${jobId}/`,
        delimiter: '/'
      });
      
      // If this is the only quality, keep it
      if (listed.objects.length <= 1) {
        console.log(`Keeping last remaining quality ${quality} for job ${jobId}`);
        return false;
      }
      
      // If there are other qualities, first check if those are higher quality
      // We prefer to keep the lower quality for edge delivery even if expired
      const otherQualities = listed.objects
        .map(obj => obj.key.split('/').pop().replace('.mp4', ''))
        .filter(q => q !== quality);
      
      // If all other qualities are higher quality, keep this one as the base quality
      const allOthersAreHigher = otherQualities.every(q => {
        const thisQualityIndex = CONFIG.LOW_QUALITY_PROFILES.indexOf(quality);
        const otherQualityIndex = CONFIG.LOW_QUALITY_PROFILES.indexOf(q);
        
        // If other quality isn't in LOW_QUALITY_PROFILES, it must be higher
        if (otherQualityIndex === -1) return true;
        
        // Otherwise compare positions within LOW_QUALITY_PROFILES
        return otherQualityIndex > thisQualityIndex;
      });
      
      if (allOthersAreHigher) {
        console.log(`Keeping lowest quality ${quality} for job ${jobId}`);
        return false;
      }
    } catch (error) {
      console.error(`Error checking other qualities for ${jobId}:`, error);
      // On error, be conservative and keep the file
      return false;
    }
  }
  
  // By default, allow deletion of expired proxies
  return true;
}

/**
 * Refresh metadata for a proxy, setting appropriate expiration
 */
async function refreshProxyMetadata(key, existingMetadata, env) {
  try {
    // Determine quality from key
    const parts = key.split('/');
    const quality = parts[parts.length - 1].replace(".mp4", "");
    
    // Determine retention period based on quality
    let retentionDays = CONFIG.RETENTION_DAYS.LOW;
    if (CONFIG.HIGH_QUALITY_PROFILES.includes(quality)) {
      retentionDays = CONFIG.RETENTION_DAYS.HIGH;
    } else if (CONFIG.MID_QUALITY_PROFILES.includes(quality)) {
      retentionDays = CONFIG.RETENTION_DAYS.MEDIUM;
    }
    
    // Use existing lastAccessed time if available, otherwise use current time
    const lastAccessed = existingMetadata.lastAccessed || new Date().toISOString();
    
    // Calculate new expiration date
    const expiresAt = new Date(new Date(lastAccessed).getTime() + (retentionDays * 86400 * 1000)).toISOString();
    
    // Create updated metadata
    const updatedMetadata = {
      ...existingMetadata,
      lastAccessed,
      expiresAt,
      qualityType: CONFIG.HIGH_QUALITY_PROFILES.includes(quality) ? 'high' : 
                  CONFIG.MID_QUALITY_PROFILES.includes(quality) ? 'medium' : 'low',
      updatedAt: new Date().toISOString()
    };
    
    // Get the object to preserve its content
    const existingObject = await env.R2_BUCKET.get(key);
    
    // Update the object with new metadata
    await env.R2_BUCKET.put(key, existingObject.body, {
      customMetadata: updatedMetadata
    });
    
    return true;
  } catch (error) {
    console.error(`Error refreshing metadata for ${key}:`, error);
    throw error;
  }
}

/**
 * Handle scheduled maintenance
 */
async function handleScheduledMaintenance(env) {
  console.log('Running scheduled maintenance tasks');
  
  try {
    // Run lifecycle maintenance to clean up expired proxies
    const lifecycleResult = await runLifecycleMaintenance(env);
    
    console.log('Scheduled maintenance completed successfully:', lifecycleResult);
    return lifecycleResult;
  } catch (error) {
    console.error('Error in scheduled maintenance:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle health check request
 * GET /api/health
 */
async function handleHealthCheck(request, env) {
  // Check authorization if Header is provided
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const apiKey = authHeader.replace("Bearer ", "");
    if (apiKey !== CONFIG.API_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  
  // Prepare health status
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    services: {
      r2: {
        status: "unknown",
        error: null
      },
      kv: {
        status: "unknown",
        error: null
      },
      digitalOcean: {
        status: "unknown",
        error: null
      }
    },
    config: {
      hasDOToken: !!CONFIG.DO_API_TOKEN,
      hasSSHKeys: CONFIG.SSH_KEY_IDS && CONFIG.SSH_KEY_IDS.length > 0,
      hasR2Bucket: !!CONFIG.R2_BUCKET,
      hasKV: !!CONFIG.KV_NAMESPACE,
      hasAPISecret: !!CONFIG.API_SECRET,
      apiBaseUrl: CONFIG.API_BASE_URL || "not set"
    }
  };
  
  // Only check service connectivity if authorized
  if (authHeader && authHeader.replace("Bearer ", "") === CONFIG.API_SECRET) {
    // Check R2 connectivity
    if (env.R2_BUCKET) {
      try {
        // Try to list a few objects
        const listed = await env.R2_BUCKET.list({
          prefix: 'proxies/',
          limit: 1
        });
        health.services.r2.status = "healthy";
      } catch (error) {
        health.services.r2.status = "error";
        health.services.r2.error = error.message;
      }
    } else {
      health.services.r2.status = "not_configured";
    }
    
    // Check KV connectivity
    if (env.KV_NAMESPACE) {
      try {
        // Try to read a value
        await env.KV_NAMESPACE.get("health_check");
        health.services.kv.status = "healthy";
      } catch (error) {
        health.services.kv.status = "error";
        health.services.kv.error = error.message;
      }
    } else {
      health.services.kv.status = "not_configured";
    }
    
    // Check Digital Ocean API
    if (CONFIG.DO_API_TOKEN) {
      try {
        // Try to list SSH keys
        const response = await fetch(`${CONFIG.DO_API_BASE}/account/keys`, {
          headers: {
            "Authorization": `Bearer ${CONFIG.DO_API_TOKEN}`
          }
        });
        
        if (response.ok) {
          health.services.digitalOcean.status = "healthy";
        } else {
          health.services.digitalOcean.status = "error";
          health.services.digitalOcean.error = `HTTP ${response.status}: ${response.statusText}`;
        }
      } catch (error) {
        health.services.digitalOcean.status = "error";
        health.services.digitalOcean.error = error.message;
      }
    } else {
      health.services.digitalOcean.status = "not_configured";
    }
    
    // Set overall status based on services
    const serviceStatuses = Object.values(health.services).map(s => s.status);
    if (serviceStatuses.includes("error")) {
      health.status = "unhealthy";
    } else if (serviceStatuses.includes("not_configured")) {
      health.status = "degraded";
    }
  }
  
  return new Response(JSON.stringify(health), {
    headers: { "Content-Type": "application/json" }
  });
} 