// Test script for R2 access
require('dotenv').config({ path: '.env.local' });

const { S3Client, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

// R2 configuration from environment variables
const r2Config = {
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
};

async function testR2Access() {
  try {
    console.log('Testing R2 access...');
    const client = new S3Client(r2Config);

    console.log('Listing buckets...');
    const listBucketsCmd = new ListBucketsCommand({});
    const bucketsResult = await client.send(listBucketsCmd);
    
    console.log('Buckets:', JSON.stringify(bucketsResult.Buckets, null, 2));
    
    console.log(`Listing objects in bucket "${process.env.R2_BUCKET_NAME}"...`);
    const listObjectsCmd = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      MaxKeys: 10,
    });
    
    const objectsResult = await client.send(listObjectsCmd);
    console.log('Objects:', JSON.stringify(objectsResult.Contents, null, 2));
    
    console.log('R2 access test successful!');
  } catch (error) {
    console.error('Error testing R2 access:', error);
  }
}

testR2Access(); 