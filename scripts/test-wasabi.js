// Test script for Wasabi access
require('dotenv').config({ path: '.env.local' });

const { S3Client, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

// Wasabi configuration from environment variables
const wasabiConfig = {
  region: process.env.WASABI_REGION,
  endpoint: process.env.WASABI_ENDPOINT,
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY_ID,
    secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY,
  },
};

async function testWasabiAccess() {
  try {
    console.log('Testing Wasabi access...');
    const client = new S3Client(wasabiConfig);

    console.log('Listing buckets...');
    const listBucketsCmd = new ListBucketsCommand({});
    const bucketsResult = await client.send(listBucketsCmd);
    
    console.log('Buckets:', JSON.stringify(bucketsResult.Buckets, null, 2));
    
    console.log(`Listing objects in bucket "${process.env.WASABI_BUCKET_NAME}"...`);
    const listObjectsCmd = new ListObjectsV2Command({
      Bucket: process.env.WASABI_BUCKET_NAME,
      MaxKeys: 10,
    });
    
    const objectsResult = await client.send(listObjectsCmd);
    console.log('Objects:', JSON.stringify(objectsResult.Contents, null, 2));
    
    console.log('Wasabi access test successful!');
  } catch (error) {
    console.error('Error testing Wasabi access:', error);
  }
}

testWasabiAccess(); 