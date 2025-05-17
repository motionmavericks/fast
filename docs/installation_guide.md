# Motion Mavericks Fast: Installation and Configuration Guide

This guide provides detailed instructions for installing, configuring, and deploying the Motion Mavericks Fast application with all its integrated services.

## Prerequisites

Before installation, ensure you have the following:

### Development Environment
- **Node.js** (v18.0+) and npm
- **Git** for version control

### Accounts and Services
- **MongoDB** database (Atlas or self-hosted)
- **Frame.io** developer account with API access
- **Cloudflare** account with R2 and Workers access
- **LucidLink** account (optional)
- **Wasabi** storage account
- **SendGrid** account for email notifications

## Step 1: Clone and Setup Application

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/motion-mavericks-fast.git
   cd motion-mavericks-fast
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   Create a `.env.local` file in the root directory with the following variables (replace with your actual values):

   ```
   # MongoDB
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/fast?retryWrites=true&w=majority

   # Authentication
   JWT_SECRET=yoursecretkeyhere

   # Frame.io Integration
   FRAMEIO_CLIENT_ID=your_frameio_client_id
   FRAMEIO_CLIENT_SECRET=your_frameio_client_secret
   FRAMEIO_TEAM_ID=your_frameio_team_id
   FRAMEIO_ROOT_PROJECT_ID=your_frameio_root_project_id

   # Cloudflare R2
   CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
   R2_ACCESS_KEY_ID=your_r2_access_key_id
   R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
   R2_BUCKET_NAME=your_r2_bucket_name
   R2_PUBLIC_DOMAIN=your_r2_public_domain (optional)

   # LucidLink (optional)
   LUCIDLINK_ENABLED=true
   LUCIDLINK_BASE_PATH=your_lucidlink_mount_path

   # Wasabi Storage
   WASABI_ACCESS_KEY_ID=your_wasabi_access_key_id
   WASABI_SECRET_ACCESS_KEY=your_wasabi_secret_access_key
   WASABI_BUCKET_NAME=your_wasabi_bucket_name
   WASABI_REGION=your_wasabi_region
   WASABI_ENDPOINT=your_wasabi_endpoint

   # Security and Webhooks
   WEBHOOK_SECRET=your_webhook_secret
   CRON_SECRET=your_cron_secret

   # SendGrid
   SENDGRID_API_KEY=your_sendgrid_api_key
   SENDER_EMAIL=your_sender_email
   ADMIN_EMAILS=comma,separated,admin,emails
   ```

4. **Generate secure tokens**
   For JWT_SECRET, WEBHOOK_SECRET, and CRON_SECRET, generate secure random strings. You can use the following command in your terminal:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Step 2: Frame.io Configuration

1. **Create Frame.io developer account**
   Sign up at https://developer.frame.io/

2. **Create a new application**
   - Go to the Developer Dashboard
   - Click "Create New Application"
   - Set appropriate permissions:
     - `asset.read`
     - `asset.create`
     - `project.read`
     - `project.create`
     - `project.share`

3. **Configure OAuth**
   - Set the Redirect URI to your application URL (e.g., `https://yourdomain.com/api/auth/frameio/callback`)

4. **Get credentials**
   - Copy the Client ID and Client Secret to your `.env.local` file

5. **Find your Team ID and Root Project ID**
   - Use the Frame.io API Explorer to make a GET request to `/v2/teams`
   - Find your team ID in the response
   - Use the Frame.io API Explorer to make a GET request to `/v2/teams/{team_id}/projects`
   - Choose a project ID to use as your root project (or create a new one)

6. **Configure webhooks**
   - Go to the Webhooks section in your Frame.io developer dashboard
   - Create a new webhook with the URL: `https://your-worker-url.workers.dev/webhook/frameio`
   - Enable the following events:
     - `asset.ready`
     - `proxy.ready`

## Step 3: Cloudflare R2 Setup

1. **Create R2 bucket**
   - Go to your Cloudflare dashboard
   - Navigate to R2
   - Create a new bucket named the same as your R2_BUCKET_NAME value

2. **Generate API tokens**
   - Create an API token with read/write permissions for R2
   - Copy the Access Key ID and Secret Access Key to your `.env.local` file

3. **Set up custom domain (optional)**
   - Configure a custom domain for your R2 bucket if you want to use R2_PUBLIC_DOMAIN
   - Update the R2_PUBLIC_DOMAIN value in your `.env.local` file

## Step 4: Cloudflare Worker Deployment

1. **Install Wrangler**
   ```bash
   npm install -g @cloudflare/wrangler
   ```

