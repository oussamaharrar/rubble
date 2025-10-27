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
const optionalIntegerString = integerString.optional();
const booleanFlag = z.enum(['0', '1']);

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
  WEI_PER_USD: process.env.WEI_PER_USD ?? process.env.NEXT_PUBLIC_WEI_PER_USD,
  PRICE_WEI_BOOST: process.env.PRICE_WEI_BOOST,
  PRICE_WEI_COMBO: process.env.PRICE_WEI_COMBO,
  PRICE_WEI_RETRY: process.env.PRICE_WEI_RETRY,
  NEXT_PUBLIC_WEI_PER_USD:
    process.env.NEXT_PUBLIC_WEI_PER_USD ?? process.env.WEI_PER_USD ?? '333333333333333333',
  NEXT_PUBLIC_PRICE_WEI_BOOST:
    process.env.NEXT_PUBLIC_PRICE_WEI_BOOST ?? process.env.PRICE_WEI_BOOST ?? '0',
  NEXT_PUBLIC_PRICE_WEI_COMBO:
    process.env.NEXT_PUBLIC_PRICE_WEI_COMBO ?? process.env.PRICE_WEI_COMBO ?? '0',
  NEXT_PUBLIC_PRICE_WEI_RETRY:
    process.env.NEXT_PUBLIC_PRICE_WEI_RETRY ?? process.env.PRICE_WEI_RETRY ?? '0',
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
    FARCASTER_ACCOUNT_HEADER: optionalString,
    FARCASTER_ACCOUNT_PAYLOAD: optionalString,
    FARCASTER_ACCOUNT_SIGNATURE: optionalString,
    PAYMENTS_API_BASE: url.optional(),
    PAYMENTS_API_KEY_ID: optionalString,
    PAYMENTS_API_SECRET: optionalString,
    PAYMENTS_WEBHOOK_SECRET: optionalString,
    BASE_PAY_MOCK: booleanFlag,
    BASE_BUILDER_OWNER_ADDRESS: evmAddress.optional(),
    WEI_PER_USD: optionalIntegerString,
    PRICE_WEI_BOOST: optionalIntegerString,
    PRICE_WEI_COMBO: optionalIntegerString,
    PRICE_WEI_RETRY: optionalIntegerString,
    NEXT_PUBLIC_WEI_PER_USD: integerString,
    NEXT_PUBLIC_PRICE_WEI_BOOST: z.string(),
    NEXT_PUBLIC_PRICE_WEI_COMBO: z.string(),
    NEXT_PUBLIC_PRICE_WEI_RETRY: z.string(),
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
  WEI_PER_USD: parsed.WEI_PER_USD ? BigInt(parsed.WEI_PER_USD) : BigInt(parsed.NEXT_PUBLIC_WEI_PER_USD),
  PRICE_WEI_BOOST_RAW: parsed.PRICE_WEI_BOOST ?? null,
  PRICE_WEI_COMBO_RAW: parsed.PRICE_WEI_COMBO ?? null,
  PRICE_WEI_RETRY_RAW: parsed.PRICE_WEI_RETRY ?? null,
  NEXT_PUBLIC_WEI_PER_USD: parsed.NEXT_PUBLIC_WEI_PER_USD,
  NEXT_PUBLIC_PRICE_WEI_BOOST: parsed.NEXT_PUBLIC_PRICE_WEI_BOOST,
  NEXT_PUBLIC_PRICE_WEI_COMBO: parsed.NEXT_PUBLIC_PRICE_WEI_COMBO,
  NEXT_PUBLIC_PRICE_WEI_RETRY: parsed.NEXT_PUBLIC_PRICE_WEI_RETRY,
} as const;

export const PUBLIC_ENV = {
  NEXT_PUBLIC_URL: parsed.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: parsed.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: parsed.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_MIN_PRICE_WEI,
  PAYMENTS_MODE_B_ENABLED: modeBEnabled ? '1' : '0',
  NEXT_PUBLIC_WEI_PER_USD: parsed.NEXT_PUBLIC_WEI_PER_USD,
  NEXT_PUBLIC_PRICE_WEI_BOOST: parsed.NEXT_PUBLIC_PRICE_WEI_BOOST,
  NEXT_PUBLIC_PRICE_WEI_COMBO: parsed.NEXT_PUBLIC_PRICE_WEI_COMBO,
  NEXT_PUBLIC_PRICE_WEI_RETRY: parsed.NEXT_PUBLIC_PRICE_WEI_RETRY,
} as const;

export type Env = typeof ENV;
export type PublicEnv = typeof PUBLIC_ENV;
