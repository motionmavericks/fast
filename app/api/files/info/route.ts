// app/api/files/info/route.ts - Get file information by Frame.io assetId
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, File } from '../../../../utils/models';

/**
 * API route to get file information by Frame.io assetId
 * 
 * This endpoint is called by the Cloudflare Worker to retrieve MongoDB file ID
 * and other metadata when it receives a Frame.io webhook
 * 
 * @param request The incoming request with assetId query parameter
 * @returns JSON response with file details
 */
export async function GET(request: NextRequest) {
  try {
    // Get assetId from query parameters
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');
    
    // Validate webhook secret
    const secret = request.headers.get('X-Worker-Secret');
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    // Connect to database
    await connectToDatabase();
    
    // Find file by Frame.io assetId
    const file = await File.findOne({ 'frameIoData.assetId': assetId });
    
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Return relevant file information
    return NextResponse.json({
      fileId: file._id.toString(),
      fileName: file.fileName,
      clientName: file.clientName,
      projectName: file.projectName,
      frameIoData: file.frameIoData
    });
  } catch (error: any) {
    console.error('Error getting file info:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 