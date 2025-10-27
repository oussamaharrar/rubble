import { z } from 'zod';

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

const optionalInteger = z
  .string()
  .regex(/^\d+$/u, 'Expected a non-negative integer string')
  .optional();

const rawEnv = {
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000',
  NEXT_PUBLIC_WEBHOOK_URL:
    process.env.NEXT_PUBLIC_WEBHOOK_URL ?? '/api/pay/webhook',
  NEXT_PUBLIC_BASE_RPC_URL:
    process.env.NEXT_PUBLIC_BASE_RPC_URL ??
    process.env.BASE_RPC_URL ??
    'https://api.developer.coinbase.com/rpc/v1/base',
  NEXT_PUBLIC_MIN_PRICE_WEI:
    process.env.NEXT_PUBLIC_MIN_PRICE_WEI ??
    process.env.MIN_PRICE_WEI ??
    '1',
  BASE_RPC_URL:
    process.env.BASE_RPC_URL ??
    process.env.NEXT_PUBLIC_BASE_RPC_URL ??
    'https://api.developer.coinbase.com/rpc/v1/base',
  PAY_TO_ADDRESS:
    process.env.PAY_TO_ADDRESS ?? '0x3F3E5e0C853C48641022a3A1D7a8D3E64B5441e0',
  MIN_PRICE_WEI:
    process.env.MIN_PRICE_WEI ??
    process.env.NEXT_PUBLIC_MIN_PRICE_WEI ??
    '1',
  PRICE_WEI_BOOST: process.env.PRICE_WEI_BOOST,
  PRICE_WEI_COMBO: process.env.PRICE_WEI_COMBO,
  PRICE_WEI_RETRY: process.env.PRICE_WEI_RETRY,
  NEXT_PUBLIC_PRICE_WEI_BOOST:
    process.env.NEXT_PUBLIC_PRICE_WEI_BOOST ?? process.env.PRICE_WEI_BOOST,
  NEXT_PUBLIC_PRICE_WEI_COMBO:
    process.env.NEXT_PUBLIC_PRICE_WEI_COMBO ?? process.env.PRICE_WEI_COMBO,
  NEXT_PUBLIC_PRICE_WEI_RETRY:
    process.env.NEXT_PUBLIC_PRICE_WEI_RETRY ?? process.env.PRICE_WEI_RETRY,
  FARCASTER_ACCOUNT_HEADER: process.env.FARCASTER_ACCOUNT_HEADER,
  FARCASTER_ACCOUNT_PAYLOAD: process.env.FARCASTER_ACCOUNT_PAYLOAD,
  FARCASTER_ACCOUNT_SIGNATURE: process.env.FARCASTER_ACCOUNT_SIGNATURE,
  PAYMENTS_API_BASE: process.env.PAYMENTS_API_BASE,
  PAYMENTS_API_KEY_ID: process.env.PAYMENTS_API_KEY_ID,
  PAYMENTS_API_SECRET: process.env.PAYMENTS_API_SECRET,
  PAYMENTS_WEBHOOK_SECRET: process.env.PAYMENTS_WEBHOOK_SECRET,
  BASE_PAY_MOCK: process.env.BASE_PAY_MOCK ?? '0',
  BASE_BUILDER_OWNER_ADDRESS:
    process.env.BASE_BUILDER_OWNER_ADDRESS ??
    process.env.PAY_TO_ADDRESS ??
    '0x3F3E5e0C853C48641022a3A1D7a8D3E64B5441e0',
} as const;

