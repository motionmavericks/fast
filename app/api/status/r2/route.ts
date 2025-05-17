// app/api/status/r2/route.ts - Check Cloudflare R2 integration status

import { NextRequest, NextResponse } from 'next/server';
import * as r2storage from '@/utils/r2storage';
import { isInitialized } from '@/utils/serviceInitializer';

export async function GET(request: NextRequest) {
  try {
    if (!isInitialized()) {
      return NextResponse.json(
        { status: 'not_initialized', message: 'Services not initialized yet' },
        { status: 503 }
      );
    }

    // Get R2 client to test connection
    const r2Client = r2storage.getR2Client();
    
    // Get config info (without sensitive details)
    const config = {
      hasEndpoint: !!process.env.R2_ENDPOINT,
      hasAccessKeyId: !!process.env.R2_ACCESS_KEY_ID,
      hasSecretAccessKey: !!process.env.R2_SECRET_ACCESS_KEY,
      hasBucketName: !!process.env.R2_BUCKET_NAME,
      hasPublicDomain: !!process.env.R2_PUBLIC_DOMAIN,
      endpoint: process.env.R2_ENDPOINT,
      bucketName: process.env.R2_BUCKET_NAME,
    };

    // Try to list objects to verify connection
    try {
      await r2Client.send({
        Bucket: process.env.R2_BUCKET_NAME || '',
        MaxKeys: 1,
      } as any);
      
      return NextResponse.json({
        status: 'connected',
        message: 'Cloudflare R2 integration is active',
        config
      });
    } catch (error: any) {
      return NextResponse.json({
        status: 'error',
        message: `R2 connection error: ${error.message}`,
        config
      }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json(
      { 
        status: 'error',
        message: error.message || 'An error occurred checking R2 status',
      },
      { status: 500 }
    );
  }
} 