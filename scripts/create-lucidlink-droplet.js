// Script to create a Digital Ocean droplet for LucidLink server
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const DO_TOKEN = process.env.DIGITAL_OCEAN_TOKEN;
const DROPLET_NAME = 'motion-mavericks-lucidlink';
const REGION = 'syd1'; // Sydney, Australia - closest to Melbourne
const SIZE = 's-4vcpu-8gb'; // 4 vCPUs, 8GB RAM
const SSH_KEY_FILE = path.join(__dirname, 'lucidlink_rsa.pub');

// Digital Ocean API client
const api = axios.create({
  baseURL: 'https://api.digitalocean.com/v2',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DO_TOKEN}`
  }
});

// Function to create setup script
function generateUserData() {
  return `#!/bin/bash
# LucidLink Server Setup Script for Motion Mavericks Fast
set -e

# Configuration
JWT_SECRET="${process.env.JWT_SECRET}"
MOUNT_PATH="/mnt/lucidlink/motionmavericks"
SERVER_DOMAIN="lucidlink.motionmavericks.com.au"
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

# Create a JWT token generator script
echo "Creating JWT token generator script..."
mkdir -p /opt/scripts
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
ufw --force enable

echo "LucidLink server setup complete!"
echo "To generate an API token, run: node /opt/scripts/generate-api-token.js"
`;
}

// Validate available regions
async function verifyRegion() {
  try {
    console.log('Verifying if Sydney region (syd1) is available...');
    const regionsResponse = await api.get('/regions');
    
    const allRegions = regionsResponse.data.regions;
    const sydneyRegion = allRegions.find(region => region.slug === REGION);
    
    if (!sydneyRegion) {
      console.error(`Error: Sydney region (${REGION}) not found.`);
      console.log('Available regions:');
      allRegions
        .filter(region => region.available)
        .forEach(region => {
          console.log(`- ${region.name} (${region.slug})`);
        });
      
      return false;
    }
    
    if (!sydneyRegion.available) {
      console.error(`Error: Sydney region (${REGION}) is not currently available.`);
      return false;
    }
    
    console.log(`Sydney region (${REGION}) is available.`);
    return true;
  } catch (error) {
    console.error('Error verifying regions:', error.message);
    return false;
  }
}

// Main function
async function createDroplet() {
  try {
    console.log('Creating Digital Ocean droplet for LucidLink server in Sydney, Australia...');
    
    // Verify region is available
    const regionValid = await verifyRegion();
    if (!regionValid) {
      console.error('Region verification failed. Please choose another region.');
      return;
    }
    
    // Get SSH keys (or create one if needed)
    let sshKeyId;
    const sshKeyResponse = await api.get('/account/keys');
    const existingKeys = sshKeyResponse.data.ssh_keys;
    
    if (existingKeys.length > 0) {
      sshKeyId = existingKeys[0].id;
      console.log(`Using existing SSH key: ${existingKeys[0].name}`);
    } else {
      console.log('No SSH keys found. Please create one first at https://cloud.digitalocean.com/account/security');
      process.exit(1);
    }
    
    // Create the droplet
    const userData = generateUserData();
    
    const dropletData = {
      name: DROPLET_NAME,
      region: REGION,
      size: SIZE,
      image: 'ubuntu-20-04-x64',
      ssh_keys: [sshKeyId],
      backups: false,
      ipv6: true,
      user_data: userData,
      tags: ['motion-mavericks', 'lucidlink']
    };
    
    const response = await api.post('/droplets', dropletData);
    
    console.log(`Droplet creation initiated. Droplet ID: ${response.data.droplet.id}`);
    console.log(`Name: ${response.data.droplet.name}`);
    console.log('The droplet is being provisioned. It may take a few minutes to complete.');
    console.log('Once ready, you can access it via SSH and configure LucidLink.');
    
    // Wait for droplet to be active and get its IP
    console.log('Waiting for droplet to be ready...');
    let droplet;
    let attempts = 0;
    
    while (attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await api.get(`/droplets/${response.data.droplet.id}`);
      droplet = statusResponse.data.droplet;
      
      if (droplet.status === 'active') {
        const ipv4 = droplet.networks.v4.find(network => network.type === 'public');
        
        if (ipv4) {
          console.log(`\nDroplet is ready!`);
          console.log(`IP Address: ${ipv4.ip_address}`);
          console.log(`\nConnect via SSH: ssh root@${ipv4.ip_address}`);
          console.log(`\nSet up DNS: Create an A record for lucidlink.motionmavericks.com.au pointing to ${ipv4.ip_address}`);
          
          // Update .env.local with LucidLink server URL
          console.log('\nUpdating .env.local with LucidLink information...');
          const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
          const updatedEnvContent = envContent
            .replace(/LUCIDLINK_ENABLED=false/, 'LUCIDLINK_ENABLED=true')
            .replace(/LUCIDLINK_SERVER_URL=https:\/\/lucidlink-api\.yourdomain\.com/, 
                      `LUCIDLINK_SERVER_URL=https://lucidlink.motionmavericks.com.au`);
          
          fs.writeFileSync(path.join(__dirname, '..', '.env.local'), updatedEnvContent);
          
          break;
        }
      }
      
      console.log(`Droplet status: ${droplet.status}. Waiting...`);
      attempts++;
    }
    
    if (attempts >= 20) {
      console.log('Timed out waiting for droplet to be ready. Check the Digital Ocean dashboard for status.');
    }
    
  } catch (error) {
    console.error('Error creating droplet:', error.response?.data || error.message);
  }
}

// Execute
createDroplet(); 