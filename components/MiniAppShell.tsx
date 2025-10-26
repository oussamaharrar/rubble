'use client';

import { ReactNode } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';

interface MiniAppShellProps {
  children: ReactNode;
  playing: boolean;
}

export default function MiniAppShell({ children, playing }: MiniAppShellProps) {
  return (
    <div
      id="rubble-root"
      className="app-viewport safe-top safe-bottom"
      data-playing={playing ? '1' : '0'}
      role="application"
    >
      {children}
      <SpeedInsights />
    </div>
  );
}
