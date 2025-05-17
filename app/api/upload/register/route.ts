import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { UploadLink, File } from '@/utils/models';
import email from '@/utils/email';

/**
 * Register a file that was directly uploaded to Wasabi
 * POST /api/upload/register
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    
    // Extract required data
    const { 
      fileName, 
      fileSize, 
      fileType, 
      linkId, 
      storageKey, 
      clientName, 
      projectName 
    } = body;
    
    // Validate required fields
    if (!fileName || !fileSize || !fileType || !linkId || !storageKey) {
      return NextResponse.json(
        { message: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Find the upload link for validation
    const link = await UploadLink.findOne({ linkId });
    if (!link) {
      return NextResponse.json({ message: 'Invalid upload link' }, { status: 404 });
    }
    
    // For pre-signed URLs from batch cache, storageKey might need cleanup
    let finalStorageKey = storageKey;
    
    // If the storage key contains a complex pattern with the original filename, clean it
    // Example: uploads/linkId/abc123_placeholder_realfilename.mp4
    if (finalStorageKey.includes('_placeholder_')) {
      // Extract the base path and the filename
      const parts = finalStorageKey.split('_placeholder_');
      if (parts.length === 2) {
        finalStorageKey = `${parts[0]}/${parts[1]}`;
      }
    }
    
    // Create a File record with the storage information
    const fileRecord = await File.create({
      fileName,
      fileSize,
      fileType,
      uploadedVia: link._id,
      storageKey: finalStorageKey,
      clientName: clientName || link.clientName,
      projectName: projectName || link.projectName,
      status: 'completed', // File is successfully uploaded
    });
    
    // Update the link with new upload count and last used date
    await UploadLink.findByIdAndUpdate(link._id, {
      $inc: { uploadCount: 1 },
      lastUsedAt: new Date()
    });
    
    // Send email notification about the upload
    await email.sendUploadNotification({
      fileName,
      fileSize,
      clientName: link.clientName,
      projectName: link.projectName,
      uploadDate: new Date(),
      fileId: fileRecord._id.toString()
    });
    
    return NextResponse.json({
      message: 'File registered successfully',
      fileId: fileRecord._id.toString()
    });
  } catch (error: any) {
    console.error('Error registering file:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
} 