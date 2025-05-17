// Script to initialize the first admin user
// Run with: node scripts/init-admin.js

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Read .env.local file to get MONGODB_URI
function readEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      // Parse the content to extract MONGODB_URI
      const mongoUriMatch = envContent.match(/MONGODB_URI=(.+?)(\r?\n|$)/);
      if (mongoUriMatch && mongoUriMatch[1]) {
        return mongoUriMatch[1].trim();
      }
    }
  } catch (error) {
    console.error('Error reading .env.local file:', error);
  }
  return null;
}

// Get MongoDB URI from .env.local file or environment variables
const ENV_FILE_URI = readEnvFile();
const DEFAULT_MONGO_URI = ENV_FILE_URI || process.env.MONGODB_URI;
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin123!';

async function initializeAdmin() {
  // Check if MongoDB URI is provided
  if (!DEFAULT_MONGO_URI) {
    console.error('Error: MongoDB URI is not provided.');
    console.error('Please set MONGODB_URI environment variable or configure the database in the setup page.');
    console.error('Example: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname node scripts/init-admin.js');
    process.exit(1);
  }
  
  const mongoUri = DEFAULT_MONGO_URI;
  
  console.log(`Connecting to MongoDB at ${mongoUri.split('@')[0].replace(/:([^:]+)@/, ':****@')}...`);
  
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // Check if admin already exists
    const existingAdmin = await usersCollection.findOne({ 
      role: { $in: ['admin', 'superadmin'] } 
    });
    
    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log(`Email: ${existingAdmin.email}`);
      console.log('Please use this account to log in, or reset the password if needed.');
      await client.close();
      return;
    }
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);
    
    // Create admin user
    const result = await usersCollection.insertOne({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'superadmin',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('Admin user created successfully!');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log('\nIMPORTANT: Please change this password immediately after logging in.');
    
    // Create .env.local file with database URI if it doesn't exist
    const fs = require('fs');
    const path = require('path');
    const envPath = path.resolve(process.cwd(), '.env.local');
    
    // Check if .env.local exists
    try {
      let envContent = '';
      try {
        envContent = fs.readFileSync(envPath, 'utf8');
      } catch (err) {
        // File doesn't exist, start with empty
      }
      
      // Add MONGODB_URI if not present
      if (!envContent.includes('MONGODB_URI=')) {
        envContent += `\nMONGODB_URI=${mongoUri}\n`;
        fs.writeFileSync(envPath, envContent);
        console.log('\nAdded MongoDB URI to .env.local file.');
      }
    } catch (fsError) {
      console.error('Error updating .env.local:', fsError);
    }
    
    await client.close();
    
  } catch (error) {
    console.error('Error initializing admin user:', error);
  }
}

initializeAdmin().catch(console.error);