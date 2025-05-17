'use client';

import { useState } from 'react';
import { TextInput, Button, Group, Title, Stack, Text, PasswordInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

interface EmailStepProps {
  onStepComplete: (data: any) => void;
  prevStep: () => void;
  // formData: any;
}

export default function EmailStep({ onStepComplete, prevStep }: EmailStepProps) {
  const [apiKey, setApiKey] = useState(''); // e.g., SendGrid API Key
  const [senderEmail, setSenderEmail] = useState(process.env.NEXT_PUBLIC_SENDER_EMAIL || '');
  const [emailHost, setEmailHost] = useState(process.env.NEXT_PUBLIC_EMAIL_HOST || '');
  const [emailPort, setEmailPort] = useState(process.env.NEXT_PUBLIC_EMAIL_PORT || '587');
  const [emailUser, setEmailUser] = useState(process.env.NEXT_PUBLIC_EMAIL_USER || '');
  const [emailPass, setEmailPass] = useState(''); // Never prefill password
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!senderEmail) { // Basic validation, can be expanded
        notifications.show({
            title: 'Validation Error',
            message: 'Sender Email is required.',
            color: 'red',
            icon: <IconX />,
        });
        return;
    }
    // Add more validation for API key, host, port, user, pass if a specific provider is chosen

    setLoading(true);
    try {
      // TODO: Add API call to test and save Email service connection
      // const response = await fetch('/api/setup/email', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ apiKey, senderEmail, emailHost, emailPort, emailUser, emailPass }), // Send all relevant fields
      // });
      // const result = await response.json();
      // if (!response.ok) throw new Error(result.message || 'Failed to save email config');

      console.log('TODO: Save Email Config:', { apiKeyPresent: !!apiKey, senderEmail, emailHost, emailPort, emailUserPresent: !!emailUser }); // Exclude secrets
      notifications.show({
        title: 'Email Configuration Saved (Simulated)',
        message: 'Email service details have been noted.',
        color: 'green',
        icon: <IconCheck />,
      });
      onStepComplete({ apiKey, senderEmail, emailHost, emailPort, emailUser, emailPass });
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Could not save email configuration.',
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack>
      <Title order={3}>Email Service Configuration (e.g., SendGrid)</Title>
      <Text size="sm" c="dimmed">
        Configure your email service for sending notifications. These will be stored in your server environment.
      </Text>
      <TextInput
        label="Sender Email Address (Notifications From)"
        placeholder="noreply@yourdomain.com"
        value={senderEmail}
        onChange={(event) => setSenderEmail(event.currentTarget.value)}
        required
      />
      <PasswordInput
        label="Email Service API Key (e.g., SendGrid)"
        placeholder="Your email service API key"
        value={apiKey}
        onChange={(event) => setApiKey(event.currentTarget.value)}
      />
      <Text size="xs" c="dimmed" mt="sm">
        Alternatively, if using SMTP directly:
      </Text>
      <TextInput
        label="SMTP Host"
        placeholder="smtp.example.com"
        value={emailHost}
        onChange={(event) => setEmailHost(event.currentTarget.value)}
      />
      <TextInput
        label="SMTP Port"
        placeholder="587"
        value={emailPort}
        onChange={(event) => setEmailPort(event.currentTarget.value)}
      />
      <TextInput
        label="SMTP Username"
        placeholder="your_smtp_username"
        value={emailUser}
        onChange={(event) => setEmailUser(event.currentTarget.value)}
      />
      <PasswordInput
        label="SMTP Password"
        placeholder="your_smtp_password"
        value={emailPass}
        onChange={(event) => setEmailPass(event.currentTarget.value)}
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
