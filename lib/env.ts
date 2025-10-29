import { z } from 'zod';

type ParsedEnv = {
  env: Env;
  publicEnv: PublicEnv;
};

let cachedEnv: ParsedEnv | null = null;

const url = z.string().url();
const evmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a valid 0x-prefixed EVM address');
const integerString = z
  .string()
  .regex(/^\d+$/u, 'Expected a non-negative integer string');
const relativeOrAbsolute = z
  .string()
  .min(1, 'Expected a non-empty string')
  .refine((value) => {
    if (value.startsWith('/')) {
      return true;
    }
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, 'Expected a relative path beginning with / or an absolute URL');
const optionalString = z.string().min(1).optional();
const booleanFlag = z.enum(['0', '1']);

type RawEnv = {
  NEXT_PUBLIC_URL: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_WEBHOOK_URL: string;
  NEXT_PUBLIC_BASE_RPC_URL: string;
  NEXT_PUBLIC_MIN_PRICE_WEI: string;
  BASE_RPC_URL: string;
  PAY_TO_ADDRESS: string;
  MIN_PRICE_WEI: string;
  PUBLIC_OWNER_ADDRESS?: string;
  FARCASTER_ACCOUNT_HEADER?: string;
  FARCASTER_ACCOUNT_PAYLOAD?: string;
  FARCASTER_ACCOUNT_SIGNATURE?: string;
  PAYMENTS_API_BASE?: string;
  PAYMENTS_API_KEY_ID?: string;
  PAYMENTS_API_SECRET?: string;
  PAYMENTS_WEBHOOK_SECRET?: string;
  BASE_PAY_MOCK: string;
  BASE_BUILDER_OWNER_ADDRESS?: string;
  NEXT_PUBLIC_WALLET_REQUIRED?: string;
  NEXT_PUBLIC_TRIAL_ENABLED?: string;
  NEXT_PUBLIC_PRICE_MIN?: string;
  NEXT_PUBLIC_PRICE_MAX?: string;
  TRIAL_SIGN_KEY?: string;
  NOINDEX?: string;
};

const DEFAULT_RAW: RawEnv = {
  NEXT_PUBLIC_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SITE_URL: undefined,
  NEXT_PUBLIC_WEBHOOK_URL: '/api/pay/webhook',
  NEXT_PUBLIC_BASE_RPC_URL: 'https://api.developer.coinbase.com/rpc/v1/base',
  NEXT_PUBLIC_MIN_PRICE_WEI: '1',
  BASE_RPC_URL: 'https://api.developer.coinbase.com/rpc/v1/base',
  PAY_TO_ADDRESS: '0x3F3E5e0C853C48641022a3A1D7a8D3E64B5441e0',
  MIN_PRICE_WEI: '1',
  PUBLIC_OWNER_ADDRESS: undefined,
  FARCASTER_ACCOUNT_HEADER: undefined,
  FARCASTER_ACCOUNT_PAYLOAD: undefined,
  FARCASTER_ACCOUNT_SIGNATURE: undefined,
  PAYMENTS_API_BASE: undefined,
  PAYMENTS_API_KEY_ID: undefined,
  PAYMENTS_API_SECRET: undefined,
  PAYMENTS_WEBHOOK_SECRET: undefined,
  BASE_PAY_MOCK: '0',
  BASE_BUILDER_OWNER_ADDRESS: undefined,
  NEXT_PUBLIC_WALLET_REQUIRED: undefined,
  NEXT_PUBLIC_TRIAL_ENABLED: undefined,
  NEXT_PUBLIC_PRICE_MIN: undefined,
  NEXT_PUBLIC_PRICE_MAX: undefined,
  TRIAL_SIGN_KEY: undefined,
  NOINDEX: undefined,
};

const EnvSchema = z
  .object({
    NEXT_PUBLIC_URL: url,
    NEXT_PUBLIC_SITE_URL: url.optional(),
    NEXT_PUBLIC_WEBHOOK_URL: relativeOrAbsolute,
    NEXT_PUBLIC_BASE_RPC_URL: url,
    NEXT_PUBLIC_MIN_PRICE_WEI: integerString,
    BASE_RPC_URL: url,
    PAY_TO_ADDRESS: evmAddress,
    MIN_PRICE_WEI: integerString,
    PUBLIC_OWNER_ADDRESS: evmAddress.optional(),
    FARCASTER_ACCOUNT_HEADER: optionalString,
    FARCASTER_ACCOUNT_PAYLOAD: optionalString,
    FARCASTER_ACCOUNT_SIGNATURE: optionalString,
    PAYMENTS_API_BASE: url.optional(),
    PAYMENTS_API_KEY_ID: optionalString,
    PAYMENTS_API_SECRET: optionalString,
    PAYMENTS_WEBHOOK_SECRET: optionalString,
    BASE_PAY_MOCK: booleanFlag,
    BASE_BUILDER_OWNER_ADDRESS: evmAddress.optional(),
    NEXT_PUBLIC_WALLET_REQUIRED: z.string().optional(),
    NEXT_PUBLIC_TRIAL_ENABLED: z.string().optional(),
    NEXT_PUBLIC_PRICE_MIN: z.string().optional(),
    NEXT_PUBLIC_PRICE_MAX: z.string().optional(),
    TRIAL_SIGN_KEY: optionalString,
    NOINDEX: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const accountFields = [
      value.FARCASTER_ACCOUNT_HEADER,
      value.FARCASTER_ACCOUNT_PAYLOAD,
      value.FARCASTER_ACCOUNT_SIGNATURE,
    ];
    const providedAccountFields = accountFields.filter(Boolean).length;
    if (providedAccountFields > 0 && providedAccountFields < accountFields.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'All FARCASTER_ACCOUNT_* variables must be provided together',
        path: ['FARCASTER_ACCOUNT_HEADER'],
      });
    }

    const paymentsFields: Array<string | undefined> = [
      value.PAYMENTS_API_BASE,
      value.PAYMENTS_API_KEY_ID,
      value.PAYMENTS_API_SECRET,
      value.PAYMENTS_WEBHOOK_SECRET,
    ];
    const suppliedPayments = paymentsFields.filter(Boolean).length;
    if (suppliedPayments > 0 && suppliedPayments < paymentsFields.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'When enabling Commerce/OnchainKit payments, all PAYMENTS_* variables must be provided',
        path: ['PAYMENTS_API_BASE'],
      });
    }
  });

