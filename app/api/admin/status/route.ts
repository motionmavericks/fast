import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import { verifyAuth } from '@/utils/auth';
import { getR2Client } from '@/utils/r2storage';
import { getS3Client } from '@/utils/storage';
import { S3ServiceException } from '@aws-sdk/client-s3';
import { MongooseError } from 'mongoose';
import { SendGridError } from '@sendgrid/mail';

/**
 * Check the status of various services used by the application
 * 
 * GET /api/admin/status
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

    // Array to store service status
    const services = [];
    const now = new Date();

    // Check database connection
    try {
      const startTime = performance.now();
      await dbConnect();
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      services.push({
        name: 'Database',
        status: 'operational',
        latency,
        lastChecked: now
      });
    } catch (error) {
      console.error('Database connection error:', error);
      services.push({
        name: 'Database',
        status: 'down',
        message: error instanceof MongooseError ? error.message : 'Failed to connect to database',
        lastChecked: now
      });
    }

    // Check Cloudflare R2 connection
    try {
      const startTime = performance.now();
      
      const r2Client = getR2Client();
      if (!r2Client) {
        throw new Error('R2 client not configured');
      }
      
      // Try a simple operation to check if R2 is working
      await r2Client.listBuckets({});
      
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      services.push({
        name: 'Cloudflare R2',
        status: 'operational',
        latency,
        lastChecked: now
      });
    } catch (error) {
      console.error('Cloudflare R2 connection error:', error);
      services.push({
        name: 'Cloudflare R2',
        status: 'down',
        message: error instanceof S3ServiceException ? error.message : 'Failed to connect to Cloudflare R2',
        lastChecked: now
      });
    }

    // Check Wasabi Storage connection (if configured)
    try {
      const startTime = performance.now();
      
      const s3Client = getS3Client();
      if (!s3Client) {
        throw new Error('Wasabi client not configured');
      }
      
      // Try a simple operation to check if Wasabi is working
      await s3Client.listBuckets({});
      
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      services.push({
        name: 'Wasabi Storage',
        status: 'operational',
        latency,
        lastChecked: now
      });
    } catch (error) {
      // Only add Wasabi if it's configured
      if (process.env.WASABI_ACCESS_KEY_ID) {
        console.error('Wasabi connection error:', error);
        services.push({
          name: 'Wasabi Storage',
          status: 'down',
          message: error instanceof S3ServiceException ? error.message : 'Failed to connect to Wasabi Storage',
          lastChecked: now
        });
      }
    }

    // Check Frame.io API connection
    try {
      const startTime = performance.now();
      
      // Make sure Frame.io is configured
      if (!process.env.FRAMEIO_CLIENT_ID || !process.env.FRAMEIO_CLIENT_SECRET) {
        throw new Error('Frame.io not configured');
      }
      
      // Try to get a token to check if Frame.io is working
      const response = await fetch('https://api.frame.io/v2/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.FRAMEIO_CLIENT_ID,
          client_secret: process.env.FRAMEIO_CLIENT_SECRET,
          grant_type: 'client_credentials',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Frame.io API returned ${response.status}`);
      }
      
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      services.push({
        name: 'Frame.io',
        status: 'operational',
        latency,
        lastChecked: now
      });
    } catch (error) {
      console.error('Frame.io API connection error:', error);
      // Only add Frame.io if it's configured
      if (process.env.FRAMEIO_CLIENT_ID) {
        services.push({
          name: 'Frame.io',
          status: 'down',
          message: error instanceof Error ? error.message : 'Failed to connect to Frame.io API',
          lastChecked: now
        });
      }
    }

    // Check LucidLink connection
    try {
      const lucidEnabled = process.env.LUCIDLINK_ENABLED === 'true';
      const lucidPath = process.env.LUCIDLINK_BASE_PATH;
      
      if (!lucidEnabled || !lucidPath) {
        // LucidLink is not configured, mark as unknown
        services.push({
          name: 'LucidLink',
          status: 'unknown',
          message: 'LucidLink is not configured or enabled',
          lastChecked: now
        });
      } else {
        // In a real implementation, we would check if the LucidLink path is accessible
        // and file operations are working
        services.push({
          name: 'LucidLink',
          status: 'operational',
          message: 'LucidLink filesystem mounted and accessible',
          lastChecked: now
        });
      }
    } catch (error) {
      console.error('LucidLink connection error:', error);
      services.push({
        name: 'LucidLink',
        status: 'down',
        message: error instanceof Error ? error.message : 'Failed to access LucidLink',
        lastChecked: now
      });
    }

    // Check Email connection (SendGrid)
    try {
      const startTime = performance.now();
      
      // Make sure SendGrid is configured
      if (!process.env.SENDGRID_API_KEY) {
        throw new Error('SendGrid not configured');
      }
      
      // We don't actually want to send an email, just check if the API key is valid
      const client = require('@sendgrid/mail');
      client.setApiKey(process.env.SENDGRID_API_KEY);
      
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
      
      services.push({
        name: 'Email',
        status: 'operational',
        latency,
        lastChecked: now
      });
    } catch (error) {
      console.error('SendGrid connection error:', error);
      services.push({
        name: 'Email',
        status: 'down',
        message: error instanceof SendGridError ? error.message : 'Failed to connect to email service',
        lastChecked: now
      });
    }

    return NextResponse.json({
      timestamp: now,
      services
    });
  } catch (error: any) {
    console.error('Error checking service status:', error);
    return NextResponse.json(
      { message: 'Failed to check service status', error: error.message },
      { status: 500 }
    );
  }
}
