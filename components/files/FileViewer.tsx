'use client';

import { useState, useEffect } from 'react';
import { Paper, Title, Text, Group, Badge, ActionIcon, Button, Modal, Tabs, Tooltip, Skeleton, Image, Stack } from '@mantine/core';
import { IconDownload, IconTrash, IconExternalLink, IconPhoto, IconVideo, IconFileText, IconFileZip, IconQuestionMark, IconPlayerPlay } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import AdaptiveVideoPlayer from '../video/AdaptiveVideoPlayer';

// Define the file data structure
interface FileData {
  _id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  clientName: string;
  projectName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  storageKey: string;
  createdAt: string;
  frameIoData?: {
    assetId?: string;
    proxyStatus?: string;
    proxies?: Array<{
      quality: string;
      r2Key: string;
      profile: string;
    }>;
  };
}

interface FileViewerProps {
  fileId: string;
  onClose: () => void;
}

// Format bytes to human-readable file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get file icon based on mimetype
function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <IconPhoto size={24} />;
  if (type.startsWith('video/')) return <IconVideo size={24} />;
  if (type.includes('pdf')) return <IconFileText size={24} />;
  if (type.includes('zip') || type.includes('rar')) return <IconFileZip size={24} />;
  return <IconQuestionMark size={24} />;
}

