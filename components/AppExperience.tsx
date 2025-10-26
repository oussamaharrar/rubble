'use client';

import { ReactNode, useEffect } from 'react';
import { useGameStore } from '@/lib/store';

const LOCKED_PHASES = new Set(['playing', 'storm', 'paused']);

interface AppExperienceProps {
  children: ReactNode;
  hud: ReactNode;
}

export default function AppExperience({ children, hud }: AppExperienceProps) {
  const phase = useGameStore((state) => state.phase);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const original = document.body.style.overflow;
    const shouldLock = LOCKED_PHASES.has(phase);

    if (shouldLock) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = original;
    }

    return () => {
      document.body.style.overflow = original;
    };
  }, [phase]);

  return (
    <div className="app-frame">
      {children}
      <div className="app-hud">
        {hud}
      </div>
    </div>
  );
}
