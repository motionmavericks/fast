// utils/r2storage.ts - Integration with Cloudflare R2 for video storage and delivery

import { 
  S3Client, 
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Agent as HttpsAgent } from 'https';

// These would be set during the setup process and stored in environment variables
let r2Config = {
  endpoint: process.env.R2_ENDPOINT || 'https://f8bb59f64efa1103bf1d76951a1cd323.r2.cloudflarestorage.com',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucket: process.env.R2_BUCKET_NAME || ''
};

// Create custom connection agent with keep-alive for better performance
const httpsAgent = new HttpsAgent({
  keepAlive: true,
  keepAliveMsecs: 3000,
  maxSockets: 50,
});

// Cache for S3 clients to avoid recreation
let r2ClientCache: S3Client | null = null;

// Get R2 client with performance optimizations
function getR2Client(): S3Client {
  if (r2ClientCache) return r2ClientCache;

  const client = new S3Client({
    region: 'auto',
    endpoint: r2Config.endpoint,
    credentials: {
      accessKeyId: r2Config.accessKeyId,
      secretAccessKey: r2Config.secretAccessKey,
    },
    requestHandler: {
      httpHandler: {
        // @ts-ignore - AWS SDK types don't match Node.js https.Agent exactly
        httpsAgent
      }
    },
    // Performance optimizations
    maxAttempts: 5,
    tls: true,
  });

  r2ClientCache = client;
  return client;
}

// Response type for upload operations
interface UploadResponse {
  success: boolean;
  key: string;
  url?: string;
  error?: string;
}

// Upload a file from a URL (used for moving Frame.io proxies to R2)
async function uploadFromUrl(
  sourceUrl: string, 
  key: string, 
  contentType?: string
): Promise<UploadResponse> {
  try {
    // Fetch the content from the source URL
    const response = await fetch(sourceUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from source URL: ${response.statusText}`);
    }
    
    // Get the file content as a buffer
    const buffer = await response.arrayBuffer();
    
    // Upload to R2
    const r2Client = getR2Client();
    
    const command = new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: contentType || response.headers.get('content-type') || 'application/octet-stream',
      CacheControl: 'max-age=31536000', // Cache for 1 year
    });
    
    await r2Client.send(command);
    
    return {
      success: true,
      key,
    };
  } catch (error: any) {
    console.error('Error uploading from URL to R2:', error);
    return {
      success: false,
      key,
      error: error.message,
    };
  }
}

// Generate a signed URL for retrieving a file
async function getSignedReadUrl(
  key: string, 
  expiresInSeconds = 3600, 
  forceDownload = false, 
  filename?: string
): Promise<string> {
  try {
    const r2Client = getR2Client();
    
    const command = new GetObjectCommand({
      Bucket: r2Config.bucket,
      Key: key,
      ResponseContentDisposition: forceDownload 
        ? `attachment; filename="${filename || key.split('/').pop()}"` 
        : undefined,
    });
    
    return await getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
  } catch (error) {
    console.error('Error generating signed URL from R2:', error);
    throw error;
  }
}

// Delete a file from R2
async function deleteFile(key: string): Promise<boolean> {
  try {
    const r2Client = getR2Client();
    
    const command = new DeleteObjectCommand({
      Bucket: r2Config.bucket,
      Key: key,
    });
    
    await r2Client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting file from R2:', error);
    return false;
  }
}

// Check if a file exists in R2
async function fileExists(key: string): Promise<boolean> {
  try {
    const r2Client = getR2Client();
    
    const command = new HeadObjectCommand({
      Bucket: r2Config.bucket,
      Key: key,
    });
    
    await r2Client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

// Generate a direct URL for video playback (using Cloudflare R2 public access)
function getVideoStreamUrl(key: string): string {
  // Use direct R2 endpoint if public domain is not configured
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  
  if (publicDomain) {
    return `https://${publicDomain}/${key}`;
  }
  
  // Construct URL directly from the endpoint if possible
  const endpointUrl = new URL(r2Config.endpoint);
  const bucketUrl = `${endpointUrl.protocol}//${r2Config.bucket}.${endpointUrl.host}`;
  return `${bucketUrl}/${key}`;
}

// List all video proxies in a specific folder
async function listProxies(prefix: string): Promise<string[]> {
  try {
    const r2Client = getR2Client();
    
    const command = new ListObjectsV2Command({
      Bucket: r2Config.bucket,
      Prefix: prefix,
    });
    
    const response = await r2Client.send(command);
    
    if (!response.Contents) {
      return [];
    }
    
    return response.Contents.map(item => item.Key || '').filter(Boolean);
  } catch (error) {
    console.error('Error listing proxies in R2:', error);
    return [];
  }
}

// Configure the R2 integration
function configureR2(config: typeof r2Config): void {
  r2Config = {
    ...r2Config,
    ...config,
  };
  // Reset client cache when config changes
  r2ClientCache = null;
}

export {
  getR2Client,
  uploadFromUrl,
  getSignedReadUrl,
  deleteFile,
  fileExists,
  getVideoStreamUrl,
  listProxies,
  configureR2,
}; 