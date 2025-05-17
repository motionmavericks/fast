# API Reference

This document provides a reference for the API endpoints in the Motion Mavericks Fast system.

## Next.js API Routes

### Authentication

#### `POST /api/auth/login`

Authenticates an admin user and returns a JWT token.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

#### `GET /api/auth/user`

Returns the current authenticated user.

**Response:**
```json
{
  "success": true,
  "user": {
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### Upload Links

#### `GET /api/links`

Returns a list of all upload links.

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "links": [
    {
      "linkId": "abc123",
      "clientName": "Client A",
      "projectName": "Project X",
      "expiresAt": "2023-12-31T00:00:00.000Z",
      "isActive": true,
      "createdAt": "2023-01-01T00:00:00.000Z",
      "uploadCount": 5
    }
  ]
}
```

#### `POST /api/links`

Creates a new upload link.

**Headers:**
- `Authorization: Bearer <token>`

**Request:**
```json
{
  "clientName": "Client A",
  "projectName": "Project X",
  "expiresAt": "2023-12-31T00:00:00.000Z",
  "notes": "Optional notes"
}
```

**Response:**
```json
{
  "success": true,
  "link": {
    "linkId": "abc123",
    "clientName": "Client A",
    "projectName": "Project X",
    "expiresAt": "2023-12-31T00:00:00.000Z",
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "uploadCount": 0
  }
}
```

#### `PUT /api/links/[linkId]`

Updates an upload link's status.

**Headers:**
- `Authorization: Bearer <token>`

**Request:**
```json
{
  "isActive": false
}
```

**Response:**
```json
{
  "success": true,
  "link": {
    "linkId": "abc123",
    "clientName": "Client A",
    "projectName": "Project X",
    "isActive": false
  }
}
```

#### `DELETE /api/links/[linkId]`

Deletes an upload link.

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Link deleted successfully"
}
```

#### `GET /api/links/[linkId]/validate`

Validates an upload link for public access.

**Response:**
```json
{
  "success": true,
  "link": {
    "linkId": "abc123",
    "clientName": "Client A",
    "projectName": "Project X",
    "isActive": true
  }
}
```

### File Upload and Management

#### `POST /api/upload`

Uploads a file using standard HTTP upload.

**Request:**
- `Content-Type: multipart/form-data`
- Form fields:
  - `file`: The file to upload
  - `linkId`: The upload link ID

**Response:**
```json
{
  "success": true,
  "file": {
    "fileId": "def456",
    "fileName": "example.mp4",
    "fileSize": 10485760,
    "fileType": "video/mp4",
    "clientName": "Client A",
    "projectName": "Project X",
    "downloadUrl": "https://example.com/download/def456"
  }
}
```

#### `POST /api/upload/chunk`

Uploads a chunk of a file using Resumable.js.

**Request:**
- `Content-Type: multipart/form-data`
- Form fields:
  - `resumableChunkNumber`: The chunk number
  - `resumableIdentifier`: The file identifier
  - `resumableTotalChunks`: Total number of chunks
  - `linkId`: The upload link ID

**Response:**
```json
{
  "success": true
}
```

#### `GET /api/upload/chunk`

Checks if a chunk already exists (for resumable uploads).

**Query Parameters:**
- `resumableChunkNumber`: The chunk number
- `resumableIdentifier`: The file identifier
- `linkId`: The upload link ID

**Response:**
- Status 200: Chunk exists
- Status 404: Chunk does not exist

#### `GET /api/files`

Returns a list of uploaded files.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `clientName` (optional): Filter by client name
- `projectName` (optional): Filter by project name
- `fileType` (optional): Filter by file type
- `page` (optional): Page number
- `limit` (optional): Number of items per page

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "fileId": "def456",
      "fileName": "example.mp4",
      "fileSize": 10485760,
      "fileType": "video/mp4",
      "clientName": "Client A",
      "projectName": "Project X",
      "uploadedAt": "2023-01-01T00:00:00.000Z",
      "downloadUrl": "https://example.com/download/def456"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

#### `GET /api/files/[fileId]`

Returns details for a specific file.

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "file": {
    "fileId": "def456",
    "fileName": "example.mp4",
    "fileSize": 10485760,
    "fileType": "video/mp4",
    "clientName": "Client A",
    "projectName": "Project X",
    "uploadedAt": "2023-01-01T00:00:00.000Z",
    "downloadUrl": "https://example.com/download/def456"
  }
}
```

#### `DELETE /api/files/[fileId]`

