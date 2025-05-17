import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { UploadLink } from '@/utils/models';
import storage from '@/utils/storage';

/**
 * Generate a presigned URL for direct upload to Wasabi
 * POST /api/upload/presigned
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
    
    // Generate storage key
    const storageKey = `uploads/${linkId}/${fileName}`;
    
    // Generate presigned URL for direct upload
    const presignedUrl = await storage.getPresignedUploadUrl(storageKey, fileType);
    
    if (!presignedUrl) {
      return NextResponse.json(
        { message: 'Failed to generate upload URL' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      uploadUrl: presignedUrl,
      storageKey,
      clientName: link.clientName,
      projectName: link.projectName,
      linkId
    });
  } catch (error: any) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
} 