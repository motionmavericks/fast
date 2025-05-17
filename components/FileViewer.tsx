import { useState } from 'react';
import { Card, Image, Text, Button, Group, Stack, Box, Tabs, Modal } from '@mantine/core';
import { IconDownload, IconPlayerPlay, IconTrash, IconExternalLink, IconMovie, IconFile } from '@tabler/icons-react';
import AdaptiveVideoPlayer from './AdaptiveVideoPlayer';

interface FileViewerProps {
  file: any; // Using any for simplicity, ideally use a proper File type
  onDownload?: (file: any) => void;
  onDelete?: (file: any) => void;
  onOpenFrame?: (file: any) => void;
}

/**
 * File viewer component with preview and playback capabilities
 */
export default function FileViewer({ file, onDownload, onDelete, onOpenFrame }: FileViewerProps) {
  const [videoModalOpen, setVideoModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string | null>('preview');
  
  // Determine file type category
  const isVideo = file.fileType?.startsWith('video/');
  const isImage = file.fileType?.startsWith('image/');
  const isDocument = file.fileType?.startsWith('application/pdf');
  
  // Get thumbnail if available, or default by type
  const getThumbnail = () => {
    if (file.frameIoData?.assetDetails?.thumbnail_url) {
      return file.frameIoData.assetDetails.thumbnail_url;
    }
    
    // Default thumbnails based on type
    if (isVideo) return '/thumbnails/video.png';
    if (isImage) return '/thumbnails/image.png';
    if (isDocument) return '/thumbnails/document.png';
    return '/thumbnails/file.png';
  };
  
  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  return (
    <>
      <Card shadow="sm" p="lg" radius="md" withBorder>
        <Card.Section>
          <Box pos="relative">
            {isVideo ? (
              // Video thumbnail with play button overlay
              <Box pos="relative" style={{ aspectRatio: '16/9' }}>
                <Image
                  src={getThumbnail()}
                  height={180}
                  alt={file.fileName}
                  withPlaceholder
                  placeholder={<IconMovie size={80} />}
                />
                <Box
                  pos="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.2)'
                  }}
                >
                  <Button
                    variant="filled"
                    color="blue"
                    radius="xl"
                    onClick={() => setVideoModalOpen(true)}
                  >
                    <IconPlayerPlay size={16} />
                    &nbsp;Play
                  </Button>
                </Box>
              </Box>
            ) : (
              // Standard thumbnail for other files
              <Image
                src={getThumbnail()}
                height={180}
                alt={file.fileName}
                withPlaceholder
                placeholder={<IconFile size={80} />}
              />
            )}
          </Box>
        </Card.Section>
        
        <Tabs value={activeTab} onTabChange={setActiveTab} mt="md">
          <Tabs.List>
            <Tabs.Tab value="preview">Preview</Tabs.Tab>
            <Tabs.Tab value="details">Details</Tabs.Tab>
          </Tabs.List>
          
          <Tabs.Panel value="preview" pt="md">
            <Stack spacing="xs">
              <Text weight={500} size="lg" truncate>
                {file.fileName}
              </Text>
              <Text size="sm" color="dimmed">
                {formatFileSize(file.fileSize)}
              </Text>
              <Group mt="md" spacing="xs">
                {onDownload && (
                  <Button 
                    variant="light" 
                    color="blue" 
                    size="xs"
                    leftIcon={<IconDownload size={16} />}
                    onClick={() => onDownload(file)}
                  >
                    Download
                  </Button>
                )}
                
                {onDelete && (
                  <Button 
                    variant="light" 
                    color="red" 
                    size="xs"
                    leftIcon={<IconTrash size={16} />}
                    onClick={() => onDelete(file)}
                  >
                    Delete
                  </Button>
                )}
                
                {isVideo && file.frameIoData?.assetId && onOpenFrame && (
                  <Button 
                    variant="light" 
                    size="xs"
                    leftIcon={<IconExternalLink size={16} />}
                    onClick={() => onOpenFrame(file)}
                  >
                    Open in Frame.io
                  </Button>
                )}
              </Group>
            </Stack>
          </Tabs.Panel>
          
          <Tabs.Panel value="details" pt="md">
            <Stack spacing="xs">
              <Group position="apart">
                <Text size="sm" weight={500}>Filename:</Text>
                <Text size="sm">{file.fileName}</Text>
              </Group>
              
              <Group position="apart">
                <Text size="sm" weight={500}>Size:</Text>
                <Text size="sm">{formatFileSize(file.fileSize)}</Text>
              </Group>
              
              <Group position="apart">
                <Text size="sm" weight={500}>Type:</Text>
                <Text size="sm">{file.fileType}</Text>
              </Group>
              
              <Group position="apart">
                <Text size="sm" weight={500}>Client:</Text>
                <Text size="sm">{file.clientName}</Text>
              </Group>
              
              <Group position="apart">
                <Text size="sm" weight={500}>Project:</Text>
                <Text size="sm">{file.projectName}</Text>
              </Group>
              
              <Group position="apart">
                <Text size="sm" weight={500}>Uploaded:</Text>
                <Text size="sm">{formatDate(file.createdAt)}</Text>
              </Group>
              
              {isVideo && file.frameIoData?.assetDetails?.properties && (
                <>
                  <Group position="apart">
                    <Text size="sm" weight={500}>Duration:</Text>
                    <Text size="sm">
                      {formatTime(file.frameIoData.assetDetails.properties.duration_in_ms / 1000)}
                    </Text>
                  </Group>
                  
                  <Group position="apart">
                    <Text size="sm" weight={500}>Resolution:</Text>
                    <Text size="sm">
                      {file.frameIoData.assetDetails.properties.width} x {file.frameIoData.assetDetails.properties.height}
                    </Text>
                  </Group>
                </>
              )}
              
              {file.frameIoData?.proxies && file.frameIoData.proxies.length > 0 && (
                <Group position="apart">
                  <Text size="sm" weight={500}>Proxies:</Text>
                  <Text size="sm">
                    {file.frameIoData.proxies.map(p => p.quality).join(', ')}
                  </Text>
                </Group>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Card>
      
      {/* Video playback modal */}
      <Modal
        opened={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        title={file.fileName}
        size="xl"
        padding={0}
        withCloseButton={false}
        styles={{
          header: { padding: '10px 15px', margin: 0 },
          body: { padding: 0 },
        }}
      >
        <AdaptiveVideoPlayer
          fileId={file._id}
          poster={getThumbnail()}
          autoDetectQuality={true}
        />
        
        <Group position="right" p="md">
          <Button onClick={() => setVideoModalOpen(false)}>Close</Button>
        </Group>
      </Modal>
    </>
  );
}

// Format time display (MM:SS)
function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
} 