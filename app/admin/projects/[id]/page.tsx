'use client';

import { useState, useEffect } from 'react';
import { 
  Container, 
  Title, 
  Text, 
  Group, 
  Paper, 
  Grid, 
  Divider, 
  Badge, 
  Button, 
  Loader, 
  Card, 
  Table,
  Tabs,
  Alert,
  Box,
  ScrollArea,
  Code
} from '@mantine/core';
import { 
  IconArrowLeft, 
  IconRefresh, 
  IconCheck, 
  IconX, 
  IconAlertCircle,
  IconFolders,
  IconFile,
  IconSettings,
  IconInfoCircle,
  IconFolderPlus
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import ProjectFileManager from '@/components/admin/projects/ProjectFileManager';

interface FolderStructure {
  frameio: {
    folderId: string;
    path: string;
  };
  r2: {
    basePath: string;
  };
  lucidlink: {
    path: string;
  };
}

interface ProjectSettings {
  allowClientAccess: boolean;
  autoCreateProxies: boolean;
  defaultStorageTier: 'all' | 'frameio' | 'r2' | 'lucidlink';
  [key: string]: any;
}

interface IProject {
  _id: string;
  projectId: string;
  name: string;
  client: {
    _id: string;
    name: string;
    code: string;
    agency: {
      _id: string;
      name: string;
      code: string;
    };
  };
  description?: string;
  startDate?: string;
  endDate?: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
  folderStructure: FolderStructure;
  settings: ProjectSettings;
  notes?: string;
  isActive: boolean;
  createdBy: { _id: string; email: string };
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<IProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folderStructure, setFolderStructure] = useState<any | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('details');
  
  // Fetch project details
  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/projects/${params.id}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch project details');
        }
        
        const data = await response.json();
        setProject(data);
        
        // Fetch folder structure
        fetchFolderStructure(data.projectId);
      } catch (error: any) {
        console.error('Error fetching project:', error);
        setError(error.message);
        notifications.show({
          title: 'Error',
          message: error.message,
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchProject();
  }, [params.id]);
  
  // Fetch folder structure details
  const fetchFolderStructure = async (projectId: string) => {
    setFolderLoading(true);
    
    try {
      const response = await fetch(`/api/projects/${projectId}/folders`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch folder structure');
      }
      
      const data = await response.json();
      setFolderStructure(data);
    } catch (error: any) {
      console.error('Error fetching folder structure:', error);
      // Don't show notification for this error to avoid overwhelming the user
    } finally {
      setFolderLoading(false);
    }
  };
  
  // Regenerate folder structure
  const handleRegenerateFolders = async () => {
    if (!project) return;
    
    setFolderLoading(true);
    
    try {
      const response = await fetch(`/api/projects/${project.projectId}/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          services: ['frameio', 'r2', 'lucidlink'],
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to regenerate folder structure');
      }
      
      const data = await response.json();
      
      // Check for errors
      const errors = Object.entries(data.services)
        .filter(([_, info]: [string, any]) => !info.success)
        .map(([service, info]: [string, any]) => `${service}: ${info.error}`);
      
      if (errors.length > 0) {
        notifications.show({
          title: 'Partial Success',
          message: `Some services failed: ${errors.join(', ')}`,
          color: 'yellow',
        });
      } else {
        notifications.show({
          title: 'Success',
          message: 'Folder structure regenerated successfully',
          color: 'green',
        });
      }
      
      // Refetch project to get the updated folder structure
      const projectResponse = await fetch(`/api/projects/${project._id}`);
      const projectData = await projectResponse.json();
      setProject(projectData);
      
      // Fetch the updated folder structure
      fetchFolderStructure(projectData.projectId);
    } catch (error: any) {
      console.error('Error regenerating folders:', error);
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    } finally {
      setFolderLoading(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  // Get status badge color
  const getStatusColor = (status?: string) => {
    if (!status) return 'gray';
    
    switch (status) {
      case 'planning':
        return 'blue';
      case 'active':
        return 'green';
      case 'completed':
        return 'teal';
      case 'archived':
        return 'gray';
      default:
        return 'gray';
    }
  };
  
  if (loading) {
    return (
      <Container fluid>
        <Group position="center" py="xl">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }
  
  if (error || !project) {
    return (
      <Container fluid>
        <Paper p="md" withBorder>
          <Alert title="Error" color="red" icon={<IconAlertCircle />}>
            {error || 'Project not found'}
          </Alert>
          <Group position="center" mt="md">
            <Button leftSection={<IconArrowLeft size={16} />} onClick={() => router.back()}>
              Go Back
            </Button>
          </Group>
        </Paper>
      </Container>
    );
  }
  
  return (
    <Container fluid>
      <Paper p="md" withBorder mb="md">
        <Group position="apart">
          <Group>
            <Button 
              variant="subtle" 
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => router.push('/admin/projects')}
            >
              Back to Projects
            </Button>
            <Title order={3}>
              {project.name} <Text span c="dimmed">({project.projectId})</Text>
            </Title>
          </Group>
          <Badge size="lg" color={getStatusColor(project.status)}>
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </Badge>
        </Group>
      </Paper>
      
      <Tabs value={activeTab} onChange={setActiveTab} mb="md">
        <Tabs.List>
          <Tabs.Tab value="details" leftSection={<IconInfoCircle size={16} />}>
            Project Details
          </Tabs.Tab>
          <Tabs.Tab value="files" leftSection={<IconFile size={16} />}>
            Files
          </Tabs.Tab>
          <Tabs.Tab value="folders" leftSection={<IconFolders size={16} />}>
            Folder Structure
          </Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
            Settings
          </Tabs.Tab>
        </Tabs.List>
        
        <Tabs.Panel value="details" pt="md">
          <Grid>
            <Grid.Col span={12} md={6}>
              <Paper withBorder p="md">
                <Title order={4} mb="md">Project Information</Title>
                <Table>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td fw={700}>Project ID</Table.Td>
                      <Table.Td>{project.projectId}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={700}>Name</Table.Td>
                      <Table.Td>{project.name}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={700}>Client</Table.Td>
                      <Table.Td>{project.client.name} ({project.client.code})</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={700}>Agency</Table.Td>
                      <Table.Td>{project.client.agency.name} ({project.client.agency.code})</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={700}>Status</Table.Td>
                      <Table.Td>
                        <Badge color={getStatusColor(project.status)}>
                          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={700}>Start Date</Table.Td>
                      <Table.Td>{formatDate(project.startDate)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={700}>End Date</Table.Td>
                      <Table.Td>{formatDate(project.endDate)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={700}>Created By</Table.Td>
                      <Table.Td>{project.createdBy.email}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={700}>Created At</Table.Td>
                      <Table.Td>{formatDate(project.createdAt)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={700}>Last Activity</Table.Td>
                      <Table.Td>{formatDate(project.lastActivityAt)}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Paper>
            </Grid.Col>
            
            <Grid.Col span={12} md={6}>
              <Stack>
                <Paper withBorder p="md">
                  <Title order={4} mb="md">Description</Title>
                  <Text>{project.description || 'No description provided.'}</Text>
                </Paper>
                
                <Paper withBorder p="md">
                  <Title order={4} mb="md">Notes</Title>
                  <Text>{project.notes || 'No notes provided.'}</Text>
                </Paper>
                
                <Paper withBorder p="md">
                  <Title order={4} mb="md">Quick Storage Access</Title>
                  <Group grow>
                    <Button
                      variant="outline"
                      disabled={!project.folderStructure.frameio.folderId}
                      onClick={() => window.open(`https://app.frame.io/projects/${project.folderStructure.frameio.folderId}`, '_blank')}
                    >
                      Frame.io
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!project.folderStructure.lucidlink.path}
                      onClick={() => {/* This would need actual LucidLink integration */}}
                    >
                      LucidLink
                    </Button>
                  </Group>
                </Paper>
              </Stack>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>
        
        <Tabs.Panel value="files" pt="md">
          <ProjectFileManager project={project} />
        </Tabs.Panel>
        
        <Tabs.Panel value="folders" pt="md">
          <Paper withBorder p="md">
            <Group position="apart" mb="md">
              <Title order={4}>Folder Structure</Title>
              <Group>
                <Button
                  leftSection={<IconRefresh size={16} />}
                  variant="light"
                  onClick={() => fetchFolderStructure(project.projectId)}
                  loading={folderLoading}
                >
                  Refresh
                </Button>
                <Button
                  leftSection={<IconFolderPlus size={16} />}
                  onClick={handleRegenerateFolders}
                  loading={folderLoading}
                >
                  Regenerate Folders
                </Button>
              </Group>
            </Group>
            
            <Grid>
              <Grid.Col span={12} md={4}>
                <Card withBorder p="sm" radius="md">
                  <Title order={5} mb="xs">Frame.io</Title>
                  <Text fw={700} size="sm">Folder ID:</Text>
                  <Text mb="xs">{project.folderStructure.frameio.folderId || 'Not configured'}</Text>
                  <Text fw={700} size="sm">Path:</Text>
                  <Text>{project.folderStructure.frameio.path || 'Not configured'}</Text>
                </Card>
              </Grid.Col>
              
              <Grid.Col span={12} md={4}>
                <Card withBorder p="sm" radius="md">
                  <Title order={5} mb="xs">Cloudflare R2</Title>
                  <Text fw={700} size="sm">Base Path:</Text>
                  <Text>{project.folderStructure.r2.basePath || 'Not configured'}</Text>
                </Card>
              </Grid.Col>
              
              <Grid.Col span={12} md={4}>
                <Card withBorder p="sm" radius="md">
                  <Title order={5} mb="xs">LucidLink</Title>
                  <Text fw={700} size="sm">Path:</Text>
                  <Text>{project.folderStructure.lucidlink.path || 'Not configured'}</Text>
                </Card>
              </Grid.Col>
            </Grid>
            
            <Divider my="md" label="Standard Folder Structure" labelPosition="center" />
            
            <ScrollArea h={300}>
              <Code block>
{`Project: ${project.projectId}
├── Production/
│   ├── Camera/
│   ├── Sound/
│   ├── Lighting/
│   ├── Direction/
│   └── Script/
├── Post-Production/
│   ├── Editorial/
│   ├── VFX/
│   ├── Sound_Design/
│   ├── Music/
│   ├── Color/
│   └── Graphics/
├── Deliverables/
│   ├── Approvals/
│   ├── Final_Masters/
│   ├── Social_Media/
│   ├── Broadcast/
│   └── Web/
├── Assets/
│   ├── Footage/
│   ├── Audio/
│   ├── Graphics/
│   ├── Stock/
│   └── Photos/
└── Admin/
    ├── Contracts/
    ├── Briefs/
    ├── Meetings/
    └── Feedback/`}
              </Code>
            </ScrollArea>
          </Paper>
        </Tabs.Panel>
        
        <Tabs.Panel value="settings" pt="md">
          <Paper withBorder p="md">
            <Title order={4} mb="md">Project Settings</Title>
            <Table>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td fw={700}>Allow Client Access</Table.Td>
                  <Table.Td>
                    <Badge color={project.settings.allowClientAccess ? 'green' : 'red'}>
                      {project.settings.allowClientAccess ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {project.settings.allowClientAccess 
                      ? 'Client can access project files and videos' 
                      : 'Client cannot access project files'
                    }
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={700}>Auto-Create Proxies</Table.Td>
                  <Table.Td>
                    <Badge color={project.settings.autoCreateProxies ? 'green' : 'red'}>
                      {project.settings.autoCreateProxies ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {project.settings.autoCreateProxies 
                      ? 'Automatically create proxy files for uploaded media' 
                      : 'Do not automatically create proxy files'
                    }
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={700}>Default Storage Tier</Table.Td>
                  <Table.Td>
                    <Badge>
                      {project.settings.defaultStorageTier === 'all' 
                        ? 'All Tiers' 
                        : project.settings.defaultStorageTier.toUpperCase()
                      }
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {project.settings.defaultStorageTier === 'all' 
                      ? 'Store files across all available storage tiers' 
                      : `Store files primarily in ${project.settings.defaultStorageTier.toUpperCase()}`
                    }
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
