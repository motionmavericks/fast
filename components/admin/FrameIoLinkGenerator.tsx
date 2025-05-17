'use client';

import { useState } from 'react';
import { 
  Box, 
  Button, 
  Text, 
  Group, 
  Stack,
  Paper, 
  TextInput,
  Select,
  Textarea,
  LoadingOverlay,
  Alert,
  CopyButton,
  ActionIcon,
  Tooltip,
  Code,
  Divider
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCheck, IconCopy, IconExternalLink, IconFileUpload } from '@tabler/icons-react';
import { ProxyQuality } from '@/utils/frameioService';

interface FrameIoLinkGeneratorProps {
  linkId: string;
  clientName: string;
  projectName: string;
  onSuccess?: (uploadUrl: string) => void;
}

interface GeneratedLinkData {
  assetId: string;
  uploadUrl: string;
  expiresAt: string;
}

export default function FrameIoLinkGenerator({ 
  linkId, 
  clientName, 
  projectName, 
  onSuccess 
}: FrameIoLinkGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<GeneratedLinkData | null>(null);
  const [fileName, setFileName] = useState<string>(`${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}`);
  const [fileType, setFileType] = useState<string>('video/mp4');
  const [fileSize, setFileSize] = useState<string>('10'); // in GB

  const generateLink = async () => {
    if (!fileName || !fileType) {
      setError('File name and type are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const size = parseFloat(fileSize) * 1024 * 1024 * 1024; // Convert GB to bytes
      
      const response = await fetch(`/api/links/${linkId}/frameio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          fileSize: size,
          fileType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate Frame.io upload link');
      }

      const data = await response.json();
      setGeneratedLink(data);
      notifications.show({
        title: 'Success',
        message: 'Frame.io upload link generated successfully',
        color: 'green',
      });

      if (onSuccess) {
        onSuccess(data.uploadUrl);
      }
    } catch (error: any) {
      setError(error.message);
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const fileTypeOptions = [
    { value: 'video/mp4', label: 'Video (MP4)' },
    { value: 'video/mov', label: 'Video (MOV)' },
    { value: 'video/avi', label: 'Video (AVI)' },
    { value: 'video/mxf', label: 'Video (MXF)' },
    { value: 'application/x-prores', label: 'ProRes' },
    { value: 'image/jpeg', label: 'Image (JPEG)' },
    { value: 'image/png', label: 'Image (PNG)' },
    { value: 'image/tiff', label: 'Image (TIFF)' },
    { value: 'application/pdf', label: 'PDF Document' },
    { value: 'application/zip', label: 'Archive (ZIP)' },
  ];

  return (
    <Paper p="md" withBorder shadow="sm" radius="md" pos="relative">
      <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
      
      <Stack>
        <Text fw={500} size="lg">Generate Frame.io Upload Link</Text>
        <Text size="sm" c="dimmed">
          Create a direct upload link to Frame.io for this client/project. This will create the necessary
          folder structure and prepare the asset for upload.
        </Text>

        {error && (
          <Alert color="red" title="Error" icon={<IconAlertCircle />}>
            {error}
          </Alert>
        )}

        {generatedLink ? (
          <>
            <Alert title="Upload Link Generated" color="green" icon={<IconCheck />}>
              Frame.io upload link successfully generated. This link will expire on {new Date(generatedLink.expiresAt).toLocaleString()}.
            </Alert>
            
            <Box>
              <Text fw={500} size="sm">Upload URL:</Text>
              <Group mt="xs">
                <Code block style={{ wordBreak: 'break-all' }}>{generatedLink.uploadUrl}</Code>
              </Group>
              <Group mt="xs">
                <CopyButton value={generatedLink.uploadUrl}>
                  {({ copied, copy }) => (
                    <Button 
                      color={copied ? 'teal' : 'blue'} 
                      onClick={copy}
                      leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    >
                      {copied ? 'Copied' : 'Copy Link'}
                    </Button>
                  )}
                </CopyButton>
                <Button 
                  variant="light" 
                  component="a" 
                  href={generatedLink.uploadUrl} 
                  target="_blank"
                  leftSection={<IconExternalLink size={16} />}
                >
                  Open Link
                </Button>
              </Group>
            </Box>
            
            <Divider my="sm" />
            
            <Button 
              onClick={() => setGeneratedLink(null)} 
              variant="outline"
              leftSection={<IconFileUpload size={16} />}
            >
              Generate Another Link
            </Button>
          </>
        ) : (
          <Stack>
            <TextInput
              label="File Name"
              placeholder="Enter file name"
              value={fileName}
              onChange={(e) => setFileName(e.currentTarget.value)}
              required
            />
            
            <Select
              label="File Type"
              placeholder="Select file type"
              value={fileType}
              onChange={(value) => setFileType(value || 'video/mp4')}
              data={fileTypeOptions}
              required
            />
            
            <TextInput
              label="File Size (GB)"
              placeholder="Enter estimated file size in GB"
              value={fileSize}
              onChange={(e) => setFileSize(e.currentTarget.value)}
              type="number"
              min="0.1"
              step="0.1"
              required
            />
            
            <Group mt="md" justify="flex-end">
              <Button onClick={generateLink} leftSection={<IconFileUpload size={16} />}>
                Generate Upload Link
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
