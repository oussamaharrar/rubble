'use client';

import { useEffect } from 'react';

export default function MobileVhFix() {
  useEffect(() => {
    const apply = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      const root = document.getElementById('rubble-root');
      if (root) {
        root.classList.add('vhfix');
      }
    };
    apply();
    window.addEventListener('resize', apply, { passive: true });
    window.addEventListener('orientationchange', apply, { passive: true });
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);
  return null;
}
