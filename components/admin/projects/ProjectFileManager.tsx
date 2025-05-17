'use client';

import { useState, useEffect } from 'react';
import { 
  Paper, 
  Title, 
  Text, 
  Group, 
  Button, 
  Table, 
  Badge, 
  Tooltip, 
  Loader,
  ScrollArea,
  Select,
  Pagination,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { 
  IconRefresh, 
  IconCheck, 
  IconX, 
  IconClockHour4,
  IconFileUpload
} from '@tabler/icons-react';

interface IProject {
  _id: string;
  projectId: string;
  name: string;
}

interface StorageLocation {
  status: 'pending' | 'available' | 'failed' | 'not_applicable';
  path?: string;
  url?: string;
  lastChecked?: string;
  error?: string;
}

interface IProjectFile {
  _id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  originalPath: string;
  relativePath: string;
  uploadedBy: {
    _id: string;
    email: string;
  };
  storageLocations: {
    frameio?: StorageLocation;
    r2?: StorageLocation;
    lucidlink?: StorageLocation;
  };
  status: 'uploading' | 'processing' | 'available' | 'failed' | 'archived';
  version: number;
  tags: string[];
  metadata: any;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectFileManagerProps {
  project: IProject;
}

export default function ProjectFileManager({ project }: ProjectFileManagerProps) {
  const [files, setFiles] = useState<IProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    pages: 0,
  });
  
  // Fetch files on mount and when filters/pagination change
  useEffect(() => {
    fetchFiles();
  }, [statusFilter, pagination.page]);
  
  // Fetch files from API
  const fetchFiles = async () => {
    setLoading(true);
    try {
      // Construct URL with optional filters
      let url = `/api/projects/${project._id}/files?page=${pagination.page}`;
      
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch files');
      }
      
      const data = await response.json();
      
      setFiles(data.files);
      setPagination(data.pagination);
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Format date for display
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };
  
  // Get status badge for storage location
  const getStatusBadge = (location?: StorageLocation) => {
    if (!location) {
      return <Badge color="gray">N/A</Badge>;
    }
    
    switch (location.status) {
      case 'available':
        return <Badge color="green" leftSection={<IconCheck size={10} />}>Available</Badge>;
      case 'pending':
        return <Badge color="yellow" leftSection={<IconClockHour4 size={10} />}>Pending</Badge>;
      case 'failed':
        return <Badge color="red" leftSection={<IconX size={10} />}>Failed</Badge>;
      case 'not_applicable':
        return <Badge color="gray">Not Needed</Badge>;
      default:
        return <Badge color="gray">Unknown</Badge>;
    }
  };
  
  // Get file status badge
  const getFileStatusBadge = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Badge color="blue" leftSection={<IconFileUpload size={10} />}>Uploading</Badge>;
      case 'processing':
        return <Badge color="yellow" leftSection={<IconClockHour4 size={10} />}>Processing</Badge>;
      case 'available':
        return <Badge color="green" leftSection={<IconCheck size={10} />}>Available</Badge>;
      case 'failed':
        return <Badge color="red" leftSection={<IconX size={10} />}>Failed</Badge>;
      case 'archived':
        return <Badge color="gray">Archived</Badge>;
      default:
        return <Badge color="gray">Unknown</Badge>;
    }
  };
  
  return (
    <Paper p="md" withBorder radius="md">
      <Group position="apart" mb="md">
        <Title order={4}>Project Files</Title>
        <Group>
          <Select
            placeholder="Filter by status"
            clearable
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: 'uploading', label: 'Uploading' },
              { value: 'processing', label: 'Processing' },
              { value: 'available', label: 'Available' },
              { value: 'failed', label: 'Failed' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={fetchFiles}
            loading={loading}
          >
            Refresh
          </Button>
        </Group>
      </Group>
      
      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>File Name</Table.Th>
              <Table.Th>Size</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Frame.io</Table.Th>
              <Table.Th>R2</Table.Th>
              <Table.Th>LucidLink</Table.Th>
              <Table.Th>Uploaded By</Table.Th>
              <Table.Th>Uploaded At</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={8} align="center">
                  <Loader size="sm" mx="auto" my="md" />
                </Table.Td>
              </Table.Tr>
            ) : files.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8} align="center">
                  <Text c="dimmed" py="md">
                    No files found for this project.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              files.map((file) => (
                <Table.Tr key={file._id}>
                  <Table.Td>
                    <Tooltip label={file.relativePath}>
                      <Text>{file.fileName}</Text>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>{formatFileSize(file.fileSize)}</Table.Td>
                  <Table.Td>{getFileStatusBadge(file.status)}</Table.Td>
                  <Table.Td>{getStatusBadge(file.storageLocations.frameio)}</Table.Td>
                  <Table.Td>{getStatusBadge(file.storageLocations.r2)}</Table.Td>
                  <Table.Td>{getStatusBadge(file.storageLocations.lucidlink)}</Table.Td>
                  <Table.Td>{file.uploadedBy.email}</Table.Td>
                  <Table.Td>{formatDate(file.createdAt)}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      
      {pagination.pages > 1 && (
        <Group position="center" mt="md">
          <Pagination
            total={pagination.pages}
            value={pagination.page}
            onChange={(page) => setPagination({ ...pagination, page })}
          />
        </Group>
      )}
    </Paper>
  );
}
