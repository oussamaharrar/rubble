'use client';

import { ReactNode } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { useGameStore } from '@/lib/store';

interface MiniAppShellProps {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}

export default function MiniAppShell({ header, footer, children }: MiniAppShellProps) {
  const phase = useGameStore((state) => state.phase);
  const playing = phase === 'playing' || phase === 'storm';

  return (
    <div
      id="rubble-root"
      className="app-viewport safe-top safe-bottom"
      data-playing={playing ? '1' : '0'}
      role="application"
    >
      {header}
      <main className="app-main pt-[var(--header-h)] pb-[var(--footer-h)]">{children}</main>
      {footer}
      <SpeedInsights />
    </div>
  );
}
