'use client';

type TelemetryPayload = Record<string, unknown> | undefined;

declare global {
  interface Window {
    va?: { track?: (event: string, data?: Record<string, unknown>) => void };
  }
}

function sanitizePayload(payload?: Record<string, unknown>) {
  if (!payload) return undefined;
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return undefined;
  }
}

export function logEvent(name: string, payload?: TelemetryPayload) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return;
  }
  const eventName = name.trim();
  const sanitized = sanitizePayload(payload ?? undefined) ?? undefined;

  if (typeof window !== 'undefined') {
    try {
      const tracker = window.va?.track;
      if (typeof tracker === 'function') {
        tracker(eventName, sanitized);
        return;
      }
    } catch {
      // fall through to console
    }
  }

  if (sanitized) {
    console.info(`[telemetry] ${eventName}`, sanitized);
  } else {
    console.info(`[telemetry] ${eventName}`);
  }
}
