// Script to create a sample project and agency structure for testing

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Models - defining inline for script independence
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user', 'client'], default: 'user' },
});

const agencySchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  contactName: String,
  contactEmail: String,
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  agency: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  contactName: String,
  contactEmail: String,
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const projectSchema = new mongoose.Schema({
  projectId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  description: String,
  startDate: Date,
  status: { type: String, enum: ['active', 'archived', 'complete'], default: 'active' },
  folderStructure: {
    frameio: { folderId: String, path: String },
    r2: { basePath: String },
    lucidlink: { path: String },
  },
  settings: {
    allowClientAccess: { type: Boolean, default: true },
    autoCreateProxies: { type: Boolean, default: true },
    defaultStorageTier: { type: String, default: 'all' },
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastActivityAt: Date,
});

const projectFileSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileType: { type: String, required: true },
  originalPath: String,
  relativePath: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  storageLocations: {
    frameio: {
      status: String,
      assetId: String,
      path: String,
      url: String,
      lastChecked: Date,
    },
    r2: {
      status: String,
      key: String,
      url: String,
      lastChecked: Date,
    },
    lucidlink: {
      status: String,
      path: String,
      lastChecked: Date,
    },
  },
  status: { type: String, default: 'processing' },
  version: { type: Number, default: 1 },
  tags: [String],
  metadata: {
    duration: Number,
    dimensions: String,
  },
  notes: String,
});

// Initialize models
let User, Agency, Client, Project, ProjectFile;

try {
  User = mongoose.model('User');
} catch {
  User = mongoose.model('User', userSchema);
}

try {
  Agency = mongoose.model('Agency');
} catch {
  Agency = mongoose.model('Agency', agencySchema);
}

try {
  Client = mongoose.model('Client');
} catch {
  Client = mongoose.model('Client', clientSchema);
}

try {
  Project = mongoose.model('Project');
} catch {
  Project = mongoose.model('Project', projectSchema);
}

try {
  ProjectFile = mongoose.model('ProjectFile');
} catch {
  ProjectFile = mongoose.model('ProjectFile', projectFileSchema);
}

async function seedData() {
  try {
    // Connect to database
    const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!MONGODB_URI) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    
    await mongoose.connect(MONGODB_URI);
    
    console.log('Connected to database');
    
    // Create admin user if not exists
    let adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      console.log('Creating admin user...');
      adminUser = await User.create({
        email: 'admin@motionmavericks.com',
        password: '$2b$10$zQSRDMVFBAKzk7VKDgBXn.YWRMpNKGNnRGJaeFCjmUJMGX9YHPWzC', // bcrypt hash for 'password123'
        role: 'admin',
      });
    }
    
    // Create Motion Mavericks agency if not exists
    let agency = await Agency.findOne({ code: 'MM' });
    
    if (!agency) {
      console.log('Creating Motion Mavericks agency...');
      agency = await Agency.create({
        name: 'Motion Mavericks',
        code: 'MM',
        contactName: 'Admin',
        contactEmail: 'admin@motionmavericks.com',
        isActive: true,
        createdBy: adminUser._id,
      });
    }
    
    // Create a test client if not exists
    let client = await Client.findOne({ code: 'TEST', agency: agency._id });
    
    if (!client) {
      console.log('Creating test client...');
      client = await Client.create({
        name: 'Test Client',
        code: 'TEST',
        agency: agency._id,
        contactName: 'Test Contact',
        contactEmail: 'test@example.com',
        isActive: true,
        createdBy: adminUser._id,
      });
    }
    
    // Create a sample project if not exists
    let project = await Project.findOne({ projectId: 'MM-MM-TEST-001' });
    
    if (!project) {
      console.log('Creating sample project...');
      project = await Project.create({
        projectId: 'MM-MM-TEST-001',
        name: 'Sample Project',
        client: client._id,
        description: 'This is a sample project for testing',
        startDate: new Date(),
        status: 'active',
        folderStructure: {
          frameio: {
            folderId: 'sample-frame-io-folder-id',
            path: 'MM-MM-TEST-001',
          },
          r2: {
            basePath: 'projects/MM-MM-TEST-001',
          },
          lucidlink: {
            path: '/Projects/MM-MM-TEST-001',
          },
        },
        settings: {
          allowClientAccess: true,
          autoCreateProxies: true,
          defaultStorageTier: 'all',
        },
        isActive: true,
        createdBy: adminUser._id,
        lastActivityAt: new Date(),
      });
    }
    
    // Create sample project files if none exist
    const filesCount = await ProjectFile.countDocuments({ project: project._id });
    
    if (filesCount === 0) {
      console.log('Creating sample project files...');
      
      // Sample file types and paths
      const fileTypes = [
        { name: 'Sample Video 1.mp4', type: 'video/mp4', size: 1024 * 1024 * 100, category: 'Production', subcategory: 'Camera' },
        { name: 'Sample Audio.wav', type: 'audio/wav', size: 1024 * 1024 * 50, category: 'Production', subcategory: 'Sound' },
        { name: 'Graphics Template.psd', type: 'image/psd', size: 1024 * 1024 * 25, category: 'Post-Production', subcategory: 'Graphics' },
        { name: 'Final Cut.mp4', type: 'video/mp4', size: 1024 * 1024 * 200, category: 'Deliverables', subcategory: 'Final_Masters' },
        { name: 'Stock Photo.jpg', type: 'image/jpeg', size: 1024 * 1024 * 5, category: 'Assets', subcategory: 'Photos' },
      ];
      
      // Create each sample file
      for (const file of fileTypes) {
        await ProjectFile.create({
          project: project._id,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          originalPath: `/uploads/${file.name}`,
          relativePath: `${file.category}/${file.subcategory}/${file.name}`,
          uploadedBy: adminUser._id,
          storageLocations: {
            frameio: {
              status: 'available',
              assetId: `frameio-asset-${Math.random().toString(36).substring(2, 10)}`,
              path: `MM-MM-TEST-001/${file.category}/${file.subcategory}/${file.name}`,
              url: `https://app.frame.io/presentations/sample-${Math.random().toString(36).substring(2, 10)}`,
              lastChecked: new Date(),
            },
            r2: {
              status: 'available',
              key: `projects/MM-MM-TEST-001/${file.category}/${file.subcategory}/${file.name}`,
              url: `https://r2.example.com/projects/MM-MM-TEST-001/${file.category}/${file.subcategory}/${file.name}`,
              lastChecked: new Date(),
            },
            lucidlink: {
              status: 'available',
              path: `/Projects/MM-MM-TEST-001/${file.category}/${file.subcategory}/${file.name}`,
              lastChecked: new Date(),
            },
          },
          status: 'available',
          version: 1,
          tags: [file.category.toLowerCase(), file.subcategory.toLowerCase()],
          metadata: {
            duration: file.type.startsWith('video') ? 120 : null,
            dimensions: file.type.startsWith('video') || file.type.startsWith('image') ? '1920x1080' : null,
          },
          notes: `Sample ${file.type.split('/')[0]} file for testing`,
        });
      }
    }
    
    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    process.exit();
  }
}

// Run the seed function
seedData();
