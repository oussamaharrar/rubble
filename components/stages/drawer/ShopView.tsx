'use client';

import PayButton from '@/components/PayButton';
import { useGameStore } from '@/lib/store';

export default function ShopView() {
  const freeOrbs = useGameStore((state) => state.boosterBank.freeOrbs);
  const consumeBooster = useGameStore((state) => state.consumeBooster);

  const handleUseOrb = () => {
    void consumeBooster();
  };

  return (
    <div className="space-y-4 text-left text-sm text-slate-200">
      <div className="rounded-2xl border border-sky-400/30 bg-slate-900/70 p-4 shadow-inner shadow-black/30">
        <p className="text-sm font-semibold text-slate-100">Booster Orbs</p>
        <p className="text-xs text-slate-300/80">Free slow-time activations earned from missions.</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100">{freeOrbs} available</span>
          <button
            type="button"
            onClick={handleUseOrb}
            className="button-tap rounded-2xl border border-sky-400/40 bg-slate-900/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-400"
            disabled={freeOrbs === 0}
          >
            Use free orb
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-inner shadow-black/30">
        <p className="text-sm font-semibold text-slate-100">Boost on Base</p>
        <p className="text-xs text-slate-300/80">
          Trigger a 5 second slow-time using the Base payment rail. Charges 1 wei and respects your existing wallet flow.
        </p>
        <div className="mt-3 max-w-[240px]">
          <PayButton label="Boost on Base · 1 wei" />
        </div>
      </div>
    </div>
  );
}
