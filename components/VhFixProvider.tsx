'use client';

import { useEffect } from 'react';

export default function VhFixProvider() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const update = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const vh = viewportHeight / 100;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    update();

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);

    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return null;
}
