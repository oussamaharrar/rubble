import { z } from 'zod';

type OptionalString = string | undefined | null;

const urlSchema = z.string().url();
const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a checksummed 0x-prefixed address');
const integerStringSchema = z
  .string()
  .regex(/^\d+$/u, 'Expected an integer encoded as a string');
const relativeOrAbsoluteUrlSchema = z
  .string()
  .min(1)
  .refine((value) => {
    if (value.startsWith('/')) {
      return true;
    }
    try {
      const candidate = new URL(value);
      return Boolean(candidate.origin);
    } catch {
      return false;
    }
  }, 'Expected a relative path or an absolute URL');
const booleanFlagSchema = z.enum(['0', '1']).default('0');

const DEFAULT_BASE_PAY_API_BASE = 'https://api.basepay.coinbase.com/v1';

const rawEnv = {
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: process.env.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_MIN_PRICE_WEI: process.env.NEXT_PUBLIC_MIN_PRICE_WEI,
  BASE_RPC_URL: process.env.BASE_RPC_URL,
  PAY_TO_ADDRESS: process.env.PAY_TO_ADDRESS,
  MIN_PRICE_WEI: process.env.MIN_PRICE_WEI,
  FARCASTER_ACCOUNT_HEADER: process.env.FARCASTER_ACCOUNT_HEADER,
  FARCASTER_ACCOUNT_PAYLOAD: process.env.FARCASTER_ACCOUNT_PAYLOAD,
  FARCASTER_ACCOUNT_SIGNATURE: process.env.FARCASTER_ACCOUNT_SIGNATURE,
  BASE_PAY_API_KEY_ID: process.env.BASE_PAY_API_KEY_ID,
  BASE_PAY_API_SECRET: process.env.BASE_PAY_API_SECRET,
  BASE_PAY_API_BASE: process.env.BASE_PAY_API_BASE,
  BASE_PAY_MOCK: process.env.BASE_PAY_MOCK,
  BASE_BUILDER_OWNER_ADDRESS: process.env.BASE_BUILDER_OWNER_ADDRESS,
} as const;

const EnvSchema = z
  .object({
    NEXT_PUBLIC_URL: urlSchema,
    NEXT_PUBLIC_WEBHOOK_URL: relativeOrAbsoluteUrlSchema,
    NEXT_PUBLIC_BASE_RPC_URL: urlSchema,
    NEXT_PUBLIC_MIN_PRICE_WEI: integerStringSchema,
    BASE_RPC_URL: urlSchema,
    PAY_TO_ADDRESS: addressSchema,
    MIN_PRICE_WEI: integerStringSchema,
    FARCASTER_ACCOUNT_HEADER: z.string().min(1).optional(),
    FARCASTER_ACCOUNT_PAYLOAD: z.string().min(1).optional(),
    FARCASTER_ACCOUNT_SIGNATURE: z.string().min(1).optional(),
    BASE_PAY_API_KEY_ID: z.string().min(1).optional(),
    BASE_PAY_API_SECRET: z.string().min(1).optional(),
    BASE_PAY_API_BASE: urlSchema.optional(),
    BASE_PAY_MOCK: booleanFlagSchema,
    BASE_BUILDER_OWNER_ADDRESS: addressSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const associationValues: OptionalString[] = [
      value.FARCASTER_ACCOUNT_HEADER,
      value.FARCASTER_ACCOUNT_PAYLOAD,
      value.FARCASTER_ACCOUNT_SIGNATURE,
    ];
    const providedAssociations = associationValues.filter(Boolean).length;
    if (providedAssociations > 0 && providedAssociations < associationValues.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FARCASTER_ACCOUNT_HEADER'],
        message: 'All FARCASTER_ACCOUNT_* variables must be provided together.',
      });
    }

    const isMockMode = value.BASE_PAY_MOCK === '1';
    const hasApiKeys = Boolean(value.BASE_PAY_API_KEY_ID && value.BASE_PAY_API_SECRET);
    if (!isMockMode && !hasApiKeys) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BASE_PAY_API_KEY_ID'],
        message: 'BASE_PAY_API_KEY_ID and BASE_PAY_API_SECRET are required unless BASE_PAY_MOCK=1.',
      });
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const effectiveApiBase = value.BASE_PAY_API_BASE ?? (isProduction ? DEFAULT_BASE_PAY_API_BASE : undefined);
    if (!isMockMode && !effectiveApiBase) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BASE_PAY_API_BASE'],
        message: 'BASE_PAY_API_BASE is required unless BASE_PAY_MOCK=1.',
      });
    }
  });

const parsed = EnvSchema.parse(rawEnv);

const isProduction = process.env.NODE_ENV === 'production';
const basePayApiBase = parsed.BASE_PAY_API_BASE ?? (isProduction ? DEFAULT_BASE_PAY_API_BASE : undefined);

const serverEnv = {
  NEXT_PUBLIC_URL: parsed.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: parsed.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: parsed.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_MIN_PRICE_WEI: parsed.NEXT_PUBLIC_MIN_PRICE_WEI,
  BASE_RPC_URL: parsed.BASE_RPC_URL,
  PAY_TO_ADDRESS: parsed.PAY_TO_ADDRESS,
  MIN_PRICE_WEI: BigInt(parsed.MIN_PRICE_WEI),
  MIN_PRICE_WEI_STRING: parsed.MIN_PRICE_WEI,
  FARCASTER_ACCOUNT_HEADER: parsed.FARCASTER_ACCOUNT_HEADER ?? null,
  FARCASTER_ACCOUNT_PAYLOAD: parsed.FARCASTER_ACCOUNT_PAYLOAD ?? null,
  FARCASTER_ACCOUNT_SIGNATURE: parsed.FARCASTER_ACCOUNT_SIGNATURE ?? null,
  BASE_PAY_API_KEY_ID: parsed.BASE_PAY_API_KEY_ID ?? null,
  BASE_PAY_API_SECRET: parsed.BASE_PAY_API_SECRET ?? null,
  BASE_PAY_API_BASE: basePayApiBase ?? null,
  BASE_PAY_MOCK: parsed.BASE_PAY_MOCK,
  BASE_BUILDER_OWNER_ADDRESS: parsed.BASE_BUILDER_OWNER_ADDRESS ?? null,
} as const satisfies {
  NEXT_PUBLIC_URL: string;
  NEXT_PUBLIC_WEBHOOK_URL: string;
  NEXT_PUBLIC_BASE_RPC_URL: string;
  NEXT_PUBLIC_MIN_PRICE_WEI: string;
  BASE_RPC_URL: string;
  PAY_TO_ADDRESS: string;
  MIN_PRICE_WEI: bigint;
  MIN_PRICE_WEI_STRING: string;
  FARCASTER_ACCOUNT_HEADER: string | null;
  FARCASTER_ACCOUNT_PAYLOAD: string | null;
  FARCASTER_ACCOUNT_SIGNATURE: string | null;
  BASE_PAY_API_KEY_ID: string | null;
  BASE_PAY_API_SECRET: string | null;
  BASE_PAY_API_BASE: string | null;
  BASE_PAY_MOCK: '0' | '1';
  BASE_BUILDER_OWNER_ADDRESS: string | null;
};

const publicEnv = {
  NEXT_PUBLIC_URL: serverEnv.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: serverEnv.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: serverEnv.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_MIN_PRICE_WEI: serverEnv.NEXT_PUBLIC_MIN_PRICE_WEI,
} as const;

export const ENV = serverEnv;
export const PUBLIC_ENV = publicEnv;

export type Env = typeof ENV;
export type PublicEnv = typeof PUBLIC_ENV;
