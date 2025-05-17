'use client';

import { useState, useEffect } from 'react';
import { 
  Paper, 
  Title, 
  Text, 
  Group, 
  Button, 
  Table, 
  ActionIcon, 
  Tooltip, 
  TextInput,
  Modal,
  Stack,
  Badge,
  Loader,
  ScrollArea,
  Select,
  Tabs,
  SegmentedControl,
  Textarea,
  Card,
  Box,
  Code,
  Chip,
  useMantineTheme,
  Switch,
  Divider,
  Alert
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { 
  IconPlus, 
  IconEdit, 
  IconTrash, 
  IconSearch,
  IconRefresh,
  IconBuilding,
  IconFolder,
  IconFolderPlus,
  IconSettings,
  IconAlertCircle,
  IconCheck,
  IconChartBar,
  IconInfoCircle,
  IconFileUpload,
  IconExclamationMark
} from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';

interface IAgency {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface IClient {
  _id: string;
  name: string;
  code: string;
  agency: IAgency;
  isActive: boolean;
}

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
  client: IClient;
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

export default function ProjectsManager() {
  const theme = useMantineTheme();
  const [projects, setProjects] = useState<IProject[]>([]);
  const [clients, setClients] = useState<IClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  
  // Modal states
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [folderModalOpened, { open: openFolderModal, close: closeFolderModal }] = useDisclosure(false);
  
  // Current project for operations
  const [currentProject, setCurrentProject] = useState<IProject | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    description: '',
    startDate: new Date(),
    endDate: null as Date | null,
    status: 'planning' as 'planning' | 'active' | 'completed' | 'archived',
    notes: '',
    settings: {
      allowClientAccess: true,
      autoCreateProxies: true,
      defaultStorageTier: 'all' as 'all' | 'frameio' | 'r2' | 'lucidlink',
    },
  });
  
  // Form tab state
  const [activeTab, setActiveTab] = useState('details');
  
  // Folder regeneration options
  const [folderServices, setFolderServices] = useState({
    frameio: true,
    r2: true,
    lucidlink: true,
  });
  
  // Fetch projects and clients on mount
  useEffect(() => {
    fetchClients();
    fetchProjects();
  }, []);
  
  // Fetch clients from API
  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients?isActive=true');
      const data = await response.json();
      
      setClients(data);
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch clients',
        color: 'red',
      });
      console.error('Error fetching clients:', error);
    }
  };
  
  // Fetch projects from API
  const fetchProjects = async () => {
    setLoading(true);
    try {
      // Construct URL with optional filters
      let url = '/api/projects?';
      const queryParams = [];
      
      if (clientFilter) {
        queryParams.push(`client=${clientFilter}`);
      }
      
      if (statusFilter) {
        queryParams.push(`status=${statusFilter}`);
      }
      
      url += queryParams.join('&');
      
      const response = await fetch(url);
      const data = await response.json();
      
      setProjects(data);
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch projects',
        color: 'red',
      });
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Apply filters and refetch projects
  useEffect(() => {
    fetchProjects();
  }, [clientFilter, statusFilter]);
  
  // Handle create form submission
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    
    try {
      const payload = {
        ...formData,
        startDate: formData.startDate ? formData.startDate.toISOString() : undefined,
        endDate: formData.endDate ? formData.endDate.toISOString() : undefined,
      };
      
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create project');
      }
      
      // Check if there was a warning (folder creation issue)
      if (data.warning) {
        notifications.show({
          title: 'Project Created with Warning',
          message: data.warning,
          color: 'yellow',
        });
      } else {
        notifications.show({
          title: 'Success',
          message: 'Project created successfully',
          color: 'green',
        });
      }
      
      // Refetch projects
      fetchProjects();
      
      // Reset form and close modal
      resetForm();
      closeCreateModal();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    } finally {
      setFormLoading(false);
    }
  };
  
  // Handle edit form submission
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentProject) return;
    
    setFormLoading(true);
    
    try {
      const payload = {
        ...formData,
        startDate: formData.startDate ? formData.startDate.toISOString() : undefined,
        endDate: formData.endDate ? formData.endDate.toISOString() : undefined,
        isActive: currentProject.isActive,
      };
      
      const response = await fetch(`/api/projects/${currentProject._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update project');
      }
      
      notifications.show({
        title: 'Success',
        message: 'Project updated successfully',
        color: 'green',
      });
      
      // Refetch projects
      fetchProjects();
      
      // Close modal
      closeEditModal();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    } finally {
      setFormLoading(false);
    }
  };
  
  // Handle project archiving
  const handleDelete = async () => {
    if (!currentProject) return;
    
    setFormLoading(true);
    
    try {
      const response = await fetch(`/api/projects/${currentProject._id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to archive project');
      }
      
      notifications.show({
        title: 'Success',
        message: 'Project archived successfully',
        color: 'green',
      });
      
      // Refetch projects
      fetchProjects();
      
      // Close modal
      closeDeleteModal();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    } finally {
      setFormLoading(false);
    }
  };
  
  // Handle folder regeneration
  const handleRegenerateFolder = async () => {
    if (!currentProject) return;
    
    setFolderLoading(true);
    
    try {
      // Get selected services to regenerate
      const services = Object.entries(folderServices)
        .filter(([_, value]) => value)
        .map(([key, _]) => key);
      
      if (services.length === 0) {
        throw new Error('No storage services selected');
      }
      
      const response = await fetch(`/api/projects/${currentProject._id}/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ services }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to regenerate folder structure');
      }
      
      // Check for service-specific errors
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
      
      // Refetch projects to get updated folder structure
      fetchProjects();
      
      // Close modal
      closeFolderModal();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    } finally {
      setFolderLoading(false);
    }
  };
  
  // Reset form to default values
  const resetForm = () => {
    setFormData({
      name: '',
      client: '',
      description: '',
      startDate: new Date(),
      endDate: null,
      status: 'planning',
      notes: '',
      settings: {
        allowClientAccess: true,
        autoCreateProxies: true,
        defaultStorageTier: 'all',
      },
    });
    setActiveTab('details');
  };
  
  // Setup edit modal with current project data
  const handleOpenEditModal = (project: IProject) => {
    setCurrentProject(project);
    setFormData({
      name: project.name,
      client: project.client._id,
      description: project.description || '',
      startDate: project.startDate ? new Date(project.startDate) : new Date(),
      endDate: project.endDate ? new Date(project.endDate) : null,
      status: project.status,
      notes: project.notes || '',
      settings: project.settings,
    });
    setActiveTab('details');
    openEditModal();
  };
  
  // Setup delete modal with current project
  const handleOpenDeleteModal = (project: IProject) => {
    setCurrentProject(project);
    openDeleteModal();
  };
  
  // Setup folder modal with current project
  const handleOpenFolderModal = (project: IProject) => {
    setCurrentProject(project);
    setFolderServices({
      frameio: true,
      r2: true,
      lucidlink: true,
    });
    openFolderModal();
  };
  
  // Filter projects by search term
  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.projectId.toLowerCase().includes(search.toLowerCase()) ||
    project.client.name.toLowerCase().includes(search.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(search.toLowerCase()))
  );
  
  // Get client options for select
  const clientOptions = clients.map(client => ({
    value: client._id,
    label: `${client.name} (${client.code}) - ${client.agency.name}`,
    group: client.agency.name,
  }));
  
  // Get status options for select
  const statusOptions = [
    { value: 'planning', label: 'Planning' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'archived', label: 'Archived' },
  ];
  
  // Get status color
  const getStatusColor = (status: string) => {
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
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };
  
  return (
    <Paper p="md" withBorder radius="md">
      <Group position="apart" mb="md">
        <Title order={3}>Project Management</Title>
        <Group>
          <TextInput
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            icon={<IconSearch size={16} />}
          />
          <Select
            placeholder="Filter by client"
            clearable
            value={clientFilter}
            onChange={setClientFilter}
            data={clientOptions}
            icon={<IconBuilding size={16} />}
          />
          <Select
            placeholder="Filter by status"
            clearable
            value={statusFilter}
            onChange={setStatusFilter}
            data={statusOptions}
            icon={<IconChartBar size={16} />}
          />
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={fetchProjects}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={openCreateModal}
            disabled={clients.length === 0}
          >
            Add Project
          </Button>
        </Group>
      </Group>
      
      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Project ID</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Client</Table.Th>
              <Table.Th>Agency</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Start Date</Table.Th>
              <Table.Th>End Date</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={8} align="center">
                  <Loader size="sm" mx="auto" my="md" />
                </Table.Td>
              </Table.Tr>
            ) : clients.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8} align="center">
                  <Text c="dimmed" py="md">
                    No clients found. Please create a client first.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : filteredProjects.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8} align="center">
                  <Text c="dimmed" py="md">
                    No projects found. Click "Add Project" to create one.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredProjects.map((project) => (
                <Table.Tr key={project._id}>
                  <Table.Td>
                    <Text fw={700}>{project.projectId}</Text>
                  </Table.Td>
                  <Table.Td>{project.name}</Table.Td>
                  <Table.Td>{project.client.name}</Table.Td>
                  <Table.Td>{project.client.agency.name}</Table.Td>
                  <Table.Td>
                    <Badge color={getStatusColor(project.status)}>
                      {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{formatDate(project.startDate)}</Table.Td>
                  <Table.Td>{formatDate(project.endDate)}</Table.Td>
                  <Table.Td>
                    <Group spacing="xs">
                      <Tooltip label="Edit Project">
                        <ActionIcon 
                          variant="light" 
                          color="blue"
                          onClick={() => handleOpenEditModal(project)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Manage Folders">
                        <ActionIcon 
                          variant="light" 
                          color="teal"
                          onClick={() => handleOpenFolderModal(project)}
                        >
                          <IconFolder size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Archive Project">
                        <ActionIcon 
                          variant="light" 
                          color="red"
                          onClick={() => handleOpenDeleteModal(project)}
                          disabled={!project.isActive || project.status === 'archived'}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      
      {/* Create Project Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title="Create New Project"
        size="lg"
        centered
      >
        <form onSubmit={handleCreate}>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="details" leftSection={<IconInfoCircle size={16} />}>
                Project Details
              </Tabs.Tab>
              <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
                Settings
              </Tabs.Tab>
            </Tabs.List>
            
            <Tabs.Panel value="details" pt="md">
              <Stack>
                <TextInput
                  label="Project Name"
                  placeholder="Enter project name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <Select
                  label="Client"
                  placeholder="Select client"
                  required
                  data={clientOptions}
                  value={formData.client}
                  onChange={(value) => setFormData({ ...formData, client: value || '' })}
                />
                <Textarea
                  label="Description"
                  placeholder="Enter project description"
                  minRows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
                <Group grow>
                  <DateInput
                    label="Start Date"
                    placeholder="Select start date"
                    value={formData.startDate}
                    onChange={(value) => setFormData({ ...formData, startDate: value || new Date() })}
                    clearable={false}
                  />
                  <DateInput
                    label="End Date (Optional)"
                    placeholder="Select end date"
                    value={formData.endDate}
                    onChange={(value) => setFormData({ ...formData, endDate: value })}
                    clearable
                  />
                </Group>
                <Select
                  label="Status"
                  placeholder="Select project status"
                  required
                  data={statusOptions}
                  value={formData.status}
                  onChange={(value: any) => setFormData({ ...formData, status: value || 'planning' })}
                />
                <Textarea
                  label="Notes"
                  placeholder="Enter any additional notes"
                  minRows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </Stack>
            </Tabs.Panel>
            
            <Tabs.Panel value="settings" pt="md">
              <Stack>
                <Switch
                  label="Allow Client Access"
                  description="Enable client to access project files and videos"
                  checked={formData.settings.allowClientAccess}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      allowClientAccess: e.currentTarget.checked,
                    },
                  })}
                />
                <Switch
                  label="Auto-Create Proxies"
                  description="Automatically create proxy files for uploaded media"
                  checked={formData.settings.autoCreateProxies}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      autoCreateProxies: e.currentTarget.checked,
                    },
                  })}
                />
                <Select
                  label="Default Storage Tier"
                  description="Where files should be stored by default"
                  data={[
                    { value: 'all', label: 'All Tiers' },
                    { value: 'frameio', label: 'Frame.io Only' },
                    { value: 'r2', label: 'Cloudflare R2 Only' },
                    { value: 'lucidlink', label: 'LucidLink Only' },
                  ]}
                  value={formData.settings.defaultStorageTier}
                  onChange={(value: any) => setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      defaultStorageTier: value || 'all',
                    },
                  })}
                />
                <Alert color="blue" title="Standard Folder Structure" icon={<IconInfoCircle />}>
                  When this project is created, a standard folder structure will be automatically 
                  generated across all storage tiers (Frame.io, Cloudflare R2, and LucidLink).
                </Alert>
              </Stack>
            </Tabs.Panel>
          </Tabs>
          
          <Group position="right" mt="xl">
            <Button variant="outline" onClick={closeCreateModal} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              Create Project
            </Button>
          </Group>
        </form>
      </Modal>
      
      {/* Edit Project Modal */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title={`Edit Project: ${currentProject?.projectId}`}
        size="lg"
        centered
      >
        <form onSubmit={handleEdit}>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="details" leftSection={<IconInfoCircle size={16} />}>
                Project Details
              </Tabs.Tab>
              <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
                Settings
              </Tabs.Tab>
            </Tabs.List>
            
            <Tabs.Panel value="details" pt="md">
              <Stack>
                <TextInput
                  label="Project Name"
                  placeholder="Enter project name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <Select
                  label="Client"
                  placeholder="Select client"
                  required
                  data={clientOptions}
                  value={formData.client}
                  onChange={(value) => setFormData({ ...formData, client: value || '' })}
                />
                <Textarea
                  label="Description"
                  placeholder="Enter project description"
                  minRows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
                <Group grow>
                  <DateInput
                    label="Start Date"
                    placeholder="Select start date"
                    value={formData.startDate}
                    onChange={(value) => setFormData({ ...formData, startDate: value || new Date() })}
                    clearable={false}
                  />
                  <DateInput
                    label="End Date (Optional)"
                    placeholder="Select end date"
                    value={formData.endDate}
                    onChange={(value) => setFormData({ ...formData, endDate: value })}
                    clearable
                  />
                </Group>
                <Select
                  label="Status"
                  placeholder="Select project status"
                  required
                  data={statusOptions}
                  value={formData.status}
                  onChange={(value: any) => setFormData({ ...formData, status: value || 'planning' })}
                />
                <Textarea
                  label="Notes"
                  placeholder="Enter any additional notes"
                  minRows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </Stack>
            </Tabs.Panel>
            
            <Tabs.Panel value="settings" pt="md">
              <Stack>
                <Switch
                  label="Allow Client Access"
                  description="Enable client to access project files and videos"
                  checked={formData.settings.allowClientAccess}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      allowClientAccess: e.currentTarget.checked,
                    },
                  })}
                />
                <Switch
                  label="Auto-Create Proxies"
                  description="Automatically create proxy files for uploaded media"
                  checked={formData.settings.autoCreateProxies}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      autoCreateProxies: e.currentTarget.checked,
                    },
                  })}
                />
                <Select
                  label="Default Storage Tier"
                  description="Where files should be stored by default"
                  data={[
                    { value: 'all', label: 'All Tiers' },
                    { value: 'frameio', label: 'Frame.io Only' },
                    { value: 'r2', label: 'Cloudflare R2 Only' },
                    { value: 'lucidlink', label: 'LucidLink Only' },
                  ]}
                  value={formData.settings.defaultStorageTier}
                  onChange={(value: any) => setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      defaultStorageTier: value || 'all',
                    },
                  })}
                />
              </Stack>
            </Tabs.Panel>
          </Tabs>
          
          <Group position="right" mt="xl">
            <Button variant="outline" onClick={closeEditModal} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              Update Project
            </Button>
          </Group>
        </form>
      </Modal>
      
      {/* Archive Project Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Archive Project"
        size="md"
        centered
      >
        <Stack>
          <Text>
            Are you sure you want to archive the project "{currentProject?.name}" ({currentProject?.projectId})? 
            This will mark it as inactive and change its status to "archived".
          </Text>
          <Alert color="yellow" title="Important" icon={<IconExclamationMark />}>
            Archived projects will still be accessible but hidden from most views. 
            All files and data will be preserved.
          </Alert>
          <Group position="right" mt="md">
            <Button variant="outline" onClick={closeDeleteModal} disabled={formLoading}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete} loading={formLoading}>
              Archive Project
            </Button>
          </Group>
        </Stack>
      </Modal>
      
      {/* Folder Management Modal */}
      <Modal
        opened={folderModalOpened}
        onClose={closeFolderModal}
        title={`Folder Structure: ${currentProject?.projectId}`}
        size="lg"
        centered
      >
        <Stack>
          {currentProject && (
            <>
              <Card withBorder>
                <Title order={5}>Current Folder Structure</Title>
                <Stack mt="sm" spacing="xs">
                  <Group position="apart">
                    <Text fw={600}>Frame.io:</Text>
                    <Text size="sm" color={!currentProject.folderStructure.frameio.folderId ? 'red' : undefined}>
                      {currentProject.folderStructure.frameio.folderId ? 
                        `${currentProject.folderStructure.frameio.path} (${currentProject.folderStructure.frameio.folderId})` : 
                        'Not configured'
                      }
                    </Text>
                  </Group>
                  <Group position="apart">
                    <Text fw={600}>Cloudflare R2:</Text>
                    <Text size="sm" color={!currentProject.folderStructure.r2.basePath ? 'red' : undefined}>
                      {currentProject.folderStructure.r2.basePath || 'Not configured'}
                    </Text>
                  </Group>
                  <Group position="apart">
                    <Text fw={600}>LucidLink:</Text>
                    <Text size="sm" color={!currentProject.folderStructure.lucidlink.path ? 'red' : undefined}>
                      {currentProject.folderStructure.lucidlink.path || 'Not configured'}
                    </Text>
                  </Group>
                </Stack>
              </Card>
              
              <Divider label="Regenerate Folders" labelPosition="center" />
              
              <Text size="sm" color="dimmed">
                You can regenerate the standard folder structure for this project on one or more storage services.
                This is useful if the folder structure is missing or incorrect.
              </Text>
              
              <Stack spacing="xs">
                <Chip
                  checked={folderServices.frameio}
                  onChange={() => setFolderServices({ ...folderServices, frameio: !folderServices.frameio })}
                >
                  Frame.io
                </Chip>
                <Chip
                  checked={folderServices.r2}
                  onChange={() => setFolderServices({ ...folderServices, r2: !folderServices.r2 })}
                >
                  Cloudflare R2
                </Chip>
                <Chip
                  checked={folderServices.lucidlink}
                  onChange={() => setFolderServices({ ...folderServices, lucidlink: !folderServices.lucidlink })}
                >
                  LucidLink
                </Chip>
              </Stack>
              
              <Alert color="blue" title="Standard Folder Structure" icon={<IconInfoCircle />}>
                The folder structure includes standard post-production categories: Production, 
                Post-Production, Deliverables, Assets, and Admin - each with appropriate subfolders.
              </Alert>
              
              <Group position="right" mt="md">
                <Button variant="outline" onClick={closeFolderModal} disabled={folderLoading}>
                  Cancel
                </Button>
                <Button 
                  leftSection={<IconFolderPlus size={16} />}
                  color="teal"
                  onClick={handleRegenerateFolder}
                  loading={folderLoading}
                  disabled={!Object.values(folderServices).some(v => v)}
                >
                  Regenerate Folders
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Paper>
  );
}