function readRawEnv(): RawEnv {
  return {
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL ?? DEFAULT_RAW.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? undefined,
    NEXT_PUBLIC_WEBHOOK_URL:
      process.env.NEXT_PUBLIC_WEBHOOK_URL ?? DEFAULT_RAW.NEXT_PUBLIC_WEBHOOK_URL,
    NEXT_PUBLIC_BASE_RPC_URL:
      process.env.NEXT_PUBLIC_BASE_RPC_URL ??
      process.env.BASE_RPC_URL ??
      DEFAULT_RAW.NEXT_PUBLIC_BASE_RPC_URL,
    NEXT_PUBLIC_MIN_PRICE_WEI:
      process.env.NEXT_PUBLIC_MIN_PRICE_WEI ??
      process.env.MIN_PRICE_WEI ??
      DEFAULT_RAW.NEXT_PUBLIC_MIN_PRICE_WEI,
    BASE_RPC_URL:
      process.env.BASE_RPC_URL ??
      process.env.NEXT_PUBLIC_BASE_RPC_URL ??
      DEFAULT_RAW.BASE_RPC_URL,
    PAY_TO_ADDRESS: process.env.PAY_TO_ADDRESS ?? DEFAULT_RAW.PAY_TO_ADDRESS,
    MIN_PRICE_WEI:
      process.env.MIN_PRICE_WEI ??
      process.env.NEXT_PUBLIC_MIN_PRICE_WEI ??
      DEFAULT_RAW.MIN_PRICE_WEI,
    PUBLIC_OWNER_ADDRESS: process.env.PUBLIC_OWNER_ADDRESS ?? undefined,
    FARCASTER_ACCOUNT_HEADER: process.env.FARCASTER_ACCOUNT_HEADER ?? undefined,
    FARCASTER_ACCOUNT_PAYLOAD: process.env.FARCASTER_ACCOUNT_PAYLOAD ?? undefined,
    FARCASTER_ACCOUNT_SIGNATURE: process.env.FARCASTER_ACCOUNT_SIGNATURE ?? undefined,
    PAYMENTS_API_BASE: process.env.PAYMENTS_API_BASE ?? undefined,
    PAYMENTS_API_KEY_ID: process.env.PAYMENTS_API_KEY_ID ?? undefined,
    PAYMENTS_API_SECRET: process.env.PAYMENTS_API_SECRET ?? undefined,
    PAYMENTS_WEBHOOK_SECRET: process.env.PAYMENTS_WEBHOOK_SECRET ?? undefined,
    BASE_PAY_MOCK: process.env.BASE_PAY_MOCK ?? DEFAULT_RAW.BASE_PAY_MOCK,
    BASE_BUILDER_OWNER_ADDRESS: process.env.BASE_BUILDER_OWNER_ADDRESS ?? undefined,
    NEXT_PUBLIC_WALLET_REQUIRED: process.env.NEXT_PUBLIC_WALLET_REQUIRED ?? undefined,
    NEXT_PUBLIC_TRIAL_ENABLED: process.env.NEXT_PUBLIC_TRIAL_ENABLED ?? undefined,
    NEXT_PUBLIC_PRICE_MIN: process.env.NEXT_PUBLIC_PRICE_MIN ?? undefined,
    NEXT_PUBLIC_PRICE_MAX: process.env.NEXT_PUBLIC_PRICE_MAX ?? undefined,
    TRIAL_SIGN_KEY: process.env.TRIAL_SIGN_KEY ?? undefined,
    NOINDEX: process.env.NOINDEX ?? process.env.NEXT_PUBLIC_NOINDEX ?? undefined,
  };
}

