import { NextRequest, NextResponse } from 'next/server';
import * as wasabiStorage from '../../../../../utils/wasabiStorage';
import * as frameio from '../../../../../utils/frameio';
import { connectToDatabase, File } from '../../../../../utils/models';

/**
 * API route to archive an original file from Frame.io to Wasabi
 * 
 * This endpoint is called by the Cloudflare Worker to move original files
 * from Frame.io to long-term archival storage in Wasabi
 * 
 * @param request The incoming request with original file info
 * @returns JSON response with archive status
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
    
    if (!data.fileId || !data.assetId) {
      return NextResponse.json(
        { error: 'Missing required fields: fileId and assetId' },
        { status: 400 }
      );
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
    
    // Get the original file download URL from Frame.io
    const token = await frameio.getFrameIoToken();
    const assetDetails = await frameio.getAssetDetails(data.assetId);
    
    if (!assetDetails) {
      return NextResponse.json(
        { error: `Asset not found in Frame.io: ${data.assetId}` },
        { status: 404 }
      );
    }
    
    // Ensure this is a completed upload
    if (assetDetails.status !== 'complete') {
      return NextResponse.json(
        { error: `Asset not ready for archival. Status: ${assetDetails.status}` },
        { status: 400 }
      );
    }
    
    // Generate a download URL for the original file
    const response = await fetch(`https://api.frame.io/v2/assets/${data.assetId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to get download URL: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const downloadData = await response.json();
    
    if (!downloadData.download_url) {
      return NextResponse.json(
        { error: 'No download URL available for this asset' },
        { status: 400 }
      );
    }
    
    // Define the Wasabi key for the original file
    const wasabiKey = `originals/${file.clientName}/${file.projectName}/${file._id}/${file.fileName}`;
    
    // Start the archival process in the background
    // This uses the utility to fetch the file from Frame.io and upload to Wasabi
    try {
      console.log(`Starting archival of original file: ${file.fileName} to Wasabi: ${wasabiKey}`);
      
      // Update file status to indicate archiving is in progress
      file.wasabiData = {
        ...file.wasabiData,
        status: 'processing',
        originalKey: wasabiKey
      };
      await file.save();
      
      // Use the Wasabi storage utility to copy from URL to Wasabi
      const result = await wasabiStorage.uploadFromUrl(
        downloadData.download_url,
        wasabiKey,
        file.fileType
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error uploading to Wasabi');
      }
      
      // Update file record with successful archival info
      file.wasabiData = {
        ...file.wasabiData,
        status: 'complete',
        originalKey: wasabiKey,
        archivedAt: new Date()
      };
      await file.save();
      
      console.log(`Successfully archived original file to Wasabi: ${wasabiKey}`);
      
      return NextResponse.json({
        success: true,
        message: 'Original file archived to Wasabi',
        fileId: file._id,
        wasabiKey
      });
    } catch (archiveError: any) {
      console.error('Error during archival process:', archiveError);
      
      // Update file to reflect the error
      file.wasabiData = {
        ...file.wasabiData,
        status: 'error'
      };
      await file.save();
      
      return NextResponse.json(
        { error: `Archival process failed: ${archiveError.message}` },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('Error archiving original file to Wasabi:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 