const EnvSchema = z
  .object({
    NEXT_PUBLIC_URL: url,
    NEXT_PUBLIC_WEBHOOK_URL: relativeOrAbsolute,
    NEXT_PUBLIC_BASE_RPC_URL: url,
    NEXT_PUBLIC_MIN_PRICE_WEI: integerString,
    BASE_RPC_URL: url,
    PAY_TO_ADDRESS: evmAddress,
    MIN_PRICE_WEI: integerString,
    PRICE_WEI_BOOST: optionalInteger,
    PRICE_WEI_COMBO: optionalInteger,
    PRICE_WEI_RETRY: optionalInteger,
    NEXT_PUBLIC_PRICE_WEI_BOOST: optionalInteger,
    NEXT_PUBLIC_PRICE_WEI_COMBO: optionalInteger,
    NEXT_PUBLIC_PRICE_WEI_RETRY: optionalInteger,
    FARCASTER_ACCOUNT_HEADER: optionalString,
    FARCASTER_ACCOUNT_PAYLOAD: optionalString,
    FARCASTER_ACCOUNT_SIGNATURE: optionalString,
    PAYMENTS_API_BASE: url.optional(),
    PAYMENTS_API_KEY_ID: optionalString,
    PAYMENTS_API_SECRET: optionalString,
    PAYMENTS_WEBHOOK_SECRET: optionalString,
    BASE_PAY_MOCK: booleanFlag,
    BASE_BUILDER_OWNER_ADDRESS: evmAddress.optional(),
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

const parsed = EnvSchema.parse(rawEnv);

const MIN_PRICE_WEI = BigInt(parsed.MIN_PRICE_WEI);
const NEXT_PUBLIC_MIN_PRICE_WEI =
  parsed.NEXT_PUBLIC_MIN_PRICE_WEI ?? parsed.MIN_PRICE_WEI;

function clampPrice(value: bigint, min: bigint) {
  if (value < min) {
    return min;
  }
  const cap = min * 5n;
  return value > cap ? cap : value;
}

function parsePrice(raw: string | undefined, fallback: bigint) {
  if (!raw) {
    return clampPrice(fallback, MIN_PRICE_WEI);
  }
  try {
    const parsedValue = BigInt(raw);
    return clampPrice(parsedValue, MIN_PRICE_WEI);
  } catch {
    return clampPrice(fallback, MIN_PRICE_WEI);
  }
}

function withMultiplier(base: bigint, multiplier: number) {
  const scaled = BigInt(Math.round(multiplier * 1_000));
  return (base * scaled) / 1_000n;
}

const DEFAULT_PRICE_BOOST = withMultiplier(MIN_PRICE_WEI, 1);
const DEFAULT_PRICE_COMBO = withMultiplier(MIN_PRICE_WEI, 1.5);
const DEFAULT_PRICE_RETRY = withMultiplier(MIN_PRICE_WEI, 3);

const PRICE_WEI_BOOST = parsePrice(
  parsed.PRICE_WEI_BOOST ?? parsed.NEXT_PUBLIC_PRICE_WEI_BOOST,
  DEFAULT_PRICE_BOOST
);
const PRICE_WEI_COMBO = parsePrice(
  parsed.PRICE_WEI_COMBO ?? parsed.NEXT_PUBLIC_PRICE_WEI_COMBO,
  DEFAULT_PRICE_COMBO
);
const PRICE_WEI_RETRY = parsePrice(
  parsed.PRICE_WEI_RETRY ?? parsed.NEXT_PUBLIC_PRICE_WEI_RETRY,
  DEFAULT_PRICE_RETRY
);

const modeBEnabled = Boolean(
  parsed.PAYMENTS_API_BASE &&
  parsed.PAYMENTS_API_KEY_ID &&
  parsed.PAYMENTS_API_SECRET &&
  parsed.PAYMENTS_WEBHOOK_SECRET
);

export const ENV = {
  BASE_RPC_URL: parsed.BASE_RPC_URL,
  PAY_TO_ADDRESS: parsed.PAY_TO_ADDRESS,
  MIN_PRICE_WEI,
  MIN_PRICE_WEI_RAW: parsed.MIN_PRICE_WEI,
  PRICE_WEI_BOOST,
  PRICE_WEI_COMBO,
  PRICE_WEI_RETRY,
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
  NEXT_PUBLIC_WEBHOOK_URL: parsed.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: parsed.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_MIN_PRICE_WEI,
} as const;

export const PUBLIC_ENV = {
  NEXT_PUBLIC_URL: parsed.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: parsed.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: parsed.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_MIN_PRICE_WEI,
  NEXT_PUBLIC_PRICE_WEI_BOOST: PRICE_WEI_BOOST.toString(),
  NEXT_PUBLIC_PRICE_WEI_COMBO: PRICE_WEI_COMBO.toString(),
  NEXT_PUBLIC_PRICE_WEI_RETRY: PRICE_WEI_RETRY.toString(),
  PAYMENTS_MODE_B_ENABLED: modeBEnabled ? '1' : '0',
} as const;

export type Env = typeof ENV;
export type PublicEnv = typeof PUBLIC_ENV;
