'use client';

import { ReactNode } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';

interface MiniAppShellProps {
  children: ReactNode;
}

export default function MiniAppShell({ children }: MiniAppShellProps) {
  return (
    <div className="miniapp-shell" role="application">
      <div className="miniapp-shell__frame">
        <div className="miniapp-shell__inner">{children}</div>
      </div>
      <SpeedInsights />
    </div>
  );
}
