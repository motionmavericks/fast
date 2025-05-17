import { NextRequest, NextResponse } from 'next/server';
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import storage, { getS3Client } from '@/utils/storage';

/**
 * Complete a multipart upload
 * POST /api/upload/multipart/complete
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract required information
    const { uploadId, storageKey, parts } = body;
    
    if (!uploadId || !storageKey || !parts || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json(
        { message: 'Missing or invalid required parameters (uploadId, storageKey, parts)' },
        { status: 400 }
      );
    }
    
    // Get S3 client
    const s3Client = getS3Client();
    
    if (!s3Client) {
      return NextResponse.json(
        { message: 'Storage provider not configured' },
        { status: 500 }
      );
    }
    
    // Sort parts by part number to ensure correct order
    const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
    
    // Create command to complete the multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: process.env.WASABI_BUCKET_NAME,
      Key: storageKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts
      }
    });
    
    // Complete the multipart upload
    const response = await s3Client.send(completeCommand);
    
    if (!response.Location) {
      return NextResponse.json(
        { message: 'Failed to complete multipart upload' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      location: response.Location,
      storageKey
    });
  } catch (error: any) {
    console.error('Error completing multipart upload:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
} 