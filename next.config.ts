import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  serverExternalPackages: ['mongoose'],
  // Increase timeout for API routes to handle large file operations
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Enable media streaming support
  images: {
    domains: [
      'assets.frame.io',
      process.env.R2_PUBLIC_DOMAIN || 'your-r2-public-domain.com', // Use the environment variable
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.frame.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.wasabisys.com',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    // Handle various file types properly
    config.module.rules.push({
      test: /\.(pdf|mov|mp4|webm|mxf|mp3|wav)$/i,
      type: 'asset/resource',
    });
    
    return config;
  },
};

export default nextConfig;
