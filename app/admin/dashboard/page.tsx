'use client';

import { useEffect, useState } from 'react';
import { Container, Title, Text, Paper, SimpleGrid, Group, Button, Divider } from '@mantine/core';
import { IconLink, IconFileUpload, IconSettings, IconLogout, IconChartBar } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import DashboardStats from '@/components/admin/DashboardStats';

// This would ideally be a more robust check, perhaps decoding the token
// or having a dedicated /api/auth/me endpoint to verify and get user info
const getAdminUser = () => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin-token');
    // Basic check, for actual user data, decode token or call an API
    if (token) return { email: 'admin@example.com' }; // Placeholder
  }
  return null;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    const user = getAdminUser();
    if (user) {
      setAdminUser(user);
    } else {
      // This check might be redundant if route protection is solid
      // but good for direct navigation attempts without a token.
      router.push('/admin/login'); 
    }
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin-token');
    }
    notifications.show({
      title: 'Logged Out',
      message: 'You have been successfully logged out.',
      color: 'blue'
    });
    router.push('/admin/login');
  };

  if (!adminUser) {
    // This will briefly show if the redirect in useEffect is not immediate
    // or if route protection hasn't kicked in yet.
    // A proper route protection HOC/layout would prevent rendering this altogether.
    return <Text>Loading or redirecting...</Text>; 
  }

  return (
    <Container fluid py="lg">
      <Group justify="space-between" mb="xl">
        <Title order={2}>Admin Dashboard</Title>
        <Button onClick={handleLogout} leftSection={<IconLogout size={16} />} variant="outline" color="red">
          Logout
        </Button>
      </Group>
      <Text mb="lg">Welcome, {adminUser.email}! Manage your application from here.</Text>
      
      {/* Dashboard Statistics */}
      <Paper withBorder p="xl" shadow="sm" radius="md" mb="xl">
        <Group mb="md">
          <IconChartBar size={24} />
          <Title order={3}>Upload Statistics</Title>
        </Group>
        <DashboardStats />
      </Paper>

      <Divider my="xl" label="Quick Access" labelPosition="center" />
      
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
        <Paper
          component={Link}
          href="/admin/links"
          withBorder
          p="lg"
          radius="md"
          style={{ textDecoration: 'none' }}
        >
          <IconLink size={48} stroke={1.5} />
          <Title order={3} mt="md">Manage Upload Links</Title>
          <Text c="dimmed" size="sm">Create and manage unique links for client uploads.</Text>
        </Paper>

        <Paper
          component={Link}
          href="/admin/files"
          withBorder
          p="lg"
          radius="md"
          style={{ textDecoration: 'none' }}
        >
          <IconFileUpload size={48} stroke={1.5} />
          <Title order={3} mt="md">View Uploaded Files</Title>
          <Text c="dimmed" size="sm">Monitor files uploaded by clients.</Text>
        </Paper>

        <Paper
          component={Link}
          href="/admin/settings"
          withBorder
          p="lg"
          radius="md"
          style={{ textDecoration: 'none' }}
        >
          <IconSettings size={48} stroke={1.5} />
          <Title order={3} mt="md">Application Settings</Title>
          <Text c="dimmed" size="sm">Configure storage, email, and other settings.</Text>
        </Paper>
      </SimpleGrid>
    </Container>
  );
}
