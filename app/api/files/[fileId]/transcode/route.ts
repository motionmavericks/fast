import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { File } from '@/utils/models';
import { verifyAdminToken } from '@/utils/auth';

/**
 * POST /api/files/[fileId]/transcode
 * Triggers video transcoding for a specific file through the Cloudflare Worker
 * 
 * Requires admin authentication
 * 
 * Body:
 * {
 *   qualities?: string[] - Optional specific qualities to transcode (defaults to ["360p", "720p"])
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    // Check authentication
    const authResult = await verifyAdminToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Get file ID from params
    const { fileId } = params;
    
    // Get request body
    const { qualities } = await request.json();
    
    // Get file from database
    const file = await File.findOne({ _id: fileId });
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    // Generate the source URL - using presigned URL for original file
    let sourceUrl = '';
    
    // Get file source based on storage location
    if (file.storage === 'r2') {
      // Get presigned URL directly from R2
      sourceUrl = await getR2PresignedUrl(file.path);
    } else if (file.storage === 'wasabi') {
      // Get presigned URL from Wasabi
      sourceUrl = await getWasabiPresignedUrl(file.path);
    } else {
      // For other storage types, proxy through our own API
      sourceUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/files/${fileId}/stream?token=${process.env.API_SECRET}`;
    }
    
    // Make request to Cloudflare Worker for transcoding
    const transcodeResponse = await fetch(`${process.env.CLOUDFLARE_WORKER_URL}/api/transcode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_SECRET}`
      },
      body: JSON.stringify({
        fileId,
        sourceUrl,
        qualities: qualities || ['360p', '720p'],
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/files/${fileId}/transcode/webhook?token=${process.env.API_SECRET}`
      })
    });
    
    if (!transcodeResponse.ok) {
      const error = await transcodeResponse.text();
      throw new Error(`Failed to start transcoding: ${error}`);
    }
    
    const transcodeResult = await transcodeResponse.json();
    
    // Update file in database with transcoding job ID
    file.transcoding = {
      jobId: transcodeResult.jobId,
      status: 'processing',
      startedAt: new Date(),
      qualities: qualities || ['360p', '720p']
    };
    
    await file.save();
    
    return NextResponse.json({
      success: true,
      jobId: transcodeResult.jobId,
      message: 'Transcoding started'
    });
  } catch (error: any) {
    console.error('Error starting transcoding:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start transcoding' },
      { status: 500 }
    );
  }
}

/**
 * Generate a presigned URL for R2
 */
async function getR2PresignedUrl(path: string): Promise<string> {
  try {
    // Call our API to generate a presigned URL
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/files/r2-signed-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_SECRET}`
      },
      body: JSON.stringify({
        key: path,
        expiresIn: 3600 // 1 hour
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to generate R2 presigned URL: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.url;
  } catch (error) {
    console.error('Error generating R2 presigned URL:', error);
    throw error;
  }
}

/**
 * Generate a presigned URL for Wasabi
 */
async function getWasabiPresignedUrl(path: string): Promise<string> {
  try {
    // Call our API to generate a presigned URL
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/files/wasabi-signed-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_SECRET}`
      },
      body: JSON.stringify({
        key: path,
        expiresIn: 3600 // 1 hour
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to generate Wasabi presigned URL: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.url;
  } catch (error) {
    console.error('Error generating Wasabi presigned URL:', error);
    throw error;
  }
} 