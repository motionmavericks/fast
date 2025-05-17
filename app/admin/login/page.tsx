'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Paper,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Alert,
  LoadingOverlay,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconLogin } from '@tabler/icons-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError('Both email and password are required.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed. Please check your credentials.');
      }

      // Assuming the API returns a token or session cookie is set
      // For JWT, you might store the token in localStorage/sessionStorage or context
      // For this example, we'll just show a success notification and redirect.
      if (data.token) {
        // In a real app, store this token securely or rely on httpOnly cookies
        localStorage.setItem('admin-token', data.token); 
      }
      
      notifications.show({
        title: 'Login Successful',
        message: 'Redirecting to dashboard...',
        color: 'green',
      });

      router.push('/admin/dashboard'); // Redirect to admin dashboard

    } catch (err: any) {
      setError(err.message);
      notifications.show({
        title: 'Login Error',
        message: err.message,
        color: 'red',
        icon: <IconAlertCircle />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xs" py={100}>
      <Paper withBorder shadow="md" p={30} radius="md">
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2}} />
        <Title order={2} ta="center" mb="xl">
          Motion Mavericks Fast - Admin Login
        </Title>
        <form onSubmit={handleSubmit}>
          <Stack>
            {error && (
              <Alert title="Login Failed" color="red" icon={<IconAlertCircle />}>
                {error}
              </Alert>
            )}
            <TextInput
              required
              label="Email"
              placeholder="admin@example.com"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              type="email"
            />
            <PasswordInput
              required
              label="Password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            <Button type="submit" leftSection={<IconLogin size={16} />} fullWidth mt="xl">
              Login
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
