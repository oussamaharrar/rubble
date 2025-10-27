'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useEconomyStore,
  type DailyRewardType,
  previewDailyReward,
} from '@/lib/economy-store';

interface DailyRewardProps {
  onClaimed?: (reward: DailyRewardType) => void;
}

function rewardSummary(reward: DailyRewardType) {
  switch (reward.kind) {
    case 'boost':
      return `${reward.amount} Boost${reward.amount > 1 ? 's' : ''}`;
    case 'bubbles':
      return `+${reward.amount} Bubbles`;
    case 'double-score':
      return `${reward.amount}× Double Score`;
    case 'skin':
      return reward.label;
    case 'sticker':
      return reward.label;
    case 'wheel':
      return reward.label;
    default:
      return 'Reward';
  }
}

export default function DailyReward({ onClaimed }: DailyRewardProps) {
  const streak = useEconomyStore((state) => state.streak);
  const lastLogin = useEconomyStore((state) => state.lastLogin);
  const todayRewardClaimed = useEconomyStore((state) => state.todayRewardClaimed);
  const claimDailyReward = useEconomyStore((state) => state.claimDailyReward);

  const [toast, setToast] = useState<string | null>(null);

  const reward = previewDailyReward(streak, lastLogin);

  const handleClaim = () => {
    const result = claimDailyReward();
    if (!result) {
      setToast('Already claimed today\'s reward. Come back tomorrow!');
      return;
    }
    onClaimed?.(result.reward);
    const summary = rewardSummary(result.reward);
    if (result.reward.kind === 'wheel' && result.reward.result) {
      setToast(`Wheel spun! You earned ${rewardSummary(result.reward.result)}.`);
    } else {
      setToast(`Reward claimed: ${summary}.`);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.4)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Daily Reward</p>
          <h2 className="text-xl font-bold text-white">{rewardSummary(reward)}</h2>
          <p className="mt-1 text-sm text-slate-300">{reward.description}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
            Streak · {Math.max(1, streak)} day{Math.max(1, streak) === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: todayRewardClaimed ? 1 : 0.96 }}
            onClick={handleClaim}
            disabled={todayRewardClaimed}
            className="min-h-[44px] rounded-full border border-sky-400/50 bg-sky-500/20 px-5 py-2 text-sm font-semibold text-sky-100 shadow-[0_12px_24px_rgba(56,189,248,0.25)] transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-800/60 disabled:text-slate-400"
          >
            {todayRewardClaimed ? 'Claimed' : 'Claim Reward'}
          </motion.button>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Keep streak alive</span>
        </div>
      </div>
      <AnimatePresence>
        {toast ? (
          <motion.p
            key={toast}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
