import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { UploadLink } from '@/utils/models';

// GET /api/links/[linkId]/validate - Validate link for public upload page
export async function GET(
  request: NextRequest,
  { params }: { params: { linkId: string } }
) {
  // Await params before destructuring
  const { linkId } = await params;
  
  console.log(`Validating link with ID: ${linkId}`);

  try {
    await dbConnect();

    // Find the link by linkId
    const link = await UploadLink.findOne({ linkId });

    // If no link found, return 404
    if (!link) {
      console.log(`No link found with ID: ${linkId}`);
      return NextResponse.json(
        { message: 'Upload link not found' },
        { status: 404 }
      );
    }
    
    console.log(`Found link: ${link._id}, Client: ${link.clientName}, Project: ${link.projectName}, Active: ${link.isActive}`);

    // Check if link is active
    if (!link.isActive) {
      console.log(`Link ${linkId} is inactive`);
      return NextResponse.json(
        { message: 'This upload link is no longer active' },
        { status: 403 }
      );
    }

    // Check if link has expired
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      console.log(`Link ${linkId} has expired on ${link.expiresAt}`);
      return NextResponse.json(
        { message: 'This upload link has expired' },
        { status: 403 }
      );
    }

    // Return minimal information needed for the upload page
    return NextResponse.json({
      _id: link._id,
      linkId: link.linkId,
      clientName: link.clientName,
      projectName: link.projectName,
      isActive: link.isActive,
      expiresAt: link.expiresAt,
    });
  } catch (error: any) {
    console.error('Error validating link:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}