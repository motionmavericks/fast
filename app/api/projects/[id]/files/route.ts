import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { Project, ProjectFile } from '@/utils/projectModels';
import mongoose from 'mongoose';
import { getUserIdFromRequest } from '@/utils/serverAuth';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  try {
    await dbConnect();
    
    // Handle both MongoDB IDs and project IDs (MM-xxx)
    const query = mongoose.Types.ObjectId.isValid(id) 
      ? { _id: id }
      : { projectId: id };
    
    // Find project
    const project = await Project.findOne(query);
    
    if (!project) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    
    // Build query for project files
    const fileQuery: any = { project: project._id };
    
    if (status && ['uploading', 'processing', 'available', 'failed', 'archived'].includes(status)) {
      fileQuery.status = status;
    }
    
    // Count total files
    const totalFiles = await ProjectFile.countDocuments(fileQuery);
    
    // Get files with pagination
    const files = await ProjectFile.find(fileQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('uploadedBy', 'email');
    
    return NextResponse.json({
      files,
      pagination: {
        total: totalFiles,
        page,
        limit,
        pages: Math.ceil(totalFiles / limit),
      },
    });
  } catch (error: any) {
    console.error(`GET /api/projects/${id}/files error:`, error);
    return NextResponse.json(
      { message: 'Error fetching project files', error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  try {
    await dbConnect();
    
    // Authenticate user
    const { userId, isAdmin } = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Handle both MongoDB IDs and project IDs (MM-xxx)
    const query = mongoose.Types.ObjectId.isValid(id) 
      ? { _id: id }
      : { projectId: id };
    
    // Find project
    const project = await Project.findOne(query);
    
    if (!project) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Parse request body
    const {
      fileName,
      fileSize,
      fileType,
      originalPath,
      relativePath,
      storageLocations,
      status,
      version,
      tags,
      metadata,
      notes,
    } = await request.json();
    
    // Validate required fields
    if (!fileName || !fileSize || !fileType || !originalPath || !relativePath) {
      return NextResponse.json(
        { message: 'Required fields missing' },
        { status: 400 }
      );
    }
    
    // Create project file
    const projectFile = await ProjectFile.create({
      project: project._id,
      fileName,
      fileSize,
      fileType,
      originalPath,
      relativePath,
      uploadedBy: userId,
      storageLocations: storageLocations || {
        frameio: { status: 'pending' },
        r2: { status: 'pending' },
        lucidlink: { status: 'pending' },
      },
      status: status || 'uploading',
      version: version || 1,
      tags: tags || [],
      metadata: metadata || {},
      notes: notes || '',
    });
    
    // Update project lastActivityAt
    await Project.findByIdAndUpdate(project._id, {
      lastActivityAt: new Date(),
    });
    
    return NextResponse.json(projectFile, { status: 201 });
  } catch (error: any) {
    console.error(`POST /api/projects/${id}/files error:`, error);
    return NextResponse.json(
      { message: 'Error creating project file', error: error.message },
      { status: 500 }
    );
  }
}
