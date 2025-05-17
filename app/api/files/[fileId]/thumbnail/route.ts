import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { File } from '@/utils/models';
import { verifyAuth } from '@/utils/auth';
import { getSignedReadUrl } from '@/utils/r2storage';

/**
 * Gets a video thumbnail from Frame.io or Cloudflare R2 (if available)
 * This is strictly for admin use to preview video files
 * 
 * GET /api/files/[fileId]/thumbnail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    // Verify admin authentication
    const authResult = await verifyAuth(request);
    if (!authResult.isAuthenticated) {
      return NextResponse.json(
        { message: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // Connect to database
    await dbConnect();

    // Get file record
    const file = await File.findById(params.fileId);
    if (!file) {
      return NextResponse.json(
        { message: 'File not found' },
        { status: 404 }
      );
    }

    // Check if it's a video file
    if (!file.fileType.startsWith('video/')) {
      return NextResponse.json(
        { message: 'Not a video file' },
        { status: 400 }
      );
    }

    // Check if we have Frame.io thumbnails
    if (file.frameIoData?.thumbnails?.length > 0) {
      // Use the first thumbnail
      const thumbnail = file.frameIoData.thumbnails[0];
      
      // Redirect to the thumbnail URL
      return NextResponse.redirect(thumbnail.url);
    }
    
    // Check if we have a poster image in R2
    if (file.frameIoData?.proxies?.length > 0) {
      try {
        // Try to get a poster image from the highest quality proxy
        const proxyKey = file.frameIoData.proxies[0].r2Key;
        const posterKey = proxyKey.replace(/\.\w+$/, '_poster.jpg');
        
        // Generate a signed URL for the poster
        const posterUrl = await getSignedReadUrl(posterKey, 3600);
        
        // Redirect to the poster URL
        return NextResponse.redirect(posterUrl);
      } catch (error) {
        // If we can't get a poster image, continue to the placeholder
        console.error('Error getting poster image:', error);
      }
    }

    // If no thumbnail is available, redirect to a placeholder
    return NextResponse.redirect('https://placehold.co/600x400?text=Video+Thumbnail+Unavailable');
  } catch (error: any) {
    console.error('Error generating video thumbnail:', error);
    return NextResponse.json(
      { message: 'Failed to generate thumbnail', error: error.message },
      { status: 500 }
    );
  }
}
