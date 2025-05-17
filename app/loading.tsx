import { 
  Container, 
  Text, 
  Center, 
  Stack, 
  Loader,
  Title,
  Group,
  Paper
} from '@mantine/core';

export default function Loading() {
  return (
    <Container size="md" py="xl">
      <Center style={{ minHeight: '60vh' }}>
        <Paper p="xl" shadow="md" withBorder>
          <Stack align="center" gap="md">
            <Group align="center" gap="md">
              <Loader size="lg" />
              <Title order={3}>Motion Mavericks Fast</Title>
            </Group>
            <Text size="lg">Loading application...</Text>
            <Text c="dimmed" size="sm">
              Initializing components and connecting to services
            </Text>
          </Stack>
        </Paper>
      </Center>
    </Container>
  );
}