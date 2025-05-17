import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, File } from '../../../../../utils/models';
import * as wasabiStorage from '../../../../../utils/wasabiStorage';

/**
 * API endpoint to get render access to original files stored in Wasabi
 * 
 * This endpoint provides access to original files with long expiration times
 * for render workflows.
 * 
 * @param request The incoming request with render API key
 * @param params The route parameters containing the fileId
 * @returns JSON response with signed URL for direct Wasabi access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    // Authenticate request
    const apiKey = request.headers.get('X-Render-API-Key');
    if (!apiKey || apiKey !== process.env.RENDER_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get file information
    const fileId = params.fileId;
    
    // Connect to database
    await connectToDatabase();
    
    const file = await File.findById(fileId);
    
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Ensure original file is archived in Wasabi
    if (!file.wasabiData?.originalKey) {
      return NextResponse.json(
        { error: 'Original file not available in archival storage' },
        { status: 400 }
      );
    }
    
    // Generate signed URL with long expiration (12 hours)
    const signedUrl = await wasabiStorage.getSignedReadUrl(
      file.wasabiData.originalKey,
      43200, // 12 hours
      false // Not forcing download
    );
    
    // Log render access for analytics (could be expanded)
    console.log(`Render access requested for file ${fileId} at ${new Date().toISOString()}`);
    
    return NextResponse.json({
      fileId: file._id.toString(),
      fileName: file.fileName,
      fileSize: file.fileSize,
      fileType: file.fileType,
      url: signedUrl,
      expiresIn: '12 hours'
    });
  } catch (error: any) {
    console.error('Error getting render access:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 