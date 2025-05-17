import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { File } from '@/utils/models';

interface PlaybackRequest {
  fileId: string;
  quality?: 'auto' | '360p' | '540p' | '720p' | '1080p' | '2160p';
  clientWidth?: number;
  clientHeight?: number;
  connectionType?: 'slow-2g' | '2g' | '3g' | '4g' | '5g' | 'wifi' | 'unknown';
  connectionSpeed?: number; // in Mbps
}

/**
 * Get adaptive video playback URLs based on connection quality
 * 
 * POST /api/files/playback
 */
export async function POST(request: NextRequest) {
  try {
    const data: PlaybackRequest = await request.json();
    
    if (!data.fileId) {
      return NextResponse.json(
        { error: 'Missing file ID' },
        { status: 400 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Get file details
    const file = await File.findById(data.fileId);
    
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    // Ensure file is a video
    if (!file.fileType.startsWith('video/')) {
      return NextResponse.json(
        { 
          error: 'Not a video file',
          fileType: file.fileType
        },
        { status: 400 }
      );
    }
    
    // If file hasn't been processed yet, try to initiate transcoding
    if (file.status !== 'processed' && !file.transcoding) {
      // Auto-initiate transcoding if not already in progress
      try {
        await initiateTranscoding(file._id);
      } catch (error) {
        console.error('Error auto-initiating transcoding:', error);
      }
      
      return NextResponse.json(
        { 
          error: 'Video processing not complete',
          status: file.status,
          message: 'Transcoding has been initiated automatically. Please try again later.'
        },
        { status: 202 } // 202 Accepted - request accepted for processing
      );
    }
    
    // Check if transcoding is in progress
    if (file.transcoding && file.transcoding.status === 'processing') {
      return NextResponse.json(
        { 
          error: 'Video processing in progress',
          status: 'processing',
          jobId: file.transcoding.jobId,
          startedAt: file.transcoding.startedAt,
          message: 'Video is currently being transcoded. Please try again later.'
        },
        { status: 202 } // 202 Accepted
      );
    }
    
    // Check if transcoding failed
    if (file.transcoding && file.transcoding.status === 'failed') {
      return NextResponse.json(
        { 
          error: 'Video processing failed',
          status: 'failed',
          jobId: file.transcoding.jobId,
          message: file.transcoding.error || 'Unknown error during transcoding'
        },
        { status: 500 }
      );
    }
    
    // Get proxies from file record
    const proxies = file.proxies || [];
    
    if (proxies.length === 0) {
      // No proxies available, try to initiate transcoding
      try {
        await initiateTranscoding(file._id);
      } catch (error) {
        console.error('Error initiating transcoding:', error);
      }
      
      return NextResponse.json(
        { error: 'No video proxies available. Transcoding has been initiated.' },
        { status: 202 }
      );
    }

    // Determine best quality based on client parameters if quality is 'auto'
    let selectedQuality = data.quality || 'auto';
    
    if (selectedQuality === 'auto') {
      selectedQuality = determineOptimalQuality(data);
    }
    
    // Find the requested quality or closest match
    let selectedProxy = findClosestQualityProxy(proxies, selectedQuality);
    
    if (!selectedProxy) {
      return NextResponse.json(
        { error: 'No matching proxy quality found' },
        { status: 404 }
      );
    }
    
    // Use Cloudflare Worker URL directly
    const streamUrl = `${process.env.CLOUDFLARE_WORKER_URL}/proxy/${file._id}/${selectedProxy.quality}.mp4`;
    
    // Prepare all available qualities for adaptive player
    const allQualities = proxies.map(proxy => ({
      quality: proxy.quality,
      url: `${process.env.CLOUDFLARE_WORKER_URL}/proxy/${file._id}/${proxy.quality}.mp4`,
    }));
    
    return NextResponse.json({
      success: true,
      fileId: file._id,
      fileName: file.fileName,
      streamUrl,
      selectedQuality: selectedProxy.quality,
      availableQualities: allQualities,
      metadata: {
        duration: file.metadata?.duration,
        width: file.metadata?.width,
        height: file.metadata?.height,
      }
    });
  } catch (error: any) {
    console.error('Error getting video playback URL:', error);
    return NextResponse.json(
      { error: 'Failed to get playback URL', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Initiate transcoding for a file
 */
async function initiateTranscoding(fileId: string): Promise<void> {
  // Call our transcoding endpoint
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/files/${fileId}/transcode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.API_SECRET}`
    },
    body: JSON.stringify({
      qualities: ['360p', '540p', '720p', '1080p'] // Default to all common qualities
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to initiate transcoding: ${errorData.error || response.statusText}`);
  }
}

/**
 * Determine optimal quality based on client parameters
 */
function determineOptimalQuality(params: PlaybackRequest): string {
  // If connection speed is provided, use that as primary factor
  if (params.connectionSpeed) {
    if (params.connectionSpeed < 1) return '360p';
    if (params.connectionSpeed < 2.5) return '540p';
    if (params.connectionSpeed < 5) return '720p';
    if (params.connectionSpeed < 10) return '1080p';
    return '2160p';
  }
  
  // Otherwise use connection type as a proxy for speed
  if (params.connectionType) {
    switch (params.connectionType) {
      case 'slow-2g':
      case '2g':
        return '360p';
      case '3g':
        return '540p';
      case '4g':
        return '720p';
      case '5g':
      case 'wifi':
        return '1080p';
      default:
        return '720p'; // Default to 720p for unknown connection
    }
  }
  
  // If client dimensions are provided, use that
  if (params.clientWidth) {
    if (params.clientWidth < 640) return '360p';
    if (params.clientWidth < 960) return '540p';
    if (params.clientWidth < 1280) return '720p';
    if (params.clientWidth < 1920) return '1080p';
    return '2160p';
  }
  
  // Default to 720p if no parameters available
  return '720p';
}

/**
 * Find closest matching quality proxy
 */
function findClosestQualityProxy(proxies: any[], targetQuality: string): any {
  // First try exact match
  const exactMatch = proxies.find(p => p.quality === targetQuality);
  
  if (exactMatch) return exactMatch;
  
  // If no exact match, map quality to numeric value for comparison
  const qualityMap: Record<string, number> = {
    '360p': 360,
    '540p': 540,
    '720p': 720,
    '1080p': 1080,
    '2160p': 2160,
  };
  
  const targetValue = qualityMap[targetQuality as keyof typeof qualityMap] || 720;
  
  // Extract numeric values from proxy quality strings
  const proxiesWithValue = proxies.map(proxy => {
    let value = 0;
    
    // Try to extract resolution from quality
    if (proxy.quality.includes('2160')) value = 2160;
    else if (proxy.quality.includes('1080')) value = 1080;
    else if (proxy.quality.includes('720')) value = 720;
    else if (proxy.quality.includes('540')) value = 540;
    else if (proxy.quality.includes('360')) value = 360;
    else value = 720; // Default value if unknown
    
    return {
      ...proxy,
      numericValue: value,
    };
  });
  
  // Sort by closeness to target (absolute difference)
  proxiesWithValue.sort((a, b) => {
    return Math.abs(a.numericValue - targetValue) - Math.abs(b.numericValue - targetValue);
  });
  
  // Return the closest match
  return proxiesWithValue[0];
} 