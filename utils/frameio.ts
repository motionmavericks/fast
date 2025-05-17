// utils/frameio.ts - Integration with Frame.io for media upload and management

import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

// Frame.io API endpoints
const FRAMEIO_API_URL = 'https://api.frame.io/v2';
const FRAMEIO_UPLOAD_URL = 'https://uploads.frame.io/v2';

// Configuration for Frame.io - simplified to use a direct token
let frameIoConfig = {
  token: process.env.FRAMEIO_TOKEN || '',
  teamId: process.env.FRAMEIO_TEAM_ID || '',
  rootProjectId: process.env.FRAMEIO_ROOT_PROJECT_ID || '',
};

// Types for Frame.io API
interface FrameIoAsset {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'version_stack';
  filesize: number;
  properties: {
    duration_in_ms?: number;
    filesize_bytes?: number;
    width?: number;
    height?: number;
  };
  status: 'uploading' | 'processing' | 'complete' | 'error';
  proxies?: {
    status: string;
    profile: string;
    urls: {
      ssl_url: string;
    };
  }[];
  creator_id: string;
  project_id: string;
  parent_id: string;
  created_at: string;
  private?: boolean;
}

interface FrameIoFolder extends FrameIoAsset {
  type: 'folder';
}

interface FrameIoUploadLink {
  filename: string;
  filetype: string;
  filesize: number;
  upload_url: string;
  asset_id: string;
  expires_at: string;
}

// Get token directly instead of OAuth
async function getFrameIoToken(): Promise<string> {
  // If we already have a token, use it directly
  if (frameIoConfig.token) {
    return frameIoConfig.token;
  }
  
  // If no token is provided, throw an error
  throw new Error('Frame.io token is not configured. Please set FRAMEIO_TOKEN in your environment variables.');
}

// Get user info to determine the root project ID if not explicitly set
async function getUserAndInitialize(): Promise<void> {
  try {
    if (frameIoConfig.rootProjectId) {
      // Already initialized
      return;
    }
    
    const token = await getFrameIoToken();
    
    // Get the current user info
    const userResponse = await fetch(`${FRAMEIO_API_URL}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!userResponse.ok) {
      throw new Error(`Failed to get user info: ${userResponse.statusText}`);
    }
    
    const user = await userResponse.json();
    
    // If we don't have a team ID, use the first available team
    if (!frameIoConfig.teamId && user.teams && user.teams.length > 0) {
      frameIoConfig.teamId = user.teams[0].id;
      console.log(`Auto-detected Frame.io Team ID: ${frameIoConfig.teamId}`);
    }
    
    // Get or create a root project
    if (!frameIoConfig.rootProjectId) {
      // List projects to find an existing one or create a new one
      const projectsResponse = await fetch(`${FRAMEIO_API_URL}/teams/${frameIoConfig.teamId}/projects`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!projectsResponse.ok) {
        throw new Error(`Failed to list projects: ${projectsResponse.statusText}`);
      }
      
      const projects = await projectsResponse.json();
      
      if (projects && projects.length > 0) {
        // Use the first project as the root
        frameIoConfig.rootProjectId = projects[0].id;
        console.log(`Auto-detected Frame.io Root Project ID: ${frameIoConfig.rootProjectId}`);
      } else {
        // Create a new project
        const newProjectResponse = await fetch(`${FRAMEIO_API_URL}/projects`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: 'Motion Mavericks Fast',
            team_id: frameIoConfig.teamId,
          }),
        });
        
        if (!newProjectResponse.ok) {
          throw new Error(`Failed to create project: ${newProjectResponse.statusText}`);
        }
        
        const newProject = await newProjectResponse.json();
        frameIoConfig.rootProjectId = newProject.id;
        console.log(`Created new Frame.io Root Project ID: ${frameIoConfig.rootProjectId}`);
      }
    }
  } catch (error) {
    console.error('Error initializing Frame.io:', error);
    throw error;
  }
}

// Create a project folder in Frame.io
async function createProjectFolder(name: string, parentId?: string): Promise<FrameIoFolder> {
  try {
    // Make sure we have initialized
    await getUserAndInitialize();
    
    const token = await getFrameIoToken();
    
    const response = await fetch(`${FRAMEIO_API_URL}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        type: 'folder',
        parent_id: parentId || frameIoConfig.rootProjectId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create Frame.io folder: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating Frame.io project folder:', error);
    throw error;
  }
}

// Generate an upload link for a client
async function generateUploadLink(
  projectFolderId: string, 
  filename: string, 
  filesize: number, 
  filetype: string
): Promise<FrameIoUploadLink> {
  try {
    // Make sure we have initialized
    await getUserAndInitialize();
    
    const token = await getFrameIoToken();
    
    const response = await fetch(`${FRAMEIO_API_URL}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: filename,
        type: 'file',
        filesize,
        filetype,
        parent_id: projectFolderId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create Frame.io asset: ${error.message || response.statusText}`);
    }

    const asset = await response.json();

    // Get upload link for the created asset
    const uploadResponse = await fetch(`${FRAMEIO_UPLOAD_URL}/assets/${asset.id}/upload`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(`Failed to get Frame.io upload link: ${error.message || uploadResponse.statusText}`);
    }

    const uploadData = await uploadResponse.json();
    return {
      ...uploadData,
      asset_id: asset.id,
    };
  } catch (error) {
    console.error('Error generating Frame.io upload link:', error);
    throw error;
  }
}

// Get asset details including proxy URLs
async function getAssetDetails(assetId: string): Promise<FrameIoAsset> {
  try {
    const token = await getFrameIoToken();
    
    const response = await fetch(`${FRAMEIO_API_URL}/assets/${assetId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get Frame.io asset: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting Frame.io asset details:', error);
    throw error;
  }
}

// Get all proxy URLs for an asset
async function getAssetProxies(assetId: string): Promise<any[]> {
  try {
    const asset = await getAssetDetails(assetId);
    
    if (!asset.proxies || asset.proxies.length === 0) {
      throw new Error('No proxies available for this asset');
    }
    
    return asset.proxies;
  } catch (error) {
    console.error('Error getting Frame.io asset proxies:', error);
    throw error;
  }
}

// Create a shareable review link for an asset
async function createShareLink(assetId: string, expiresInDays = 7): Promise<string> {
  try {
    const token = await getFrameIoToken();
    
    const response = await fetch(`${FRAMEIO_API_URL}/share_links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        asset_id: assetId,
        expires_at: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create Frame.io share link: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data.short_url;
  } catch (error) {
    console.error('Error creating Frame.io share link:', error);
    throw error;
  }
}

// Configure the Frame.io integration
function configureFrameIo(config: typeof frameIoConfig): void {
  frameIoConfig = {
    ...frameIoConfig,
    ...config,
  };
}

// Generate signed JWT for direct uploads
function generateUploadToken(
  projectId: string,
  expiresInMinutes = 60
): string {
  // This requires a secret, which we don't have
  // Return the token directly as we're using a direct token approach
  return frameIoConfig.token;
}

export {
  configureFrameIo,
  createProjectFolder,
  generateUploadLink,
  getAssetDetails,
  getAssetProxies,
  createShareLink,
  generateUploadToken,
  getUserAndInitialize,
  FrameIoAsset,
  FrameIoUploadLink,
}; 