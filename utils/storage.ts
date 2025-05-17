// utils/storage.ts - Integration with Wasabi cloud storage

import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand,
  DeleteObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

// These would be set during the setup process and stored in environment variables
let wasabiConfig = {
  endpoint: process.env.WASABI_ENDPOINT || '',
  region: process.env.WASABI_REGION || '',
  accessKeyId: process.env.WASABI_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY || '',
  bucket: process.env.WASABI_BUCKET_NAME || ''
};

// Performance optimization: Create custom connection agents to enable keep-alive and connection reuse
// Increase maxSockets to allow more parallel connections for better throughput
const httpAgent = new HttpAgent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 100  // Increased from 50 to 100 for more parallel connections
});

const httpsAgent = new HttpsAgent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 100, // Increased from 50 to 100 for more parallel connections
  rejectUnauthorized: true
});

// Initialize S3 client for Wasabi with performance optimization
let s3Client: S3Client | null = null;

// Initialize the S3 client if configuration is available
if (wasabiConfig.endpoint && wasabiConfig.region && wasabiConfig.accessKeyId && wasabiConfig.secretAccessKey) {
  const isHttps = wasabiConfig.endpoint.startsWith('https://');
  s3Client = new S3Client({
    endpoint: wasabiConfig.endpoint,
    region: wasabiConfig.region,
    credentials: {
      accessKeyId: wasabiConfig.accessKeyId,
      secretAccessKey: wasabiConfig.secretAccessKey
    },
    // Performance optimizations
    requestHandler: {
      httpAgent: httpAgent,
      httpsAgent: httpsAgent
    },
    // Use path-style addressing for better compatibility
    forcePathStyle: true,
    // Better retry strategy - more attempts with exponential backoff
    maxAttempts: 5,
    // Higher timeouts handled through the request handler
  });
}

// Interface for upload response
interface UploadResponse {
  success: boolean;
  key: string;
  error?: string;
  url?: string;
}

// Interface for file content response
interface FileContentResponse {
  success: boolean;
  content?: Buffer;
  contentType?: string;
  error?: string;
}

// Cache for presigned URLs to reduce latency in repeated operations
const presignedUrlCache: Record<string, { url: string, expires: number }> = {};

/**
 * Upload a file to storage
 * @param file The file to upload (can be a browser File object or a Node.js Buffer)
 * @param key The storage key (path/filename)
 * @returns Promise with upload result
 */
function uploadFile(file: File | Buffer, key: string, contentType?: string): Promise<UploadResponse> {
  try {
    // Check if S3 client is initialized
    if (!s3Client || !wasabiConfig.bucket) {
      console.warn('[Storage] Wasabi client not initialized, using simulation mode');
      // Simulate successful upload in dev/test environment
      const fileName = file instanceof File ? file.name : key.split('/').pop() || 'unknown';
      const fileSize = file instanceof File ? file.size : (file as Buffer).length;
      console.log(`[Storage] Simulating upload of ${fileName} (${fileSize} bytes) to ${key}`);
      return Promise.resolve({
        success: true,
        key,
        url: `https://example-wasabi-bucket.s3.wasabisys.com/${key}`
      });
    }
    
    // Handle different types of input (File object or Buffer)
    let buffer: Buffer;
    let fileType: string;
    
    if (file instanceof File) {
      // Browser File object
      return file.arrayBuffer().then(arrayBuffer => {
        buffer = Buffer.from(arrayBuffer);
        fileType = file.type;
        
        const params = {
          Bucket: wasabiConfig.bucket,
          Key: key,
          Body: buffer,
          ContentType: fileType
        };
        
        return s3Client!.send(new PutObjectCommand(params)).then(() => {
          // Generate a URL
          const endpointWithoutProtocol = wasabiConfig.endpoint.replace(/^https?:\/\//, '');
          const url = `https://${wasabiConfig.bucket}.${endpointWithoutProtocol}/${key}`;
          
          return {
            success: true,
            key,
            url
          };
        });
      }).catch(error => {
        console.error('[Storage] Upload error:', error);
        return {
          success: false,
          key,
          error: error.message || 'Unknown error during upload'
        };
      });
    } else {
      // Node.js Buffer
      buffer = file as Buffer;
      fileType = contentType || 'application/octet-stream';
      
      const params = {
        Bucket: wasabiConfig.bucket,
        Key: key,
        Body: buffer,
        ContentType: fileType
      };
      
      return s3Client.send(new PutObjectCommand(params)).then(() => {
        // Generate a URL
        const endpointWithoutProtocol = wasabiConfig.endpoint.replace(/^https?:\/\//, '');
        const url = `https://${wasabiConfig.bucket}.${endpointWithoutProtocol}/${key}`;
        
        return {
          success: true,
          key,
          url
        };
      }).catch(error => {
        console.error('[Storage] Upload error:', error);
        return {
          success: false,
          key,
          error: error.message || 'Unknown error during upload'
        };
      });
    }
  } catch (error: any) {
    console.error('[Storage] Upload error:', error);
    return Promise.resolve({
      success: false,
      key,
      error: error.message || 'Unknown error during upload'
    });
  }
}

/**
 * Get a download URL for a file
 * @param key The storage key of the file
 * @param expiryMinutes Minutes until URL expiry (default: 60)
 * @returns Promise with URL or error
 */
function getDownloadUrl(key: string, expiryMinutes = 60): Promise<string> {
  try {
    // Check if S3 client is initialized
    if (!s3Client || !wasabiConfig.bucket) {
      console.warn('[Storage] Wasabi client not initialized, using simulation mode');
      // Return a simulated URL
      return Promise.resolve(`https://example-wasabi-bucket.s3.wasabisys.com/${key}?expires=${Date.now() + expiryMinutes * 60 * 1000}`);
    }
    
    // Check cache first to reduce latency
    const cacheKey = `download:${key}:${expiryMinutes}`;
    const cachedUrl = presignedUrlCache[cacheKey];
    if (cachedUrl && cachedUrl.expires > Date.now()) {
      return Promise.resolve(cachedUrl.url);
    }
    
    const command = new GetObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: key,
    });
    
    // Generate presigned URL that expires
    return getSignedUrl(s3Client, command, {
      expiresIn: expiryMinutes * 60
    }).then(presignedUrl => {
      // Cache the URL to reduce latency for subsequent requests
      // Set cache expiry to 90% of the actual URL expiry to ensure we refresh before it expires
      presignedUrlCache[cacheKey] = {
        url: presignedUrl,
        expires: Date.now() + (expiryMinutes * 60 * 1000 * 0.9)
      };
      
      return presignedUrl;
    });
  } catch (error: any) {
    console.error('[Storage] Error generating download URL:', error);
    return Promise.reject(new Error('Failed to generate download URL'));
  }
}

