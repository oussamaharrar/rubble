'use client';

import PayButton from '@/components/PayButton';

interface ShopModalProps {
  freeOrbs: number;
  onUseFreeOrb: () => void;
  freeDisabled: boolean;
}

export default function ShopModal({ freeOrbs, onUseFreeOrb, freeDisabled }: ShopModalProps) {
  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/5">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
          <span>Energy Orbs</span>
          <span className="text-base font-semibold text-white">{freeOrbs}</span>
        </div>
        <p className="mt-2 text-xs text-slate-300">
          Energy Orbs trigger slow-time instantly without a Base payment. Earn them from daily missions and storm Energy Orbs.
        </p>
        <button
          type="button"
          onClick={onUseFreeOrb}
          disabled={freeDisabled}
          className="mt-4 w-full rounded-2xl bg-emerald-500/90 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-emerald-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
        >
          Use Free Orb
        </button>
      </div>
      <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/5">
        <h3 className="text-sm font-semibold text-white">Buy Boost on Base</h3>
        <p className="text-xs text-slate-300">
          Paid boost activates the same 5s slow-time effect and stacks with Energy Orbs.
        </p>
        <PayButton label="Boost on Base · 1 wei" />
      </div>
      <p className="text-xs text-slate-400">
        Boost activations slow bubbles for 5 seconds and add a soft blue storm aura.
      </p>
    </div>
  );
}
