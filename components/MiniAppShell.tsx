'use client';

import { ReactNode } from 'react';
import clsx from 'clsx';
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
      <header className="home-chrome fixed inset-x-0 top-0 z-40 h-[var(--header-h)] border-b border-white/10 bg-[#06080f]/70 backdrop-blur-md">
        <div className="mx-auto flex h-full w-full max-w-[var(--frame-w)] items-center justify-between px-6">
          {header}
        </div>
      </header>

      <main
        className={clsx(
          'app-main',
          playing ? 'pt-0 pb-0' : 'pt-[var(--header-h)] pb-[var(--footer-h)]'
        )}
      >
        {playing ? (
          children
        ) : (
          <div className="miniapp-frame">
            <div className="frame-inner">
              {children}
            </div>
          </div>
        )}
      </main>

      <footer className="home-chrome fixed inset-x-0 bottom-0 z-40 h-[var(--footer-h)] border-t border-white/10 bg-[#06080f]/80 backdrop-blur-md">
        <div className="mx-auto flex h-full w-full max-w-[var(--frame-w)] items-center justify-between px-6 text-sm text-gray-300">
          {footer}
        </div>
      </footer>
      <SpeedInsights />
    </div>
  );
}
