import { z } from 'zod';

const url = z.string().url();
const address = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a valid 0x-prefixed EVM address');
const digits = z.string().regex(/^\d+$/u, 'Expected an integer string');
const optionalString = z.string().min(1).optional();

const relativeOrUrl = z
  .string()
  .min(1)
  .refine((value) => {
    if (value.startsWith('/')) return true;
    try {
      const candidate = new URL(value);
      return Boolean(candidate.origin);
    } catch {
      return false;
    }
  }, 'Expected a relative path (starting with /) or an absolute URL');

const EnvSchema = z
  .object({
    NEXT_PUBLIC_URL: url,
    NEXT_PUBLIC_WEBHOOK_URL: relativeOrUrl,
    NEXT_PUBLIC_BASE_RPC_URL: url,
    BASE_RPC_URL: url,
    PAY_TO_ADDRESS: address,
    MIN_PRICE_WEI: digits,
    FARCASTER_ACCOUNT_HEADER: optionalString,
    FARCASTER_ACCOUNT_PAYLOAD: optionalString,
    FARCASTER_ACCOUNT_SIGNATURE: optionalString,
    BASE_PAY_API_KEY_ID: z.string().min(1).optional(),
    BASE_PAY_API_SECRET: z.string().min(1).optional(),
    BASE_BUILDER_OWNER_ADDRESS: address.optional(),
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

    const credentialsProvided = Boolean(
      value.BASE_PAY_API_KEY_ID && value.BASE_PAY_API_SECRET
    );
    if (credentialsProvided === false) {
      const inProduction =
        process.env.NODE_ENV === 'production' && process.env.VERCEL === '1';
      if (inProduction) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'BASE_PAY_API_KEY_ID and BASE_PAY_API_SECRET are required in production',
          path: ['BASE_PAY_API_KEY_ID'],
        });
      }
    } else if (!value.BASE_PAY_API_KEY_ID || !value.BASE_PAY_API_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'BASE_PAY_API_KEY_ID and BASE_PAY_API_SECRET must both be set',
        path: ['BASE_PAY_API_KEY_ID'],
      });
    }
  });

const parsed = EnvSchema.parse({
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: process.env.NEXT_PUBLIC_WEBHOOK_URL ?? '/api/pay/webhook',
  NEXT_PUBLIC_BASE_RPC_URL:
    process.env.NEXT_PUBLIC_BASE_RPC_URL ?? process.env.BASE_RPC_URL,
  BASE_RPC_URL: process.env.BASE_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_RPC_URL,
  PAY_TO_ADDRESS: process.env.PAY_TO_ADDRESS,
  MIN_PRICE_WEI: process.env.MIN_PRICE_WEI ?? '0',
  FARCASTER_ACCOUNT_HEADER: process.env.FARCASTER_ACCOUNT_HEADER,
  FARCASTER_ACCOUNT_PAYLOAD: process.env.FARCASTER_ACCOUNT_PAYLOAD,
  FARCASTER_ACCOUNT_SIGNATURE: process.env.FARCASTER_ACCOUNT_SIGNATURE,
  BASE_PAY_API_KEY_ID: process.env.BASE_PAY_API_KEY_ID,
  BASE_PAY_API_SECRET: process.env.BASE_PAY_API_SECRET,
  BASE_BUILDER_OWNER_ADDRESS: process.env.BASE_BUILDER_OWNER_ADDRESS,
});

const minPriceWeiString = parsed.MIN_PRICE_WEI;

export const ENV = {
  ...parsed,
  MIN_PRICE_WEI: BigInt(parsed.MIN_PRICE_WEI),
} as const;

export const PUBLIC_ENV = {
  NEXT_PUBLIC_URL: parsed.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: parsed.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: parsed.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_PAY_TO_ADDRESS:
    process.env.NEXT_PUBLIC_PAY_TO_ADDRESS ?? parsed.PAY_TO_ADDRESS,
  NEXT_PUBLIC_MIN_PRICE_WEI:
    process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? minPriceWeiString,
} as const;

export type Env = typeof ENV;
export type PublicEnv = typeof PUBLIC_ENV;
