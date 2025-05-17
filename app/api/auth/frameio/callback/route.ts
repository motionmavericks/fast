import { NextRequest, NextResponse } from 'next/server';
import { getNormalizedRedirectUri, logOAuthDebugInfo } from '@/utils/frameioUtils';

// This route handles OAuth callbacks from Frame.io's V4 API via Adobe Developer Console
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    // Get the stored state from cookies
    const storedState = request.cookies.get('frameio_oauth_state')?.value;
    
    logOAuthDebugInfo({
      step: 'Received callback',
      requestUrl: request.url,
      state: state || 'none',
    });
    
    // Add detailed state debugging
    console.log(`Received state: ${state || 'none'}`);
    console.log(`Stored state: ${storedState || 'none'}`);
    
    // Check for error response from Adobe IMS
    if (error) {
      logOAuthDebugInfo({
        step: 'Authentication error',
        error: `${error}: ${errorDescription || 'No description provided'}`,
      });
      return NextResponse.redirect(
        new URL(`/admin/settings?error=${error}&error_description=${encodeURIComponent(errorDescription || '')}`, request.url)
      );
    }
    
    // More graceful state validation
    if (!storedState) {
      logOAuthDebugInfo({
        step: 'State validation failed',
        error: 'No stored state found in cookies',
      });
      console.error('No state cookie found during OAuth callback');
      return NextResponse.redirect(new URL('/admin/settings?error=missing_state_cookie', request.url));
    }
    
    if (state !== storedState) {
      logOAuthDebugInfo({
        step: 'State validation failed',
        error: `State mismatch: received ${state}, expected ${storedState}`,
      });
      console.error(`State mismatch during OAuth callback: expected ${storedState}, got ${state}`);
      return NextResponse.redirect(new URL('/admin/settings?error=invalid_state', request.url));
    }
    
    if (!code) {
      logOAuthDebugInfo({
        step: 'Code validation failed',
        error: 'Missing code parameter',
      });
      return NextResponse.redirect(new URL('/admin/settings?error=missing_code', request.url));
    }
    
    // Get the redirect URI with proper protocol handling
    const redirectUri = getNormalizedRedirectUri(request.url);
    
    logOAuthDebugInfo({
      step: 'Exchanging code for token',
      redirectUri,
      clientId: process.env.FRAMEIO_CLIENT_ID,
    });
    
    // Exchange the authorization code for an access token
    const tokenResponse = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.FRAMEIO_CLIENT_ID || '',
        client_secret: process.env.FRAMEIO_CLIENT_SECRET || '',
        code,
        redirect_uri: redirectUri,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logOAuthDebugInfo({
        step: 'Token exchange failed',
        error: errorText,
      });
      console.error('Error exchanging code for token:', errorText);
      return NextResponse.redirect(new URL(`/admin/settings?error=token_exchange&details=${encodeURIComponent(errorText)}`, request.url));
    }
    
    const tokenData = await tokenResponse.json();
    
    logOAuthDebugInfo({
      step: 'Token received successfully',
    });
    
    // Save access_token, refresh_token, and expiration
    const { access_token, refresh_token, expires_in } = tokenData;
    
    // Store tokens in secure HTTP-only cookies
    const response = NextResponse.redirect(new URL('/admin/settings?success=true', request.url));
    
    // Set cookies with access token and refresh token
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
    
    // Also set a cookie indicating successful authentication
    response.cookies.set({
      name: 'frameio_authenticated',
      value: 'true',
      maxAge: expires_in,
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Error in Frame.io OAuth callback:', error);
    return NextResponse.redirect(new URL('/admin/settings?error=server_error', request.url));
  }
} 