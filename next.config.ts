import type { NextConfig } from 'next';
import { getPublicEnv } from './lib/env';

const nextConfig: NextConfig = {
  env: getPublicEnv(),
  webpack: (config) => {
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('pino-pretty', 'lokijs', 'encoding');
    }
    return config;
  },
};

export default nextConfig;
