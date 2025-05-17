// Script to test DigitalOcean API token
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

// Configuration
const DO_TOKEN = process.env.DIGITAL_OCEAN_TOKEN;

console.log('Testing DigitalOcean API connection...');
console.log(`Token exists: ${Boolean(DO_TOKEN)}`);
console.log(`Token starts with: ${DO_TOKEN ? DO_TOKEN.substring(0, 10) + '...' : 'N/A'}`);

// DigitalOcean API client
const api = axios.create({
  baseURL: 'https://api.digitalocean.com/v2',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DO_TOKEN}`
  }
});

// Test API Connection
async function testConnection() {
  try {
    // First, try to get account info
    console.log('\nFetching account information...');
    const accountResponse = await api.get('/account');
    console.log('Account information:');
    console.log(`Email: ${accountResponse.data.account.email}`);
    console.log(`Droplet Limit: ${accountResponse.data.account.droplet_limit}`);
    console.log(`Status: ${accountResponse.data.account.status}`);
    
    // Next, list existing droplets
    console.log('\nFetching existing droplets...');
    const dropletsResponse = await api.get('/droplets');
    console.log(`Found ${dropletsResponse.data.droplets.length} existing droplets:`);
    
    dropletsResponse.data.droplets.forEach(droplet => {
      console.log(`- ${droplet.name} (ID: ${droplet.id}, Status: ${droplet.status})`);
      
      // Get the public IPv4 address if available
      const ipv4 = droplet.networks.v4.find(network => network.type === 'public');
      if (ipv4) {
        console.log(`  IP Address: ${ipv4.ip_address}`);
      }
    });
    
    // List available regions
    console.log('\nFetching available regions...');
    const regionsResponse = await api.get('/regions');
    console.log('Available regions:');
    regionsResponse.data.regions
      .filter(region => region.available)
      .slice(0, 5) // Just show the first 5 to avoid too much output
      .forEach(region => {
        console.log(`- ${region.name} (${region.slug})`);
      });
    
    console.log('\nDigitalOcean API connection successful!');
    return true;
  } catch (error) {
    console.error('Error connecting to DigitalOcean API:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
      
      if (error.response.status === 401) {
        console.error('\nAuthentication Error: Your DigitalOcean token appears to be invalid.');
        console.error('Please check your DIGITAL_OCEAN_TOKEN in .env.local and ensure it is a valid API token.');
        console.error('You can create a new token at: https://cloud.digitalocean.com/account/api/tokens');
      }
    } else if (error.request) {
      console.error('No response received from DigitalOcean API.');
      console.error('Check your internet connection or if the DigitalOcean API is down.');
    } else {
      console.error('Error setting up request:', error.message);
    }
    return false;
  }
}

// Execute
testConnection(); 