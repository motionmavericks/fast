const https = require('https');

// Configuration
const config = {
  apiToken: 'RXtWUR9gA1HUYeOJTNYkNx3TQhsaIrt4fKA6SIKV',
  zoneId: '8ae3cbc2b5f90fdd675ae731c9b68a08',
  subdomain: 'lucid',
  ipAddress: '209.38.25.245'
};

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      
      // Log status code
      console.log(`Status Code: ${res.statusCode}`);
      console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
      
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedBody = JSON.parse(responseBody);
          resolve({ statusCode: res.statusCode, body: parsedBody });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      const stringData = JSON.stringify(data);
      console.log('Request Data:', stringData);
      req.write(stringData);
    }
    
    req.end();
  });
}

async function createDnsRecord() {
  try {
    // First verify we can access the zone
    console.log('Checking zone access...');
    const zoneResponse = await makeRequest(
      'GET', 
      `/client/v4/zones/${config.zoneId}`
    );
    
    console.log('Zone Response:', JSON.stringify(zoneResponse.body, null, 2));
    
    if (!zoneResponse.body.success) {
      console.error('Failed to access zone:', zoneResponse.body.errors);
      return;
    }
    
    console.log(`✅ Zone access confirmed: ${zoneResponse.body.result.name}`);
    
    // Create the DNS record
    const recordData = {
      type: 'A',
      name: config.subdomain,
      content: config.ipAddress,
      ttl: 1, // Auto
      proxied: false // Direct connection
    };
    
    console.log('Creating DNS record...');
    const recordResponse = await makeRequest(
      'POST', 
      `/client/v4/zones/${config.zoneId}/dns_records`,
      recordData
    );
    
    if (!recordResponse.body.success) {
      console.error('Failed to create DNS record:', recordResponse.body.errors);
      return;
    }
    
    console.log('✅ DNS record created successfully!');
    console.log('Record Details:', JSON.stringify(recordResponse.body.result, null, 2));
    console.log(`\nYou can now access your LucidLink server at: lucid.motionmavericks.com.au`);
    console.log('DNS propagation may take a few minutes to complete.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createDnsRecord(); 