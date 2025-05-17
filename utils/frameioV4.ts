// utils/frameioV4.ts - Integration with Frame.io V4 API using OAuth

import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';

// Frame.io V4 API endpoints
const FRAMEIO_API_URL = 'https://api.frame.io/v4';

// Types for Frame.io V4 API
interface FrameIoV4Asset {
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
  creator_id: string;
  workspace_id: string;
  parent_id: string;
  created_at: string;
  private?: boolean;
}

interface FrameIoV4UploadLink {
  filename: string;
  filetype: string;
  filesize: number;
  upload_url: string;
  asset_id: string;
  expires_at: string;
}

// Get OAuth token from cookie
async function getFrameIoToken(): Promise<string> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('frameio_access_token')?.value;
  
  if (!accessToken) {
    throw new Error('No Frame.io access token available. Please authenticate first.');
  }
  
  return accessToken;
}

// Check if we have a valid token
async function isAuthenticated(): Promise<boolean> {
  const cookieStore = cookies();
  return !!cookieStore.get('frameio_access_token')?.value;
}

// Get user info to determine workspace ID
async function getUserInfo(): Promise<any> {
  try {
    const token = await getFrameIoToken();
    
    // Get the current user info
    const userResponse = await fetch(`${FRAMEIO_API_URL}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Version': '4',
      },
    });
    
    if (!userResponse.ok) {
      throw new Error(`Failed to get user info: ${userResponse.statusText}`);
    }
    
    return await userResponse.json();
  } catch (error) {
    console.error('Error getting Frame.io user info:', error);
    throw error;
  }
}

// Get workspaces (replaces teams in V4 API)
async function getWorkspaces(): Promise<any[]> {
  try {
    const token = await getFrameIoToken();
    
    const response = await fetch(`${FRAMEIO_API_URL}/workspaces`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Version': '4',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get workspaces: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error getting Frame.io workspaces:', error);
    throw error;
  }
}

// Get projects in a workspace
async function getProjects(workspaceId: string): Promise<any[]> {
  try {
    const token = await getFrameIoToken();
    
    const response = await fetch(`${FRAMEIO_API_URL}/workspaces/${workspaceId}/projects`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Version': '4',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get projects: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error getting Frame.io projects:', error);
    throw error;
  }
}

// Create a project in a workspace
async function createProject(workspaceId: string, name: string): Promise<any> {
  try {
    const token = await getFrameIoToken();
    
    const response = await fetch(`${FRAMEIO_API_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Api-Version': '4',
      },
      body: JSON.stringify({
        name,
        workspace_id: workspaceId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create project: ${error.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating Frame.io project:', error);
    throw error;
  }
}

// Create a folder in a project or folder
async function createFolder(parentId: string, name: string): Promise<FrameIoV4Asset> {
  try {
    const token = await getFrameIoToken();
    
    const response = await fetch(`${FRAMEIO_API_URL}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Api-Version': '4',
      },
      body: JSON.stringify({
        name,
        type: 'folder',
        parent_id: parentId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create folder: ${error.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating Frame.io folder:', error);
    throw error;
  }
}

// Generate an upload link for a file
async function generateUploadLink(
  parentId: string, 
  filename: string, 
  filesize: number, 
  filetype: string
): Promise<FrameIoV4UploadLink> {
  try {
    const token = await getFrameIoToken();
    
    // Create asset first
    const assetResponse = await fetch(`${FRAMEIO_API_URL}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Api-Version': '4',
      },
      body: JSON.stringify({
        name: filename,
        type: 'file',
        filesize,
        filetype,
        parent_id: parentId,
      }),
    });

    if (!assetResponse.ok) {
      const error = await assetResponse.json();
      throw new Error(`Failed to create asset: ${error.message || assetResponse.statusText}`);
    }

    const asset = await assetResponse.json();

    // Get upload link for the created asset
    const uploadResponse = await fetch(`${FRAMEIO_API_URL}/assets/${asset.id}/upload`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Version': '4',
      },
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(`Failed to get upload link: ${error.message || uploadResponse.statusText}`);
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

// Get asset details
async function getAssetDetails(assetId: string): Promise<FrameIoV4Asset> {
  try {
    const token = await getFrameIoToken();
    
    const response = await fetch(`${FRAMEIO_API_URL}/assets/${assetId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Version': '4',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get asset: ${error.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting Frame.io asset details:', error);
    throw error;
  }
}

// Get all proxy URLs for an asset
async function getAssetProxies(assetId: string): Promise<any[]> {
  try {
    const token = await getFrameIoToken();
    
    const response = await fetch(`${FRAMEIO_API_URL}/assets/${assetId}/proxies`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Version': '4',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get proxies: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error getting Frame.io asset proxies:', error);
    throw error;
  }
}

// Create a review link for an asset
async function createReviewLink(assetId: string, expiresInDays = 7): Promise<string> {
  try {
    const token = await getFrameIoToken();
    
    const response = await fetch(`${FRAMEIO_API_URL}/review_links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Api-Version': '4',
      },
      body: JSON.stringify({
        asset_id: assetId,
        expires_at: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create review link: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data.short_url;
  } catch (error) {
    console.error('Error creating Frame.io review link:', error);
    throw error;
  }
}

export {
  getFrameIoToken,
  isAuthenticated,
  getUserInfo,
  getWorkspaces,
  getProjects,
  createProject,
  createFolder,
  generateUploadLink,
  getAssetDetails,
  getAssetProxies,
  createReviewLink,
  FrameIoV4Asset,
  FrameIoV4UploadLink,
}; 