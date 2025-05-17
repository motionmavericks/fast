import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { verifyAuth } from '@/utils/auth';

/**
 * Get application settings
 * 
 * GET /api/admin/settings
 */
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

    // In a production system, these settings would be stored in the database
    // or a configuration file, but for this implementation, we'll use environment variables
    const settings = {
      database: {
        uri: process.env.MONGODB_URI || '',
      },
      wasabi: {
        enabled: !!process.env.WASABI_ACCESS_KEY_ID,
        endpoint: process.env.WASABI_ENDPOINT || '',
        region: process.env.WASABI_REGION || '',
        accessKeyId: process.env.WASABI_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY ? '••••••••' : '',
        bucket: process.env.WASABI_BUCKET_NAME || '',
      },
      frameio: {
        enabled: !!process.env.FRAMEIO_CLIENT_ID,
        clientId: process.env.FRAMEIO_CLIENT_ID || '',
        clientSecret: process.env.FRAMEIO_CLIENT_SECRET ? '••••••••' : '',
        teamId: process.env.FRAMEIO_TEAM_ID || '',
        rootProjectId: process.env.FRAMEIO_ROOT_PROJECT_ID || '',
      },
      r2: {
        enabled: !!process.env.R2_ACCESS_KEY_ID,
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ? '••••••••' : '',
        bucket: process.env.R2_BUCKET_NAME || '',
        publicDomain: process.env.R2_PUBLIC_DOMAIN || '',
      },
      lucidlink: {
        enabled: process.env.LUCIDLINK_ENABLED === 'true',
        basePath: process.env.LUCIDLINK_BASE_PATH || '',
      },
      email: {
        provider: 'sendgrid',
        apiKey: process.env.SENDGRID_API_KEY ? '••••••••' : '',
        senderEmail: process.env.SENDER_EMAIL || '',
        adminEmails: process.env.ADMIN_EMAILS || '',
      },
      uploads: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600000'), // Default 100GB in bytes
        defaultChunkSize: parseInt(process.env.DEFAULT_CHUNK_SIZE || '10485760'), // Default 10MB in bytes
        maxConcurrentUploads: parseInt(process.env.MAX_CONCURRENT_UPLOADS || '6'), // Default 6
      },
    };

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { message: 'Failed to fetch settings', error: error.message },
      { status: 500 }
    );
  }
}
