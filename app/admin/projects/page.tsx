'use client';

import { useState } from 'react';
import { Container, Title, Text, Tabs, Group, Box, Divider } from '@mantine/core';
import { 
  IconBuilding, 
  IconUsers, 
  IconFolders, 
  IconFileAnalytics 
} from '@tabler/icons-react';
import AgenciesManager from '@/components/admin/projects/AgenciesManager';
import ClientsManager from '@/components/admin/projects/ClientsManager';
import ProjectsManager from '@/components/admin/projects/ProjectsManager';

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<string | null>('projects');

  return (
    <Container fluid>
      <Title order={2} mb="md">Project Management</Title>
      <Text c="dimmed" mb="lg">
        Manage agencies, clients, and projects with our industry-standard folder structure and MM project ID system.
      </Text>
      
      <Tabs value={activeTab} onChange={setActiveTab} mb="xl">
        <Tabs.List>
          <Tabs.Tab 
            value="projects" 
            leftSection={<IconFolders size={16} />}
          >
            Projects
          </Tabs.Tab>
          <Tabs.Tab 
            value="clients" 
            leftSection={<IconUsers size={16} />}
          >
            Clients
          </Tabs.Tab>
          <Tabs.Tab 
            value="agencies" 
            leftSection={<IconBuilding size={16} />}
          >
            Agencies
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="projects" pt="md">
          <ProjectsManager />
        </Tabs.Panel>
        
        <Tabs.Panel value="clients" pt="md">
          <ClientsManager />
        </Tabs.Panel>
        
        <Tabs.Panel value="agencies" pt="md">
          <AgenciesManager />
        </Tabs.Panel>
      </Tabs>
      
      <Box mt="xl">
        <Divider my="md" label="Project Management Guide" labelPosition="center" />
        <Group grow align="flex-start">
          <div>
            <Title order={5} mb="xs">Project Structure</Title>
            <Text size="sm">
              Each project in Motion Mavericks Fast is assigned a unique MM-prefixed project ID that follows the format 
              MM-AGENCY-CLIENT-### (e.g., MM-MM-ABC-001). This ID is used across all storage systems to maintain 
              consistency and enable easy tracking.
            </Text>
          </div>
          
          <div>
            <Title order={5} mb="xs">Industry Standard Folders</Title>
            <Text size="sm">
              Projects are automatically created with an industry-standard folder structure across all storage tiers. 
              This includes dedicated folders for Production, Post-Production, Deliverables, Assets, and Admin, each 
              with appropriate subfolders for specific workflows.
            </Text>
          </div>
          
          <div>
            <Title order={5} mb="xs">Multi-tier Storage</Title>
            <Text size="sm">
              Files are tracked across all storage systems (Frame.io, Cloudflare R2, and LucidLink) to ensure 
              consistency and availability. The system automatically handles file synchronization between tiers 
              based on project settings and file requirements.
            </Text>
          </div>
        </Group>
      </Box>
    </Container>
  );
}
