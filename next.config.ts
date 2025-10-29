import type { NextConfig } from 'next';
import { getPublicEnv } from './lib/env';

const shouldNoIndex = (() => {
  const raw = process.env.SITE_NOINDEX;
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return false;
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
  headers: async () => {
    if (!shouldNoIndex) {
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
