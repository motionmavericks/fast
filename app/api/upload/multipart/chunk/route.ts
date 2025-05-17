import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '@/utils/storage';

interface BatchChunkRequest {
  uploadId: string;
  storageKey: string;
  partNumbers: number[];
  contentType?: string;
}

/**
 * Generate presigned URLs for multipart upload chunks
 * Supports batch processing of multiple chunks for parallel uploads
 * POST /api/upload/multipart/chunk
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if this is a batch request or single chunk request
    const isBatchRequest = body.partNumbers && Array.isArray(body.partNumbers);
    
    if (isBatchRequest) {
      // Handle batch request
      const { uploadId, storageKey, partNumbers, contentType } = body as BatchChunkRequest;
      
      if (!uploadId || !storageKey || !partNumbers || partNumbers.length === 0) {
        return NextResponse.json(
          { message: 'Missing required parameters for batch request' },
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
      
      // Generate presigned URLs for each part in parallel
      const presignedUrls = await Promise.all(
        partNumbers.map(async (partNumber) => {
          // Create command for uploading this part
          const uploadPartCommand = new UploadPartCommand({
            Bucket: process.env.WASABI_BUCKET_NAME,
            Key: storageKey,
            UploadId: uploadId,
            PartNumber: partNumber,
            ContentType: contentType || 'application/octet-stream',
          });
          
          // Generate a presigned URL for this part (30 minute expiration)
          const presignedUrl = await getSignedUrl(s3Client, uploadPartCommand, {
            expiresIn: 30 * 60,  // 30 minutes
            // Use unsigned payloads for better performance
            unhoistableHeaders: new Set(['x-amz-content-sha256']),
          });
          
          return {
            partNumber,
            presignedUrl
          };
        })
      );
      
      return NextResponse.json({
        success: true,
        presignedUrls,
        uploadId,
        storageKey
      });
    } else {
      // Handle single chunk request for backward compatibility
      const { uploadId, storageKey, partNumber, contentType } = body;
      
      if (!uploadId || !storageKey || !partNumber) {
        return NextResponse.json(
          { message: 'Missing required parameters (uploadId, storageKey, partNumber)' },
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
      
      // Create command for uploading a part
      const uploadPartCommand = new UploadPartCommand({
        Bucket: process.env.WASABI_BUCKET_NAME,
        Key: storageKey,
        UploadId: uploadId,
        PartNumber: partNumber,
        ContentType: contentType || 'application/octet-stream',
      });
      
      // Generate a presigned URL for this part (30 minute expiration)
      const presignedUrl = await getSignedUrl(s3Client, uploadPartCommand, {
        expiresIn: 30 * 60,  // 30 minutes
        // Use unsigned payloads for better performance
        unhoistableHeaders: new Set(['x-amz-content-sha256']),
      });
      
      return NextResponse.json({ presignedUrl });
    }
  } catch (error: any) {
    console.error('Error generating chunk presigned URL:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
} 