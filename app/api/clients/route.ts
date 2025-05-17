import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { Client } from '@/utils/projectModels';
import { getUserIdFromRequest } from '@/utils/serverAuth';
import mongoose from 'mongoose';

export async function GET(request: Request) {
  try {
    await dbConnect();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const agencyId = searchParams.get('agency');
    
    // Build query
    const query: any = {};
    if (isActive === 'true') {
      query.isActive = true;
    } else if (isActive === 'false') {
      query.isActive = false;
    }
    
    if (agencyId && mongoose.Types.ObjectId.isValid(agencyId)) {
      query.agency = agencyId;
    }
    
    // Get clients with optional filters
    const clients = await Client.find(query)
      .populate('agency', 'name code')
      .sort({ name: 1 });
    
    return NextResponse.json(clients);
  } catch (error: any) {
    console.error('GET /api/clients error:', error);
    return NextResponse.json(
      { message: 'Error fetching clients', error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
    
    // Create client
    const client = await Client.create({
      name,
      agency,
      code: code.toUpperCase(),
      contactName,
      contactEmail,
      contactPhone,
      address,
      notes,
      isActive: true,
      createdBy: userId,
    });
    
    // Populate the agency reference
    await client.populate('agency', 'name code');
    
    return NextResponse.json(client, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/clients error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { message: 'Client with this code already exists for this agency' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { message: 'Error creating client', error: error.message },
      { status: 500 }
    );
  }
}
