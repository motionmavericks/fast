#!/bin/bash
# LucidLink Server Setup Script for Motion Mavericks Fast
# To be run on a fresh Ubuntu 22.04 DigitalOcean Droplet

# Exit on any error
set -e

# Configuration (update these values)
JWT_SECRET="your-secure-secret"
LUCIDLINK_USERNAME="your-lucidlink-username"
LUCIDLINK_PASSWORD="your-lucidlink-password"
LUCIDLINK_FILESPACE="Motion Mavericks"
MOUNT_PATH="/mnt/lucidlink/motionmavericks"
SERVER_DOMAIN="lucidlink-api.yourdomain.com"
API_PORT=4000

# Update system
echo "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install dependencies
echo "Installing dependencies..."
apt-get install -y nginx certbot python3-certbot-nginx

# Install Node.js
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2
echo "Installing PM2..."
npm install -g pm2

# Add LucidLink repository
echo "Adding LucidLink repository..."
wget -qO - https://repository.lucidlink.com/gpg.key | apt-key add -
add-apt-repository "deb https://repository.lucidlink.com/ubuntu/ bionic main"

# Install LucidLink client
echo "Installing LucidLink client..."
apt-get update
apt-get install -y lucidlink

# Configure LucidLink
echo "Configuring LucidLink..."
mkdir -p $MOUNT_PATH

# Create API application
echo "Creating API application..."
mkdir -p /opt/lucidlink-api
cd /opt/lucidlink-api

cat > package.json << EOF
{
  "name": "lucidlink-api",
  "version": "1.0.0",
  "description": "LucidLink Server API for Motion Mavericks Fast",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-jwt": "^8.4.1",
    "jsonwebtoken": "^9.0.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "morgan": "^1.10.0",
    "fs-extra": "^11.1.1"
  }
}
EOF

# Install dependencies
npm install

# Create server.js file
cat > server.js << EOF
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs-extra');
const jwt = require('jsonwebtoken');
const { expressjwt } = require('express-jwt');
const path = require('path');

const app = express();
const PORT = process.env.PORT || $API_PORT;
const JWT_SECRET = process.env.JWT_SECRET || '$JWT_SECRET';
const LUCIDLINK_BASE_PATH = '$MOUNT_PATH';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Authentication middleware
const authMiddleware = expressjwt({
  secret: JWT_SECRET,
  algorithms: ['HS256']
});

// API Endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Protected routes
app.use('/api', authMiddleware);

// File operations
app.post('/api/files/copy', async (req, res) => {
  try {
    const { sourceUrl, clientName, projectName, fileName } = req.body;
    
    if (!sourceUrl || !clientName || !projectName || !fileName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Create directory structure
    const projectPath = path.join(LUCIDLINK_BASE_PATH, 'Clients', clientName, projectName);
    await fs.ensureDir(projectPath);
    
    const destPath = path.join(projectPath, fileName);
    
    // Download file and save to LucidLink
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(\`Failed to download file: \${response.statusText}\`);
    }
    
    const fileStream = fs.createWriteStream(destPath);
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });
    
    res.json({
      success: true,
      path: destPath.replace(LUCIDLINK_BASE_PATH, '')
    });
  } catch (error) {
    console.error('Error copying file:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files/status', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }
    
    const fullPath = path.join(LUCIDLINK_BASE_PATH, filePath);
    const exists = await fs.pathExists(fullPath);
    
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const stats = await fs.stat(fullPath);
    
    res.json({
      exists: true,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      created: stats.birthtime,
      modified: stats.mtime
    });
  } catch (error) {
    console.error('Error getting file status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(\`LucidLink API server running on port \${PORT}\`);
});
EOF

# Configure Nginx
echo "Configuring Nginx..."
cat > /etc/nginx/sites-available/lucidlink-api << EOF
server {
    listen 80;
    server_name $SERVER_DOMAIN;
    
    location / {
        proxy_pass http://localhost:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/lucidlink-api /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Configure PM2
echo "Configuring PM2..."
JWT_SECRET=$JWT_SECRET pm2 start /opt/lucidlink-api/server.js --name lucidlink-api
pm2 save
pm2 startup

# Setup LucidLink mount (manual step)
echo "======================================================================"
echo "MANUAL STEP REQUIRED:"
echo "Run the following commands to configure LucidLink:"
echo "    lucid configure --username $LUCIDLINK_USERNAME --password $LUCIDLINK_PASSWORD"
echo "    lucid mount \"$LUCIDLINK_FILESPACE\" $MOUNT_PATH"
echo "======================================================================"

# Setup SSL (manual step)
echo "======================================================================"
echo "MANUAL STEP REQUIRED:"
echo "Run the following command to set up SSL:"
echo "    certbot --nginx -d $SERVER_DOMAIN"
echo "======================================================================"

# Create a monitoring script
echo "Creating health check script..."
mkdir -p /opt/scripts

cat > /opt/scripts/health-check.sh << EOF
#!/bin/bash

# Check LucidLink mount
if ! mountpoint -q $MOUNT_PATH; then
  echo "LucidLink not mounted, attempting remount..."
  lucid mount "$LUCIDLINK_FILESPACE" $MOUNT_PATH
  exit 1
fi

# Check API service
if ! curl -s http://localhost:$API_PORT/health | grep -q "healthy"; then
  echo "API service not healthy, restarting..."
  pm2 restart lucidlink-api
  exit 1
fi

echo "All systems healthy"
exit 0
EOF

chmod +x /opt/scripts/health-check.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/scripts/health-check.sh >> /var/log/lucidlink-health.log 2>&1") | crontab -

# Create a JWT token generator script
echo "Creating JWT token generator script..."

cat > /opt/scripts/generate-api-token.js << EOF
const jwt = require('jsonwebtoken');
const token = jwt.sign({ role: 'worker' }, '$JWT_SECRET', { expiresIn: '1y' });
console.log(token);
EOF

# Setup firewall
echo "Configuring firewall..."
ufw allow ssh
ufw allow http
ufw allow https
ufw enable

echo "LucidLink server setup complete!"
echo "To generate an API token, run: node /opt/scripts/generate-api-token.js" 