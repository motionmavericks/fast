'use client';

import { Container, Title, Text, Paper, Button, Group, Modal, TextInput, Textarea, Table, Badge, ActionIcon, Tooltip, ScrollArea, LoadingOverlay, Stack, Checkbox, Menu, Drawer, Tabs } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconCopy, IconTrash, IconPlayerPlay, IconPlayerStop, IconExternalLink, IconRefresh, IconDots, IconCheck, IconChecks, IconChecklist, IconUpload } from '@tabler/icons-react';
import { useState, useEffect, FormEvent } from 'react';
import { notifications } from '@mantine/notifications';
import { IUploadLink } from '@/utils/models'; // Assuming IUser is also exported or not needed for createdBy display here
import FrameIoLinkGenerator from '@/components/admin/FrameIoLinkGenerator';

interface IUser {
  _id: string;
  email: string;
}

interface PopulatedUploadLink extends Omit<IUploadLink, 'createdBy'> {
  _id: string; // Mongoose typically uses _id
  createdBy: IUser | string; // Could be populated user object or just ID
  uploadUrl?: string; // Dynamically generated for display
}

// Helper to get admin user ID from token (client-side only)
const getAdminUserIdFromToken = (): string | null => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin-token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId || null;
      } catch (e) {
        console.error('Failed to parse token for user ID:', e);
        return null;
      }
    }
  }
  return null;
};

