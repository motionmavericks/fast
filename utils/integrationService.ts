// utils/integrationService.ts - Integration service that coordinates Frame.io, R2, LucidLink, and Wasabi

import * as frameio from './frameio';
import * as frameioService from './frameioService';
import * as r2storage from './r2storage';
import * as lucidlink from './lucidlink';
import * as wasabiStorage from './wasabiStorage';
import * as wasabiService from './wasabiService';
import { UploadLink, File } from './models';

/**
 * Represents the complete workflow for media asset management
 */
interface WorkflowResult {
  success: boolean;
  fileId?: string;
  assetId?: string;
  proxies?: {
    r2Keys: string[];
    lucidlinkPath?: string;
    wasabiKeys?: string[];
  };
  wasabi?: {
    originalKey?: string;
    proxyKeys?: string[];
  };
  error?: string;
}

/**
 * Initializes all integration services
 * This should be called during application startup
 */
async function initializeIntegrations(): Promise<boolean> {
  try {
    // Check environment variables
    const requiredEnvVars = [
      // Frame.io variables
      'FRAMEIO_CLIENT_ID',
      'FRAMEIO_CLIENT_SECRET',
      'FRAMEIO_TEAM_ID',
      'FRAMEIO_ROOT_PROJECT_ID',
      
      // R2 variables
      'CLOUDFLARE_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
      
      // Wasabi variables
      'WASABI_ACCESS_KEY_ID',
      'WASABI_SECRET_ACCESS_KEY',
      'WASABI_BUCKET_NAME',
      'WASABI_REGION',
      'WASABI_ENDPOINT',
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      return false;
    }
    
    // Configure Frame.io
    frameio.configureFrameIo({
      clientId: process.env.FRAMEIO_CLIENT_ID!,
      clientSecret: process.env.FRAMEIO_CLIENT_SECRET!,
      teamId: process.env.FRAMEIO_TEAM_ID!,
      rootProjectId: process.env.FRAMEIO_ROOT_PROJECT_ID!,
    });
    
    // Configure R2
    r2storage.configureR2({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      bucket: process.env.R2_BUCKET_NAME!,
    });
    
    // Configure Wasabi
    wasabiStorage.configureWasabi({
      accessKeyId: process.env.WASABI_ACCESS_KEY_ID!,
      secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY!,
      bucket: process.env.WASABI_BUCKET_NAME!,
      region: process.env.WASABI_REGION!,
      endpoint: process.env.WASABI_ENDPOINT!,
    });
    
    // Configure LucidLink if enabled
    if (process.env.LUCIDLINK_ENABLED === 'true') {
      lucidlink.configureLucidLink({
        basePath: process.env.LUCIDLINK_BASE_PATH || '',
        enabled: true,
      });
      
      // Check if LucidLink is available
      const lucidLinkAvailable = await lucidlink.isLucidLinkAvailable();
      if (!lucidLinkAvailable) {
        console.warn('LucidLink is enabled but not available. Check configuration and access permissions.');
      }
    }
    
    console.log('All integrations initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing integrations:', error);
    return false;
  }
}

/**
 * Handles the Frame.io webhook event for when an asset is ready
 * 
 * @param eventData The Frame.io webhook event data
 * @returns WorkflowResult with operation result
 */
