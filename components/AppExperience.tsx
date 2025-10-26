'use client';

import { ReactNode, useEffect } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { VhFixProvider } from '@/components/VhFixProvider';

interface AppExperienceProps {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  playing: boolean;
}

export default function AppExperience({ children, header, footer, playing }: AppExperienceProps) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const { body } = document;
    if (!body) return;

    const previousOverflow = body.style.overflow;
    if (playing) {
      body.style.overflow = 'hidden';
    } else if (previousOverflow === 'hidden') {
      body.style.overflow = '';
    }

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [playing]);

  return (
    <div
      id="rubble-root"
      className="app-viewport safe-top safe-bottom"
      data-playing={playing ? '1' : '0'}
      role="application"
    >
      <VhFixProvider />
      <header className="home-chrome fixed inset-x-0 top-0 z-40 h-[var(--header-h)] border-b border-white/10 bg-[#06080f]/70 backdrop-blur-md">
        <div className="app-chrome__inner">{header}</div>
      </header>

      <main className="app-main">
        <div className="app-frame">
          <div className="app-frame__inner">{children}</div>
        </div>
      </main>

      <footer className="home-chrome fixed inset-x-0 bottom-0 z-40 h-[var(--footer-h)] border-t border-white/10 bg-[#06080f]/80 backdrop-blur-md">
        <div className="app-chrome__inner text-sm text-gray-300">{footer}</div>
      </footer>
      <SpeedInsights />
    </div>
  );
}
