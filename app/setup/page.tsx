'use client';

import { useState, useEffect } from 'react';
import { 
  Stepper, 
  Button, 
  Group, 
  Container, 
  Title, 
  Paper, 
  LoadingOverlay, 
  Alert,
  Text
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';

// Import setup step components (to be created)
import AdminUserStep from '@/components/setup/AdminUserStep';
import DatabaseStep from '@/components/setup/DatabaseStep';
import StorageStep from '@/components/setup/StorageStep';
import EmailStep from '@/components/setup/EmailStep';
import FinalStep from '@/components/setup/FinalStep';

// Define interfaces for step props if needed, e.g.:
// interface StepProps { onStepComplete: (data: any) => void; }

export default function SetupPage() {
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    adminUser: {},
    database: {},
    storage: {},
    email: {},
  });

  useEffect(() => {
    // Check setup status on load
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/setup/status');
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Failed to fetch setup status');
        }
        const data = await res.json();
        if (data.isSetupComplete) {
          setSetupComplete(true);
          // Optionally redirect to login or dashboard if already setup
          // router.push('/admin/login');
        }
      } catch (err: any) {
        setError(err.message);
        notifications.show({
          title: 'Error checking setup status',
          message: err.message,
          color: 'red',
          icon: <IconAlertCircle />,
        });
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  const handleStepComplete = (stepIndex: number, data: any) => {
    setFormData((prev) => {
      if (stepIndex === 0) return { ...prev, adminUser: data };
      if (stepIndex === 1) return { ...prev, database: data };
      if (stepIndex === 2) return { ...prev, storage: data };
      if (stepIndex === 3) return { ...prev, email: data };
      return prev;
    });
    nextStep();
  };

  const nextStep = () => setActive((current) => (current < 5 ? current + 1 : current));
  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current));

  if (loading) {
    return <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2 }} />;
  }

  if (setupComplete) {
    return (
      <Container size="sm" mt="xl">
        <Paper p="lg" shadow="xs" withBorder>
          <Title order={2} ta="center" mb="lg">
            Application Already Configured
          </Title>
          <Text ta="center">
            Motion Mavericks Fast has already been set up. You can proceed to the admin login.
          </Text>
          <Group justify="center" mt="xl">
            <Button component="a" href="/admin/login">
              Go to Admin Login
            </Button>
          </Group>
        </Paper>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="sm" mt="xl">
        <Alert icon={<IconAlertCircle size="1rem" />} title="Setup Error!" color="red">
          {error} Please check the console and ensure the backend is running correctly.
        </Alert>
      </Container>
    );
  }

  const steps = [
    { label: 'Admin User', description: 'Create super admin', component: AdminUserStep },
    { label: 'Database', description: 'MongoDB connection', component: DatabaseStep },
    { label: 'Storage', description: 'Wasabi bucket setup', component: StorageStep },
    { label: 'Email Service', description: 'Notification setup', component: EmailStep },
    { label: 'Finish', description: 'Confirm & complete', component: FinalStep },
  ];

  const ActiveStepComponent = steps[active]?.component;

  return (
    <Container size="md" py="xl">
      <Title order={1} ta="center" mb="xl">
        Motion Mavericks Fast - Initial Setup
      </Title>
      <Paper p="xl" shadow="sm" withBorder>
        <Stepper active={active} onStepClick={setActive} breakpoint="sm">
          {steps.map((step, index) => (
            <Stepper.Step key={step.label} label={step.label} description={step.description} />
          ))}
        </Stepper>

        <Container mt="xl" p={0}>
          {ActiveStepComponent && (
            <ActiveStepComponent 
              formData={formData} 
              onStepComplete={(data: any) => handleStepComplete(active, data)} 
              prevStep={prevStep} 
            />
          )}
        </Container>
      </Paper>
    </Container>
  );
}
