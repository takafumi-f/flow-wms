import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['postgres', 'ioredis'],
};

export default nextConfig;
