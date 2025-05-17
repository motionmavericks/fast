# Motion Mavericks Fast - Implementation Plan

## 1. Tech Stack
- **Framework**: Next.js 15+ (React with Mantine UI & @mantine/ui prebuilt components for frontend, API Routes for backend logic)
- **Database**: MongoDB with Mongoose ODM (for user accounts, file metadata, and link tracking)
- **Storage**: Wasabi Cloud Storage (via AWS S3 SDK)
- **Authentication**: JWT for admin authentication
- **Email Notifications**: SendGrid email service
- **File Uploads**: Resumable.js for chunked, reliable file transfers
- **Video Processing**: Cloudflare Worker + Digital Ocean GPU instances for transcoding

## 2. Core Features

### Admin Portal
- Login dashboard for administrators
- Create and manage upload links for clients
- Associate links with Client/Agency/Project
- View uploaded files with filter and search capability
- Download and delete files
- Configure service connections (DB, Storage, Email)

### Client Upload Interface
- Clean, modern interface with drag-and-drop functionality
- Progress indicators with real-time updates
- File type validation with clear error messages
- No login required (just unique link)
- Success confirmation with download option
- Resumable uploads for large files

### File Management
- Automatic file processing pipeline
- Email notifications to admin team and clients
- File log tracking and history
- Support for large file uploads (multi-part uploads)
- Secure file storage with access controls

### Video Processing
- Cloudflare Worker for orchestration
- Digital Ocean GPU instances for transcoding
- Multiple quality levels (360p, 540p, 720p, 1080p, 2160p)
- Adaptive streaming based on client connection
- R2 storage for edge-optimized delivery
- Intelligent lifecycle management for storage optimization

## 3. Development Phases

### Phase 1: Setup & Infrastructure ✅
1. Initialize Next.js project with Mantine UI & @mantine/ui (dark mode).
2. Develop Initial Setup Flow:
   - Create first admin user if none exists.
   - Configure database connection with testing capability.
   - Configure Wasabi storage connection.
   - Configure email service.
3. Set up database models (MongoDB).
4. Implement error handling and graceful degradation.

### Initial Setup Flow (Guided Configuration) ✅
- If the application detects it's a fresh install (missing configs or no admin):
  - Redirect to setup page (`/setup`).
  - Step 1: Create Admin User (username, password).
  - Step 2: Database Configuration (connection string with testing).
  - Step 3: Wasabi Storage Configuration (API key, secret, bucket name, region).
  - Step 4: Email Service Configuration (API key, sender email).
  - Save configurations securely in `.env.local`.
  - Mark setup as complete to prevent re-triggering.

There are three ways to initialize the application:
1. **Using the Setup Flow**: Navigate to `/setup` in the browser and follow the guided setup process with interactive testing.
2. **Using the Initialization Script**: Run `npm run init-admin` to create a default admin user after setting up your MongoDB connection in `.env.local`.
3. **Using the Direct Admin Creation Script**: Run `npm run create-admin` with your MongoDB URI, admin email, and password as parameters for direct user creation without going through the setup flow.

### Phase 2: Core Features - Admin & Client ✅
1. Create authentication system (API routes, JWT).
2. Build Admin Dashboard UI (pages and components).
3. Implement link generation system (API routes).
4. Develop Client Upload Page UI.
5. Implement file validation and type checking.

### Phase 3: File Handling & Notifications ✅
1. ✅ Implement secure file upload pipeline (API routes, storage integration).
   - Created upload page with drag-and-drop functionality
   - Implemented file validation and storage handling
   - Added storage utility for Wasabi integration
2. ✅ Create notification system (API routes, email service, in-app for admin).
   - Created email utility for notifications with SendGrid
   - Implemented notifications for successful uploads
   - Added templates for both HTML and plain text emails
3. ✅ Build file logging system (database and API routes).
   - Created File model for tracking uploads
   - Implemented files API for listing and filtering uploads
   - Added admin UI for viewing uploaded files with download/delete functionality
4. ✅ Implement large file handling with resumable uploads.
   - Integrated resumable.js for chunked file uploads
   - Created chunked upload API endpoint
   - Added toggle for users to enable/disable resumable uploads
   - Implemented progress tracking and status updates

### Phase 4: Video Processing Pipeline ✅
1. ✅ Design and implement the Cloudflare Worker for video transcoding.
   - Created worker script with Digital Ocean API integration
   - Implemented GPU instance management for on-demand transcoding
   - Added support for multiple video quality profiles (360p to 2160p)
   - Created intelligent proxy storage and lifecycle management
   - Added cron triggers for maintenance tasks
