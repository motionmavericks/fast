const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function testToken(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: '/client/v4/zones',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
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
    
    req.end();
  });
}

console.log('Cloudflare API Token Test Utility');
console.log('=================================');
console.log('');

rl.question('Paste your Cloudflare API token here: ', async (token) => {
  if (!token.trim()) {
    console.log('Error: Token cannot be empty.');
    rl.close();
    return;
  }

  try {
    console.log('Testing token...');
    const response = await testToken(token.trim());
    
    if (response.success) {
      console.log('✅ Success! Your token is working correctly.');
      console.log(`Found ${response.result.length} zones in your account.`);
      
      if (response.result.length > 0) {
        console.log('\nAvailable zones:');
        response.result.forEach(zone => {
          console.log(` - ${zone.name} (${zone.id})`);
        });

        // Check specifically for motionmavericks.com.au
        const targetZone = response.result.find(z => z.name === 'motionmavericks.com.au');
        if (targetZone) {
          console.log('\n✅ Found motionmavericks.com.au zone! You can proceed with DNS setup.');
        } else {
          console.log('\n❌ motionmavericks.com.au zone not found in your account.');
        }
      }
    } else {
      console.log('❌ Error testing token:');
      console.log(JSON.stringify(response.errors, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  rl.close();
}); 