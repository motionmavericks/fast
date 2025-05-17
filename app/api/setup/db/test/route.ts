import { NextResponse } from 'next/server';
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

    // Validate URI format first
    const mongoUriRegex = /^mongodb(\+srv)?:\/\/.+/;
    if (!mongoUriRegex.test(mongoUri)) {
      return NextResponse.json(
        { message: 'Invalid MongoDB URI format' },
        { status: 400 }
      );
    }

    // Set a timeout for the connection attempt
    const connectionTimeoutMs = 10000; // 10 seconds
    
    // Set connection options
    const options = {
      serverSelectionTimeoutMS: connectionTimeoutMs,
      connectTimeoutMS: connectionTimeoutMs
    };

    try {
      console.log(`Testing MongoDB connection to: ${mongoUri.split('@')[0].replace(/:([^:]+)@/, ':****@')}`);
      
      // Connect with timeout
      const client = await mongoose.connect(mongoUri, options);
      
      // If we get here, connection is successful
      // Get DB info for feedback
      const dbName = client.connection.db.databaseName;
      const collectionCount = (await client.connection.db.listCollections().toArray()).length;
      
      // Close the connection
      await client.connection.close();
      
      console.log('MongoDB connection test successful');
      
      return NextResponse.json({
        message: 'Successfully connected to MongoDB',
        dbName,
        collectionCount
      });
    } catch (connectionError: any) {
      console.error('MongoDB connection test failed:', connectionError);
      
      // Provide specific error messages based on error type
      let errorMessage = 'Failed to connect to MongoDB';
      
      if (connectionError.name === 'MongoServerSelectionError') {
        errorMessage = 'Could not connect to any MongoDB server in the connection string';
      } else if (connectionError.name === 'MongoParseError') {
        errorMessage = 'Invalid MongoDB connection string format';
      } else if (connectionError.message.includes('ENOTFOUND')) {
        errorMessage = 'Server hostname could not be found';
      } else if (connectionError.message.includes('ETIMEDOUT')) {
        errorMessage = 'Connection attempt timed out';
      } else if (connectionError.message.includes('Authentication failed')) {
        errorMessage = 'Authentication failed - incorrect username or password';
      }
      
      return NextResponse.json(
        { 
          message: errorMessage,
          error: connectionError.message
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error testing MongoDB connection:', error);
    return NextResponse.json(
      { message: 'Error testing MongoDB connection', error: error.message },
      { status: 500 }
    );
  }
}