export default function ManageLinksPage() {
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [links, setLinks] = useState<PopulatedUploadLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [confirmDrawerOpen, setConfirmDrawerOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'activate' | 'deactivate' | 'delete' | null>(null);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<PopulatedUploadLink | null>(null);
  const [frameioLinkModalOpened, { open: openFrameioLinkModal, close: closeFrameioLinkModal }] = useDisclosure(false);

  // Form state for creating a new link
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/links');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch links');
      }
      const data: PopulatedUploadLink[] = await response.json();
      setLinks(data.map(link => ({...link, uploadUrl: `${window.location.origin}/upload/${link.linkId}`})));
    } catch (error: any) {
      notifications.show({
        title: 'Error Fetching Links',
        message: error.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleCreateLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!clientName || !projectName) {
        notifications.show({
            title: 'Validation Error',
            message: 'Client Name and Project Name are required.',
            color: 'red'
        });
        return;
    }
    setFormLoading(true);
    const adminId = getAdminUserIdFromToken();
    if (!adminId) {
        notifications.show({
            title: 'Authentication Error',
            message: 'Could not identify admin user. Please re-login.',
            color: 'red'
        });
        setFormLoading(false);
        return;
    }

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName, projectName, expiryDate, notes, createdBy: adminId }),
      });
      const newLink = await response.json();
      if (!response.ok) {
        throw new Error(newLink.message || 'Failed to create link');
      }
      notifications.show({
        title: 'Link Created',
        message: `Upload link for ${newLink.projectName} created successfully.`,
        color: 'green',
      });
      fetchLinks(); // Refresh the list
      setClientName('');
      setProjectName('');
      setExpiryDate('');
      setNotes('');
      closeModal();
    } catch (error: any) {
      notifications.show({
        title: 'Error Creating Link',
        message: error.message,
        color: 'red',
      });
    } finally {
      setFormLoading(false);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      notifications.show({ title: 'Copied!', message: 'Link copied to clipboard.', color: 'teal' });
    }).catch(err => {
      notifications.show({ title: 'Failed to Copy', message: 'Could not copy link.', color: 'red' });
    });
  };

  const openFrameioGenerator = (link: PopulatedUploadLink) => {
    setSelectedLink(link);
    openFrameioLinkModal();
  };

  // Replace the simulated toggle and delete functions with actual API calls
  const toggleLinkActive = async (linkId: string, currentStatus: boolean) => {
    try {
      console.log(`Toggling link with ID: ${linkId}`);
      const response = await fetch(`/api/links/${linkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update link status');
      }
      
      notifications.show({
        title: 'Status Updated',
        message: `Link has been ${!currentStatus ? 'activated' : 'deactivated'}.`,
        color: 'blue',
      });
      
      fetchLinks(); // Refresh the list
    } catch (error: any) {
      notifications.show({
        title: 'Error Updating Status',
        message: error.message,
        color: 'red',
      });
    }
  };

  const initiateDeleteLink = (linkId: string) => {
    setLinkToDelete(linkId);
    openDeleteModal();
  };

  const deleteLink = async () => {
    if (!linkToDelete) return;
    
    try {
      console.log(`Deleting link with ID: ${linkToDelete}`);
      const response = await fetch(`/api/links/${linkToDelete}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete link');
      }
      
      notifications.show({
        title: 'Link Deleted',
        message: 'The upload link has been permanently deleted.',
        color: 'green',
      });
      
      fetchLinks(); // Refresh the list
      closeDeleteModal();
      setLinkToDelete(null);
    } catch (error: any) {
      notifications.show({
        title: 'Error Deleting Link',
        message: error.message,
        color: 'red',
      });
    }
  };

  // Handle bulk selection
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedLinks([]);
    } else {
      setSelectedLinks(links.map(link => link.linkId));
    }
    setSelectAll(!selectAll);
  };

  const toggleLinkSelection = (linkId: string) => {
    if (selectedLinks.includes(linkId)) {
      setSelectedLinks(selectedLinks.filter(id => id !== linkId));
      setSelectAll(false);
    } else {
      setSelectedLinks([...selectedLinks, linkId]);
      if (selectedLinks.length + 1 === links.length) {
        setSelectAll(true);
      }
    }
  };

  // Bulk actions
  const openBulkActionConfirm = (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedLinks.length === 0) {
      notifications.show({
        title: 'No Links Selected',
        message: 'Please select at least one link to perform bulk actions.',
        color: 'yellow',
      });
      return;
    }
    
    setBulkActionType(action);
    setConfirmDrawerOpen(true);
  };

  const executeBulkAction = async () => {
    if (!bulkActionType || selectedLinks.length === 0) return;
    
    setBulkActionLoading(true);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      if (bulkActionType === 'delete') {
        // Delete multiple links
        for (const linkId of selectedLinks) {
          try {
            const response = await fetch(`/api/links/${linkId}`, {
              method: 'DELETE',
            });
            
            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (e) {
            errorCount++;
          }
        }
      } else {
        // Activate or deactivate links
        const isActive = bulkActionType === 'activate';
        
        for (const linkId of selectedLinks) {
          try {
            const response = await fetch(`/api/links/${linkId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive }),
            });
            
            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (e) {
            errorCount++;
          }
        }
      }
      
      // Show results notification
      notifications.show({
        title: 'Bulk Action Complete',
        message: `Successfully ${bulkActionType}d ${successCount} links${errorCount > 0 ? `, with ${errorCount} errors` : ''}`,
        color: errorCount > 0 ? 'yellow' : 'green',
      });
      
      // Refresh the list
      fetchLinks();
      
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: `Failed to perform bulk action: ${error.message}`,
        color: 'red',
      });
    } finally {
      setBulkActionLoading(false);
      setConfirmDrawerOpen(false);
      setSelectedLinks([]);
      setSelectAll(false);
    }
  };

  const rows = links.map((link) => (
    <Table.Tr key={link._id}>
      <Table.Td>
        <Checkbox
          checked={selectedLinks.includes(link.linkId)}
          onChange={() => toggleLinkSelection(link.linkId)}
        />
      </Table.Td>
      <Table.Td>{link.projectName}</Table.Td>
      <Table.Td>{link.clientName}</Table.Td>
      <Table.Td>
        {link.uploadUrl && (
            <Button 
                variant="subtle" 
                size="xs" 
                leftSection={<IconExternalLink size={14}/>} 
                onClick={() => window.open(link.uploadUrl, '_blank')}
            >
                {link.linkId}
            </Button>
        )}
      </Table.Td>
      <Table.Td>{link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'Never'}</Table.Td>
      <Table.Td>{new Date(link.createdAt).toLocaleDateString()}</Table.Td>
      <Table.Td>
        <Badge color={link.isActive ? 'green' : 'gray'} variant="light">
          {link.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </Table.Td>
      <Table.Td>{typeof link.createdBy === 'object' ? link.createdBy?.email : 'N/A'}</Table.Td>
      <Table.Td>{link.uploadCount}</Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <Tooltip label="Copy Upload URL">
            <ActionIcon variant="subtle" onClick={() => link.uploadUrl && copyToClipboard(link.uploadUrl)} disabled={!link.uploadUrl}>
              <IconCopy size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Generate Frame.io Upload Link">
            <ActionIcon variant="subtle" color="blue" onClick={() => openFrameioGenerator(link)}>
              <IconUpload size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={link.isActive ? 'Deactivate Link' : 'Activate Link'}>
            <ActionIcon variant="subtle" color={link.isActive ? 'yellow' : 'green'} onClick={() => toggleLinkActive(link.linkId, link.isActive)}>
              {link.isActive ? <IconPlayerStop size={16} /> : <IconPlayerPlay size={16} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete Link">
            <ActionIcon variant="subtle" color="red" onClick={() => initiateDeleteLink(link.linkId)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Container fluid>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Manage Upload Links</Title>
        <Group>
            <Button variant="default" onClick={fetchLinks} leftSection={<IconRefresh size={16} />} loading={loading && !modalOpened}>
                Refresh
            </Button>
            <Button onClick={openModal} leftSection={<IconPlus size={16} />}>
              Create New Link
            </Button>
        </Group>
      </Group>

      {selectedLinks.length > 0 && (
        <Paper withBorder shadow="sm" p="md" mb="xl">
          <Group position="apart">
            <Text fw={500}>{selectedLinks.length} links selected</Text>
            <Group>
              <Button
                variant="light"
                color="green"
                onClick={() => openBulkActionConfirm('activate')}
                leftSection={<IconPlayerPlay size={16} />}
              >
                Activate All
              </Button>
              <Button
                variant="light"
                color="yellow"
                onClick={() => openBulkActionConfirm('deactivate')}
                leftSection={<IconPlayerStop size={16} />}
              >
                Deactivate All
              </Button>
              <Button
                variant="light"
                color="red"
                onClick={() => openBulkActionConfirm('delete')}
                leftSection={<IconTrash size={16} />}
              >
                Delete All
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      <Modal opened={modalOpened} onClose={closeModal} title="Create New Upload Link" centered size="lg">
        <LoadingOverlay visible={formLoading} overlayProps={{ blur: 2}} />
        <form onSubmit={handleCreateLink}>
            <Stack>
            <TextInput
                label="Client Name / Agency"
                placeholder="e.g., Client Alpha Inc."
                value={clientName}
                onChange={(e) => setClientName(e.currentTarget.value)}
                required
            />
            <TextInput
                label="Project Name / Description"
                placeholder="e.g., Spring Campaign Footage"
                value={projectName}
                onChange={(e) => setProjectName(e.currentTarget.value)}
                required
            />
            <TextInput
                label="Expiry Date (Optional)"
                placeholder="YYYY-MM-DD"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.currentTarget.value)}
            />
            <Textarea
                label="Notes (Optional)"
                placeholder="Internal notes about this link..."
                value={notes}
                onChange={(e) => setNotes(e.currentTarget.value)}
                minRows={3}
            />
            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={closeModal} disabled={formLoading}>
                Cancel
                </Button>
                <Button type="submit" loading={formLoading}>Create Link</Button>
            </Group>
            </Stack>
        </form>
      </Modal>

      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Confirm Delete"
        centered
        size="md"
      >
        <Stack>
          <Text>
            Are you sure you want to delete this link? This action cannot be undone.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeDeleteModal}>
              Cancel
            </Button>
            <Button 
              color="red" 
              onClick={deleteLink}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Drawer
        opened={confirmDrawerOpen}
        onClose={() => setConfirmDrawerOpen(false)}
        title="Confirm Bulk Action"
        position="right"
        size="md"
      >
        <Stack>
          <Text>
            {bulkActionType === 'delete' 
              ? `Are you sure you want to delete ${selectedLinks.length} selected links? This cannot be undone.`
              : bulkActionType === 'activate'
                ? `Activate ${selectedLinks.length} selected links?`
                : `Deactivate ${selectedLinks.length} selected links?`
            }
          </Text>
          <Group position="right" mt="xl">
            <Button variant="default" onClick={() => setConfirmDrawerOpen(false)}>
              Cancel
            </Button>
            <Button 
              color={bulkActionType === 'delete' ? 'red' : bulkActionType === 'activate' ? 'green' : 'yellow'}
              onClick={executeBulkAction}
              loading={bulkActionLoading}
            >
              Confirm
            </Button>
          </Group>
        </Stack>
      </Drawer>

      <Paper withBorder shadow="sm" radius="md">
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2}} />
        {links.length === 0 && !loading ? (
          <Text p="xl" ta="center" c="dimmed">No upload links found. Click "Create New Link" to get started.</Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="sm" miw={800}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    <Checkbox
                      checked={selectAll}
                      onChange={toggleSelectAll}
                      aria-label="Select all links"
                    />
                  </Table.Th>
                  <Table.Th>Project</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Link ID</Table.Th>
                  <Table.Th>Expires</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Created By</Table.Th>
                  <Table.Th>Uploads</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      {/* Frame.io Upload Link Generator Modal */}
      <Modal 
        opened={frameioLinkModalOpened} 
        onClose={closeFrameioLinkModal} 
        title="Generate Frame.io Upload Link" 
        centered 
        size="lg"
      >
        {selectedLink && (
          <FrameIoLinkGenerator 
            linkId={selectedLink.linkId}
            clientName={selectedLink.clientName}
            projectName={selectedLink.projectName}
            onSuccess={() => {
              notifications.show({
                title: 'Success',
                message: 'Frame.io upload link generated successfully',
                color: 'green',
              });
            }}
          />
        )}
      </Modal>
    </Container>
  );
}
