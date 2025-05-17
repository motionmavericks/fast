import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { UploadLink } from '@/utils/models';
import storage, { getS3Client } from '@/utils/storage';
import { S3Client, CreateMultipartUploadCommand } from '@aws-sdk/client-s3';

/**
 * Initialize a multipart upload to Wasabi
 * POST /api/upload/multipart/initialize
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract link ID and file info
    const { linkId, fileName, fileType, fileSize } = body;
    
    if (!linkId || !fileName || !fileType) {
      return NextResponse.json(
        { message: 'Missing required parameters (linkId, fileName, fileType)' },
        { status: 400 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Validate the link
    const link = await UploadLink.findOne({ linkId });
    if (!link) {
      return NextResponse.json({ message: 'Invalid upload link' }, { status: 404 });
    }
    
    if (!link.isActive) {
      return NextResponse.json({ message: 'Upload link is inactive' }, { status: 403 });
    }
    
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return NextResponse.json({ message: 'Upload link has expired' }, { status: 403 });
    }
    
    // Generate storage key for the file
    const storageKey = `uploads/${linkId}/${Date.now()}_${fileName}`;
    
    // Initialize a multipart upload with Wasabi
    const s3Client = getS3Client();
    
    if (!s3Client) {
      return NextResponse.json(
        { message: 'Storage provider not configured' },
        { status: 500 }
      );
    }
    
    // Create the multipart upload
    const multipartCommand = new CreateMultipartUploadCommand({
      Bucket: process.env.WASABI_BUCKET_NAME,
      Key: storageKey,
      ContentType: fileType,
      // Set cache-control and other metadata as needed
      CacheControl: 'max-age=31536000', // Cache for 1 year
    });
    
    const multipartResponse = await s3Client.send(multipartCommand);
    
    if (!multipartResponse.UploadId) {
      return NextResponse.json(
        { message: 'Failed to initialize multipart upload' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      uploadId: multipartResponse.UploadId,
      storageKey,
      clientName: link.clientName,
      projectName: link.projectName
    });
  } catch (error: any) {
    console.error('Error initializing multipart upload:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
} 