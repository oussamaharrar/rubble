'use client';

import Modal from './Modal';
import LeaderboardPanel from './LeaderboardPanel';

interface LeaderboardModalProps {
  open: boolean;
  onClose: () => void;
  address?: string | null;
  identityLabel?: string | null;
  refreshToken?: number;
}

export default function LeaderboardModal({
  open,
  onClose,
  address,
  identityLabel,
  refreshToken = 0,
}: LeaderboardModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Leaderboard"
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
      <div data-testid="leaderboard-modal">
        <LeaderboardPanel address={address} identityLabel={identityLabel} refreshToken={refreshToken} />
      </div>
    </Modal>
  );
}
