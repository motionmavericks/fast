import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { File, UploadLink } from '@/utils/models';
import { verifyAuth } from '@/utils/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAuth(request);
    if (!authResult.isAuthenticated) {
      return NextResponse.json(
        { message: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // Connect to database
    await dbConnect();

    // Get total uploads and size
    const totalUploadsPromise = File.countDocuments();
    const totalSizePromise = File.aggregate([
      { $group: { _id: null, total: { $sum: "$fileSize" } } }
    ]);

    // Get active links count
    const activeLinksPromise = UploadLink.countDocuments({ isActive: true });

    // Get pending uploads count
    const pendingUploadsPromise = File.countDocuments({ status: { $ne: 'completed' } });

    // Get recent uploads
    const recentUploadsPromise = File.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('fileName fileSize clientName projectName createdAt status')
      .lean();

    // Wait for all queries to complete
    const [totalUploads, totalSizeResult, activeLinks, pendingUploads, recentUploads] = await Promise.all([
      totalUploadsPromise,
      totalSizePromise,
      activeLinksPromise,
      pendingUploadsPromise,
      recentUploadsPromise
    ]);

    // Format recent uploads
    const formattedRecentUploads = recentUploads.map(upload => ({
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      clientName: upload.clientName,
      projectName: upload.projectName,
      uploadDate: upload.createdAt,
      status: upload.status
    }));

    // Return dashboard stats
    return NextResponse.json({
      totalUploads,
      totalSize: totalSizeResult.length > 0 ? totalSizeResult[0].total : 0,
      activeLinks,
      pendingUploads,
      recentUploads: formattedRecentUploads
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { message: 'Failed to fetch statistics', error: error.message },
      { status: 500 }
    );
  }
}
