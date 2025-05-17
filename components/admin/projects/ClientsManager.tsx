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
  Select
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { 
  IconPlus, 
  IconEdit, 
  IconTrash, 
  IconSearch,
  IconRefresh,
  IconBuilding
} from '@tabler/icons-react';

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
  agency: IAgency | string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function ClientsManager() {
  const [clients, setClients] = useState<IClient[]>([]);
  const [agencies, setAgencies] = useState<IAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null);
  
  // Modal states
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  
  // Current client for edit/delete operations
  const [currentClient, setCurrentClient] = useState<IClient | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    agency: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    notes: '',
  });
  
  // Fetch clients and agencies on mount
  useEffect(() => {
    fetchAgencies();
    fetchClients();
  }, []);
  
  // Fetch agencies from API
  const fetchAgencies = async () => {
    try {
      const response = await fetch('/api/agencies?isActive=true');
      const data = await response.json();
      
      setAgencies(data);
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch agencies',
        color: 'red',
      });
      console.error('Error fetching agencies:', error);
    }
  };
  
  // Fetch clients from API
  const fetchClients = async () => {
    setLoading(true);
    try {
      // Construct URL with optional agency filter
      let url = '/api/clients';
      if (agencyFilter) {
        url += `?agency=${agencyFilter}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      setClients(data);
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch clients',
        color: 'red',
      });
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Apply agency filter and refetch clients
  useEffect(() => {
    fetchClients();
  }, [agencyFilter]);
  
  // Handle create form submission
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create client');
      }
      
      notifications.show({
        title: 'Success',
        message: 'Client created successfully',
        color: 'green',
      });
      
      // Refetch clients
      fetchClients();
      
      // Reset form and close modal
      setFormData({
        name: '',
        code: '',
        agency: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        address: '',
        notes: '',
      });
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
    
    if (!currentClient) return;
    
    setFormLoading(true);
    
    try {
      const response = await fetch(`/api/clients/${currentClient._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          isActive: currentClient.isActive,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update client');
      }
      
      notifications.show({
        title: 'Success',
        message: 'Client updated successfully',
        color: 'green',
      });
      
      // Refetch clients
      fetchClients();
      
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
  
  // Handle client deactivation/deletion
  const handleDelete = async () => {
    if (!currentClient) return;
    
    setFormLoading(true);
    
    try {
      const response = await fetch(`/api/clients/${currentClient._id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to deactivate client');
      }
      
      notifications.show({
        title: 'Success',
        message: 'Client deactivated successfully',
        color: 'green',
      });
      
      // Refetch clients
      fetchClients();
      
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
  
  // Setup edit modal with current client data
  const handleOpenEditModal = (client: IClient) => {
    setCurrentClient(client);
    setFormData({
      name: client.name,
      code: client.code,
      agency: typeof client.agency === 'object' ? client.agency._id : client.agency,
      contactName: client.contactName || '',
      contactEmail: client.contactEmail || '',
      contactPhone: client.contactPhone || '',
      address: client.address || '',
      notes: client.notes || '',
    });
    openEditModal();
  };
  
  // Setup delete modal with current client
  const handleOpenDeleteModal = (client: IClient) => {
    setCurrentClient(client);
    openDeleteModal();
  };
  
  // Filter clients by search term
  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.code.toLowerCase().includes(search.toLowerCase()) ||
    (client.contactName && client.contactName.toLowerCase().includes(search.toLowerCase())) ||
    (client.contactEmail && client.contactEmail.toLowerCase().includes(search.toLowerCase())) ||
    (typeof client.agency === 'object' && client.agency.name.toLowerCase().includes(search.toLowerCase()))
  );
  
  // Get agency options for select
  const agencyOptions = agencies.map(agency => ({
    value: agency._id,
    label: `${agency.name} (${agency.code})`,
  }));
  
  return (
    <Paper p="md" withBorder radius="md">
      <Group position="apart" mb="md">
        <Title order={3}>Client Management</Title>
        <Group>
          <TextInput
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            icon={<IconSearch size={16} />}
          />
          <Select
            placeholder="Filter by agency"
            clearable
            value={agencyFilter}
            onChange={setAgencyFilter}
            data={agencyOptions}
            icon={<IconBuilding size={16} />}
          />
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={fetchClients}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={openCreateModal}
            disabled={agencies.length === 0}
          >
            Add Client
          </Button>
        </Group>
      </Group>
      
      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Code</Table.Th>
              <Table.Th>Agency</Table.Th>
              <Table.Th>Contact</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={7} align="center">
                  <Loader size="sm" mx="auto" my="md" />
                </Table.Td>
              </Table.Tr>
            ) : agencies.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7} align="center">
                  <Text c="dimmed" py="md">
                    No agencies found. Please create an agency first.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : filteredClients.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7} align="center">
                  <Text c="dimmed" py="md">
                    No clients found. Click "Add Client" to create one.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredClients.map((client) => (
                <Table.Tr key={client._id}>
                  <Table.Td>{client.name}</Table.Td>
                  <Table.Td>{client.code}</Table.Td>
                  <Table.Td>
                    {typeof client.agency === 'object' ? (
                      <>
                        {client.agency.name} <Text component="span" fw={600}>({client.agency.code})</Text>
                      </>
                    ) : 'Unknown Agency'}
                  </Table.Td>
                  <Table.Td>{client.contactName || '-'}</Table.Td>
                  <Table.Td>{client.contactEmail || '-'}</Table.Td>
                  <Table.Td>
                    <Badge color={client.isActive ? 'green' : 'red'}>
                      {client.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group spacing="xs">
                      <Tooltip label="Edit">
                        <ActionIcon 
                          variant="light" 
                          color="blue"
                          onClick={() => handleOpenEditModal(client)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Deactivate">
                        <ActionIcon 
                          variant="light" 
                          color="red"
                          onClick={() => handleOpenDeleteModal(client)}
                          disabled={!client.isActive}
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
      
      {/* Create Client Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title="Add New Client"
        size="lg"
        centered
      >
        <form onSubmit={handleCreate}>
          <Stack>
            <Select
              label="Agency"
              placeholder="Select an agency"
              required
              data={agencyOptions}
              value={formData.agency}
              onChange={(value) => setFormData({ ...formData, agency: value || '' })}
            />
            <TextInput
              label="Client Name"
              placeholder="Enter client name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextInput
              label="Client Code"
              placeholder="Enter 2-4 letter code (e.g., ABC)"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              maxLength={4}
              error={formData.code && !/^[A-Z]{2,4}$/.test(formData.code) ? 'Code must be 2-4 uppercase letters' : ''}
            />
            <TextInput
              label="Contact Name"
              placeholder="Enter contact person's name"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
            />
            <TextInput
              label="Contact Email"
              placeholder="Enter contact email"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            />
            <TextInput
              label="Contact Phone"
              placeholder="Enter contact phone number"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
            />
            <TextInput
              label="Address"
              placeholder="Enter client address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
            <TextInput
              label="Notes"
              placeholder="Enter any notes about this client"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
            <Group position="right" mt="md">
              <Button variant="outline" onClick={closeCreateModal} disabled={formLoading}>Cancel</Button>
              <Button type="submit" loading={formLoading}>Create Client</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      
      {/* Edit Client Modal */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title="Edit Client"
        size="lg"
        centered
      >
        <form onSubmit={handleEdit}>
          <Stack>
            <Select
              label="Agency"
              placeholder="Select an agency"
              required
              data={agencyOptions}
              value={formData.agency}
              onChange={(value) => setFormData({ ...formData, agency: value || '' })}
            />
            <TextInput
              label="Client Name"
              placeholder="Enter client name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextInput
              label="Client Code"
              placeholder="Enter 2-4 letter code (e.g., ABC)"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              maxLength={4}
              error={formData.code && !/^[A-Z]{2,4}$/.test(formData.code) ? 'Code must be 2-4 uppercase letters' : ''}
            />
            <TextInput
              label="Contact Name"
              placeholder="Enter contact person's name"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
            />
            <TextInput
              label="Contact Email"
              placeholder="Enter contact email"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            />
            <TextInput
              label="Contact Phone"
              placeholder="Enter contact phone number"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
            />
            <TextInput
              label="Address"
              placeholder="Enter client address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
            <TextInput
              label="Notes"
              placeholder="Enter any notes about this client"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
            <Group position="right" mt="md">
              <Button variant="outline" onClick={closeEditModal} disabled={formLoading}>Cancel</Button>
              <Button type="submit" loading={formLoading}>Update Client</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      
      {/* Delete/Deactivate Client Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Deactivate Client"
        size="md"
        centered
      >
        <Stack>
          <Text>
            Are you sure you want to deactivate the client "{currentClient?.name}"? This will hide it from most views but preserve all data.
          </Text>
          <Text size="sm" c="dimmed">
            Note: All related projects will remain in the system.
          </Text>
          <Group position="right" mt="md">
            <Button variant="outline" onClick={closeDeleteModal} disabled={formLoading}>Cancel</Button>
            <Button color="red" onClick={handleDelete} loading={formLoading}>Deactivate Client</Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
