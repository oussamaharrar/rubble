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
  .min(1)
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

const DEFAULT_BASE_PAY_API_BASE = 'https://api.basepay.coinbase.com/v1';
const isProductionDeployment =
  process.env.NODE_ENV === 'production' && process.env.VERCEL === '1';

const inferredMockFlag = (() => {
  const explicit = process.env.BASE_PAY_MOCK;
  if (explicit === '0' || explicit === '1') {
    return explicit;
  }
  const haveCredentials = Boolean(
    process.env.BASE_PAY_API_KEY_ID && process.env.BASE_PAY_API_SECRET
  );
  return haveCredentials ? '0' : '1';
})();

const rawEnv = {
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000',
  NEXT_PUBLIC_WEBHOOK_URL:
    process.env.NEXT_PUBLIC_WEBHOOK_URL ?? '/api/pay/webhook',
  NEXT_PUBLIC_BASE_RPC_URL:
    process.env.NEXT_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org',
  NEXT_PUBLIC_MIN_PRICE_WEI:
    process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? process.env.MIN_PRICE_WEI ?? '1',
  BASE_RPC_URL:
    process.env.BASE_RPC_URL ??
    process.env.NEXT_PUBLIC_BASE_RPC_URL ??
    'https://mainnet.base.org',
  PAY_TO_ADDRESS:
    process.env.PAY_TO_ADDRESS ?? '0x3F3E5e0C853C48641022a3A1D7a8D3E64B5441e0',
  MIN_PRICE_WEI: process.env.MIN_PRICE_WEI ?? process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? '1',
  FARCASTER_ACCOUNT_HEADER: process.env.FARCASTER_ACCOUNT_HEADER,
  FARCASTER_ACCOUNT_PAYLOAD: process.env.FARCASTER_ACCOUNT_PAYLOAD,
  FARCASTER_ACCOUNT_SIGNATURE: process.env.FARCASTER_ACCOUNT_SIGNATURE,
  BASE_PAY_API_KEY_ID: process.env.BASE_PAY_API_KEY_ID,
  BASE_PAY_API_SECRET: process.env.BASE_PAY_API_SECRET,
  BASE_PAY_API_BASE:
    process.env.BASE_PAY_API_BASE ??
    (isProductionDeployment ? DEFAULT_BASE_PAY_API_BASE : undefined),
  BASE_PAY_MOCK: inferredMockFlag,
  BASE_BUILDER_OWNER_ADDRESS:
    process.env.BASE_BUILDER_OWNER_ADDRESS ?? '0x3F3E5e0C853C48641022a3A1D7a8D3E64B5441e0',
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
    BASE_PAY_API_KEY_ID: optionalString,
    BASE_PAY_API_SECRET: optionalString,
    BASE_PAY_API_BASE: url.optional(),
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

    const usingMock = value.BASE_PAY_MOCK === '1';
    const haveKeys = Boolean(
      value.BASE_PAY_API_KEY_ID && value.BASE_PAY_API_SECRET
    );
    if (!usingMock && !haveKeys) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'BASE_PAY_API_KEY_ID and BASE_PAY_API_SECRET are required',
        path: ['BASE_PAY_API_KEY_ID'],
      });
    }

    if (!usingMock && !value.BASE_PAY_API_BASE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'BASE_PAY_API_BASE must be configured when not mocking Base Pay',
        path: ['BASE_PAY_API_BASE'],
      });
    }
  });

const parsed = EnvSchema.parse(rawEnv);

const MIN_PRICE_WEI = BigInt(parsed.MIN_PRICE_WEI);
const NEXT_PUBLIC_MIN_PRICE_WEI = parsed.NEXT_PUBLIC_MIN_PRICE_WEI ?? parsed.MIN_PRICE_WEI;

export const ENV = {
  BASE_RPC_URL: parsed.BASE_RPC_URL,
  PAY_TO_ADDRESS: parsed.PAY_TO_ADDRESS,
  MIN_PRICE_WEI,
  FARCASTER_ACCOUNT_HEADER: parsed.FARCASTER_ACCOUNT_HEADER,
  FARCASTER_ACCOUNT_PAYLOAD: parsed.FARCASTER_ACCOUNT_PAYLOAD,
  FARCASTER_ACCOUNT_SIGNATURE: parsed.FARCASTER_ACCOUNT_SIGNATURE,
  BASE_PAY_API_KEY_ID: parsed.BASE_PAY_API_KEY_ID,
  BASE_PAY_API_SECRET: parsed.BASE_PAY_API_SECRET,
  BASE_PAY_API_BASE: parsed.BASE_PAY_API_BASE?.replace(/\/$/, ''),
  BASE_PAY_MOCK: parsed.BASE_PAY_MOCK,
  BASE_BUILDER_OWNER_ADDRESS: parsed.BASE_BUILDER_OWNER_ADDRESS,
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
} as const;

export type Env = typeof ENV;
export type PublicEnv = typeof PUBLIC_ENV;
