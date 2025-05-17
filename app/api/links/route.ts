import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { nanoid } from 'nanoid'; // For generating unique link IDs
import { UploadLink, User } from '@/utils/models'; // Import the UploadLink and User models
import mongoose from 'mongoose';
// import { verifyAdminToken, getUserIdFromRequest } from '@/utils/serverAuth'; // TODO: Implement and use for auth

// TODO: Define Mongoose model for UploadLink if not already in utils/models.ts
// For now, let's assume a simple in-memory store for demonstration.
// Replace with actual database operations.
interface UploadLinkRecord {
  id: string; // nanoid
  clientName: string;
  projectName: string;
  notes?: string;
  expiresAt?: Date | null;
  createdAt: Date;
  isActive: boolean;
  uploadUrl: string;
  // createdBy: string; // Admin user ID
}
let linksStore: UploadLinkRecord[] = []; // Replace with DB

// GET /api/links - List all upload links (for admin)
export async function GET(request: Request) {
  // TODO: Authentication & Authorization - only admins
  // const { isValid, isAdmin } = await verifyAdminToken(request);
  // if (!isValid || !isAdmin) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }

  try {
    await dbConnect();
    const links = await UploadLink.find({}).sort({ createdAt: -1 }).populate('createdBy', 'email'); // Fetch from DB and populate creator's email
    return NextResponse.json(links, { status: 200 });
  } catch (error: any) {
    console.error('GET /api/links error:', error);
    return NextResponse.json({ message: 'Error fetching links', error: error.message }, { status: 500 });
  }
}

// POST /api/links - Create a new upload link (by admin)
export async function POST(request: Request) {
  // TODO: Authentication & Authorization - only admins
  // const { isValid, isAdmin, userId } = await getUserIdFromRequest(request); // Assumes this utility verifies and returns userId
  // if (!isValid || !isAdmin || !userId) {
  //   return NextResponse.json({ message: 'Unauthorized or user ID not found' }, { status: 401 });
  // }

  try {
    await dbConnect();
    
    // Find the first admin user to use as the creator
    const adminUser = await User.findOne({ role: { $in: ['admin', 'superadmin'] } });
    
    if (!adminUser) {
      return NextResponse.json({ message: 'No admin user found. Please set up an admin user first.' }, { status: 400 });
    }
    
    const { clientName, projectName, expiryDate, notes, createdBy } = await request.json();

    if (!clientName || !projectName) {
      return NextResponse.json({ message: 'Client name and project name are required' }, { status: 400 });
    }

    const linkId = nanoid(10); // Generate a 10-character unique ID
    
    const newLinkData = {
      linkId,
      clientName,
      projectName,
      notes,
      expiresAt: expiryDate ? new Date(expiryDate) : null,
      isActive: true,
      // Use the provided createdBy if it's a valid ObjectId, otherwise use the admin we found
      createdBy: createdBy && mongoose.Types.ObjectId.isValid(createdBy) ? createdBy : adminUser._id,
    };

    const createdLink = await UploadLink.create(newLinkData); // Save to DB

    return NextResponse.json(createdLink, { status: 201 });

  } catch (error: any) {
    console.error('POST /api/links error:', error);
    if (error.code === 11000) { // Duplicate key error for linkId
        return NextResponse.json({ message: 'Failed to generate a unique link ID. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Error creating link', error: error.message }, { status: 500 });
  }
}
