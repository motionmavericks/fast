'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Container, 
  Title, 
  Text, 
  Paper, 
  Badge, 
  Table, 
  Button,
  Group,
  TextInput,
  Select,
  LoadingOverlay,
  ActionIcon,
  Pagination,
  Tooltip,
  Accordion,
  ScrollArea,
  Loader,
  Box,
  Modal,
  Stack,
  Checkbox,
  Menu,
  Drawer,
  Tabs,
  AspectRatio,
  createStyles,
  rem
} from '@mantine/core';
import { 
  IconRefresh, 
  IconSearch, 
  IconDownload, 
  IconTrash, 
  IconFilter, 
  IconX,
  IconExternalLink,
  IconPlayerPlay,
  IconFileText,
  IconPhoto,
  IconChecks,
  IconChevronDown,
  IconEye
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import dynamic from 'next/dynamic';

// Dynamically import the React Player component to avoid SSR issues
const ReactPlayer = dynamic(() => import('react-player/lazy'), { ssr: false });

// We'll use a simpler approach for PDF viewing to avoid complex dependencies
// Instead of using the PDF viewer libraries directly, we'll use a more basic approach

interface UploadedFile {
  id: string;
  fileName: string;
  fileSize: string;
  rawSize: number;
  fileType: string;
  clientName: string;
  projectName: string;
  uploadDate: string;
  status: 'processing' | 'completed' | 'failed';
}

// Function to determine file type category
const getFileCategory = (fileType: string): 'video' | 'image' | 'document' | 'audio' | 'other' => {
  // Video formats (including professional formats)
  if (
    fileType.startsWith('video/') || 
    fileType.includes('mxf') || 
    fileType.includes('x-matroska') ||
    fileType.includes('quicktime') ||
    fileType.includes('mpeg') ||
    fileType === 'application/octet-stream' || // Sometimes MXF files are detected as this
    fileType.toLowerCase().includes('mov')
  ) {
    return 'video';
  }
  
  // Image formats
  if (
    fileType.startsWith('image/') || 
    fileType.includes('raw') || 
    fileType.includes('x-adobe-dng') ||
    fileType.includes('x-canon-cr2') ||
    fileType.includes('x-nikon-nef')
  ) {
    return 'image';
  }
  
  // Audio formats
  if (fileType.startsWith('audio/')) {
    return 'audio';
  }
  
  // Document formats
  if (
    fileType.startsWith('application/pdf') ||
    fileType.startsWith('application/msword') ||
    fileType.startsWith('application/vnd.openxmlformats-officedocument') ||
    fileType.startsWith('application/vnd.ms-') ||
    fileType.startsWith('text/')
  ) {
    return 'document';
  }
  
  // Default
  return 'other';
};

// Function to determine if a file is previewable
const isPreviewable = (fileType: string): boolean => {
  // Get file category
  const category = getFileCategory(fileType);
  
  // These categories are generally previewable in browser
  return ['video', 'image', 'document', 'audio'].includes(category);
};

// Create secure API URLs for files instead of using direct Wasabi URLs
const createSecureFileUrl = (fileId: string): string => {
  return `/api/files/${fileId}/stream`;
};

// Custom component for video player with error handling
const VideoPlayer = ({ fileId, fileType }: { fileId: string; fileType: string }) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const secureUrl = createSecureFileUrl(fileId);
  
  // Check if this is a professional video format
  const isProfessionalFormat = fileType.includes('mxf') || 
                              fileType.includes('quicktime') || 
                              fileType.toLowerCase().includes('mov');
  
  useEffect(() => {
    // Reset states when fileId changes
    setError(false);
    setLoading(true);
  }, [fileId]);
  
  return error ? (
    <Box p="xl" style={{ textAlign: 'center' }}>
      <Text c="dimmed">Unable to play this video format in browser.</Text>
      <Text size="sm" mt="xs" mb="md">
        Professional formats like MXF, MOV, and ProRes may require specialized software.
      </Text>
      <Button 
        mt="md" 
        leftSection={<IconDownload size={16} />}
        onClick={() => window.open(secureUrl, '_blank')}
      >
        Download to view
      </Button>
    </Box>
  ) : (
    <>
      <Box style={{ position: 'relative', paddingTop: '56.25%' }}>
        {loading && (
          <Box style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.1)'
          }}>
            <Loader size="lg" />
          </Box>
        )}
        <ReactPlayer
          url={secureUrl}
          controls
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0 }}
          onError={() => setError(true)}
          onReady={() => setLoading(false)}
          config={{
            file: {
              attributes: {
                controlsList: 'nodownload',
                disablePictureInPicture: true,
                preload: 'auto',
              },
              forceVideo: true
            },
          }}
        />
      </Box>
      {isProfessionalFormat && !error && (
        <Text size="xs" mt="xs" ta="center" c="dimmed" fw="bold">
          Professional video format detected. If playback fails, download the file for proper viewing.
        </Text>
      )}
    </>
  );
};

