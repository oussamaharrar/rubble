'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEconomyStore } from '@/lib/economy-store';
import { encodeReferralCode, makeReferralUrl } from '@/lib/referrals';
import { PUBLIC_ENV } from '@/lib/env';

interface InviteCardProps {
  address?: `0x${string}`;
}

export default function InviteCard({ address }: InviteCardProps) {
  const inviteCount = useEconomyStore((state) => state.inviteCount);
  const [toast, setToast] = useState<string | null>(null);

  const code = address ? encodeReferralCode(address) : null;
  const inviteUrl = code ? makeReferralUrl(PUBLIC_ENV.NEXT_PUBLIC_URL, code) : PUBLIC_ENV.NEXT_PUBLIC_URL;

  const handleCopy = async () => {
    if (!code) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      }
      setToast('Referral link copied. Share it with a friend!');
    } catch {
      setToast('Copy failed. Tap and hold to share manually.');
    }
  };

  return (
    <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4 shadow-[0_12px_28px_rgba(16,185,129,0.25)]">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Invite &amp; Earn</p>
          <h3 className="text-lg font-semibold text-white">Refer friends for boosts</h3>
          <p className="text-sm text-emerald-100/80">Each new player that connects with your link grants +1 Boost.</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Invites redeemed · {inviteCount}
          </p>
          {code ? (
            <code className="mt-3 inline-flex max-w-full items-center rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
              {code}
            </code>
          ) : (
            <p className="mt-3 text-xs text-emerald-100/80">Connect your wallet to generate a referral code.</p>
          )}
        </div>
        <motion.button
          type="button"
          onClick={handleCopy}
          disabled={!code}
          whileTap={{ scale: code ? 0.95 : 1 }}
          className="min-h-[44px] rounded-full border border-emerald-400/60 bg-emerald-500/20 px-5 py-2 text-sm font-semibold text-emerald-50 shadow-[0_14px_24px_rgba(16,185,129,0.35)] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-800/40 disabled:text-slate-400"
        >
          Copy Link
        </motion.button>
      </div>
      <AnimatePresence>
        {toast ? (
          <motion.p
            key={toast}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
