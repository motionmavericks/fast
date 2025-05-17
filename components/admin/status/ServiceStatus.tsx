'use client';
// components/admin/status/ServiceStatus.tsx - Component to check service status

import { useState, useEffect } from 'react';
import { Paper, Title, Text, Group, Badge, Button, Stack, Code, Alert } from '@mantine/core';
import { IconCloud, IconServer, IconRefresh, IconAlertCircle } from '@tabler/icons-react';

interface ServiceStatusProps {
  // No props required
}

interface StatusData {
  status: 'connected' | 'error' | 'loading' | 'not_initialized';
  message: string;
  config?: any;
}

export default function ServiceStatus({ }: ServiceStatusProps) {
  const [frameIoStatus, setFrameIoStatus] = useState<StatusData>({ 
    status: 'loading', 
    message: 'Checking Frame.io status...' 
  });
  
  const [r2Status, setR2Status] = useState<StatusData>({ 
    status: 'loading', 
    message: 'Checking Cloudflare R2 status...' 
  });

  const checkFrameIoStatus = async () => {
    try {
      setFrameIoStatus({ status: 'loading', message: 'Checking Frame.io status...' });
      const response = await fetch('/api/status/frameio');
      const data = await response.json();
      setFrameIoStatus({
        status: data.status,
        message: data.message,
        config: data.config
      });
    } catch (error) {
      setFrameIoStatus({
        status: 'error',
        message: 'Error checking Frame.io status'
      });
    }
  };

  const checkR2Status = async () => {
    try {
      setR2Status({ status: 'loading', message: 'Checking Cloudflare R2 status...' });
      const response = await fetch('/api/status/r2');
      const data = await response.json();
      setR2Status({
        status: data.status,
        message: data.message,
        config: data.config
      });
    } catch (error) {
      setR2Status({
        status: 'error',
        message: 'Error checking R2 status'
      });
    }
  };

  const checkAllServices = () => {
    checkFrameIoStatus();
    checkR2Status();
  };

  useEffect(() => {
    checkAllServices();
  }, []);

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'green';
      case 'loading':
        return 'blue';
      case 'not_initialized':
        return 'yellow';
      case 'error':
      default:
        return 'red';
    }
  };

  return (
    <Stack spacing="md">
      <Group position="apart">
        <Title order={2}>Service Status</Title>
        <Button 
          leftSection={<IconRefresh size={16} />}
          onClick={checkAllServices}
        >
          Refresh Status
        </Button>
      </Group>

      <Paper p="md" withBorder>
        <Group position="apart" mb="xs">
          <Group>
            <IconCloud size={24} />
            <Title order={3}>Frame.io</Title>
          </Group>
          <Badge 
            color={getBadgeColor(frameIoStatus.status)}
            variant="filled"
            size="lg"
          >
            {frameIoStatus.status.toUpperCase()}
          </Badge>
        </Group>
        <Text>{frameIoStatus.message}</Text>

        {frameIoStatus.config && (
          <Code block mt="sm">
            {JSON.stringify(frameIoStatus.config, null, 2)}
          </Code>
        )}

        {frameIoStatus.status === 'error' && (
          <Alert icon={<IconAlertCircle size={16} />} title="Frame.io Integration Error" color="red" mt="sm">
            Check that your FRAMEIO_TOKEN is set correctly in .env.local
          </Alert>
        )}
      </Paper>

      <Paper p="md" withBorder>
        <Group position="apart" mb="xs">
          <Group>
            <IconServer size={24} />
            <Title order={3}>Cloudflare R2</Title>
          </Group>
          <Badge 
            color={getBadgeColor(r2Status.status)}
            variant="filled"
            size="lg"
          >
            {r2Status.status.toUpperCase()}
          </Badge>
        </Group>
        <Text>{r2Status.message}</Text>

        {r2Status.config && (
          <Code block mt="sm">
            {JSON.stringify(r2Status.config, null, 2)}
          </Code>
        )}

        {r2Status.status === 'error' && (
          <Alert icon={<IconAlertCircle size={16} />} title="R2 Integration Error" color="red" mt="sm">
            Check that your R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are set correctly in .env.local
          </Alert>
        )}
      </Paper>
    </Stack>
  );
} 