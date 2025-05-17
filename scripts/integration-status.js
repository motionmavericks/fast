// Script to check the status of all integrations
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const { S3Client, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function checkR2Access() {
  try {
    console.log('Testing R2 access...');
    
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.CLOUDFLARE_ACCOUNT_ID) {
      console.log('❌ R2 credentials missing in .env.local');
      return false;
    }
    
    // R2 configuration
    const r2Config = {
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    };
    
    const client = new S3Client(r2Config);
    
    // List buckets
    const listBucketsCmd = new ListBucketsCommand({});
    const bucketsResult = await client.send(listBucketsCmd);
    
    if (bucketsResult.Buckets && bucketsResult.Buckets.length > 0) {
      console.log(`✅ R2 access successful. Found ${bucketsResult.Buckets.length} bucket(s).`);
      return true;
    } else {
      console.log('⚠️ R2 access successful but no buckets found.');
      return true;
    }
  } catch (error) {
    console.error('❌ R2 access failed:', error.message);
    return false;
  }
}

async function checkWasabiAccess() {
  try {
    console.log('Testing Wasabi access...');
    
    if (!process.env.WASABI_ACCESS_KEY_ID || !process.env.WASABI_SECRET_ACCESS_KEY || !process.env.WASABI_REGION || !process.env.WASABI_ENDPOINT) {
      console.log('❌ Wasabi credentials missing in .env.local');
      return false;
    }
    
    // Wasabi configuration
    const wasabiConfig = {
      region: process.env.WASABI_REGION,
      endpoint: process.env.WASABI_ENDPOINT,
      credentials: {
        accessKeyId: process.env.WASABI_ACCESS_KEY_ID,
        secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY,
      },
    };
    
    const client = new S3Client(wasabiConfig);
    
    // List buckets
    const listBucketsCmd = new ListBucketsCommand({});
    const bucketsResult = await client.send(listBucketsCmd);
    
    if (bucketsResult.Buckets && bucketsResult.Buckets.length > 0) {
      console.log(`✅ Wasabi access successful. Found ${bucketsResult.Buckets.length} bucket(s).`);
      return true;
    } else {
      console.log('⚠️ Wasabi access successful but no buckets found.');
      return true;
    }
  } catch (error) {
    console.error('❌ Wasabi access failed:', error.message);
    return false;
  }
}

async function checkLucidLinkAccess() {
  try {
    console.log('Testing LucidLink access...');
    
    if (!process.env.LUCIDLINK_SERVER_URL || !process.env.LUCIDLINK_API_TOKEN) {
      console.log('❌ LucidLink credentials missing in .env.local');
      return false;
    }
    
    // Check health endpoint
    const response = await axios({
      method: 'get',
      url: `${process.env.LUCIDLINK_SERVER_URL}/health`,
      headers: {
        'Authorization': `Bearer ${process.env.LUCIDLINK_API_TOKEN}`
      }
    });
    
    if (response.data.status === 'healthy') {
      console.log('✅ LucidLink access successful.');
      return true;
    } else {
      console.log('⚠️ LucidLink access successful but server reported non-healthy status.');
      return false;
    }
  } catch (error) {
    console.error('❌ LucidLink access failed:', error.response?.data || error.message);
    return false;
  }
}

async function checkFrameioAccess() {
  try {
    console.log('Testing Frame.io access...');
    
    if (!process.env.FRAMEIO_TOKEN) {
      console.log('❌ Frame.io token missing in .env.local');
      return false;
    }
    
    if (!process.env.FRAMEIO_TEAM_ID) {
      console.log('⚠️ Frame.io team ID missing in .env.local');
    }
    
    // Check /me endpoint
    const response = await axios({
      method: 'get',
      url: 'https://api.frame.io/v4/me',
      headers: {
        'Authorization': `Bearer ${process.env.FRAMEIO_TOKEN}`,
        'X-Api-Version': '4'
      }
    });
    
    if (response.data && response.data.id) {
      console.log(`✅ Frame.io access successful. Account: ${response.data.name}`);
      return true;
    } else {
      console.log('⚠️ Frame.io access successful but could not retrieve account details.');
      return false;
    }
  } catch (error) {
    console.error('❌ Frame.io access failed:', error.response?.data || error.message);
    return false;
  }
}

