'use client';

import { useState, useEffect } from 'react';
import { Paper, Title, Text, Group, Badge, Stack, Progress, Button, Tooltip, Skeleton } from '@mantine/core';
import { IconRefresh, IconServer, IconCloud, IconMailbox, IconDatabase, IconAlertTriangle } from '@tabler/icons-react';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  latency?: number;
  message?: string;
  lastChecked: Date;
}

interface SystemStatusProps {
  refreshInterval?: number; // in milliseconds, default is 5 minutes
}

export default function SystemStatus({ refreshInterval = 5 * 60 * 1000 }: SystemStatusProps) {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const fetchServiceStatus = async () => {
    try {
      setRefreshing(true);
      
      const response = await fetch('/api/admin/status');
      
      if (!response.ok) {
        throw new Error('Failed to fetch service status');
      }
      
      const data = await response.json();
      setServices(data.services);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching service status:', error);
      // If we can't fetch status, set default services to unknown
      setServices([
        { name: 'Database', status: 'unknown', lastChecked: new Date() },
        { name: 'Frame.io', status: 'unknown', lastChecked: new Date() },
        { name: 'Cloudflare R2', status: 'unknown', lastChecked: new Date() },
        { name: 'LucidLink', status: 'unknown', lastChecked: new Date() },
        { name: 'Email', status: 'unknown', lastChecked: new Date() },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchServiceStatus();
    
    const interval = setInterval(fetchServiceStatus, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval]);
  
  // Calculate overall system health
  const calculateHealth = (): { percentage: number; status: 'good' | 'warning' | 'critical' } => {
    if (services.length === 0) {
      return { percentage: 0, status: 'critical' };
    }
    
    // Assign values to statuses
    const statusValues = {
      'operational': 100,
      'degraded': 50,
      'down': 0,
      'unknown': 0
    };
    
    // Calculate average
    const total = services.reduce((sum, service) => sum + statusValues[service.status], 0);
    const percentage = Math.round(total / services.length);
    
    // Determine overall status
    let status: 'good' | 'warning' | 'critical';
    if (percentage >= 90) {
      status = 'good';
    } else if (percentage >= 60) {
      status = 'warning';
    } else {
      status = 'critical';
    }
    
    return { percentage, status };
  };
  
  const health = calculateHealth();
  
  // Get color for health status
  const getHealthColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return 'green';
      case 'warning': return 'yellow';
      case 'critical': return 'red';
    }
  };
  
  // Get icon for service name
  const getServiceIcon = (serviceName: string) => {
    switch (serviceName.toLowerCase()) {
      case 'database': return <IconDatabase size={20} />;
      case 'frame.io': return <IconCloud size={20} />;
      case 'cloudflare r2': return <IconCloud size={20} />;
      case 'lucidlink': return <IconServer size={20} />;
      case 'email': return <IconMailbox size={20} />;
      default: return <IconServer size={20} />;
    }
  };
  
  // Get color and text for service status
  const getStatusInfo = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational':
        return { color: 'green', text: 'Operational' };
      case 'degraded':
        return { color: 'yellow', text: 'Degraded' };
      case 'down':
        return { color: 'red', text: 'Down' };
      case 'unknown':
      default:
        return { color: 'gray', text: 'Unknown' };
    }
  };
  
  if (loading) {
    return (
      <Paper withBorder p="md" radius="md">
        <Group position="apart" mb="md">
          <Title order={3}>System Status</Title>
        </Group>
        <Skeleton height={30} radius="sm" mb="lg" />
        <Stack spacing="xs">
          <Skeleton height={50} radius="sm" />
          <Skeleton height={50} radius="sm" />
          <Skeleton height={50} radius="sm" />
          <Skeleton height={50} radius="sm" />
        </Stack>
      </Paper>
    );
  }
  
  return (
    <Paper withBorder p="md" radius="md">
      <Group position="apart" mb="md">
        <Title order={3}>System Status</Title>
        <Button 
          variant="light" 
          leftSection={<IconRefresh size={16} />}
          onClick={fetchServiceStatus}
          loading={refreshing}
          size="xs"
        >
          Refresh
        </Button>
      </Group>
      
      <Paper withBorder p="md" radius="md" mb="lg">
        <Text fw={500} mb={5}>Overall System Health</Text>
        <Progress 
          value={health.percentage} 
          color={getHealthColor(health.status)}
          size="lg"
          radius="xl"
          striped={health.status === 'warning'}
          animated={health.status === 'warning'}
        />
        <Group position="apart" mt={5}>
          <Badge color={getHealthColor(health.status)} size="lg">
            {health.status === 'good' ? 'All Systems Operational' 
              : health.status === 'warning' ? 'Some Systems Degraded' 
              : 'Critical System Issues'}
          </Badge>
          {lastUpdated && (
            <Text size="xs" c="dimmed">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Text>
          )}
        </Group>
      </Paper>
      
      <Stack spacing="xs">
        {services.map((service, index) => {
          const statusInfo = getStatusInfo(service.status);
          
          return (
            <Paper key={index} withBorder p="md" radius="md">
              <Group position="apart">
                <Group>
                  {getServiceIcon(service.name)}
                  <Text fw={500}>{service.name}</Text>
                </Group>
                
                <Group>
                  {service.latency !== undefined && (
                    <Text size="sm" c="dimmed">{service.latency}ms</Text>
                  )}
                  
                  <Badge color={statusInfo.color}>
                    {statusInfo.text}
                  </Badge>
                </Group>
              </Group>
              
              {service.message && (
                <Text size="sm" mt={5} c={service.status === 'down' ? 'red' : 'dimmed'}>
                  {service.status === 'down' && <IconAlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 5 }} />}
                  {service.message}
                </Text>
              )}
            </Paper>
          );
        })}
      </Stack>
    </Paper>
  );
}