function sanitizeEnv(raw: RawEnv) {
  const result = EnvSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  console.warn('[rubble] environment validation failed, falling back to defaults');
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && key in DEFAULT_RAW) {
      (raw as Record<string, unknown>)[key] = DEFAULT_RAW[key as keyof RawEnv];
    }
  }
  const retry = EnvSchema.safeParse(raw);
  if (retry.success) {
    return retry.data;
  }
  return EnvSchema.parse(DEFAULT_RAW);
}

function loadEnv(): ParsedEnv {
  if (cachedEnv) {
    return cachedEnv;
  }
  const parsed = sanitizeEnv(readRawEnv());

  const MIN_PRICE_WEI = BigInt(parsed.MIN_PRICE_WEI);
  const NEXT_PUBLIC_MIN_PRICE_WEI = parsed.NEXT_PUBLIC_MIN_PRICE_WEI ?? parsed.MIN_PRICE_WEI;

  const modeBEnabled = Boolean(
    parsed.PAYMENTS_API_BASE &&
    parsed.PAYMENTS_API_KEY_ID &&
    parsed.PAYMENTS_API_SECRET &&
    parsed.PAYMENTS_WEBHOOK_SECRET
  );

  const env: Env = {
    BASE_RPC_URL: parsed.BASE_RPC_URL,
    PAY_TO_ADDRESS: parsed.PAY_TO_ADDRESS,
    MIN_PRICE_WEI,
    MIN_PRICE_WEI_RAW: parsed.MIN_PRICE_WEI,
    PUBLIC_OWNER_ADDRESS: parsed.PUBLIC_OWNER_ADDRESS,
    FARCASTER_ACCOUNT_HEADER: parsed.FARCASTER_ACCOUNT_HEADER,
    FARCASTER_ACCOUNT_PAYLOAD: parsed.FARCASTER_ACCOUNT_PAYLOAD,
    FARCASTER_ACCOUNT_SIGNATURE: parsed.FARCASTER_ACCOUNT_SIGNATURE,
    PAYMENTS_API_BASE: parsed.PAYMENTS_API_BASE?.replace(/\/$/, ''),
    PAYMENTS_API_KEY_ID: parsed.PAYMENTS_API_KEY_ID,
    PAYMENTS_API_SECRET: parsed.PAYMENTS_API_SECRET,
    PAYMENTS_WEBHOOK_SECRET: parsed.PAYMENTS_WEBHOOK_SECRET,
    PAYMENTS_MODE_B_ENABLED: modeBEnabled,
    BASE_PAY_MOCK: parsed.BASE_PAY_MOCK,
    BASE_BUILDER_OWNER_ADDRESS:
      parsed.BASE_BUILDER_OWNER_ADDRESS ?? parsed.PAY_TO_ADDRESS,
    NEXT_PUBLIC_URL: parsed.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_SITE_URL: parsed.NEXT_PUBLIC_SITE_URL ?? parsed.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_WEBHOOK_URL: parsed.NEXT_PUBLIC_WEBHOOK_URL,
    NEXT_PUBLIC_BASE_RPC_URL: parsed.NEXT_PUBLIC_BASE_RPC_URL,
    NEXT_PUBLIC_MIN_PRICE_WEI,
    NEXT_PUBLIC_WALLET_REQUIRED: parsed.NEXT_PUBLIC_WALLET_REQUIRED,
    NEXT_PUBLIC_TRIAL_ENABLED: parsed.NEXT_PUBLIC_TRIAL_ENABLED,
    NEXT_PUBLIC_PRICE_MIN: parsed.NEXT_PUBLIC_PRICE_MIN,
    NEXT_PUBLIC_PRICE_MAX: parsed.NEXT_PUBLIC_PRICE_MAX,
    TRIAL_SIGN_KEY: parsed.TRIAL_SIGN_KEY,
    NOINDEX: parsed.NOINDEX,
  };

  const publicEnv: PublicEnv = {
    NEXT_PUBLIC_URL: parsed.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_SITE_URL: parsed.NEXT_PUBLIC_SITE_URL ?? parsed.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_WEBHOOK_URL: parsed.NEXT_PUBLIC_WEBHOOK_URL,
    NEXT_PUBLIC_BASE_RPC_URL: parsed.NEXT_PUBLIC_BASE_RPC_URL,
    NEXT_PUBLIC_MIN_PRICE_WEI,
    NEXT_PUBLIC_WALLET_REQUIRED: parsed.NEXT_PUBLIC_WALLET_REQUIRED,
    NEXT_PUBLIC_TRIAL_ENABLED: parsed.NEXT_PUBLIC_TRIAL_ENABLED,
    NEXT_PUBLIC_PRICE_MIN: parsed.NEXT_PUBLIC_PRICE_MIN,
    NEXT_PUBLIC_PRICE_MAX: parsed.NEXT_PUBLIC_PRICE_MAX,
    PAYMENTS_MODE_B_ENABLED: modeBEnabled ? '1' : '0',
  };

  cachedEnv = { env, publicEnv };
  return cachedEnv;
}

