// app/api/tasks/archive-to-wasabi/route.ts - Schedule archiving of files to Wasabi

import { NextRequest, NextResponse } from 'next/server';
import * as wasabiService from '@/utils/wasabiService';

/**
 * POST handler to schedule archival of files to Wasabi
 * This endpoint would typically be called by a cron job
 */
export async function POST(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get request body
    const body = await request.json();
    const daysThreshold = body.daysThreshold || 1; // Default to 1 day
    
    // Schedule archival
    const archivedFiles = await wasabiService.scheduleFileArchival(daysThreshold);
    
    return NextResponse.json({
      success: true,
      message: `Scheduled archival of ${archivedFiles} files to Wasabi.`,
      archivedFiles
    });
  } catch (error: any) {
    console.error('Error scheduling Wasabi archival:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
