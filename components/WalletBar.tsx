'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PrimaryButton, GhostButton } from './Buttons';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import { useWalletStore } from '@/lib/wallet-store';

const STATUS_VARIANTS = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

function formatAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function normalizeChainId(chainId: string | null) {
  return chainId ? chainId.toLowerCase() : null;
}

export default function WalletBar() {
  const address = useWalletStore((state) => state.address);
  const chainId = useWalletStore((state) => state.chainId);
  const setWallet = useWalletStore((state) => state.setWallet);
  const setChainId = useWalletStore((state) => state.setChainId);
  const resetWallet = useWalletStore((state) => state.reset);

  const [connecting, setConnecting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

  const normalisedChainId = normalizeChainId(chainId);
  const onBase = normalisedChainId === BASE_CHAIN_ID_HEX;
  const connected = Boolean(address);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const provider = window.ethereum as (typeof window.ethereum) & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    if (!provider) {
      setHasProvider(false);
      return;
    }
    setHasProvider(true);

    let cancelled = false;

    const syncAccounts = async () => {
      try {
        const accounts = (await provider.request<string[]>({ method: 'eth_accounts' })) ?? [];
        const [primary] = accounts;
        const currentChain = await provider.request<string>({ method: 'eth_chainId' }).catch(() => null);
        if (!cancelled) {
          if (primary) {
            setWallet(primary, normalizeChainId(currentChain));
          } else {
            resetWallet();
          }
        }
      } catch (error) {
        console.debug('Wallet sync failed', error);
      }
    };

    void syncAccounts();

    const handleAccountsChanged = (accounts: unknown) => {
      if (!Array.isArray(accounts)) return;
      const [primary] = accounts as string[];
      if (primary) {
        provider
          .request<string>({ method: 'eth_chainId' })
          .then((next) => setWallet(primary, normalizeChainId(next)))
          .catch(() => setWallet(primary, normalizeChainId(null)));
      } else {
        resetWallet();
      }
    };

    const handleChainChanged = (nextChainId: unknown) => {
      if (typeof nextChainId !== 'string') return;
      setChainId(normalizeChainId(nextChainId));
    };

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);

    return () => {
      cancelled = true;
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [resetWallet, setChainId, setWallet]);

  useEffect(() => {
    if (!statusMessage) return undefined;
    const timeout = window.setTimeout(() => setStatusMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  const handleConnect = useCallback(async () => {
    if (connecting || switching) return;
    if (typeof window === 'undefined' || !window.ethereum) {
      setStatusMessage('No wallet detected. Install Coinbase Wallet or MetaMask.');
      return;
    }
    try {
      setConnecting(true);
      const accounts = (await window.ethereum.request<string[]>({ method: 'eth_requestAccounts' })) ?? [];
      const [primary] = accounts;
      const currentChain = await window.ethereum
        .request<string>({ method: 'eth_chainId' })
        .catch(() => null);
      if (primary) {
        setWallet(primary, normalizeChainId(currentChain));
        setStatusMessage('Wallet connected.');
      }
    } catch (error) {
      console.debug('Wallet connection rejected', error);
      setStatusMessage('Wallet connection was cancelled.');
    } finally {
      setConnecting(false);
    }
  }, [connecting, switching, setWallet]);

  const handleSwitchNetwork = useCallback(async () => {
    if (switching) return;
    try {
      setSwitching(true);
      const nextAddress = await ensureBaseNetwork();
      setWallet(nextAddress, BASE_CHAIN_ID_HEX);
      setStatusMessage('Switched to Base Mainnet.');
    } catch (error) {
      console.debug('Switch network failed', error);
      setStatusMessage(
        error instanceof Error ? error.message : 'Switch request was declined.'
      );
    } finally {
      setSwitching(false);
    }
  }, [setWallet, switching]);

  const statusLabel = useMemo(() => {
    if (!hasProvider) {
      return 'Install a Base-compatible wallet to play.';
    }
    if (!connected) {
      return 'Connect your wallet to unlock Base boosts.';
    }
    if (!onBase) {
      return 'Switch to Base Mainnet (chain 8453) to continue.';
    }
    return 'Ready on Base Mainnet.';
  }, [connected, hasProvider, onBase]);

  return (
    <div className="flex w-full flex-col gap-2 rounded-3xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Wallet
          </p>
          <p className="text-base font-semibold text-white">
            {connected && address ? formatAddress(address) : 'Not connected'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {connected && onBase ? (
            <motion.span
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden />
              Base Mainnet
            </motion.span>
          ) : null}
          {connected && !onBase ? (
            <GhostButton onClick={handleSwitchNetwork} disabled={switching}>
              {switching ? 'Switching…' : 'Switch to Base'}
            </GhostButton>
          ) : null}
          {!connected ? (
            <PrimaryButton onClick={handleConnect} disabled={connecting || !hasProvider}>
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </PrimaryButton>
          ) : null}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={statusLabel}
          className="text-xs text-slate-300"
          variants={STATUS_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {statusMessage ?? statusLabel}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
