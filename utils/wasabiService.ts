// utils/wasabiService.ts - Service for archiving content to Wasabi storage

import * as wasabiStorage from './wasabiStorage';
import * as frameio from './frameio';
import { File } from './models';

/**
 * Archives the original file and all proxies to Wasabi storage
 * 
 * @param fileId The database file ID
 * @returns Result of archival operation
 */
async function archiveFileToWasabi(fileId: string): Promise<{
  success: boolean;
  originalKey?: string;
  proxyKeys?: string[];
  error?: string;
}> {
  try {
    // Get file information
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    // Ensure Frame.io asset ID is available
    const assetId = file.frameIoData?.assetId;
    if (!assetId) {
      throw new Error('Frame.io asset ID not found for this file');
    }

    // Get asset details from Frame.io
    const asset = await frameio.getAssetDetails(assetId);
    
    // Get all available proxies for the asset
    const proxies = await frameio.getAssetProxies(assetId);
    
    // Prepare paths for storage
    const clientName = file.clientName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    const projectName = file.projectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    const fileName = file.fileName.replace(/[^a-zA-Z0-9-_\.]/g, '-').toLowerCase();
    
    const originalKey = `archives/${clientName}/${projectName}/originals/${fileName}`;
    const proxyKeys: string[] = [];

    // Create object to track upload operations
    const uploadPromises: Promise<any>[] = [];
    const results: {
      originalUploaded: boolean;
      proxyKeys: string[];
    } = {
      originalUploaded: false,
      proxyKeys: []
    };

    // First, upload the original file
    // For Frame.io, we need to get the download URL for the original
    let originalDownloadUrl;
    
    // Check if asset has download_link property
    if (asset.download_link) {
      originalDownloadUrl = asset.download_link;
    } else {
      // Create a download link if not available
      const originalUrl = await frameio.createShareLink(assetId, 1); // 1 day expiry
      originalDownloadUrl = originalUrl;
    }

    // Upload the original to Wasabi
    if (originalDownloadUrl) {
      uploadPromises.push(
        wasabiStorage.uploadFromUrl(originalDownloadUrl, originalKey, file.fileType)
          .then(result => {
            if (result.success) {
              results.originalUploaded = true;
            }
            return result;
          })
      );
    }

    // Then, upload all proxies
    if (proxies && proxies.length > 0) {
      for (const proxy of proxies) {
        const proxyUrl = proxy.urls.ssl_url;
        const proxyProfile = proxy.profile;
        const proxyKey = `archives/${clientName}/${projectName}/proxies/${fileName.split('.')[0]}_${proxyProfile}.mp4`;
        
        proxyKeys.push(proxyKey);
        
        uploadPromises.push(
          wasabiStorage.uploadFromUrl(proxyUrl, proxyKey, 'video/mp4')
            .then(result => {
              if (result.success) {
                results.proxyKeys.push(proxyKey);
              }
              return result;
            })
        );
      }
    }

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);

    // Update the file record
    await File.findByIdAndUpdate(fileId, {
      'wasabiData.originalKey': originalKey,
      'wasabiData.proxyKeys': proxyKeys,
      'wasabiData.status': results.originalUploaded ? 'complete' : 'error',
      'wasabiData.archivedAt': new Date(),
    });

    return {
      success: results.originalUploaded,
      originalKey,
      proxyKeys: results.proxyKeys,
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
 * Retrieves a signed URL for the original file from Wasabi
 * 
 * @param fileId The database file ID
 * @param expiresInSeconds URL expiration time in seconds
 * @returns Signed URL for the original file
 */
async function getOriginalFileUrl(fileId: string, expiresInSeconds = 3600): Promise<string> {
  try {
    // Get file information
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    // Check if file has been archived to Wasabi
    const originalKey = file.wasabiData?.originalKey;
    if (!originalKey) {
      throw new Error('File has not been archived to Wasabi yet');
    }

    // Check if file exists in Wasabi
    const exists = await wasabiStorage.fileExists(originalKey);
    if (!exists) {
      throw new Error('Original file not found in Wasabi storage');
    }

    // Generate signed URL
    const url = await wasabiStorage.getSignedReadUrl(
      originalKey, 
      expiresInSeconds,
      true,
      file.fileName
    );

    return url;
  } catch (error) {
    console.error('Error getting original file URL from Wasabi:', error);
    throw error;
  }
}

/**
 * Schedules archival of files that haven't been archived yet
 * 
 * @param daysThreshold Only archive files older than this many days
 * @returns Count of files scheduled for archival
 */
async function scheduleFileArchival(daysThreshold = 1): Promise<number> {
  try {
    // Calculate the date threshold
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    // Find files that need to be archived
    // - Older than threshold date
    // - Status is 'completed'
    // - Wasabi status is not 'complete'
    const filesToArchive = await File.find({
      createdAt: { $lt: thresholdDate },
      status: 'completed',
      $or: [
        { 'wasabiData.status': { $ne: 'complete' } },
        { 'wasabiData.status': { $exists: false } }
      ]
    }).limit(50); // Process in batches to avoid overloading

    // Schedule archival for each file
    for (const file of filesToArchive) {
      // Set status to 'processing' to avoid duplicate processing
      await File.findByIdAndUpdate(file._id, {
        'wasabiData.status': 'processing'
      });

      // Schedule archival (in a real system, this would be a queue job)
      // For now, we'll just do it directly
      await archiveFileToWasabi(file._id.toString());
    }

    return filesToArchive.length;
  } catch (error) {
    console.error('Error scheduling file archival:', error);
    throw error;
  }
}

/**
 * Upload a proxy file from URL to Wasabi
 * 
 * @param fileId MongoDB file ID
 * @param proxyUrl URL of the proxy to download and upload to Wasabi
 * @param proxyProfile Profile of the proxy (e.g., 'h264_720p')
 * @param fileName Original file name
 * @param clientName Client name
 * @param projectName Project name
 * @returns Result object with success status and Wasabi key
 */
export async function uploadProxyToWasabi(
  fileId: string,
  proxyUrl: string,
  proxyProfile: string,
  fileName: string,
  clientName: string,
  projectName: string
): Promise<{ success: boolean; wasabiKey?: string; error?: string }> {
  try {
    // Download the file from proxyUrl
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Failed to download proxy: ${response.statusText}`);
    }
    
    // Get the file content as ArrayBuffer
    const fileContent = await response.arrayBuffer();
    
    // Create the Wasabi key with folder structure
    // Format: proxies/{clientName}/{projectName}/{fileId}/{proxyProfile}.mp4
    const fileNameWithoutExt = fileName.split('.').slice(0, -1).join('.');
    const wasabiKey = `proxies/${clientName}/${projectName}/${fileId}/${fileNameWithoutExt}_${proxyProfile}.mp4`;
    
    // Upload to Wasabi
    await wasabiStorage.uploadBuffer(
      Buffer.from(fileContent),
      wasabiKey,
      'video/mp4'
    );
    
    console.log(`Uploaded proxy ${proxyProfile} to Wasabi: ${wasabiKey}`);
    
    return {
      success: true,
      wasabiKey
    };
  } catch (error: any) {
    console.error(`Error uploading proxy to Wasabi:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

export {
  archiveFileToWasabi,
  getOriginalFileUrl,
  scheduleFileArchival,
  uploadProxyToWasabi,
};