2. ✅ Develop API routes for video transcoding and playback.
   - Created `/api/files/[fileId]/transcode` API endpoint
   - Implemented webhook handler for transcoding status updates
   - Added adaptive playback API at `/api/files/playback`
   - Created proxy URL generation with quality selection
3. ✅ Connect R2 storage for edge-optimized video delivery.
   - Set up Cloudflare R2 bucket and configured access
   - Integrated with the Cloudflare Worker for proxy storage
   - Implemented retention policies based on access patterns
   - Created intelligent proxy fetching based on client needs
4. ✅ Create adaptive video player for the client interface.
   - Implemented quality selection based on connection speed
   - Added manual quality override option
   - Created smooth playback with buffer management
   - Implemented responsive player interface

### Phase 5: Testing & Deployment ✅
1. ✅ Security testing (focus on API routes and file handling).
   - Implemented proper validation for all API endpoints
   - Added file type restrictions and size limits
   - Secured storage and email configurations
2. ✅ Performance optimization for large file transfers
   - Implemented chunked uploads with resumable.js
   - Added progress tracking for both standard and chunked uploads
   - Optimized storage operations with efficient streaming
3. ✅ Error handling and graceful degradation
   - Added comprehensive error handling
   - Created informative error pages
   - Implemented connection testing for services
4. ✅ Documentation and handover
   - Created detailed documentation in the `docs/` folder
   - Added clear README with setup instructions
   - Documented coding standards in `.cursorrules`

## 4. Technical Specifications

### Application Components (Next.js App Router)

#### UI Pages & Components
1. **Setup Flow (`app/setup/...`)**:
   - Multi-step form with validation for initial configuration
   - Database connection testing
   - Admin user creation
   - Storage and email configuration
2. **Public Upload Page (`app/upload/[linkId]/...`)**:
   - Drag-and-drop file input with Mantine Dropzone
   - Progress indicators with real-time updates
   - Success/error messages with clear feedback
   - Resumable upload toggle for large files
3. **Admin Portal (`app/admin/...`)**:
   - Login and authentication
   - Dashboard with overview statistics
   - Link management (create, list, toggle, delete)
   - File management with filtering and search
   - Settings for service configuration
4. **Shared Components (`components/...`)**:
   - Setup wizard steps
   - Layout components for admin interface
   - Error and loading states
   - Notification components
   - Adaptive video player with quality selection

#### API Routes
1. **Setup Routes (`app/api/setup/...`)**:
   - `POST /api/setup/admin`: Create initial admin user
   - `POST /api/setup/db`: Save database configuration
   - `POST /api/setup/db/test`: Test database connection
   - `POST /api/setup/storage`: Save Wasabi storage configuration
   - `POST /api/setup/email`: Save email service configuration
   - `GET /api/setup/status`: Check if setup is complete
2. **Authentication Routes (`app/api/auth/...`)**:
   - `POST /api/auth/login`: Admin login with JWT
   - `GET /api/auth/user`: Get current user info
   - `POST /api/auth/logout`: Logout and clear token
3. **Link Management Routes (`app/api/links/...`)**:
   - `GET /api/links`: List all upload links (admin only)
   - `POST /api/links`: Create new unique upload link
   - `PUT /api/links/[linkId]`: Update link status
   - `DELETE /api/links/[linkId]`: Delete a link
   - `GET /api/links/[linkId]/validate`: Validate link for public access
4. **File Upload Routes (`app/api/upload/...`)**:
   - `POST /api/upload`: Standard file upload
   - `POST /api/upload/chunk`: Chunked file upload (resumable)
   - `GET /api/upload/chunk`: Check if chunk exists (resumable)
5. **File Management Routes (`app/api/files/...`)**:
   - `GET /api/files`: List uploaded files with filtering
   - `GET /api/files/[fileId]`: Get file details
   - `DELETE /api/files/[fileId]`: Delete file
6. **Video Processing Routes (`app/api/files/...`)**:
   - `POST /api/files/[fileId]/transcode`: Initiate video transcoding
   - `POST /api/files/[fileId]/transcode/webhook`: Receive transcoding status updates
   - `POST /api/files/playback`: Get adaptive playback URLs based on client conditions

