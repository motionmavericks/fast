# Multi-Tier Storage Architecture

## Overview

Motion Mavericks Fast implements a sophisticated multi-tier storage architecture designed for optimal performance, cost efficiency, and scalability. The system orchestrates file movements across different storage tiers using Cloudflare Workers as the central coordination layer.

## Storage Tiers

### 1. Cloudflare R2 (Edge Storage)
- **Purpose**: Fast edge delivery of frequently accessed proxy videos
- **Advantages**: Global edge distribution, low-latency access, no egress fees
- **Usage Pattern**:
  - Initial storage of lower quality proxies (360p, 540p)
  - On-demand fetching of higher quality proxies (720p, 1080p, 2160p)
  - Automatic removal based on access patterns
  - **Never stores original files** (only proxies)
- **Retention Policy**:
  - High quality (1080p/2160p): 7 days without access
  - Medium quality (720p): 14 days without access
  - Low quality (360p/540p): 30 days without access
- **Cost Optimization**: Only stores currently needed proxies, automatically removes unused files

### 2. Wasabi (Archival Storage)
- **Purpose**: Complete long-term archival of all content
- **Advantages**: Cost-effective long-term storage, S3-compatible, no egress fees
- **Usage Pattern**: All quality levels and original files permanently stored
- **Content Stored**: 
  - Original files (full resolution source uploads)
  - All proxy qualities (including those not in R2)
- **Cost Considerations**: Predictable pricing, no egress fees, 90-day minimum storage commitment
- **Render Access**: Primary source for final renders requiring original files

### 3. LucidLink (Optional - Editing Access)
- **Purpose**: High-performance access for post-production
- **Advantages**: Appears as local filesystem, optimized for video editing
- **Usage Pattern**: Stores highest quality proxy for each asset
- **Organization**: Structured by client/project for easy navigation
- **Cost Considerations**: Higher cost but necessary for production workflows
- **Server Implementation**:
  - Dedicated DigitalOcean CPU-Optimized Droplet
  - Mounted at `/mnt/lucidlink/motionmavericks`
  - Exposed via simple REST API for worker integration
  - Connected to Cloudflare Worker orchestration layer

## LucidLink Server Implementation

To enable efficient filesystem operations with LucidLink, a dedicated server is deployed with the following specifications:

### Server Configuration
- **Provider**: DigitalOcean
- **Instance Type**: CPU-Optimized Droplet (8 vCPU / 16GB RAM)
- **Storage**: 500GB-1TB Volume Block Storage
- **Region**: Deployed in same region as Wasabi bucket
- **OS**: Ubuntu LTS

### Mount Structure
```
/mnt/lucidlink/motionmavericks/
  ├── Clients/
  │   ├── ClientName1/
  │   │   ├── ProjectName1/
  │   │   └── ProjectName2/
  │   └── ClientName2/
  └── Archives/
```

## Orchestration Layer

### Cloudflare Worker as Central Orchestrator

The Cloudflare Worker serves as the "brain" of the storage system with these core responsibilities:

1. **Direct Storage Operations**:
   - Performs direct file operations with all storage tiers 
   - Uses AWS SDK for Wasabi operations
   - Manages R2 operations via native bindings
   - Coordinates with LucidLink server for filesystem operations

2. **Intelligent File Placement**:
   - Makes decisions about where to store each proxy quality
   - Initially places only lower quality proxies in R2
   - Fetches higher quality proxies on demand
   - Tracks access patterns to optimize storage distribution
   - **Ensures original files are never stored in R2**

3. **Lifecycle Management**:
   - Runs scheduled cleanup jobs
   - Removes unused proxies based on configurable thresholds
   - Updates database with current file locations
   - Ensures all content remains permanently available in archival storage

4. **Failure Handling**:
   - Implements retry mechanisms for storage operations
   - Logs errors and reports failures
   - Ensures critical operations complete successfully
   - Maintains database consistency even during partial failures

## Data Flow

### 1. Upload Phase
```
Client → Next.js API → Wasabi → Cloudflare Worker → Transcoding GPU Instance → Multi-Tier Distribution
```

### 2. Storage Phase
For original files:
```
Worker → Archive Original to Wasabi
      → Update Database (Single API Call)
```

For proxy files:
```
Worker → Store All Qualities in Wasabi
      → Store Low Qualities in R2
      → Store Highest Quality in LucidLink
      → Update Database (Single API Call)
```

### 3. Access Phase
```
User → R2 (Edge-Optimized Delivery for Proxies)
    → Wasabi (For Original Files)
    → Worker Fetches Higher Quality if Needed
    → Worker Updates Access Patterns
```

### 4. Render Access Phase
```
Render Process → Request Original Files
              → Direct Access from Wasabi (No Egress Fees)
              → Parallel Processing of Required Segments
              → No Full File Downloads Required
```

### 5. Cleanup Phase
```
Scheduled Worker Job → Check Access Patterns
                     → Remove Unused Proxies from R2
                     → Update Database
```

## File Paths and Organization

### R2
```
proxies/{jobId}/{quality}.mp4
```
Example: `proxies/6423a89b7f1234567890abcd/720p.mp4`

### Wasabi
Original files:
```
originals/{clientName}/{projectName}/{fileId}/{fileName}
```
Example: `originals/acme-corp/spring-campaign/6423a89b7f1234567890abcd/interview_4k.mov`

Proxy files:
```
proxies/{clientName}/{projectName}/{fileId}/{quality}.mp4
```
Example: `proxies/acme-corp/spring-campaign/6423a89b7f1234567890abcd/1080p.mp4`

### LucidLink
```
/Clients/{clientName}/{projectName}/{fileId}_{quality}.mp4
```
Example: `/Clients/acme-corp/spring-campaign/6423a89b7f1234567890abcd_1080p.mp4`

## Benefits

1. **Performance**: 
   - R2 provides global edge delivery for frequently accessed content
   - LucidLink provides filesystem-like access for editors
   - Byte-range requests enable efficient render workflows

2. **Cost Efficiency**:
   - R2 storage is optimized based on actual usage patterns
   - Wasabi provides cost-effective long-term storage
   - No egress fees for render access from Wasabi
   - Original files are never duplicated in R2

3. **Reliability**:
   - Files are stored redundantly across multiple storage tiers
   - Automatic failover mechanisms ensure content availability
   - Comprehensive monitoring and error handling

4. **Scalability**:
   - System can handle growing storage needs with minimal operational overhead
   - Cloudflare Worker auto-scales based on demand
   - LucidLink server can be scaled up for increased editing demands

## Implementation Considerations

1. **Security**:
   - All storage tiers use strong authentication
   - Signed URLs with short expiration times
   - Role-based access control for API endpoints

2. **Monitoring**:
   - Comprehensive logging of all file movements
   - Dashboard for storage utilization across tiers
   - Alerts for storage errors or capacity issues

3. **Recovery**:
   - Automated recovery procedures for failed transfers
   - Database consistency checks for file metadata
   - Manual override capabilities for administrators