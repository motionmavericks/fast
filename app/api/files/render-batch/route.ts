import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, File } from '../../../../utils/models';
import * as wasabiStorage from '../../../../utils/wasabiStorage';

/**
 * API endpoint to get render access to multiple original files stored in Wasabi
 * 
 * This endpoint provides optimized batch access to original files for render workflows.
 * 
 * @param request The incoming request with file IDs array
 * @returns JSON response with signed URLs for each requested file
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const apiKey = request.headers.get('X-Render-API-Key');
    if (!apiKey || apiKey !== process.env.RENDER_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get batch of file IDs
    const { fileIds } = await request.json();
    
    if (!fileIds || !Array.isArray(fileIds)) {
      return NextResponse.json(
        { error: 'File IDs array is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();
    
    // Generate URLs in parallel
    const results = await Promise.all(
      fileIds.map(async (fileId) => {
        try {
          const file = await File.findById(fileId);
          
          if (!file || !file.wasabiData?.originalKey) {
            return {
              fileId,
              error: 'File not found or not archived',
              success: false
            };
          }
          
          const signedUrl = await wasabiStorage.getSignedReadUrl(
            file.wasabiData.originalKey,
            43200, // 12 hours
            false
          );
          
          // Log render access
          console.log(`Batch render access for file ${fileId} at ${new Date().toISOString()}`);
          
          return {
            fileId: file._id.toString(),
            fileName: file.fileName,
            url: signedUrl,
            success: true
          };
        } catch (error) {
          return {
            fileId,
            error: 'Failed to generate URL',
            success: false
          };
        }
      })
    );
    
    return NextResponse.json({
      results,
      totalRequested: fileIds.length,
      totalSuccessful: results.filter(r => r.success).length
    });
  } catch (error: any) {
    console.error('Error processing batch render request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 