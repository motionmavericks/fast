import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { UploadLink } from '@/utils/models';
import storage from '@/utils/storage';
import { nanoid } from 'nanoid';

/**
 * Generate a batch of presigned URLs for direct uploads to Wasabi
 * POST /api/upload/presigned/batch
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract link ID and count
    const { linkId, count = 5 } = body;
    
    if (!linkId) {
      return NextResponse.json(
        { message: 'Missing required parameter (linkId)' },
        { status: 400 }
      );
    }
    
    // Cap the number of URLs to prevent abuse
    const urlCount = Math.min(count, 20);
    
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
    
    // Generate presigned URLs
    const urls = [];
    
    for (let i = 0; i < urlCount; i++) {
      // Generate a unique ID for this presigned URL
      const urlId = nanoid(10);
      
      // Create a temporary file path with a placeholder name
      // Real filename will be replaced when used
      const storageKey = `uploads/${linkId}/${urlId}_placeholder`;
      
      // Use a generic content type - will be updated when used
      const contentType = 'application/octet-stream';
      
      // Generate the presigned URL (default 30 minute expiration)
      const presignedUrl = await storage.getPresignedUploadUrl(storageKey, contentType, 30);
      
      if (presignedUrl) {
        const expiryTime = Date.now() + (30 * 60 * 1000); // 30 minutes from now
        
        urls.push({
          id: urlId,
          url: presignedUrl,
          storageKey: storageKey,
          expires: expiryTime
        });
      }
    }
    
    return NextResponse.json({
      urls,
      clientName: link.clientName,
      projectName: link.projectName,
      linkId
    });
  } catch (error: any) {
    console.error('Error generating batch presigned URLs:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
} 