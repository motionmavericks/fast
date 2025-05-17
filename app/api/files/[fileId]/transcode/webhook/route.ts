import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { File } from '@/utils/models';

/**
 * POST /api/files/[fileId]/transcode/webhook
 * Receives webhook notifications from the Cloudflare Worker about transcoding status
 * 
 * Protected by API token
 * 
 * Body:
 * {
 *   jobId: string
 *   status: "completed" | "failed"
 *   qualities?: string[]
 *   error?: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    // Verify API token
    const token = request.nextUrl.searchParams.get('token');
    if (token !== process.env.API_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Get file ID from params
    const { fileId } = params;
    
    // Get request body
    const { jobId, status, qualities, error } = await request.json();
    
    // Find file in database
    const file = await File.findOne({ _id: fileId });
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    // Make sure the job ID matches
    if (!file.transcoding || file.transcoding.jobId !== jobId) {
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }
    
    // Update file transcoding status
    file.transcoding.status = status;
    
    if (status === 'completed') {
      file.transcoding.completedAt = new Date();
      file.transcoding.completedQualities = qualities;
      
      // Update available proxies
      file.proxies = qualities.map(quality => {
        return {
          quality,
          url: `${process.env.CLOUDFLARE_WORKER_URL}/proxy/${fileId}/${quality}.mp4`
        };
      });
      
      // Mark file as processed
      file.status = 'processed';
    } else if (status === 'failed') {
      file.transcoding.error = error;
      file.status = 'error';
    }
    
    // Save updated file
    await file.save();
    
    // For any completed transcoding, notify relevant users (project members, etc.)
    if (status === 'completed') {
      try {
        await notifyFileProcessed(file);
      } catch (notifyError) {
        console.error('Error sending processing notifications:', notifyError);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Transcoding status updated to ${status}`
    });
  } catch (error: any) {
    console.error('Error processing transcoding webhook:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

/**
 * Notify relevant users that a file has been processed
 */
async function notifyFileProcessed(file: any) {
  // Implementation depends on your notification system
  // This could send emails, push notifications, or update realtime database
  
  // Example: If the file belongs to a project, notify project members
  if (file.projectId) {
    // Get project and members
    const Project = require('@/utils/models').Project;
    const project = await Project.findOne({ _id: file.projectId });
    
    if (project) {
      // Notify project members
      // This could trigger emails, push notifications, etc.
      console.log(`File ${file._id} processed for project ${project.name}`);
    }
  }
} 