// app/api/webhooks/frameio/route.ts - API route for handling Frame.io webhooks

import { NextRequest, NextResponse } from 'next/server';
import * as integrationService from '@/utils/integrationService';
import { File } from '@/utils/models';

/**
 * Verify webhook signature (if available)
 */
function verifySignature(request: NextRequest): boolean {
  // In production, implement signature verification
  // https://developer.frame.io/api/reference/webhooks/
  
  const secret = request.headers.get('X-Worker-Secret');
  if (secret && secret === process.env.WEBHOOK_SECRET) {
    return true;
  }
  
  // For now, return true to accept Frame.io webhooks directly
  return true;
}

/**
 * POST handler for Frame.io webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the webhook signature
    if (!verifySignature(request)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse the request body
    const eventData = await request.json();
    const eventType = eventData.type;

    console.log(`Received Frame.io webhook event: ${eventType}`, eventData);

    // Handle different event types
    let result;
    switch (eventType) {
      case 'asset.ready':
        result = await integrationService.handleFrameIoAssetReady(eventData.data);
        break;
        
      case 'proxy.ready':
        // Check if this came from our worker (has fileId)
        if (eventData.data && eventData.data.fileId) {
          // Process proxies with fileId
          result = await integrationService.handleFrameIoProxyReadyWithFileId(eventData.data);
        } else {
          // Process proxies with just assetId
          result = await integrationService.handleFrameIoProxyReady(eventData.data);
        }
        break;
        
      default:
        return NextResponse.json(
          { message: `Event type ${eventType} not handled` },
          { status: 200 }
        );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error handling Frame.io webhook:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
