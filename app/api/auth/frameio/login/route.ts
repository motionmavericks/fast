import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getNormalizedRedirectUri, logOAuthDebugInfo } from '@/utils/frameioUtils';

// This route initiates the OAuth flow for Frame.io's V4 API
export async function GET(request: NextRequest) {
  try {
    // Generate a state parameter to prevent CSRF attacks
    const state = nanoid();
    
    // Get the redirect URI with proper protocol handling
    const redirectUri = getNormalizedRedirectUri(request.url);
    
    // Log debug info
    logOAuthDebugInfo({
      step: 'Initiating OAuth flow',
      redirectUri,
      clientId: process.env.FRAMEIO_CLIENT_ID,
      requestUrl: request.url,
      state: state,
    });
    
    // Build the authorization URL
    const authUrl = new URL('https://ims-na1.adobelogin.com/ims/authorize/v2');
    
    // Add query parameters for Adobe's OAuth
    authUrl.searchParams.append('client_id', process.env.FRAMEIO_CLIENT_ID || '');
    authUrl.searchParams.append('scope', 'openid,AdobeID,read_organizations,read_projects,read_teams,read_users,write_assets,write_comments');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    
    // Create a redirect response
    const response = NextResponse.redirect(authUrl.toString(), 307); // Use 307 for temporary redirect
    
    // Store state in cookie for validation in callback
    response.cookies.set({
      name: 'frameio_oauth_state',
      value: state,
      httpOnly: true,
      secure: false, // Set to false for local development to work over http
      sameSite: 'lax', // Allow the cookie to be sent with cross-site requests
      maxAge: 60 * 10, // 10 minutes instead of 5 to give more time
      path: '/',
    });
    
    // Add debugging to verify state is set
    console.log(`Setting state cookie: ${state}`);
    
    return response;
  } catch (error) {
    console.error('Error initiating Frame.io OAuth flow:', error);
    const origin = request.nextUrl.origin;
    return NextResponse.redirect(`${origin}/admin/settings?error=oauth_init_failed`);
  }
} 