// Custom component for audio player with error handling
const AudioPlayer = ({ fileId }: { fileId: string }) => {
  const [error, setError] = useState(false);
  const secureUrl = createSecureFileUrl(fileId);
  
  return error ? (
    <Box p="md" style={{ textAlign: 'center' }}>
      <Text c="dimmed">Unable to play this audio format in browser.</Text>
      <Button 
        mt="md" 
        size="sm"
        leftSection={<IconDownload size={16} />}
        onClick={() => window.open(secureUrl, '_blank')}
      >
        Download to listen
      </Button>
    </Box>
  ) : (
    <ReactPlayer
      url={secureUrl}
      controls
      width="100%"
      height="50px"
      onError={() => setError(true)}
      config={{
        file: {
          forceAudio: true,
          attributes: {
            controlsList: 'nodownload',
          },
        },
      }}
    />
  );
};

// Custom component for image viewing with loading state
const ImageViewer = ({ fileId, fileName, isRaw = false }: { fileId: string; fileName: string; isRaw?: boolean }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const secureUrl = createSecureFileUrl(fileId);
  
  return (
    <Box style={{ textAlign: 'center', position: 'relative', minHeight: '200px' }}>
      {loading && (
        <Box style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <Loader />
        </Box>
      )}
      
      {error ? (
        <Box p="md">
          <IconPhoto size={48} opacity={0.5} />
          <Text mt="md">Unable to preview this image format.</Text>
          <Button 
            mt="md" 
            size="sm"
            leftSection={<IconDownload size={16} />}
            onClick={() => window.open(secureUrl, '_blank')}
          >
            Download to view
          </Button>
        </Box>
      ) : (
        <img 
          src={secureUrl}
          alt={fileName} 
          style={{ 
            maxWidth: '100%', 
            maxHeight: '600px', 
            objectFit: 'contain',
            display: loading ? 'none' : 'inline-block'
          }}
          loading="lazy"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      )}
      
      {isRaw && !error && !loading && (
        <Text size="xs" mt="xs" ta="center" c="dimmed">
          RAW image formats may display as previews only. Download for full quality.
        </Text>
      )}
    </Box>
  );
};

// Function to get the appropriate preview component based on file type
const PreviewComponent = ({ file }: { file: UploadedFile }) => {
  // Get file category for appropriate handling
  const category = getFileCategory(file.fileType);
  
  switch (category) {
    case 'video':
      return (
        <Box>
          <VideoPlayer fileId={file.id} fileType={file.fileType} />
          <Text size="xs" mt="xs" ta="center" c="dimmed">
            Some professional video formats (MXF, ProRes, etc.) may require download for proper viewing
          </Text>
        </Box>
      );
      
    case 'image':
      return (
        <ImageViewer 
          fileId={file.id}
          fileName={file.fileName} 
          isRaw={file.fileType.includes('raw')}
        />
      );
      
    case 'document':
      // For PDFs, use iframe which is more reliable across browsers
      if (file.fileType === 'application/pdf') {
        return (
          <Box>
            <iframe 
              src={createSecureFileUrl(file.id)}
              style={{ width: '100%', height: '600px', border: 'none' }}
              title={file.fileName}
            />
            <Text size="xs" mt="xs" ta="center" c="dimmed">
              PDF viewing may be limited on some browsers. Download for full functionality.
            </Text>
          </Box>
        );
      }
      
      // For other document types
      return (
        <Box p="xl" style={{ textAlign: 'center' }}>
          <IconFileText size={72} stroke={1.5} />
          <Text mt="md">This document type cannot be previewed directly.</Text>
          <Button 
            mt="md" 
            leftSection={<IconDownload size={16} />}
            onClick={() => window.open(createSecureFileUrl(file.id), '_blank')}
          >
            Download to view
          </Button>
        </Box>
      );
      
    case 'audio':
      return (
        <Box p="xl" style={{ textAlign: 'center' }}>
          <AudioPlayer fileId={file.id} />
        </Box>
      );
      
    default:
      return (
        <Box p="xl" style={{ textAlign: 'center' }}>
          <Text c="dimmed">Preview not available for this file type.</Text>
          <Button 
            mt="md" 
            leftSection={<IconDownload size={16} />}
            onClick={() => window.open(createSecureFileUrl(file.id), '_blank')}
          >
            Download file
          </Button>
        </Box>
      );
  }
};

