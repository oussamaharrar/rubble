'use client';

import { ReactNode } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';

interface MiniAppShellProps {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  playing: boolean;
}

export default function MiniAppShell({ children, header, footer, playing }: MiniAppShellProps) {
  return (
    <div
      id="rubble-root"
      className="app-viewport safe-top safe-bottom"
      data-playing={playing ? '1' : '0'}
      role="application"
    >
      <header className="fixed top-0 inset-x-0 h-[var(--header-h)] z-40 bg-[#06080f]/70 backdrop-blur-md border-b border-white/10 home-chrome">
        <div className="flex h-full items-center justify-between px-4">{header}</div>
      </header>

      <main className="app-main pt-[var(--header-h)] pb-[var(--footer-h)]">
        <div className="miniapp-frame">
          <div className="frame-inner">
            {children}
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 inset-x-0 h-[var(--footer-h)] z-40 bg-[#06080f]/80 backdrop-blur-md border-t border-white/10 flex items-center justify-around text-sm text-gray-300 home-chrome">
        <div className="flex w-full items-center justify-around px-4">{footer}</div>
      </footer>
      <SpeedInsights />
    </div>
  );
}
