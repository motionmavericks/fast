import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { Agency } from '@/utils/projectModels';
import mongoose from 'mongoose';
import { getUserIdFromRequest } from '@/utils/serverAuth';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  try {
    await dbConnect();
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { message: 'Invalid agency ID format' },
        { status: 400 }
      );
    }
    
    // Find agency
    const agency = await Agency.findById(id);
    
    if (!agency) {
      return NextResponse.json(
        { message: 'Agency not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(agency);
  } catch (error: any) {
    console.error(`GET /api/agencies/${id} error:`, error);
    return NextResponse.json(
      { message: 'Error fetching agency', error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  try {
    await dbConnect();
    
    // Authenticate user
    const { userId, isAdmin } = await getUserIdFromRequest(request);
    
    if (!userId || !isAdmin) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { message: 'Invalid agency ID format' },
        { status: 400 }
      );
    }
    
    // Parse request body
    const {
      name,
      code,
      contactName,
      contactEmail,
      contactPhone,
      address,
      notes,
      isActive,
    } = await request.json();
    
    // Validate required fields
    if (!name || !code) {
      return NextResponse.json(
        { message: 'Agency name and code are required' },
        { status: 400 }
      );
    }
    
    // Find and update agency
    const updatedAgency = await Agency.findByIdAndUpdate(
      id,
      {
        name,
        code: code.toUpperCase(),
        contactName,
        contactEmail,
        contactPhone,
        address,
        notes,
        isActive,
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedAgency) {
      return NextResponse.json(
        { message: 'Agency not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedAgency);
  } catch (error: any) {
    console.error(`PUT /api/agencies/${id} error:`, error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { message: 'Agency with this name or code already exists' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { message: 'Error updating agency', error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  try {
    await dbConnect();
    
    // Authenticate user
    const { userId, isAdmin } = await getUserIdFromRequest(request);
    
    if (!userId || !isAdmin) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { message: 'Invalid agency ID format' },
        { status: 400 }
      );
    }
    
    // Instead of deleting, set isActive to false
    const deactivatedAgency = await Agency.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!deactivatedAgency) {
      return NextResponse.json(
        { message: 'Agency not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: 'Agency deactivated successfully' });
  } catch (error: any) {
    console.error(`DELETE /api/agencies/${id} error:`, error);
    return NextResponse.json(
      { message: 'Error deactivating agency', error: error.message },
      { status: 500 }
    );
  }
}
