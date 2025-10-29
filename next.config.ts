import type { NextConfig } from 'next';
import { getPublicEnv } from './lib/env';

const noIndexFlag = (() => {
  const value = process.env.NOINDEX ?? process.env.NEXT_PUBLIC_NOINDEX;
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
})();

const nextConfig: NextConfig = {
  env: getPublicEnv(),
  webpack: (config) => {
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('pino-pretty', 'lokijs', 'encoding');
    }
    return config;
  },
  async headers() {
    if (!noIndexFlag) {
      return [];
    }
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
