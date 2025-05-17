// utils/wasabiStorage.ts - Integration with Wasabi for long-term archival storage

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
let wasabiConfig = {
  accessKeyId: process.env.WASABI_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY || '',
  bucket: process.env.WASABI_BUCKET_NAME || '',
  region: process.env.WASABI_REGION || 'ap-southeast-2',
  endpoint: process.env.WASABI_ENDPOINT || 'https://s3.ap-southeast-2.wasabisys.com',
};

// Create custom connection agent with keep-alive for better performance
const httpsAgent = new HttpsAgent({
  keepAlive: true,
  keepAliveMsecs: 3000,
  maxSockets: 50,
});

// Cache for S3 clients to avoid recreation
let wasabiClientCache: S3Client | null = null;

// Get Wasabi client with performance optimizations
function getWasabiClient(): S3Client {
  if (wasabiClientCache) return wasabiClientCache;

  const client = new S3Client({
    region: wasabiConfig.region,
    endpoint: wasabiConfig.endpoint,
    credentials: {
      accessKeyId: wasabiConfig.accessKeyId,
      secretAccessKey: wasabiConfig.secretAccessKey,
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

  wasabiClientCache = client;
  return client;
}

// Response type for upload operations
interface UploadResponse {
  success: boolean;
  key: string;
  url?: string;
  error?: string;
}

// Upload a file from a URL (used for storing Frame.io originals and proxies in Wasabi)
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
    
    // Upload to Wasabi
    const wasabiClient = getWasabiClient();
    
    const command = new PutObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: contentType || response.headers.get('content-type') || 'application/octet-stream',
    });
    
    await wasabiClient.send(command);
    
    return {
      success: true,
      key,
    };
  } catch (error: any) {
    console.error('Error uploading from URL to Wasabi:', error);
    return {
      success: false,
      key,
      error: error.message,
    };
  }
}

// Upload a buffer to Wasabi
async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType?: string
): Promise<UploadResponse> {
  try {
    const wasabiClient = getWasabiClient();
    const command = new PutObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    });
    await wasabiClient.send(command);
    return {
      success: true,
      key,
    };
  } catch (error: any) {
    console.error('Error uploading buffer to Wasabi:', error);
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
    const wasabiClient = getWasabiClient();
    
    const command = new GetObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: key,
      ResponseContentDisposition: forceDownload 
        ? `attachment; filename="${filename || key.split('/').pop()}"` 
        : undefined,
    });
    
    return await getSignedUrl(wasabiClient, command, { expiresIn: expiresInSeconds });
  } catch (error) {
    console.error('Error generating signed URL from Wasabi:', error);
    throw error;
  }
}

// Delete a file from Wasabi
async function deleteFile(key: string): Promise<boolean> {
  try {
    const wasabiClient = getWasabiClient();
    
    const command = new DeleteObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: key,
    });
    
    await wasabiClient.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting file from Wasabi:', error);
    return false;
  }
}

// Check if a file exists in Wasabi
async function fileExists(key: string): Promise<boolean> {
  try {
    const wasabiClient = getWasabiClient();
    
    const command = new HeadObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: key,
    });
    
    await wasabiClient.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

// List all files in a specific folder/prefix
async function listFiles(prefix: string): Promise<string[]> {
  try {
    const wasabiClient = getWasabiClient();
    
    const command = new ListObjectsV2Command({
      Bucket: wasabiConfig.bucket,
      Prefix: prefix,
    });
    
    const response = await wasabiClient.send(command);
    
    if (!response.Contents) {
      return [];
    }
    
    return response.Contents.map(item => item.Key || '').filter(Boolean);
  } catch (error) {
    console.error('Error listing files in Wasabi:', error);
    return [];
  }
}

// Configure the Wasabi integration
function configureWasabi(config: typeof wasabiConfig): void {
  wasabiConfig = {
    ...wasabiConfig,
    ...config,
  };
  // Reset client cache when config changes
  wasabiClientCache = null;
}

export {
  getWasabiClient,
  uploadFromUrl,
  uploadBuffer,
  getSignedReadUrl,
  deleteFile,
  fileExists,
  listFiles,
  configureWasabi,
};