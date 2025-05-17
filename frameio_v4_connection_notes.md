# Frame.io V4 Connection Analysis

## Current Status

1. **Service Initialization**: 
   - The application successfully initializes services (returns `true`)
   - However, the underlying Frame.io connection is not established

2. **Authentication Flow**:
   - OAuth flow is set up correctly for Frame.io V4 API via Adobe IMS
   - Routes exist for login (`/api/auth/frameio/login`) and callback (`/api/auth/frameio/callback`)
   - No token is currently stored in cookies, causing 401 errors
   - **State validation issue fixed** - Updated cookie settings for local development

3. **API Endpoints**:
   - All test endpoints (`/api/admin/settings/test/frameio`) are V4-compatible
   - Status endpoint (`/api/status/frameio`) correctly reports "not_connected" status

4. **Framework Issues**:
   - The `utils/projectManager.ts` file has a reference to `lucidlink.createCustomFolder = createCustomFolder` which is causing errors (line 190)
   - Fixed the import issue in `app/api/links/route.ts` to properly import `User` from models

## Required Fixes

1. **Authentication Flow Updates**:
   - ✅ Fixed OAuth scopes to use correct Frame.io V4 scopes
   - ✅ Enhanced state validation in OAuth flow
   - ✅ Improved cookie settings for local development
   - ✅ Added detailed debugging for OAuth flow

2. **Project Manager Fix**:
   - Remove line 190 in `utils/projectManager.ts` that tries to assign the createCustomFolder function

3. **Authentication**:
   - Complete the OAuth flow by visiting: `http://localhost:3000/api/auth/frameio/login`
   - Alternatively, set up a Frame.io API token directly in cookies for testing

4. **V4 API Testing**:
   - Once authenticated, verify all V4 API endpoints function correctly

## OAuth Flow Troubleshooting

1. **State Validation Issues**:
   - Enhanced cookie settings to make them more reliable:
     - Set `secure: false` for local development
     - Set `sameSite: 'lax'` to allow cross-site requests
     - Increased cookie timeout to 10 minutes
   - Added detailed logging of state parameters
   - Improved error handling for missing cookies

2. **Scope Issues**:
   - Updated scope parameter to use Adobe-specific formats
   - Now using: `openid,AdobeID,read_organizations,read_projects,read_teams,read_users,write_assets,write_comments`

## Migration Verification Plan

1. **Authentication Testing**:
   - Test successful login through OAuth flow
   - Verify token storage in cookies
   - Test refresh token functionality

2. **API Function Testing**:
   - Test workspace listing (V4 equivalent of teams)
   - Test project creation
   - Test folder creation
   - Test asset creation and upload link generation

3. **Integration Testing**:
   - Test complete upload workflow
   - Test proxy generation and retrieval
   - Test review link generation

## Configuration Check

The existing Frame.io configuration in `.env.local` looks correct:

```
FRAMEIO_TOKEN=fio-u-Q6HZIesCNplp7MQlNx1IMpoLPTWDPK7z9LDqDzMatT66cRRdbiZXUTbvEJBOg0h_
FRAMEIO_TEAM_ID=7d26ab6d-b39e-4a99-a4b9-9cdcf6208009
FRAMEIO_ROOT_PROJECT_ID=7d26ab6d-b39e-4a99-a4b9-9cdcf6208009
FRAMEIO_CLIENT_ID=56d1993cc6c6442dada0ae2adb3cb9d9
FRAMEIO_CLIENT_SECRET=p8e-ot12D3JG_vcO7hy4j46bxmXjHxkyBYpw
```

But the OAuth redirect URI should be updated (it currently has https instead of http):

```
FRAMEIO_REDIRECT_URI=https://localhost:3000/api/auth/frameio/callback
```

Should be:

```
FRAMEIO_REDIRECT_URI=http://localhost:3000/api/auth/frameio/callback
```

## Next Steps

1. Try the OAuth flow again with the new fixes
2. Check detailed logs for any remaining issues
3. Verify token storage in cookies
4. Test API endpoints once authenticated
5. Update documentation with new V4 configuration requirements 