export default function FileViewer({ fileId, onClose }: FileViewerProps) {
  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('details');
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [videoPlayerOpened, { open: openVideoPlayer, close: closeVideoPlayer }] = useDisclosure(false);
  const [proxySources, setProxySources] = useState<any[]>([]);
  
  // Fetch file details
  useEffect(() => {
    const fetchFileDetails = async () => {
      try {
        setLoading(true);
        
        const response = await fetch(`/api/files/${fileId}`);
        
        if (!response.ok) {
          throw new Error('Failed to load file details');
        }
        
        const data = await response.json();
        setFile(data);
        
        // Prepare proxy sources if it's a video file
        if (data.frameIoData?.proxies && data.frameIoData.proxies.length > 0) {
          const proxyUrls = await Promise.all(
            data.frameIoData.proxies.map(async (proxy: any) => {
              try {
                const urlResponse = await fetch(`/api/files/proxy?key=${proxy.r2Key}`);
                
                if (!urlResponse.ok) {
                  return null;
                }
                
                const { url } = await urlResponse.json();
                
                // Extract resolution from profile if available
                let label = proxy.quality;
                if (proxy.profile) {
                  const resMatch = proxy.profile.match(/\d+/);
                  if (resMatch) {
                    label = `${resMatch[0]}p`;
                  }
                }
                
                return {
                  quality: proxy.quality,
                  url,
                  label
                };
              } catch (e) {
                return null;
              }
            })
          );
          
          // Filter out failed requests
          setProxySources(proxyUrls.filter(Boolean));
        }
        
      } catch (err: any) {
        console.error('Error fetching file details:', err);
        setError(err.message || 'Failed to load file details');
      } finally {
        setLoading(false);
      }
    };

    if (fileId) {
      fetchFileDetails();
    }
  }, [fileId]);

  // Generate download URL
  const generateDownloadUrl = async () => {
    try {
      const response = await fetch(`/api/files/${fileId}/download`);
      
      if (!response.ok) {
        throw new Error('Failed to generate download URL');
      }
      
      const { url } = await response.json();
      setDownloadUrl(url);
      
      // Open in new tab
      window.open(url, '_blank');
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: 'Failed to generate download URL: ' + (err.message || 'Unknown error'),
        color: 'red'
      });
    }
  };

  // Delete file
  const deleteFile = async () => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete file');
      }
      
      notifications.show({
        title: 'Success',
        message: 'File has been deleted successfully',
        color: 'green'
      });
      
      closeDeleteModal();
      onClose();
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete file: ' + (err.message || 'Unknown error'),
        color: 'red'
      });
    }
  };

  // Open video player modal if file has proxies
  const handlePlayVideo = () => {
    if (proxySources.length > 0) {
      openVideoPlayer();
    } else {
      notifications.show({
        title: 'No Proxies Available',
        message: 'This video does not have any proxy versions for playback',
        color: 'yellow'
      });
    }
  };

  if (loading) {
    return (
      <Paper withBorder p="md" radius="md">
        <Skeleton height={30} width="60%" mb="md" />
        <Skeleton height={20} mb="xs" />
        <Skeleton height={20} mb="xs" />
        <Skeleton height={20} mb="xs" />
        <Skeleton height={20} mb="xs" />
        <Group mt="xl">
          <Skeleton height={36} width={120} radius="md" />
          <Skeleton height={36} width={120} radius="md" />
        </Group>
      </Paper>
    );
  }

  if (error || !file) {
    return (
      <Paper withBorder p="md" radius="md">
        <Title order={3} mb="md">Error</Title>
        <Text c="red">{error || 'File not found'}</Text>
        <Button mt="md" onClick={onClose}>Close</Button>
      </Paper>
    );
  }

  // Check if file is an image
  const isImage = file.fileType.startsWith('image/');
  
  // Check if file is a video
  const isVideo = file.fileType.startsWith('video/') && file.frameIoData?.proxies && file.frameIoData.proxies.length > 0;

  return (
    <>
      <Paper withBorder p="lg" radius="md">
        <Group position="apart" mb="md">
          <Group>
            {getFileIcon(file.fileType)}
            <Title order={3}>{file.fileName}</Title>
          </Group>
          <Badge
            color={
              file.status === 'completed' ? 'green' : 
              file.status === 'processing' ? 'yellow' : 
              file.status === 'pending' ? 'blue' : 'red'
            }
            size="lg"
          >
            {file.status}
          </Badge>
        </Group>
        
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="details" leftSection={<IconFileText size={16} />}>
              Details
            </Tabs.Tab>
            {isImage && (
              <Tabs.Tab value="preview" leftSection={<IconPhoto size={16} />}>
                Preview
              </Tabs.Tab>
            )}
            {isVideo && (
              <Tabs.Tab value="video" leftSection={<IconVideo size={16} />}>
                Video
              </Tabs.Tab>
            )}
          </Tabs.List>
          
          <Tabs.Panel value="details">
            <Stack>
              <Group>
                <Text fw={600} style={{ width: 150 }}>File Size:</Text>
                <Text>{formatFileSize(file.fileSize)}</Text>
              </Group>
              
              <Group>
                <Text fw={600} style={{ width: 150 }}>File Type:</Text>
                <Text>{file.fileType}</Text>
              </Group>
              
              <Group>
                <Text fw={600} style={{ width: 150 }}>Client:</Text>
                <Text>{file.clientName}</Text>
              </Group>
              
              <Group>
                <Text fw={600} style={{ width: 150 }}>Project:</Text>
                <Text>{file.projectName}</Text>
              </Group>
              
              <Group>
                <Text fw={600} style={{ width: 150 }}>Upload Date:</Text>
                <Text>{new Date(file.createdAt).toLocaleString()}</Text>
              </Group>
              
              {file.frameIoData?.assetId && (
                <Group>
                  <Text fw={600} style={{ width: 150 }}>Frame.io Asset ID:</Text>
                  <Text>{file.frameIoData.assetId}</Text>
                </Group>
              )}
              
              {file.frameIoData?.proxies && file.frameIoData.proxies.length > 0 && (
                <Group>
                  <Text fw={600} style={{ width: 150 }}>Available Proxies:</Text>
                  <Group>
                    {file.frameIoData.proxies.map((proxy, index) => (
                      <Badge key={index} color="blue">
                        {proxy.quality}
                      </Badge>
                    ))}
                  </Group>
                </Group>
              )}
            </Stack>
          </Tabs.Panel>
          
          {isImage && (
            <Tabs.Panel value="preview">
              <Paper withBorder p="md" radius="md">
                <Button
                  mb="md"
                  leftSection={<IconExternalLink size={16} />}
                  variant="light"
                  onClick={generateDownloadUrl}
                >
                  Open Full Image
                </Button>
                
                <Image
                  src={`/api/files/${fileId}/preview`}
                  alt={file.fileName}
                  height={400}
                  fit="contain"
                  fallbackSrc="https://placehold.co/600x400?text=Image+Preview+Unavailable"
                />
              </Paper>
            </Tabs.Panel>
          )}
          
          {isVideo && (
            <Tabs.Panel value="video">
              <Paper withBorder p="md" radius="md">
                <Group mb="md">
                  <Button
                    leftSection={<IconPlayerPlay size={16} />}
                    onClick={handlePlayVideo}
                  >
                    Play Video
                  </Button>
                  <Text size="sm" c="dimmed">
                    {proxySources.length} proxy versions available
                  </Text>
                </Group>
                
                <Image
                  src={`/api/files/${fileId}/thumbnail`}
                  alt={file.fileName}
                  height={300}
                  fit="contain"
                  fallbackSrc="https://placehold.co/600x400?text=Video+Thumbnail+Unavailable"
                />
              </Paper>
            </Tabs.Panel>
          )}
        </Tabs>
        
        <Group mt="xl">
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={generateDownloadUrl}
          >
            Download
          </Button>
          <Button
            leftSection={<IconTrash size={16} />}
            color="red"
            variant="outline"
            onClick={openDeleteModal}
          >
            Delete
          </Button>
          <Button variant="default" onClick={onClose} ml="auto">
            Close
          </Button>
        </Group>
      </Paper>
      
      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Confirm Delete"
        centered
      >
        <Text mb="md">
          Are you sure you want to delete "{file.fileName}"? This action cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={closeDeleteModal}>
            Cancel
          </Button>
          <Button color="red" onClick={deleteFile}>
            Delete
          </Button>
        </Group>
      </Modal>
      
      {/* Video Player Modal */}
      <Modal
        opened={videoPlayerOpened}
        onClose={closeVideoPlayer}
        title={`Viewing: ${file.fileName}`}
        size="xl"
        centered
      >
        <AdaptiveVideoPlayer sources={proxySources} />
      </Modal>
    </>
  );
}
