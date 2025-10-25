'use client';

import Modal from './Modal';
import PayButton from './PayButton';
import { useGameStore } from '@/lib/store';

interface ShopModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ShopModal({ open, onClose }: ShopModalProps) {
  const freeOrbs = useGameStore((state) => state.boosterBank.freeOrbs);
  const consumeBooster = useGameStore((state) => state.consumeBooster);

  const handleUseOrb = () => {
    const used = consumeBooster();
    if (used) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Boosts & Shop"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Close
        </button>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-2xl border border-sky-400/30 bg-slate-900/70 p-4 shadow-inner shadow-black/30">
          <p className="text-sm font-semibold text-slate-100">Booster Orbs</p>
          <p className="text-xs text-slate-300/80">Free slow-time activations earned from missions.</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100">{freeOrbs} available</span>
            <button
              type="button"
              onClick={handleUseOrb}
              className="rounded-2xl border border-sky-400/40 bg-slate-900/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-400"
              disabled={freeOrbs === 0}
            >
              Use Free Orb
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
    </Modal>
  );
}
