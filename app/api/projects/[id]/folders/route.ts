import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { Project } from '@/utils/projectModels';
import mongoose from 'mongoose';
import { getUserIdFromRequest } from '@/utils/serverAuth';
import { createFrameIoFolderStructure, createR2FolderStructure, createLucidLinkFolderStructure } from '@/utils/projectManager';

export async function POST(
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
    
    // Find project
    const project = await Project.findOne(query);
    
    if (!project) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Parse request body to see which storage services to regenerate folders for
    const { services } = await request.json();
    
    // Default to all services if not specified
    const targetServices = services || ['frameio', 'r2', 'lucidlink'];
    
    // Initialize response object
    const response: any = {
      message: 'Folder structure generation initiated',
      services: {},
    };
    
    // Generate folder structure for each requested service
    for (const service of targetServices) {
      try {
        switch (service) {
          case 'frameio':
            const frameioRoot = process.env.FRAMEIO_ROOT_PROJECT_ID || '';
            const frameioStructure = await createFrameIoFolderStructure(project.projectId, frameioRoot);
            
            // Update project with new Frame.io folder structure
            await Project.updateOne(
              { _id: project._id },
              { 'folderStructure.frameio': frameioStructure }
            );
            
            response.services.frameio = { 
              success: true, 
              folderId: frameioStructure.folderId,
              path: frameioStructure.path 
            };
            break;
            
          case 'r2':
            const r2BasePath = createR2FolderStructure(project.projectId);
            
            // Update project with new R2 folder structure
            await Project.updateOne(
              { _id: project._id },
              { 'folderStructure.r2.basePath': r2BasePath }
            );
            
            response.services.r2 = { 
              success: true, 
              basePath: r2BasePath 
            };
            break;
            
          case 'lucidlink':
            const lucidlinkPath = await createLucidLinkFolderStructure(project.projectId);
            
            // Update project with new LucidLink folder structure
            await Project.updateOne(
              { _id: project._id },
              { 'folderStructure.lucidlink.path': lucidlinkPath }
            );
            
            response.services.lucidlink = { 
              success: true, 
              path: lucidlinkPath 
            };
            break;
            
          default:
            response.services[service] = { 
              success: false, 
              error: `Unknown service: ${service}` 
            };
        }
      } catch (error: any) {
        console.error(`Error creating folder structure for ${service}:`, error);
        response.services[service] = { 
          success: false, 
          error: error.message 
        };
      }
    }
    
    // Get updated project
    const updatedProject = await Project.findById(project._id);
    response.folderStructure = updatedProject?.folderStructure;
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error(`POST /api/projects/${id}/folders error:`, error);
    return NextResponse.json(
      { message: 'Error generating folder structure', error: error.message },
      { status: 500 }
    );
  }
}

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
    
    // Return folder structure
    return NextResponse.json({
      projectId: project.projectId,
      folderStructure: project.folderStructure,
      standardFolders: true, // Indicates these are standard folders
    });
  } catch (error: any) {
    console.error(`GET /api/projects/${id}/folders error:`, error);
    return NextResponse.json(
      { message: 'Error fetching folder structure', error: error.message },
      { status: 500 }
    );
  }
}
