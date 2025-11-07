'use client';

import miniAppSdk from '@farcaster/miniapp-sdk';
import { useEffect } from 'react';

export default function MiniAppBoot() {
  useEffect(() => {
    try {
      miniAppSdk.actions.ready?.();
    } catch {
      // ignore sdk readiness failures outside Farcaster
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const nonce =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;
        await miniAppSdk.actions.signIn?.({ nonce });
      } catch {
        // ignore signin failures (user may decline)
      }
    })();
  }, []);

  return null;
}
