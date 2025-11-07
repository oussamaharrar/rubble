'use client';

import { useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

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
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;
        await sdk.actions.signIn?.({ nonce, acceptAuthAddress: true });
        // If already signed in, this resolves silently; otherwise Farcaster shows the prompt.
      } catch {
        // Not in Farcaster context or user canceled; leave UI to whoami gate
      }
    })();
  }, []);

  return null;
}
