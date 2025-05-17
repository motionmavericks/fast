import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { UploadLink, File } from '@/utils/models';
import storage from '@/utils/storage';
import email from '@/utils/email';

// Define allowed file types
const ALLOWED_FILE_TYPES = [
  // Video
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg',
  // Image
  'image/jpeg', 'image/png', 'image/tiff',
  // Documents
  'application/pdf',
  // Archives
  'application/zip', 'application/x-rar-compressed',
  // Production specific
  'application/x-premiere-project', 'application/x-aftereffects-project',
  'application/octet-stream' // For various proprietary formats
];

// Define file size limits (100GB in bytes)
const MAX_FILE_SIZE = 100 * 1024 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Connect to database
    await dbConnect();

    // Parse the FormData
    const formData = await request.formData();
    
    // Extract linkId
    const linkId = formData.get('linkId') as string;
    if (!linkId) {
      return NextResponse.json({ message: 'Missing link ID' }, { status: 400 });
    }

    // Validate the link
    const link = await UploadLink.findOne({ linkId });
    if (!link) {
      return NextResponse.json({ message: 'Invalid upload link' }, { status: 404 });
    }

    if (!link.isActive) {
      return NextResponse.json({ message: 'Upload link is inactive' }, { status: 403 });
    }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return NextResponse.json({ message: 'Upload link has expired' }, { status: 403 });
    }

    // Extract file
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: 'File type not allowed' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: 'File size exceeds the maximum allowed (100GB)' },
        { status: 400 }
      );
    }

    // Set storage key for the file
    const storageKey = `uploads/${linkId}/${file.name}`;

    // Upload the file to storage (Wasabi)
    const uploadResult = await storage.uploadFile(file, storageKey);
    
    if (!uploadResult.success) {
      return NextResponse.json(
        { message: 'Failed to store file', error: uploadResult.error },
        { status: 500 }
      );
    }

    // Create a File record with the storage information
    const fileRecord = await File.create({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadedVia: link._id,
      storageKey: storageKey,
      clientName: link.clientName,
      projectName: link.projectName,
      status: 'completed', // File is successfully processed
    });

    // Update the link with new upload count and last used date
    await UploadLink.findByIdAndUpdate(link._id, {
      $inc: { uploadCount: 1 },
      lastUsedAt: new Date()
    });

    // Send email notification about the upload
    await email.sendUploadNotification({
      fileName: file.name,
      fileSize: file.size,
      clientName: link.clientName,
      projectName: link.projectName,
      uploadDate: new Date(),
      fileId: fileRecord._id.toString() // Send the file ID instead of a direct URL
    });

    return NextResponse.json(
      { message: 'File uploaded successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}