'use client';

import { Button, Group, Title, Stack, Text, Paper, List, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCircleCheck, IconX, IconAlertTriangle } from '@tabler/icons-react';
import { useRouter } from 'next/navigation'; // Using App Router
import { useState } from 'react';

interface FinalStepProps {
  formData: {
    adminUser: { email?: string };
    database: { mongoUri?: string; dbName?: string };
    storage: { accessKeyId?: string; bucketName?: string; region?: string; endpoint?: string };
    email: { senderEmail?: string; apiKey?: string; emailHost?: string }; // Show limited info
  };
  prevStep: () => void;
}

export default function FinalStep({ formData, prevStep }: FinalStepProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCompleteSetup = async () => {
    setLoading(true);
    try {
      // In a real app, this step might not call another API endpoint.
      // The previous steps would have already saved their respective configurations.
      // This step could simply mark the overall setup as complete if needed,
      // or perform a final health check.

      // Example: Mark setup as complete by setting a flag or a final config value
      // This could be an API call if you have a specific endpoint for it.
      // For instance, call /api/setup/status again with a POST to finalize, or a new endpoint.
      
      // For now, we assume previous steps were successful upon reaching here.
      // The actual saving to .env.local or config files should happen in each step's API route.

      notifications.show({
        title: 'Setup Complete!',
        message: 'Motion Mavericks Fast has been configured. Redirecting to login...',
        color: 'green',
        icon: <IconCircleCheck />,
        autoClose: 5000,
      });

      // TODO: Ensure that the /api/setup/status reflects the completion
      // This might involve a final API call to mark setup complete if not handled by individual steps.

      setTimeout(() => {
        router.push('/admin/login'); // Redirect to admin login page
      }, 3000);

    } catch (error: any) {
      notifications.show({
        title: 'Finalization Error',
        message: error.message || 'Could not complete the setup process.',
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      // setLoading(false); // Keep loading as we are redirecting
    }
  };

  return (
    <Stack>
      <Title order={3}>Review & Finish Setup</Title>
      <Text size="sm" c="dimmed">
        Please review the configuration summary below. Sensitive information like passwords and secret keys are not displayed.
      </Text>

      <Paper p="md" withBorder mt="md">
        <List spacing="xs" size="sm" center 
          icon={<ThemeIcon color="teal" size={20} radius="xl"><IconCircleCheck size="0.8rem" /></ThemeIcon>}
        >
          <List.Item>
            <Text fw={500}>Admin User:</Text> 
            Email: {formData.adminUser?.email || 'Not set'}
          </List.Item>
          <List.Item>
            <Text fw={500}>Database (MongoDB):</Text> 
            URI: {formData.database?.mongoUri ? 'Set' : 'Not set'} | Name: {formData.database?.dbName || 'Not set'}
          </List.Item>
          <List.Item>
            <Text fw={500}>Storage (Wasabi):</Text> 
            Access Key ID: {formData.storage?.accessKeyId ? 'Set' : 'Not set'} | Bucket: {formData.storage?.bucketName || 'Not set'}
          </List.Item>
          <List.Item>
            <Text fw={500}>Email Service:</Text> 
            Sender: {formData.email?.senderEmail || 'Not set'} | API Key/Host: {formData.email?.apiKey || formData.email?.emailHost ? 'Set' : 'Not set'}
          </List.Item>
        </List>
      </Paper>
      
      <Alert icon={<IconAlertTriangle size="1rem" />} title="Important Note" color="orange" mt="lg">
        Ensure all sensitive credentials (database passwords, API keys, secret keys) are correctly entered and will be stored securely as environment variables on your server. This setup process aims to guide you in configuring them.
      </Alert>

      <Group justify="flex-end" mt="xl">
        <Button variant="default" onClick={prevStep} disabled={loading}>
          Back
        </Button>
        <Button onClick={handleCompleteSetup} color="green" loading={loading}>
          Complete Setup & Go to Login
        </Button>
      </Group>
    </Stack>
  );
}
