'use client';

import { useMemo } from 'react';
import { useEconomyStore } from '@/lib/economy-store';

type FarcasterShareProps = {
  score?: number;
  combo?: number;
  className?: string;
};

function buildShareUrl(score?: number, combo?: number) {
  const baseText = score
    ? `I just scored ${score} in Rubble Rush${combo ? ` with combo ×${combo}` : ''}!`
    : 'Play Rubble Rush — tap combos, earn boosts, and race storms on Base.';
  const encodedText = encodeURIComponent(baseText);
  const target = encodeURIComponent(typeof window !== 'undefined' ? window.location.href : 'https://rubble.game');
  return `https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${target}`;
}

export default function FarcasterShare({ score, combo, className }: FarcasterShareProps) {
  const shareClaimed = useEconomyStore((state) => state.shareClaimedToday);
  const recordShareToday = useEconomyStore((state) => state.recordShareToday);
  const grantBoost = useEconomyStore((state) => state.grantBoost);

  const href = useMemo(() => buildShareUrl(score, combo), [score, combo]);

  const handleShare = () => {
    if (!shareClaimed) {
      grantBoost(1);
      recordShareToday();
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex w-full items-center justify-center rounded-2xl border border-purple-500/40 bg-purple-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-purple-100 shadow-[0_12px_40px_rgba(168,85,247,0.3)] ${className ?? ''}`}
    >
      {shareClaimed ? 'Shared — Boost Granted' : 'Share to Farcaster'}
    </button>
  );
}
