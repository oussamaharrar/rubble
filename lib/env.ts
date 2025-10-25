import { z } from 'zod';

const address = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a valid 0x-prefixed EVM address');

const digits = z
  .string()
  .regex(/^\d+$/u, 'Expected an integer string');

const EnvSchema = z
  .object({
    NEXT_PUBLIC_URL: z.string().url(),
    NEXT_PUBLIC_WEBHOOK_URL: z.string().url(),
    NEXT_PUBLIC_BASE_RPC_URL: z.string().url(),
    BASE_RPC_URL: z.string().url(),
    PAY_TO_ADDRESS: address,
    MIN_PRICE_WEI: digits,
    FARCASTER_ACCOUNT_HEADER: z.string().min(1).optional(),
    FARCASTER_ACCOUNT_PAYLOAD: z.string().min(1).optional(),
    FARCASTER_ACCOUNT_SIGNATURE: z.string().min(1).optional(),
    BASE_PAY_API_KEY_ID: z.string().min(1).optional(),
    BASE_PAY_API_SECRET: z.string().min(1).optional(),
    BASE_BUILDER_OWNER_ADDRESS: address.optional(),
    MINIAPP_IMAGE_URL: z.string().url().optional(),
    MINIAPP_HERO_IMAGE_URL: z.string().url().optional(),
    MINIAPP_OG_TITLE: z.string().optional(),
    MINIAPP_OG_DESCRIPTION: z.string().optional(),
    MINIAPP_OG_IMAGE_URL: z.string().url().optional(),
    MINIAPP_BUTTON_TITLE: z.string().optional(),
    MINIAPP_SCREENSHOT_URLS: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const inProduction = process.env.NODE_ENV === 'production' && process.env.VERCEL === '1';
    if (inProduction) {
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
  });

const rawEnv = EnvSchema.parse({
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: process.env.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL ?? process.env.BASE_RPC_URL,
  BASE_RPC_URL: process.env.BASE_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_RPC_URL,
  PAY_TO_ADDRESS: process.env.PAY_TO_ADDRESS,
  MIN_PRICE_WEI: process.env.MIN_PRICE_WEI,
  FARCASTER_ACCOUNT_HEADER: process.env.FARCASTER_ACCOUNT_HEADER,
  FARCASTER_ACCOUNT_PAYLOAD: process.env.FARCASTER_ACCOUNT_PAYLOAD,
  FARCASTER_ACCOUNT_SIGNATURE: process.env.FARCASTER_ACCOUNT_SIGNATURE,
  BASE_PAY_API_KEY_ID: process.env.BASE_PAY_API_KEY_ID,
  BASE_PAY_API_SECRET: process.env.BASE_PAY_API_SECRET,
  BASE_BUILDER_OWNER_ADDRESS: process.env.BASE_BUILDER_OWNER_ADDRESS,
  MINIAPP_IMAGE_URL: process.env.MINIAPP_IMAGE_URL ?? process.env.NEXT_PUBLIC_MINIAPP_IMAGE_URL,
  MINIAPP_HERO_IMAGE_URL:
    process.env.MINIAPP_HERO_IMAGE_URL ?? process.env.NEXT_PUBLIC_MINIAPP_HERO_IMAGE_URL,
  MINIAPP_OG_TITLE: process.env.MINIAPP_OG_TITLE ?? process.env.NEXT_PUBLIC_MINIAPP_OG_TITLE,
  MINIAPP_OG_DESCRIPTION:
    process.env.MINIAPP_OG_DESCRIPTION ?? process.env.NEXT_PUBLIC_MINIAPP_OG_DESCRIPTION,
  MINIAPP_OG_IMAGE_URL:
    process.env.MINIAPP_OG_IMAGE_URL ?? process.env.NEXT_PUBLIC_MINIAPP_OG_IMAGE_URL,
  MINIAPP_BUTTON_TITLE:
    process.env.MINIAPP_BUTTON_TITLE ?? process.env.NEXT_PUBLIC_MINIAPP_BUTTON_TITLE,
  MINIAPP_SCREENSHOT_URLS:
    process.env.MINIAPP_SCREENSHOT_URLS ?? process.env.NEXT_PUBLIC_MINIAPP_SCREENSHOT_URLS,
});

export const ENV = {
  ...rawEnv,
  MIN_PRICE_WEI: BigInt(rawEnv.MIN_PRICE_WEI),
} as const;

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_PAY_TO_ADDRESS: address.optional(),
  NEXT_PUBLIC_MIN_PRICE_WEI: digits.optional(),
});

const optionalPublic = PublicEnvSchema.parse({
  NEXT_PUBLIC_PAY_TO_ADDRESS: process.env.NEXT_PUBLIC_PAY_TO_ADDRESS,
  NEXT_PUBLIC_MIN_PRICE_WEI: process.env.NEXT_PUBLIC_MIN_PRICE_WEI,
});

export const PUBLIC_ENV = {
  NEXT_PUBLIC_URL: ENV.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: ENV.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: ENV.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_PAY_TO_ADDRESS: optionalPublic.NEXT_PUBLIC_PAY_TO_ADDRESS ?? ENV.PAY_TO_ADDRESS,
  NEXT_PUBLIC_MIN_PRICE_WEI:
    optionalPublic.NEXT_PUBLIC_MIN_PRICE_WEI ?? rawEnv.MIN_PRICE_WEI,
} as const;

export type Env = typeof ENV;
export type PublicEnv = typeof PUBLIC_ENV;
