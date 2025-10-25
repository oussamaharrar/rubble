'use client';

import Modal from '@/components/Modal';

interface HowToPlayModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HowToPlayModal({ open, onClose }: HowToPlayModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="How to Play"
      footer={[
        <button
          key="close"
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
        >
          Let&rsquo;s Rush
        </button>,
      ]}
    >
      <ol className="space-y-4 text-sm text-slate-200">
        <li>
          <strong className="text-white">Beat the storm timer.</strong> You start with 60 seconds. Pop bubbles to gain +0.5s and +10 points. Missing or hitting poison costs 3 seconds.
        </li>
        <li>
          <strong className="text-white">Chain combos.</strong> Pop the same colour within 5 seconds to build combo × multipliers up to ×4. Switching colours or missing resets the chain.
        </li>
        <li>
          <strong className="text-white">Weather the Base storm.</strong> Every 30 seconds a storm spawns glowing energy orbs (bonus points + free boosters) and drain orbs (lose time and score). They move faster and wobble more.
        </li>
        <li>
          <strong className="text-white">Spend boosters wisely.</strong> Daily missions award free Booster Orbs. Paid boosts trigger the same slow-time effect via Base payments. Both last 5 seconds and stack with combos.
        </li>
        <li>
          <strong className="text-white">Keep the streak.</strong> Streaks increase mission progress and unlock daily rewards. Claim boosters in the Missions panel each day.
        </li>
      </ol>
    </Modal>
  );
}