async function handleFrameIoAssetReady(eventData: any): Promise<WorkflowResult> {
  try {
    const { asset_id, filename, filesize, filetype, link_id } = eventData;
    
    if (!asset_id || !link_id) {
      throw new Error('Missing required parameters: asset_id or link_id');
    }
    
    // Register the upload in our system
    const file = await frameioService.registerFrameIoUpload(
      link_id,
      asset_id,
      filename || 'unknown',
      filesize || 0,
      filetype || 'video/mp4'
    );
    
    return {
      success: true,
      fileId: file._id.toString(),
      assetId: asset_id,
    };
  } catch (error: any) {
    console.error('Error handling Frame.io asset ready event:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Handles the Frame.io webhook event for when proxies are ready
 * 
 * @param eventData The Frame.io webhook event data
 * @returns WorkflowResult with operation result
 */
async function handleFrameIoProxyReady(eventData: any): Promise<WorkflowResult> {
  try {
    const { asset_id } = eventData;
    
    if (!asset_id) {
      throw new Error('Missing required parameter: asset_id');
    }
    
    // Find the file record for this asset
    const file = await File.findOne({ 'frameIoData.assetId': asset_id });
    if (!file) {
      throw new Error(`No file record found for asset ID: ${asset_id}`);
    }
    
    // Get the original filename
    const fileName = file.fileName;
    
    // Get client and project names
    const { clientName, projectName } = file;
    
    // Process the proxies
    await frameioService.processProxies(
      asset_id,
      fileName,
      clientName,
      projectName,
      file._id.toString()
    );
    
    // Get updated file record with proxy information
    const updatedFile = await File.findById(file._id);
    
    // Schedule archival to Wasabi with a delay
    // This allows time for all proxies to be ready
    setTimeout(async () => {
      try {
        // Set Wasabi data status to processing
        await File.findByIdAndUpdate(file._id, {
          'wasabiData.status': 'processing'
        });
        
        // Archive to Wasabi
        const wasabiResult = await wasabiService.archiveFileToWasabi(file._id.toString());
        
        console.log(`Wasabi archival for file ${file._id} result:`, wasabiResult);
      } catch (error) {
        console.error(`Error archiving file ${file._id} to Wasabi:`, error);
      }
    }, 5 * 60 * 1000); // 5 minute delay
    
    return {
      success: true,
      fileId: file._id.toString(),
      assetId: asset_id,
      proxies: {
        r2Keys: updatedFile?.frameIoData?.proxies?.map((p: any) => p.r2Key) || [],
      },
    };
  } catch (error: any) {
    console.error('Error handling Frame.io proxy ready event:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Handles the Frame.io webhook event from Cloudflare Worker with fileId already determined
 * 
 * @param eventData The webhook event data with fileId included
 * @returns WorkflowResult with operation result
 */
async function handleFrameIoProxyReadyWithFileId(eventData: any): Promise<WorkflowResult> {
  try {
    const { fileId, assetId, r2Proxies, wasabiProxies, allProxies } = eventData;
    
    if (!fileId) {
      throw new Error('Missing required parameter: fileId');
    }
    
    // Find the file record
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error(`No file record found for ID: ${fileId}`);
    }
    
    // Update file record with proxy information
    const frameIoData = file.frameIoData || {};
    const r2Data = file.r2Data || {};
    
    // Update the file record with the proxies stored by the worker
    await File.findByIdAndUpdate(fileId, {
      status: 'completed',
      frameIoData: {
        ...frameIoData,
        proxyStatus: 'complete',
        availableProxies: allProxies || [],
      },
      r2Data: {
        ...r2Data,
        proxies: r2Proxies || [],
        status: 'complete',
        lastUpdated: new Date()
      }
    });
    
    // If LucidLink is enabled, copy highest quality proxy
    if (process.env.LUCIDLINK_ENABLED === 'true') {
      await copyHighQualityProxyToLucidLink(fileId);
    }
    
    console.log(`Updated proxy information for file ${fileId}`);
    
    return {
      success: true,
      fileId,
      assetId,
      proxies: {
        r2Keys: r2Proxies || [],
        wasabiKeys: wasabiProxies || []
      }
    };
  } catch (error: any) {
    console.error('Error handling Frame.io proxy ready with fileId event:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Copies a high-quality proxy from R2 to LucidLink
 * 
 * @param fileId The database file ID
 * @returns WorkflowResult with operation result
 */
async function copyHighQualityProxyToLucidLink(fileId: string): Promise<WorkflowResult> {
  try {
    // Check if LucidLink is available
    const lucidLinkAvailable = await lucidlink.isLucidLinkAvailable();
    if (!lucidLinkAvailable) {
      throw new Error('LucidLink is not available');
    }
    
    // Get file information
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }
    
    // Get highest quality proxy from R2
    const proxies = file.frameIoData?.proxies || [];
    if (proxies.length === 0) {
      throw new Error('No proxies available for this file');
    }
    
    // Sort proxies by quality (assuming they follow naming conventions)
    const sortedProxies = [...proxies].sort((a, b) => {
      const aQuality = a.profile.includes('2160') ? 4 :
                     a.profile.includes('1080') ? 3 :
                     a.profile.includes('720') ? 2 :
                     a.profile.includes('540') ? 1 : 0;
      
      const bQuality = b.profile.includes('2160') ? 4 :
                     b.profile.includes('1080') ? 3 :
                     b.profile.includes('720') ? 2 :
                     b.profile.includes('540') ? 1 : 0;
      
      return bQuality - aQuality; // Descending order
    });
    
    const highestQualityProxy = sortedProxies[0];
    
    // Get the R2 URL for the proxy
    const r2Url = await r2storage.getSignedReadUrl(highestQualityProxy.r2Key, 3600);
    
    // Prepare filename for LucidLink
    const fileNameWithoutExt = file.fileName.split('.').slice(0, -1).join('.');
    const proxyFileName = `${fileNameWithoutExt}_${highestQualityProxy.profile}.mp4`;
    
    // Store in LucidLink
    const result = await lucidlink.storeFileFromUrl(
      r2Url,
      file.clientName,
      file.projectName,
      proxyFileName
    );
    
    if (!result.success) {
      throw new Error(`Failed to store file in LucidLink: ${result.error}`);
    }
    
    // Update file record
    await File.findByIdAndUpdate(fileId, {
      'lucidLinkData.path': result.path,
      'lucidLinkData.status': 'complete',
    });
    
    return {
      success: true,
      fileId,
      proxies: {
        lucidlinkPath: result.path,
      },
    };
  } catch (error: any) {
    console.error('Error copying proxy to LucidLink:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Archives a file to Wasabi for long-term storage
 * 
 * @param fileId The database file ID
 * @returns WorkflowResult with operation result
 */
async function archiveFileToWasabi(fileId: string): Promise<WorkflowResult> {
  try {
    const result = await wasabiService.archiveFileToWasabi(fileId);
    
    if (!result.success) {
      throw new Error(`Failed to archive file to Wasabi: ${result.error}`);
    }
    
    return {
      success: true,
      fileId,
      wasabi: {
        originalKey: result.originalKey,
        proxyKeys: result.proxyKeys,
      },
    };
  } catch (error: any) {
    console.error('Error archiving file to Wasabi:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get adaptive streaming URLs for a file
 * 
 * @param fileId The database file ID
 * @returns Object containing URLs for different quality levels
 */
async function getAdaptiveStreamingUrls(fileId: string): Promise<{ [key: string]: string }> {
  try {
    // Get file information
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }
    
    // Get proxies from R2
    const proxies = file.frameIoData?.proxies || [];
    if (proxies.length === 0) {
      throw new Error('No proxies available for this file');
    }
    
    // Generate streaming URLs for each quality
    const streamingUrls: { [key: string]: string } = {};
    
    for (const proxy of proxies) {
      // Map quality profile to a user-friendly label
      let qualityLabel = '';
      
      if (proxy.profile.includes('2160')) {
        qualityLabel = '4K';
      } else if (proxy.profile.includes('1080')) {
        qualityLabel = 'Full HD';
      } else if (proxy.profile.includes('720')) {
        qualityLabel = 'HD';
      } else if (proxy.profile.includes('540')) {
        qualityLabel = 'Medium';
      } else if (proxy.profile.includes('360')) {
        qualityLabel = 'Low';
      } else {
        qualityLabel = proxy.profile;
      }
      
      // Generate streaming URL
      const streamingUrl = r2storage.getVideoStreamUrl(proxy.r2Key);
      streamingUrls[qualityLabel] = streamingUrl;
    }
    
    return streamingUrls;
  } catch (error) {
    console.error('Error getting adaptive streaming URLs:', error);
    throw error;
  }
}

/**
 * Complete workflow for uploading a file
 * This is the main entry point for the upload workflow
 * 
 * @param linkId The upload link ID
 * @param fileName The file name
 * @param fileSize The file size
 * @param fileType The file MIME type
 * @returns WorkflowResult with operation result
 */
async function startUploadWorkflow(
  linkId: string,
  fileName: string,
  fileSize: number,
  fileType: string
): Promise<WorkflowResult> {
  try {
    // Get upload link details
    const link = await UploadLink.findOne({ linkId });
    if (!link) {
      throw new Error(`Upload link not found: ${linkId}`);
    }
    
    // Create Frame.io upload link
    const frameIoData = await frameioService.createFrameIoUploadLink(link, fileName, fileSize, fileType);
    
    // Return asset data to client for direct upload
    return {
      success: true,
      assetId: frameIoData.assetId,
    };
  } catch (error: any) {
    console.error('Error starting upload workflow:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Schedule archival of files to Wasabi based on age
 * 
 * @param daysThreshold Age threshold in days for archival
 * @returns Number of files scheduled for archival
 */
async function scheduleWasabiArchival(daysThreshold = 1): Promise<number> {
  return wasabiService.scheduleFileArchival(daysThreshold);
}

/**
 * Get a download URL for the original file from Wasabi
 * 
 * @param fileId The database file ID
 * @param expiresInSeconds URL expiration time in seconds
 * @returns Signed URL for downloading the original file
 */
async function getOriginalFileDownloadUrl(fileId: string, expiresInSeconds = 3600): Promise<string> {
  return wasabiService.getOriginalFileUrl(fileId, expiresInSeconds);
}

export async function initializeFrameIo(): Promise<void> {
  try {
    console.log('Initializing Frame.io integration...');
    await frameio.getUserAndInitialize();
    console.log('Frame.io integration initialized successfully');
  } catch (error) {
    console.error('Error initializing Frame.io integration:', error);
    throw error;
  }
}

export {
  initializeIntegrations,
  handleFrameIoAssetReady,
  handleFrameIoProxyReady,
  handleFrameIoProxyReadyWithFileId,
  copyHighQualityProxyToLucidLink,
  archiveFileToWasabi,
  getAdaptiveStreamingUrls,
  startUploadWorkflow,
  scheduleWasabiArchival,
  getOriginalFileDownloadUrl,
  WorkflowResult,
};