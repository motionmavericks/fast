'use client';
// components/ServiceInitializer.tsx - Client component to initialize services

import { useEffect, useState } from 'react';

export default function ServiceInitializer() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initializeServices() {
      try {
        const response = await fetch('/api/init');
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
        } else {
          setInitialized(true);
        }
        console.log('Services initialization:', data);
      } catch (error) {
        console.error('Failed to initialize services:', error);
        setError('Failed to initialize services');
      }
    }

    initializeServices();
  }, []);

  // This component doesn't render anything visible
  return null;
} 