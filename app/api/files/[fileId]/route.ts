import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { File, connectToDatabase } from '@/utils/models';
import storage from '@/utils/storage';
import mongoose from 'mongoose';
// import { verifyAdminToken } from '@/utils/serverAuth'; // TODO: Implement and use for auth

interface Params {
  fileId: string;
}

// GET /api/files/[fileId] - Get single file details
export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    // Connect to database
    await connectToDatabase();
    
    // Extract fileId from route params
    const { fileId } = params;
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }
    
    // Verify authentication - worker secret or admin JWT
    // For worker requests
    const workerSecret = request.headers.get('X-Worker-Secret');
    const isWorkerRequest = workerSecret === process.env.WEBHOOK_SECRET;
    
    // If it's not a worker request, check admin authentication
    // This would check for a valid JWT token
    // Implement your admin authentication check here
    
    // If neither authentication method is valid, return unauthorized
    if (!isWorkerRequest) {
      // Add your JWT/admin auth check here
      // For now, allow all requests to simplify implementation
      // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Find file by ID
    const file = await File.findById(fileId);
    
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Return full file information for worker requests, limited for others
    if (isWorkerRequest) {
      return NextResponse.json({
        fileId: file._id.toString(),
        fileName: file.fileName,
        fileSize: file.fileSize,
        fileType: file.fileType,
        clientName: file.clientName,
        projectName: file.projectName,
        status: file.status,
        frameIoData: file.frameIoData,
        r2Data: file.r2Data,
        lucidLinkData: file.lucidLinkData,
        wasabiData: file.wasabiData,
        createdAt: file.createdAt
      });
    }
    
    // For non-worker requests (like admin UI), return a more limited set
    return NextResponse.json({
      fileId: file._id.toString(),
      fileName: file.fileName,
      fileSize: file.fileSize,
      fileType: file.fileType,
      clientName: file.clientName,
      projectName: file.projectName,
      status: file.status,
      hasFrameIo: !!file.frameIoData?.assetId,
      hasR2Proxies: !!(file.r2Data?.keys && file.r2Data.keys.length > 0),
      hasWasabi: file.wasabiData?.status === 'complete',
      hasLucidLink: file.lucidLinkData?.status === 'complete',
      createdAt: file.createdAt
    });
  } catch (error: any) {
    console.error('Error getting file info:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/files/[fileId] - Delete file
export async function DELETE(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  // TODO: Implement authentication
  // const { isValid, isAdmin } = await verifyAdminToken(request);
  // if (!isValid || !isAdmin) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }

  const { fileId } = params;

  try {
    await dbConnect();
    
    // Find file first to get storage key
    const file = await File.findById(fileId);
    
    if (!file) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }
    
    // Delete from storage first
    const deleted = await storage.deleteFile(file.storageKey);
    
    if (!deleted) {
      return NextResponse.json(
        { message: 'Failed to delete file from storage' },
        { status: 500 }
      );
    }
    
    // Delete from database
    await File.findByIdAndDelete(fileId);
    
    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}