// app/api/webhooks/lucidlink/route.ts - API route for handling LucidLink operations

import { NextRequest, NextResponse } from 'next/server';
import * as lucidlink from '@/utils/lucidlink';
import { File } from '@/utils/models';

/**
 * POST handler for LucidLink operations
 * This endpoint is called by the Cloudflare worker when a high-quality proxy
 * is ready to be stored in LucidLink
 */
export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret
    const secret = request.headers.get('X-Worker-Secret');
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json();
    const { fileId, assetId, proxyUrl, proxyProfile } = body;
    
    if (!fileId || !proxyUrl || !proxyProfile) {
      return NextResponse.json(
        { error: 'Missing required parameters: fileId, proxyUrl, proxyProfile' },
        { status: 400 }
      );
    }
    
    // Get file details from database
    const file = await File.findById(fileId);
    if (!file) {
      return NextResponse.json(
        { error: `File not found: ${fileId}` },
        { status: 404 }
      );
    }
    
    // Check if LucidLink is enabled and available
    if (process.env.LUCIDLINK_ENABLED !== 'true') {
      return NextResponse.json(
        { message: 'LucidLink is not enabled' },
        { status: 200 }
      );
    }
    
    const lucidLinkAvailable = await lucidlink.isLucidLinkAvailable();
    if (!lucidLinkAvailable) {
      return NextResponse.json(
        { error: 'LucidLink is not available' },
        { status: 503 }
      );
    }
    
    // Prepare file name for LucidLink
    const fileNameWithoutExt = file.fileName.split('.').slice(0, -1).join('.');
    const proxyFileName = `${fileNameWithoutExt}_${proxyProfile}.mp4`;
    
    // Store in LucidLink
    const result = await lucidlink.storeFileFromUrl(
      proxyUrl,
      file.clientName,
      file.projectName,
      proxyFileName
    );
    
    if (!result.success) {
      return NextResponse.json(
        { error: `Failed to store file in LucidLink: ${result.error}` },
        { status: 500 }
      );
    }
    
    // Update file record
    await File.findByIdAndUpdate(fileId, {
      'lucidLinkData.path': result.path,
      'lucidLinkData.status': 'complete',
      'lucidLinkData.lastUpdated': new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: `Stored file in LucidLink: ${result.path}`,
      path: result.path
    });
  } catch (error: any) {
    console.error('Error handling LucidLink webhook:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
