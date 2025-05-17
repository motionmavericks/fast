# Project Management System

## Overview

The Project Management System is a comprehensive solution for managing agencies, clients, projects, and files within Motion Mavericks Fast. It provides a structured approach to organizing and tracking media production workflows across multiple storage tiers.

## Key Features

1. **Agency & Client Management**
   - Create and manage agencies with unique codes
   - Create clients associated with agencies
   - Track contact information and status

2. **Project Management**
   - Generate unique MM-prefixed project IDs (MM-AGENCY-CLIENT-###)
   - Create standardized folder structures across all storage systems
   - Track project status, timelines, and settings

3. **File Tracking**
   - Monitor file availability across Frame.io, Cloudflare R2, and LucidLink
   - Track file metadata, status, and version history
   - Organize files according to industry-standard categories

4. **Folder Management**
   - Automatically create standard post-production folder structure
   - Regenerate folder structures when needed
   - Access links to external storage systems

## Standard Folder Structure

Each project is created with the following industry-standard folder structure:

```
Project: MM-AGENCY-CLIENT-###
├── Production/
│   ├── Camera/
│   ├── Sound/
│   ├── Lighting/
│   ├── Direction/
│   └── Script/
├── Post-Production/
│   ├── Editorial/
│   ├── VFX/
│   ├── Sound_Design/
│   ├── Music/
│   ├── Color/
│   └── Graphics/
├── Deliverables/
│   ├── Approvals/
│   ├── Final_Masters/
│   ├── Social_Media/
│   ├── Broadcast/
│   └── Web/
├── Assets/
│   ├── Footage/
│   ├── Audio/
│   ├── Graphics/
│   ├── Stock/
│   └── Photos/
└── Admin/
    ├── Contracts/
    ├── Briefs/
    ├── Meetings/
    └── Feedback/
```

## Project ID System

The project ID system follows this format: `MM-AGENCY-CLIENT-###`

- **MM-**: Motion Mavericks prefix
- **AGENCY-**: 2-4 letter agency code (e.g., MM for Motion Mavericks)
- **CLIENT-**: 2-4 letter client code (e.g., ABC for ABC Corporation)
- **###**: Sequential 3-digit number (starts at 001 for each client)

Examples:
- MM-MM-ABC-001: First project for ABC Corporation with Motion Mavericks agency
- MM-MM-XYZ-001: First project for XYZ Company with Motion Mavericks agency
- MM-MM-ABC-002: Second project for ABC Corporation with Motion Mavericks agency

## Multi-tier Storage Integration

The system integrates with three storage tiers:

1. **Frame.io**
   - Used for initial uploads and proxy generation
   - Provides web-based review and collaboration

2. **Cloudflare R2**
   - Edge delivery of proxy videos
   - Fast access to preview-quality content

3. **LucidLink**
   - Storage of high-quality original files
   - Post-production workflows and editing

## File Tracking

Files are tracked across all storage systems with the following information:

- File metadata (name, size, type)
- Original and relative paths
- Storage locations with status (pending, available, failed, not applicable)
- File status (uploading, processing, available, failed, archived)
- Version history
- Tags and custom metadata
- Upload information and timestamps

## API Endpoints

### Agencies
- `GET /api/agencies` - List all agencies
- `POST /api/agencies` - Create a new agency
- `GET /api/agencies/:id` - Get agency details
- `PUT /api/agencies/:id` - Update an agency
- `DELETE /api/agencies/:id` - Deactivate an agency

### Clients
- `GET /api/clients` - List all clients
- `POST /api/clients` - Create a new client
- `GET /api/clients/:id` - Get client details
- `PUT /api/clients/:id` - Update a client
- `DELETE /api/clients/:id` - Deactivate a client

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create a new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update a project
- `DELETE /api/projects/:id` - Archive a project
- `GET /api/projects/:id/folders` - Get project folder structure
- `POST /api/projects/:id/folders` - Regenerate folder structure
- `GET /api/projects/:id/files` - List project files
- `POST /api/projects/:id/files` - Add a file to the project

## Future Enhancements

1. **Project Templates**
   - Create template projects with predefined folder structures
   - Clone existing projects for similar workflows

2. **Advanced File Analytics**
   - Track file usage and access patterns
   - Generate reports on storage utilization

3. **Workflow Automation**
   - Automate file movement between storage tiers
   - Trigger notifications for status changes

4. **Client Portal**
   - Provide clients with secure access to their projects
   - Allow controlled feedback and approval workflows

5. **Integration with Post-Production Tools**
   - Link directly to editing software
   - Support for project exchange formats (XML, AAF, etc.)