### Cloudflare Worker API
1. **Transcoding Endpoints**:
   - `POST /api/transcode`: Start video transcoding process
   - `GET /api/status/:jobId`: Check transcoding status
   - `GET /proxy/:fileId/:quality`: Serve video proxy with quality selection
2. **Storage Management**:
   - `POST /api/upload`: Generate pre-signed upload URLs
   - `POST /api/webhook`: Handle transcoding completion notifications
   - `POST /api/lifecycle`: Run lifecycle maintenance
3. **Scheduled Tasks**:
   - Daily maintenance at midnight UTC
   - Cleanup of unused proxies based on access patterns
   - Health checks and error reporting

### Database Models

1. **User**:
   - `email`: String, required, unique
   - `password`: String, required (hashed)
   - `role`: String, enum: ['admin', 'user', 'superadmin']
   - `createdAt`, `updatedAt`: Date timestamps

2. **UploadLink**:
   - `linkId`: String, unique (nanoid generated)
   - `clientName`: String, required
   - `projectName`: String, required
   - `notes`: String, optional
   - `expiresAt`: Date, optional
   - `isActive`: Boolean, default: true
   - `createdBy`: ObjectId, ref: 'User'
   - `uploadCount`: Number, default: 0
   - `lastUsedAt`: Date, optional
   - `createdAt`, `updatedAt`: Date timestamps

3. **File**:
   - `fileName`: String, required
   - `fileSize`: Number, required (bytes)
   - `fileType`: String, required (MIME type)
   - `uploadedVia`: ObjectId, ref: 'UploadLink'
   - `storageKey`: String, required (for Wasabi)
   - `clientName`: String, required (denormalized)
   - `projectName`: String, required (denormalized)
   - `status`: String, enum: ['processing', 'completed', 'failed']
   - `errorMessage`: String, optional
   - `downloadUrl`: String, optional
   - `transcoding`: Object, optional (for video files)
     - `jobId`: String
     - `status`: String, enum: ['processing', 'completed', 'failed']
     - `startedAt`: Date
     - `completedAt`: Date, optional
     - `qualities`: Array of Strings, optional
     - `error`: String, optional
   - `proxies`: Array of Objects, optional (for video files)
     - `quality`: String (e.g., '360p', '720p')
     - `url`: String
   - `createdAt`, `updatedAt`: Date timestamps

### Utility Services

1. **Database Connection (`utils/dbConnect.ts`)**:
   - MongoDB connection with Mongoose
   - Connection caching for performance
   - Error handling and retry logic

2. **Storage Service (`utils/storage.ts`)**:
   - Wasabi integration via AWS S3 SDK
   - File upload, download, and deletion
   - Presigned URL generation
   - Error handling and connection validation

3. **Email Service (`utils/email.ts`)**:
   - SendGrid integration for email delivery
   - HTML and plain text email templates
   - Admin and client notification
   - Error handling and logging

4. **Authentication (`utils/auth.ts`)**:
   - JWT token generation and validation
   - Password hashing with bcrypt
   - Role-based access control
   - Session management

5. **Video Processing (`utils/videoTranscode.ts`)**:
   - Integration with Cloudflare Worker API
   - Transcoding job management
   - Proxy URL generation
   - Quality selection logic
   - Connection speed detection

## 5. UI/UX Design
- Modern dark mode interface with Mantine UI components
- Responsive design for desktop and mobile
- Clear progress indicators and status messages
- Intuitive drag-and-drop interface for uploads
- Clean admin dashboard with filtering and sorting
- Comprehensive error handling and user feedback
- Adaptive video player with quality controls

## 6. Security Considerations
- Secure MongoDB connection with authentication
- Wasabi storage with proper access control
- JWT authentication for admin access
- Password hashing with bcrypt
- File type validation and size limits
- HTTPS-only connections
- Environment variable security
- API route authorization checks
- Worker API secured with API tokens
- Digital Ocean droplets with secure SSH access

## 7. Configuration and Deployment
- Environment variables stored in `.env.local`
- Configuration saved during setup process
- Initialization script for quick setup
- Clear documentation for deployment
- Error handling for missing configurations
- Cloudflare Worker deployed via Wrangler CLI
- Worker secrets managed securely

## 8. Additional Features (Future Phases)
- Analytics dashboard for upload statistics
- Batch file processing capabilities
- Custom branding options for client pages
- API for integration with other systems
- Multi-language support for international use
- Enhanced file preview capabilities
- Automated expiration of old uploads
- User-configurable transcoding presets
- Advanced video analytics
- Server-side watermarking options