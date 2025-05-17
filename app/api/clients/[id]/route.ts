import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { Client } from '@/utils/projectModels';
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
        { message: 'Invalid client ID format' },
        { status: 400 }
      );
    }
    
    // Find client
    const client = await Client.findById(id).populate('agency', 'name code');
    
    if (!client) {
      return NextResponse.json(
        { message: 'Client not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(client);
  } catch (error: any) {
    console.error(`GET /api/clients/${id} error:`, error);
    return NextResponse.json(
      { message: 'Error fetching client', error: error.message },
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
        { message: 'Invalid client ID format' },
        { status: 400 }
      );
    }
    
    // Parse request body
    const {
      name,
      agency,
      code,
      contactName,
      contactEmail,
      contactPhone,
      address,
      notes,
      isActive,
    } = await request.json();
    
    // Validate required fields
    if (!name || !code || !agency) {
      return NextResponse.json(
        { message: 'Client name, code, and agency are required' },
        { status: 400 }
      );
    }
    
    // Validate agency ID format
    if (!mongoose.Types.ObjectId.isValid(agency)) {
      return NextResponse.json(
        { message: 'Invalid agency ID format' },
        { status: 400 }
      );
    }
    
    // Find and update client
    const updatedClient = await Client.findByIdAndUpdate(
      id,
      {
        name,
        agency,
        code: code.toUpperCase(),
        contactName,
        contactEmail,
        contactPhone,
        address,
        notes,
        isActive,
      },
      { new: true, runValidators: true }
    ).populate('agency', 'name code');
    
    if (!updatedClient) {
      return NextResponse.json(
        { message: 'Client not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedClient);
  } catch (error: any) {
    console.error(`PUT /api/clients/${id} error:`, error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { message: 'Client with this code already exists for this agency' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { message: 'Error updating client', error: error.message },
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
        { message: 'Invalid client ID format' },
        { status: 400 }
      );
    }
    
    // Instead of deleting, set isActive to false
    const deactivatedClient = await Client.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!deactivatedClient) {
      return NextResponse.json(
        { message: 'Client not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: 'Client deactivated successfully' });
  } catch (error: any) {
    console.error(`DELETE /api/clients/${id} error:`, error);
    return NextResponse.json(
      { message: 'Error deactivating client', error: error.message },
      { status: 500 }
    );
  }
}
