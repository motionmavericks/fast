'use client';

import { useState } from 'react';
import { TextInput, PasswordInput, Button, Group, Title, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

interface AdminUserStepProps {
  onStepComplete: (data: any) => void;
  // formData: any; // if you need to read from previous steps
}

export default function AdminUserStep({ onStepComplete }: AdminUserStepProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password !== confirmPassword) {
      notifications.show({
        title: 'Password Mismatch',
        message: 'Passwords do not match.',
        color: 'red',
        icon: <IconX />,
      });
      return;
    }
    if (!email || password.length < 8) {
        notifications.show({
            title: 'Validation Error',
            message: 'Email is required and password must be at least 8 characters long.',
            color: 'red',
            icon: <IconX />,
        });
        return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/setup/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create admin user');
      }

      notifications.show({
        title: 'Admin User Created',
        message: 'Initial admin user has been set up successfully!',
        color: 'green',
        icon: <IconCheck />,
      });
      onStepComplete({ email }); // Pass any relevant data to the main form
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Could not create admin user.',
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack>
      <Title order={3}>Create Initial Admin User</Title>
      <TextInput
        required
        label="Admin Email"
        placeholder="admin@example.com"
        value={email}
        onChange={(event) => setEmail(event.currentTarget.value)}
        type="email"
      />
      <PasswordInput
        required
        label="Password (min. 8 characters)"
        placeholder="Enter your password"
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
      />
      <PasswordInput
        required
        label="Confirm Password"
        placeholder="Confirm your password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.currentTarget.value)}
      />
      <Group justify="flex-end" mt="xl">
        {/* No prevStep button for the first step */}
        <Button onClick={handleSubmit} loading={loading}>
          Save & Continue
        </Button>
      </Group>
    </Stack>
  );
}
