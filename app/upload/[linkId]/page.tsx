'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { 
  Container, 
  Paper, 
  Title, 
  Text, 
  Group, 
  Stack,
  Button,
  Center,
  Loader,
  Progress,
  Badge,
  Alert,
  Box,
  ActionIcon,
  Table,
  Tooltip,
  ThemeIcon,
  SimpleGrid,
  BackgroundImage,
  Overlay,
  Modal
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconCheck, 
  IconX, 
  IconUpload, 
  IconAlertCircle, 
  IconFileUpload, 
  IconFile, 
  IconTrash,
  IconFileZip,
  IconFileText,
  IconVideo,
  IconPhoto,
  IconMusic,
  IconFiles,
  IconCloudUpload
} from '@tabler/icons-react';

interface UploadLink {
  _id: string;
  linkId: string;
  clientName: string;
  projectName: string;
  isActive: boolean;
  expiresAt: string | null;
}

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  speed?: string;
  startTime?: number;
  timeRemaining?: string;
  cancelController?: AbortController;
}

// Format bytes to human-readable file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format bytes/second to human-readable speed
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s';
  
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  
  return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format time remaining in a human-readable way
function formatTimeRemaining(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return 'Less than a minute';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Get file icon based on mimetype
function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <IconPhoto size={24} />;
  if (type.startsWith('video/')) return <IconVideo size={24} />;
  if (type.startsWith('audio/')) return <IconMusic size={24} />;
  if (type.includes('pdf')) return <IconFileText size={24} />;
  if (type.includes('zip') || type.includes('rar')) return <IconFileZip size={24} />;
  return <IconFile size={24} />;
}

const ACCEPTED_FILE_TYPES = [
  // Video
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg',
  // Image
  'image/jpeg', 'image/png', 'image/tiff',
  // Documents
  'application/pdf',
  // Archives
  'application/zip', 'application/x-rar-compressed',
  // Production specific
  'application/x-premiere-project', 'application/x-aftereffects-project',
  'application/octet-stream' // For various proprietary formats
];

