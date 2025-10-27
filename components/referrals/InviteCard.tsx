'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useEconomyStore } from '@/lib/economy-store';

function toBase64Url(value: string) {
  return btoa(value).replace(/=+$/u, '').replace(/\+/gu, '-').replace(/\//gu, '_');
}

async function deriveCode(address: string) {
  return toBase64Url(address.toLowerCase());
}

export default function InviteCard() {
  const address = useEconomyStore((state) => state.address);
  const invitesUsed = useEconomyStore((state) => state.invitesUsed);
  const [code, setCode] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!address) {
      setCode('');
      return () => {
        cancelled = true;
      };
    }
    deriveCode(address).then((value) => {
      if (!cancelled) {
        setCode(value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    if (copied) {
      const timeout = window.setTimeout(() => setCopied(false), 2000);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [copied]);

  const invites = useMemo(() => {
    if (!address) return 0;
    return invitesUsed[address] ?? 0;
  }, [address, invitesUsed]);

  const inviteUrl = useMemo(() => {
    if (!code || typeof window === 'undefined') return '';
    const base = window.location.origin;
    return `${base}/?ref=${code}`;
  }, [code]);

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!address) {
    return (
      <div className="rounded-3xl border border-white/15 bg-slate-900/60 p-5 text-sm text-slate-300">
        Connect your wallet to generate a referral link.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/15 bg-slate-900/60 p-5 text-left shadow-inner shadow-black/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Invite a Friend</p>
          <p className="text-lg font-semibold text-white">Code {code}</p>
        </div>
        <span className="rounded-full border border-sky-400/40 bg-sky-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
          Boosts + Trial
        </span>
      </div>
      <p className="text-sm text-slate-200">
        Share your link. When a new player connects with it, you both earn a Boost and free play.
      </p>
      <motion.button
        type="button"
        onClick={handleCopy}
        whileTap={{ scale: 0.97 }}
        className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
      >
        {copied ? 'Copied!' : 'Copy Invite Link'}
      </motion.button>
      <p className="text-xs text-slate-400">Invites redeemed: {invites}</p>
    </div>
  );
}
