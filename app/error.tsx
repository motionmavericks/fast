'use client';

import { useEffect } from 'react';
import { 
  Container, 
  Title, 
  Text, 
  Button, 
  Group, 
  Stack, 
  Alert, 
  List, 
  Paper,
  Code
} from '@mantine/core';
import { useRouter } from 'next/navigation';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to console for debugging
    console.error('Application error:', error);
  }, [error]);

  return (
    <Container size="md" py="xl">
      <Paper p="xl" withBorder shadow="md">
        <Stack gap="md">
          <Title order={2}>Application Error</Title>
          
          <Alert color="red" title="An error occurred!" withCloseButton={false}>
            {error.message || 'An unexpected error occurred in the application.'}
          </Alert>
          
          <Text>This could be due to one of the following reasons:</Text>
          
          <List type="ordered">
            <List.Item>The application has not been set up yet</List.Item>
            <List.Item>Database connection failed</List.Item>
            <List.Item>Required dependencies are missing</List.Item>
            <List.Item>Environment variables are not properly configured</List.Item>
          </List>
          
          <Title order={3} size="h4" mt="md">Recommended Actions:</Title>
          
          <List>
            <List.Item>Check your <Code>.env.local</Code> file contains required variables</List.Item>
            <List.Item>Ensure MongoDB is accessible with proper credentials</List.Item>
            <List.Item>Run <Code>npm install</Code> to ensure all dependencies are installed</List.Item>
            <List.Item>Try initializing with <Code>npm run init-admin</Code></List.Item>
          </List>
          
          <Group justify="center" mt="lg">
            <Button onClick={() => reset()}>Try Again</Button>
            <Button variant="outline" onClick={() => router.push('/setup')}>
              Go to Setup
            </Button>
          </Group>
          
          {error.digest && (
            <Text c="dimmed" size="sm" ta="center" mt="sm">
              Error Digest: {error.digest}
            </Text>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}