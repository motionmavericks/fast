import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { File } from '@/utils/models';
import storage from '@/utils/storage';
// import { verifyAdminToken } from '@/utils/serverAuth'; // TODO: Implement and use for auth

/**
 * Secure file streaming endpoint that proxies content from storage
 * GET /api/files/[fileId]/stream
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  // Fix: Use await with params
  const { fileId } = await params;

  // TODO: Add proper authentication here
  // const { isValid } = await verifyToken(request);
  // if (!isValid) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }

  try {
    await dbConnect();
    
    // Find file in database
    const file = await File.findById(fileId);
    
    if (!file) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }
    
    if (file.status !== 'completed') {
      return NextResponse.json({ message: 'File is not ready for viewing' }, { status: 400 });
    }
    
    // Get streaming URL directly from Wasabi
    // This approach is much faster than proxying content through our server
    const streamUrl = await storage.getStreamUrl(file.storageKey, file.fileType);
    
    if (streamUrl) {
      // For larger files, redirect to the signed URL for better performance
      // This prevents server memory issues and improves playback
      return NextResponse.redirect(streamUrl);
    }
    
    // Fallback to direct content streaming for formats that need it
    const fileData = await storage.getFileContent(file.storageKey);
    
    if (!fileData || !fileData.content) {
      return NextResponse.json({ message: 'Failed to retrieve file from storage' }, { status: 500 });
    }
    
    // Determine the content type
    const contentType = file.fileType || 'application/octet-stream';
    
    // Create response with appropriate headers
    // Use appropriate cache headers to improve performance
    const response = new NextResponse(fileData.content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${file.fileName}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for an hour for better performance
        'Accept-Ranges': 'bytes', // Enable range requests for better video streaming
      },
    });
    
    return response;
  } catch (error: any) {
    console.error('Error streaming file:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
} 