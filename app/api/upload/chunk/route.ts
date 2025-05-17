import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dbConnect from '@/utils/dbConnect';
import { UploadLink, File } from '@/utils/models';
import storage from '@/utils/storage';
import email from '@/utils/email';
import { getPresignedUploadUrl } from '@/utils/storage';

// Define allowed file types
const ALLOWED_FILE_TYPES = [
  // Video
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg',
  // Image
  'image/jpeg', 'image/png', 'image/tiff',
  // Documents
  'application/pdf',
  // Archives
  'application/zip', 'application/x-rar-compressed',
  // Production specific
  'application/x-premiere-project', 'application/x-aftereffects-project',
  'application/octet-stream' // For various proprietary formats
];

// Define file size limits (100GB in bytes)
const MAX_FILE_SIZE = 100 * 1024 * 1024 * 1024;

// GET /api/upload/chunk - Check if chunk exists
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const resumableChunkNumber = searchParams.get('resumableChunkNumber');
  const resumableIdentifier = searchParams.get('resumableIdentifier');
  const linkId = searchParams.get('linkId');
  
  if (!resumableChunkNumber || !resumableIdentifier || !linkId) {
    return NextResponse.json({ message: 'Missing required parameters' }, { status: 400 });
  }
  
  // Folder to store temp chunks
  const tempDir = path.join(os.tmpdir(), 'fast-uploads', linkId, resumableIdentifier);
  const chunkPath = path.join(tempDir, `chunk.${resumableChunkNumber}`);
  
  // Check if chunk exists
  if (fs.existsSync(chunkPath)) {
    // Chunk exists, no need to upload again
    return NextResponse.json({ message: 'Chunk exists' }, { status: 200 });
  } else {
    // Chunk doesn't exist, needs to be uploaded
    return NextResponse.json({ message: 'Chunk not found' }, { status: 404 });
  }
}

interface ChunkRequest {
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  fileSize: number;
  linkId: string;
}

/**
 * Generate presigned URLs for multiple chunks in a single request
 * to enable highly parallel uploads
 * POST /api/upload/chunk
 */
export async function POST(request: NextRequest) {
  try {
    const data: {
      chunks: ChunkRequest[];
      parallelUploads?: number;
    } = await request.json();
    
    if (!data.chunks || !Array.isArray(data.chunks) || data.chunks.length === 0) {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }
    
    // Default to 10 parallel uploads if not specified, max 25
    const parallelUploads = Math.min(data.parallelUploads || 10, 25);
    
    // Get the first chunk to extract common data
    const firstChunk = data.chunks[0];
    const { linkId } = firstChunk;
    
    if (!linkId) {
      return NextResponse.json({ error: 'Missing linkId' }, { status: 400 });
    }
    
    // Connect to database to ensure link validity
    await dbConnect();
    
    // Process all chunks in parallel with Promise.all
    const chunkPromises = data.chunks.map(async (chunk) => {
      const { chunkIndex, totalChunks, fileName, fileSize } = chunk;
      
      // Generate a unique key for this chunk
      const chunkKey = `uploads/${linkId}/chunks/${Date.now()}_${fileName}_${chunkIndex}_${totalChunks}`;
      
      // Get a presigned URL for this chunk
      const presignedUrl = await getPresignedUploadUrl(
        chunkKey,
        'application/octet-stream',
        30 // 30 minutes expiry
      );
      
      return {
        chunkIndex,
        presignedUrl,
        chunkKey
      };
    });
    
    // Wait for all presigned URLs to be generated
    const results = await Promise.all(chunkPromises);
    
    return NextResponse.json({
      success: true,
      chunks: results,
      parallelUploads,
      uploadStrategy: 'direct-to-storage'
    });
  } catch (error: any) {
    console.error('Error generating chunk upload URLs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An unknown error occurred' },
      { status: 500 }
    );
  }
}