async function checkDigitalOceanAccess() {
  try {
    console.log('Testing DigitalOcean access...');
    
    if (!process.env.DIGITAL_OCEAN_TOKEN) {
      console.log('❌ DigitalOcean token missing in .env.local');
      return false;
    }
    
    // Timeout for DigitalOcean API calls
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    // Try to fetch the droplet directly
    const response = await axios({
      method: 'get',
      url: 'https://api.digitalocean.com/v2/droplets/496359024',
      headers: {
        'Authorization': `Bearer ${process.env.DIGITAL_OCEAN_TOKEN}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.data && response.data.droplet) {
      console.log(`✅ DigitalOcean access successful. Droplet: ${response.data.droplet.name}`);
      return true;
    } else {
      console.log('⚠️ DigitalOcean access successful but could not retrieve droplet details.');
      return false;
    }
  } catch (error) {
    if (error.code === 'ERR_CANCELED') {
      console.error('❌ DigitalOcean access timed out. This might be due to network issues or firewall restrictions.');
    } else {
      console.error('❌ DigitalOcean access failed:', error.response?.data || error.message);
    }
    return false;
  }
}

async function checkAllIntegrations() {
  console.log('==========================================');
  console.log('CHECKING ALL INTEGRATIONS');
  console.log('==========================================\n');
  
  const results = {
    r2: await checkR2Access(),
    wasabi: await checkWasabiAccess(),
    lucidlink: await checkLucidLinkAccess(),
    frameio: await checkFrameioAccess(),
    digitalocean: await checkDigitalOceanAccess()
  };
  
  console.log('\n==========================================');
  console.log('INTEGRATION STATUS SUMMARY');
  console.log('==========================================');
  
  console.log(`R2: ${results.r2 ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`Wasabi: ${results.wasabi ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`LucidLink: ${results.lucidlink ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`Frame.io: ${results.frameio ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`DigitalOcean: ${results.digitalocean ? '✅ WORKING' : '❌ FAILED'}`);
  
  const workingCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  console.log('\n==========================================');
  console.log(`OVERALL STATUS: ${workingCount}/${totalCount} integrations working`);
  
  if (workingCount === totalCount) {
    console.log('✅ All integrations are working!');
  } else if (workingCount >= totalCount * 0.8) {
    console.log('⚠️ Most integrations are working, but some need attention.');
  } else {
    console.log('❌ Multiple integrations are not working properly.');
  }
  console.log('==========================================');
  
  // Return recommendations based on failures
  if (workingCount < totalCount) {
    console.log('\nRECOMMENDATIONS:');
    
    if (!results.r2) {
      console.log('- Check your R2 credentials in .env.local');
      console.log('- Verify that your Cloudflare account ID is correct');
      console.log('- Confirm R2 bucket "mavericks" exists in your account');
    }
    
    if (!results.wasabi) {
      console.log('- Verify your Wasabi credentials in .env.local');
      console.log('- Confirm the Wasabi region and endpoint settings are correct');
      console.log('- Check if your Wasabi bucket "fast" exists');
    }
    
    if (!results.lucidlink) {
      console.log('- Ensure your LucidLink server is running at the URL specified in .env.local');
      console.log('- Verify the LucidLink API token is valid');
      console.log('- Check if the server is accessible from your location');
    }
    
    if (!results.frameio) {
      console.log('- Your Frame.io token appears to be invalid or expired');
      console.log('- Try generating a new token through the Adobe Developer Console');
      console.log('- Make sure the OAuth application has the correct permissions');
      console.log('- Update the FRAMEIO_TOKEN in .env.local with a new valid token');
    }
    
    if (!results.digitalocean) {
      console.log('- There may be network connectivity issues reaching the DigitalOcean API');
      console.log('- Check if your network or firewall is blocking access to api.digitalocean.com');
      console.log('- Verify your DigitalOcean API token has the correct permissions');
    }
  }
}

checkAllIntegrations(); 