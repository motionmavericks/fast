// Utility functions for Frame.io V4 API integration

/**
 * Normalizes redirect URI for Frame.io OAuth flow
 * In development environment, handles both HTTP and HTTPS variants
 * In production, uses the configured NEXT_PUBLIC_APP_URL
 * 
 * @param requestUrl The current request URL (useful for detecting protocol)
 * @returns The normalized redirect URI
 */
export function getNormalizedRedirectUri(requestUrl?: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  let redirectUri = `${appUrl}/api/auth/frameio/callback`;
  
  // In development, handle both HTTP and HTTPS
  if (process.env.NODE_ENV === 'development') {
    // If the request is using HTTPS but we're configured for HTTP
    if (requestUrl && requestUrl.startsWith('https:') && redirectUri.startsWith('http:')) {
      console.log('Protocol mismatch detected, normalizing redirect URI');
      redirectUri = redirectUri.replace('http:', 'https:');
    }
  }
  
  return redirectUri;
}

/**
 * Logs OAuth debugging information to help troubleshoot connection issues
 */
export function logOAuthDebugInfo(info: {
  step: string;
  redirectUri?: string;
  clientId?: string;
  error?: string;
  requestUrl?: string;
  state?: string;
}) {
  console.log(`[Frame.io OAuth Debug] Step: ${info.step}`);
  
  if (info.redirectUri) {
    console.log(`[Frame.io OAuth Debug] Redirect URI: ${info.redirectUri}`);
  }
  
  if (info.clientId) {
    console.log(`[Frame.io OAuth Debug] Client ID: ${info.clientId.substring(0, 5)}...`);
  }
  
  if (info.requestUrl) {
    console.log(`[Frame.io OAuth Debug] Request URL: ${info.requestUrl}`);
  }
  
  if (info.state) {
    console.log(`[Frame.io OAuth Debug] State: ${info.state}`);
  }
  
  if (info.error) {
    console.error(`[Frame.io OAuth Debug] Error: ${info.error}`);
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[Frame.io OAuth Debug] Running in development mode');
  }
}

/**
 * Checks if we have a valid Frame.io V4 API configuration
 */
export function hasValidFrameIoConfig(): boolean {
  return !!(
    process.env.FRAMEIO_CLIENT_ID &&
    process.env.FRAMEIO_CLIENT_SECRET &&
    process.env.NEXT_PUBLIC_APP_URL
  );
} 