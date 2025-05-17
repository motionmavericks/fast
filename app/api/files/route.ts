import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { File } from '@/utils/models';
// import { verifyAdminToken } from '@/utils/serverAuth'; // TODO: Implement and use for auth

// GET /api/files - Get all uploaded files
export async function GET(request: NextRequest) {
  // TODO: Implement authentication
  // const { isValid, isAdmin } = await verifyAdminToken(request);
  // if (!isValid || !isAdmin) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }

  try {
    await dbConnect();

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const clientName = searchParams.get('client');
    const projectName = searchParams.get('project');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    // Build query based on parameters
    let query: any = {};
    if (clientName) query.clientName = { $regex: clientName, $options: 'i' };
    if (projectName) query.projectName = { $regex: projectName, $options: 'i' };
    if (status) query.status = status;

    // Get count for pagination
    const totalCount = await File.countDocuments(query);

    // Get files with pagination
    const files = await File.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Format date and file size for display
    const formattedFiles = files.map(file => {
      const { _id, fileName, fileSize, fileType, clientName, projectName, status, createdAt } = file;
      
      // Format file size
      let formattedSize: string;
      if (fileSize < 1024) {
        formattedSize = `${fileSize} B`;
      } else if (fileSize < 1024 * 1024) {
        formattedSize = `${(fileSize / 1024).toFixed(1)} KB`;
      } else if (fileSize < 1024 * 1024 * 1024) {
        formattedSize = `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
      } else {
        formattedSize = `${(fileSize / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      }
      
      // Format date
      const formattedDate = new Date(createdAt).toLocaleString();
      
      return {
        id: _id.toString(),
        fileName,
        fileSize: formattedSize,
        rawSize: fileSize,
        fileType,
        clientName,
        projectName,
        status,
        uploadDate: formattedDate,
        createdAt
      };
    });

    return NextResponse.json({
      files: formattedFiles,
      totalCount,
      page: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error: any) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}