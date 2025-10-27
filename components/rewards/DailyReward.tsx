'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useEconomyStore } from '@/lib/economy-store';
import { getDailyRewardForDay, rewardToText, spinWheel, type RewardGrant } from '@/lib/rewards';

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

type DailyRewardProps = {
  className?: string;
  onClaim?: (grant: RewardGrant) => void;
};

export default function DailyReward({ className, onClaim }: DailyRewardProps) {
  const streak = useEconomyStore((state) => state.streak) || 1;
  const claimedAt = useEconomyStore((state) => state.dailyRewardClaimedAt);
  const grantBoost = useEconomyStore((state) => state.grantBoost);
  const addBubbles = useEconomyStore((state) => state.addBubbles);
  const grantDoubleScore = useEconomyStore((state) => state.grantDoubleScore);
  const addSkin = useEconomyStore((state) => state.addSkin);
  const addSticker = useEconomyStore((state) => state.addSticker);
  const setDailyRewardClaimed = useEconomyStore((state) => state.setDailyRewardClaimed);

  const [result, setResult] = useState<RewardGrant | null>(null);

  const reward = useMemo(() => getDailyRewardForDay(streak), [streak]);
  const alreadyClaimed = claimedAt === todayKey();

  const handleGrant = (grant: RewardGrant) => {
    switch (grant.kind) {
      case 'boost':
        grantBoost(grant.amount);
        break;
      case 'bubbles':
        addBubbles(grant.amount);
        break;
      case 'double':
        grantDoubleScore();
        break;
      case 'skin':
        addSkin(grant.id);
        break;
      case 'sticker':
        addSticker(grant.id);
        break;
      default:
        break;
    }
    setDailyRewardClaimed(todayKey());
    setResult(grant);
    onClaim?.(grant);
  };

  const handleClaim = () => {
    if (alreadyClaimed) return;
    if (reward.grant.kind === 'wheel') {
      const prize = spinWheel();
      handleGrant(prize);
      return;
    }
    handleGrant(reward.grant);
  };

  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="rounded-3xl border border-sky-400/30 bg-slate-900/70 p-5 shadow-[0_28px_80px_rgba(56,189,248,0.22)]">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-200/80">Daily Reward</p>
            <h3 className="text-xl font-semibold text-sky-50">Streak Day {streak}</h3>
          </div>
          <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
            {alreadyClaimed ? 'Claimed' : 'Ready'}
          </span>
        </header>
        <div className="mt-4 space-y-2 text-sm text-slate-200/90">
          <p className="text-base font-semibold text-sky-100">{reward.label}</p>
          <p>{reward.description}</p>
          {result && (
            <p className="text-xs font-semibold text-emerald-200">{rewardToText(result)}</p>
          )}
        </div>
        <motion.button
          type="button"
          onClick={handleClaim}
          disabled={alreadyClaimed}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 text-sm font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-sky-500/30 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-300"
          whileTap={{ scale: alreadyClaimed ? 1 : 0.97 }}
        >
          {alreadyClaimed ? 'Come Back Tomorrow' : reward.grant.kind === 'wheel' ? 'Spin the Wheel' : 'Claim Reward'}
        </motion.button>
      </div>
    </motion.section>
  );
}
