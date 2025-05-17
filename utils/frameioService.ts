// utils/frameioService.ts - Enhanced Frame.io integration service

import { nanoid } from 'nanoid';
import * as frameio from './frameio';
import * as r2storage from './r2storage';
import * as lucidlink from './lucidlink';
import { UploadLink, File } from './models';

/**
 * Represents the structure for Frame.io asset data
 */
interface FrameIoAssetData {
  assetId: string;
  parentId: string;
  uploadUrl: string;
  expiresAt: string;
}

/**
 * Represents a proxy video quality level
 */
interface ProxyQuality {
  profile: string;
  resolution: string;
  label: string;
}

/**
 * Available proxy quality levels
 */
const PROXY_QUALITIES: ProxyQuality[] = [
  { profile: 'h264_2160p', resolution: '3840x2160', label: '4K' },
  { profile: 'h264_1080p', resolution: '1920x1080', label: 'Full HD' },
  { profile: 'h264_720p', resolution: '1280x720', label: 'HD' },
  { profile: 'h264_540p', resolution: '960x540', label: 'Medium' },
  { profile: 'h264_360p', resolution: '640x360', label: 'Low' },
];

/**
 * Finds or creates a client folder in Frame.io
 * 
 * @param clientName The name of the client
 * @returns The Frame.io folder ID
 */
async function findOrCreateClientFolder(clientName: string): Promise<string> {
  try {
    // Get the root project ID from environment variables
    const rootProjectId = process.env.FRAMEIO_ROOT_PROJECT_ID;
    if (!rootProjectId) {
      throw new Error('Frame.io root project ID not configured');
    }

    // Normalize client name for folder creation
    const normalizedClientName = clientName
      .trim()
      .replace(/[^a-zA-Z0-9-_]/g, ' ')
      .replace(/\s+/g, ' ');

    // Create the client folder in Frame.io
    const folder = await frameio.createProjectFolder(normalizedClientName);
    
    return folder.id;
  } catch (error) {
    console.error('Error creating client folder in Frame.io:', error);
    throw error;
  }
}

/**
 * Finds or creates a project folder within a client folder
 * 
 * @param clientFolderId The parent client folder ID
 * @param projectName The name of the project
 * @returns The Frame.io project folder ID
 */
async function findOrCreateProjectFolder(clientFolderId: string, projectName: string): Promise<string> {
  try {
    // Normalize project name for folder creation
    const normalizedProjectName = projectName
      .trim()
      .replace(/[^a-zA-Z0-9-_]/g, ' ')
      .replace(/\s+/g, ' ');

    // Create the project folder within the client folder
    const folder = await frameio.createProjectFolder(normalizedProjectName, clientFolderId);
    
    return folder.id;
  } catch (error) {
    console.error('Error creating project folder in Frame.io:', error);
    throw error;
  }
}

/**
 * Creates a Frame.io asset for upload and generates an upload link
 * 
 * @param clientName The client name
 * @param projectName The project name
 * @param filename Optional filename (defaults to a unique placeholder)
 * @param filesize Optional filesize (defaults to 100GB)
 * @param filetype Optional filetype (defaults to video/mp4)
 * @returns The Frame.io asset data with upload URL
 */
async function createUploadAsset(
  clientName: string,
  projectName: string,
  filename: string = `upload_${nanoid(10)}`,
  filesize: number = 100 * 1024 * 1024 * 1024, // 100GB default
  filetype: string = 'video/mp4'
): Promise<FrameIoAssetData> {
  try {
    // Create folder structure
    const clientFolderId = await findOrCreateClientFolder(clientName);
    const projectFolderId = await findOrCreateProjectFolder(clientFolderId, projectName);

    // Generate upload link
    const uploadLink = await frameio.generateUploadLink(
      projectFolderId,
      filename,
      filesize,
      filetype
    );

    return {
      assetId: uploadLink.asset_id,
      parentId: projectFolderId,
      uploadUrl: uploadLink.upload_url,
      expiresAt: uploadLink.expires_at,
    };
  } catch (error) {
    console.error('Error creating Frame.io upload asset:', error);
    throw error;
  }
}

/**
 * Creates upload links for the specified client and project
 * This is used when generating a new upload link in the admin panel
 * 
 * @param uploadLink The upload link database record
 * @param fileName Optional custom file name
 * @param fileSize Optional file size in bytes
 * @param fileType Optional file MIME type
 * @returns The Frame.io asset data
 */
