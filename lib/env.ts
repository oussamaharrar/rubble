import { z } from 'zod';

const address = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a valid EVM address (0x-prefixed 40 hex chars)');

const url = z.string().url();

const optionalString = z.string().min(1).optional();

const EnvSchema = z
  .object({
    NEXT_PUBLIC_URL: url,
    NEXT_PUBLIC_WEBHOOK_URL: url,
    NEXT_PUBLIC_BASE_RPC_URL: url,
    BASE_RPC_URL: url,
    PAY_TO_ADDRESS: address,
    MIN_PRICE_WEI: z
      .string()
      .regex(/^\d+$/u, 'MIN_PRICE_WEI must be digits only')
      .transform((value) => BigInt(value)),
    FARCASTER_ACCOUNT_HEADER: optionalString,
    FARCASTER_ACCOUNT_PAYLOAD: optionalString,
    FARCASTER_ACCOUNT_SIGNATURE: optionalString,
    BASE_PAY_API_KEY_ID: optionalString,
    BASE_PAY_API_SECRET: optionalString,
    BASE_BUILDER_OWNER_ADDRESS: address.optional(),
  })
  .superRefine((env, ctx) => {
    const hasAccountAssociation = Boolean(
      env.FARCASTER_ACCOUNT_HEADER && env.FARCASTER_ACCOUNT_PAYLOAD && env.FARCASTER_ACCOUNT_SIGNATURE
    );
    const hasPartialAccount = Boolean(
      env.FARCASTER_ACCOUNT_HEADER || env.FARCASTER_ACCOUNT_PAYLOAD || env.FARCASTER_ACCOUNT_SIGNATURE
    );

    if (hasPartialAccount && !hasAccountAssociation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Farcaster account association requires header, payload, and signature together.',
        path: ['FARCASTER_ACCOUNT_HEADER'],
      });
    }

    const nodeEnv = process.env.NODE_ENV ?? 'development';
    if (nodeEnv === 'production') {
      if (!env.BASE_PAY_API_KEY_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'BASE_PAY_API_KEY_ID is required in production.',
          path: ['BASE_PAY_API_KEY_ID'],
        });
      }
      if (!env.BASE_PAY_API_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'BASE_PAY_API_SECRET is required in production.',
          path: ['BASE_PAY_API_SECRET'],
        });
      }
    }
  });

const parsed = EnvSchema.parse({
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: process.env.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL,
  BASE_RPC_URL: process.env.BASE_RPC_URL,
  PAY_TO_ADDRESS: process.env.PAY_TO_ADDRESS,
  MIN_PRICE_WEI: process.env.MIN_PRICE_WEI,
  FARCASTER_ACCOUNT_HEADER: process.env.FARCASTER_ACCOUNT_HEADER,
  FARCASTER_ACCOUNT_PAYLOAD: process.env.FARCASTER_ACCOUNT_PAYLOAD,
  FARCASTER_ACCOUNT_SIGNATURE: process.env.FARCASTER_ACCOUNT_SIGNATURE,
  BASE_PAY_API_KEY_ID: process.env.BASE_PAY_API_KEY_ID,
  BASE_PAY_API_SECRET: process.env.BASE_PAY_API_SECRET,
  BASE_BUILDER_OWNER_ADDRESS: process.env.BASE_BUILDER_OWNER_ADDRESS,
});

export type Env = {
  NEXT_PUBLIC_URL: string;
  NEXT_PUBLIC_WEBHOOK_URL: string;
  NEXT_PUBLIC_BASE_RPC_URL: string;
  BASE_RPC_URL: string;
  PAY_TO_ADDRESS: string;
  MIN_PRICE_WEI: bigint;
  FARCASTER_ACCOUNT_HEADER?: string;
  FARCASTER_ACCOUNT_PAYLOAD?: string;
  FARCASTER_ACCOUNT_SIGNATURE?: string;
  BASE_PAY_API_KEY_ID?: string;
  BASE_PAY_API_SECRET?: string;
  BASE_BUILDER_OWNER_ADDRESS?: string;
};

export const ENV: Env = {
  NEXT_PUBLIC_URL: parsed.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: parsed.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: parsed.NEXT_PUBLIC_BASE_RPC_URL,
  BASE_RPC_URL: parsed.BASE_RPC_URL,
  PAY_TO_ADDRESS: parsed.PAY_TO_ADDRESS,
  MIN_PRICE_WEI: parsed.MIN_PRICE_WEI,
  FARCASTER_ACCOUNT_HEADER: parsed.FARCASTER_ACCOUNT_HEADER ?? undefined,
  FARCASTER_ACCOUNT_PAYLOAD: parsed.FARCASTER_ACCOUNT_PAYLOAD ?? undefined,
  FARCASTER_ACCOUNT_SIGNATURE: parsed.FARCASTER_ACCOUNT_SIGNATURE ?? undefined,
  BASE_PAY_API_KEY_ID: parsed.BASE_PAY_API_KEY_ID ?? undefined,
  BASE_PAY_API_SECRET: parsed.BASE_PAY_API_SECRET ?? undefined,
  BASE_BUILDER_OWNER_ADDRESS: parsed.BASE_BUILDER_OWNER_ADDRESS ?? undefined,
};

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_PAY_TO_ADDRESS: address.optional(),
  NEXT_PUBLIC_MIN_PRICE_WEI: z.string().regex(/^\d+$/u).optional(),
});

const publicParsed = PublicEnvSchema.parse({
  NEXT_PUBLIC_PAY_TO_ADDRESS: process.env.NEXT_PUBLIC_PAY_TO_ADDRESS,
  NEXT_PUBLIC_MIN_PRICE_WEI: process.env.NEXT_PUBLIC_MIN_PRICE_WEI,
});

export const PUBLIC_ENV = {
  NEXT_PUBLIC_URL: ENV.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: ENV.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_BASE_RPC_URL: ENV.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_PAY_TO_ADDRESS: publicParsed.NEXT_PUBLIC_PAY_TO_ADDRESS ?? ENV.PAY_TO_ADDRESS,
  NEXT_PUBLIC_MIN_PRICE_WEI:
    publicParsed.NEXT_PUBLIC_MIN_PRICE_WEI ?? ENV.MIN_PRICE_WEI.toString(),
};

export type PublicEnv = typeof PUBLIC_ENV;
