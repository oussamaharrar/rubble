'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  economyTodayKey,
  useEconomyStore,
} from '@/lib/economy-store';

const REWARD_PREFIX = 'rubble:reward:';

type RewardKind =
  | { type: 'boost'; amount: number; label: string }
  | { type: 'bubbles'; amount: number; label: string }
  | { type: 'double'; label: string }
  | { type: 'skin'; label: string; id: string }
  | { type: 'sticker'; label: string; id: string }
  | { type: 'wheel'; label: string };

function readClaimed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(`${REWARD_PREFIX}${economyTodayKey()}`) === '1';
  } catch {
    return false;
  }
}

function markClaimed() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${REWARD_PREFIX}${economyTodayKey()}`, '1');
  } catch {
    // ignore persistence issues
  }
}

function rewardForStreak(streak: number): RewardKind {
  if (streak <= 1) {
    return { type: 'boost', amount: 1, label: 'Boost Charge' };
  }
  if (streak === 2) {
    return { type: 'bubbles', amount: 50, label: '+50 Bubbles' };
  }
  if (streak === 3) {
    return { type: 'double', label: 'Double Score (1 run)' };
  }
  if (streak === 4) {
    return { type: 'skin', label: 'Glacier Balloon Skin', id: 'skin_glacier' };
  }
  if (streak === 5) {
    return { type: 'sticker', label: 'Storm Sticker', id: 'sticker_storm' };
  }
  if (streak >= 7) {
    return { type: 'wheel', label: 'Wheel Spin' };
  }
  return { type: 'bubbles', amount: 75, label: '+75 Bubbles' };
}

function spinWheel(): RewardKind {
  const wheel: RewardKind[] = [
    { type: 'boost', amount: 2, label: '2 Boosts' },
    { type: 'bubbles', amount: 150, label: '+150 Bubbles' },
    { type: 'skin', label: 'Neon Mirage Skin', id: 'skin_neon_mirage' },
    { type: 'sticker', label: 'Cascade Sticker', id: 'sticker_cascade' },
    { type: 'double', label: 'Double Score (1 run)' },
  ];
  const idx = Math.floor(Math.random() * wheel.length);
  return wheel[idx] ?? wheel[0];
}

export default function DailyReward() {
  const hydrate = useEconomyStore((state) => state.hydrate);
  const hydrated = useEconomyStore((state) => state.hydrated);
  const streak = useEconomyStore((state) => state.streak);
  const noteDailyLogin = useEconomyStore((state) => state.noteDailyLogin);
  const grantBoost = useEconomyStore((state) => state.grantBoost);
  const addBubbles = useEconomyStore((state) => state.addBubbles);
  const addSkin = useEconomyStore((state) => state.addSkin);
  const addSticker = useEconomyStore((state) => state.addSticker);
  const grantDoubleScore = useEconomyStore((state) => state.grantDoubleScore);
  const [claimed, setClaimed] = useState(() => readClaimed());
  const [resolvedReward, setResolvedReward] = useState<RewardKind | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    noteDailyLogin();
  }, [hydrated, noteDailyLogin]);

  useEffect(() => {
    if (!hydrated) return;
    if (!claimed) {
      setResolvedReward(rewardForStreak(Math.max(1, streak || 1)));
    }
  }, [hydrated, claimed, streak]);

  const handleReward = useCallback(
    (reward: RewardKind) => {
      switch (reward.type) {
        case 'boost':
          grantBoost(reward.amount);
          break;
        case 'bubbles':
          addBubbles(reward.amount);
          break;
        case 'double':
          grantDoubleScore(1);
          break;
        case 'skin':
          addSkin(reward.id);
          break;
        case 'sticker':
          addSticker(reward.id);
          break;
        case 'wheel': {
          const spun = spinWheel();
          handleReward(spun);
          setResolvedReward(spun);
          return;
        }
        default:
          break;
      }
    },
    [addBubbles, addSkin, addSticker, grantBoost, grantDoubleScore]
  );

  const handleClaim = useCallback(() => {
    if (!resolvedReward || claimed) return;
    handleReward(resolvedReward);
    markClaimed();
    setClaimed(true);
  }, [claimed, handleReward, resolvedReward]);

  const description = useMemo(() => {
    if (!resolvedReward) return 'Loading reward…';
    switch (resolvedReward.type) {
      case 'boost':
        return `${resolvedReward.amount} Boost`;
      case 'bubbles':
        return `${resolvedReward.amount} Bubbles`;
      case 'double':
        return 'Double Score on your next run.';
      case 'skin':
        return `${resolvedReward.label} unlocked.`;
      case 'sticker':
        return `${resolvedReward.label} added to your album.`;
      case 'wheel':
        return 'Spin the wheel for a surprise bonus!';
      default:
        return '';
    }
  }, [resolvedReward]);

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/15 bg-slate-900/70 p-5 text-left shadow-inner shadow-black/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Daily Reward</p>
          <p className="text-lg font-semibold text-white">Streak Day {Math.max(1, streak || 1)}</p>
        </div>
        <span className="rounded-full border border-sky-400/40 bg-sky-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-100">
          Streak {Math.max(1, streak || 1)}
        </span>
      </div>
      <p className="text-sm text-slate-200">{description}</p>
      <motion.button
        type="button"
        onClick={handleClaim}
        disabled={claimed || !resolvedReward}
        whileTap={claimed || !resolvedReward ? undefined : { scale: 0.97 }}
        className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {claimed ? 'Claimed' : 'Claim Reward'}
      </motion.button>
    </div>
  );
}
