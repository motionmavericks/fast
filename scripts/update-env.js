// Script to update environment variables
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function updateEnvFile() {
  try {
    console.log('Checking and updating environment variables...');
    
    // Path to .env.local file
    const envFilePath = path.join(process.cwd(), '.env.local');
    
    // Read the current content
    let envContent = fs.readFileSync(envFilePath, 'utf8');
    const originalContent = envContent;
    
    // Updates to make
    const updates = [];
    
    // Check for FRAMEIO_TEAM_ID (this was empty)
    if (!process.env.FRAMEIO_TEAM_ID) {
      // Suggest the correct workspace ID
      const workspaceId = '7d26ab6d-b39e-4a99-a4b9-9cdcf6208009'; // Use this as default if we don't have a better source
      
      // Update the environment variable in the file
      if (envContent.includes('FRAMEIO_TEAM_ID=')) {
        // Replace existing empty value
        envContent = envContent.replace(/FRAMEIO_TEAM_ID=(\s|$)/m, `FRAMEIO_TEAM_ID=${workspaceId}$1`);
        updates.push(`Updated FRAMEIO_TEAM_ID to ${workspaceId}`);
      } else {
        // Add new variable if it doesn't exist
        envContent += `\nFRAMEIO_TEAM_ID=${workspaceId}`;
        updates.push(`Added FRAMEIO_TEAM_ID=${workspaceId}`);
      }
    }
    
    // Fix any line break issues that might be causing problems
    envContent = envContent.replace(/\r\n/g, '\n').replace(/\\\n/g, '');
    
    // Only write the file if changes were made
    if (envContent !== originalContent) {
      fs.writeFileSync(envFilePath, envContent);
      console.log('✅ Updated .env.local file with the following changes:');
      updates.forEach(update => console.log(`  - ${update}`));
    } else {
      console.log('No changes needed to .env.local file.');
    }
    
    console.log('\nEnvironment variable update complete!');
  } catch (error) {
    console.error('Error updating environment variables:', error);
  }
}

updateEnvFile(); 