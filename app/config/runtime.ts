const DEFAULTS = {
  walletRequired: true,
  trialEnabled: true,
  priceMin: '0.01',
  priceMax: '0.05',
} as const;

type RuntimeConfig = {
  walletRequired: boolean;
  trialEnabled: boolean;
  priceMin: string;
  priceMax: string;
};

let cachedConfig: RuntimeConfig | null = null;

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizePrice(value: string | undefined, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const numeric = Number.parseFloat(trimmed);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric.toFixed(2);
  }
  return fallback;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }
  const nextConfig: RuntimeConfig = {
    walletRequired: parseBoolean(process.env.NEXT_PUBLIC_WALLET_REQUIRED, DEFAULTS.walletRequired),
    trialEnabled: parseBoolean(process.env.NEXT_PUBLIC_TRIAL_ENABLED, DEFAULTS.trialEnabled),
    priceMin: normalizePrice(process.env.NEXT_PUBLIC_PRICE_MIN, DEFAULTS.priceMin),
    priceMax: normalizePrice(process.env.NEXT_PUBLIC_PRICE_MAX, DEFAULTS.priceMax),
  };
  cachedConfig = nextConfig;
  return nextConfig;
}

export function getRuntimeConfigSnapshot() {
  const config = getRuntimeConfig();
  return {
    walletRequired: config.walletRequired,
    trialEnabled: config.trialEnabled,
    priceMin: config.priceMin,
    priceMax: config.priceMax,
  };
}

export function logRuntimeConfig() {
  const snapshot = getRuntimeConfigSnapshot();
  const masked = Object.entries(snapshot)
    .map(([key, value]) => `  - ${key}: ${typeof value === 'boolean' ? value : `$${value}`}`)
    .join('\n');
  console.log('[rubble] runtime config\n' + masked);
}

export type { RuntimeConfig };
