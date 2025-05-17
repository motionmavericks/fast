import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { Project } from '@/utils/projectModels';
import mongoose from 'mongoose';
import { getUserIdFromRequest } from '@/utils/serverAuth';
import { createProjectFolderStructure } from '@/utils/projectManager';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  try {
    await dbConnect();
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id) && !id.startsWith('MM-')) {
      return NextResponse.json(
        { message: 'Invalid project ID format' },
        { status: 400 }
      );
    }
    
    // Find project by ID or projectId
    const query = mongoose.Types.ObjectId.isValid(id) 
      ? { _id: id }
      : { projectId: id };
    
    const project = await Project.findOne(query)
      .populate({
        path: 'client',
        select: 'name code',
        populate: {
          path: 'agency',
          select: 'name code'
        }
      })
      .populate('createdBy', 'email');
    
    if (!project) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(project);
  } catch (error: any) {
    console.error(`GET /api/projects/${id} error:`, error);
    return NextResponse.json(
      { message: 'Error fetching project', error: error.message },
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
    
    // Handle both MongoDB IDs and project IDs (MM-xxx)
    const query = mongoose.Types.ObjectId.isValid(id) 
      ? { _id: id }
      : { projectId: id };
    
    // Parse request body
    const {
      name,
      description,
      startDate,
      endDate,
      status,
      notes,
      settings,
      isActive,
    } = await request.json();
    
    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { message: 'Project name is required' },
        { status: 400 }
      );
    }
    
    // Find and update project
    const updatedProject = await Project.findOneAndUpdate(
      query,
      {
        name,
        description,
        startDate,
        endDate,
        status,
        notes,
        settings,
        isActive,
        lastActivityAt: new Date(),
      },
      { new: true, runValidators: true }
    )
    .populate({
      path: 'client',
      select: 'name code',
      populate: {
        path: 'agency',
        select: 'name code'
      }
    })
    .populate('createdBy', 'email');
    
    if (!updatedProject) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedProject);
  } catch (error: any) {
    console.error(`PUT /api/projects/${id} error:`, error);
    return NextResponse.json(
      { message: 'Error updating project', error: error.message },
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
    
    // Handle both MongoDB IDs and project IDs (MM-xxx)
    const query = mongoose.Types.ObjectId.isValid(id) 
      ? { _id: id }
      : { projectId: id };
    
    // Instead of deleting, set isActive to false and status to archived
    const archivedProject = await Project.findOneAndUpdate(
      query,
      { 
        isActive: false,
        status: 'archived',
        lastActivityAt: new Date(),
      },
      { new: true }
    );
    
    if (!archivedProject) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: 'Project archived successfully' });
  } catch (error: any) {
    console.error(`DELETE /api/projects/${id} error:`, error);
    return NextResponse.json(
      { message: 'Error archiving project', error: error.message },
      { status: 500 }
    );
  }
}
