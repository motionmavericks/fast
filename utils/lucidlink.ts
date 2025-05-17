// utils/lucidlink.ts - Integration with LucidLink for high-quality asset storage

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

// These would be set during the setup process and stored in environment variables
let lucidLinkConfig = {
  basePath: process.env.LUCIDLINK_BASE_PATH || '',
  enabled: process.env.LUCIDLINK_ENABLED === 'true',
};

// Types for LucidLink operations
interface LucidLinkResponse {
  success: boolean;
  path?: string;
  error?: string;
}

// Configure the LucidLink integration
function configureLucidLink(config: typeof lucidLinkConfig): void {
  lucidLinkConfig = {
    ...lucidLinkConfig,
    ...config,
  };
}

// Check if LucidLink is properly configured and available
async function isLucidLinkAvailable(): Promise<boolean> {
  if (!lucidLinkConfig.enabled || !lucidLinkConfig.basePath) {
    return false;
  }

  try {
    // Check if the base path exists and is accessible
    await fs.promises.access(lucidLinkConfig.basePath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (error) {
    console.error('LucidLink is not available:', error);
    return false;
  }
}

// Create a project folder structure in LucidLink
async function createProjectFolder(projectName: string, clientName: string): Promise<LucidLinkResponse> {
  if (!await isLucidLinkAvailable()) {
    return {
      success: false,
      error: 'LucidLink is not available or properly configured',
    };
  }

  try {
    // Create a folder structure like: basePath/clientName/projectName
    const clientPath = path.join(lucidLinkConfig.basePath, clientName);
    const projectPath = path.join(clientPath, projectName);

    // Create client folder if it doesn't exist
    if (!fs.existsSync(clientPath)) {
      await fs.promises.mkdir(clientPath, { recursive: true });
    }

    // Create project folder if it doesn't exist
    if (!fs.existsSync(projectPath)) {
      await fs.promises.mkdir(projectPath, { recursive: true });
    }

    return {
      success: true,
      path: projectPath,
    };
  } catch (error: any) {
    console.error('Error creating project folder in LucidLink:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Store a file in LucidLink from a URL (usually a high-quality proxy from Frame.io)
async function storeFileFromUrl(
  sourceUrl: string,
  clientName: string,
  projectName: string,
  fileName: string
): Promise<LucidLinkResponse> {
  if (!await isLucidLinkAvailable()) {
    return {
      success: false,
      error: 'LucidLink is not available or properly configured',
    };
  }

  try {
    // Ensure the project folder exists
    const projectFolderResult = await createProjectFolder(projectName, clientName);
    if (!projectFolderResult.success) {
      throw new Error(`Failed to create project folder: ${projectFolderResult.error}`);
    }

    // Path where the file will be stored
    const filePath = path.join(projectFolderResult.path!, fileName);

    // Download the file from the URL
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
    }

    // Create write stream
    const fileStream = createWriteStream(filePath);
    
    // Use Node.js stream pipeline for efficient transfer
    await pipeline(response.body!, fileStream);

    return {
      success: true,
      path: filePath,
    };
  } catch (error: any) {
    console.error('Error storing file in LucidLink:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Check if a file exists in LucidLink
async function fileExists(
  clientName: string,
  projectName: string,
  fileName: string
): Promise<boolean> {
  if (!await isLucidLinkAvailable()) {
    return false;
  }

  try {
    const filePath = path.join(lucidLinkConfig.basePath, clientName, projectName, fileName);
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

// List all files in a project
async function listProjectFiles(
  clientName: string,
  projectName: string
): Promise<string[]> {
  if (!await isLucidLinkAvailable()) {
    return [];
  }

  try {
    const projectPath = path.join(lucidLinkConfig.basePath, clientName, projectName);
    
    // Check if project folder exists
    if (!fs.existsSync(projectPath)) {
      return [];
    }

    // Get all files in the project folder
    const files = await fs.promises.readdir(projectPath);
    return files;
  } catch (error) {
    console.error('Error listing project files in LucidLink:', error);
    return [];
  }
}

// Get file stats (size, creation date, etc.)
async function getFileStats(
  clientName: string,
  projectName: string,
  fileName: string
): Promise<fs.Stats | null> {
  if (!await isLucidLinkAvailable()) {
    return null;
  }

  try {
    const filePath = path.join(lucidLinkConfig.basePath, clientName, projectName, fileName);
    const stats = await fs.promises.stat(filePath);
    return stats;
  } catch (error) {
    console.error('Error getting file stats from LucidLink:', error);
    return null;
  }
}

// Create a custom folder in LucidLink
async function createCustomFolder(folderPath: string): Promise<LucidLinkResponse> {
  if (!await isLucidLinkAvailable()) {
    return {
      success: false,
      error: 'LucidLink is not available or properly configured',
    };
  }

  try {
    // Create the full folder path
    await fs.promises.mkdir(folderPath, { recursive: true });

    return {
      success: true,
      path: folderPath,
    };
  } catch (error: any) {
    console.error('Error creating custom folder in LucidLink:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export {
  configureLucidLink,
  isLucidLinkAvailable,
  createProjectFolder,
  storeFileFromUrl,
  fileExists,
  listProjectFiles,
  getFileStats,
  createCustomFolder,
}; 