'use client';

import Modal from '@/components/Modal';
import PayButton from '@/components/PayButton';

interface ShopModalProps {
  open: boolean;
  freeOrbs: number;
  onUseFreeOrb: () => void;
  onClose: () => void;
}

export default function ShopModal({ open, freeOrbs, onUseFreeOrb, onClose }: ShopModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Boosts & Shop"
      footer={[
        <button
          key="close"
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
        >
          Close
        </button>,
      ]}
    >
      <div className="space-y-4 text-sm text-slate-200">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Free Booster Orbs</p>
              <p className="text-xs text-slate-300/80">Earned from daily missions · triggers slow time for 5 seconds.</p>
            </div>
            <span className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-100">{freeOrbs}</span>
          </div>
          <button
            type="button"
            onClick={onUseFreeOrb}
            disabled={freeOrbs <= 0}
            className="mt-4 w-full rounded-2xl border border-emerald-400/70 bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
          >
            Use Free Orb Now
          </button>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/30">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Buy Boost on Base</p>
              <p className="text-xs text-slate-300/80">Instant slow time for 5 seconds · paid via Base.</p>
            </div>
          </div>
          <PayButton boosterType="time-freeze" amountWei={1n} label="Boost on Base · 1 wei" />
        </div>
      </div>
    </Modal>
  );
}
