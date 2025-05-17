// app/api/storage/wasabi/store/route.ts - Store a file in Wasabi
import { NextRequest, NextResponse } from 'next/server';
import * as wasabiService from '@/utils/wasabiService';
import { File } from '@/utils/models';

export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret
    const secret = request.headers.get('X-Worker-Secret');
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get request body
    const body = await request.json();
    const { fileId, assetId, proxyUrl, proxyProfile } = body;
    
    if (!fileId || !proxyUrl || !proxyProfile) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Find file
    const file = await File.findById(fileId);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Store proxy in Wasabi
    const result = await wasabiService.uploadProxyToWasabi(
      fileId,
      proxyUrl,
      proxyProfile,
      file.fileName,
      file.clientName,
      file.projectName
    );
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    
    // Update file record with Wasabi data
    const wasabiData = file.wasabiData || {};
    const proxies = wasabiData.proxies || [];
    
    // Add the new proxy if not already present
    if (!proxies.some(p => p.profile === proxyProfile)) {
      proxies.push({
        profile: proxyProfile,
        wasabiKey: result.wasabiKey,
        uploadedAt: new Date()
      });
    }
    
    // Update the file record
    await File.findByIdAndUpdate(fileId, {
      wasabiData: {
        ...wasabiData,
        proxies,
        status: 'complete',
        lastUpdated: new Date()
      }
    });
    
    return NextResponse.json({
      success: true,
      message: `Stored ${proxyProfile} in Wasabi for file ${fileId}`,
      wasabiKey: result.wasabiKey
    });
  } catch (error: any) {
    console.error('Error storing file in Wasabi:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 