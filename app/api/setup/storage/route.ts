import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import storage from '@/utils/storage';

export async function POST(request: Request) {
  try {
    const { accessKeyId, secretAccessKey, bucketName, region, endpoint } = await request.json();

    if (!accessKeyId || !secretAccessKey || !bucketName || !region || !endpoint) {
      return NextResponse.json(
        { message: 'All Wasabi storage configuration fields are required' },
        { status: 400 }
      );
    }

    // Validate inputs
    const endpointRegex = /^https?:\/\/[a-zA-Z0-9-\.]+\.[a-zA-Z]{2,}(:[0-9]+)?(\/[a-zA-Z0-9\-\._~:/?#[\]@!$&'()*+,;=]*)?$/;
    if (!endpointRegex.test(endpoint)) {
      return NextResponse.json(
        { message: 'Invalid endpoint URL format' },
        { status: 400 }
      );
    }

    // Save the configuration to .env.local
    try {
      const envLocalPath = path.resolve(process.cwd(), '.env.local');
      
      // Read existing file or create empty string if file doesn't exist
      let existingEnv = '';
      try {
        existingEnv = await fs.readFile(envLocalPath, 'utf8');
      } catch (err) {
        // File doesn't exist, start with empty string
      }
      
      // Replace or add each variable
      const envVars = [
        { key: 'WASABI_ACCESS_KEY_ID', value: accessKeyId },
        { key: 'WASABI_SECRET_ACCESS_KEY', value: secretAccessKey },
        { key: 'WASABI_BUCKET_NAME', value: bucketName },
        { key: 'WASABI_REGION', value: region },
        { key: 'WASABI_ENDPOINT', value: endpoint }
      ];
      
      for (const { key, value } of envVars) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        const newLine = `${key}=${value}`;
        
        if (regex.test(existingEnv)) {
          // Replace existing line
          existingEnv = existingEnv.replace(regex, newLine);
        } else {
          // Add new line
          existingEnv += `\n${newLine}`;
        }
      }
      
      // Write back to .env.local
      await fs.writeFile(envLocalPath, existingEnv.trim() + '\n');
      console.log('Wasabi config saved to .env.local');
    } catch (err) {
      console.error('Error writing to .env.local:', err);
      // Continue even if .env.local fails - we still want to initialize in memory
    }

    // Initialize the storage service with the new config
    storage.initializeStorage({
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
      bucket: bucketName
    });

    console.log(`Wasabi storage configured with bucket: ${bucketName}, region: ${region}`); // Exclude keys from logs
    console.log('IMPORTANT: For production, ensure Wasabi credentials are set as secure environment variables.');

    return NextResponse.json(
      { message: 'Wasabi storage configuration saved and initialized.' },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Wasabi storage configuration error:', error);
    return NextResponse.json(
      { message: 'Error saving Wasabi storage configuration', error: error.message },
      { status: 500 }
    );
  }
}
