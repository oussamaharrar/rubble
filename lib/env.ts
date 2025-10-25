import { z } from 'zod';

const address = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a checksummed EVM address');

const numericString = z
  .string()
  .regex(/^\d+$/u, 'Expected a numeric string');

const EnvSchema = z.object({
  NEXT_PUBLIC_URL: z.string().url(),
  NEXT_PUBLIC_WEBHOOK_URL: z.string().url(),
  BASE_RPC_URL: z.string().url(),
  PAY_TO_ADDRESS: address,
  MIN_PRICE_WEI: numericString,
  FARCASTER_ACCOUNT_HEADER: z.string().min(1),
  FARCASTER_ACCOUNT_PAYLOAD: z.string().min(1),
  FARCASTER_ACCOUNT_SIGNATURE: z.string().min(1),
  BASE_PAY_API_KEY_ID: z.string().uuid(),
  BASE_PAY_API_SECRET: z.string().min(1),
  BASE_BUILDER_OWNER_ADDRESS: address,
});

const OptionalPublicSchema = z.object({
  NEXT_PUBLIC_PAY_TO_ADDRESS: address.optional(),
  NEXT_PUBLIC_MIN_PRICE_WEI: numericString.optional(),
});

export const ENV = EnvSchema.parse({
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

const optionalPublic = OptionalPublicSchema.parse({
  NEXT_PUBLIC_PAY_TO_ADDRESS: process.env.NEXT_PUBLIC_PAY_TO_ADDRESS,
  NEXT_PUBLIC_MIN_PRICE_WEI: process.env.NEXT_PUBLIC_MIN_PRICE_WEI,
});

export const PUBLIC_ENV = {
  NEXT_PUBLIC_URL: ENV.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: ENV.NEXT_PUBLIC_WEBHOOK_URL,
  NEXT_PUBLIC_PAY_TO_ADDRESS: optionalPublic.NEXT_PUBLIC_PAY_TO_ADDRESS ?? ENV.PAY_TO_ADDRESS,
  NEXT_PUBLIC_MIN_PRICE_WEI: optionalPublic.NEXT_PUBLIC_MIN_PRICE_WEI ?? ENV.MIN_PRICE_WEI,
  NEXT_PUBLIC_BASE_CHAIN_ID: '0x2105',
};

export type Env = z.infer<typeof EnvSchema>;
