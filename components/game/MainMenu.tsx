'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';

interface MainMenuProps {
  onPlay: () => void;
  onConnectWallet: () => Promise<void>;
  walletAddress?: string | null;
  boosterStore: React.ReactNode;
}

function formatAddress(address?: string | null) {
  if (!address) return 'Not connected';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function MainMenu({ onPlay, onConnectWallet, walletAddress, boosterStore }: MainMenuProps) {
  const [showHowTo, setShowHowTo] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (connecting) return;
    setConnecting(true);
    setError(null);
    try {
      await onConnectWallet();
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(reason);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto bg-gradient-to-b from-midnight/60 via-midnight/40 to-midnight/80 p-6 text-sky-50">
      <div className="flex items-center justify-between rounded-3xl border border-sky-500/20 bg-slate-900/50 px-5 py-4 shadow-[0_20px_80px_rgba(14,165,233,0.18)]">
        <div>
          <p className="neon-chip mb-2">Bubble’it! launch pad</p>
          <h1 className="text-2xl font-semibold text-sky-100">Bubble’it! HQ</h1>
          <p className="text-sm text-slate-200/80">Pop neon bubbles, chain cheeky combos, claim the Bubble’it! crown.</p>
        </div>
        <Image src="/game-icons/icon.png" alt="Bubble’it! logo" width={72} height={72} className="drop-shadow-glow" />
      </div>

      <div className="grid gap-4">
        <button type="button" onClick={onPlay} className="neon-button w-full text-lg uppercase tracking-[0.35em]">
          ▶ Play
        </button>
        <button
          type="button"
          onClick={() => setShowHowTo(true)}
          className="rounded-2xl border border-sky-400/40 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:text-white"
        >
          How to Play
        </button>
        <button
          type="button"
          onClick={handleConnect}
          className="flex items-center justify-between rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-5 py-3 text-left text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/60 hover:text-white"
        >
          <span>
            Connect Wallet
            <span className="block text-xs font-medium text-emerald-100/70">{formatAddress(walletAddress)}</span>
          </span>
          <span className="text-[0.7rem] uppercase tracking-[0.22em] text-emerald-100/70">
            {connecting ? 'Linking…' : 'Base'}
          </span>
        </button>
        {error && <p className="text-xs text-rose-200/90">{error}</p>}
      </div>

      <section className="holo-card space-y-3">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-200/70">Booster Store</p>
            <h2 className="text-lg font-semibold text-sky-50">Base Pay Arsenal</h2>
          </div>
          <Image src="/game-icons/wallet.svg" alt="Wallet" width={32} height={32} />
        </header>
        {boosterStore}
      </section>

      <AnimatePresence>
        {showHowTo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              className="holo-card max-w-[320px] space-y-3 text-slate-100"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-sky-100">How to Play</h3>
                <button
                  type="button"
                  className="rounded-full border border-sky-300/30 bg-sky-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-sky-100"
                  onClick={() => setShowHowTo(false)}
                >
                  Close
                </button>
              </div>
              <ul className="space-y-2 text-sm leading-relaxed">
                <li><strong>Tap bubbles</strong> in rhythm. Missed taps shatter your combo.</li>
                <li><strong>Match colors</strong> for amplified combo multipliers and neon feedback.</li>
                <li><strong>Booster Rush</strong>: unlock power-ups via Base Pay to freeze time, magnetise, or double scores.</li>
                <li><strong>Bubble’it! Crown</strong> unlocks at 1,000 points—keep the streak alive!</li>
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
