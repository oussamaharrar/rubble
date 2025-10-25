import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { ENV } from './env';

export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(ENV.BASE_RPC_URL),
});
