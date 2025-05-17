// Import styles of packages that you've installed.
// All packages except `@mantine/hooks` require styles imports
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/carousel/styles.css';
import '@mantine/spotlight/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/nprogress/styles.css';
import './globals.css';

import { 
  ColorSchemeScript, 
  MantineProvider, 
  mantineHtmlProps, 
  createTheme 
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import ServiceInitializer from '@/components/ServiceInitializer';

export const metadata = {
  title: 'Motion Mavericks Fast',
  description: 'Secure, fast file uploads for video production workflows',
};

// Create a custom theme with dark mode
const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  colors: {
    // Add your color overrides here if needed
  },
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  primaryShade: 6,
  white: '#f8f9fa',
  black: '#141517'
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="dark">
          <Notifications />
          <ServiceInitializer />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}