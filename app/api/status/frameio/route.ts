// app/api/status/frameio/route.ts - Check Frame.io integration status

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isInitialized } from '@/utils/serviceInitializer';

export async function GET(request: NextRequest) {
  try {
    if (!isInitialized()) {
      return NextResponse.json(
        { status: 'not_initialized', message: 'Services not initialized yet' },
        { status: 503 }
      );
    }

    // Check if we have an OAuth token in the cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('frameio_access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json({
        status: 'not_connected',
        message: 'Not connected to Frame.io. Please authenticate via OAuth.',
        config: {
          hasClientId: !!process.env.FRAMEIO_CLIENT_ID,
          hasClientSecret: !!process.env.FRAMEIO_CLIENT_SECRET,
          redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/frameio/callback`,
        }
      });
    }
    
    // Try to get user info from Frame.io V4 API to check if token is valid
    const userResponse = await fetch('https://api.frame.io/v4/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Api-Version': '4',
      },
    });
    
    if (!userResponse.ok) {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to connect to Frame.io V4 API. Token may be invalid or expired.',
        error: await userResponse.text(),
      }, { status: 401 });
    }
    
    const userData = await userResponse.json();
    
    return NextResponse.json({
      status: 'connected',
      message: 'Frame.io V4 API integration is active',
      userData: userData.data,
      config: {
        hasClientId: !!process.env.FRAMEIO_CLIENT_ID,
        hasClientSecret: !!process.env.FRAMEIO_CLIENT_SECRET,
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/frameio/callback`,
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        status: 'error',
        message: error.message || 'An error occurred checking Frame.io status',
      },
      { status: 500 }
    );
  }
} 