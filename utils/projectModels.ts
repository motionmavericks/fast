import mongoose, { Document, Schema, Model } from 'mongoose';
import { IUser } from './models';

// --- Agency Model ---

export interface IAgency extends Document {
  name: string;
  code: string; // Short code for the agency (2-4 letters)
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  createdBy: mongoose.Schema.Types.ObjectId | IUser;
  createdAt: Date;
  updatedAt: Date;
}

const AgencySchema: Schema<IAgency> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Agency name is required'],
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: [true, 'Agency code is required'],
      trim: true,
      uppercase: true,
      unique: true,
      minlength: [2, 'Agency code must be at least 2 characters'],
      maxlength: [4, 'Agency code must be at most 4 characters'],
      match: [/^[A-Z]+$/, 'Agency code must be uppercase letters only'],
    },
    contactName: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/.+\@.+\..+/, 'Please fill a valid email address'],
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// --- Client Model ---

export interface IClient extends Document {
  name: string;
  agency: mongoose.Schema.Types.ObjectId | IAgency;
  code: string; // Short code for the client (2-4 letters)
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  createdBy: mongoose.Schema.Types.ObjectId | IUser;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema: Schema<IClient> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
    },
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
      required: true,
    },
    code: {
      type: String,
      required: [true, 'Client code is required'],
      trim: true,
      uppercase: true,
      minlength: [2, 'Client code must be at least 2 characters'],
      maxlength: [4, 'Client code must be at most 4 characters'],
      match: [/^[A-Z]+$/, 'Client code must be uppercase letters only'],
    },
    contactName: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/.+\@.+\..+/, 'Please fill a valid email address'],
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index to ensure agency + client code combination is unique
ClientSchema.index({ agency: 1, code: 1 }, { unique: true });

// --- Project Model ---

export interface IProject extends Document {
  projectId: string; // The MM project ID (e.g., MM-ABC-XYZ-001)
  name: string;
  client: mongoose.Schema.Types.ObjectId | IClient;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  status: 'planning' | 'active' | 'completed' | 'archived';
  folderStructure: {
    frameio: {
      folderId: string;
      path: string;
    };
    r2: {
      basePath: string;
    };
    lucidlink: {
      path: string;
    };
  };
  // Track access tokens, settings, etc.
  settings: {
    allowClientAccess: boolean;
    autoCreateProxies: boolean;
    defaultStorageTier: 'all' | 'frameio' | 'r2' | 'lucidlink';
    [key: string]: any;
  };
  notes?: string;
  isActive: boolean;
  createdBy: mongoose.Schema.Types.ObjectId | IUser;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema<IProject> = new Schema(
  {
    projectId: {
      type: String,
      required: [true, 'Project ID is required'],
      trim: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['planning', 'active', 'completed', 'archived'],
      default: 'planning',
    },
    folderStructure: {
      frameio: {
        folderId: String,
        path: String,
      },
      r2: {
        basePath: String,
      },
      lucidlink: {
        path: String,
      },
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {
        allowClientAccess: true,
        autoCreateProxies: true,
        defaultStorageTier: 'all',
      },
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// --- ProjectFile Model ---
// Extends the base File model with project-specific information

export interface IProjectFile extends Document {
  project: mongoose.Schema.Types.ObjectId | IProject;
  fileName: string;
  fileSize: number;
  fileType: string;
  originalPath: string; // Original path from upload
  relativePath: string; // Path relative to project root
  uploadedBy: mongoose.Schema.Types.ObjectId | IUser;
  storageLocations: {
    frameio?: {
      assetId?: string;
      status: 'pending' | 'available' | 'failed' | 'not_applicable';
      path?: string;
      url?: string;
      lastChecked?: Date;
      error?: string;
    };
    r2?: {
      key?: string;
      status: 'pending' | 'available' | 'failed' | 'not_applicable';
      url?: string;
      lastChecked?: Date;
      error?: string;
    };
    lucidlink?: {
      path?: string;
      status: 'pending' | 'available' | 'failed' | 'not_applicable';
      lastChecked?: Date;
      error?: string;
    };
  };
  status: 'uploading' | 'processing' | 'available' | 'failed' | 'archived';
  version: number; // File version (for tracking changes)
  tags: string[]; // For categorization and searching
  metadata: {
    duration?: number; // For video/audio
    dimensions?: string; // For images/video
    codec?: string; // For media files
    fps?: number; // For video
    bitrate?: number; // For media files
    [key: string]: any; // Other metadata
  };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectFileSchema: Schema<IProjectFile> = new Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
    },
    fileType: {
      type: String,
      required: [true, 'File type is required'],
    },
    originalPath: {
      type: String,
      required: [true, 'Original path is required'],
    },
    relativePath: {
      type: String,
      required: [true, 'Relative path is required'],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    storageLocations: {
      frameio: {
        assetId: String,
        status: {
          type: String,
          enum: ['pending', 'available', 'failed', 'not_applicable'],
          default: 'pending',
        },
        path: String,
        url: String,
        lastChecked: Date,
        error: String,
      },
      r2: {
        key: String,
        status: {
          type: String,
          enum: ['pending', 'available', 'failed', 'not_applicable'],
          default: 'pending',
        },
        url: String,
        lastChecked: Date,
        error: String,
      },
      lucidlink: {
        path: String,
        status: {
          type: String,
          enum: ['pending', 'available', 'failed', 'not_applicable'],
          default: 'pending',
        },
        lastChecked: Date,
        error: String,
      },
    },
    status: {
      type: String,
      enum: ['uploading', 'processing', 'available', 'failed', 'archived'],
      default: 'uploading',
    },
    version: {
      type: Number,
      default: 1,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Prevent model overwrite in Next.js hot reloading environments
export const Agency: Model<IAgency> = mongoose.models.Agency || 
                                      mongoose.model<IAgency>('Agency', AgencySchema);

export const Client: Model<IClient> = mongoose.models.Client || 
                                      mongoose.model<IClient>('Client', ClientSchema);

export const Project: Model<IProject> = mongoose.models.Project || 
                                        mongoose.model<IProject>('Project', ProjectSchema);
                                        
export const ProjectFile: Model<IProjectFile> = mongoose.models.ProjectFile || 
                                               mongoose.model<IProjectFile>('ProjectFile', ProjectFileSchema);
