'use client';

import sdk from '@farcaster/miniapp-sdk';
import { useEffect } from 'react';

export default function MiniAppBoot() {
  useEffect(() => {
    try {
      sdk.actions.ready?.();
    } catch {
      // ignore sdk readiness errors outside Farcaster
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const nonce =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;
        await sdk.actions.signIn?.({ nonce });
      } catch {
        // ignore signin errors when not in Farcaster
      }
    })();
  }, []);

  return null;
}
