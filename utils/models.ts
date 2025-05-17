// utils/models.ts - Database models for the application

import mongoose, { Schema, Document, Model } from 'mongoose';

// Initialize mongoose connection if not already connected
const connectToDatabase = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  return mongoose.connect(process.env.MONGODB_URI || '');
};

// Utility to convert model to JSON while handling _id to id conversion
const toJSON = {
  transform: (_: any, ret: any) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

// Interface for Upload Link document
interface UploadLinkDocument extends Document {
  linkId: string;
  clientName: string;
  projectName: string;
  description?: string;
  expiresAt?: Date;
  maxUploads?: number;
  uploadCount: number;
  createdBy: string;
  createdAt: Date;
  lastUsedAt?: Date;
  isActive: boolean;
  frameIoData?: {
    projectId?: string;
    assetId?: string;
    expiresAt?: Date;
  };
}

// Interface for File document
interface FileDocument extends Document {
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedVia: Schema.Types.ObjectId;
  clientName: string;
  projectName: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  frameIoData?: {
    assetId?: string;
    projectId?: string;
    proxyStatus?: 'pending' | 'processing' | 'complete' | 'error';
    proxies?: Array<{
      quality: string;
      r2Key?: string;
      wasabiKey?: string;
      profile: string;
      url?: string;
    }>;
  };
  r2Data?: {
    keys?: string[];
    status?: 'pending' | 'complete' | 'error';
    lastAccessed?: Date;
    expiresAt?: Date;
  };
  lucidLinkData?: {
    path?: string;
    status?: 'pending' | 'processing' | 'complete' | 'error';
    copiedAt?: Date;
  };
  wasabiData?: {
    originalKey?: string;
    proxyKeys?: string[];
    status?: 'pending' | 'processing' | 'complete' | 'error';
    archivedAt?: Date;
  };
  renderData?: {
    lastAccessed?: Date;
    accessCount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Interface for User document
interface UserDocument extends Document {
  email: string;
  password?: string; // Password might not always be selected
  role: 'admin' | 'user' | 'superadmin';
  createdAt: Date;
  updatedAt: Date;
}

// Upload Link schema
const uploadLinkSchema = new Schema<UploadLinkDocument>(
  {
    linkId: { type: String, required: true, unique: true },
    clientName: { type: String, required: true },
    projectName: { type: String, required: true },
    description: { type: String },
    expiresAt: { type: Date },
    maxUploads: { type: Number },
    uploadCount: { type: Number, default: 0 },
    createdBy: { type: String, required: true },
    lastUsedAt: { type: Date },
    isActive: { type: Boolean, default: true },
    frameIoData: {
      projectId: { type: String },
      assetId: { type: String },
      expiresAt: { type: Date },
    },
  },
  {
    timestamps: true,
    toJSON,
  }
);

// File schema
const fileSchema = new Schema<FileDocument>(
  {
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileType: { type: String, required: true },
    uploadedVia: { type: Schema.Types.ObjectId, ref: 'UploadLink', required: true },
    clientName: { type: String, required: true },
    projectName: { type: String, required: true },
    status: {
      type: String,
      enum: ['uploading', 'processing', 'completed', 'error'],
      default: 'uploading',
    },
    frameIoData: {
      assetId: { type: String },
      projectId: { type: String },
      proxyStatus: {
        type: String,
        enum: ['pending', 'processing', 'complete', 'error'],
        default: 'pending',
      },
      proxies: [
        {
          quality: { type: String },
          r2Key: { type: String },
          wasabiKey: { type: String },
          profile: { type: String },
          url: { type: String },
        },
      ],
    },
    r2Data: {
      keys: [{ type: String }],
      status: {
        type: String,
        enum: ['pending', 'complete', 'error'],
        default: 'pending',
      },
      lastAccessed: { type: Date },
      expiresAt: { type: Date },
    },
    lucidLinkData: {
      path: { type: String },
      status: {
        type: String,
        enum: ['pending', 'processing', 'complete', 'error'],
        default: 'pending',
      },
      copiedAt: { type: Date },
    },
    wasabiData: {
      originalKey: { type: String },
      proxyKeys: [{ type: String }],
      status: {
        type: String,
        enum: ['pending', 'processing', 'complete', 'error'],
        default: 'pending',
      },
      archivedAt: { type: Date },
    },
    renderData: {
      lastAccessed: { type: Date },
      accessCount: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON,
  }
);

// User schema
const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // select: false by default
    role: {
      type: String,
      enum: ['admin', 'user', 'superadmin'],
      default: 'user',
    },
  },
  {
    timestamps: true,
    toJSON,
  }
);

// Create or retrieve models
const getModels = () => {
  // Check if models are already defined
  const models: {
    UploadLink: Model<UploadLinkDocument>;
    File: Model<FileDocument>;
    User: Model<UserDocument>; // Add User model
  } = {
    UploadLink:
      mongoose.models.UploadLink || mongoose.model<UploadLinkDocument>('UploadLink', uploadLinkSchema),
    File: mongoose.models.File || mongoose.model<FileDocument>('File', fileSchema),
    User: mongoose.models.User || mongoose.model<UserDocument>('User', userSchema), // Define User model
  };

  return models;
};

// Connect to database and get models
const models = getModels();

// Export models and connection function
export const { UploadLink, File, User } = models; // Export User
export { connectToDatabase, UploadLinkDocument, FileDocument, UserDocument }; // Export UserDocument