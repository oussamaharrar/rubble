'use client';

import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'viem/chains';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || ''),
  },
  connectors: [farcasterMiniApp()],
});
