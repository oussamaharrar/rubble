'use client';

import { ReactNode } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { useGameStore } from '@/lib/store';

interface MiniAppShellProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
}

export default function MiniAppShell({ children, header, footer }: MiniAppShellProps) {
  const phase = useGameStore((state) => state.phase);
  const playing = phase === 'playing' || phase === 'storm';

  return (
    <div
      id="rubble-root"
      className="app-viewport safe-top safe-bottom"
      role="application"
      data-playing={playing ? '1' : '0'}
    >
      <header className="fixed top-0 inset-x-0 h-[var(--header-h)] z-40 bg-[#06080f]/70 backdrop-blur-md border-b border-white/10 home-chrome">
        <div className="mx-auto flex h-full w-full max-w-[var(--frame-w)] items-center justify-between px-4 text-sm text-gray-300">
          {header}
        </div>
      </header>

      <main className="app-main pt-[var(--header-h)] pb-[var(--footer-h)]">
        <div className="miniapp-frame px-3">
          <div className="frame-inner relative mx-auto w-full" style={{ aspectRatio: '424 / 695' }}>
            {children}
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 inset-x-0 h-[var(--footer-h)] z-40 bg-[#06080f]/80 backdrop-blur-md border-t border-white/10 home-chrome">
        <div className="mx-auto flex h-full w-full max-w-[var(--frame-w)] items-center justify-around px-6 text-sm text-gray-300">
          {footer}
        </div>
      </footer>
      <SpeedInsights />
    </div>
  );
}
