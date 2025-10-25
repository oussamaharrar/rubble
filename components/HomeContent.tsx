'use client';

import { useCallback, useState } from 'react';
import MiniAppShell from './MiniAppShell';
import WalletBar from './WalletBar';
import PayButton from './PayButton';
import Modal from './Modal';
import { DangerButton, GhostButton } from './Buttons';
import BubbleGameCanvas from '@/app/game/BubbleGameCanvas';

const HOW_TO_PLAY_TIPS = [
  'Tap clusters of bubbles quickly to build your combo multiplier.',
  'Keep your streak alive—missing taps will reset your combo and slow the score.',
  'Trigger the Base Pay boost when things get fast to freeze time for 5 seconds.',
  'Booster rewards stack with your combo, so activate them during high streaks.',
];

export default function HomeContent() {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  const openHowToPlay = useCallback(() => setHowToPlayOpen(true), []);
  const closeHowToPlay = useCallback(() => setHowToPlayOpen(false), []);

  const handleRetry = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('rubble:reset-game'));
  }, []);

  return (
    <MiniAppShell>
      <div className="flex h-full flex-col bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950/90">
        <div className="border-b border-white/10 p-4">
          <WalletBar />
        </div>
        <div className="flex-1 overflow-hidden p-4 pb-2">
          <div className="h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40 shadow-inner shadow-black/40">
            <BubbleGameCanvas />
          </div>
        </div>
        <div className="space-y-4 border-t border-white/5 p-4">
          <PayButton />
          <div className="flex flex-wrap gap-3">
            <GhostButton type="button" onClick={openHowToPlay}>
              How to Play
            </GhostButton>
            <DangerButton type="button" onClick={handleRetry}>
              Retry
            </DangerButton>
          </div>
        </div>
      </div>
      <Modal open={howToPlayOpen} title="How to Play" onClose={closeHowToPlay}>
        <ul className="list-disc space-y-2 pl-5 text-left text-sm text-slate-200">
          {HOW_TO_PLAY_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </Modal>
    </MiniAppShell>
  );
}
