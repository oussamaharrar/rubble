import type { NextConfig } from 'next';
import { PUBLIC_ENV } from './lib/env';

const nextConfig: NextConfig = {
  env: PUBLIC_ENV,
  webpack: (config) => {
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('pino-pretty', 'lokijs', 'encoding');
    }
    return config;
  },
};

export default nextConfig;
