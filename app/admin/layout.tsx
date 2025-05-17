'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  AppShell, 
  Burger, 
  Group, 
  Text, 
  NavLink, 
  LoadingOverlay, 
  Container, 
  Center,
  Button
} from '@mantine/core';
import { 
  IconGauge,
  IconLink,
  IconFileAnalytics,
  IconSettings,
  IconLogout,
  IconLock,
  IconDatabase,
  IconFolders
} from '@tabler/icons-react';
import Link from 'next/link';
import { notifications } from '@mantine/notifications';

// In a real app, you'd decode the token to get expiry and user roles
// For now, a simple presence check is used.
const isAuthenticated = (): boolean => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin-token');
    return !!token; // Basic check: token exists
  }
  return false;
};

// This is a placeholder. In a real app, decode JWT to get user details.
const getAdminUserFromToken = (): { email: string; role: string } | null => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin-token');
    if (token) {
      try {
        // Attempt to decode (very basic, not verifying signature here for simplicity)
        const payload = JSON.parse(atob(token.split('.')[1]));
        return { email: payload.email, role: payload.role };
      } catch (e) {
        console.error('Failed to decode token:', e);
        localStorage.removeItem('admin-token'); // Clear invalid token
        return null;
      }
    }
  }
  return null;
};

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [opened, setOpened] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      if (pathname !== '/admin/login') {
        router.replace('/admin/login');
      }
    } else {
      const user = getAdminUserFromToken();
      if (user) {
        setCurrentUser(user);
      } else {
        // Invalid or expired token scenario
        if (pathname !== '/admin/login') {
            router.replace('/admin/login');
        }
      }
    }
    setAuthChecked(true);
  }, [router, pathname]);

  const handleLogout = () => {
    localStorage.removeItem('admin-token');
    notifications.show({
      title: 'Logged Out',
      message: 'You have been successfully logged out.',
      color: 'blue',
    });
    setCurrentUser(null); // Clear current user state
    router.push('/admin/login');
  };

  const navLinks = [
    { icon: IconGauge, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: IconLink, label: 'Upload Links', href: '/admin/links' },
    { icon: IconFileAnalytics, label: 'Uploaded Files', href: '/admin/files' },
    { icon: IconFolders, label: 'Projects', href: '/admin/projects' },
    { icon: IconDatabase, label: 'Storage Management', href: '/admin/storage' },
    { icon: IconSettings, label: 'Settings', href: '/admin/settings' },
  ];

  // If auth check is not complete, show loading or null to prevent flicker
  if (!authChecked) {
    return <LoadingOverlay visible={true} overlayProps={{blur: 2}} />;
  }

  // If not authenticated and not on login page, redirect happens in useEffect
  // This is a fallback to prevent rendering children if redirect is slow
  if (!currentUser && pathname !== '/admin/login') {
     return (
        <Container fluid h="100vh">
            <Center h="100%">
                <LoadingOverlay visible={true} overlayProps={{blur: 2}} />
            </Center>
        </Container>
     )
  }
  
  // Do not render AppShell for the login page itself
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !opened, desktop: false },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={() => setOpened(!opened)} hiddenFrom="sm" size="sm" />
            <IconLock size={28} />
            <Text fw={500} size="lg">Motion Mavericks - Admin</Text>
          </Group>
          {currentUser && (
             <Button onClick={handleLogout} variant="light" color="red" leftSection={<IconLogout size={14}/>}>
                Logout ({currentUser.email})
            </Button>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {navLinks.map((link) => (
          <NavLink
            key={link.label}
            component={Link}
            href={link.href}
            label={link.label}
            leftSection={<link.icon size="1rem" stroke={1.5} />}
            active={pathname === link.href}
            onClick={() => setOpened(false)} // Close burger on mobile nav click
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
