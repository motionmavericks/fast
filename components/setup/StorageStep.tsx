'use client';

import { useState } from 'react';
import { TextInput, Button, Group, Title, Stack, Text, PasswordInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

interface StorageStepProps {
  onStepComplete: (data: any) => void;
  prevStep: () => void;
  // formData: any;
}

export default function StorageStep({ onStepComplete, prevStep }: StorageStepProps) {
  const [accessKeyId, setAccessKeyId] = useState(process.env.NEXT_PUBLIC_WASABI_ACCESS_KEY_ID || '');
  const [secretAccessKey, setSecretAccessKey] = useState(''); // Never prefill secret from client-side env
  const [bucketName, setBucketName] = useState(process.env.NEXT_PUBLIC_WASABI_BUCKET_NAME || '');
  const [region, setRegion] = useState(process.env.NEXT_PUBLIC_WASABI_REGION || 'us-east-1'); // Default or common region
  const [endpoint, setEndpoint] = useState(process.env.NEXT_PUBLIC_WASABI_ENDPOINT || 's3.wasabisys.com');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!accessKeyId || !secretAccessKey || !bucketName || !region || !endpoint) {
        notifications.show({
            title: 'Validation Error',
            message: 'All Wasabi storage fields are required.',
            color: 'red',
            icon: <IconX />,
        });
        return;
    }
    setLoading(true);
    try {
      // TODO: Add API call to test and save Wasabi connection
      // const response = await fetch('/api/setup/storage', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ accessKeyId, secretAccessKey, bucketName, region, endpoint }),
      // });
      // const result = await response.json();
      // if (!response.ok) throw new Error(result.message || 'Failed to save storage config');

      console.log('TODO: Save Storage Config:', { accessKeyId, bucketName, region, endpoint }); // Exclude secretAccessKey from client-side logs
      notifications.show({
        title: 'Storage Configuration Saved (Simulated)',
        message: 'Wasabi connection details have been noted.',
        color: 'green',
        icon: <IconCheck />,
      });
      onStepComplete({ accessKeyId, bucketName, region, endpoint }); // Exclude secret from data passed around client if possible
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Could not save storage configuration.',
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack>
      <Title order={3}>Storage Configuration (Wasabi)</Title>
      <Text size="sm" c="dimmed">
        Enter your Wasabi account details. These will be stored in your server environment.
      </Text>
      <TextInput
        required
        label="Wasabi Access Key ID"
        placeholder="Your Wasabi Access Key ID"
        value={accessKeyId}
        onChange={(event) => setAccessKeyId(event.currentTarget.value)}
      />
      <PasswordInput
        required
        label="Wasabi Secret Access Key"
        placeholder="Your Wasabi Secret Access Key"
        value={secretAccessKey}
        onChange={(event) => setSecretAccessKey(event.currentTarget.value)}
      />
      <TextInput
        required
        label="Wasabi Bucket Name"
        placeholder="your-bucket-name"
        value={bucketName}
        onChange={(event) => setBucketName(event.currentTarget.value)}
      />
      <TextInput
        required
        label="Wasabi Region"
        placeholder="e.g., us-east-1, eu-central-1"
        value={region}
        onChange={(event) => setRegion(event.currentTarget.value)}
      />
      <TextInput
        required
        label="Wasabi Service Endpoint"
        placeholder="e.g., s3.wasabisys.com or s3.us-east-2.wasabisys.com"
        value={endpoint}
        onChange={(event) => setEndpoint(event.currentTarget.value)}
      />
      <Group justify="flex-end" mt="xl">
        <Button variant="default" onClick={prevStep} disabled={loading}>
          Back
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          Save & Continue
        </Button>
      </Group>
    </Stack>
  );
}
