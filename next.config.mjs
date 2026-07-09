import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const packageJson = require('./package.json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose app version to the client for version checking
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  // Mobile export only when explicitly requested
  output: process.env.MOBILE_BUILD === 'true' ? 'export' : undefined,
  // Enable gzip compression for all responses
  compress: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    if (process.env.MOBILE_BUILD === 'true') {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { 
            key: "Content-Security-Policy", 
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://accounts.google.com https://apis.google.com; frame-src 'self' https://accounts.google.com;" 
          }
        ]
      }
    ];
  }
};

export default nextConfig;
