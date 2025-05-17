import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, File } from '../../../../../utils/models';

/**
 * API endpoint to store a file in LucidLink via the LucidLink server
 * 
 * This endpoint is called by the Cloudflare Worker to copy high-quality proxies
 * to the LucidLink filesystem for post-production access
 * 
 * @param request The incoming request with file info
 * @returns JSON response with storage status
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the worker secret for authentication
    const workerSecret = request.headers.get('x-worker-secret');
    if (!workerSecret || workerSecret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract the data from request
    const data = await request.json();
    
    if (!data.fileId || !data.proxyUrl || !data.proxyProfile) {
      return NextResponse.json(
        { error: 'Missing required fields: fileId, proxyUrl, proxyProfile' },
        { status: 400 }
      );
    }
    
    // Check if LucidLink integration is enabled
    if (process.env.LUCIDLINK_ENABLED !== 'true') {
      return NextResponse.json({
        success: false,
        message: 'LucidLink integration is not enabled'
      });
    }
    
    // Connect to database
    await connectToDatabase();
    
    // Get the file from database
    const file = await File.findById(data.fileId);
    if (!file) {
      return NextResponse.json(
        { error: `File not found with ID: ${data.fileId}` },
        { status: 404 }
      );
    }
    
    // Make request to LucidLink server
    try {
      // Update file status to indicate processing
      file.lucidLinkData = {
        ...file.lucidLinkData,
        status: 'processing'
      };
      await file.save();
      
      // Get the server URL and API token from environment
      const serverUrl = process.env.LUCIDLINK_SERVER_URL;
      const apiToken = process.env.LUCIDLINK_API_TOKEN;
      
      if (!serverUrl || !apiToken) {
        throw new Error('LucidLink server configuration missing');
      }
      
      // Create destination path
      const filename = `${file._id}_${data.proxyProfile}.mp4`;
      
      // Make API request to the LucidLink server
      const response = await fetch(`${serverUrl}/api/files/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({
          sourceUrl: data.proxyUrl,
          clientName: file.clientName,
          projectName: file.projectName,
          fileName: filename
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`LucidLink server error: ${errorData.error || response.statusText}`);
      }
      
      const result = await response.json();
      
      // Update file record with successful path info
      file.lucidLinkData = {
        path: result.path,
        status: 'complete'
      };
      await file.save();
      
      console.log(`Successfully stored file in LucidLink: ${result.path}`);
      
      return NextResponse.json({
        success: true,
        message: 'File stored in LucidLink',
        fileId: file._id,
        path: result.path
      });
    } catch (lucidLinkError: any) {
      console.error('Error storing file in LucidLink:', lucidLinkError);
      
      // Update file to reflect the error
      file.lucidLinkData = {
        ...file.lucidLinkData,
        status: 'error'
      };
      await file.save();
      
      return NextResponse.json(
        { error: `LucidLink storage failed: ${lucidLinkError.message}` },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('Error storing file in LucidLink:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 