'use client';

import { Container, Title, Text, Grid, Space } from '@mantine/core';
import StorageManager from '@/components/admin/StorageManager';

export default function StoragePage() {
  return (
    <Container fluid>
      <Title order={2} mb="md">Storage Management</Title>
      <Text mb="xl" c="dimmed">
        View and monitor storage usage across all tiers: Frame.io, Cloudflare R2, and LucidLink.
        Track usage by client, project, and file type.
      </Text>
      
      <StorageManager />
      
      <Space h="xl" />
      
      <Grid>
        <Grid.Col span={12} md={6}>
          <Text fw={700} mb="xs">About Frame.io Storage</Text>
          <Text size="sm" mb="lg">
            Frame.io is used for initial upload processing and proxy generation. Files are temporarily stored
            here before being moved to permanent storage. The storage usage shown represents files currently
            in the Frame.io processing pipeline.
          </Text>
        </Grid.Col>
        
        <Grid.Col span={12} md={6}>
          <Text fw={700} mb="xs">About Cloudflare R2 Storage</Text>
          <Text size="sm" mb="lg">
            Cloudflare R2 is used for edge delivery of proxy videos. This provides fast, low-latency access
            to preview-quality versions of your files. Storage usage here is optimized for efficient delivery
            rather than archival purposes.
          </Text>
        </Grid.Col>
        
        <Grid.Col span={12} md={6}>
          <Text fw={700} mb="xs">About LucidLink Storage</Text>
          <Text size="sm" mb="lg">
            LucidLink stores high-quality originals for post-production work. This is where your master files
            are kept securely with fast access for editing and production workflows. This storage tier represents
            your most valuable assets.
          </Text>
        </Grid.Col>
        
        <Grid.Col span={12} md={6}>
          <Text fw={700} mb="xs">Storage Optimization Tips</Text>
          <Text size="sm" mb="lg">
            • Regularly review your client and project storage usage<br />
            • Archive completed projects to reduce active storage costs<br />
            • Consider compressing or optimizing large files when possible<br />
            • Set appropriate retention policies for different file types<br />
            • Monitor growth trends to anticipate future storage needs
          </Text>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
