import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/utils/auth';
import { getSignedReadUrl, getVideoStreamUrl } from '@/utils/r2storage';

/**
 * Generate a signed streaming URL for a video proxy stored in R2
 * This is used by the admin interface to play video proxies
 * 
 * GET /api/files/proxy?key=path/to/proxy.mp4
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAuth(request);
    if (!authResult.isAuthenticated) {
      return NextResponse.json(
        { message: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // Get the R2 key from query parameters
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    
    if (!key) {
      return NextResponse.json(
        { message: 'Missing key parameter' },
        { status: 400 }
      );
    }

    // Check if the file exists in R2
    // Try to generate a direct stream URL if possible (for CDN delivery)
    try {
      const streamUrl = getVideoStreamUrl(key);
      
      if (streamUrl) {
        return NextResponse.json({ url: streamUrl });
      }
    } catch (error) {
      console.warn('Error generating stream URL, falling back to signed URL:', error);
    }
    
    // Fall back to a signed URL with longer expiry (24 hours)
    const signedUrl = await getSignedReadUrl(key, 24 * 60 * 60);
    
    return NextResponse.json({ url: signedUrl });
  } catch (error: any) {
    console.error('Error generating proxy URL:', error);
    return NextResponse.json(
      { message: 'Failed to generate proxy URL', error: error.message },
      { status: 500 }
    );
  }
}