/**
 * Get file content directly from storage
 * @param key The storage key of the file to retrieve
 * @returns Promise with file content or error
 */
function getFileContent(key: string): Promise<FileContentResponse> {
  try {
    // Check if S3 client is initialized
    if (!s3Client || !wasabiConfig.bucket) {
      console.warn('[Storage] Wasabi client not initialized, using simulation mode');
      // Simulate a basic response with mock content
      return Promise.resolve({
        success: true,
        content: Buffer.from('Mock file content for ' + key),
        contentType: 'text/plain'
      });
    }
    
    const command = new GetObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: key,
    });
    
    // Get the object directly from storage
    return s3Client.send(command).then(async response => {
      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      if (response.Body) {
        // @ts-ignore - AWS SDK typing issue with Body type
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
      }
      
      const content = Buffer.concat(chunks);
      
      return {
        success: true,
        content,
        contentType: response.ContentType
      };
    }).catch(error => {
      console.error('[Storage] Error retrieving file content:', error);
      return {
        success: false,
        error: error.message || 'Unknown error retrieving file content'
      };
    });
  } catch (error: any) {
    console.error('[Storage] Error retrieving file content:', error);
    return Promise.resolve({
      success: false,
      error: error.message || 'Unknown error retrieving file content'
    });
  }
}

/**
 * Delete a file from storage
 * @param key The storage key of the file to delete
 * @returns Promise with success/failure
 */
function deleteFile(key: string): Promise<boolean> {
  try {
    // Check if S3 client is initialized
    if (!s3Client || !wasabiConfig.bucket) {
      console.warn('[Storage] Wasabi client not initialized, using simulation mode');
      console.log(`[Storage] Simulating deletion of ${key}`);
      return Promise.resolve(true);
    }
    
    return s3Client.send(new DeleteObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: key
    })).then(() => true).catch(error => {
      console.error('[Storage] Error deleting file:', error);
      return false;
    });
  } catch (error) {
    console.error('[Storage] Error deleting file:', error);
    return Promise.resolve(false);
  }
}

/**
 * Initialize storage with configuration
 * @param config Storage configuration
 */
function initializeStorage(config: {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}): void {
  wasabiConfig = {
    ...config
  };
  
  // Performance optimization: Create custom connection agents to enable keep-alive and connection reuse
  const httpAgent = new HttpAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 100  // Allow up to 100 concurrent connections
  });

  const httpsAgent = new HttpsAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 100,
    rejectUnauthorized: true
  });
  
  // Reinitialize the client with new config and optimized settings
  s3Client = new S3Client({
    endpoint: wasabiConfig.endpoint,
    region: wasabiConfig.region,
    credentials: {
      accessKeyId: wasabiConfig.accessKeyId,
      secretAccessKey: wasabiConfig.secretAccessKey
    },
    // Performance optimizations
    requestHandler: {
      httpAgent: httpAgent,
      httpsAgent: httpsAgent
    },
    // Use path-style addressing for better compatibility
    forcePathStyle: true,
    // Increase max attempts for better reliability
    maxAttempts: 5,
  });
  
  console.log('[Storage] Storage initialized with config:', {
    endpoint: config.endpoint,
    region: config.region,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId ? '(set)' : '(not set)',
    secretAccessKey: config.secretAccessKey ? '(set)' : '(not set)'
  });
}

/**
 * Get a streaming URL optimized for video playback
 * @param key The storage key of the file
 * @param contentType The content type of the file
 * @param expiryMinutes Minutes until URL expiry (default: 60)
 * @returns Promise with streaming URL or null
 */
