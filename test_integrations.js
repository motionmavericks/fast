// test_integrations.js
// Script to test all integration services in the Fast app

// Need to use global-fetch for Node.js compatibility
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Base URL for API
const BASE_URL = 'http://localhost:3000';

// Test different services
async function testAll() {
  console.log('Testing all integration services...\n');
  
  try {
    // Initialize services first
    await testInit();
    
    // Test each service
    await testR2();
    await testWasabi();
    await testLucidLink();
    await testFrameIo();
    
    console.log('\nAll tests completed.');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Initialize services
async function testInit() {
  console.log('=== Initializing Services ===');
  try {
    const response = await fetch(`${BASE_URL}/api/init`);
    const data = await response.json();
    
    console.log(`Services initialized: ${data.initialized}`);
    console.log(`Message: ${data.message}`);
    console.log('-----------------------------------');
    
    return data.initialized;
  } catch (error) {
    console.error('Error initializing services:', error);
    return false;
  }
}

// Test R2 connection
async function testR2() {
  console.log('=== Testing R2 Connection ===');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/settings/test/r2`, {
      method: 'POST'
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Message: ${data.message || 'No message'}`);
    console.log('-----------------------------------');
    
    return response.ok;
  } catch (error) {
    console.error('Error testing R2:', error);
    return false;
  }
}

// Test Wasabi connection
async function testWasabi() {
  console.log('=== Testing Wasabi Connection ===');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/settings/test/wasabi`, {
      method: 'POST'
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Message: ${data.message || 'No message'}`);
    console.log('-----------------------------------');
    
    return response.ok;
  } catch (error) {
    console.error('Error testing Wasabi:', error);
    return false;
  }
}

// Test LucidLink connection
async function testLucidLink() {
  console.log('=== Testing LucidLink Connection ===');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/settings/test/lucidlink`, {
      method: 'POST'
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Message: ${data.message || 'No message'}`);
    console.log('-----------------------------------');
    
    return response.ok;
  } catch (error) {
    console.error('Error testing LucidLink:', error);
    return false;
  }
}

// Test Frame.io connection
async function testFrameIo() {
  console.log('=== Testing Frame.io Connection ===');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/settings/test/frameio`, {
      method: 'POST'
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Message: ${data.message || 'No message'}`);
    
    // If we got 401, test the login flow
    if (response.status === 401) {
      console.log('\nFrame.io authentication required. Testing status endpoint...');
      const statusResponse = await fetch(`${BASE_URL}/api/status/frameio`);
      const statusData = await statusResponse.json();
      console.log(`Status: ${statusData.status}`);
      console.log(`Message: ${statusData.message}`);
      
      // Check if OAuth is configured
      if (statusData.config?.hasClientId && statusData.config?.hasClientSecret) {
        console.log('\nOAuth is configured. You can try the OAuth flow at:');
        console.log(`${BASE_URL}/api/auth/frameio/login`);
      }
    }
    
    console.log('-----------------------------------');
    return response.ok;
  } catch (error) {
    console.error('Error testing Frame.io:', error);
    return false;
  }
}

// Run all tests
testAll(); 