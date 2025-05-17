'use client';

import { useState } from 'react';
import { TextInput, Button, Group, Title, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

interface DatabaseStepProps {
  onStepComplete: (data: any) => void;
  prevStep: () => void;
  // formData: any; // if you need to read from previous steps or prefill
}

export default function DatabaseStep({ onStepComplete, prevStep }: DatabaseStepProps) {
  const [mongoUri, setMongoUri] = useState(''); // No default - user must provide this
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'success' | 'error'>('none');
  const [errorMessage, setErrorMessage] = useState('');

  // Test the connection before saving
  const testConnection = async () => {
    if (!mongoUri) {
      notifications.show({
        title: 'Validation Error',
        message: 'MongoDB connection URI is required.',
        color: 'red',
        icon: <IconX />,
      });
      return false;
    }

    setTesting(true);
    setConnectionStatus('none');
    setErrorMessage('');
    
    try {
      const response = await fetch('/api/setup/db/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mongoUri }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        setConnectionStatus('error');
        setErrorMessage(result.message || 'Failed to connect to database');
        notifications.show({
          title: 'Connection Failed',
          message: result.message || 'Failed to connect to database',
          color: 'red',
          icon: <IconX />,
        });
        return false;
      }
      
      setConnectionStatus('success');
      notifications.show({
        title: 'Connection Successful',
        message: 'Successfully connected to the MongoDB database.',
        color: 'green',
        icon: <IconCheck />,
      });
      return true;
    } catch (error: any) {
      setConnectionStatus('error');
      setErrorMessage(error.message || 'Could not test database connection');
      notifications.show({
        title: 'Error',
        message: error.message || 'Could not test database connection',
        color: 'red',
        icon: <IconX />,
      });
      return false;
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!mongoUri) {
      notifications.show({
        title: 'Validation Error',
        message: 'MongoDB connection URI is required.',
        color: 'red',
        icon: <IconX />,
      });
      return;
    }
    
    // Test connection first
    if (connectionStatus !== 'success') {
      const isConnected = await testConnection();
      if (!isConnected) return;
    }
    
    setLoading(true);
    try {
      // Save the configuration
      const response = await fetch('/api/setup/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mongoUri }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to save DB config');
      }

      notifications.show({
        title: 'Database Configuration Saved',
        message: 'MongoDB connection details have been saved.',
        color: 'green',
        icon: <IconCheck />,
      });
      
      onStepComplete({ mongoUri });
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Could not save database configuration.',
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack>
      <Title order={3}>Database Configuration (MongoDB)</Title>
      <Text size="sm" c="dimmed">
        Enter the connection string for your MongoDB database. This will be stored in your server environment.
      </Text>
      <TextInput
        required
        label="MongoDB Connection URI"
        placeholder="mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority"
        description="Enter the connection string for your MongoDB Atlas cluster or any MongoDB server"
        value={mongoUri}
        onChange={(event) => {
          setMongoUri(event.currentTarget.value);
          setConnectionStatus('none');
        }}
      />
      
      {connectionStatus === 'success' && (
        <Text color="green" size="sm">
          ✓ Connection successful! Database is accessible.
        </Text>
      )}
      
      {connectionStatus === 'error' && (
        <Text color="red" size="sm">
          ✗ Connection failed: {errorMessage}
        </Text>
      )}
      
      <Stack gap="xs">
        <Text size="sm" fw={500}>Connection examples:</Text>
        <Text size="xs" c="dimmed">
          • MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/dbname
        </Text>
        <Text size="xs" c="dimmed">
          • Local MongoDB: mongodb://localhost:27017/dbname
        </Text>
      </Stack>
      
      <Group mt="xl">
        <Button 
          variant="outline" 
          onClick={testConnection} 
          loading={testing}
          disabled={loading || !mongoUri}
        >
          Test Connection
        </Button>
        
        <Group style={{ marginLeft: 'auto' }}>
          <Button variant="default" onClick={prevStep} disabled={loading || testing}>
            Back
          </Button>
          <Button 
            onClick={handleSubmit} 
            loading={loading}
            disabled={testing}
            color={connectionStatus === 'success' ? 'green' : 'blue'}
          >
            Save & Continue
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