async function createFrameIoUploadLink(
  uploadLink: any, 
  fileName?: string, 
  fileSize?: number, 
  fileType?: string
): Promise<FrameIoAssetData> {
  try {
    const { clientName, projectName } = uploadLink;

    // Create the Frame.io asset with optional parameters
    const assetData = await createUploadAsset(
      clientName,
      projectName,
      fileName,
      fileSize,
      fileType
    );

    // Update the upload link with Frame.io data
    await UploadLink.findByIdAndUpdate(uploadLink._id, {
      frameIoData: {
        assetId: assetData.assetId,
        projectId: assetData.parentId,
        expiresAt: assetData.expiresAt,
      }
    });

    return assetData;
  } catch (error) {
    console.error('Error creating Frame.io upload link:', error);
    throw error;
  }
}

/**
 * Processes proxies for a Frame.io asset by moving them to R2 and LucidLink
 * 
 * @param assetId The Frame.io asset ID
 * @param fileName The original file name
 * @param clientName The client name
 * @param projectName The project name
 * @param fileId The database file ID
 */
async function processProxies(
  assetId: string,
  fileName: string,
  clientName: string,
  projectName: string,
  fileId: string
): Promise<void> {
  try {
    // Get all available proxies for the asset
    const proxies = await frameio.getAssetProxies(assetId);
    if (!proxies || proxies.length === 0) {
      console.warn(`No proxies found for asset: ${assetId}`);
      return;
    }

    // Store proxies in R2 for streaming
    const r2Proxies = [];
    for (const proxy of proxies) {
      const quality = proxy.profile; // e.g., 'h264_high' or 'h264_540'
      const r2Key = `proxies/${projectName}/${clientName}/${fileId}/${quality}.mp4`;
      
      // Upload the proxy to R2
      const uploadResult = await r2storage.uploadFromUrl(proxy.urls.ssl_url, r2Key);
      
      if (uploadResult.success) {
        r2Proxies.push({
          quality,
          r2Key,
          profile: proxy.profile,
        });
      }
    }

    // Find highest quality proxy for LucidLink
    const highQualityProxy = proxies
      .sort((a, b) => {
        // Simple sorting by resolution/quality if available
        const aHeight = a.profile.includes('2160') ? 2160 : 
                      a.profile.includes('1080') ? 1080 : 
                      a.profile.includes('720') ? 720 : 
                      a.profile.includes('540') ? 540 : 360;
        
        const bHeight = b.profile.includes('2160') ? 2160 : 
                      b.profile.includes('1080') ? 1080 :
                      b.profile.includes('720') ? 720 : 
                      b.profile.includes('540') ? 540 : 360;
        
        return bHeight - aHeight; // Descending order to get highest quality first
      })[0];
    
    // Store highest quality proxy in LucidLink
    if (highQualityProxy) {
      const fileNameWithoutExt = fileName.split('.').slice(0, -1).join('.');
      const proxyFileName = `${fileNameWithoutExt}_${highQualityProxy.profile}.mp4`;
      
      await lucidlink.storeFileFromUrl(
        highQualityProxy.urls.ssl_url,
        clientName,
        projectName,
        proxyFileName
      );
    }

    // Update file record with proxy information
    await File.findByIdAndUpdate(fileId, {
      status: 'completed',
      frameIoData: {
        assetId,
        proxyStatus: 'complete',
        proxies: r2Proxies,
      }
    });
  } catch (error) {
    console.error('Error processing proxies:', error);
    throw error;
  }
}

/**
 * Registers a file uploaded through Frame.io
 * 
 * @param linkId The upload link ID
 * @param assetId The Frame.io asset ID
 * @param fileName The file name
 * @param fileSize The file size in bytes
 * @param fileType The file MIME type
 * @returns The created file record
 */
async function registerFrameIoUpload(
  linkId: string,
  assetId: string,
  fileName: string,
  fileSize: number,
  fileType: string
): Promise<any> {
  try {
    // Get the upload link
    const link = await UploadLink.findOne({ linkId });
    if (!link) {
      throw new Error(`Upload link not found: ${linkId}`);
    }

    // Create a File record
    const file = await File.create({
      fileName,
      fileSize,
      fileType,
      uploadedVia: link._id,
      clientName: link.clientName,
      projectName: link.projectName,
      status: 'processing',
      frameIoData: {
        assetId,
        projectId: link.frameIoData?.projectId,
      }
    });

    // Update the link with new upload count and last used date
    await UploadLink.findByIdAndUpdate(link._id, {
      $inc: { uploadCount: 1 },
      lastUsedAt: new Date()
    });

    return file;
  } catch (error) {
    console.error('Error registering Frame.io upload:', error);
    throw error;
  }
}

export {
  createFrameIoUploadLink,
  processProxies,
  registerFrameIoUpload,
  ProxyQuality,
  PROXY_QUALITIES,
  FrameIoAssetData
};
