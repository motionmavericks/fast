import { FrameIoOAuthConnect } from '@/components/admin/FrameIoOAuthConnect';
import { Box, Container, Paper, Text, Title, Stack, Divider } from '@mantine/core';

export default function FrameIoSettingsPage() {
  return (
    <Container size="lg" py="xl">
      <Stack spacing="lg">
        <Title>Frame.io Integration Settings</Title>
        <Text color="dimmed" size="sm">
          Configure the integration with Frame.io V4 API using OAuth authentication.
        </Text>
        
        <Divider />
        
        <Paper shadow="sm" p="lg" withBorder>
          <FrameIoOAuthConnect />
        </Paper>
        
        <Paper shadow="sm" p="lg" withBorder>
          <Stack spacing="md">
            <Title order={3}>Configuration Guide</Title>
            
            <Box>
              <Title order={5}>1. Create an Adobe Developer Console Project</Title>
              <Text size="sm">
                Visit the <a href="https://developer.adobe.com/console/projects" target="_blank" rel="noopener noreferrer">Adobe Developer Console</a> and create a new project.
              </Text>
            </Box>
            
            <Box>
              <Title order={5}>2. Add Frame.io API to Your Project</Title>
              <Text size="sm">
                From your project, add the Frame.io API. You may need to request access through the Early Access Program.
              </Text>
            </Box>
            
            <Box>
              <Title order={5}>3. Configure OAuth</Title>
              <Text size="sm">
                Add a new OAuth Web credential with the following settings:
                <ul>
                  <li>Redirect URI: <code>{process.env.NEXT_PUBLIC_APP_URL}/api/auth/frameio/callback</code></li>
                  <li>Scopes: <code>openid</code> and <code>frameio_api</code></li>
                </ul>
              </Text>
            </Box>
            
            <Box>
              <Title order={5}>4. Update Environment Variables</Title>
              <Text size="sm">
                Add the following to your .env.local file:
                <ul>
                  <li>FRAMEIO_CLIENT_ID: from Adobe Developer Console</li>
                  <li>FRAMEIO_CLIENT_SECRET: from Adobe Developer Console</li>
                  <li>NEXT_PUBLIC_APP_URL: your application's URL</li>
                </ul>
              </Text>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
} 