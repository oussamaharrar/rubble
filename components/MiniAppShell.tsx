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
    <div id="rubble-root" className="app-viewport safe-top safe-bottom" data-playing={playing ? '1' : '0'} role="application">
      <header className="home-chrome fixed inset-x-0 top-0 z-40 h-[var(--header-h)] bg-[#06080f]/70 backdrop-blur-md border-b border-white/10">
        <div className="mx-auto flex h-full w-full max-w-[var(--frame-w)] items-center justify-between px-4">
          {header}
        </div>
      </header>

      <main className="app-main pt-[var(--header-h)] pb-[var(--footer-h)]">
        <div className="miniapp-frame">
          <div className="frame-inner">
            {children}
          </div>
        </div>
      </main>

      <footer className="home-chrome fixed inset-x-0 bottom-0 z-40 h-[var(--footer-h)] bg-[#06080f]/80 backdrop-blur-md border-t border-white/10 text-sm text-gray-300">
        <div className="mx-auto flex h-full w-full max-w-[var(--frame-w)] items-center justify-around px-4">
          {footer}
        </div>
      </footer>
      <SpeedInsights />
    </div>
  );
}