Deletes a file.

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

### Video Processing

#### `POST /api/files/[fileId]/transcode`

Initiates transcoding for a video file.

**Headers:**
- `Authorization: Bearer <token>`

**Request:**
```json
{
  "qualities": ["360p", "720p", "1080p"]
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job123",
  "message": "Transcoding job started"
}
```

#### `POST /api/files/[fileId]/transcode/webhook`

Receives webhook notifications from the Cloudflare Worker about transcoding status.

**Request:**
```json
{
  "jobId": "job123",
  "status": "completed",
  "qualities": ["360p", "720p", "1080p"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

#### `POST /api/files/playback`

Gets adaptive playback URLs based on client conditions.

**Request:**
```json
{
  "fileId": "def456",
  "quality": "auto",
  "connectionType": "4g"
}
```

**Response:**
```json
{
  "success": true,
  "playbackUrl": "https://video.example.com/proxy/def456/720p.mp4",
  "availableQualities": ["360p", "720p", "1080p"],
  "selectedQuality": "720p"
}
```

### Setup and Configuration

#### `POST /api/setup/admin`

Creates the initial admin user.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "secure-password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin user created successfully"
}
```

#### `POST /api/setup/db`

Saves database configuration.

**Request:**
```json
{
  "mongoUri": "mongodb+srv://username:password@cluster.mongodb.net/motionmavericks"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Database configuration saved"
}
```

#### `POST /api/setup/db/test`

Tests database connection.

**Request:**
```json
{
  "mongoUri": "mongodb+srv://username:password@cluster.mongodb.net/motionmavericks"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Database connection successful"
}
```

#### `POST /api/setup/storage`

Saves storage configuration.

**Request:**
```json
{
  "wasabiAccessKeyId": "your-access-key",
  "wasabiSecretAccessKey": "your-secret-key",
  "wasabiBucketName": "your-bucket",
  "wasabiRegion": "ap-southeast-2",
  "wasabiEndpoint": "https://s3.ap-southeast-2.wasabisys.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Storage configuration saved"
}
```

#### `POST /api/setup/email`

Saves email service configuration.

**Request:**
```json
{
  "sendgridApiKey": "your-sendgrid-key",
  "senderEmail": "uploads@example.com",
  "adminEmails": "admin1@example.com,admin2@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email configuration saved"
}
```

#### `GET /api/setup/status`

Checks if setup is complete.

**Response:**
```json
{
  "success": true,
  "setupComplete": true,
  "components": {
    "admin": true,
    "database": true,
    "storage": true,
    "email": true
  }
}
```

## Cloudflare Worker API

### Transcoding

#### `POST /api/transcode`

Initiates video transcoding.

**Headers:**
- `Authorization: Bearer <API_SECRET>`

**Request:**
```json
{
  "fileId": "def456",
  "sourceUrl": "https://example.com/source.mp4",
  "qualities": ["360p", "720p", "1080p"],
  "webhookUrl": "https://app.example.com/api/files/def456/transcode/webhook"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job123",
  "message": "Transcoding job started"
}
```

#### `GET /api/status/:jobId`

Checks the status of a transcoding job.

**Response:**
```json
{
  "jobId": "job123",
  "fileId": "def456",
  "status": "processing",
  "progress": 75,
  "completedQualities": ["360p"],
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:10:00.000Z"
}
```

### Video Delivery

#### `GET /proxy/:fileId/:quality`

Serves a video proxy with the specified quality.

**Response:**
- Video file with appropriate Content-Type headers

### Webhooks

#### `POST /api/webhook`

Processes webhooks from transcoding droplets.

**Headers:**
- `Authorization: Bearer <API_SECRET>`

**Request:**
```json
{
  "jobId": "job123",
  "status": "completed",
  "qualities": ["360p", "720p", "1080p"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

### Lifecycle Management

#### `POST /api/lifecycle`

Triggers lifecycle management to clean up unused proxies.

**Headers:**
- `Authorization: Bearer <API_SECRET>`

**Response:**
```json
{
  "success": true,
  "stats": {
    "scanned": 150,
    "deleted": 25,
    "retained": 125,
    "errors": 0
  },
  "dropletsDeleted": 2,
  "dropletsKept": 1
}
```

### Health Check

#### `GET /api/health`

Checks the health of the worker and its connections.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "r2": {
      "status": "healthy"
    },
    "kv": {
      "status": "healthy"
    },
    "digitalOcean": {
      "status": "healthy"
    }
  }
}
``` 