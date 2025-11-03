'use client';

import { useEffect } from 'react';
import sdk from '@farcaster/miniapp-sdk';

export default function FarcasterMiniAppReady() {
  useEffect(() => {
    try {
      sdk.actions.ready?.();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[farcaster] ready action failed', error);
      }
    }
  }, []);

  return null;
}
