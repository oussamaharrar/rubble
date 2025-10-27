'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEconomyStore } from '@/lib/economy-store';
import { encodeReferralCode, makeReferralUrl } from '@/lib/referrals';
import { PUBLIC_ENV } from '@/lib/env';

interface FarcasterShareProps {
  address?: `0x${string}`;
}

export default function FarcasterShare({ address }: FarcasterShareProps) {
  const recordShareToday = useEconomyStore((state) => state.recordShareToday);
  const [toast, setToast] = useState<string | null>(null);

  const handleShare = () => {
    const baseUrl = PUBLIC_ENV.NEXT_PUBLIC_URL;
    const targetUrl = address ? makeReferralUrl(baseUrl, encodeReferralCode(address)) : baseUrl;
    const text = encodeURIComponent('Popping streaks on Rubble Rush — come play!');
    const composeUrl = `https://warpcast.com/~/compose?text=${text}&embeds[]=${encodeURIComponent(targetUrl)}`;

    if (typeof window !== 'undefined') {
      window.open(composeUrl, '_blank', 'noopener');
    }
    const granted = recordShareToday();
    setToast(granted ? 'Share bonus applied · +1 Boost' : 'Share logged · come back tomorrow for more boosts.');
  };

  return (
    <div className="rounded-3xl border border-purple-500/30 bg-purple-500/10 p-4 shadow-[0_12px_24px_rgba(88,28,135,0.35)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">Daily Share</p>
          <h3 className="text-lg font-semibold text-white">Share to Farcaster</h3>
          <p className="text-sm text-purple-100/80">Drop a cast to earn a daily boost bonus.</p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={handleShare}
          className="min-h-[44px] rounded-full border border-purple-400/50 bg-purple-500/30 px-5 py-2 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(168,85,247,0.35)]"
        >
          Cast it
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
            className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-100"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
