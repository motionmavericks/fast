import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  try {
    const { mongoUri } = await request.json();

    if (!mongoUri) {
      return NextResponse.json(
        { message: 'MongoDB connection URI is required' },
        { status: 400 }
      );
    }

    // Validate MongoDB URI format
    const mongoUriRegex = /^mongodb(\+srv)?:\/\/.+/;
    if (!mongoUriRegex.test(mongoUri)) {
      return NextResponse.json(
        { message: 'Invalid MongoDB URI format' },
        { status: 400 }
      );
    }

    // Try connecting one more time to ensure it works
    try {
      const client = await mongoose.connect(mongoUri);
      await client.connection.close();
    } catch (dbError: any) {
      return NextResponse.json(
        { message: `Could not connect to database: ${dbError.message}` },
        { status: 400 }
      );
    }

    // Save the MongoDB URI to .env.local
    try {
      const envLocalPath = path.resolve(process.cwd(), '.env.local');
      
      // Read existing file or create empty string if file doesn't exist
      let existingEnv = '';
      try {
        existingEnv = await fs.readFile(envLocalPath, 'utf8');
      } catch (err) {
        // File doesn't exist, start with empty string
      }
      
      // Replace or add MONGODB_URI
      const mongoUriRegex = /^MONGODB_URI=.*/m;
      const mongoUriLine = `MONGODB_URI=${mongoUri}`;
      
      if (mongoUriRegex.test(existingEnv)) {
        // Replace existing line
        existingEnv = existingEnv.replace(mongoUriRegex, mongoUriLine);
      } else {
        // Add new line
        existingEnv += existingEnv.endsWith('\n') ? mongoUriLine : `\n${mongoUriLine}`;
      }
      
      // Write back to .env.local
      await fs.writeFile(envLocalPath, existingEnv.trim() + '\n');
      console.log('MongoDB URI saved to .env.local');
      
      // Also set current process.env for immediate use
      process.env.MONGODB_URI = mongoUri;
      
    } catch (fsError: any) {
      console.error('Error writing to .env.local:', fsError);
      return NextResponse.json(
        { message: `Successfully connected but failed to save configuration: ${fsError.message}` },
        { status: 500 }
      );
    }

    console.log('MongoDB connection successfully configured');
    
    return NextResponse.json(
      { 
        message: 'Database configuration saved successfully',
        needsRestart: false // No need to restart since we set process.env directly
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Database configuration error:', error);
    return NextResponse.json(
      { message: 'Error saving database configuration', error: error.message },
      { status: 500 }
    );
  }
}
