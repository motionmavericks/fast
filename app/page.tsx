'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Title, Text, Button, Center, Loader, Stack, Group } from '@mantine/core';
import Image from 'next/image';

async function initializeServices() {
  try {
    const response = await fetch('/api/init');
    const data = await response.json();
    console.log('Services initialization:', data);
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }
}

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [setupComplete, setSetupComplete] = useState(true);

  const [statusDetails, setStatusDetails] = useState({
    dbConfigured: false,
    dbConnected: false,
    hasAdmin: false,
    error: ''
  });

  useEffect(() => {
    const checkSetup = async () => {
      try {
        setChecking(true);
        const response = await fetch('/api/setup/status');
        const data = await response.json();
        
        setStatusDetails({
          dbConfigured: data.dbConfigured || false,
          dbConnected: data.dbConnected || false,
          hasAdmin: data.hasAdmin || false,
          error: data.error || ''
        });
        
        if (!data.isSetupComplete) {
          // Setup is not complete, redirect to setup page
          setSetupComplete(false);
          setTimeout(() => {
            router.push('/setup');
          }, 2000); // Short delay to show the message
        } else {
          setSetupComplete(true);
        }
      } catch (error) {
        console.error('Error checking setup status:', error);
        // If there's an error, assume setup is not complete
        setSetupComplete(false);
        setStatusDetails(prev => ({
          ...prev,
          error: 'Failed to connect to server'
        }));
        setTimeout(() => {
          router.push('/setup');
        }, 2000);
      } finally {
        setChecking(false);
      }
    };

    checkSetup();
  }, [router]);

  if (checking) {
    return (
      <Center style={{ height: '100vh' }}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Checking application setup...</Text>
        </Stack>
      </Center>
    );
  }

  if (!setupComplete) {
    return (
      <Center style={{ height: '100vh' }}>
        <Stack align="center" gap="md">
          <Title order={2}>Motion Mavericks Fast</Title>
          <Text>Initial setup required. Redirecting to setup page...</Text>
          
          {statusDetails.error && (
            <Alert color="orange" title="Setup Information">
              {statusDetails.dbConfigured ? 'Database is configured but' : 'Database is not configured.'} 
              {statusDetails.error && ` Error: ${statusDetails.error}`}
            </Alert>
          )}
          
          <Button onClick={() => router.push('/setup')}>Go to Setup</Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Title order={1} ta="center">Motion Mavericks Fast</Title>
        <Text ta="center" size="lg">
          A secure, fast, and user-friendly web application for clients to upload large video and post-production files.
        </Text>
        
        <Group grow gap="md" mt="xl">
          <Button 
            size="lg" 
            onClick={() => router.push('/admin/login')}
          >
            Admin Login
          </Button>
          
          <Button 
            size="lg"
            variant="outline"
            onClick={() => router.push('/admin/dashboard')}
          >
            Go to Dashboard
          </Button>
        </Group>
        
        <Center mt="xl">
          <Image
            src="/logo.png"
            alt="Motion Mavericks Fast Logo"
            width={200}
            height={100}
            priority
            style={{ opacity: 0.8 }}
            onError={(e) => {
              // Fallback if logo is not available
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </Center>
      </Stack>
    </Container>
  );
}