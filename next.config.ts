import type { NextConfig } from 'next';
import { getPublicEnv } from './lib/env';
import { readSiteConfig } from './lib/site-config';

const siteConfig = readSiteConfig();

const nextConfig: NextConfig = {
  env: getPublicEnv(),
  webpack: (config) => {
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('pino-pretty', 'lokijs', 'encoding');
    }
    return config;
  },
  headers: async () => {
    if (!siteConfig.noindex) {
      return [];
    }
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
      },
    ];
  },
};

export default nextConfig;
