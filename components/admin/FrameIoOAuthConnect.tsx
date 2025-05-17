'use client';

import { useState, useEffect } from 'react';
import { Button, Text, Alert, Stack, LoadingOverlay, Group, Badge, Paper, Code, Box } from '@mantine/core';
import { IconBrandAdobe, IconCheck, IconRotate, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';

export function FrameIoOAuthConnect() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<any>(null);

  // Check if we're already connected to Frame.io
  useEffect(() => {
    async function checkConnectionStatus() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/status/frameio');
        const data = await response.json();
        
        setStatusData(data);
        setIsConnected(data.status === 'connected');
        
        if (data.status === 'error') {
          setErrorMessage(data.message);
        } else {
          setErrorMessage(null);
        }
      } catch (error) {
        console.error('Error checking Frame.io connection:', error);
        setErrorMessage('Failed to check Frame.io connection status');
      } finally {
        setIsLoading(false);
      }
    }
    
    checkConnectionStatus();
  }, []);

  // Handle the login with Frame.io button click
  const handleConnectClick = () => {
    window.location.href = '/api/auth/frameio/login';
  };

  // Handle refreshing token
  const handleRefreshToken = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/frameio/refresh');
      
      if (response.ok) {
        notifications.show({
          title: 'Token Refreshed',
          message: 'Frame.io access token has been refreshed successfully',
          color: 'green',
          icon: <IconCheck size={18} />,
        });
        
        // Refresh status after token refresh
        window.location.reload();
      } else {
        const error = await response.json();
        setErrorMessage(error.error || 'Failed to refresh token');
        notifications.show({
          title: 'Error',
          message: 'Failed to refresh Frame.io token',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      setErrorMessage('Network error while refreshing token');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      
      <Group position="apart">
        <Text size="xl" weight={700}>Frame.io V4 API Connection</Text>
        {isConnected && (
          <Badge color="green" size="lg">Connected</Badge>
        )}
      </Group>
      
      {errorMessage && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="Connection Error" 
          color="red" 
          variant="outline"
        >
          {errorMessage}
        </Alert>
      )}
      
      <Text>
        Connect to Frame.io using OAuth to enable video upload and processing features.
        You will be redirected to Adobe Developer Console to authorize this application.
      </Text>
      
      {statusData && statusData.config && (
        <Paper withBorder p="sm">
          <Stack spacing="xs">
            <Text size="sm" weight={500}>Configuration Status:</Text>
            <Group>
              <Badge color={statusData.config.hasClientId ? 'green' : 'red'}>
                Client ID: {statusData.config.hasClientId ? 'Set' : 'Missing'}
              </Badge>
              <Badge color={statusData.config.hasClientSecret ? 'green' : 'red'}>
                Client Secret: {statusData.config.hasClientSecret ? 'Set' : 'Missing'}
              </Badge>
            </Group>
            <Text size="xs" color="dimmed">Redirect URI: <Code>{statusData.config.redirectUri || 'Not configured'}</Code></Text>
          </Stack>
        </Paper>
      )}
      
      {isConnected && statusData?.userData && (
        <Alert 
          icon={<IconInfoCircle size={16} />} 
          title="Account Connected" 
          color="blue" 
          variant="outline"
        >
          <Stack spacing={5}>
            <Text size="sm">Connected to Adobe Account ID: <Code>{statusData.userData.account_id}</Code></Text>
            <Text size="sm">Adobe User ID: <Code>{statusData.userData.adobe_user_id}</Code></Text>
            <Text size="sm">User ID: <Code>{statusData.userData.id}</Code></Text>
          </Stack>
        </Alert>
      )}
      
      {!isConnected ? (
        <Button 
          leftIcon={<IconBrandAdobe size={20} />}
          size="lg" 
          onClick={handleConnectClick}
          disabled={isLoading || !statusData?.config?.hasClientId || !statusData?.config?.hasClientSecret}
        >
          Connect to Frame.io
        </Button>
      ) : (
        <Group>
          <Button 
            leftIcon={<IconRotate size={20} />}
            variant="outline"
            onClick={handleRefreshToken}
            disabled={isLoading}
          >
            Refresh Token
          </Button>
          
          <Button 
            component={Link}
            href="/api/auth/frameio/login"
            leftIcon={<IconBrandAdobe size={20} />}
            variant="outline"
          >
            Reconnect
          </Button>
        </Group>
      )}
      
      <Box mt="md">
        <Alert 
          icon={<IconInfoCircle size={16} />} 
          title="Configuration Notes" 
          color="gray" 
          variant="outline"
        >
          <Text size="sm">
            1. Create a Frame.io project in the Adobe Developer Console<br />
            2. Configure OAuth credentials and add this redirect URI: <Code>{statusData?.config?.redirectUri || '[APP_URL]/api/auth/frameio/callback'}</Code><br />
            3. Add the Client ID and Client Secret to your .env.local file<br />
            4. Set NEXT_PUBLIC_APP_URL to your application's URL
          </Text>
        </Alert>
      </Box>
    </Stack>
  );
} 