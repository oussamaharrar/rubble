'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useEconomyStore } from '@/lib/economy-store';
import { shareUrl } from '@/lib/leaderboard';
import type { BoardKind } from '@/types/game';

type FarcasterShareProps = {
  score?: number;
  board?: BoardKind;
};

export default function FarcasterShare({ score, board = 'normal' }: FarcasterShareProps) {
  const shareRewarded = useEconomyStore((state) => state.shareRewardedToday);
  const recordShareToday = useEconomyStore((state) => state.recordShareToday);
  const grantBoost = useEconomyStore((state) => state.grantBoost);

  const shareHref = useMemo(() => {
    const url = shareUrl({ score: score ?? 0, board });
    const composer = new URL('https://warpcast.com/~/compose');
    const label = board === 'daily' ? 'Daily Challenge' : 'Arcade';
    const scoreLabel = typeof score === 'number' && score > 0 ? `score: ${score}!` : 'Run Rubble Rush!';
    composer.searchParams.set('text', `My Rubble ${label} ${scoreLabel}\n${url}`);
    return composer.toString();
  }, [board, score]);

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      window.open(shareHref, '_blank', 'noopener');
    }
    if (!shareRewarded) {
      recordShareToday();
      grantBoost(1);
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleShare}
      whileTap={{ scale: 0.97 }}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-400/60 bg-purple-500/15 px-5 py-2 text-sm font-semibold text-purple-100 shadow-lg shadow-purple-500/30"
    >
      <span>Share to Farcaster</span>
      <span className="rounded-full bg-purple-500/25 px-2 py-0.5 text-xs uppercase tracking-[0.2em]">
        {shareRewarded ? 'Boost Claimed' : '+1 Boost'}
      </span>
    </motion.button>
  );
}
