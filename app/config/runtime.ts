const DEFAULTS = {
  walletRequired: true,
  trialEnabled: true,
  priceMin: 0.01,
  priceMax: 0.05,
} as const;

type RuntimeConfig = {
  walletRequired: boolean;
  trialEnabled: boolean;
  priceMin: number;
  priceMax: number;
};

let cached: RuntimeConfig | null = null;
let logged = false;

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseNumber(value: string | undefined, fallback: number) {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseFloat(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
}

function logConfig(config: RuntimeConfig) {
  if (logged || typeof console === 'undefined') return;
  logged = true;
  const envSummary = {
    NEXT_PUBLIC_WALLET_REQUIRED: process.env.NEXT_PUBLIC_WALLET_REQUIRED ? 'present' : 'absent',
    NEXT_PUBLIC_TRIAL_ENABLED: process.env.NEXT_PUBLIC_TRIAL_ENABLED ? 'present' : 'absent',
    NEXT_PUBLIC_PRICE_MIN: process.env.NEXT_PUBLIC_PRICE_MIN ? 'present' : 'absent',
    NEXT_PUBLIC_PRICE_MAX: process.env.NEXT_PUBLIC_PRICE_MAX ? 'present' : 'absent',
  } as const;
  if (process.env.NODE_ENV !== 'production') {
    console.info('[runtime-config]', { env: envSummary, config });
  } else {
    console.info('[runtime-config]', { env: envSummary });
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  if (cached) {
    return cached;
  }
  const config: RuntimeConfig = {
    walletRequired: parseBoolean(process.env.NEXT_PUBLIC_WALLET_REQUIRED, DEFAULTS.walletRequired),
    trialEnabled: parseBoolean(process.env.NEXT_PUBLIC_TRIAL_ENABLED, DEFAULTS.trialEnabled),
    priceMin: parseNumber(process.env.NEXT_PUBLIC_PRICE_MIN, DEFAULTS.priceMin),
    priceMax: parseNumber(process.env.NEXT_PUBLIC_PRICE_MAX, DEFAULTS.priceMax),
  };
  cached = config;
  logConfig(config);
  return config;
}
