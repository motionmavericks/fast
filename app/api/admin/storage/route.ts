import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { File } from '@/utils/models';
import mongoose from 'mongoose';

// Define the response structure
interface StorageData {
  totalBytes: number;
  storageByTier: {
    frameio: number;
    r2: number;
    lucidlink: number;
  };
  storageByClient: {
    clientName: string;
    bytes: number;
  }[];
  storageByProject: {
    projectName: string;
    clientName: string;
    bytes: number;
  }[];
  fileTypesDistribution: {
    type: string;
    count: number;
    bytes: number;
  }[];
  storageHistory: {
    date: string;
    frameio: number;
    r2: number;
    lucidlink: number;
  }[];
}

/**
 * Get storage usage data
 * GET /api/admin/storage
 */
export async function GET(request: Request) {
  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '7d';
  const clientFilter = searchParams.get('client');

  try {
    await dbConnect();

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'all':
      default:
        // For 'all', set to a very old date (e.g., 10 years ago)
        startDate.setFullYear(now.getFullYear() - 10);
        break;
    }

    // Base query to filter by date
    const baseQuery: any = {
      createdAt: { $gte: startDate }
    };

    // Add client filter if provided
    if (clientFilter) {
      baseQuery.clientName = clientFilter;
    }

    // Aggregate storage by tier
    const storageByTier = await File.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalBytes: { $sum: '$fileSize' },
          frameioBytes: {
            $sum: {
              $cond: [
                { $ne: [{ $ifNull: ['$frameIoData', null] }, null] },
                '$fileSize',
                0
              ]
            }
          },
          r2Bytes: {
            $sum: {
              $cond: [
                { $and: [
                  { $ne: [{ $ifNull: ['$frameIoData.proxies', null] }, null] },
                  { $gt: [{ $size: { $ifNull: ['$frameIoData.proxies', []] } }, 0] }
                ]},
                { $multiply: ['$fileSize', 0.3] }, // Estimate R2 storage as 30% of original size
                0
              ]
            }
          },
          lucidlinkBytes: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'completed'] },
                '$fileSize',
                0
              ]
            }
          }
        }
      }
    ]);

    // Aggregate storage by client
    const storageByClient = await File.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$clientName',
          bytes: { $sum: '$fileSize' }
        }
      },
      { $sort: { bytes: -1 } },
      {
        $project: {
          _id: 0,
          clientName: '$_id',
          bytes: 1
        }
      }
    ]);

    // Aggregate storage by project
    const storageByProject = await File.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            projectName: '$projectName',
            clientName: '$clientName'
          },
          bytes: { $sum: '$fileSize' }
        }
      },
      { $sort: { bytes: -1 } },
      {
        $project: {
          _id: 0,
          projectName: '$_id.projectName',
          clientName: '$_id.clientName',
          bytes: 1
        }
      }
    ]);

    // Aggregate file types distribution
    const fileTypesDistribution = await File.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$fileType',
          count: { $sum: 1 },
          bytes: { $sum: '$fileSize' }
        }
      },
      { $sort: { bytes: -1 } },
      {
        $project: {
          _id: 0,
          type: {
            $cond: {
              if: { $ne: ['$_id', null] },
              then: '$_id',
              else: 'unknown'
            }
          },
          count: 1,
          bytes: 1
        }
      }
    ]);

    // Generate storage history data
    // For this demo, we'll create simulated historical data
    // In a real implementation, you would query historical data from a time-series DB or logs
    const storageHistory = generateStorageHistory(period, storageByTier[0]);

    // Format the response
    const response: StorageData = {
      totalBytes: storageByTier.length > 0 ? storageByTier[0].totalBytes : 0,
      storageByTier: {
        frameio: storageByTier.length > 0 ? storageByTier[0].frameioBytes : 0,
        r2: storageByTier.length > 0 ? storageByTier[0].r2Bytes : 0,
        lucidlink: storageByTier.length > 0 ? storageByTier[0].lucidlinkBytes : 0
      },
      storageByClient,
      storageByProject,
      fileTypesDistribution,
      storageHistory
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching storage data:', error);
    return NextResponse.json(
      { message: 'Failed to fetch storage data', error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Generate simulated storage history data based on current storage values
 */
function generateStorageHistory(period: string, currentStorage: any): any[] {
  if (!currentStorage) {
    return [];
  }

  const { frameioBytes, r2Bytes, lucidlinkBytes } = currentStorage;
  const result = [];
  
  // Determine number of data points based on period
  let dataPoints = 7;
  switch(period) {
    case '7d': dataPoints = 7; break;
    case '30d': dataPoints = 10; break;
    case '90d': dataPoints = 12; break;
    case 'all': dataPoints = 15; break;
    default: dataPoints = 7;
  }
  
  // Generate data points with a realistic growth pattern
  const now = new Date();
  const decreaseFactor = 0.92; // Each historical point is ~92% of the previous one
  
  let currentFrameio = frameioBytes;
  let currentR2 = r2Bytes;
  let currentLucidlink = lucidlinkBytes;

  for (let i = 0; i < dataPoints; i++) {
    // Create date for this data point
    const historyDate = new Date(now);
    
    switch(period) {
      case '7d':
        historyDate.setDate(now.getDate() - i);
        break;
      case '30d':
        historyDate.setDate(now.getDate() - i * 3);
        break;
      case '90d':
        historyDate.setDate(now.getDate() - i * 7);
        break;
      case 'all':
        historyDate.setMonth(now.getMonth() - i);
        break;
    }
    
    // Format date
    const formattedDate = historyDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    
    // Add data point
    result.push({
      date: formattedDate,
      frameio: Math.round(currentFrameio),
      r2: Math.round(currentR2),
      lucidlink: Math.round(currentLucidlink)
    });
    
    // Calculate values for next historical point (going backwards in time)
    currentFrameio *= decreaseFactor;
    currentR2 *= decreaseFactor;
    currentLucidlink *= decreaseFactor;
    
    // Add some random variation
    currentFrameio *= (0.95 + Math.random() * 0.1);
    currentR2 *= (0.95 + Math.random() * 0.1);
    currentLucidlink *= (0.95 + Math.random() * 0.1);
  }
  
  // Return in chronological order (oldest first)
  return result.reverse();
}
