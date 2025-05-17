import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { UploadLink } from '@/utils/models';
// import { verifyAdminToken } from '@/utils/serverAuth'; // TODO: Implement and use for auth

interface Params {
  linkId: string;
}

// PUT /api/links/[linkId] - Update a specific link (e.g., toggle active status)
export async function PUT(request: Request, { params }: { params: Params }) {
  // TODO: Authentication & Authorization - only admins
  // const auth = await verifyAdminToken(request);
  // if (!auth.isValid || !auth.isAdmin) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }

  const { linkId } = await params;

  try {
    await dbConnect();
    const { isActive } = await request.json(); // Expecting { isActive: boolean }

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ message: 'Invalid payload: isActive (boolean) is required.' }, { status: 400 });
    }

    console.log(`Attempting to update link with linkId: ${linkId}, setting isActive to: ${isActive}`);

    const updatedLink = await UploadLink.findOneAndUpdate(
      { linkId }, // Find by our custom linkId field
      { isActive },
      { new: true } // Return the updated document
    );

    if (!updatedLink) {
      console.log(`Link not found with linkId: ${linkId}`);
      return NextResponse.json({ message: 'Upload link not found' }, { status: 404 });
    }

    console.log(`Successfully updated link: ${updatedLink._id}`);
    return NextResponse.json(updatedLink, { status: 200 });
  } catch (error: any) {
    console.error(`PUT /api/links/${linkId} error:`, error);
    return NextResponse.json({ message: 'Error updating link', error: error.message }, { status: 500 });
  }
}

// DELETE /api/links/[linkId] - Delete a specific link
export async function DELETE(request: Request, { params }: { params: Params }) {
  // TODO: Authentication & Authorization - only admins
  // const auth = await verifyAdminToken(request);
  // if (!auth.isValid || !auth.isAdmin) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }
  
  const { linkId } = await params;

  try {
    await dbConnect();
    console.log(`Attempting to delete link with linkId: ${linkId}`);
    
    const deletedLink = await UploadLink.findOneAndDelete({ linkId });

    if (!deletedLink) {
      console.log(`Link not found with linkId: ${linkId}`);
      return NextResponse.json({ message: 'Upload link not found' }, { status: 404 });
    }

    console.log(`Successfully deleted link: ${deletedLink._id}`);
    return NextResponse.json({ message: 'Upload link deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error(`DELETE /api/links/${linkId} error:`, error);
    return NextResponse.json({ message: 'Error deleting link', error: error.message }, { status: 500 });
  }
} 