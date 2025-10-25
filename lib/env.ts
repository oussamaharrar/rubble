import { z } from 'zod';

const EnvSchema = z.object({
  NEXT_PUBLIC_URL: z.string().url(),
  NEXT_PUBLIC_WEBHOOK_URL: z.string().url(),
  BASE_RPC_URL: z.string().url(),
  PAY_TO_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  MIN_PRICE_WEI: z.string().regex(/^\d+$/),
});

const OptionalPublicSchema = z.object({
  NEXT_PUBLIC_PAY_TO_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  NEXT_PUBLIC_MIN_PRICE_WEI: z.string().regex(/^\d+$/).optional(),
});

export const ENV = EnvSchema.parse({
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_WEBHOOK_URL: process.env.NEXT_PUBLIC_WEBHOOK_URL,
  BASE_RPC_URL: process.env.BASE_RPC_URL,
  PAY_TO_ADDRESS: process.env.PAY_TO_ADDRESS,
  MIN_PRICE_WEI: process.env.MIN_PRICE_WEI,
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
};