export default function ViewFilesPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFiltering, setIsFiltering] = useState(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [fileToDelete, setFileToDelete] = useState<{ fileId: string; fileName: string } | null>(null);
  
  // For bulk actions
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [bulkDeleteModalOpened, { open: openBulkDeleteModal, close: closeBulkDeleteModal }] = useDisclosure(false);
  
  // For file preview
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);
  
  const PAGE_SIZE = 10;

  const fetchFiles = async (page = 1, filters = { client: clientFilter, project: projectFilter, status: statusFilter }) => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      params.append('limit', PAGE_SIZE.toString());
      params.append('skip', ((page - 1) * PAGE_SIZE).toString());
      
      if (filters.client) params.append('client', filters.client);
      if (filters.project) params.append('project', filters.project);
      if (filters.status) params.append('status', filters.status);
      
      const response = await fetch(`/api/files?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      
      const data = await response.json();
      setFiles(data.files);
      setTotalFiles(data.totalCount);
      setTotalPages(data.totalPages);
      setCurrentPage(data.page);
      
      // Clear selections when fetching new files
      setSelectedFiles([]);
    } catch (error) {
      console.error('Error fetching files:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load files. Please try again.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFilter = () => {
    setIsFiltering(true);
    fetchFiles(1, { client: clientFilter, project: projectFilter, status: statusFilter });
  };

  const clearFilters = () => {
    setClientFilter('');
    setProjectFilter('');
    setStatusFilter(null);
    setIsFiltering(false);
    fetchFiles(1, { client: '', project: '', status: null });
  };

  const handlePageChange = (page: number) => {
    fetchFiles(page, { client: clientFilter, project: projectFilter, status: statusFilter });
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'green';
    if (status === 'processing') return 'blue';
    if (status === 'failed') return 'red';
    return 'gray';
  };

  const handleDownload = (file: UploadedFile) => {
    const secureUrl = createSecureFileUrl(file.id);
    window.open(secureUrl, '_blank');
  };
  
  const initiateDeleteFile = (fileId: string, fileName: string) => {
    setFileToDelete({ fileId, fileName });
    openDeleteModal();
  };

  const deleteFile = async () => {
    if (!fileToDelete) return;
    
    try {
      const response = await fetch(`/api/files/${fileToDelete.fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete file');
      }

      notifications.show({
        title: 'File Deleted',
        message: `${fileToDelete.fileName} has been permanently deleted.`,
        color: 'green',
      });

      // Refresh the file list
      fetchFiles();
      closeDeleteModal();
      setFileToDelete(null);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete file',
        color: 'red',
      });
    }
  };
  
  // Handle preview functionality
  const handlePreview = (file: UploadedFile) => {
    setPreviewFile(file);
    openPreview();
  };
  
  // Handle bulk selections
  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };
  
  const toggleAllFiles = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(file => file.id));
    }
  };
  
  // Handle bulk download
  const bulkDownload = async () => {
    try {
      // Get selected files
      const selectedFilesData = files.filter(file => selectedFiles.includes(file.id));
      
      // Download each file using the secure API endpoint
      selectedFilesData.forEach(file => {
        const secureUrl = createSecureFileUrl(file.id);
        
        // Create a hidden link and click it to download
        const link = document.createElement('a');
        link.href = secureUrl;
        link.download = file.fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
      
      notifications.show({
        title: 'Downloads Started',
        message: `${selectedFilesData.length} files are being downloaded`,
        color: 'blue',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to start downloads',
        color: 'red',
      });
    }
  };
  
  // Bulk delete action
  const bulkDelete = async () => {
    try {
      // Call the bulk API endpoint
      const response = await fetch('/api/files/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          fileIds: selectedFiles
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete files');
      }
      
      const result = await response.json();
      
      if (result.results.failed.length > 0) {
        notifications.show({
          title: 'Partial Success',
          message: `Deleted ${result.results.success.length} files. ${result.results.failed.length} files failed to delete.`,
          color: 'yellow',
        });
      } else {
        notifications.show({
          title: 'Success',
          message: `All ${result.results.success.length} files have been deleted.`,
          color: 'green',
        });
      }
      
      // Refresh the file list
      fetchFiles();
      closeBulkDeleteModal();
      setSelectedFiles([]);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete files',
        color: 'red',
      });
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };
  
  // For efficient rendering of the bullet action menu
  const bulkActionsDisabled = selectedFiles.length === 0;

  // Handle row click
  const handleRowClick = (file: UploadedFile) => {
    // Don't open preview if clicking on actions or checkbox
    // This will be checked in the onClick handler
    setPreviewFile(file);
    openPreview();
  };

  return (
    <Container fluid>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Uploaded Files</Title>
        <Group>
          {selectedFiles.length > 0 && (
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button 
                  variant="filled" 
                  disabled={bulkActionsDisabled}
                  leftSection={<IconChecks size={16} />}
                  rightSection={<IconChevronDown size={16} />}
                >
                  Bulk Actions ({selectedFiles.length})
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconDownload size={16} />}
                  onClick={bulkDownload}
                >
                  Download All
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={openBulkDeleteModal}
                >
                  Delete All
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
          <Button 
            variant="default" 
            onClick={() => fetchFiles(currentPage)}
            leftSection={<IconRefresh size={16} />}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      <Paper withBorder p="md" mb="xl">
        <Group mb="md">
          <TextInput
            placeholder="Filter by client"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ flex: 1 }}
          />
          <TextInput
            placeholder="Filter by project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: 'completed', label: 'Completed' },
              { value: 'processing', label: 'Processing' },
              { value: 'failed', label: 'Failed' },
            ]}
            leftSection={<IconFilter size={16} />}
            style={{ width: 150 }}
            clearable
          />
          <Button onClick={handleFilter}>Apply Filters</Button>
          {isFiltering && (
            <ActionIcon variant="subtle" onClick={clearFilters} color="gray">
              <IconX size={16} />
            </ActionIcon>
          )}
        </Group>
      </Paper>

      <Paper withBorder shadow="sm" p="md" style={{ position: 'relative' }}>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
        
        {files.length === 0 && !loading ? (
          <Text ta="center" py="xl">No files found</Text>
        ) : (
          <>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}>
                    <Checkbox
                      checked={selectedFiles.length === files.length && files.length > 0}
                      indeterminate={selectedFiles.length > 0 && selectedFiles.length < files.length}
                      onChange={toggleAllFiles}
                    />
                  </Table.Th>
                  <Table.Th>File</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Project</Table.Th>
                  <Table.Th>Size</Table.Th>
                  <Table.Th>Upload Date</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {files.map((file) => (
                  <Table.Tr 
                    key={file.id} 
                    onClick={(e) => {
                      // Don't trigger row click when clicking on checkbox or action buttons
                      const target = e.target as HTMLElement;
                      if (target.closest('.mantine-ActionIcon-root') || 
                          target.closest('.mantine-Checkbox-root') ||
                          target.tagName === 'INPUT') {
                        return;
                      }
                      
                      // Only preview completed files
                      if (file.status === 'completed') {
                        handleRowClick(file);
                      }
                    }} 
                    style={{ 
                      cursor: file.status === 'completed' ? 'pointer' : 'default',
                      background: file.id === previewFile?.id ? 'rgba(0,0,0,0.03)' : undefined
                    }}
                  >
                    <Table.Td>
                      <Checkbox
                        checked={selectedFiles.includes(file.id)}
                        onChange={() => toggleFileSelection(file.id)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{file.fileName}</Text>
                      <Text size="xs" c="dimmed">{file.fileType}</Text>
                    </Table.Td>
                    <Table.Td>{file.clientName}</Table.Td>
                    <Table.Td>{file.projectName}</Table.Td>
                    <Table.Td>{file.fileSize}</Table.Td>
                    <Table.Td>{file.uploadDate}</Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(file.status)} variant="light">
                        {formatStatus(file.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {/* Preview action */}
                        {file.status === 'completed' && isPreviewable(file.fileType) && (
                          <Tooltip label="Preview">
                            <ActionIcon
                              variant="light"
                              color="teal"
                              onClick={() => handlePreview(file)}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        
                        {/* Download action */}
                        <Tooltip label="Download">
                          <ActionIcon 
                            variant="light" 
                            color="blue" 
                            onClick={() => handleDownload(file)}
                            disabled={file.status !== 'completed'}
                          >
                            <IconDownload size={16} />
                          </ActionIcon>
                        </Tooltip>
                        
                        {/* Delete action */}
                        <Tooltip label="Delete">
                          <ActionIcon 
                            variant="light" 
                            color="red" 
                            onClick={() => initiateDeleteFile(file.id, file.fileName)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            
            {totalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination 
                  total={totalPages} 
                  value={currentPage} 
                  onChange={handlePageChange} 
                />
                <Text size="sm" c="dimmed">
                  Showing {files.length} of {totalFiles} files
                </Text>
              </Group>
            )}
          </>
        )}
      </Paper>

      {/* Single file delete modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Confirm Delete"
        centered
        size="md"
      >
        <Stack>
          <Text>
            Are you sure you want to delete {fileToDelete?.fileName}? This action cannot be undone.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeDeleteModal}>
              Cancel
            </Button>
            <Button 
              color="red" 
              onClick={deleteFile}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
      
      {/* Bulk delete confirmation modal */}
      <Modal
        opened={bulkDeleteModalOpened}
        onClose={closeBulkDeleteModal}
        title="Confirm Bulk Delete"
        centered
        size="md"
      >
        <Stack>
          <Text>
            Are you sure you want to delete {selectedFiles.length} files? This action cannot be undone.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeBulkDeleteModal}>
              Cancel
            </Button>
            <Button 
              color="red" 
              onClick={bulkDelete}
            >
              Delete {selectedFiles.length} Files
            </Button>
          </Group>
        </Stack>
      </Modal>
      
      {/* File preview drawer */}
      <Drawer
        opened={previewOpened}
        onClose={closePreview}
        title={previewFile?.fileName}
        size="xl"
        position="right"
        padding="md"
      >
        {previewFile && (
          <Stack>
            <Paper withBorder p="lg" style={{ minHeight: '400px' }}>
              <PreviewComponent file={previewFile} />
            </Paper>
            
            <Box>
              <Text fw={700} size="sm">File Details</Text>
              <Text size="sm"><strong>Type:</strong> {previewFile.fileType}</Text>
              <Text size="sm"><strong>Size:</strong> {previewFile.fileSize}</Text>
              <Text size="sm"><strong>Uploaded:</strong> {previewFile.uploadDate}</Text>
              <Text size="sm"><strong>Client:</strong> {previewFile.clientName}</Text>
              <Text size="sm"><strong>Project:</strong> {previewFile.projectName}</Text>
            </Box>
            
            <Group mt="xl">
              <Button 
                leftSection={<IconDownload size={16} />} 
                onClick={() => handleDownload(previewFile)}
              >
                Download
              </Button>
              <Button 
                variant="light" 
                color="red" 
                leftSection={<IconTrash size={16} />}
                onClick={() => {
                  initiateDeleteFile(previewFile.id, previewFile.fileName);
                  closePreview();
                }}
              >
                Delete
              </Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </Container>
  );
}