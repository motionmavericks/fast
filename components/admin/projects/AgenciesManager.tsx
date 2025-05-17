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
  ScrollArea
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { 
  IconPlus, 
  IconEdit, 
  IconTrash, 
  IconCheck, 
  IconX, 
  IconSearch,
  IconRefresh
} from '@tabler/icons-react';

interface IAgency {
  _id: string;
  name: string;
  code: string;
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

export default function AgenciesManager() {
  const [agencies, setAgencies] = useState<IAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  
  // Current agency for edit/delete operations
  const [currentAgency, setCurrentAgency] = useState<IAgency | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    notes: '',
  });
  
  // Fetch agencies on mount
  useEffect(() => {
    fetchAgencies();
  }, []);
  
  // Fetch agencies from API
  const fetchAgencies = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/agencies');
      const data = await response.json();
      
      setAgencies(data);
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch agencies',
        color: 'red',
      });
      console.error('Error fetching agencies:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle create form submission
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    
    try {
      const response = await fetch('/api/agencies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create agency');
      }
      
      notifications.show({
        title: 'Success',
        message: 'Agency created successfully',
        color: 'green',
      });
      
      // Refetch agencies
      fetchAgencies();
      
      // Reset form and close modal
      setFormData({
        name: '',
        code: '',
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
    
    if (!currentAgency) return;
    
    setFormLoading(true);
    
    try {
      const response = await fetch(`/api/agencies/${currentAgency._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          isActive: currentAgency.isActive,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update agency');
      }
      
      notifications.show({
        title: 'Success',
        message: 'Agency updated successfully',
        color: 'green',
      });
      
      // Refetch agencies
      fetchAgencies();
      
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
  
  // Handle agency deactivation/deletion
  const handleDelete = async () => {
    if (!currentAgency) return;
    
    setFormLoading(true);
    
    try {
      const response = await fetch(`/api/agencies/${currentAgency._id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to deactivate agency');
      }
      
      notifications.show({
        title: 'Success',
        message: 'Agency deactivated successfully',
        color: 'green',
      });
      
      // Refetch agencies
      fetchAgencies();
      
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
  
  // Setup edit modal with current agency data
  const handleOpenEditModal = (agency: IAgency) => {
    setCurrentAgency(agency);
    setFormData({
      name: agency.name,
      code: agency.code,
      contactName: agency.contactName || '',
      contactEmail: agency.contactEmail || '',
      contactPhone: agency.contactPhone || '',
      address: agency.address || '',
      notes: agency.notes || '',
    });
    openEditModal();
  };
  
  // Setup delete modal with current agency
  const handleOpenDeleteModal = (agency: IAgency) => {
    setCurrentAgency(agency);
    openDeleteModal();
  };
  
  // Filter agencies by search term
  const filteredAgencies = agencies.filter(agency => 
    agency.name.toLowerCase().includes(search.toLowerCase()) ||
    agency.code.toLowerCase().includes(search.toLowerCase()) ||
    (agency.contactName && agency.contactName.toLowerCase().includes(search.toLowerCase())) ||
    (agency.contactEmail && agency.contactEmail.toLowerCase().includes(search.toLowerCase()))
  );
  
  return (
    <Paper p="md" withBorder radius="md">
      <Group position="apart" mb="md">
        <Title order={3}>Agency Management</Title>
        <Group>
          <TextInput
            placeholder="Search agencies..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            icon={<IconSearch size={16} />}
          />
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={fetchAgencies}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={openCreateModal}
          >
            Add Agency
          </Button>
        </Group>
      </Group>
      
      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Code</Table.Th>
              <Table.Th>Contact</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={6} align="center">
                  <Loader size="sm" mx="auto" my="md" />
                </Table.Td>
              </Table.Tr>
            ) : filteredAgencies.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} align="center">
                  <Text c="dimmed" py="md">
                    No agencies found. Click "Add Agency" to create one.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredAgencies.map((agency) => (
                <Table.Tr key={agency._id}>
                  <Table.Td>{agency.name}</Table.Td>
                  <Table.Td>{agency.code}</Table.Td>
                  <Table.Td>{agency.contactName || '-'}</Table.Td>
                  <Table.Td>{agency.contactEmail || '-'}</Table.Td>
                  <Table.Td>
                    <Badge color={agency.isActive ? 'green' : 'red'}>
                      {agency.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group spacing="xs">
                      <Tooltip label="Edit">
                        <ActionIcon 
                          variant="light" 
                          color="blue"
                          onClick={() => handleOpenEditModal(agency)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Deactivate">
                        <ActionIcon 
                          variant="light" 
                          color="red"
                          onClick={() => handleOpenDeleteModal(agency)}
                          disabled={!agency.isActive}
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
      
      {/* Create Agency Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title="Add New Agency"
        size="lg"
        centered
      >
        <form onSubmit={handleCreate}>
          <Stack>
            <TextInput
              label="Agency Name"
              placeholder="Enter agency name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextInput
              label="Agency Code"
              placeholder="Enter 2-4 letter code (e.g., MM)"
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
              placeholder="Enter agency address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
            <TextInput
              label="Notes"
              placeholder="Enter any notes about this agency"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
            <Group position="right" mt="md">
              <Button variant="outline" onClick={closeCreateModal} disabled={formLoading}>Cancel</Button>
              <Button type="submit" loading={formLoading}>Create Agency</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      
      {/* Edit Agency Modal */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title="Edit Agency"
        size="lg"
        centered
      >
        <form onSubmit={handleEdit}>
          <Stack>
            <TextInput
              label="Agency Name"
              placeholder="Enter agency name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextInput
              label="Agency Code"
              placeholder="Enter 2-4 letter code (e.g., MM)"
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
              placeholder="Enter agency address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
            <TextInput
              label="Notes"
              placeholder="Enter any notes about this agency"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
            <Group position="right" mt="md">
              <Button variant="outline" onClick={closeEditModal} disabled={formLoading}>Cancel</Button>
              <Button type="submit" loading={formLoading}>Update Agency</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      
      {/* Delete/Deactivate Agency Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Deactivate Agency"
        size="md"
        centered
      >
        <Stack>
          <Text>
            Are you sure you want to deactivate the agency "{currentAgency?.name}"? This will hide it from most views but preserve all data.
          </Text>
          <Text size="sm" c="dimmed">
            Note: All related clients and projects will remain in the system.
          </Text>
          <Group position="right" mt="md">
            <Button variant="outline" onClick={closeDeleteModal} disabled={formLoading}>Cancel</Button>
            <Button color="red" onClick={handleDelete} loading={formLoading}>Deactivate Agency</Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
