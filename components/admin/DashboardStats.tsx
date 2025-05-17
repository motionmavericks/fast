'use client';

import { useState, useEffect } from 'react';
import { Paper, Title, Text, Group, SimpleGrid, Skeleton, RingProgress, Badge, Stack } from '@mantine/core';
import { IconFiles, IconDownload, IconUsers, IconExclamationMark } from '@tabler/icons-react';

interface StatsData {
  totalUploads: number;
  totalSize: number;
  activeLinks: number;
  pendingUploads: number;
  recentUploads: Array<{
    fileName: string;
    fileSize: number;
    clientName: string;
    projectName: string;
    uploadDate: string;
    status: string;
  }>;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function DashboardStats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch stats data
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/stats');
        
        if (!response.ok) {
          throw new Error('Failed to load statistics');
        }
        
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching stats:', err);
        setError(err.message || 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // If still loading, show skeleton
  if (loading) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
        <Skeleton height={160} radius="md" />
        <Skeleton height={160} radius="md" />
        <Skeleton height={160} radius="md" />
      </SimpleGrid>
    );
  }

  // If error occurred, show error state
  if (error || !stats) {
    return (
      <Paper withBorder p="md" radius="md">
        <Group>
          <IconExclamationMark size={32} color="red" />
          <div>
            <Title order={3}>Failed to load statistics</Title>
            <Text c="dimmed">{error || 'Unknown error'}</Text>
          </div>
        </Group>
      </Paper>
    );
  }

  // Calculate percentage of successful uploads (for ring progress)
  const successRate = stats.totalUploads > 0 
    ? Math.round(((stats.totalUploads - stats.pendingUploads) / stats.totalUploads) * 100) 
    : 100;

  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
        <Paper withBorder p="md" radius="md">
          <Group align="flex-start" justify="space-between">
            <div>
              <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                Total Uploads
              </Text>
              <Title order={3}>{stats.totalUploads.toLocaleString()}</Title>
              <Text size="sm" c="dimmed" mt={5}>
                {formatFileSize(stats.totalSize)} of data
              </Text>
            </div>
            <IconFiles size={48} opacity={0.6} />
          </Group>
        </Paper>
        
        <Paper withBorder p="md" radius="md">
          <Group align="flex-start" justify="space-between">
            <div>
              <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                Active Upload Links
              </Text>
              <Title order={3}>{stats.activeLinks.toLocaleString()}</Title>
              <Text size="sm" c="dimmed" mt={5}>
                Ready to receive uploads
              </Text>
            </div>
            <IconUsers size={48} opacity={0.6} />
          </Group>
        </Paper>
        
        <Paper withBorder p="md" radius="md">
          <Group align="flex-start" justify="space-between">
            <div>
              <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                Upload Success Rate
              </Text>
              <Title order={3}>{successRate}%</Title>
              <Text size="sm" c="dimmed" mt={5}>
                {stats.pendingUploads > 0 ? `${stats.pendingUploads} pending uploads` : 'All uploads successful'}
              </Text>
            </div>
            <RingProgress
              size={60}
              roundCaps
              thickness={5}
              sections={[{ value: successRate, color: 'blue' }]}
              label={
                <IconDownload size={20} style={{ width: 20, height: 20 }} />
              }
            />
          </Group>
        </Paper>
      </SimpleGrid>
      
      {stats.recentUploads.length > 0 && (
        <Paper withBorder p="md" radius="md" mt="lg">
          <Title order={3} mb="md">Recent Uploads</Title>
          <Stack gap="sm">
            {stats.recentUploads.map((upload, index) => (
              <Paper key={index} p="sm" withBorder radius="md">
                <Group justify="space-between" mb={5}>
                  <Text fw={600}>{upload.fileName}</Text>
                  <Badge color={upload.status === 'completed' ? 'green' : upload.status === 'processing' ? 'yellow' : 'red'}>
                    {upload.status}
                  </Badge>
                </Group>
                <Group gap="md">
                  <Text size="sm" c="dimmed">Project: {upload.projectName}</Text>
                  <Text size="sm" c="dimmed">Client: {upload.clientName}</Text>
                  <Text size="sm" c="dimmed">Size: {formatFileSize(upload.fileSize)}</Text>
                  <Text size="sm" c="dimmed">Uploaded: {new Date(upload.uploadDate).toLocaleString()}</Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}
    </>
  );
}
