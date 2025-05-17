import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { UploadLink } from '@/utils/models';
import { createFrameIoUploadLink } from '@/utils/frameioServiceV4';

/**
 * Generate a Frame.io upload link for a specific upload link
 * POST /api/links/[linkId]/frameio
 */
export async function POST(
  request: Request,
  { params }: { params: { linkId: string } }
) {
  // Extract link ID from params
  const { linkId } = params;

  if (!linkId) {
    return NextResponse.json(
      { message: 'Link ID is required' },
      { status: 400 }
    );
  }

  try {
    // Connect to database
    await dbConnect();

    // Find the upload link
    const uploadLink = await UploadLink.findOne({ linkId }).populate('createdBy', 'email');

    if (!uploadLink) {
      return NextResponse.json(
        { message: 'Upload link not found' },
        { status: 404 }
      );
    }

    // Check if the link is active
    if (!uploadLink.isActive) {
      return NextResponse.json(
        { message: 'This upload link is inactive' },
        { status: 400 }
      );
    }

    // Parse request body
    const { fileName, fileSize, fileType } = await request.json();

    // Validate required fields
    if (!fileName) {
      return NextResponse.json(
        { message: 'File name is required' },
        { status: 400 }
      );
    }

    // Create a Frame.io upload link
    const frameIoData = await createFrameIoUploadLink(uploadLink, fileName, fileSize, fileType);

    // Update the link with Frame.io data if not already present
    if (!uploadLink.frameIoData || !uploadLink.frameIoData.projectId) {
      await UploadLink.findByIdAndUpdate(uploadLink._id, {
        frameIoData: {
          projectId: frameIoData.parentId,
          lastAssetId: frameIoData.assetId
        }
      });
    } else {
      // Just update the last asset ID
      await UploadLink.findByIdAndUpdate(uploadLink._id, {
        'frameIoData.lastAssetId': frameIoData.assetId
      });
    }

    return NextResponse.json({
      assetId: frameIoData.assetId,
      uploadUrl: frameIoData.uploadUrl,
      expiresAt: frameIoData.expiresAt
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error generating Frame.io upload link:', error);
    return NextResponse.json(
      { message: 'Failed to generate Frame.io upload link', error: error.message },
      { status: 500 }
    );
  }
}