export default function UploadPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const [link, setLink] = useState<UploadLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const dropzoneRef = useRef<HTMLDivElement | null>(null);
  const [exitConfirmModalOpened, { open: openExitConfirmModal, close: closeExitConfirmModal }] = useDisclosure(false);
  // Add presigned URL cache state
  const [presignedUrlCache, setPresignedUrlCache] = useState<{[key: string]: {url: string, storageKey: string, expires: number}}>({});
  const presignedUrlRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Calculate total size of all files
  const totalSize = files.reduce((sum, file) => sum + file.file.size, 0);

  // Fetch link details and initialize presigned URL cache
  useEffect(() => {
    const validateLink = async () => {
      try {
        setLoading(true);
        
        // Make sure linkId is a string - Next.js params can sometimes be arrays
        const linkIdValue = Array.isArray(linkId) ? linkId[0] : linkId as string;
        
        const response = await fetch(`/api/links/${linkIdValue}/validate`);
        
        if (!response.ok) {
          setInvalid(true);
          setLoading(false);
          return;
        }

        const data = await response.json();
        setLink(data);
        setLoading(false);
        
        // Initialize presigned URL cache once link is validated
        if (data.isActive) {
          initializePresignedUrlCache();
        }
      } catch (error) {
        console.error('Error validating link:', error);
        setInvalid(true);
        setLoading(false);
      }
    };

    if (linkId) {
      validateLink();
    }
    
    // Cleanup interval on component unmount
    return () => {
      if (presignedUrlRefreshInterval.current) {
        clearInterval(presignedUrlRefreshInterval.current);
      }
    };
  }, [linkId]);
  
  // Initialize and periodically refresh the presigned URL cache
  const initializePresignedUrlCache = () => {
    // Generate initial cache with 5 URLs
    refreshPresignedUrlCache(5);
    
    // Set up periodic refresh (every 15 minutes)
    presignedUrlRefreshInterval.current = setInterval(() => {
      refreshPresignedUrlCache(5);
    }, 15 * 60 * 1000);
  };
  
  // Refresh the presigned URL cache with new URLs
  const refreshPresignedUrlCache = async (count: number = 5) => {
    try {
      const linkIdValue = Array.isArray(linkId) ? linkId[0] : linkId as string;
      
      // Request batch of presigned URLs
      const response = await fetch('/api/upload/presigned/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkId: linkIdValue,
          count: count
        }),
      });
      
      if (!response.ok) {
        console.warn('Failed to refresh presigned URL cache');
        return;
      }
      
      const data = await response.json();
      
      // Update the cache with new URLs
      setPresignedUrlCache(prev => {
        const newCache = { ...prev };
        
        // Add new URLs to cache
        data.urls.forEach((item: {id: string, url: string, storageKey: string, expires: number}) => {
          newCache[item.id] = {
            url: item.url,
            storageKey: item.storageKey,
            expires: item.expires
          };
        });
        
        return newCache;
      });
    } catch (error) {
      console.error('Error refreshing presigned URL cache:', error);
    }
  };
  
  // Get a presigned URL from cache or request a new one
  const getPresignedUrl = async (file: File): Promise<any> => {
    const now = Date.now();
    const cacheKeys = Object.keys(presignedUrlCache);
    
    // Check if we have a non-expired URL in cache
    for (const key of cacheKeys) {
      const cachedUrl = presignedUrlCache[key];
      
      // Skip expired URLs
      if (cachedUrl.expires < now) continue;
      
      // Use a URL from cache and remove it from cache
      setPresignedUrlCache(prev => {
        const newCache = { ...prev };
        delete newCache[key];
        return newCache;
      });
      
      // If cache is running low, request more URLs
      if (Object.keys(presignedUrlCache).length < 3) {
        refreshPresignedUrlCache(5);
      }
      
      // Return the cached URL data with additional file info
      return {
        uploadUrl: cachedUrl.url,
        storageKey: cachedUrl.storageKey,
        clientName: link?.clientName,
        projectName: link?.projectName,
        linkId: Array.isArray(linkId) ? linkId[0] : linkId as string
      };
    }
    
    // If no suitable URL in cache, request a new one
    try {
      const linkIdValue = Array.isArray(linkId) ? linkId[0] : linkId as string;
      
      const response = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkId: linkIdValue,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get presigned URL: ${response.status}`);
      }
      
      return await response.json();
    } catch (error: any) {
      console.error('Error getting presigned URL:', error);
      throw error;
    }
  };

  // Handle browser window/tab close during upload
  useEffect(() => {
    // Check if any files are in uploading or processing state
    const hasActiveUploads = files.some(file => 
      file.status === 'uploading' || file.status === 'processing'
    );
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasActiveUploads) {
        openExitConfirmModal();
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    
    if (hasActiveUploads) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    } else {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [files, openExitConfirmModal]);

  // Add files to queue
  const addFiles = (newFiles: File[]) => {
    // Filter out duplicates
    const filesToAdd = newFiles.filter(newFile => 
      !files.some(existingFile => 
        existingFile.file.name === newFile.name && 
        existingFile.file.size === newFile.size
      )
    );
    
    if (filesToAdd.length === 0) {
      if (newFiles.length > 0) {
        notifications.show({
          title: 'Duplicate Files',
          message: 'These files are already in your upload list',
          color: 'yellow',
        });
      }
      return;
    }
    
    const newFileObjects = filesToAdd.map(file => ({
      id: `file-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
      file,
      status: 'pending' as const,
      progress: 0
    }));
    
    setFiles(current => [...current, ...newFileObjects]);
    
    notifications.show({
      title: 'Files Added',
      message: `Added ${filesToAdd.length} file(s) to upload queue`,
      color: 'blue',
    });
  };

  // Remove file from queue
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // Clear all files
  const clearFiles = () => {
    if (uploading) {
      notifications.show({
        title: 'Upload in Progress',
        message: 'Please wait for current uploads to complete or cancel them first',
        color: 'yellow',
      });
      return;
    }
    setFiles([]);
  };

  // Add function to cancel an upload
  const cancelUpload = (id: string) => {
    const fileToCancel = files.find(f => f.id === id);
    if (fileToCancel?.status === 'uploading' && fileToCancel.cancelController) {
      fileToCancel.cancelController.abort();
      setFiles(prev => prev.map(f => 
        f.id === id ? { 
          ...f, 
          status: 'error', 
          error: 'Cancelled by user',
          speed: undefined,
          timeRemaining: undefined
        } : f
      ));
      
      notifications.show({
        title: 'Upload Cancelled',
        message: `Upload of ${fileToCancel.file.name} was cancelled`,
        color: 'blue',
      });
    }
  };

  // Upload a single file using direct-to-Wasabi approach with performance optimizations
  const uploadFile = async (fileData: UploadFile): Promise<boolean> => {
    return new Promise((resolve) => {
      // Create abort controller for cancellation support
      const abortController = new AbortController();
      
      // Mark file as uploading and record start time
      setFiles(prev => prev.map(f => 
        f.id === fileData.id ? { 
          ...f, 
          status: 'uploading', 
          progress: 0, 
          startTime: Date.now(),
          speed: '0 KB/s',
          timeRemaining: 'Calculating...',
          cancelController: abortController
        } : f
      ));
      
      // Determine if we need multipart upload (for files > 100MB)
      const isLargeFile = fileData.file.size > 100 * 1024 * 1024;
      
      // Use multipart upload for large files
      if (isLargeFile) {
        console.log(`Using multipart upload for large file: ${fileData.file.name} (${formatFileSize(fileData.file.size)})`);
        multipartUpload(fileData, abortController.signal).then(success => resolve(success));
      } else {
        // Use single part upload for smaller files
        singlePartUpload(fileData, abortController.signal).then(success => resolve(success));
      }
    });
  };
  
  // Handle single part upload for smaller files with optimizations
  const singlePartUpload = async (fileData: UploadFile, signal: AbortSignal): Promise<boolean> => {
    try {
      // Get presigned URL for the upload
      const presignedData = await getPresignedUrl(fileData.file);
      if (!presignedData) return false;
      
      // Track performance metrics
      let lastLoaded = 0;
      let lastTime = Date.now();
      let bytesPerSecond = 0;
      let movingAverageSpeed = 0;
      
      // Set up XMLHttpRequest for upload with progress tracking
      const xhr = new XMLHttpRequest();
      
      // Cancel handling
      signal.addEventListener('abort', () => {
        xhr.abort();
        return false;
      });

      return new Promise<boolean>((resolve) => {
        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const now = Date.now();
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            
            // Update progress in UI
            setFiles(prev => prev.map(f => 
              f.id === fileData.id ? { ...f, progress: percentComplete } : f
            ));
            
            // Calculate and update speed with moving average
            if (now - lastTime > 200) { // Update speed every 200ms
              const elapsedSec = (now - lastTime) / 1000;
              const loadedBytes = event.loaded;
              const bytesDifference = loadedBytes - lastLoaded;
              
              if (bytesDifference > 0 && elapsedSec > 0) {
                bytesPerSecond = bytesDifference / elapsedSec;
                
                // Calculate moving average (70% previous, 30% new measurement)
                movingAverageSpeed = movingAverageSpeed === 0 
                  ? bytesPerSecond 
                  : 0.7 * movingAverageSpeed + 0.3 * bytesPerSecond;
                
                // Calculate time remaining based on moving average speed
                const bytesRemaining = event.total - event.loaded;
                let timeRemainingMs = bytesRemaining / movingAverageSpeed * 1000;
                let timeRemainingText = formatTimeRemaining(timeRemainingMs);
                
                // Update speed and time remaining in file state
                setFiles(prev => prev.map(f => 
                  f.id === fileData.id ? { 
                    ...f, 
                    speed: formatSpeed(movingAverageSpeed),
                    timeRemaining: timeRemainingText
                  } : f
                ));
              }
              
              // Save current values for next calculation
              lastLoaded = loadedBytes;
              lastTime = now;
            }
          }
        });
        
        // Set up completion handler
        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // File is uploaded to Wasabi, now register it with our server
            try {
              setFiles(prev => prev.map(f => 
                f.id === fileData.id ? { 
                  ...f, 
                  status: 'processing', 
                  progress: 100,
                  speed: undefined,
                  timeRemaining: undefined
                } : f
              ));
              
              // If we're using a cached URL, update the storage key to include the real filename
              let finalStorageKey = presignedData.storageKey;
              if (finalStorageKey.includes('_placeholder')) {
                // Replace placeholder with actual filename
                finalStorageKey = finalStorageKey.replace('_placeholder', `_${fileData.file.name}`);
              }
              
              // Step 3: Register the uploaded file with our server
              const registerResponse = await fetch('/api/upload/register', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  fileName: fileData.file.name,
                  fileSize: fileData.file.size,
                  fileType: fileData.file.type,
                  linkId: Array.isArray(linkId) ? linkId[0] : linkId as string,
                  storageKey: finalStorageKey,
                  clientName: presignedData.clientName,
                  projectName: presignedData.projectName
                }),
              });
              
              if (!registerResponse.ok) {
                throw new Error(`Failed to register file: ${registerResponse.status}`);
              }
              
              // Successfully uploaded and registered
              setFiles(prev => prev.map(f => 
                f.id === fileData.id ? { ...f, status: 'completed', progress: 100 } : f
              ));
              
              notifications.show({
                title: 'Upload Complete',
                message: `${fileData.file.name} has been successfully uploaded`,
                color: 'green',
                icon: <IconCheck size={18} />,
              });
              
              resolve(true);
            } catch (error: any) {
              console.error('Error registering file:', error);
              setFiles(prev => prev.map(f => 
                f.id === fileData.id ? { 
                  ...f, 
                  status: 'error', 
                  error: `File uploaded but registration failed: ${error.message}` 
                } : f
              ));
              
              notifications.show({
                title: 'Registration Failed',
                message: `${fileData.file.name} was uploaded but couldn't be registered`,
                color: 'orange',
                icon: <IconAlertCircle size={18} />,
              });
              
              resolve(false);
            }
          } else {
            let errorMessage = 'Upload to storage failed';
            
            setFiles(prev => prev.map(f => 
              f.id === fileData.id ? { ...f, status: 'error', error: errorMessage } : f
            ));
            
            notifications.show({
              title: 'Upload Failed',
              message: `${fileData.file.name}: ${errorMessage}`,
              color: 'red',
              icon: <IconX size={18} />,
            });
            
            resolve(false);
          }
        };
        
        // Handle network errors
        xhr.onerror = () => {
          setFiles(prev => prev.map(f => 
            f.id === fileData.id ? { 
              ...f, 
              status: 'error', 
              error: 'Network error during upload to storage' 
            } : f
          ));
          
          notifications.show({
            title: 'Upload Failed',
            message: `${fileData.file.name}: Network error occurred`,
            color: 'red',
            icon: <IconX size={18} />,
          });
          
          resolve(false);
        };
        
        // Start the direct upload to Wasabi with optimized headers
        xhr.open('PUT', presignedData.uploadUrl);
        xhr.setRequestHeader('Content-Type', fileData.file.type);
        
        // Add performance optimization headers
        xhr.setRequestHeader('x-amz-content-sha256', 'UNSIGNED-PAYLOAD');
        xhr.setRequestHeader('Expect', '100-continue');
        
        // Start upload
        xhr.send(fileData.file);
      });
    } catch (error: any) {
      console.error('Error in single part upload:', error);
      setFiles(prev => prev.map(f => 
        f.id === fileData.id ? { 
          ...f, 
          status: 'error', 
          error: error.message || 'Upload failed' 
        } : f
      ));
      
      notifications.show({
        title: 'Upload Failed',
        message: `${fileData.file.name}: ${error.message || 'Unknown error'}`,
        color: 'red',
        icon: <IconX size={18} />,
      });
      
      return false;
    }
  };
  
  // Multipart upload implementation for large files
  const multipartUpload = async (fileData: UploadFile, signal: AbortSignal): Promise<boolean> => {
    try {
      // Constants for multipart upload
      const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks (AWS recommended minimum)
      const MAX_CONCURRENT_CHUNKS = 6; // Number of concurrent chunk uploads
      
      // Calculate total chunks
      const file = fileData.file;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      
      // Initialize multipart upload
      const initResponse = await fetch('/api/upload/multipart/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkId: Array.isArray(linkId) ? linkId[0] : linkId as string,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }),
      });
      
      if (!initResponse.ok) {
        throw new Error(`Failed to initialize multipart upload: ${initResponse.status}`);
      }
      
      const { uploadId, storageKey } = await initResponse.json();
      
      return new Promise<boolean>((resolve) => {
        // Tracking variables
        let completedChunks = 0;
        let activeUploads = 0;
        let chunkIndex = 0;
        let uploadedBytes = 0;
        let lastReportedBytes = 0;
        let lastReportTime = Date.now();
        let movingAverageSpeed = 0;
        let cancelled = false;
        
        // ETags array for completed parts
        const etags: {[key: number]: string} = {};
        
        // Add abort handler
        signal.addEventListener('abort', () => {
          cancelled = true;
          resolve(false);
          return;
        });
        
        // Update progress periodically
        const progressInterval = setInterval(() => {
          if (cancelled) {
            clearInterval(progressInterval);
            return;
          }
          
          const now = Date.now();
          const elapsedSec = (now - lastReportTime) / 1000;
          
          if (elapsedSec > 0) {
            const bytesDifference = uploadedBytes - lastReportedBytes;
            
            if (bytesDifference > 0) {
              const currentSpeed = bytesDifference / elapsedSec;
              
              // Calculate moving average (70% previous, 30% new measurement)
              movingAverageSpeed = movingAverageSpeed === 0 
                ? currentSpeed 
                : 0.7 * movingAverageSpeed + 0.3 * currentSpeed;
              
              // Calculate time remaining based on moving average speed
              const bytesRemaining = file.size - uploadedBytes;
              let timeRemainingMs = bytesRemaining / movingAverageSpeed * 1000;
              let timeRemainingText = formatTimeRemaining(timeRemainingMs);
              
              const percentComplete = Math.min(
                99, // Cap at 99% until completely done
                Math.round((uploadedBytes / file.size) * 100)
              );
              
              // Update progress in UI
              setFiles(prev => prev.map(f => 
                f.id === fileData.id ? { 
                  ...f, 
                  progress: percentComplete,
                  speed: formatSpeed(movingAverageSpeed),
                  timeRemaining: timeRemainingText
                } : f
              ));
              
              lastReportedBytes = uploadedBytes;
              lastReportTime = now;
            }
          }
        }, 500);
        
        // Function to upload a single chunk
        const uploadChunk = async (chunkIdx: number): Promise<void> => {
          // Check for cancellation
          if (cancelled) return;
          
          const start = chunkIdx * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          try {
            activeUploads++;
            
            // Get presigned URL for this chunk
            const chunkResponse = await fetch('/api/upload/multipart/chunk', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                uploadId,
                storageKey,
                partNumber: chunkIdx + 1,
                contentType: file.type
              }),
            });
            
            if (!chunkResponse.ok) {
              throw new Error(`Failed to get chunk URL: ${chunkResponse.status}`);
            }
            
            const { presignedUrl } = await chunkResponse.json();
            
            // Upload the chunk
            const uploadResponse = await fetch(presignedUrl, {
              method: 'PUT',
              body: chunk,
              headers: {
                'Content-Type': file.type,
                'x-amz-content-sha256': 'UNSIGNED-PAYLOAD'
              }
            });
            
            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload chunk: ${uploadResponse.status}`);
            }
            
            // Get ETag from response headers
            const etag = uploadResponse.headers.get('ETag');
            if (!etag) throw new Error('No ETag received for uploaded part');
            
            // Store ETag and update progress
            etags[chunkIdx + 1] = etag.replace(/"/g, ''); // Remove quotes from ETag
            completedChunks++;
            uploadedBytes += (end - start);
            
            // Start next chunk if available
            if (chunkIndex < totalChunks) {
              const nextChunkIdx = chunkIndex++;
              uploadChunk(nextChunkIdx);
            }
            
            // Check if all chunks are uploaded
            if (completedChunks === totalChunks && !cancelled) {
              // Clear progress interval
              clearInterval(progressInterval);
              
              // Mark as processing
              setFiles(prev => prev.map(f => 
                f.id === fileData.id ? { 
                  ...f, 
                  status: 'processing', 
                  progress: 100,
                  speed: undefined,
                  timeRemaining: undefined
                } : f
              ));
              
              // Complete multipart upload
              const completeResponse = await fetch('/api/upload/multipart/complete', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  uploadId,
                  storageKey,
                  parts: Object.entries(etags).map(([partNumber, etag]) => ({
                    PartNumber: parseInt(partNumber, 10),
                    ETag: etag
                  }))
                }),
              });
              
              if (!completeResponse.ok) {
                throw new Error(`Failed to complete multipart upload: ${completeResponse.status}`);
              }
              
              // Register the uploaded file with our server
              const registerResponse = await fetch('/api/upload/register', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  fileName: fileData.file.name,
                  fileSize: fileData.file.size,
                  fileType: fileData.file.type,
                  linkId: Array.isArray(linkId) ? linkId[0] : linkId as string,
                  storageKey,
                  clientName: link?.clientName,
                  projectName: link?.projectName
                }),
              });
              
              if (!registerResponse.ok) {
                throw new Error(`Failed to register file: ${registerResponse.status}`);
              }
              
              // Successfully uploaded and registered
              setFiles(prev => prev.map(f => 
                f.id === fileData.id ? { ...f, status: 'completed', progress: 100 } : f
              ));
              
              notifications.show({
                title: 'Upload Complete',
                message: `${fileData.file.name} has been successfully uploaded`,
                color: 'green',
                icon: <IconCheck size={18} />,
              });
              
              resolve(true);
              return;
            }
          } catch (error: any) {
            console.error(`Error uploading chunk ${chunkIdx}:`, error);
            
            if (!cancelled) {
              setFiles(prev => prev.map(f => 
                f.id === fileData.id ? { 
                  ...f, 
                  status: 'error', 
                  error: `Upload failed: ${error.message}` 
                } : f
              ));
              
              clearInterval(progressInterval);
              resolve(false);
            }
          } finally {
            activeUploads--;
          }
        };
        
        // Start initial batch of uploads
        const initialChunks = Math.min(MAX_CONCURRENT_CHUNKS, totalChunks);
        for (let i = 0; i < initialChunks; i++) {
          uploadChunk(chunkIndex++);
        }
      });
    } catch (error: any) {
      console.error('Error in multipart upload:', error);
      setFiles(prev => prev.map(f => 
        f.id === fileData.id ? { 
          ...f, 
          status: 'error', 
          error: error.message || 'Multipart upload failed' 
        } : f
      ));
      
      notifications.show({
        title: 'Upload Failed',
        message: `${fileData.file.name}: ${error.message || 'Unknown error'}`,
        color: 'red',
        icon: <IconX size={18} />,
      });
      
      return false;
    }
  };

  // Start uploading all files
  const startUploads = async () => {
    if (files.length === 0) {
      notifications.show({
        title: 'No Files',
        message: 'Please add files to upload first',
        color: 'blue',
      });
      return;
    }
    
    if (uploading) {
      notifications.show({
        title: 'Upload in Progress',
        message: 'Upload is already in progress',
        color: 'blue',
      });
      return;
    }
    
    setUploading(true);
    
    // Get pending files
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    // Process files sequentially to avoid overloading
    for (const file of pendingFiles) {
      await uploadFile(file);
    }
    
    setUploading(false);
    
    const completedCount = files.filter(f => f.status === 'completed').length;
    const failedCount = files.filter(f => f.status === 'error').length;
    
    if (completedCount > 0) {
      notifications.show({
        title: 'Uploads Complete',
        message: `${completedCount} file(s) uploaded successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        color: 'green',
      });
    }
  };

  // Handle files dropped into dropzone
  const handleDrop = (droppedFiles: File[]) => {
    addFiles(droppedFiles);
  };

  if (loading) {
    return (
      <Box style={{ display: 'flex', minHeight: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Container size="md" style={{ width: '100%' }}>
          <Center>
            <Stack align="center" gap="md">
              <Loader size="lg" color="blue" />
              <Text size="lg" fw={500}>Validating upload link...</Text>
            </Stack>
          </Center>
        </Container>
      </Box>
    );
  }

  if (invalid || !link) {
    return (
      <Box style={{ display: 'flex', minHeight: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Container size="md" style={{ width: '100%' }}>
          <Paper withBorder p="xl" shadow="md" radius="md">
            <Stack align="center" gap="md">
              <ThemeIcon size={80} radius={40} color="red">
                <IconAlertCircle size={48} />
              </ThemeIcon>
              <Title order={2} ta="center">Invalid Upload Link</Title>
              <Text ta="center" size="lg">
                This upload link is invalid, expired, or has been deactivated.
                Please contact the administrator for a new link.
              </Text>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  if (!link.isActive) {
    return (
      <Box style={{ display: 'flex', minHeight: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Container size="md" style={{ width: '100%' }}>
          <Paper withBorder p="xl" shadow="md" radius="md">
            <Stack align="center" gap="md">
              <ThemeIcon size={80} radius={40} color="orange">
                <IconAlertCircle size={48} />
              </ThemeIcon>
              <Title order={2} ta="center">Inactive Upload Link</Title>
              <Text ta="center" size="lg">
                This upload link has been deactivated.
                Please contact the administrator for assistance.
              </Text>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return (
      <Box style={{ display: 'flex', minHeight: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Container size="md" style={{ width: '100%' }}>
          <Paper withBorder p="xl" shadow="md" radius="md">
            <Stack align="center" gap="md">
              <ThemeIcon size={80} radius={40} color="orange">
                <IconAlertCircle size={48} />
              </ThemeIcon>
              <Title order={2} ta="center">Expired Upload Link</Title>
              <Text ta="center" size="lg">
                This upload link has expired.
                Please contact the administrator for a new link.
              </Text>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box style={{ display: 'flex', minHeight: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', paddingTop: 'var(--mantine-spacing-md)', paddingBottom: 'var(--mantine-spacing-md)' }}>
      <Container size="lg" style={{ width: '100%' }}>
        {/* Exit Confirmation Modal */}
        <Modal 
          opened={exitConfirmModalOpened} 
          onClose={closeExitConfirmModal}
          title="Upload in Progress"
          centered
          size="md"
        >
          <Stack>
            <Text>
              You have uploads in progress. Are you sure you want to leave this page? Your uploads will be lost.
            </Text>
            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={closeExitConfirmModal}>
                Stay on Page
              </Button>
              <Button 
                color="red" 
                onClick={() => {
                  closeExitConfirmModal();
                  window.location.href = window.location.origin;
                }}
              >
                Leave Anyway
              </Button>
            </Group>
          </Stack>
        </Modal>
        
        <Paper withBorder p={0} shadow="md" radius="lg" style={{ overflow: 'hidden' }}>
          <BackgroundImage 
            src="https://images.unsplash.com/photo-1684372776964-645f854e2e51?q=80&w=2070" 
            radius={0}
          >
            <Box p="xl" style={{ position: 'relative' }}>
              <Overlay color="#000" opacity={0.65} radius={0} blur={2} />
              <Box style={{ position: 'relative', zIndex: 2 }}>
                <Stack gap="xs" align="center" py="lg">
                  <Title order={1} c="white" fw={900}>Motion Mavericks Fast</Title>
                  <Text size="xl" c="white" ta="center">Upload files for: <strong>{link.projectName}</strong></Text>
                  <Text c="white" ta="center">Client: {link.clientName}</Text>
                  {link.expiresAt && (
                    <Badge color="blue" size="lg" variant="filled" radius="sm">
                      Expires: {new Date(link.expiresAt).toLocaleDateString()}
                    </Badge>
                  )}
                </Stack>
              </Box>
            </Box>
          </BackgroundImage>

          <Box p="xl">
            <SimpleGrid cols={{ base: 1, sm: 1 }} spacing="md" mb="lg">
              <Paper withBorder p="md" radius="md" shadow="sm">
                <Group wrap="nowrap" align="center">
                  <ThemeIcon size={50} radius="md" color="blue">
                    <IconCloudUpload size={30} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={700} size="lg">Fast Upload</Text>
                    <Text size="sm" c="dimmed">Upload multiple files at once</Text>
                  </Box>
                </Group>
              </Paper>
            </SimpleGrid>
            
            <div id="drop-target">
              <Dropzone
                onDrop={handleDrop}
                maxSize={100 * 1024 * 1024 * 1024} // 100GB limit
                accept={ACCEPTED_FILE_TYPES}
                multiple={true}
                ref={dropzoneRef}
                style={{ minHeight: 250 }}
                className="dropzone-container"
                radius="lg"
              >
                <Stack justify="center" align="center" gap="xl" style={{ height: 250, pointerEvents: 'none' }}>
                  <Dropzone.Accept>
                    <ThemeIcon size={100} radius={50} color="blue">
                      <IconFileUpload size={50} />
                    </ThemeIcon>
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <ThemeIcon size={100} radius={50} color="red">
                      <IconX size={50} />
                    </ThemeIcon>
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <ThemeIcon size={100} radius={50} color="gray" variant="light">
                      <IconUpload size={50} />
                    </ThemeIcon>
                  </Dropzone.Idle>
                  
                  <Stack gap="xs" align="center">
                    <Text size="xl" fw={700} ta="center">
                      Drag files here or click to browse
                    </Text>
                    <Text ta="center" size="md" c="dimmed">
                      Upload multiple files at once
                    </Text>
                    
                    <Group mt="md">
                      <Button 
                        variant="filled" 
                        size="md" 
                        leftSection={<IconFiles size={20} />}
                        onClick={() => {
                          // @ts-ignore - Dropzone has this method but it's not in the type definitions
                          dropzoneRef.current?.openDialog();
                        }}
                      >
                        Select Files
                      </Button>
                    </Group>
                  </Stack>
                </Stack>
              </Dropzone>
            </div>
            
            <Text size="sm" c="dimmed" ta="center" mt="md">
              Drag and drop multiple files to upload them all at once.
            </Text>
            
            {files.length > 0 && (
              <Stack gap="md" mt="xl">
                <Paper withBorder p="md" radius="md" shadow="sm" bg="rgba(0, 0, 0, 0.03)">
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={5}>
                      <Text fw={700} size="lg">Selected Files ({files.length})</Text>
                      <Group gap="xs">
                        <Badge color="blue" variant="light">
                          {files.length} files
                        </Badge>
                        <Badge color="grape" variant="light">
                          {formatFileSize(totalSize)}
                        </Badge>
                      </Group>
                    </Stack>
                    
                    <Group>
                      <Button 
                        variant="outline" 
                        color="red" 
                        leftSection={<IconTrash size={16} />} 
                        onClick={clearFiles}
                        disabled={uploading}
                      >
                        Clear All
                      </Button>
                      <Button 
                        color="blue" 
                        leftSection={<IconUpload size={16} />} 
                        onClick={startUploads}
                        disabled={uploading || files.filter(f => f.status === 'pending').length === 0}
                        loading={uploading}
                      >
                        {uploading ? 'Uploading...' : 'Start Upload'}
                      </Button>
                    </Group>
                  </Group>
                </Paper>
                
                <Table highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: '50%' }}>Name</Table.Th>
                      <Table.Th>Size</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th style={{ width: '20%' }}>Progress</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {files.map((file) => (
                      <Table.Tr key={file.id}>
                        <Table.Td>
                          <Group gap="sm" wrap="nowrap">
                            {getFileIcon(file.file.type)}
                            <Box style={{ overflow: 'hidden' }}>
                              <Text truncate fw={500}>
                                {file.file.name}
                              </Text>
                            </Box>
                          </Group>
                        </Table.Td>
                        <Table.Td>{formatFileSize(file.file.size)}</Table.Td>
                        <Table.Td>{file.file.type || 'Unknown'}</Table.Td>
                        <Table.Td>
                          {file.status === 'pending' && <Badge color="gray">Pending</Badge>}
                          {file.status === 'uploading' && <Badge color="blue">Uploading</Badge>}
                          {file.status === 'processing' && <Badge color="yellow">Processing</Badge>}
                          {file.status === 'completed' && <Badge color="green">Completed</Badge>}
                          {file.status === 'error' && (
                            <Tooltip label={file.error || 'Unknown error'}>
                              <Badge color="red">Failed</Badge>
                            </Tooltip>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {file.status === 'uploading' && (
                            <Stack gap={5}>
                              <Progress value={file.progress} size="sm" color="blue" striped animated />
                              <Group justify="space-between" gap={5}>
                                <Text size="xs" c="dimmed">{file.progress}%</Text>
                                <Group gap={5}>
                                  <Text size="xs" c="blue" fw={500}>{file.speed}</Text>
                                  {file.timeRemaining && (
                                    <Text size="xs" c="dimmed">{file.timeRemaining} left</Text>
                                  )}
                                </Group>
                              </Group>
                            </Stack>
                          )}
                          {file.status === 'processing' && (
                            <Stack gap={5}>
                              <Progress value={100} size="sm" color="yellow" striped animated />
                              <Group justify="center" gap={5}>
                                <Text size="xs" c="dimmed">Finalizing...</Text>
                              </Group>
                            </Stack>
                          )}
                          {file.status === 'completed' && (
                            <Text c="green" size="sm" fw={500}>100%</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {file.status === 'uploading' ? (
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              onClick={() => cancelUpload(file.id)}
                              title="Cancel upload"
                            >
                              <IconX size={16} />
                            </ActionIcon>
                          ) : file.status !== 'processing' ? (
                            <ActionIcon 
                              color="red" 
                              variant="subtle" 
                              onClick={() => removeFile(file.id)}
                              disabled={uploading}
                              title="Remove from list"
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          ) : null}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            )}

            <Alert color="blue" variant="light" icon={<IconAlertCircle />} mt="xl" radius="md">
              <Text fw={500}>Accepted file types: Video, audio, images, PDFs, and production project files.</Text>
              <Text size="sm" mt={5}>
                Upload progress is shown in real-time with upload speed display.
              </Text>
              <Text size="sm">Maximum file size: 100GB</Text>
            </Alert>
          </Box>
        </Paper>
        
        <Box ta="center" py="xl">
          <Text size="sm" c="dimmed">© {new Date().getFullYear()} Motion Mavericks Fast. All rights reserved.</Text>
        </Box>
      </Container>
    </Box>
  );
}