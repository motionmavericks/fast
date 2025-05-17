const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs-extra');
const jwt = require('jsonwebtoken');
const { expressjwt } = require('express-jwt');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || '4fe9a6bb8e41c47cd693cc517f09460aa0e3efa92b03a41e97cd95c0b358c261';
const LUCIDLINK_BASE_PATH = '/mnt/lucidlink/motionmavericks';

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
      throw new Error(`Failed to download file: ${response.statusText}`);
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
  console.log(`LucidLink API server running on port ${PORT}`);
}); 