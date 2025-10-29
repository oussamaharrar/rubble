'use client';

type TelemetryEventName =
  | 'wallet_connected'
  | 'trial_granted'
  | 'gate_shown'
  | 'run_started'
  | 'run_ended'
  | 'shop_opened'
  | 'purchase_intent'
  | 'purchase_success'
  | 'invite_shared'
  | 'daily_claimed';

declare global {
  interface Window {
    analytics?: {
      track?: (event: string, payload?: Record<string, unknown>) => void;
    };
    gtag?: (...args: unknown[]) => void;
  }
}

function sanitizePayload(payload?: Record<string, unknown>) {
  if (!payload) {
    return {} as Record<string, unknown>;
  }
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && typeof value !== 'function')
  );
}

export function logEvent(name: TelemetryEventName, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return;
  }
  const data = sanitizePayload(payload);
  let delivered = false;

  try {
    if (typeof window.analytics?.track === 'function') {
      window.analytics.track(name, data);
      delivered = true;
    }
  } catch (error) {
    console.debug('[telemetry] analytics.track failed', error);
  }

  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, data);
      delivered = true;
    }
  } catch (error) {
    console.debug('[telemetry] gtag failed', error);
  }

  if (!delivered) {
    console.info(`[telemetry] ${name}`, data);
  }
}

export function summarizeAddress(address: string | null | undefined) {
  if (!address) return undefined;
  const normalized = address.trim();
  if (normalized.length <= 10) {
    return normalized;
  }
  const prefix = normalized.slice(0, 6);
  const suffix = normalized.slice(-4);
  return `${prefix}…${suffix}`;
}

export type { TelemetryEventName };

