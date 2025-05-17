import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { File } from '@/utils/models';
import storage from '@/utils/storage';
// import { verifyAdminToken } from '@/utils/serverAuth'; // TODO: Implement and use for auth

interface BulkActionRequest {
  action: 'delete' | 'download' | 'status-update';
  fileIds: string[];
  newStatus?: 'processing' | 'completed' | 'failed'; // For status-update action
}

// POST /api/files/bulk - Handle bulk operations on files
export async function POST(request: NextRequest) {
  // TODO: Implement authentication
  // const { isValid, isAdmin } = await verifyAdminToken(request);
  // if (!isValid || !isAdmin) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }

  try {
    // Parse the request body
    const body: BulkActionRequest = await request.json();
    
    // Validate request
    if (!body || !body.action || !Array.isArray(body.fileIds) || body.fileIds.length === 0) {
      return NextResponse.json(
        { message: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Handle different bulk actions
    switch (body.action) {
      case 'delete':
        return await handleBulkDelete(body.fileIds);
      case 'download':
        return await handleBulkDownload(body.fileIds);
      case 'status-update':
        if (!body.newStatus) {
          return NextResponse.json(
            { message: 'Missing newStatus parameter for status-update action' },
            { status: 400 }
          );
        }
        return await handleBulkStatusUpdate(body.fileIds, body.newStatus);
      default:
        return NextResponse.json(
          { message: 'Unsupported action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error processing bulk action:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle bulk deletion of files
 * @param fileIds Array of file IDs to delete
 */
async function handleBulkDelete(fileIds: string[]) {
  try {
    const results = {
      success: [] as string[],
      failed: [] as { id: string; reason: string }[]
    };
    
    // Process each file
    for (const fileId of fileIds) {
      try {
        // Find file first to get storage key
        const file = await File.findById(fileId);
        
        if (!file) {
          results.failed.push({ id: fileId, reason: 'File not found' });
          continue;
        }
        
        // Delete from storage first
        const deleted = await storage.deleteFile(file.storageKey);
        
        if (!deleted) {
          results.failed.push({ id: fileId, reason: 'Failed to delete from storage' });
          continue;
        }
        
        // Delete from database
        await File.findByIdAndDelete(fileId);
        results.success.push(fileId);
      } catch (error: any) {
        results.failed.push({ id: fileId, reason: error.message || 'Unknown error' });
      }
    }
    
    return NextResponse.json({
      message: `Deleted ${results.success.length} of ${fileIds.length} files`,
      results
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to process bulk delete', error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle bulk download preparation (generate URLs for multiple files)
 * @param fileIds Array of file IDs to prepare for download
 */
async function handleBulkDownload(fileIds: string[]) {
  try {
    const results = {
      urls: [] as { id: string; fileName: string; url: string }[],
      failed: [] as { id: string; reason: string }[]
    };
    
    // Process each file
    for (const fileId of fileIds) {
      try {
        // Find file to get storage key
        const file = await File.findById(fileId);
        
        if (!file) {
          results.failed.push({ id: fileId, reason: 'File not found' });
          continue;
        }
        
        // Skip files that aren't completed
        if (file.status !== 'completed') {
          results.failed.push({ id: fileId, reason: 'File not available for download (not completed)' });
          continue;
        }
        
        // Generate a fresh download URL
        const downloadUrl = await storage.getDownloadUrl(file.storageKey, 60); // 60 minute expiry
        
        results.urls.push({
          id: fileId,
          fileName: file.fileName,
          url: downloadUrl
        });
      } catch (error: any) {
        results.failed.push({ id: fileId, reason: error.message || 'Unknown error' });
      }
    }
    
    return NextResponse.json({
      message: `Generated download URLs for ${results.urls.length} of ${fileIds.length} files`,
      results
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to process bulk download', error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle bulk status updates for files
 * @param fileIds Array of file IDs to update
 * @param newStatus The new status to set
 */
async function handleBulkStatusUpdate(fileIds: string[], newStatus: 'processing' | 'completed' | 'failed') {
  try {
    const results = {
      success: [] as string[],
      failed: [] as { id: string; reason: string }[]
    };
    
    // Process each file
    for (const fileId of fileIds) {
      try {
        // Update the file status
        const result = await File.updateOne(
          { _id: fileId },
          { $set: { status: newStatus } }
        );
        
        if (result.modifiedCount === 0) {
          results.failed.push({ id: fileId, reason: 'File not found or status not changed' });
          continue;
        }
        
        results.success.push(fileId);
      } catch (error: any) {
        results.failed.push({ id: fileId, reason: error.message || 'Unknown error' });
      }
    }
    
    return NextResponse.json({
      message: `Updated status of ${results.success.length} of ${fileIds.length} files to "${newStatus}"`,
      results
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to update file statuses', error: error.message },
      { status: 500 }
    );
  }
} 