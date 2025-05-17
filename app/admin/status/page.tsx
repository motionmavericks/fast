// app/admin/status/page.tsx - Admin page to display service status

import { Container, Title, Divider } from '@mantine/core';
import ServiceStatus from '@/components/admin/status/ServiceStatus';

export default function StatusPage() {
  return (
    <Container size="xl" py="xl">
      <Title mb="md">Service Status Dashboard</Title>
      <Divider mb="lg" />
      <ServiceStatus />
    </Container>
  );
} 