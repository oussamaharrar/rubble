import { z } from 'zod';

const urlSchema = z.string().url({ message: 'Expected a valid URL' });
const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a valid 0x-prefixed EVM address');
const digitsSchema = z.string().regex(/^\d+$/u, 'Expected an integer string');
const optionalString = z.string().min(1).optional();
const webhookSchema = z
  .string()
  .min(1, 'NEXT_PUBLIC_WEBHOOK_URL is required')
  .refine(
    (value) => value.startsWith('/') || /^https?:\/\//u.test(value),
    'NEXT_PUBLIC_WEBHOOK_URL must be a relative path or absolute URL'
  );

const RawEnvSchema = z
  .object({
    NEXT_PUBLIC_URL: urlSchema,
    NEXT_PUBLIC_WEBHOOK_URL: webhookSchema,
    NEXT_PUBLIC_BASE_RPC_URL: urlSchema,
    BASE_RPC_URL: urlSchema,
    PAY_TO_ADDRESS: addressSchema,
    MIN_PRICE_WEI: digitsSchema,
    FARCASTER_ACCOUNT_HEADER: optionalString,
    FARCASTER_ACCOUNT_PAYLOAD: optionalString,
    FARCASTER_ACCOUNT_SIGNATURE: optionalString,
    BASE_PAY_API_KEY_ID: z.string().min(1).optional(),
    BASE_PAY_API_SECRET: z.string().min(1).optional(),
    BASE_BUILDER_OWNER_ADDRESS: addressSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const accountValues = [
      value.FARCASTER_ACCOUNT_HEADER,
      value.FARCASTER_ACCOUNT_PAYLOAD,
      value.FARCASTER_ACCOUNT_SIGNATURE,
    ];
    const providedCount = accountValues.filter(Boolean).length;
    if (providedCount > 0 && providedCount < accountValues.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'All FARCASTER_ACCOUNT_* variables must be provided together',
        path: ['FARCASTER_ACCOUNT_HEADER'],
      });
    }

    const isVercel = process.env.NODE_ENV === 'production' && process.env.VERCEL === '1';
    if (isVercel) {
      if (!value.BASE_PAY_API_KEY_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'BASE_PAY_API_KEY_ID is required in production',
          path: ['BASE_PAY_API_KEY_ID'],
        });
      }
      if (!value.BASE_PAY_API_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'BASE_PAY_API_SECRET is required in production',
          path: ['BASE_PAY_API_SECRET'],
        });
      }
    }
  });

const parsedEnv = RawEnvSchema.parse({
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: process.env.NEXT_PUBLIC_WEBHOOK_URL ?? '/api/pay/webhook',
  NEXT_PUBLIC_BASE_RPC_URL:
    process.env.NEXT_PUBLIC_BASE_RPC_URL ?? process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
  BASE_RPC_URL:
    process.env.BASE_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org',
  PAY_TO_ADDRESS: process.env.PAY_TO_ADDRESS,
  MIN_PRICE_WEI: process.env.MIN_PRICE_WEI ?? '0',
  FARCASTER_ACCOUNT_HEADER: process.env.FARCASTER_ACCOUNT_HEADER,
  FARCASTER_ACCOUNT_PAYLOAD: process.env.FARCASTER_ACCOUNT_PAYLOAD,
  FARCASTER_ACCOUNT_SIGNATURE: process.env.FARCASTER_ACCOUNT_SIGNATURE,
  BASE_PAY_API_KEY_ID: process.env.BASE_PAY_API_KEY_ID,
  BASE_PAY_API_SECRET: process.env.BASE_PAY_API_SECRET,
  BASE_BUILDER_OWNER_ADDRESS: process.env.BASE_BUILDER_OWNER_ADDRESS,
});

export const ENV = {
  ...parsedEnv,
  MIN_PRICE_WEI: BigInt(parsedEnv.MIN_PRICE_WEI),
} as const;

const optionalPublic = z
  .object({
    NEXT_PUBLIC_PAY_TO_ADDRESS: addressSchema.optional(),
    NEXT_PUBLIC_MIN_PRICE_WEI: digitsSchema.optional(),
  })
  .parse({
    NEXT_PUBLIC_PAY_TO_ADDRESS: process.env.NEXT_PUBLIC_PAY_TO_ADDRESS,
    NEXT_PUBLIC_MIN_PRICE_WEI: process.env.NEXT_PUBLIC_MIN_PRICE_WEI,
  });

export const PUBLIC_ENV = {
  NEXT_PUBLIC_URL: ENV.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: ENV.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: ENV.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_PAY_TO_ADDRESS:
    optionalPublic.NEXT_PUBLIC_PAY_TO_ADDRESS ?? ENV.PAY_TO_ADDRESS,
  NEXT_PUBLIC_MIN_PRICE_WEI:
    optionalPublic.NEXT_PUBLIC_MIN_PRICE_WEI ?? parsedEnv.MIN_PRICE_WEI,
} as const;

export type Env = typeof ENV;
export type PublicEnv = typeof PUBLIC_ENV;
