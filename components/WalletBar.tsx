'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PrimaryButton, GhostButton } from './Buttons';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { useWalletStore } from '@/lib/wallet-store';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { useConnect } from 'wagmi';

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

  const [switching, setSwitching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { connectors } = useConnect();
  const hasConnector = connectors.length > 0;

  const normalisedChainId = normalizeChainId(chainId);
  const onBase = normalisedChainId === BASE_CHAIN_ID_HEX;
  const connected = Boolean(address);

  useEffect(() => {
    if (!statusMessage) return undefined;
    const timeout = window.setTimeout(() => setStatusMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  const handleSwitchNetwork = useCallback(async () => {
    if (switching) return;
    try {
      setSwitching(true);
      dispatchWalletModalOpen();
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
    if (!hasConnector) {
      return 'Open this mini-app in Warpcast to access the Farcaster wallet.';
    }
    if (!connected) {
      return 'Connect your wallet to unlock Base boosts.';
    }
    if (!onBase) {
      return 'Switch to Base Mainnet (chain 8453) to continue.';
    }
    return 'Ready on Base Mainnet.';
  }, [connected, hasConnector, onBase]);

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
            <ConnectWalletButton asChild>
              <PrimaryButton disabled={!hasConnector}>Connect Wallet</PrimaryButton>
            </ConnectWalletButton>
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
