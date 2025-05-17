import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { File, UploadLink } from '@/utils/models';
import { createFolder, generateUploadLink } from '@/utils/frameioV4';

interface FrameIoUploadRequest {
  linkId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

/**
 * Generate a Frame.io upload URL for a file
 * 
 * POST /api/upload/frameio
 */
export async function POST(request: NextRequest) {
  try {
    const data: FrameIoUploadRequest = await request.json();
    
    if (!data.linkId || !data.fileName || !data.fileSize || !data.fileType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Get upload link details
    const uploadLink = await UploadLink.findOne({ linkId: data.linkId });
    
    if (!uploadLink) {
      return NextResponse.json(
        { error: 'Invalid upload link' },
        { status: 404 }
      );
    }
    
    if (!uploadLink.isActive) {
      return NextResponse.json(
        { error: 'Upload link is inactive' },
        { status: 403 }
      );
    }
    
    if (uploadLink.expiresAt && new Date(uploadLink.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Upload link has expired' },
        { status: 403 }
      );
    }
    
    // Check if we already have a Frame.io project folder for this client/project
    let projectFolderId = uploadLink.frameIoData?.projectFolderId;
    
    // If not, create a new project folder
    if (!projectFolderId) {
      const folderName = `${uploadLink.clientName} - ${uploadLink.projectName}`;
      
      // Use Root Project ID from environment variables as the parent folder
      const rootFolderId = process.env.FRAMEIO_ROOT_PROJECT_ID;
      if (!rootFolderId) {
        throw new Error('Frame.io root project ID not configured');
      }
      
      // Create project folder using V4 API
      const projectFolder = await createFolder(rootFolderId, folderName);
      projectFolderId = projectFolder.id;
      
      // Update the upload link with the project folder ID
      uploadLink.frameIoData = {
        ...uploadLink.frameIoData,
        projectFolderId,
      };
      
      await uploadLink.save();
    }
    
    // Generate a Frame.io upload link using V4 API
    const frameIoLink = await generateUploadLink(
      projectFolderId,
      data.fileName,
      data.fileSize,
      data.fileType
    );
    
    // Create a file record in our database
    const file = new File({
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileType: data.fileType,
      uploadedVia: uploadLink._id,
      clientName: uploadLink.clientName,
      projectName: uploadLink.projectName,
      status: 'uploading',
      frameIoData: {
        assetId: frameIoLink.asset_id,
        uploadUrl: frameIoLink.upload_url,
      },
    });
    
    await file.save();
    
    // Update upload link usage stats
    uploadLink.lastUsedAt = new Date();
    uploadLink.uploadCount = (uploadLink.uploadCount || 0) + 1;
    await uploadLink.save();
    
    return NextResponse.json({
      success: true,
      uploadUrl: frameIoLink.upload_url,
      assetId: frameIoLink.asset_id,
      fileId: file._id,
    });
  } catch (error: any) {
    console.error('Error generating Frame.io upload link:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload link', message: error.message },
      { status: 500 }
    );
  }
} 