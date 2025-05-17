/**
 * Test script for the Cloudflare Worker
 * 
 * This script can be used to test the Cloudflare Worker locally with miniflare
 * or to send test requests to a deployed worker.
 * 
 * Requirements:
 * - Node.js
 * - miniflare: npm install -g miniflare
 * 
 * Usage (local testing):
 * - miniflare cloudflare-worker.js --kv KV_STORAGE --r2 R2_BUCKET --env .env.local
 * - node test-worker.js
 */

// Test configuration
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-webhook-secret';
const CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret';

// Helper function to make requests to the worker
async function testWorkerEndpoint(path, method = 'GET', body = null, headers = {}) {
  console.log(`Testing ${method} ${WORKER_URL}${path}`);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${WORKER_URL}${path}`, options);
    const responseData = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(responseData, null, 2));
    console.log('-----------------------------------');
    
    return { status: response.status, data: responseData };
  } catch (error) {
    console.error('Error:', error);
    return { error };
  }
}

// Test functions for each endpoint
async function testStatus() {
  return testWorkerEndpoint('/status');
}

async function testFrameIoWebhook() {
  const mockAssetData = {
    id: 'mock-asset-id',
    name: 'test-file.mp4',
    filesize: 10485760, // 10MB
    type: 'file',
    status: 'complete',
  };
  
  return testWorkerEndpoint('/webhook/frameio', 'POST', {
    type: 'asset.ready',
    data: mockAssetData
  }, {
    'X-Webhook-Secret': WEBHOOK_SECRET
  });
}

async function testProxyWebhook() {
  const mockProxyData = {
    asset_id: 'mock-asset-id',
    profile: 'h264_540p',
    urls: {
      ssl_url: 'https://example.com/test-proxy.mp4'
    }
  };
  
  return testWorkerEndpoint('/webhook/frameio', 'POST', {
    type: 'proxy.ready',
    data: mockProxyData
  }, {
    'X-Webhook-Secret': WEBHOOK_SECRET
  });
}

async function testOriginalFileArchival() {
  return testWorkerEndpoint('/archive/original', 'POST', {
    assetId: 'mock-asset-id',
    fileId: 'mock-file-id'
  }, {
    'Authorization': `Bearer ${CRON_SECRET}`
  });
}

async function testLifecycleCleanup() {
  return testWorkerEndpoint('/lifecycle/cleanup', 'POST', {}, {
    'Authorization': `Bearer ${CRON_SECRET}`
  });
}

// Run tests
async function runTests() {
  console.log('Testing Cloudflare Worker Endpoints...');
  console.log('===================================');
  
  // Test status endpoint
  await testStatus();
  
  // Test Frame.io webhook endpoints
  // Uncomment these for full testing - they will make actual API calls
  // await testFrameIoWebhook();
  // await testProxyWebhook();
  
  // Test archival endpoints
  // Uncomment these for full testing - they will make actual API calls
  // await testOriginalFileArchival();
  // await testLifecycleCleanup();
  
  console.log('Tests completed!');
}

runTests().catch(console.error); 