export function getEnv(): Env {
  return loadEnv().env;
}

export function getPublicEnv(): PublicEnv {
  return loadEnv().publicEnv;
}

export type Env = {
  BASE_RPC_URL: string;
  PAY_TO_ADDRESS: string;
  MIN_PRICE_WEI: bigint;
  MIN_PRICE_WEI_RAW: string;
  PUBLIC_OWNER_ADDRESS?: string;
  FARCASTER_ACCOUNT_HEADER?: string;
  FARCASTER_ACCOUNT_PAYLOAD?: string;
  FARCASTER_ACCOUNT_SIGNATURE?: string;
  PAYMENTS_API_BASE?: string;
  PAYMENTS_API_KEY_ID?: string;
  PAYMENTS_API_SECRET?: string;
  PAYMENTS_WEBHOOK_SECRET?: string;
  PAYMENTS_MODE_B_ENABLED: boolean;
  BASE_PAY_MOCK: string;
  BASE_BUILDER_OWNER_ADDRESS: string;
  NEXT_PUBLIC_URL: string;
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_WEBHOOK_URL: string;
  NEXT_PUBLIC_BASE_RPC_URL: string;
  NEXT_PUBLIC_MIN_PRICE_WEI: string;
  NEXT_PUBLIC_WALLET_REQUIRED?: string;
  NEXT_PUBLIC_TRIAL_ENABLED?: string;
  NEXT_PUBLIC_PRICE_MIN?: string;
  NEXT_PUBLIC_PRICE_MAX?: string;
  TRIAL_SIGN_KEY?: string;
  NOINDEX?: string;
};

export type PublicEnv = {
  NEXT_PUBLIC_URL: string;
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_WEBHOOK_URL: string;
  NEXT_PUBLIC_BASE_RPC_URL: string;
  NEXT_PUBLIC_MIN_PRICE_WEI: string;
  NEXT_PUBLIC_WALLET_REQUIRED?: string;
  NEXT_PUBLIC_TRIAL_ENABLED?: string;
  NEXT_PUBLIC_PRICE_MIN?: string;
  NEXT_PUBLIC_PRICE_MAX?: string;
  PAYMENTS_MODE_B_ENABLED: '0' | '1';
};
