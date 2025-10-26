'use client';

import { ReactNode } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';

interface AppExperienceProps {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  playing: boolean;
}

export default function AppExperience({ children, header, footer, playing }: AppExperienceProps) {
  return (
    <div
      id="rubble-root"
      className="app-viewport safe-top safe-bottom"
      data-playing={playing ? '1' : '0'}
      role="application"
    >
      <header className="home-chrome app-chrome app-chrome--top">
        <div className="app-chrome__inner">{header}</div>
      </header>

      <main className="app-main">
        <div className="app-frame">
          <div className="app-frame__inner">{children}</div>
        </div>
      </main>

      <footer className="home-chrome app-chrome app-chrome--bottom">
        <div className="app-chrome__inner">{footer}</div>
      </footer>
      <SpeedInsights />
    </div>
  );
}
