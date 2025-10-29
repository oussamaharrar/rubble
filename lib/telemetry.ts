export type TelemetryPayload = Record<string, unknown> | undefined;

function dispatchAnalytics(name: string, payload?: Record<string, unknown>) {
  let handled = false;
  if (typeof window !== 'undefined') {
    if (window.analytics?.track) {
      window.analytics.track(name, payload ?? {});
      handled = true;
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, payload ?? {});
      handled = true;
    }
  }
  return handled;
}

export function logEvent(name: string, payload?: Record<string, unknown>) {
  if (dispatchAnalytics(name, payload)) {
    return;
  }
  const context = payload ? ` ${JSON.stringify(payload)}` : '';
  console.info(`[telemetry] ${name}${context}`);
}
