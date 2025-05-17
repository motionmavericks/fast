import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DigitalOceanClient } from './digitalOceanClient';

// Configuration for GPU transcoding
const GPU_CONFIG = {
  DROPLET_SIZE: 'g-2vcpu-8gb', // Basic GPU instance for transcoding
  REGION: 'nyc1',
  IMAGE: 'ffmpeg-gpu-latest',  // Custom image with FFmpeg and GPU drivers
  SSH_KEYS: [],                // Will be populated from env
  TIMEOUT_MINUTES: 120,        // Max time to keep the droplet running
};

// Video quality profiles
export const VIDEO_QUALITIES = {
  '360p': { height: 360, bitrate: '800k', preset: 'fast' },
  '540p': { height: 540, bitrate: '1500k', preset: 'fast' },
  '720p': { height: 720, bitrate: '2500k', preset: 'medium' },
  '1080p': { height: 1080, bitrate: '5000k', preset: 'medium' },
  '2160p': { height: 2160, bitrate: '15000k', preset: 'slow' }
};

// Create Digital Ocean client instance
let doClient: DigitalOceanClient | null = null;

// Initialize DO client
function getDigitalOceanClient() {
  if (!doClient) {
    doClient = new DigitalOceanClient({
      token: process.env.DIGITAL_OCEAN_TOKEN || '',
    });
  }
  return doClient;
}

// Request transcoding of a video file
export async function requestTranscoding(
  fileId: string,
  sourceUrl: string,
  qualities: string[] = ['360p', '720p'],
  webhookUrl?: string
): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  try {
    // Initialize the DO client
    const client = getDigitalOceanClient();
    
    // Generate a unique job ID
    const jobId = `transcode-${fileId}-${Date.now()}`;
    
    // Create startup script for the droplet
    const userData = generateUserData(jobId, sourceUrl, qualities, webhookUrl);
    
    // Create droplet for transcoding
    const droplet = await client.createDroplet({
      name: `transcode-${fileId}`,
      region: GPU_CONFIG.REGION,
      size: GPU_CONFIG.DROPLET_SIZE,
      image: GPU_CONFIG.IMAGE,
      ssh_keys: process.env.DO_SSH_KEY_IDS?.split(',') || [],
      tags: ['transcoder', fileId, jobId],
      user_data: userData,
    });
    
    // Store job information in database
    await storeTranscodingJob(jobId, fileId, droplet.id, qualities);
    
    return {
      success: true,
      jobId
    };
  } catch (error: any) {
    console.error('Error requesting transcoding:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Generate user data script for droplet initialization
function generateUserData(
  jobId: string,
  sourceUrl: string,
  qualities: string[],
  webhookUrl?: string
): string {
  // Base64 encode the user data script
  const script = `#!/bin/bash
# Setup environment
mkdir -p /tmp/transcoding/${jobId}
cd /tmp/transcoding/${jobId}

# Download source file
curl -L "${sourceUrl}" -o source.mp4

# Transcode to each quality
${qualities.map(quality => {
  const profile = VIDEO_QUALITIES[quality as keyof typeof VIDEO_QUALITIES];
  return `
# Transcode to ${quality}
ffmpeg -hwaccel cuda -i source.mp4 -c:v h264_nvenc -preset ${profile.preset} -b:v ${profile.bitrate} -maxrate ${profile.bitrate} -bufsize ${profile.bitrate} -vf "scale=-2:${profile.height}" -c:a aac -b:a 128k -movflags +faststart ${quality}.mp4

# Upload to R2
aws s3 cp ${quality}.mp4 s3://${process.env.R2_BUCKET_NAME}/proxies/${jobId}/${quality}.mp4 --endpoint-url ${process.env.R2_ENDPOINT}`;
}).join('\n')}

# Notify webhook if provided
${webhookUrl ? `curl -X POST "${webhookUrl}" -H "Content-Type: application/json" -d '{"jobId":"${jobId}","status":"completed","qualities":${JSON.stringify(qualities)}}'` : '# No webhook URL provided'}

# Shutdown instance after completion
shutdown -h now
`;

  return Buffer.from(script).toString('base64');
}

// Store transcoding job information in database
async function storeTranscodingJob(
  jobId: string,
  fileId: string,
  dropletId: number,
  qualities: string[]
): Promise<void> {
  // This would interact with your database to store job info
  // For demonstration, we'll log it
  console.log(`Stored transcoding job: ${jobId} for file ${fileId} on droplet ${dropletId} for qualities ${qualities.join(', ')}`);
}

// Check transcoding job status
export async function getTranscodingStatus(
  jobId: string
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  qualities?: string[];
  error?: string;
}> {
  try {
    // In a real implementation, this would query your database and the DO API
    // For demonstration, we'll return a mock status
    return {
      status: 'processing',
      progress: 50,
      qualities: ['360p', '720p']
    };
  } catch (error: any) {
    console.error('Error getting transcoding status:', error);
    return {
      status: 'failed',
      error: error.message
    };
  }
}

// Get URLs for transcoded video files
export async function getTranscodedVideoUrls(
  jobId: string,
  fileId: string,
  expiresInSeconds = 3600
): Promise<{
  [quality: string]: string;
}> {
  try {
    // Initialize R2 client
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT || '',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      }
    });
    
    // Generate signed URLs for each quality
    const result: { [quality: string]: string } = {};
    
    // Get list of available qualities from your database or check R2
    const qualities = Object.keys(VIDEO_QUALITIES);
    
    // Generate signed URL for each quality
    for (const quality of qualities) {
      const key = `proxies/${jobId}/${quality}.mp4`;
      
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME || '',
          Key: key,
        });
        
        const url = await getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
        result[quality] = url;
      } catch (error) {
        console.warn(`Quality ${quality} not available for job ${jobId}`);
        // Skip this quality if not available
      }
    }
    
    return result;
  } catch (error: any) {
    console.error('Error getting transcoded video URLs:', error);
    throw error;
  }
}

// Cancel an active transcoding job
export async function cancelTranscoding(
  jobId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get the droplet ID from your database based on jobId
    const dropletId = 123456; // This would come from your database
    
    // Initialize the DO client
    const client = getDigitalOceanClient();
    
    // Delete the droplet
    await client.deleteDroplet(dropletId);
    
    // Update job status in your database
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error('Error canceling transcoding:', error);
    return {
      success: false,
      error: error.message
    };
  }
} 