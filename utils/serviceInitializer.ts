// utils/serviceInitializer.ts - Initialize services at startup

import * as integrationService from './integrationService';

// Flag to track initialization status
let initialized = false;

/**
 * Initialize all services
 * Call this at application startup
 */
export async function initializeServices(): Promise<void> {
  if (initialized) {
    return;
  }
  
  try {
    console.log('Initializing services...');
    
    // Initialize Frame.io integration with token-based approach
    await integrationService.initializeFrameIo();
    
    // Set initialization flag
    initialized = true;
    console.log('Services initialized successfully');
  } catch (error) {
    console.error('Error initializing services:', error);
    // Don't throw here to avoid breaking app startup
    // We'll handle errors when specific services are used
  }
}

/**
 * Check if services are initialized
 */
export function isInitialized(): boolean {
  return initialized;
} 