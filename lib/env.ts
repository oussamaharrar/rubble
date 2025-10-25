import { z } from 'zod';

const address = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a valid EVM address');

const EnvSchema = z.object({
  NEXT_PUBLIC_URL: z.string().url(),
  NEXT_PUBLIC_WEBHOOK_URL: z.string().url(),
  BASE_RPC_URL: z.string().url(),
  PAY_TO_ADDRESS: address,
  MIN_PRICE_WEI: z
    .coerce
    .bigint({ message: 'MIN_PRICE_WEI must be numeric' })
    .refine((value) => value > 0n, 'MIN_PRICE_WEI must be greater than zero'),
  FARCASTER_ACCOUNT_HEADER: z.string().min(1),
  FARCASTER_ACCOUNT_PAYLOAD: z.string().min(1),
  FARCASTER_ACCOUNT_SIGNATURE: z.string().min(1),
  BASE_PAY_API_KEY_ID: z.string().uuid(),
  BASE_PAY_API_SECRET: z.string().min(1),
  BASE_BUILDER_OWNER_ADDRESS: address,
});

type ServerEnv = z.infer<typeof EnvSchema>;

const OptionalPublicSchema = z.object({
  NEXT_PUBLIC_PAY_TO_ADDRESS: address.optional(),
  NEXT_PUBLIC_MIN_PRICE_WEI: z
    .string()
    .regex(/^\d+$/u, 'Expected integer string for NEXT_PUBLIC_MIN_PRICE_WEI')
    .optional(),
});

const parsedEnv = EnvSchema.parse({
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: process.env.NEXT_PUBLIC_WEBHOOK_URL,
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

export const ENV: ServerEnv = parsedEnv;

const optionalPublic = OptionalPublicSchema.parse({
  NEXT_PUBLIC_PAY_TO_ADDRESS: process.env.NEXT_PUBLIC_PAY_TO_ADDRESS,
  NEXT_PUBLIC_MIN_PRICE_WEI: process.env.NEXT_PUBLIC_MIN_PRICE_WEI,
});

export const PUBLIC_ENV = {
  NEXT_PUBLIC_URL: ENV.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: ENV.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_PAY_TO_ADDRESS: optionalPublic.NEXT_PUBLIC_PAY_TO_ADDRESS ?? ENV.PAY_TO_ADDRESS,
  NEXT_PUBLIC_MIN_PRICE_WEI:
    optionalPublic.NEXT_PUBLIC_MIN_PRICE_WEI ?? ENV.MIN_PRICE_WEI.toString(),
};

export type PublicEnv = typeof PUBLIC_ENV;
