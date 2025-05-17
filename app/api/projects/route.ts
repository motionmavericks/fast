import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { Project, Client, Agency } from '@/utils/projectModels';
import { getUserIdFromRequest } from '@/utils/serverAuth';
import mongoose from 'mongoose';
import { generateProjectId, createProjectFolderStructure } from '@/utils/projectManager';

export async function GET(request: Request) {
  try {
    await dbConnect();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const client = searchParams.get('client');
    const isActive = searchParams.get('isActive');
    
    // Build query
    const query: any = {};
    
    if (status && ['planning', 'active', 'completed', 'archived'].includes(status)) {
      query.status = status;
    }
    
    if (client && mongoose.Types.ObjectId.isValid(client)) {
      query.client = client;
    }
    
    if (isActive === 'true') {
      query.isActive = true;
    } else if (isActive === 'false') {
      query.isActive = false;
    }
    
    // Get projects with optional filters
    const projects = await Project.find(query)
      .populate({
        path: 'client',
        select: 'name code',
        populate: {
          path: 'agency',
          select: 'name code'
        }
      })
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 });
    
    return NextResponse.json(projects);
  } catch (error: any) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json(
      { message: 'Error fetching projects', error: error.message },
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
      client: clientId,
      description,
      startDate,
      endDate,
      status,
      notes,
      settings,
    } = await request.json();
    
    // Validate required fields
    if (!name || !clientId) {
      return NextResponse.json(
        { message: 'Project name and client are required' },
        { status: 400 }
      );
    }
    
    // Validate client ID format
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return NextResponse.json(
        { message: 'Invalid client ID format' },
        { status: 400 }
      );
    }
    
    // Get client with agency for project ID generation
    const client = await Client.findById(clientId).populate('agency');
    
    if (!client) {
      return NextResponse.json(
        { message: 'Client not found' },
        { status: 404 }
      );
    }
    
    // Generate project ID
    const projectId = await generateProjectId(client.agency as any, client);
    
    // Create project with minimal data first
    const project = await Project.create({
      projectId,
      name,
      client: clientId,
      description,
      startDate: startDate || new Date(),
      endDate: endDate || null,
      status: status || 'planning',
      notes,
      settings: settings || {
        allowClientAccess: true,
        autoCreateProxies: true,
        defaultStorageTier: 'all',
      },
      isActive: true,
      createdBy: userId,
      lastActivityAt: new Date(),
      // Initialize folder structure as empty - will be populated later
      folderStructure: {
        frameio: { folderId: '', path: '' },
        r2: { basePath: '' },
        lucidlink: { path: '' },
      },
    });
    
    // Now create folder structures across all systems
    try {
      const folderStructure = await createProjectFolderStructure(project);
      
      // Update project with folder structure
      await Project.findByIdAndUpdate(project._id, {
        folderStructure,
      });
      
      // Reload project with populated references
      const populatedProject = await Project.findById(project._id)
        .populate({
          path: 'client',
          select: 'name code',
          populate: {
            path: 'agency',
            select: 'name code'
          }
        })
        .populate('createdBy', 'email');
      
      return NextResponse.json(populatedProject, { status: 201 });
    } catch (folderError: any) {
      // If folder creation fails, still return the project but with an error message
      console.error('Error creating project folders:', folderError);
      
      const populatedProject = await Project.findById(project._id)
        .populate({
          path: 'client',
          select: 'name code',
          populate: {
            path: 'agency',
            select: 'name code'
          }
        })
        .populate('createdBy', 'email');
      
      return NextResponse.json({
        project: populatedProject,
        warning: 'Project created but folder structure creation failed. Please try regenerating folders.',
        error: folderError.message,
      }, { status: 201 });
    }
  } catch (error: any) {
    console.error('POST /api/projects error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { message: 'Project with this ID already exists' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { message: 'Error creating project', error: error.message },
      { status: 500 }
    );
  }
}
