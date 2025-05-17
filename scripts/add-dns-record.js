const https = require('https');

// Configuration
const config = {
  apiKey: 'RXtWUR9gA1HUYeOJTNYkNx3TQhsaIrt4fKA6SIKV',
  email: 'oweninnes@motionmavericks.com.au', // Updated with correct email
  domainName: 'motionmavericks.com.au',
  subdomain: 'lucid',
  ipAddress: '209.38.25.245'
};

function makeRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: endpoint,
      method: method,
      headers: {
        'X-Auth-Key': config.apiKey,
        'X-Auth-Email': config.email,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedBody = JSON.parse(responseBody);
          resolve(parsedBody);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function addDnsRecord() {
  try {
    // Fetch zones
    console.log('Fetching zones...');
    const zonesResponse = await makeRequest('GET', '/client/v4/zones');
    
    if (!zonesResponse.success) {
      console.error('Failed to fetch zones:', zonesResponse.errors);
      return;
    }
    
    console.log(`Found ${zonesResponse.result.length} zones`);
    
    // Find the zone for our domain
    const zone = zonesResponse.result.find(z => z.name === config.domainName);
    
    if (!zone) {
      console.error(`Zone for ${config.domainName} not found!`);
      console.log('Available zones:');
      zonesResponse.result.forEach(z => console.log(` - ${z.name}`));
      return;
    }
    
    console.log(`Found zone: ${zone.name} with ID: ${zone.id}`);
    
    // Create the DNS record
    const dnsData = {
      type: 'A',
      name: config.subdomain,
      content: config.ipAddress,
      ttl: 1, // Auto
      proxied: false // Direct connection
    };
    
    console.log('Creating DNS record...');
    const dnsResponse = await makeRequest(
      'POST', 
      `/client/v4/zones/${zone.id}/dns_records`,
      dnsData
    );
    
    if (!dnsResponse.success) {
      console.error('Failed to create DNS record:', dnsResponse.errors);
      return;
    }
    
    console.log('✅ DNS record created successfully!');
    console.log(`Record ID: ${dnsResponse.result.id}`);
    console.log(`Full domain: ${dnsResponse.result.name}`);
    console.log(`Points to: ${dnsResponse.result.content}`);
    console.log('\nYou can now access your LucidLink server at:');
    console.log(`https://${config.subdomain}.${config.domainName}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

addDnsRecord(); 