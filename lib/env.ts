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
const integerStringOptional = z
  .string()
  .regex(/^\d+$/u, 'Expected a non-negative integer string')
  .optional();
const decimalStringOptional = z
  .string()
  .regex(/^\d+(\.\d+)?$/u, 'Expected a positive decimal string')
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
  PRICE_WEI_BOOST: process.env.PRICE_WEI_BOOST,
  PRICE_WEI_COMBO: process.env.PRICE_WEI_COMBO,
  PRICE_WEI_RETRY: process.env.PRICE_WEI_RETRY,
  PRICE_USD_PER_ETH: process.env.PRICE_USD_PER_ETH,
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
    PRICE_WEI_BOOST: integerStringOptional,
    PRICE_WEI_COMBO: integerStringOptional,
    PRICE_WEI_RETRY: integerStringOptional,
    PRICE_USD_PER_ETH: decimalStringOptional,
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

function parseUsdPerEth(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function usdToWei(usd: number, usdPerEth: number): bigint {
  if (!Number.isFinite(usdPerEth) || usdPerEth <= 0) {
    return 0n;
  }
  const weiPerEth = 1_000_000_000_000_000_000n;
  const scaledUsd = Math.round(usd * 1_000_000);
  const scaledUsdPerEth = Math.round(usdPerEth * 1_000_000);
  if (!Number.isFinite(scaledUsd) || scaledUsd <= 0) {
    return 0n;
  }
  if (!Number.isFinite(scaledUsdPerEth) || scaledUsdPerEth <= 0) {
    return 0n;
  }
  return (BigInt(scaledUsd) * weiPerEth) / BigInt(scaledUsdPerEth);
}

const MIN_PRICE_WEI = BigInt(parsed.MIN_PRICE_WEI);
const NEXT_PUBLIC_MIN_PRICE_WEI =
  parsed.NEXT_PUBLIC_MIN_PRICE_WEI ?? parsed.MIN_PRICE_WEI;

const usdPerEth = parseUsdPerEth(parsed.PRICE_USD_PER_ETH) || 3500;

// Micro-transaction caps (USD) to keep Base payments between $0.01 and $0.05.
const PRICE_CAPS_USD = {
  boost: 0.02,
  combo: 0.01,
  retry: 0.05,
} as const;

const derivedPrices = {
  boost: parsed.PRICE_WEI_BOOST
    ? BigInt(parsed.PRICE_WEI_BOOST)
    : usdToWei(PRICE_CAPS_USD.boost * 0.9, usdPerEth),
  combo: parsed.PRICE_WEI_COMBO
    ? BigInt(parsed.PRICE_WEI_COMBO)
    : usdToWei(PRICE_CAPS_USD.combo * 0.9, usdPerEth),
  retry: parsed.PRICE_WEI_RETRY
    ? BigInt(parsed.PRICE_WEI_RETRY)
    : usdToWei(PRICE_CAPS_USD.retry * 0.9, usdPerEth),
} as const;

function enforceCap(label: keyof typeof PRICE_CAPS_USD) {
  const capUsd = PRICE_CAPS_USD[label];
  const wei = derivedPrices[label];
  if (wei <= 0n) {
    throw new Error(
      `PRICE_WEI_${label.toUpperCase()} must be greater than zero after USD conversion`
    );
  }
  if (usdPerEth <= 0) {
    return;
  }
  const usdValue = (Number(wei) / 1e18) * usdPerEth;
  if (usdValue - capUsd > 1e-6) {
    throw new Error(
      `PRICE_WEI_${label.toUpperCase()} exceeds cap of $${capUsd.toFixed(2)} (calculated $${usdValue.toFixed(
        4
      )}). Adjust env or USD conversion.`
    );
  }
}

enforceCap('boost');
enforceCap('combo');
enforceCap('retry');

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
  PRICE_WEI_BOOST: derivedPrices.boost,
  PRICE_WEI_COMBO: derivedPrices.combo,
  PRICE_WEI_RETRY: derivedPrices.retry,
  PRICE_USD_PER_ETH: usdPerEth,
} as const;

export const PUBLIC_ENV = {
  NEXT_PUBLIC_URL: parsed.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: parsed.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: parsed.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_MIN_PRICE_WEI,
  PAYMENTS_MODE_B_ENABLED: modeBEnabled ? '1' : '0',
  PRICE_WEI_BOOST: derivedPrices.boost.toString(),
  PRICE_WEI_COMBO: derivedPrices.combo.toString(),
  PRICE_WEI_RETRY: derivedPrices.retry.toString(),
  PRICE_USD_PER_ETH: usdPerEth.toString(),
} as const;

export type Env = typeof ENV;
export type PublicEnv = typeof PUBLIC_ENV;
