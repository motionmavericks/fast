import { NextRequest, NextResponse } from 'next/server';

// This route refreshes the OAuth access token for Frame.io's V4 API
export async function GET(request: NextRequest) {
  try {
    // Get the refresh token from cookies
    const refreshToken = request.cookies.get('frameio_refresh_token')?.value;
    
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token available' },
        { status: 401 }
      );
    }
    
    // Exchange the refresh token for a new access token
    const tokenResponse = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.FRAMEIO_CLIENT_ID || '',
        client_secret: process.env.FRAMEIO_CLIENT_SECRET || '',
        refresh_token: refreshToken,
      }),
    });
    
    if (!tokenResponse.ok) {
      console.error('Error refreshing token:', await tokenResponse.text());
      return NextResponse.json(
        { error: 'Failed to refresh token' },
        { status: 401 }
      );
    }
    
    const tokenData = await tokenResponse.json();
    
    // Get the new tokens
    const { access_token, refresh_token, expires_in } = tokenData;
    
    // Create a response with the updated tokens
    const response = NextResponse.json(
      { success: true, message: 'Token refreshed successfully' },
      { status: 200 }
    );
    
    // Update the cookies with new tokens
    response.cookies.set({
      name: 'frameio_access_token',
      value: access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: expires_in,
      path: '/',
    });
    
    if (refresh_token) {
      response.cookies.set({
        name: 'frameio_refresh_token',
        value: refresh_token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
    }
    
    return response;
  } catch (error) {
    console.error('Error refreshing Frame.io token:', error);
    return NextResponse.json(
      { error: 'Server error while refreshing token' },
      { status: 500 }
    );
  }
} 