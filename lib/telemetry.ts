'use client';

type EventPayload = Record<string, unknown> | undefined;

declare global {
  interface Window {
    analytics?: { track: (name: string, data?: Record<string, unknown>) => void };
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function safePayload(payload: EventPayload) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  return payload;
}

export function logEvent(name: string, payload?: EventPayload) {
  const data = safePayload(payload);
  if (typeof window === 'undefined') {
    console.info(`[telemetry] ${name}`, data);
    return;
  }

  try {
    if (window.analytics && typeof window.analytics.track === 'function') {
      window.analytics.track(name, data);
      return;
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, data);
      return;
    }
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...data });
      return;
    }
  } catch (error) {
    console.info(`[telemetry] ${name}`, { ...data, error: (error as Error)?.message });
    return;
  }

  console.info(`[telemetry] ${name}`, data);
}
