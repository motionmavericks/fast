import { IAgency, IClient, Project, IProject } from './projectModels';
import * as frameioV4 from './frameioV4';
import * as r2storage from './r2storage';
import * as lucidlink from './lucidlink';

// Industry standard folder structure for post-production projects
const STANDARD_FOLDER_STRUCTURE = {
  'Production': [
    'Camera',
    'Sound',
    'Lighting',
    'Direction',
    'Script'
  ],
  'Post-Production': [
    'Editorial',
    'VFX',
    'Sound_Design',
    'Music',
    'Color',
    'Graphics'
  ],
  'Deliverables': [
    'Approvals',
    'Final_Masters',
    'Social_Media',
    'Broadcast',
    'Web'
  ],
  'Assets': [
    'Footage',
    'Audio',
    'Graphics',
    'Stock',
    'Photos'
  ],
  'Admin': [
    'Contracts',
    'Briefs',
    'Meetings',
    'Feedback'
  ]
};

// Generate a project ID based on agency and client codes
export async function generateProjectId(
  agency: IAgency,
  client: IClient
): Promise<string> {
  try {
    // Get the agency and client codes
    const agencyCode = agency.code;
    const clientCode = client.code;
    
    // Find the latest project ID for this client to determine the sequence number
    const latestProject = await Project.findOne({ 
      projectId: { $regex: `^MM-${agencyCode}-${clientCode}-` } 
    })
    .sort({ createdAt: -1 });
    
    let sequenceNumber = 1;
    
    if (latestProject) {
      // Extract the sequence number from the latest project ID
      const match = latestProject.projectId.match(/(\d+)$/);
      if (match && match[1]) {
        sequenceNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    // Format the sequence number as a 3-digit string (e.g., 001, 012, 123)
    const formattedSequence = sequenceNumber.toString().padStart(3, '0');
    
    // Generate the project ID
    const projectId = `MM-${agencyCode}-${clientCode}-${formattedSequence}`;
    
    return projectId;
  } catch (error) {
    console.error('Error generating project ID:', error);
    throw error;
  }
}

// Create the standard folder structure in Frame.io
export async function createFrameIoFolderStructure(
  projectId: string,
  rootFolderId: string
): Promise<{
  folderId: string;
  path: string;
}> {
  try {
    // Create the project folder using V4 API
    const projectFolder = await frameioV4.createFolder(rootFolderId, projectId);
    
    // Create each main category folder
    for (const [category, subfolders] of Object.entries(STANDARD_FOLDER_STRUCTURE)) {
      const categoryFolder = await frameioV4.createFolder(projectFolder.id, category);
      
      // Create each subfolder within the category
      for (const subfolder of subfolders) {
        await frameioV4.createFolder(categoryFolder.id, subfolder);
      }
    }
    
    return {
      folderId: projectFolder.id,
      path: projectId
    };
  } catch (error) {
    console.error('Error creating Frame.io folder structure:', error);
    throw error;
  }
}

// Create the standard folder structure in R2
export function createR2FolderStructure(
  projectId: string
): string {
  try {
    // For R2, we just need to define the base path for the project
    // Actual folders are created when files are uploaded
    const basePath = `projects/${projectId}`;
    
    return basePath;
  } catch (error) {
    console.error('Error creating R2 folder structure:', error);
    throw error;
  }
}

// Create the standard folder structure in LucidLink
export async function createLucidLinkFolderStructure(
  projectId: string
): Promise<string> {
  try {
    // First create the project folder
    const projectFolderResult = await lucidlink.createProjectFolder(projectId, 'Projects');
    
    if (!projectFolderResult.success || !projectFolderResult.path) {
      throw new Error('Failed to create project folder in LucidLink');
    }
    
    const projectPath = projectFolderResult.path;
    
    // Create each main category folder
    for (const [category, subfolders] of Object.entries(STANDARD_FOLDER_STRUCTURE)) {
      // Create category folder within the project folder
      const categoryResult = await lucidlink.createCustomFolder(`${projectPath}/${category}`);
      
      if (categoryResult.success) {
        // Create each subfolder within the category
        for (const subfolder of subfolders) {
          await lucidlink.createCustomFolder(`${projectPath}/${category}/${subfolder}`);
        }
      }
    }
    
    return projectPath;
  } catch (error) {
    console.error('Error creating LucidLink folder structure:', error);
    throw error;
  }
}

// Create a new folder in LucidLink manually (extending the lucidlink utility)
async function createCustomFolder(folderPath: string): Promise<{
  success: boolean;
  path?: string;
  error?: string;
}> {
  try {
    // This would use the lucidlink utility functions
    // For now, we're simulating the process
    console.log(`Creating folder in LucidLink: ${folderPath}`);
    
    return {
      success: true,
      path: folderPath,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Create a complete folder structure across all storage systems
export async function createProjectFolderStructure(
  project: IProject
): Promise<{
  frameio: { folderId: string; path: string };
  r2: { basePath: string };
  lucidlink: { path: string };
}> {
  try {
    // Use project ID as the base folder name across all systems
    const projectId = project.projectId;
    
    // Frame.io folder structure
    const frameioRoot = process.env.FRAMEIO_ROOT_PROJECT_ID || '';
    const frameioStructure = await createFrameIoFolderStructure(projectId, frameioRoot);
    
    // R2 folder structure
    const r2BasePath = createR2FolderStructure(projectId);
    
    // LucidLink folder structure
    const lucidlinkPath = await createLucidLinkFolderStructure(projectId);
    
    return {
      frameio: frameioStructure,
      r2: { basePath: r2BasePath },
      lucidlink: { path: lucidlinkPath },
    };
  } catch (error) {
    console.error('Error creating project folder structure:', error);
    throw error;
  }
}

// Check if a project ID already exists
export async function projectIdExists(projectId: string): Promise<boolean> {
  try {
    const project = await Project.findOne({ projectId });
    return !!project;
  } catch (error) {
    console.error('Error checking if project ID exists:', error);
    throw error;
  }
}

// Generate a relative path for a file within the project structure
export function generateRelativePath(
  category: keyof typeof STANDARD_FOLDER_STRUCTURE,
  subfolder: string,
  filename: string
): string {
  // Validate category and subfolder
  if (!STANDARD_FOLDER_STRUCTURE[category]) {
    throw new Error(`Invalid category: ${category}`);
  }
  
  if (!STANDARD_FOLDER_STRUCTURE[category].includes(subfolder)) {
    throw new Error(`Invalid subfolder: ${subfolder} in category: ${category}`);
  }
  
  return `${category}/${subfolder}/${filename}`;
}

// Get the full folder structure as a nested object
export function getStandardFolderStructure() {
  return { ...STANDARD_FOLDER_STRUCTURE };
}

// Export data for consumption in the frontend
export const PROJECT_CATEGORIES = Object.keys(STANDARD_FOLDER_STRUCTURE);
export const SUBFOLDERS_BY_CATEGORY = STANDARD_FOLDER_STRUCTURE;
