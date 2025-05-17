import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { Agency } from '@/utils/projectModels';
import { getUserIdFromRequest } from '@/utils/serverAuth';

export async function GET(request: Request) {
  try {
    await dbConnect();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    
    // Build query
    const query: any = {};
    if (isActive === 'true') {
      query.isActive = true;
    } else if (isActive === 'false') {
      query.isActive = false;
    }
    
    // Get agencies with optional filter
    const agencies = await Agency.find(query).sort({ name: 1 });
    
    return NextResponse.json(agencies);
  } catch (error: any) {
    console.error('GET /api/agencies error:', error);
    return NextResponse.json(
      { message: 'Error fetching agencies', error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    // Authenticate user (check admin permissions)
    const { userId, isAdmin } = await getUserIdFromRequest(request);
    
    if (!userId || !isAdmin) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const { name, code, contactName, contactEmail, contactPhone, address, notes } = await request.json();
    
    // Validate required fields
    if (!name || !code) {
      return NextResponse.json(
        { message: 'Agency name and code are required' },
        { status: 400 }
      );
    }
    
    // Create agency
    const agency = await Agency.create({
      name,
      code: code.toUpperCase(),
      contactName,
      contactEmail,
      contactPhone,
      address,
      notes,
      isActive: true,
      createdBy: userId,
    });
    
    return NextResponse.json(agency, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/agencies error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { message: 'Agency with this name or code already exists' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { message: 'Error creating agency', error: error.message },
      { status: 500 }
    );
  }
}
