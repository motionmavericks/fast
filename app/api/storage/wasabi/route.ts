// app/api/storage/wasabi/route.ts - API route for managing Wasabi storage operations

import { NextRequest, NextResponse } from 'next/server';
import * as integrationService from '@/utils/integrationService';
import * as wasabiService from '@/utils/wasabiService';
import { File } from '@/utils/models';

/**
 * GET handler to get a download URL for a file from Wasabi
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the user is authenticated
    // This is placeholder - implement your auth logic
    const isAuthenticated = true;
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get file ID from query parameters
    const url = new URL(request.url);
    const fileId = url.searchParams.get('fileId');
    const expiresIn = url.searchParams.get('expiresIn') ? 
      parseInt(url.searchParams.get('expiresIn')!) : 3600;

    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing file ID' },
        { status: 400 }
      );
    }

    // Get download URL
    const downloadUrl = await integrationService.getOriginalFileDownloadUrl(fileId, expiresIn);

    return NextResponse.json({
      success: true,
      downloadUrl,
    });
  } catch (error: any) {
    console.error('Error getting download URL from Wasabi:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST handler to archive a file to Wasabi
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the user is authenticated
    // This is placeholder - implement your auth logic
    const isAuthenticated = true;
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing file ID' },
        { status: 400 }
      );
    }

    // Get file information
    const file = await File.findById(fileId);
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Archive to Wasabi
    const result = await integrationService.archiveFileToWasabi(fileId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error archiving to Wasabi:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler to remove a file from Wasabi
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify the user is authenticated and has admin rights
    // This is placeholder - implement your auth logic
    const isAdmin = true;
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin rights required.' },
        { status: 401 }
      );
    }

    // Get file ID from query parameters
    const url = new URL(request.url);
    const fileId = url.searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing file ID' },
        { status: 400 }
      );
    }

    // Get file information
    const file = await File.findById(fileId);
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Check if file has been archived to Wasabi
    if (!file.wasabiData || !file.wasabiData.originalKey) {
      return NextResponse.json(
        { error: 'File not archived to Wasabi' },
        { status: 400 }
      );
    }

    // Delete original file
    const originalKey = file.wasabiData.originalKey;
    const originalDeleted = await wasabiService.deleteFile(originalKey);

    // Delete proxy files
    const proxyKeys = file.wasabiData.proxyKeys || [];
    const proxyDeleteResults = await Promise.all(
      proxyKeys.map(key => wasabiService.deleteFile(key))
    );

    // Update file record
    await File.findByIdAndUpdate(fileId, {
      $set: {
        'wasabiData.status': 'pending',
        'wasabiData.originalKey': null,
        'wasabiData.proxyKeys': [],
      }
    });

    return NextResponse.json({
      success: true,
      originalDeleted,
      proxyDeleted: proxyDeleteResults.every(Boolean),
    });
  } catch (error: any) {
    console.error('Error deleting file from Wasabi:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