2. **Configure Wrangler**
   Create a `wrangler.toml` file in the root directory:
   ```toml
   name = "motion-mavericks-fast-worker"
   main = "./scripts/cloudflare-worker.js"
   compatibility_date = "2023-01-01"
   
   [[r2_buckets]]
   binding = "R2_BUCKET"
   bucket_name = "your-r2-bucket-name"
   
   [vars]
   API_BASE_URL = "https://yourdomain.com/api"
   WEBHOOK_SECRET = "your_webhook_secret"
   FRAMEIO_CLIENT_ID = "your_frameio_client_id"
   FRAMEIO_CLIENT_SECRET = "your_frameio_client_secret"
   LUCIDLINK_ENABLED = "true"
   CRON_SECRET = "your_cron_secret"
   
   [triggers]
   crons = ["0 0 * * *"] # Daily at midnight
   ```

3. **Deploy the worker**
   ```bash
   wrangler publish
   ```

4. **Set up secrets (optional)**
   Use Wrangler to set up secrets for sensitive variables instead of putting them in the `wrangler.toml` file:
   ```bash
   wrangler secret put FRAMEIO_CLIENT_SECRET
   wrangler secret put WEBHOOK_SECRET
   wrangler secret put CRON_SECRET
   ```

## Step 5: LucidLink Setup (Optional)

1. **Install LucidLink client**
   Follow the LucidLink installation instructions for your operating system

2. **Mount the LucidLink volume**
   - Configure and mount your LucidLink volume
   - Note the mount path and set it as LUCIDLINK_BASE_PATH in your `.env.local` file

3. **Create folder structure**
   - The application will automatically create client/project folders as needed
   - Ensure the mount has appropriate permissions

## Step 6: Wasabi Storage Setup

1. **Create a Wasabi storage account**
   Sign up at https://wasabi.com/

2. **Create a bucket**
   - Create a new bucket with the same name as your WASABI_BUCKET_NAME value
   - Set the bucket region according to your needs

3. **Create API credentials**
   - Generate an Access Key and Secret Key in your Wasabi console
   - Add these to your `.env.local` file

4. **Verify endpoint**
   - Ensure the WASABI_ENDPOINT matches your selected region
   - For example: `https://s3.ap-southeast-2.wasabisys.com` for AP Southeast 2

## Step 7: MongoDB Setup

1. **Create MongoDB database**
   - Set up a MongoDB database (Atlas or self-hosted)
   - Create a user with read/write permissions

2. **Get connection string**
   - Copy the connection string to your MONGODB_URI variable in `.env.local`
   - Include the database name in the URI

## Step 8: SendGrid Setup

1. **Create SendGrid account**
   Sign up at https://sendgrid.com/

2. **Get API key**
   - Create an API key with Mail Send permissions
   - Add it to your SENDGRID_API_KEY variable

3. **Verify sender**
   - Verify your sender email address
   - Add it to your SENDER_EMAIL variable

## Step 9: Running the Application

### Development
```bash
npm run dev
```

### Production
For production deployment, we recommend using a service like Vercel or setting up a Node.js server with PM2:

**Using Vercel**
```bash
npm install -g vercel
vercel
```

**Using PM2**
```bash
npm install -g pm2
npm run build
pm2 start npm --name "fast" -- start
```

## Step 10: Initial Configuration

1. **Create admin user**
   ```bash
   npm run create-admin
   ```

2. **Access admin portal**
   - Go to `https://yourdomain.com/admin`
   - Login with the admin credentials

3. **Create your first upload link**
   - Use the admin portal to create a client upload link
   - Test the complete workflow

## Troubleshooting

### Frame.io Integration
- Ensure your Frame.io developer application has the correct permissions
- Check that your webhooks are properly configured
- Verify your FRAMEIO_ROOT_PROJECT_ID exists and is accessible

### R2 Storage
- Test R2 access with a simple upload/download operation
- Ensure your R2 API tokens have the correct permissions
- Check your bucket CORS configuration if experiencing access issues

### LucidLink
- Verify that the LucidLink volume is properly mounted
- Check file permissions on the mount path
- Test writing a file directly to the mount path

### Wasabi Storage
- Verify your Wasabi credentials with a test operation
- Ensure your bucket region and endpoint match
- Check for any firewall issues blocking access

### Cloudflare Worker
- Check Worker logs for any errors
- Verify that your R2 bucket binding is correctly configured
- Test the Worker endpoints directly

## Maintenance

### Updating the Application
```bash
git pull
npm install
npm run build
```

### Monitoring
- Set up monitoring for the Cloudflare Worker
- Monitor R2 storage usage
- Check Wasabi storage usage regularly
- Review application logs for errors

### Backup
- Regularly backup the MongoDB database
- Consider implementing a backup strategy for critical Wasabi content

## Security Considerations

- Keep your environment variables and secrets secure
- Regularly rotate API keys
- Implement proper access controls for admin users
- Consider implementing additional authentication for sensitive operations
- Review Frame.io webhook security best practices

## Support

For assistance with installation or configuration issues, contact:
- support@motionmavericks.com.au