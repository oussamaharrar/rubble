'use client';

import { useCallback, useState } from 'react';
import { PrimaryButton } from './Buttons';
import { useGameStore } from '@/lib/store';
import { useWalletStore } from '@/lib/wallet-store';

function normalizeChainId(chainId: string | null) {
  return chainId ? chainId.toLowerCase() : null;
}

export default function ConnectWalletButton({ onConnected }: { onConnected?: () => void }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setWallet = useWalletStore((state) => state.setWallet);
  const pauseRun = useGameStore((state) => state.pauseRun);

  const handleConnect = useCallback(async () => {
    if (connecting) return;
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('No wallet detected. Install Coinbase Wallet or MetaMask.');
      return;
    }
    try {
      setConnecting(true);
      setError(null);
      pauseRun('Wallet connection required');
      const accounts = (await window.ethereum.request<string[]>({ method: 'eth_requestAccounts' })) ?? [];
      const [primary] = accounts;
      const currentChain = await window.ethereum
        .request<string>({ method: 'eth_chainId' })
        .catch(() => null);
      if (primary) {
        setWallet(primary, normalizeChainId(currentChain));
        onConnected?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet connection was cancelled.');
    } finally {
      setConnecting(false);
    }
  }, [connecting, onConnected, pauseRun, setWallet]);

  return (
    <div className="flex flex-col items-center gap-2">
      <PrimaryButton onClick={handleConnect} disabled={connecting}>
        {connecting ? 'Connecting…' : 'Connect Wallet'}
      </PrimaryButton>
      {error ? <p className="text-center text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
