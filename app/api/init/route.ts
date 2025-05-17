// app/api/init/route.ts - API route to initialize services

import { NextRequest, NextResponse } from 'next/server';
import { initializeServices, isInitialized } from '@/utils/serviceInitializer';

// Initialize services
let initPromise: Promise<void> | null = null;

export async function GET(request: NextRequest) {
  try {
    if (!initPromise) {
      // Start initialization if not already started
      initPromise = initializeServices();
    }
    
    // Wait for initialization to complete
    await initPromise;
    
    return NextResponse.json({
      initialized: isInitialized(),
      message: 'Services initialized successfully'
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: error.message || 'An error occurred during initialization',
        initialized: isInitialized()
      },
      { status: 500 }
    );
  }
} 