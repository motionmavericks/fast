'use client';

import { useState, useEffect } from 'react';
import { Paper, Title, Text, Group, RingProgress, Button, Grid, Skeleton, Stack, Badge, SegmentedControl, Select } from '@mantine/core';
import { IconRefresh, IconCloudDownload, IconServer, IconCloud, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface StorageData {
  totalBytes: number;
  storageByTier: {
    frameio: number;
    r2: number;
    lucidlink: number;
  };
  storageByClient: {
    clientName: string;
    bytes: number;
  }[];
  storageByProject: {
    projectName: string;
    clientName: string;
    bytes: number;
  }[];
  fileTypesDistribution: {
    type: string;
    count: number;
    bytes: number;
  }[];
  storageHistory: {
    date: string;
    frameio: number;
    r2: number;
    lucidlink: number;
  }[];
}

// Format bytes to human-readable file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28EFF', '#FF6B6B'];

export default function StorageManager() {
  const [storageData, setStorageData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState('7d');
  const [chartView, setChartView] = useState('clients');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  useEffect(() => {
    fetchStorageData();
  }, [timePeriod]);

  const fetchStorageData = async () => {
    try {
      setLoading(true);
      let url = `/api/admin/storage?period=${timePeriod}`;
      
      if (selectedClient && chartView === 'projects') {
        url += `&client=${encodeURIComponent(selectedClient)}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch storage data');
      }
      
      const data = await response.json();
      setStorageData(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching storage data:', err);
      setError(err.message || 'Failed to load storage data');
    } finally {
      setLoading(false);
    }
  };

  // Filter projects by selected client
  const getFilteredProjects = () => {
    if (!storageData || !selectedClient) return [];
    
    return storageData.storageByProject.filter(
      project => project.clientName === selectedClient
    );
  };

  // Get available clients for dropdown
  const getClientOptions = () => {
    if (!storageData) return [];
    
    return storageData.storageByClient.map(client => ({
      value: client.clientName,
      label: client.clientName
    }));
  };

  if (loading) {
    return (
      <Paper withBorder p="lg" radius="md">
        <Group position="apart" mb="lg">
          <Title order={3}>Storage Management</Title>
          <Button variant="light" leftSection={<IconRefresh size={16} />} loading>Refreshing...</Button>
        </Group>
        
        <Grid>
          <Grid.Col xs={12} md={6}>
            <Skeleton height={300} radius="md" mb="md" />
          </Grid.Col>
          <Grid.Col xs={12} md={6}>
            <Skeleton height={300} radius="md" mb="md" />
          </Grid.Col>
          <Grid.Col span={12}>
            <Skeleton height={350} radius="md" />
          </Grid.Col>
        </Grid>
      </Paper>
    );
  }

  if (error || !storageData) {
    return (
      <Paper withBorder p="lg" radius="md">
        <Group position="apart" mb="md">
          <Title order={3}>Storage Management</Title>
          <Button 
            variant="light" 
            leftSection={<IconRefresh size={16} />}
            onClick={fetchStorageData}
          >
            Retry
          </Button>
        </Group>
        <Text color="red">{error || 'Failed to load storage data'}</Text>
      </Paper>
    );
  }

  // Calculate the storage distribution percentages
  const totalStorage = storageData.totalBytes;
  const frameioPercentage = (storageData.storageByTier.frameio / totalStorage) * 100;
  const r2Percentage = (storageData.storageByTier.r2 / totalStorage) * 100;
  const lucidlinkPercentage = (storageData.storageByTier.lucidlink / totalStorage) * 100;

  // Prepare data for the storage tiers pie chart
  const tierPieData = [
    { name: 'Frame.io', value: storageData.storageByTier.frameio },
    { name: 'Cloudflare R2', value: storageData.storageByTier.r2 },
    { name: 'LucidLink', value: storageData.storageByTier.lucidlink },
  ];

  // Determine which data to display based on chartView
  const getChartData = () => {
    switch (chartView) {
      case 'clients':
        return storageData.storageByClient;
      case 'projects':
        return selectedClient ? getFilteredProjects() : storageData.storageByProject;
      case 'filetypes':
        return storageData.fileTypesDistribution;
      default:
        return storageData.storageByClient;
    }
  };

  const chartData = getChartData();

  return (
    <Paper withBorder p="lg" radius="md">
      <Group position="apart" mb="md">
        <Title order={3}>Storage Management</Title>
        <Group>
          <SegmentedControl
            value={timePeriod}
            onChange={setTimePeriod}
            data={[
              { label: '7 Days', value: '7d' },
              { label: '30 Days', value: '30d' },
              { label: '90 Days', value: '90d' },
              { label: 'All Time', value: 'all' },
            ]}
            size="xs"
          />
          <Button 
            variant="light" 
            leftSection={<IconRefresh size={16} />}
            onClick={fetchStorageData}
          >
            Refresh
          </Button>
        </Group>
      </Group>
      
      <Grid mb="lg">
        <Grid.Col span={12} md={4}>
          <Paper withBorder p="md" radius="md">
            <Group position="apart" mb="xs">
              <Text size="lg" fw={700}>Total Storage</Text>
              <Badge size="lg" radius="sm">
                {formatFileSize(storageData.totalBytes)}
              </Badge>
            </Group>
            <Group position="center" py="md">
              <RingProgress
                size={180}
                thickness={20}
                roundCaps
                sections={[
                  { value: frameioPercentage, color: 'blue' },
                  { value: r2Percentage, color: 'teal' },
                  { value: lucidlinkPercentage, color: 'yellow' },
                ]}
                label={
                  <Stack align="center" spacing={0}>
                    <Text fw={700} size="xl">{formatFileSize(totalStorage)}</Text>
                    <Text size="xs" c="dimmed">Total</Text>
                  </Stack>
                }
              />
            </Group>
            <Stack mt="md" spacing="xs">
              <Group position="apart">
                <Group>
                  <div style={{ width: 12, height: 12, backgroundColor: 'blue', borderRadius: '50%' }} />
                  <Text size="sm">Frame.io</Text>
                </Group>
                <Text size="sm" fw={500}>{formatFileSize(storageData.storageByTier.frameio)}</Text>
              </Group>
              <Group position="apart">
                <Group>
                  <div style={{ width: 12, height: 12, backgroundColor: 'teal', borderRadius: '50%' }} />
                  <Text size="sm">Cloudflare R2</Text>
                </Group>
                <Text size="sm" fw={500}>{formatFileSize(storageData.storageByTier.r2)}</Text>
              </Group>
              <Group position="apart">
                <Group>
                  <div style={{ width: 12, height: 12, backgroundColor: 'yellow', borderRadius: '50%' }} />
                  <Text size="sm">LucidLink</Text>
                </Group>
                <Text size="sm" fw={500}>{formatFileSize(storageData.storageByTier.lucidlink)}</Text>
              </Group>
            </Stack>
          </Paper>
        </Grid.Col>
        
        <Grid.Col span={12} md={8}>
          <Paper withBorder p="md" radius="md" style={{ height: '100%' }}>
            <Title order={4} mb="md">Storage History</Title>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={storageData.storageHistory}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => formatFileSize(value)} />
                <Tooltip formatter={(value: any) => formatFileSize(value as number)} />
                <Legend />
                <Bar dataKey="frameio" name="Frame.io" fill="#1971c2" />
                <Bar dataKey="r2" name="Cloudflare R2" fill="#0ca678" />
                <Bar dataKey="lucidlink" name="LucidLink" fill="#f59f00" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid.Col>
      </Grid>
      
      <Paper withBorder p="md" radius="md">
        <Group position="apart" mb="md">
          <Title order={4}>Storage Distribution</Title>
          <Group>
            <SegmentedControl
              value={chartView}
              onChange={setChartView}
              data={[
                { label: 'By Client', value: 'clients' },
                { label: 'By Project', value: 'projects' },
                { label: 'By File Type', value: 'filetypes' },
              ]}
              size="xs"
            />
            
            {chartView === 'projects' && (
              <Select
                placeholder="Select Client"
                value={selectedClient}
                onChange={setSelectedClient}
                data={getClientOptions()}
                clearable
                size="xs"
                style={{ width: 200 }}
              />
            )}
          </Group>
        </Group>
        
        <Grid>
          <Grid.Col span={12} md={7}>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => formatFileSize(value)} />
                <YAxis 
                  type="category" 
                  dataKey={chartView === 'clients' ? 'clientName' : chartView === 'projects' ? 'projectName' : 'type'} 
                  width={150}
                />
                <Tooltip formatter={(value: any) => formatFileSize(value as number)} />
                <Legend />
                <Bar dataKey="bytes" name="Storage Used" fill="#4dabf7" />
              </BarChart>
            </ResponsiveContainer>
          </Grid.Col>
          
          <Grid.Col span={12} md={5}>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={chartData}
                  nameKey={chartView === 'clients' ? 'clientName' : chartView === 'projects' ? 'projectName' : 'type'}
                  dataKey="bytes"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatFileSize(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </Grid.Col>
        </Grid>
      </Paper>
    </Paper>
  );
}
