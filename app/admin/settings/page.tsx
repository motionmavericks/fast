'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Tabs, Paper, TextInput, PasswordInput, Button, Group, Stack, Switch, Text, LoadingOverlay, Alert, Divider, NumberInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconServer, IconCloud, IconMailbox, IconDatabase, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import SystemStatus from '@/components/admin/status/SystemStatus';

interface Settings {
  database: {
    uri: string;
  };
  wasabi: {
    enabled: boolean;
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  };
  frameio: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    teamId: string;
    rootProjectId: string;
  };
  r2: {
    enabled: boolean;
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicDomain: string;
  };
  lucidlink: {
    enabled: boolean;
    basePath: string;
  };
  email: {
    provider: 'sendgrid';
    apiKey: string;
    senderEmail: string;
    adminEmails: string;
  };
  uploads: {
    maxFileSize: number; // in bytes
    defaultChunkSize: number; // in bytes
    maxConcurrentUploads: number;
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('system');

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/settings');
        
        if (!response.ok) {
          throw new Error('Failed to load settings');
        }
        
        const data = await response.json();
        setSettings(data);
      } catch (error: any) {
        console.error('Error fetching settings:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load settings: ' + (error.message || 'Unknown error'),
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Save settings
  const saveSettings = async (section: keyof Settings) => {
    try {
      setSaving(true);
      
      if (!settings) return;
      
      const sectionData = settings[section];
      
      const response = await fetch(`/api/admin/settings/${section}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sectionData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save settings');
      }
      
      notifications.show({
        title: 'Success',
        message: `${section.charAt(0).toUpperCase() + section.slice(1)} settings saved successfully`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save settings: ' + (error.message || 'Unknown error'),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  // Update setting value
  const updateSetting = (section: keyof Settings, key: string, value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value,
      },
    });
  };

  // Test connection for a service
  const testConnection = async (service: string) => {
    try {
      setSaving(true);
      
      const response = await fetch(`/api/admin/settings/test/${service}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to connect to ${service}`);
      }
      
      const data = await response.json();
      
      notifications.show({
        title: 'Connection Successful',
        message: data.message || `Connected to ${service} successfully`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    } catch (error: any) {
      console.error(`Error testing ${service} connection:`, error);
      notifications.show({
        title: 'Connection Failed',
        message: error.message || `Failed to connect to ${service}`,
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container fluid py="lg">
        <Title order={2} mb="xl">Application Settings</Title>
        <Paper withBorder p="xl" radius="md">
          <LoadingOverlay visible />
          <div style={{ height: 400 }}></div>
        </Paper>
      </Container>
    );
  }

  if (!settings) {
    return (
      <Container fluid py="lg">
        <Title order={2} mb="xl">Application Settings</Title>
        <Alert color="red" title="Error Loading Settings" icon={<IconAlertCircle />}>
          Could not load application settings. Please try again later.
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid py="lg">
      <Group justify="space-between" mb="xl">
        <Title order={2}>Application Settings</Title>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="system" leftSection={<IconServer size={16} />}>
            System Status
          </Tabs.Tab>
          <Tabs.Tab value="storage" leftSection={<IconCloud size={16} />}>
            Storage Settings
          </Tabs.Tab>
          <Tabs.Tab value="email" leftSection={<IconMailbox size={16} />}>
            Email Settings
          </Tabs.Tab>
          <Tabs.Tab value="database" leftSection={<IconDatabase size={16} />}>
            Database Settings
          </Tabs.Tab>
          <Tabs.Tab value="uploads" leftSection={<IconCloud size={16} />}>
            Upload Settings
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="system">
          <SystemStatus refreshInterval={3 * 60 * 1000} />
        </Tabs.Panel>

        <Tabs.Panel value="storage">
          <Paper withBorder p="xl" radius="md" mb="xl">
            <LoadingOverlay visible={saving} />
            <Title order={3} mb="md">Frame.io Settings</Title>
            <Stack>
              <Switch
                label="Enable Frame.io Integration"
                checked={settings.frameio.enabled}
                onChange={(e) => updateSetting('frameio', 'enabled', e.currentTarget.checked)}
              />
              
              <Alert 
                color="blue" 
                icon={<IconAlertCircle size={16} />}
                title="V4 API Integration"
                variant="outline"
              >
                <Text size="sm">
                  Frame.io has transitioned to the V4 API with OAuth authentication.
                  For the new integration, please use the <a href="/admin/settings/frameio" style={{ fontWeight: 'bold' }}>Frame.io V4 API</a> settings page.
                </Text>
              </Alert>
              
              {settings.frameio.enabled && (
                <>
                  <TextInput
                    label="Client ID"
                    placeholder="Your Frame.io Client ID"
                    value={settings.frameio.clientId}
                    onChange={(e) => updateSetting('frameio', 'clientId', e.currentTarget.value)}
                    required
                  />
                  <PasswordInput
                    label="Client Secret"
                    placeholder="Your Frame.io Client Secret"
                    value={settings.frameio.clientSecret}
                    onChange={(e) => updateSetting('frameio', 'clientSecret', e.currentTarget.value)}
                    required
                  />
                  <TextInput
                    label="Team ID"
                    placeholder="Your Frame.io Team ID"
                    value={settings.frameio.teamId}
                    onChange={(e) => updateSetting('frameio', 'teamId', e.currentTarget.value)}
                    required
                  />
                  <TextInput
                    label="Root Project ID"
                    placeholder="Your Frame.io Root Project ID"
                    value={settings.frameio.rootProjectId}
                    onChange={(e) => updateSetting('frameio', 'rootProjectId', e.currentTarget.value)}
                    required
                  />
                </>
              )}
              
              <Group justify="space-between" mt="md">
                <Button
                  color="blue"
                  variant="light"
                  component="a"
                  href="/admin/settings/frameio"
                >
                  Go to V4 API Settings
                </Button>
                
                <Group>
                  <Button
                    variant="outline"
                    onClick={() => testConnection('frameio')}
                    disabled={!settings.frameio.enabled}
                    loading={saving}
                  >
                    Test Connection
                  </Button>
                  <Button
                    onClick={() => saveSettings('frameio')}
                    loading={saving}
                  >
                    Save Frame.io Settings
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Paper>
          
          <Paper withBorder p="xl" radius="md" mb="xl">
            <LoadingOverlay visible={saving} />
            <Title order={3} mb="md">Cloudflare R2 Settings</Title>
            <Stack>
              <Switch
                label="Enable Cloudflare R2 Integration"
                checked={settings.r2.enabled}
                onChange={(e) => updateSetting('r2', 'enabled', e.currentTarget.checked)}
              />
              
              {settings.r2.enabled && (
                <>
                  <TextInput
                    label="Account ID"
                    placeholder="Your Cloudflare Account ID"
                    value={settings.r2.accountId}
                    onChange={(e) => updateSetting('r2', 'accountId', e.currentTarget.value)}
                    required
                  />
                  <TextInput
                    label="Access Key ID"
                    placeholder="Your R2 Access Key ID"
                    value={settings.r2.accessKeyId}
                    onChange={(e) => updateSetting('r2', 'accessKeyId', e.currentTarget.value)}
                    required
                  />
                  <PasswordInput
                    label="Secret Access Key"
                    placeholder="Your R2 Secret Access Key"
                    value={settings.r2.secretAccessKey}
                    onChange={(e) => updateSetting('r2', 'secretAccessKey', e.currentTarget.value)}
                    required
                  />
                  <TextInput
                    label="Bucket Name"
                    placeholder="Your R2 Bucket Name"
                    value={settings.r2.bucket}
                    onChange={(e) => updateSetting('r2', 'bucket', e.currentTarget.value)}
                    required
                  />
                  <TextInput
                    label="Public Domain (Optional)"
                    placeholder="your-bucket.yourdomain.com"
                    description="If you've set up a custom domain for your R2 bucket, enter it here"
                    value={settings.r2.publicDomain}
                    onChange={(e) => updateSetting('r2', 'publicDomain', e.currentTarget.value)}
                  />
                </>
              )}
              
              <Group justify="flex-end" mt="md">
                <Button
                  variant="outline"
                  onClick={() => testConnection('r2')}
                  disabled={!settings.r2.enabled}
                  loading={saving}
                >
                  Test Connection
                </Button>
                <Button
                  onClick={() => saveSettings('r2')}
                  loading={saving}
                >
                  Save R2 Settings
                </Button>
              </Group>
            </Stack>
          </Paper>
          
          <Paper withBorder p="xl" radius="md" mb="xl">
            <LoadingOverlay visible={saving} />
            <Title order={3} mb="md">Wasabi Settings</Title>
            <Stack>
              <Switch
                label="Enable Wasabi Integration"
                checked={settings.wasabi.enabled}
                onChange={(e) => updateSetting('wasabi', 'enabled', e.currentTarget.checked)}
              />
              
              {settings.wasabi.enabled && (
                <>
                  <TextInput
                    label="Endpoint"
                    placeholder="https://s3.wasabisys.com"
                    value={settings.wasabi.endpoint}
                    onChange={(e) => updateSetting('wasabi', 'endpoint', e.currentTarget.value)}
                    required
                  />
                  <TextInput
                    label="Region"
                    placeholder="us-east-1"
                    value={settings.wasabi.region}
                    onChange={(e) => updateSetting('wasabi', 'region', e.currentTarget.value)}
                    required
                  />
                  <TextInput
                    label="Access Key ID"
                    placeholder="Your Wasabi Access Key ID"
                    value={settings.wasabi.accessKeyId}
                    onChange={(e) => updateSetting('wasabi', 'accessKeyId', e.currentTarget.value)}
                    required
                  />
                  <PasswordInput
                    label="Secret Access Key"
                    placeholder="Your Wasabi Secret Access Key"
                    value={settings.wasabi.secretAccessKey}
                    onChange={(e) => updateSetting('wasabi', 'secretAccessKey', e.currentTarget.value)}
                    required
                  />
                  <TextInput
                    label="Bucket Name"
                    placeholder="Your Wasabi Bucket Name"
                    value={settings.wasabi.bucket}
                    onChange={(e) => updateSetting('wasabi', 'bucket', e.currentTarget.value)}
                    required
                  />
                </>
              )}
              
              <Group justify="flex-end" mt="md">
                <Button
                  variant="outline"
                  onClick={() => testConnection('wasabi')}
                  disabled={!settings.wasabi.enabled}
                  loading={saving}
                >
                  Test Connection
                </Button>
                <Button
                  onClick={() => saveSettings('wasabi')}
                  loading={saving}
                >
                  Save Wasabi Settings
                </Button>
              </Group>
            </Stack>
          </Paper>
          
          <Paper withBorder p="xl" radius="md">
            <LoadingOverlay visible={saving} />
            <Title order={3} mb="md">LucidLink Settings</Title>
            <Stack>
              <Switch
                label="Enable LucidLink Integration"
                checked={settings.lucidlink.enabled}
                onChange={(e) => updateSetting('lucidlink', 'enabled', e.currentTarget.checked)}
              />
              
              {settings.lucidlink.enabled && (
                <>
                  <TextInput
                    label="Base Path"
                    placeholder="/mnt/lucidlink/fast-uploads"
                    description="Base path to the LucidLink mounted filesystem"
                    value={settings.lucidlink.basePath}
                    onChange={(e) => updateSetting('lucidlink', 'basePath', e.currentTarget.value)}
                    required
                  />
                </>
              )}
              
              <Group justify="flex-end" mt="md">
                <Button
                  variant="outline"
                  onClick={() => testConnection('lucidlink')}
                  disabled={!settings.lucidlink.enabled}
                  loading={saving}
                >
                  Test Connection
                </Button>
                <Button
                  onClick={() => saveSettings('lucidlink')}
                  loading={saving}
                >
                  Save LucidLink Settings
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="email">
          <Paper withBorder p="xl" radius="md">
            <LoadingOverlay visible={saving} />
            <Title order={3} mb="md">Email Settings</Title>
            <Stack>
              <TextInput
                label="Email Provider"
                value="SendGrid"
                disabled
                description="Currently, only SendGrid is supported for email notifications"
              />
              
              <Divider my="sm" />
              
              <PasswordInput
                label="SendGrid API Key"
                placeholder="Your SendGrid API Key"
                value={settings.email.apiKey}
                onChange={(e) => updateSetting('email', 'apiKey', e.currentTarget.value)}
                required
              />
              
              <TextInput
                label="Sender Email"
                placeholder="notifications@yourdomain.com"
                description="Email address used to send notifications"
                value={settings.email.senderEmail}
                onChange={(e) => updateSetting('email', 'senderEmail', e.currentTarget.value)}
                required
              />
              
              <TextInput
                label="Admin Emails"
                placeholder="admin1@example.com, admin2@example.com"
                description="Comma-separated list of email addresses to receive admin notifications"
                value={settings.email.adminEmails}
                onChange={(e) => updateSetting('email', 'adminEmails', e.currentTarget.value)}
                required
              />
              
              <Group justify="flex-end" mt="md">
                <Button
                  variant="outline"
                  onClick={() => testConnection('email')}
                  loading={saving}
                >
                  Test Email
                </Button>
                <Button
                  onClick={() => saveSettings('email')}
                  loading={saving}
                >
                  Save Email Settings
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="database">
          <Paper withBorder p="xl" radius="md">
            <LoadingOverlay visible={saving} />
            <Title order={3} mb="md">Database Settings</Title>
            <Stack>
              <Alert color="yellow" title="Caution" icon={<IconAlertCircle />} mb="md">
                Changing the database connection URI will require a server restart to take effect.
                Make sure your new database is properly set up before making changes.
              </Alert>
              
              <TextInput
                label="MongoDB Connection URI"
                placeholder="mongodb://username:password@hostname:port/database"
                value={settings.database.uri}
                onChange={(e) => updateSetting('database', 'uri', e.currentTarget.value)}
                required
              />
              
              <Group justify="flex-end" mt="md">
                <Button
                  variant="outline"
                  onClick={() => testConnection('database')}
                  loading={saving}
                >
                  Test Connection
                </Button>
                <Button
                  onClick={() => saveSettings('database')}
                  loading={saving}
                >
                  Save Database Settings
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="uploads">
          <Paper withBorder p="xl" radius="md">
            <LoadingOverlay visible={saving} />
            <Title order={3} mb="md">Upload Settings</Title>
            <Stack>
              <NumberInput
                label="Maximum File Size (MB)"
                description="Maximum allowed file size in megabytes"
                value={settings.uploads.maxFileSize / (1024 * 1024)}
                onChange={(value) => updateSetting('uploads', 'maxFileSize', value ? value * 1024 * 1024 : 0)}
                min={1}
                max={1024 * 1024} // 1TB
                required
              />
              
              <NumberInput
                label="Default Chunk Size (MB)"
                description="Size of chunks for multipart uploads"
                value={settings.uploads.defaultChunkSize / (1024 * 1024)}
                onChange={(value) => updateSetting('uploads', 'defaultChunkSize', value ? value * 1024 * 1024 : 0)}
                min={5}
                max={100}
                required
              />
              
              <NumberInput
                label="Maximum Concurrent Uploads"
                description="Maximum number of uploads that can run in parallel"
                value={settings.uploads.maxConcurrentUploads}
                onChange={(value) => updateSetting('uploads', 'maxConcurrentUploads', value || 0)}
                min={1}
                max={20}
                required
              />
              
              <Group justify="flex-end" mt="md">
                <Button
                  onClick={() => saveSettings('uploads')}
                  loading={saving}
                >
                  Save Upload Settings
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
