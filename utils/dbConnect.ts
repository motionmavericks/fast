import mongoose from 'mongoose';

// Support both MONGO_URI and MONGODB_URI for backward compatibility
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.warn(
    'No MongoDB URI found. Please define the MONGODB_URI environment variable inside .env.local or your deployment settings'
  );
  // Don't throw error to allow app to start without DB for setup
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    console.log('Using cached database connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // useNewUrlParser: true, // These are deprecated and default to true in Mongoose 6+
      // useUnifiedTopology: true,
    };

    console.log('Creating new database connection');
    
    if (!MONGODB_URI) {
      throw new Error('Database connection URI is missing');
    }
    
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('Database connected successfully');
      return mongoose;
    }).catch(err => {
      console.error('Database connection error:', err);
      cached.promise = null; // Reset promise on error to allow retry
      throw err; // Rethrow error to be caught by caller
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  
  return cached.conn;
}

export default dbConnect;
