// Simple script to create an admin user
// Run with: node scripts/create-admin.js mongodb_uri admin_email admin_password

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  if (process.argv.length < 5) {
    console.log('Usage: node scripts/create-admin.js <mongodb_uri> <admin_email> <admin_password>');
    console.log('Example: node scripts/create-admin.js "mongodb+srv://user:pass@cluster.mongodb.net/db" "admin@example.com" "securepassword"');
    process.exit(1);
  }

  const mongoUri = process.argv[2];
  const email = process.argv[3];
  const password = process.argv[4];

  console.log(`Creating admin user with email: ${email}`);
  console.log(`Connecting to MongoDB at ${mongoUri.split('@')[0].replace(/:([^:]+)@/, ':****@')}...`);
  
  try {
    // Connect to MongoDB
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // Check if admin already exists
    const existingAdmin = await usersCollection.findOne({ 
      email: email 
    });
    
    if (existingAdmin) {
      console.log('User with this email already exists!');
      console.log('Please use a different email or use the existing account.');
      await client.close();
      return;
    }
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create admin user
    const result = await usersCollection.insertOne({
      email: email,
      password: hashedPassword,
      role: 'superadmin',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('Admin user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`User ID: ${result.insertedId}`);
    
    await client.close();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

createAdmin().catch(console.error);