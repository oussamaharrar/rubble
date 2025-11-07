'use client';

import { http, createConfig } from 'wagmi';
import { baseSepolia } from 'viem/chains';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL ??
        (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
          ? `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
          : ''),
    ),
  },
  connectors: [
    farcasterMiniApp(),
  ],
});