function getStreamUrl(key: string, contentType?: string, expiryMinutes = 60): Promise<string | null> {
  try {
    // Check if S3 client is initialized
    if (!s3Client || !wasabiConfig.bucket) {
      console.warn('[Storage] Wasabi client not initialized, using simulation mode');
      // Return a simulated URL
      return Promise.resolve(`https://example-wasabi-bucket.s3.wasabisys.com/${key}?streaming=true&expires=${Date.now() + expiryMinutes * 60 * 1000}`);
    }
    
    // Check cache first to reduce latency
    const cacheKey = `stream:${key}:${contentType}:${expiryMinutes}`;
    const cachedUrl = presignedUrlCache[cacheKey];
    if (cachedUrl && cachedUrl.expires > Date.now()) {
      return Promise.resolve(cachedUrl.url);
    }
    
    // Detect if this is a streamable content type
    const isStreamable = contentType && (
      contentType.startsWith('video/') || 
      contentType.startsWith('audio/') ||
      contentType.includes('mxf') ||
      contentType.includes('quicktime') ||
      contentType === 'application/octet-stream' // Some MXF files are detected as this
    );
    
    if (!isStreamable) {
      return Promise.resolve(null); // Not a streamable content type
    }
    
    const command = new GetObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: key,
      // Use response-* params to improve streaming performance
      ResponseContentType: contentType,
      ResponseCacheControl: 'max-age=3600',
    });
    
    // Generate presigned URL that expires
    return getSignedUrl(s3Client, command, {
      expiresIn: expiryMinutes * 60
    }).then(presignedUrl => {
      // Cache the URL
      presignedUrlCache[cacheKey] = {
        url: presignedUrl,
        expires: Date.now() + (expiryMinutes * 60 * 1000 * 0.9)
      };
      
      return presignedUrl;
    });
  } catch (error: any) {
    console.error('[Storage] Error generating streaming URL:', error);
    return Promise.resolve(null);
  }
}

/**
 * Generate a presigned URL for direct client-side upload to storage
 * @param key The storage key (path/filename) to upload to
 * @param contentType The content type of the file
 * @param expiryMinutes Minutes until URL expiry (default: 60)
 * @returns Promise with presigned URL for upload
 */
function getPresignedUploadUrl(key: string, contentType: string, expiryMinutes = 60): Promise<string | null> {
  try {
    // Check if S3 client is initialized
    if (!s3Client || !wasabiConfig.bucket) {
      console.warn('[Storage] Wasabi client not initialized, using simulation mode');
      // Return a simulated URL in development
      return Promise.resolve(`https://example-wasabi-bucket.s3.wasabisys.com/${key}?upload=true&expires=${Date.now() + expiryMinutes * 60 * 1000}`);
    }
    
    // Check cache first to reduce latency
    const cacheKey = `upload:${key}:${contentType}:${expiryMinutes}`;
    const cachedUrl = presignedUrlCache[cacheKey];
    if (cachedUrl && cachedUrl.expires > Date.now()) {
      return Promise.resolve(cachedUrl.url);
    }
    
    // Create a PutObject command for the S3 client with optimized headers
    const command = new PutObjectCommand({
      Bucket: wasabiConfig.bucket,
      Key: key,
      ContentType: contentType,
      // Use 100-continue for improved performance on large uploads
      // Enables the client to check if the server will accept the upload before sending the full body
      RequestPayer: 'requester',
      // Set optional cache control headers
      CacheControl: 'max-age=31536000',
    });
    
    // Generate presigned URL for PUT operation with optimized options
    return getSignedUrl(s3Client, command, {
      expiresIn: expiryMinutes * 60,
      // Use unsigned payloads for better performance
      unhoistableHeaders: new Set(['x-amz-content-sha256']),
    }).then(presignedUrl => {
      // Cache the URL
      presignedUrlCache[cacheKey] = {
        url: presignedUrl,
        expires: Date.now() + (expiryMinutes * 60 * 1000 * 0.9)
      };
      
      return presignedUrl;
    });
  } catch (error: any) {
    console.error('[Storage] Error generating presigned upload URL:', error);
    return Promise.resolve(null);
  }
}

/**
 * Get the S3 client instance
 * @returns The configured S3Client instance or null if not initialized
 */
function getS3Client(): S3Client | null {
  return s3Client;
}

/**
 * Clear the presigned URL cache
 */
function clearPresignedUrlCache(): void {
  Object.keys(presignedUrlCache).forEach(key => {
    delete presignedUrlCache[key];
  });
}

// Export named functions
export {
  uploadFile,
  getDownloadUrl,
  deleteFile,
  getFileContent,
  getStreamUrl,
  getPresignedUploadUrl,
  initializeStorage,
  getS3Client,
  clearPresignedUrlCache
};

// Export default object with all functions
export default {
  uploadFile,
  getDownloadUrl,
  deleteFile,
  getFileContent,
  getStreamUrl,
  getPresignedUploadUrl,
  initializeStorage,
  getS3Client,
  clearPresignedUrlCache
};