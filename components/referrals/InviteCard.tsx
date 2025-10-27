'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useEconomyStore } from '@/lib/economy-store';
import { makeReferralCode } from '@/lib/referrals';

function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_URL ?? 'https://rubble-game.vercel.app';
}

type InviteCardProps = {
  className?: string;
};

export default function InviteCard({ className }: InviteCardProps) {
  const address = useEconomyStore((state) => state.address);
  const inviteLedger = useEconomyStore((state) => state.inviteLedger);
  const [copied, setCopied] = useState(false);

  const referral = useMemo(() => {
    if (!address) return null;
    try {
      return makeReferralCode(address);
    } catch {
      return null;
    }
  }, [address]);

  const totalUses = useMemo(
    () => Object.values(inviteLedger ?? {}).reduce((sum, value) => sum + value, 0),
    [inviteLedger]
  );

  const shareUrl = referral ? `${getBaseUrl()}?ref=${referral}` : null;

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.debug('Copy failed', error);
    }
  };

  return (
    <section
      className={clsx(
        'rounded-3xl border border-emerald-400/30 bg-slate-900/70 p-5 shadow-[0_20px_60px_rgba(16,185,129,0.2)]',
        className
      )}
    >
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/80">Invite &amp; Earn</p>
          <h3 className="text-lg font-semibold text-emerald-100">Referral Boosts</h3>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
          {totalUses} used
        </span>
      </header>
      <p className="mt-3 text-sm text-emerald-50/90">
        Share your link—when a friend connects, you both unlock boosts and a free play.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-mono text-emerald-100">
          {referral ?? 'Connect your wallet to mint a code'}
        </div>
        {shareUrl && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-emerald-50"
          >
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        )}
      </div>
    </section>
  );
}
