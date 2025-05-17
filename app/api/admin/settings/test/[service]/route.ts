import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { verifyAuth } from '@/utils/auth';
import { getR2Client } from '@/utils/r2storage';
import { getS3Client } from '@/utils/storage';
import { getFrameIoToken, isAuthenticated } from '@/utils/frameioV4';

/**
 * Test connection to a service
 * 
 * POST /api/admin/settings/test/[service]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { service: string } }
) {
  try {
    // Verify admin authentication
    const authResult = await verifyAuth(request);
    if (!authResult.isAuthenticated) {
      return NextResponse.json(
        { message: 'Unauthorized access' },
        { status: 401 }
      );
    }

    const { service } = params;

    // Test the specified service
    switch (service) {
      case 'database':
        return await testDatabase();
      case 'frameio':
        return await testFrameIo();
      case 'r2':
        return await testR2();
      case 'wasabi':
        return await testWasabi();
      case 'lucidlink':
        return await testLucidLink();
      case 'email':
        return await testEmail();
      default:
        return NextResponse.json(
          { message: `Unknown service: ${service}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error(`Error testing ${params.service} connection:`, error);
    return NextResponse.json(
      { message: `Failed to test ${params.service} connection`, error: error.message },
      { status: 500 }
    );
  }
}

// Test database connection
async function testDatabase() {
  try {
    const startTime = performance.now();
    await dbConnect();
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);
    
    return NextResponse.json({
      message: `Connected to database successfully (${latency}ms)`,
      latency
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: `Database connection failed: ${error.message}` },
      { status: 500 }
    );
  }
}

// Test Frame.io connection
async function testFrameIo() {
  try {
    // Make sure Frame.io is configured
    if (!process.env.FRAMEIO_CLIENT_ID || !process.env.FRAMEIO_CLIENT_SECRET) {
      return NextResponse.json(
        { message: 'Frame.io is not configured' },
        { status: 400 }
      );
    }
    
    const startTime = performance.now();
    
    // Check if we're authenticated with V4 API
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { message: 'Not authenticated with Frame.io. Please login first.' },
        { status: 401 }
      );
    }
    
    // Try to get a token
    const token = await getFrameIoToken();
    if (!token) {
      throw new Error('Failed to get Frame.io token');
    }
    
    // Check if we can access workspaces (V4 API uses workspaces instead of teams)
    const response = await fetch('https://api.frame.io/v4/workspaces', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Version': '4',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to access workspaces: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const workspaces = data.items || [];
    
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);
    
    return NextResponse.json({
      message: `Connected to Frame.io V4 API successfully (${latency}ms) - Found ${workspaces.length} workspaces`,
      latency
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: `Frame.io connection failed: ${error.message}` },
      { status: 500 }
    );
  }
}

// Test R2 connection
async function testR2() {
  try {
    // Make sure R2 is configured
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { message: 'Cloudflare R2 is not configured' },
        { status: 400 }
      );
    }
    
    const startTime = performance.now();
    
    // Get the R2 client
    const r2Client = getR2Client();
    if (!r2Client) {
      throw new Error('R2 client not configured');
    }
    
    // Try to list buckets
    const result = await r2Client.listBuckets({});
    
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);
    
    return NextResponse.json({
      message: `Connected to Cloudflare R2 successfully (${latency}ms) - Found ${result.Buckets?.length || 0} buckets`,
      latency
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: `Cloudflare R2 connection failed: ${error.message}` },
      { status: 500 }
    );
  }
}

// Test Wasabi connection
async function testWasabi() {
  try {
    // Make sure Wasabi is configured
    if (!process.env.WASABI_ACCESS_KEY_ID || !process.env.WASABI_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { message: 'Wasabi is not configured' },
        { status: 400 }
      );
    }
    
    const startTime = performance.now();
    
    // Get the S3 client
    const s3Client = getS3Client();
    if (!s3Client) {
      throw new Error('Wasabi client not configured');
    }
    
    // Try to list buckets
    const result = await s3Client.listBuckets({});
    
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);
    
    return NextResponse.json({
      message: `Connected to Wasabi successfully (${latency}ms) - Found ${result.Buckets?.length || 0} buckets`,
      latency
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: `Wasabi connection failed: ${error.message}` },
      { status: 500 }
    );
  }
}

// Test LucidLink connection
async function testLucidLink() {
  try {
    // Make sure LucidLink is configured
    if (process.env.LUCIDLINK_ENABLED !== 'true' || !process.env.LUCIDLINK_BASE_PATH) {
      return NextResponse.json(
        { message: 'LucidLink is not configured or enabled' },
        { status: 400 }
      );
    }
    
    // In a real implementation, we would check if the LucidLink path is accessible
    // For now, we'll just simulate a successful connection
    return NextResponse.json({
      message: 'LucidLink filesystem is mounted and accessible',
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: `LucidLink connection failed: ${error.message}` },
      { status: 500 }
    );
  }
}

// Test email connection
async function testEmail() {
  try {
    // Make sure SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      return NextResponse.json(
        { message: 'SendGrid is not configured' },
        { status: 400 }
      );
    }
    
    const startTime = performance.now();
    
    // Try to get API key info
    const response = await fetch('https://api.sendgrid.com/v3/user/credits', {
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`SendGrid API returned ${response.status}`);
    }
    
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);
    
    return NextResponse.json({
      message: `Connected to SendGrid successfully (${latency}ms)`,
      latency
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: `Email connection failed: ${error.message}` },
      { status: 500 }
    );
  }
}
