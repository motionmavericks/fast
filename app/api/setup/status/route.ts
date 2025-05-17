import { NextResponse } from 'next/server';
import dbConnect from '@/utils/dbConnect';
import User from '@/utils/models';

// Check if setup is complete by verifying admin user exists and configs are set
async function checkSetupStatus() {
  try {
    // First, try to connect to the database
    try {
      await dbConnect();
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return false; // DB connection failed, setup is not complete
    }
    
    // Check if any admin user exists
    let adminUser;
    try {
      adminUser = await User.findOne({ role: { $in: ['admin', 'superadmin'] } });
    } catch (queryError) {
      console.error('Error querying admin user:', queryError);
      return false;
    }
    
    const isAdminCreated = !!adminUser;
    console.log('Admin user exists:', isAdminCreated);

    // Check for essential configs
    const isDbConfigured = !!process.env.MONGODB_URI;
    
    const isStorageConfigured = !!(
      process.env.WASABI_ACCESS_KEY_ID && 
      process.env.WASABI_SECRET_ACCESS_KEY && 
      process.env.WASABI_BUCKET_NAME && 
      process.env.WASABI_REGION &&
      process.env.WASABI_ENDPOINT
    );
      
    const isEmailConfigured = !!(
      process.env.SENDER_EMAIL && 
      (process.env.SENDGRID_API_KEY || 
       (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS))
    );

    console.log('Config status:', { 
      isDbConfigured, 
      isStorageConfigured, 
      isEmailConfigured 
    });

    // For initial setup, we just require an admin user and DB config
    // Other configs can be set later from the admin settings
    return isAdminCreated && isDbConfigured;

  } catch (error) {
    console.error('Unexpected error in checkSetupStatus:', error);
    return false;
  }
}

export async function GET() {
  try {
    const isSetupComplete = await checkSetupStatus();
    return NextResponse.json({ 
      isSetupComplete,
      dbConfigured: !!process.env.MONGODB_URI,
      dbConnected: isSetupComplete, // If setup is complete, DB is connected
      hasAdmin: isSetupComplete,     // If setup is complete, admin exists
    });
  } catch (error: any) {
    console.error('Error in GET /api/setup/status:', error);
    return NextResponse.json(
      { 
        isSetupComplete: false,
        dbConfigured: !!process.env.MONGODB_URI,
        dbConnected: false,
        hasAdmin: false,
        error: error.message
      },
      { status: 200 } // Return 200 even with error to allow frontend to handle
    );
  }
}
